import { assertTestMode } from '@/lib/api/config'
import { authToken, httpRequest } from '@/lib/api/http-client'
import type { ApiServices, LoginResponse, PaymentSuccessResponse, PaymentFailResponse } from '@/lib/api/types'
import type { Cart, CartStage, Coupon, Order, Product, Totals, User } from '@/lib/types'

/** Wire monetary values are whole baht, despite legacy internal *Cents names. */
interface ProductDto {
  id?: string; productId?: string; name: string; price: number; weightGram: number; stock: number
  status: 'เปิดขาย' | 'ปิดขาย'; description?: string; category?: string; imageUrl?: string
}
interface CouponDto { code: string; percent: number; minSpend: number; status: 'เปิดใช้' | 'ปิดใช้' }
interface ItemDto { productId: string; name: string; price: number; weightGram: number; quantity: number; available?: boolean; stock?: number; imageUrl?: string }
interface OrderDto {
  orderId: string; status: Order['status'] | 'รอชำระเงิน' | 'ชำระเงินแล้ว' | 'ยกเลิก'; items: ItemDto[]; subtotal: number; discount: number
  shippingFee: number; netTotal: number; zone: Order['zone']; speed: Order['speed']; couponCode: string | null
  userId?: string; createdAt?: string; notices?: Order['notices']; totalWeightGram?: number; discountSource?: Order['discountSource']
}
interface CartDto {
  stage: CartStage | 'ตะกร้า' | 'ชำระเงิน' | 'สำเร็จ'; items: ItemDto[]; count: number; total: number; couponCode?: string | null
  notices?: Cart['notices']; coupon?: CouponDto | null; currentOrderId?: string | null
}
function product(p: ProductDto): Product {
  return { id: p.productId ?? p.id ?? '', name: p.name, priceCents: p.price, weightGram: p.weightGram, stock: p.stock,
    active: p.status === 'เปิดขาย', description: p.description ?? '', category: p.category ?? '', imageUrl: p.imageUrl ?? '' }
}
function coupon(c: CouponDto): Coupon {
  return { id: c.code, code: c.code, type: 'percent', value: c.percent, minSubtotalCents: c.minSpend,
    active: c.status === 'เปิดใช้', description: '', expiresAt: null }
}
function totals(subtotal: number, discount = 0, shipping = 0, total = subtotal - discount + shipping): Totals {
  return { subtotalCents: subtotal, discountCents: discount, shippingCents: shipping, taxCents: 0, totalCents: total }
}
function cart(c: CartDto): Cart {
  return { notices: c.notices ?? [], stage: c.stage === 'ตะกร้า' ? 'cart' : c.stage === 'ชำระเงิน' ? 'checkout' : c.stage === 'สำเร็จ' ? 'success' : c.stage, count: c.count, currentOrderId: c.currentOrderId ?? null,
    items: c.items.map(i => ({ id: i.productId, productId: i.productId, name: i.name, priceCents: i.price,
      weightGram: i.weightGram, quantity: i.quantity, available: i.available ?? false, stock: i.stock ?? 0, imageUrl: i.imageUrl ?? '' })),
    coupon: c.coupon ? coupon(c.coupon) : null, couponCode: c.couponCode ?? c.coupon?.code ?? null,
    totals: totals(c.total) }
}
function order(o: OrderDto): Order {
  return { notices: o.notices ?? [], totalWeightGram: o.totalWeightGram ?? o.items.reduce((sum, i) => sum + i.weightGram * i.quantity, 0), discountSource: o.discountSource ?? 'none', id: o.orderId, userId: o.userId ?? '', createdAt: o.createdAt ?? '', status: o.status === 'รอชำระเงิน' ? 'pending' : o.status === 'ชำระเงินแล้ว' ? 'paid' : o.status === 'ยกเลิก' ? 'cancelled' : o.status,
    items: o.items.map(i => ({ productId: i.productId, name: i.name, priceCents: i.price, weightGram: i.weightGram, quantity: i.quantity })),
    totals: totals(o.subtotal, o.discount, o.shippingFee, o.netTotal), couponCode: o.couponCode, zone: o.zone, speed: o.speed }
}
const SESSION_KEY = 'api-user'
let session: User | null = null
function saveSession(user: User | null) {
  session = user
  if (typeof window !== 'undefined') {
    if (user) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else window.sessionStorage.removeItem(SESSION_KEY)
  }
}
const id = encodeURIComponent

