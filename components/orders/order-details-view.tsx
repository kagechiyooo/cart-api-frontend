'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { OrderStatusBadge } from '@/components/order-status-badge'
import { OrderSummary } from '@/components/order-summary'
import { ErrorState, LoadingState } from '@/components/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError, getErrorMessage } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/format'
import { useOrder, useRevalidate } from '@/lib/hooks/use-api'

export function OrderDetailsView({ id }: { id: string }) {
  const { data: order, error, isLoading, mutate } = useOrder(id)
  const revalidate = useRevalidate()
  const searchParams = useSearchParams()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const justPlaced = searchParams.get('placed') === '1'

  const backLink = (
    <Link
      href="/orders"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to orders
    </Link>
  )

  if (isLoading) return <LoadingState label="Loading order…" />
  if (error || !order) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <ErrorState
          title={notFound ? 'Order not found' : 'Could not load this order'}
          message={getErrorMessage(error)}
          onRetry={notFound ? undefined : () => mutate()}
        />
      </div>
    )
  }

  const cancellable = order.status === 'pending' || order.status === 'processing'

  return (
    <div className="flex flex-col gap-6" data-testid="order-details">
      {backLink}

      {justPlaced && (
        <Alert data-testid="order-success" className="border-primary/30 bg-accent">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>Thank you, your order has been placed.</AlertTitle>
          <AlertDescription>
            {"We'll let you know when it ships. You can track it from your order history."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.id}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
          </p>
        </div>
        {cancellable && (
          <Button
            variant="outline"
            onClick={() => setConfirmCancel(true)}
            data-testid="cancel-order"
          >
            Cancel order
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <section aria-labelledby="order-items-heading" className="rounded-lg border bg-card">
          <h2 id="order-items-heading" className="border-b px-4 py-3 font-medium">
            Items
          </h2>
          <Table data-testid="order-items-table">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="pr-4 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="pl-4 font-medium">{item.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.priceCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {formatCurrency(item.priceCents * item.quantity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="order-totals-heading"
            className="flex flex-col gap-3 rounded-lg border bg-card p-4"
          >
            <h2 id="order-totals-heading" className="font-medium">
              Summary
            </h2>
            <OrderSummary totals={order.totals} couponCode={order.couponCode} />
          </section>
          <section
            aria-labelledby="order-shipping-heading"
            className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm"
          >
            <h2 id="order-shipping-heading" className="font-medium">
              Shipping & payment
            </h2>
            <address className="not-italic text-muted-foreground" data-testid="shipping-address">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.addressLine}
              <br />
              {order.shippingAddress.postalCode} {order.shippingAddress.city}
              <br />
              {order.shippingAddress.country}
            </address>
            <p className="text-muted-foreground">
              Paid with{' '}
              <span className="font-medium text-foreground" data-testid="payment-method">
                {order.paymentMethod === 'card' ? 'Credit card' : 'PayPal'}
              </span>
            </p>
          </section>
          <Link href="/products" className={buttonVariants({ variant: 'outline' })}>
            Continue shopping
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel order ${order.id}?`}
        description="This cannot be undone. Reserved items will be returned to stock."
        confirmLabel="Cancel order"
        pendingLabel="Cancelling…"
        onConfirm={async () => {
          const updated = await api.orders.cancel(order.id)
          await mutate(updated, { revalidate: false })
          await Promise.all([revalidate.orders(), revalidate.products()])
          toast.success(`Order ${order.id} cancelled.`)
        }}
      />
    </div>
  )
}
