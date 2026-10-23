import { assertTestMode } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'
import type { MockDb, MockUser } from '@/lib/api/mock/seed'
import { simulateRequest } from '@/lib/api/mock/store'
import type { ApiServices } from '@/lib/api/types'
import { calculateDiscount, calculateShippingFee, calculateTotalWeight, classifyWeight, isProductAvailable, validateQuantityChange, validateCheckout, validateProductUpdate } from '@/lib/pricing'
import type { Cart, Order, Product, User } from '@/lib/types'

function publicUser({ password: _password, ...user }: MockUser): User {
  return { ...user, token: `mock-${user.id}` }
}
function requireUser(db: MockDb, role?: User['role']) {
  const user = db.users.find(u => u.id === db.sessionUserId)
  if (!user) throw new ApiError('Please sign in to continue.', 401, 'AUTH_REQUIRED')
  if (role && user.role !== role) throw new ApiError('You do not have permission to do that.', 403, 'AUTH_FORBIDDEN')
  return user
}
function product(db: MockDb, id: string): Product {
  const value = db.products.find(p => p.id === id)
  if (!value) throw new ApiError('Product not found.', 404, 'PRODUCT_NOT_FOUND')
  return value
}
function coupon(db: MockDb, code: string) {
  const value = db.coupons.find(c => c.code === code)
  if (!value) throw new ApiError('Coupon not found.', 404, 'COUPON_NOT_FOUND')
  return value
}
function state(db: MockDb, userId: string) {
  return db.carts[userId] ??= { stage: 'cart', currentOrderId: null, items: [], couponCode: null }
}
function editable(db: MockDb) {
  const user = requireUser(db, 'customer')
  const cart = state(db, user.id)
  if (cart.stage !== 'cart') throw new ApiError('This operation requires cart stage.', 400, 'OPERATION_NOT_ALLOWED')
  return { user, cart }
}
function changeQuantity(db: MockDb, cart: ReturnType<typeof state>, productId: string, amount: unknown, operation: 'add' | 'update') {
  const p = db.products.find(p => p.id === productId)
  const item = cart.items.find(i => i.productId === productId)
  const code = validateQuantityChange({ operation, quantity: amount, productExists: !!p, inCart: !!item, available: !!p && isProductAvailable(p.active, p.stock), currentQtyInCart: item?.quantity ?? 0, availableStock: p?.stock ?? 0 })
  if (code !== 'OK') throw new ApiError(code, code === 'PRODUCT_NOT_FOUND' ? 404 : 400, code)
  return item
}
function buildCart(db: MockDb, userId: string): Cart {
  const cart = state(db, userId)
  const items = cart.items.map(i => {
    const p = product(db, i.productId)
    return { ...i, id: i.productId, name: p.name, priceCents: p.priceCents, imageUrl: p.imageUrl,
      weightGram: p.weightGram, stock: p.stock, available: isProductAvailable(p.active, p.stock) }
  })
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
  const attached = cart.couponCode ? coupon(db, cart.couponCode) : null
  return { notices: cart.notices ?? [], stage: cart.stage, currentOrderId: cart.currentOrderId, items,
    count: items.length, couponCode: cart.couponCode, coupon: attached,
    totals: { subtotalCents, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: subtotalCents } }
}
function currentOrder(db: MockDb, userId: string) {
  const cart = state(db, userId)
  const order = db.orders.find(o => o.id === cart.currentOrderId && o.userId === userId)
  if (cart.stage !== 'checkout' || !order || order.status !== 'pending') {
    throw new ApiError('There is no current checkout to cancel.', 400, 'OPERATION_NOT_ALLOWED')
  }
  return { cart, order }
}