/** Test-only gateway adapter, separate from customer ApiServices.
 * No undocumented gateway credentials or reset endpoint are invented.
 */
export const restPaymentCallbacks = {
  async success(orderId: string): Promise<PaymentSuccessResponse> {
    assertTestMode()
    const response = await httpRequest<PaymentSuccessResponse>(`/payments/${id(orderId)}/success`, { method: 'POST' })
    return { ...response, status: response.status === 'ชำระเงินแล้ว' ? 'paid' : response.status }
  },
  fail(orderId: string): Promise<PaymentFailResponse> {
    assertTestMode()
    return httpRequest(`/payments/${id(orderId)}/fail`, { method: 'POST' })
  },
}

export const restServices: ApiServices = {
  auth: {
    async login(input) {
      const response = await httpRequest<LoginResponse>('/auth/login', { method: 'POST', body: input })
      authToken.set(response.token)
      const user: User = { id: input.username, username: input.username, name: input.username, email: '', ...response, role: response.role === 'Admin' || response.role === 'admin' ? 'admin' : 'customer' }
      saveSession(user)
      return user
    },
    async logout() { authToken.set(null); saveSession(null) },
    async getCurrentUser() {
      if (!authToken.get()) return null
      if (typeof window !== 'undefined') {
        try { return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? 'null') as User | null }
        catch { return null }
      }
      return session
    },
  },
  products: {
    async list() { return (await httpRequest<ProductDto[]>('/products')).map(product) },
    async update(productId, input) {
      return product(await httpRequest<ProductDto>(`/admin/products/${id(productId)}`, { method: 'PATCH',
        body: { ...(input.priceCents !== undefined ? { price: input.priceCents } : {}), ...(input.stock !== undefined ? { stock: input.stock } : {}) } }))
    },
    async setStatus(productId, status) { return product(await httpRequest<ProductDto>(`/admin/products/${id(productId)}/status`, { method: 'PATCH', body: { status } })) },
  },
  cart: {
    async get() { return cart(await httpRequest<CartDto>('/cart')) },
    async addItem(productId, quantity) { return cart(await httpRequest<CartDto>('/cart/items', { method: 'POST', body: { productId, quantity } })) },
    async updateItem(productId, quantity) { return cart(await httpRequest<CartDto>(`/cart/items/${id(productId)}`, { method: 'PATCH', body: { quantity } })) },
    async removeItem(productId) { return cart(await httpRequest<CartDto>(`/cart/items/${id(productId)}`, { method: 'DELETE' })) },
    async applyCoupon(code) { return cart(await httpRequest<CartDto>('/cart/coupon', { method: 'PUT', body: { code } })) },
  },
  orders: {
    async list() { return (await httpRequest<OrderDto[]>('/orders')).map(order) },
    async get(orderId) { return order(await httpRequest<OrderDto>(`/orders/${id(orderId)}`)) },
    async checkout(input) { return order(await httpRequest<OrderDto>('/checkout', { method: 'POST', body: input })) },
    async cancel() {
      const result = await httpRequest<{ order: OrderDto; cart: CartDto }>('/checkout/cancel', { method: 'POST' })
      return cart(result.cart)
    },
    async continueShopping() {
      await httpRequest<unknown>('/checkout/continue-shopping', { method: 'POST' })
      return cart(await httpRequest<CartDto>('/cart'))
    },
  },
  coupons: {
    async list() { return (await httpRequest<CouponDto[]>('/admin/coupons')).map(coupon) },
    async setStatus(code, status) { return coupon(await httpRequest<CouponDto>(`/admin/coupons/${id(code)}/status`, { method: 'PATCH', body: { status } })) },
  },
}
