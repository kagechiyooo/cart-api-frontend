export type Role = 'customer' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface Product {
  id: string
  name: string
  description: string
  priceCents: number
  category: string
  stock: number
  imageUrl: string
  active: boolean
}

export interface CartItem {
  productId: string
  name: string
  priceCents: number
  quantity: number
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

export interface Cart {
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
  /** Percent (1-100) when type is "percent", amount in cents when type is "fixed". */
  value: number
  minSubtotalCents: number
  active: boolean
  /** ISO date (YYYY-MM-DD). The coupon is valid through the end of this day. */
  expiresAt: string | null
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
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
  productId: string
  name: string
  priceCents: number
  quantity: number
}

export interface Order {
  id: string
  userId: string
  createdAt: string
  status: OrderStatus
  items: OrderItem[]
  couponCode: string | null
  totals: Totals
  shippingAddress: ShippingAddress
  paymentMethod: PaymentMethod
}