export const mockServices: ApiServices = {
  auth: {
    login: ({ username, password }) => simulateRequest('auth.login', db => {
      const user = db.users.find(u => u.username?.toLowerCase() === username.trim().toLowerCase() && u.password === password)
      if (!user) throw new ApiError('Invalid username or password.', 401, 'AUTH_INVALID_CREDENTIALS')
      db.sessionUserId = user.id
      return publicUser(user)
    }),
    logout: () => simulateRequest('auth.logout', db => { db.sessionUserId = null }),
    getCurrentUser: () => simulateRequest('auth.getCurrentUser', db => {
      const user = db.users.find(u => u.id === db.sessionUserId)
      return user ? publicUser(user) : null
    }),
  },
  products: {
    list: () => simulateRequest('products.list', db => {
      const user = requireUser(db)
      return user.role === 'admin' ? db.products : db.products.filter(p => p.active)
    }),
    update: (id, input) => simulateRequest('products.update', db => {
      requireUser(db, 'admin')
      const p = product(db, id)
      const fields = validateProductUpdate({ price: input.priceCents, stock: input.stock })
      if (fields.length) throw new ApiError('Invalid product fields.', 400, 'VALIDATION_ERROR', fields)
      if (input.priceCents !== undefined) p.priceCents = input.priceCents
      if (input.stock !== undefined) p.stock = input.stock
      return p
    }),
    setStatus: (id, status) => simulateRequest('products.setStatus', db => {
      requireUser(db, 'admin')
      const p = product(db, id)
      if (status !== 'เปิดขาย' && status !== 'ปิดขาย') throw new ApiError('Invalid product status.', 400, 'VALIDATION_ERROR')
      p.active = status === 'เปิดขาย'
      return p
    }),
  },
  cart: {
    get: () => simulateRequest('cart.get', db => buildCart(db, requireUser(db, 'customer').id)),
    addItem: (productId, amount) => simulateRequest('cart.addItem', db => {
      const { user, cart } = editable(db)
      const existing = changeQuantity(db, cart, productId, amount, 'add')
      if (existing) existing.quantity += amount
      else cart.items.push({ productId, quantity: amount })
      return buildCart(db, user.id)
    }),
    updateItem: (productId, amount) => simulateRequest('cart.updateItem', db => {
      const { user, cart } = editable(db)
      const item = changeQuantity(db, cart, productId, amount, 'update')!
      item.quantity = amount
      return buildCart(db, user.id)
    }),
    removeItem: productId => simulateRequest('cart.removeItem', db => {
      const { user, cart } = editable(db)
      if (!cart.items.length) throw new ApiError('ไม่มีสินค้าให้ลบ', 400, 'CART_EMPTY')
      if (!cart.items.some(i => i.productId === productId)) throw new ApiError('ไม่พบสินค้าในตะกร้า', 400, 'ITEM_NOT_IN_CART')
      cart.items = cart.items.filter(i => i.productId !== productId)
      return buildCart(db, user.id)
    }),
    applyCoupon: code => simulateRequest('cart.applyCoupon', db => {
      const { user, cart } = editable(db)
      const c = coupon(db, code)
      if (!c.active) throw new ApiError('Coupon is inactive.', 400, 'COUPON_INVALID')
      cart.couponCode = c.code
      return buildCart(db, user.id)
    }),
  },
  orders: {
    list: () => simulateRequest('orders.list', db => {
      const user = requireUser(db, 'customer')
      return db.orders.filter(o => o.userId === user.id).reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }),
    get: id => simulateRequest('orders.get', db => {
      const user = requireUser(db, 'customer')
      const order = db.orders.find(o => o.id === id && o.userId === user.id)
      if (!order) throw new ApiError('Order not found.', 404, 'ORDER_NOT_FOUND')
      return order
    }),
    checkout: input => simulateRequest('orders.checkout', db => {
      const { user, cart } = editable(db)
      const view = buildCart(db, user.id)
      const totalWeightGram = calculateTotalWeight(view.items)
      const validation = validateCheckout({ ...input, lines: view.items.map(({ productId, quantity, available, stock }) => ({ productId, quantity, available, availableStock: stock })), totalWeightGram })
      if (validation.result !== 'OK') throw new ApiError(validation.result === 'CART_EMPTY' ? 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง' : validation.result, 400, validation.result, undefined, 'productIds' in validation ? validation.productIds : undefined)
      const c = cart.couponCode ? coupon(db, cart.couponCode) : null
      const subtotalCents = view.totals.subtotalCents
      const discount = calculateDiscount(subtotalCents, user.memberTier ?? 'normal', c ? { percent: c.value, minSpend: c.minSubtotalCents, active: c.active } : null)
      const discountCents = discount.discount
      const tier = classifyWeight(totalWeightGram)
      if (tier === 'overLimit') throw new ApiError('Weight limit exceeded.', 400, 'WEIGHT_LIMIT_EXCEEDED')
      const shippingCents = calculateShippingFee(tier, input.zone, input.speed, user.memberTier ?? 'normal')
      cart.notices = discount.couponRemoved ? [{ code: 'COUPON_NOT_APPLICABLE', message: 'คูปองถูกนำออก เนื่องจากไม่ตรงตามเงื่อนไข' }] : []
      if (discount.couponRemoved) cart.couponCode = null
      const order: Order = { notices: cart.notices, totalWeightGram, discountSource: discount.source, id: `ORD-${db.nextOrderNumber++}`, userId: user.id, createdAt: new Date().toISOString(),
        status: 'pending', items: view.items.map(({ productId, name, priceCents, quantity, weightGram }) => ({ productId, name, priceCents, quantity, weightGram })),
        couponCode: cart.couponCode, zone: input.zone, speed: input.speed,
        totals: { subtotalCents, discountCents, shippingCents, taxCents: 0, totalCents: subtotalCents - discountCents + shippingCents } }
      for (const item of order.items) product(db, item.productId).stock -= item.quantity
      db.orders.push(order)
      cart.stage = 'checkout'
      cart.currentOrderId = order.id
      return order
    }),
    cancel: () => simulateRequest('orders.cancel', db => {
      const user = requireUser(db, 'customer')
      const { cart, order } = currentOrder(db, user.id)
      for (const item of order.items) product(db, item.productId).stock += item.quantity
      order.status = 'cancelled'
      cart.stage = 'cart'
      cart.currentOrderId = null
      return buildCart(db, user.id)
    }),
    continueShopping: () => simulateRequest('orders.continueShopping', db => {
      const user = requireUser(db, 'customer')
      const cart = state(db, user.id)
      if (cart.stage !== 'success') throw new ApiError('Continue shopping requires success stage.', 400, 'OPERATION_NOT_ALLOWED')
      cart.stage = 'cart'
      cart.currentOrderId = null
      cart.notices = []
      return buildCart(db, user.id)
    }),
  },
  coupons: {
    list: () => simulateRequest('coupons.list', db => { requireUser(db, 'admin'); return db.coupons }),
    setStatus: (code, status) => simulateRequest('coupons.setStatus', db => {
      requireUser(db, 'admin')
      const c = coupon(db, code)
      if (status !== 'เปิดใช้' && status !== 'ปิดใช้') throw new ApiError('Invalid coupon status.', 400, 'VALIDATION_ERROR')
      c.active = status === 'เปิดใช้'
      return c
    }),
  },
}

/** Payment gateway simulation for tests only; deliberately absent from ApiServices. */
export const mockPaymentCallbacks = {
  success: (orderId: string) => { assertTestMode(); return simulateRequest('payments.success', db => {
    const order = db.orders.find(o => o.id === orderId)
    if (!order) throw new ApiError('Order not found.', 404, 'ORDER_NOT_FOUND')
    const cart = state(db, order.userId)
    if (order.status === 'paid') return order // Duplicate gateway delivery is harmless.
    if (order.status !== 'pending' || cart.stage !== 'checkout' || cart.currentOrderId !== order.id) {
      throw new ApiError('Order is not awaiting payment.', 400, 'OPERATION_NOT_ALLOWED')
    }
    order.status = 'paid'
    cart.stage = 'success'
    cart.items = []
    cart.couponCode = null
    return order
  }) },
  fail: (orderId: string) => { assertTestMode(); return simulateRequest('payments.fail', db => {
    const order = db.orders.find(o => o.id === orderId)
    if (!order) throw new ApiError('Order not found.', 404, 'ORDER_NOT_FOUND')
    const cart = state(db, order.userId)
    if (order.status !== 'pending' || cart.stage !== 'checkout' || cart.currentOrderId !== order.id) throw new ApiError('Order is not awaiting payment.', 400, 'OPERATION_NOT_ALLOWED')
    return { message: 'การชำระเงินล้มเหลว กรุณาลองใหม่' }
  }) },
}
