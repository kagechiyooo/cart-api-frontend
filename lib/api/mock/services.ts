import { ApiError } from '@/lib/api/errors'
import type { MockDb, MockUser } from '@/lib/api/mock/seed'
import { generateId, simulateRequest } from '@/lib/api/mock/store'
import type { ApiServices, CouponInput, ProductInput } from '@/lib/api/types'
import { calculateTotals, getCouponError, MAX_QUANTITY_PER_ITEM } from '@/lib/pricing'
import type { Cart, Coupon, Product, User } from '@/lib/types'

function toPublicUser({ password: _password, ...user }: MockUser): User {
  return user
}

function requireUser(db: MockDb): MockUser {
  const user = db.users.find((u) => u.id === db.sessionUserId)
  if (!user) throw new ApiError('Please sign in to continue.', 401)
  return user
}

function requireAdmin(db: MockDb): MockUser {
  const user = requireUser(db)
  if (user.role !== 'admin') throw new ApiError('You do not have permission to do that.', 403)
  return user
}

function findProduct(db: MockDb, id: string): Product {
  const product = db.products.find((p) => p.id === id)
  if (!product) throw new ApiError('Product not found.', 404)
  return product
}

function findCouponByCode(db: MockDb, code: string): Coupon | undefined {
  return db.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase())
}

function getMockCart(db: MockDb, userId: string) {
  db.carts[userId] ??= { items: [], couponCode: null }
  return db.carts[userId]
}

function buildCart(db: MockDb, userId: string): Cart {
  const mockCart = getMockCart(db, userId)
  mockCart.items = mockCart.items.filter((item) =>
    db.products.some((p) => p.id === item.productId && p.active),
  )

  const items = mockCart.items.map((item) => {
    const product = findProduct(db, item.productId)
    return {
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      stock: product.stock,
      quantity: item.quantity,
    }
  })
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)

  let coupon: Coupon | null = null
  if (mockCart.couponCode) {
    const candidate = findCouponByCode(db, mockCart.couponCode)
    if (candidate && !getCouponError(candidate, subtotalCents)) coupon = candidate
    else mockCart.couponCode = null
  }

  return {
    items,
    couponCode: coupon?.code ?? null,
    totals: calculateTotals(subtotalCents, coupon),
  }
}

function assertValidQuantity(quantity: number, product: Product) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError('Quantity must be a whole number of at least 1.', 400)
  }
  if (quantity > MAX_QUANTITY_PER_ITEM) {
    throw new ApiError(`You can order at most ${MAX_QUANTITY_PER_ITEM} of each item.`, 400)
  }
  if (quantity > product.stock) {
    throw new ApiError(
      product.stock === 0
        ? `${product.name} is out of stock.`
        : `Only ${product.stock} of ${product.name} available.`,
      409,
    )
  }
}

function validateProductInput(input: ProductInput) {
  if (!input.name.trim()) throw new ApiError('Product name is required.', 400)
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    throw new ApiError('Price must be greater than zero.', 400)
  }
  if (!Number.isInteger(input.stock) || input.stock < 0) {
    throw new ApiError('Stock cannot be negative.', 400)
  }
}

function validateCouponInput(db: MockDb, input: CouponInput, ignoreId?: string) {
  if (!/^[A-Z0-9]{3,20}$/.test(input.code)) {
    throw new ApiError('Code must be 3-20 uppercase letters or digits.', 400)
  }
  const duplicate = db.coupons.find((c) => c.code === input.code && c.id !== ignoreId)
  if (duplicate) throw new ApiError(`Coupon code ${input.code} already exists.`, 409)
  if (input.type === 'percent' && (input.value < 1 || input.value > 100)) {
    throw new ApiError('Percentage must be between 1 and 100.', 400)
  }
  if (input.type === 'fixed' && input.value <= 0) {
    throw new ApiError('Discount amount must be greater than zero.', 400)
  }
}

