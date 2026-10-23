export type Role = 'customer' | 'admin'
export type MemberTier = 'normal' | 'prime'
export interface Notice { code: string; message: string }
/** Legacy *Cents names contain whole BAHT, never satang. */

export interface User {
  id: string
  name: string
  email: string
  role: Role
  username?: string
  token?: string
  memberTier?: MemberTier
}

export interface Product {
  id: string
  name: string
  description: string
  priceCents: number
  weightGram: number
  category: string
  stock: number
  imageUrl: string
  active: boolean
}

export interface CartItem {
  id: string
  available: boolean
  productId: string
  name: string
  priceCents: number
  quantity: number
  weightGram: number
  imageUrl: string
  stock: number
}

export interface Totals {
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
}

/** Internal English labels for the server's cart lifecycle. */
export type CartStage = 'cart' | 'checkout' | 'success'

export interface Cart {
  notices: Notice[]
  stage: CartStage
  count: number
  currentOrderId: string | null
  coupon: Coupon | null
  items: CartItem[]
  couponCode: string | null
  totals: Totals
}

export type CouponType = 'percent' | 'fixed'

export interface Coupon {
  id: string
  code: string
  description: string
  type: CouponType
  /** Percent for SRS coupons; legacy fixed amounts, if present, are whole baht. */
  value: number
  minSubtotalCents: number
  active: boolean
  /** ISO date (YYYY-MM-DD). The coupon is valid through the end of this day. */
  expiresAt: string | null
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'paid'

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'paid',
]

export interface ShippingAddress {
  fullName: string
  addressLine: string
  city: string
  postalCode: string
  country: string
}

export type PaymentMethod = 'card' | 'paypal'

export interface OrderItem {
  weightGram: number
  productId: string
  name: string
  priceCents: number
  quantity: number
}

export interface Order {
  notices: Notice[]
  totalWeightGram: number
  discountSource: 'coupon' | 'member' | 'none'
  id: string
  userId: string
  createdAt: string
  status: OrderStatus
  items: OrderItem[]
  couponCode: string | null
  totals: Totals
  zone: 'inCity' | 'upcountry' | 'remote'
  speed: 'standard' | 'express'
  shippingAddress?: ShippingAddress
  paymentMethod?: PaymentMethod
}
