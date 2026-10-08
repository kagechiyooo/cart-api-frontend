import type { Coupon, Totals } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

export const FREE_SHIPPING_THRESHOLD_CENTS = 5000
export const SHIPPING_FEE_CENTS = 599
export const TAX_RATE = 0.08
export const MAX_QUANTITY_PER_ITEM = 10

export function isCouponExpired(coupon: Coupon, now: Date = new Date()): boolean {
  if (!coupon.expiresAt) return false
  const endOfDay = new Date(`${coupon.expiresAt}T23:59:59.999Z`)
  return now.getTime() > endOfDay.getTime()
}

/** Returns a user-facing error message, or null when the coupon can be applied. */
export function getCouponError(
  coupon: Coupon | undefined,
  subtotalCents: number,
  now: Date = new Date(),
): string | null {
  if (!coupon) return 'This coupon code is not valid.'
  if (!coupon.active) return 'This coupon is no longer active.'
  if (isCouponExpired(coupon, now)) return 'This coupon has expired.'
  if (subtotalCents < coupon.minSubtotalCents) {
    return `This coupon requires a minimum subtotal of ${formatCurrency(coupon.minSubtotalCents)}.`
  }
  return null
}

export function calculateDiscount(coupon: Coupon | null, subtotalCents: number): number {
  if (!coupon) return 0
  const raw =
    coupon.type === 'percent' ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value
  return Math.min(raw, subtotalCents)
}

export function calculateTotals(subtotalCents: number, coupon: Coupon | null): Totals {
  const discountCents = calculateDiscount(coupon, subtotalCents)
  const discountedSubtotal = subtotalCents - discountCents
  const shippingCents =
    subtotalCents === 0 || discountedSubtotal >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : SHIPPING_FEE_CENTS
  const taxCents = Math.round(discountedSubtotal * TAX_RATE)
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: discountedSubtotal + shippingCents + taxCents,
  }
}