export const mockServices: ApiServices = {
  auth: {
    login: ({ email, password }) =>
      simulateRequest('auth.login', (db) => {
        const user = db.users.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
        )
        if (!user) throw new ApiError('Invalid email or password.', 401)
        db.sessionUserId = user.id
        return toPublicUser(user)
      }),
    logout: () =>
      simulateRequest('auth.logout', (db) => {
        db.sessionUserId = null
      }),
    getCurrentUser: () =>
      simulateRequest('auth.getCurrentUser', (db) => {
        const user = db.users.find((u) => u.id === db.sessionUserId)
        return user ? toPublicUser(user) : null
      }),
  },

  products: {
    list: (options) =>
      simulateRequest('products.list', (db) => {
        if (options?.includeInactive) {
          requireAdmin(db)
          return db.products
        }
        return db.products.filter((p) => p.active)
      }),
    get: (id) => simulateRequest('products.get', (db) => findProduct(db, id)),
    create: (input) =>
      simulateRequest('products.create', (db) => {
        requireAdmin(db)
        validateProductInput(input)
        const product: Product = { ...input, id: generateId(db, 'p') }
        db.products.push(product)
        return product
      }),
    update: (id, input) =>
      simulateRequest('products.update', (db) => {
        requireAdmin(db)
        validateProductInput(input)
        const product = findProduct(db, id)
        Object.assign(product, input)
        return product
      }),
    remove: (id) =>
      simulateRequest('products.remove', (db) => {
        requireAdmin(db)
        findProduct(db, id)
        db.products = db.products.filter((p) => p.id !== id)
      }),
  },

  cart: {
    get: () => simulateRequest('cart.get', (db) => buildCart(db, requireUser(db).id)),
    addItem: (productId, quantity) =>
      simulateRequest('cart.addItem', (db) => {
        const user = requireUser(db)
        const product = findProduct(db, productId)
        if (!product.active) throw new ApiError('This product is no longer available.', 409)
        const cart = getMockCart(db, user.id)
        const existing = cart.items.find((i) => i.productId === productId)
        const nextQuantity = (existing?.quantity ?? 0) + quantity
        assertValidQuantity(nextQuantity, product)
        if (existing) existing.quantity = nextQuantity
        else cart.items.push({ productId, quantity })
        return buildCart(db, user.id)
      }),
    updateItem: (productId, quantity) =>
      simulateRequest('cart.updateItem', (db) => {
        const user = requireUser(db)
        const cart = getMockCart(db, user.id)
        const item = cart.items.find((i) => i.productId === productId)
        if (!item) throw new ApiError('Item is not in your cart.', 404)
        assertValidQuantity(quantity, findProduct(db, productId))
        item.quantity = quantity
        return buildCart(db, user.id)
      }),
    removeItem: (productId) =>
      simulateRequest('cart.removeItem', (db) => {
        const user = requireUser(db)
        const cart = getMockCart(db, user.id)
        cart.items = cart.items.filter((i) => i.productId !== productId)
        return buildCart(db, user.id)
      }),
    clear: () =>
      simulateRequest('cart.clear', (db) => {
        const user = requireUser(db)
        db.carts[user.id] = { items: [], couponCode: null }
        return buildCart(db, user.id)
      }),
    applyCoupon: (code) =>
      simulateRequest('cart.applyCoupon', (db) => {
        const user = requireUser(db)
        if (!code.trim()) throw new ApiError('Enter a coupon code.', 400)
        const cart = buildCart(db, user.id)
        if (cart.items.length === 0) throw new ApiError('Add items before applying a coupon.', 400)
        const coupon = findCouponByCode(db, code)
        const error = getCouponError(coupon, cart.totals.subtotalCents)
        if (error || !coupon) throw new ApiError(error ?? 'Invalid coupon.', 400)
        getMockCart(db, user.id).couponCode = coupon.code
        return buildCart(db, user.id)
      }),
    removeCoupon: () =>
      simulateRequest('cart.removeCoupon', (db) => {
        const user = requireUser(db)
        getMockCart(db, user.id).couponCode = null
        return buildCart(db, user.id)
      }),
  },

  orders: {
    list: () =>
      simulateRequest('orders.list', (db) => {
        const user = requireUser(db)
        return db.orders
          .filter((o) => o.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }),
    get: (id) =>
      simulateRequest('orders.get', (db) => {
        const user = requireUser(db)
        const order = db.orders.find((o) => o.id === id)
        if (!order || (order.userId !== user.id && user.role !== 'admin')) {
          throw new ApiError('Order not found.', 404)
        }
        return order
      }),
    checkout: ({ shippingAddress, paymentMethod }) =>
      simulateRequest('orders.checkout', (db) => {
        const user = requireUser(db)
        const cart = buildCart(db, user.id)
        if (cart.items.length === 0) throw new ApiError('Your cart is empty.', 400)
        for (const item of cart.items) {
          assertValidQuantity(item.quantity, findProduct(db, item.productId))
        }
        for (const item of cart.items) {
          findProduct(db, item.productId).stock -= item.quantity
        }
        const order = {
          id: `ORD-${db.nextOrderNumber++}`,
          userId: user.id,
          createdAt: new Date().toISOString(),
          status: 'pending' as const,
          items: cart.items.map(({ productId, name, priceCents, quantity }) => ({
            productId,
            name,
            priceCents,
            quantity,
          })),
          couponCode: cart.couponCode,
          totals: cart.totals,
          shippingAddress,
          paymentMethod,
        }
        db.orders.push(order)
        db.carts[user.id] = { items: [], couponCode: null }
        return order
      }),
    cancel: (id) =>
      simulateRequest('orders.cancel', (db) => {
        const user = requireUser(db)
        const order = db.orders.find((o) => o.id === id && o.userId === user.id)
        if (!order) throw new ApiError('Order not found.', 404)
        if (order.status !== 'pending' && order.status !== 'processing') {
          throw new ApiError(`A ${order.status} order cannot be cancelled.`, 409)
        }
        order.status = 'cancelled'
        for (const item of order.items) {
          const product = db.products.find((p) => p.id === item.productId)
          if (product) product.stock += item.quantity
        }
        return order
      }),
  },

  coupons: {
    list: () =>
      simulateRequest('coupons.list', (db) => {
        requireAdmin(db)
        return db.coupons
      }),
    create: (input) =>
      simulateRequest('coupons.create', (db) => {
        requireAdmin(db)
        validateCouponInput(db, input)
        const coupon: Coupon = { ...input, id: generateId(db, 'c') }
        db.coupons.push(coupon)
        return coupon
      }),
    update: (id, input) =>
      simulateRequest('coupons.update', (db) => {
        requireAdmin(db)
        validateCouponInput(db, input, id)
        const coupon = db.coupons.find((c) => c.id === id)
        if (!coupon) throw new ApiError('Coupon not found.', 404)
        Object.assign(coupon, input)
        return coupon
      }),
    remove: (id) =>
      simulateRequest('coupons.remove', (db) => {
        requireAdmin(db)
        db.coupons = db.coupons.filter((c) => c.id !== id)
      }),
  },
}
