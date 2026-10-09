'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import type { CheckoutInput } from '@/lib/api'
import { calculateSubtotal, calculateTotalWeight, calculateDiscount, classifyWeight, calculateShippingFee, calculateNetTotal } from '@/lib/pricing'
import { AppMessage, Notices } from '@/components/app-message'
import { CartItemRow } from '@/components/cart/cart-item-row'
import { CouponForm } from '@/components/cart/coupon-form'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { OrderSummary } from '@/components/order-summary'
import { EmptyState, LoadingState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { useCart } from '@/lib/hooks/use-api'

export function CartView() {
  const { data: cart, error } = useCart()
  const { user } = useAuth()
  const [zone, setZone] = useState<CheckoutInput['zone']>('inCity')
  const [speed, setSpeed] = useState<CheckoutInput['speed']>('standard')
  if (error) return <AppMessage error={error} />
  if (!cart) return <LoadingState />
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const memberTier = user?.memberTier ?? 'normal'
  const subtotalCents = calculateSubtotal(cart.items.map(item => ({ price: item.priceCents, quantity: item.quantity })))
  const discount = calculateDiscount(subtotalCents, memberTier, cart.coupon ? {
    percent: cart.coupon.value, minSpend: cart.coupon.minSubtotalCents, active: cart.coupon.active,
  } : null)
  const weightTier = classifyWeight(calculateTotalWeight(cart.items))
  const shippingCents = weightTier === 'overLimit' ? null : cart.items.length ? calculateShippingFee(weightTier, zone, speed, memberTier) : 0
  const previewTotals = shippingCents === null ? null : {
    subtotalCents, discountCents: discount.discount, shippingCents, taxCents: 0,
    totalCents: calculateNetTotal(subtotalCents, discount.discount, shippingCents),
  }
  return (
    <div data-status="ตะกร้า" className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      {cart.items.length ? (
        <section aria-labelledby="cart-items-heading" className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <h2 id="cart-items-heading" className="font-medium">Items <span className="text-muted-foreground">({itemCount})</span></h2>
          </div>
          <ul className="divide-y" aria-label="Cart items">{cart.items.map(item => <CartItemRow key={item.id} item={item} />)}</ul>
        </section>
      ) : (
        <EmptyState testId="cart-empty" title="Your cart is empty" description="Browse the catalog and add something you like." action={<><AppMessage code="EMPTY_CART">ตะกร้าว่าง</AppMessage><Link href="/products" className={buttonVariants({ className: 'mt-3' })}>Browse products</Link></>} />
      )}
      <aside aria-labelledby="cart-summary-heading" className="flex flex-col gap-5 rounded-lg border bg-card p-4 lg:sticky lg:top-24">
        <h2 id="cart-summary-heading" className="font-medium">Order summary</h2>
        <Notices notices={cart.notices} />
        <CouponForm appliedCode={cart.couponCode} />
        <p className="text-sm text-muted-foreground">Estimated totals. Final pricing and availability are confirmed at checkout.</p>
        {previewTotals ? <OrderSummary totals={previewTotals} couponCode={discount.source === 'coupon' ? cart.couponCode : null} prefix="cart" /> : <p role="status" className="text-sm text-destructive">Cart weight exceeds 20,000 g. Shipping and total cannot be estimated; reduce the quantity before checkout.</p>}
        {discount.couponRemoved && <p className="text-sm text-muted-foreground">This coupon does not qualify for the estimate. It remains attached until checkout evaluates it.</p>}
        <CheckoutForm zone={zone} speed={speed} onZoneChange={setZone} onSpeedChange={setSpeed} />
      </aside>
    </div>
  )
}
