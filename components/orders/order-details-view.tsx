'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppMessage, Notices } from '@/components/app-message'
import { OrderStatusBadge } from '@/components/order-status-badge'
import { OrderSummary } from '@/components/order-summary'
import { LoadingState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate, formatOrderStatus } from '@/lib/format'
import { useOrder } from '@/lib/hooks/use-api'

export function OrderDetailsView({ id }: { id: string }) {
  const { data: order, error } = useOrder(id)
  const backLink = (
    <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to orders
    </Link>
  )

  return (
    <section data-testid="page-order-detail" className="flex flex-col gap-6">
      {backLink}
      {error ? <AppMessage error={error} /> : !order ? <LoadingState label="Loading order…" /> : (
        <div className="flex flex-col gap-6" data-testid="order-details">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 data-testid="order-detail-id" className="font-mono text-2xl font-semibold tracking-tight">{order.id}</h1>
                <span data-testid="order-detail-status" data-status={formatOrderStatus(order.status)}>
                  <OrderStatusBadge status={order.status} />
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Placed on <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
              </p>
            </div>
          </div>

          <Notices notices={order.notices} />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <section aria-labelledby="order-items-heading" className="rounded-lg border bg-card">
              <h2 id="order-items-heading" className="border-b px-4 py-3 font-medium">Items</h2>
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
                  {order.items.map(item => (
                    <TableRow key={item.productId} data-testid={`order-line-${item.productId}`}>
                      <TableCell className="pl-4 font-medium" data-testid="order-line-name">{item.name}</TableCell>
                      <TableCell className="text-right tabular-nums" data-testid="order-line-unit-price" data-value={item.priceCents}>{formatCurrency(item.priceCents)}</TableCell>
                      <TableCell className="text-right tabular-nums" data-testid="order-line-qty" data-value={item.quantity}>{item.quantity}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{formatCurrency(item.priceCents * item.quantity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <div className="flex flex-col gap-4">
              <section aria-labelledby="order-totals-heading" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <h2 id="order-totals-heading" className="font-medium">Summary</h2>
                <OrderSummary totals={order.totals} couponCode={order.couponCode} prefix="order-detail" />
              </section>
              <section aria-labelledby="order-shipping-heading" className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm">
                <h2 id="order-shipping-heading" className="font-medium">Shipping</h2>
                <dl className="flex flex-col gap-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Shipping zone</dt>
                    <dd>{{ inCity: 'In city', upcountry: 'Upcountry', remote: 'Remote' }[order.zone]}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Delivery speed</dt>
                    <dd>{order.speed === 'express' ? 'Express' : 'Standard'}</dd>
                  </div>
                </dl>
              </section>
              <Link href="/products" className={buttonVariants({ variant: 'outline' })}>Continue shopping</Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
