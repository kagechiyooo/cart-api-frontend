import type {
  Cart,
  Coupon,
  Order,
  PaymentMethod,
  Product,
  ShippingAddress,
  User,
} from '@/lib/types'

export interface LoginInput {
  email: string
  password: string
}

export type ProductInput = Omit<Product, 'id'>

export type CouponInput = Omit<Coupon, 'id'>

export interface CheckoutInput {
  shippingAddress: ShippingAddress
  paymentMethod: PaymentMethod
}

/**
 * The contract every UI component depends on. The mock adapter implements it
 * today; `rest/services.ts` is where each method gets mapped to the existing
 * REST API once its endpoints are known.
 */
export interface ApiServices {
  auth: {
    login(input: LoginInput): Promise<User>
    logout(): Promise<void>
    getCurrentUser(): Promise<User | null>
  }
  products: {
    list(options?: { includeInactive?: boolean }): Promise<Product[]>
    get(id: string): Promise<Product>
    create(input: ProductInput): Promise<Product>
    update(id: string, input: ProductInput): Promise<Product>
    remove(id: string): Promise<void>
  }
  cart: {
    get(): Promise<Cart>
    addItem(productId: string, quantity: number): Promise<Cart>
    updateItem(productId: string, quantity: number): Promise<Cart>
    removeItem(productId: string): Promise<Cart>
    clear(): Promise<Cart>
    applyCoupon(code: string): Promise<Cart>
    removeCoupon(): Promise<Cart>
  }
  orders: {
    list(): Promise<Order[]>
    get(id: string): Promise<Order>
    checkout(input: CheckoutInput): Promise<Order>
    cancel(id: string): Promise<Order>
  }
  coupons: {
    list(): Promise<Coupon[]>
    create(input: CouponInput): Promise<Coupon>
    update(id: string, input: CouponInput): Promise<Coupon>
    remove(id: string): Promise<void>
  }
}
