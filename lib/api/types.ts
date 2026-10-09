import type { Cart, Coupon, Order, Product, User } from '@/lib/types'

export interface LoginInput { username: string; password: string }
/** REST accepts title-case roles and normalizes them to internal lowercase roles. */
export interface LoginResponse { token: string; role: User['role'] | 'Customer' | 'Admin'; memberTier?: User['memberTier'] }

/** REST gateway payment success maps ชำระเงินแล้ว to paid. */
export interface PaymentSuccessResponse { orderId: string; status: string }
export interface PaymentFailResponse { message: string }
export interface ProductInput { priceCents?: number; stock?: number }
export type ProductStatus = 'เปิดขาย' | 'ปิดขาย'
export type CouponStatus = 'เปิดใช้' | 'ปิดใช้'
export interface CheckoutInput {
  zone: 'inCity' | 'upcountry' | 'remote'
  speed: 'standard' | 'express'
}

/** Only documented server operations; auth session helpers are local, not endpoints. */
export interface ApiServices {
  auth: {
    login(input: LoginInput): Promise<User>
    logout(): Promise<void>
    getCurrentUser(): Promise<User | null>
  }
  products: {
    list(options?: { includeInactive?: boolean }): Promise<Product[]>
    update(id: string, input: ProductInput): Promise<Product>
    setStatus(id: string, status: ProductStatus): Promise<Product>
  }
  cart: {
    get(): Promise<Cart>
    addItem(productId: string, quantity: number): Promise<Cart>
    updateItem(id: string, quantity: number): Promise<Cart>
    removeItem(id: string): Promise<Cart>
    applyCoupon(code: string): Promise<Cart>
  }
  orders: {
    list(): Promise<Order[]>
    get(id: string): Promise<Order>
    checkout(input: CheckoutInput): Promise<Order>
    cancel(): Promise<Cart>
    continueShopping(): Promise<Cart>
  }
  coupons: {
    list(): Promise<Coupon[]>
    setStatus(code: string, status: CouponStatus): Promise<Coupon>
  }
}
