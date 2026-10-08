'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CartItemRow } from '@/components/cart/cart-item-row'
import { CouponForm } from '@/components/cart/coupon-form'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { OrderSummary } from '@/components/order-summary'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { api, getErrorMessage } from '@/lib/api'
import { FREE_SHIPPING_THRESHOLD_CENTS } from '@/lib/pricing'
import { formatCurrency } from '@/lib/format'
import { useCart, useCartMutation } from '@/lib/hooks/use-api'
import { cn } from '@/lib/utils'

export function CartView() {
  const { data: cart, error, isLoading, mutate } = useCart()
  const runCartMutation = useCartMutation()
  const [confirmClear, setConfirmClear] = useState(false)

  if (isLoading) return <LoadingState label="Loading your cart…" />
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
        testId="cart-empty"
        title="Your cart is empty"
        description="Browse the catalog and add something you like."
        action={
          <Link href="/products" className={buttonVariants()}>
            Browse products
          </Link>
        }
      />
    )
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const remainingForFreeShipping =
    FREE_SHIPPING_THRESHOLD_CENTS - (cart.totals.subtotalCents - cart.totals.discountCents)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <section aria-labelledby="cart-items-heading" className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <h2 id="cart-items-heading" className="font-medium">
            Items <span className="text-muted-foreground">({itemCount})</span>
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClear(true)}
            data-testid="clear-cart"
          >
            Clear cart
          </Button>
        </div>
        <ul className="divide-y" aria-label="Cart items" data-testid="cart-items">
          {cart.items.map((item) => (
            <CartItemRow key={item.productId} item={item} />
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="cart-summary-heading"
        className="flex flex-col gap-5 rounded-lg border bg-card p-4 lg:sticky lg:top-24"
      >
        <h2 id="cart-summary-heading" className="font-medium">
          Order summary
        </h2>
        <CouponForm appliedCode={cart.couponCode} />
        <OrderSummary totals={cart.totals} couponCode={cart.couponCode} />
        {remainingForFreeShipping > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="free-shipping-hint">
            Add {formatCurrency(remainingForFreeShipping)} more to get free shipping.
          </p>
        )}
        <Link
          href="/checkout"
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
          data-testid="proceed-to-checkout"
        >
          Proceed to checkout
        </Link>
      </aside>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear your cart?"
        description="All items and any applied coupon will be removed."
        confirmLabel="Clear cart"
        pendingLabel="Clearing…"
        onConfirm={async () => {
          await runCartMutation(() => api.cart.clear())
          toast.success('Your cart has been cleared.')
        }}
      />
    </div>
  )
}
