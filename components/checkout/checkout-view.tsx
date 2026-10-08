'use client'

import Link from 'next/link'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { OrderSummary } from '@/components/order-summary'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useCart } from '@/lib/hooks/use-api'

export function CheckoutView() {
  const { data: cart, error, isLoading, mutate } = useCart()

  if (isLoading) return <LoadingState label="Loading checkout…" />
  if (error || !cart) {
    return (
      <ErrorState
        title="Could not load your cart"
        message={getErrorMessage(error)}
        onRetry={() => mutate()}
      />
    )
  }
  if (cart.items.length === 0) {
    return (
      <EmptyState
        testId="checkout-empty"
        title="Nothing to check out"
        description="Your cart is empty. Add some products first."
        action={
          <Link href="/products" className={buttonVariants()}>
            Browse products
          </Link>
        }
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <CheckoutForm totalCents={cart.totals.totalCents} />

      <aside
        aria-labelledby="checkout-summary-heading"
        className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:sticky lg:top-24"
      >
        <div className="flex items-center justify-between">
          <h2 id="checkout-summary-heading" className="font-medium">
            Order summary
          </h2>
          <Link href="/cart" className="text-sm text-primary underline-offset-4 hover:underline">
            Edit cart
          </Link>
        </div>
        <ul className="flex flex-col gap-2 text-sm" aria-label="Items in this order">
          {cart.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {item.name} <span className="tabular-nums">× {item.quantity}</span>
              </span>
              <span className="tabular-nums">{formatCurrency(item.priceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <OrderSummary totals={cart.totals} couponCode={cart.couponCode} className="border-t pt-4" />
      </aside>
    </div>
  )
}
