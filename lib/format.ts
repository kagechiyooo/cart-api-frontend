import type { Coupon, OrderStatus } from '@/lib/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatCouponValue(coupon: Pick<Coupon, 'type' | 'value'>): string {
  return coupon.type === 'percent' ? `${coupon.value}% off` : `${formatCurrency(coupon.value)} off`
}

export function formatOrderStatus(status: OrderStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function dollarsToCents(value: string): number {
  return Math.round(Number.parseFloat(value) * 100)
}

export function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
