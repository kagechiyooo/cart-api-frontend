import type { Coupon, OrderStatus } from '@/lib/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'THB',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents)
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatCouponValue(coupon: Pick<Coupon, 'type' | 'value'>): string {
  return coupon.type === 'percent' ? `${coupon.value}% off` : `${formatCurrency(coupon.value)} off`
}

export function formatOrderStatus(status: OrderStatus): string {
  return ({ pending: 'รอชำระเงิน', paid: 'ชำระเงินแล้ว', cancelled: 'ยกเลิก', processing: 'กำลังดำเนินการ', shipped: 'จัดส่งแล้ว', delivered: 'ส่งถึงแล้ว' })[status]
}

export function formatOrderStatusLabel(status: OrderStatus): string {
  return ({ pending: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered' })[status]
}

export function dollarsToCents(value: string): number {
  return Number(value)
}

export function centsToDollarsInput(cents: number): string {
  return String(cents)
}
