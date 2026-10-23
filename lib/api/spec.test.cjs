// Run: node --test lib/api/spec.test.cjs
// Compile TypeScript in memory without adding a test-runner dependency.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) request = path.join(root, request.slice(2))
  return resolve.call(this, request, ...args)
}
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, filename)
}
process.env.NEXT_PUBLIC_MOCK_DELAY_MS = '0'
process.env.NEXT_PUBLIC_TEST_MODE = 'true'
const { mockServices: api, mockPaymentCallbacks: payment } = require('./mock/services.ts')
const { resetMockDb, loadDb, saveDb } = require('./mock/store.ts')
const { createSeedDb } = require('./mock/seed.ts')

// Section 7 reference data is independent of the user-selected production catalog.
function createSrsReferenceDb() {
  const db = createSeedDb()
  db.products = [
    { id: 'P1', name: 'Coffee Beans 250g', priceCents: 450, weightGram: 300, stock: 20 },
    { id: 'P2', name: 'Drip Kettle', priceCents: 1200, weightGram: 900, stock: 3 },
    { id: 'P3', name: 'Espresso Machine', priceCents: 15000, weightGram: 8000, stock: 5 },
  ].map(p => ({ ...p, active: true, description: '', category: 'Coffee', imageUrl: '' }))
  return db
}

function resetSrsReferenceDb() {
  resetMockDb()
  saveDb(createSrsReferenceDb())
}
const { restServices, restPaymentCallbacks } = require('./rest/services.ts')
const customer = { username: 'cus_normal', password: 'password123' }
const admin = { username: 'admin01', password: 'admin123' }
const shipping = { zone: 'remote', speed: 'express' }
const rejectsStatus = (operation, status) => assert.rejects(operation, e => e.status === status)

test('mock lifecycle, reservation, snapshot, ownership and business errors', async () => {
  resetSrsReferenceDb()
  await rejectsStatus(() => api.products.list(), 401)
  const user = await api.auth.login(customer)
  assert.equal(typeof user.memberTier, 'string')
  await rejectsStatus(() => api.cart.addItem('missing', 1), 404)
  await rejectsStatus(() => api.cart.addItem('P1', 0), 400)
  await rejectsStatus(() => api.cart.removeItem('P1'), 400)
  await rejectsStatus(() => api.cart.applyCoupon('missing'), 404)
  await api.cart.addItem('P1', 2)
  const initialStock = loadDb().products[0].stock
  const first = await api.orders.checkout(shipping)
  assert.equal(first.zone, 'remote')
  assert.equal(first.speed, 'express')
  assert.equal((await api.cart.get()).stage, 'checkout')
  assert.equal((await api.cart.get()).items.length, 1)
  assert.equal(loadDb().products[0].stock, initialStock - 2)
  await rejectsStatus(() => api.cart.addItem('P1', 1), 400)
  await rejectsStatus(() => api.orders.checkout(shipping), 400)
  const beforeFail = structuredClone(loadDb())
  await payment.fail(first.id)
  assert.deepEqual(loadDb(), beforeFail)
  const restored = await api.orders.cancel()
  assert.equal(restored.stage, 'cart')
  assert.equal(restored.items[0].quantity, 2)
  assert.equal(loadDb().products[0].stock, initialStock)
  await rejectsStatus(() => api.orders.cancel(), 400)
  await rejectsStatus(() => payment.success(first.id), 400)
  const second = await api.orders.checkout(shipping)
  await api.auth.login(admin)
  await rejectsStatus(() => api.cart.get(), 403)
  await rejectsStatus(() => api.orders.get(second.id), 403)
  await api.products.update('P1', { priceCents: 123 })
  await api.products.setStatus('P1', 'ปิดขาย')
  assert.equal((await api.products.list()).length, 3)
  await api.auth.login(customer)
  assert.equal((await api.products.list()).length, 2)
  assert.equal((await api.cart.get()).items[0].available, false)
  assert.equal((await api.orders.get(second.id)).items[0].priceCents, 450)
  const other = { ...loadDb().users[0], id: 'other', username: 'other' }
  loadDb().users.push(other)
  await api.auth.login({ username: 'other', password: customer.password })
  await rejectsStatus(() => api.orders.get(second.id), 404)
  await payment.success(second.id) // Gateway callbacks do not require customer session.
  const stockAfterPaid = loadDb().products[0].stock
  await payment.success(second.id)
  assert.equal(loadDb().products[0].stock, stockAfterPaid)
  await api.auth.login(customer)
  assert.equal((await api.orders.get(second.id)).status, 'paid')
  const cleared = await api.cart.get()
  assert.equal(cleared.stage, 'success')
  assert.equal(cleared.items.length, 0)
  assert.equal(cleared.couponCode, null)
  await rejectsStatus(() => api.cart.addItem('P2', 1), 400)
  assert.equal((await api.orders.continueShopping()).stage, 'cart')
  assert.equal((await api.orders.list())[0].id, second.id)
})

test('REST uses documented paths, verbs and bodies without monetary conversion', async () => {
  const requests = []
  const p = { productId: 'p/1', name: 'Product', price: 123, weightGram: 300, stock: 5, status: 'เปิดขาย' }
  const c = { code: 'SAVE10', percent: 10, minSpend: 100, status: 'เปิดใช้' }
  const cart = { stage: 'ตะกร้า', items: [{ productId: 'p/1', name: 'Product', price: 123, weightGram: 300, quantity: 1, available: true }], count: 1, total: 123, couponCode: null }
  const order = { orderId: 'o/1', status: 'รอชำระเงิน', items: cart.items, subtotal: 123, discount: 0, shippingFee: 10, netTotal: 133, ...shipping, couponCode: null }
  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    requests.push({ url, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : undefined })
    let result = cart
    if (url === '/auth/login') result = { token: 'test', role: 'Customer', memberTier: 'prime' }
    else if (url === '/products') result = [p]
    else if (url.startsWith('/admin/products')) result = p
    else if (url === '/admin/coupons') result = [c]
    else if (url.startsWith('/admin/coupons/')) result = c
    else if (url === '/orders') result = [order]
    else if (url.startsWith('/orders/') || url === '/checkout') result = order
    else if (url === '/checkout/cancel') result = { order, cart }
    else if (url === '/payments/o%2F1/success') result = { orderId: 'o/1', status: 'paid' }
    else if (url === '/payments/o%2F1/fail') result = { message: 'การชำระเงินล้มเหลว กรุณาลองใหม่' }
    return new Response(JSON.stringify(result), { status: 200 })
  }
  try {
    assert.equal((await restServices.auth.login(customer)).memberTier, 'prime')
    assert.equal((await restServices.products.list())[0].priceCents, 123)
    await restServices.products.update('p/1', { priceCents: 456, stock: 7 })
    await restServices.products.setStatus('p/1', 'ปิดขาย')
    await restServices.cart.addItem('p/1', 2)
    await restServices.cart.updateItem('p/1', 3)
    await restServices.cart.removeItem('p/1')
    await restServices.cart.applyCoupon('SAVE10')
    await restServices.cart.get()
    assert.equal((await restServices.orders.checkout(shipping)).totals.totalCents, 133)
    await restServices.orders.cancel()
    await restServices.orders.continueShopping()
    await restServices.orders.list()
    await restServices.orders.get('o/1')
    await restServices.coupons.list()
    await restServices.coupons.setStatus('SAVE/10', 'ปิดใช้')
    assert.deepEqual(await restPaymentCallbacks.success('o/1'), { orderId: 'o/1', status: 'paid' })
    assert.deepEqual(await restPaymentCallbacks.fail('o/1'), { message: 'การชำระเงินล้มเหลว กรุณาลองใหม่' })
    assert.equal('payments' in restServices, false)
    assert.equal('payments' in api, false)
    const count = requests.length
    await restServices.auth.logout()
    await restServices.auth.getCurrentUser()
    assert.equal(requests.length, count)
    assert.deepEqual(requests, [
      { url: '/auth/login', method: 'POST', body: customer },
      { url: '/products', method: 'GET', body: undefined },
      { url: '/admin/products/p%2F1', method: 'PATCH', body: { price: 456, stock: 7 } },
      { url: '/admin/products/p%2F1/status', method: 'PATCH', body: { status: 'ปิดขาย' } },
      { url: '/cart/items', method: 'POST', body: { productId: 'p/1', quantity: 2 } },
      { url: '/cart/items/p%2F1', method: 'PATCH', body: { quantity: 3 } },
      { url: '/cart/items/p%2F1', method: 'DELETE', body: undefined },
      { url: '/cart/coupon', method: 'PUT', body: { code: 'SAVE10' } },
      { url: '/cart', method: 'GET', body: undefined },
      { url: '/checkout', method: 'POST', body: shipping },
      { url: '/checkout/cancel', method: 'POST', body: undefined },
      { url: '/checkout/continue-shopping', method: 'POST', body: undefined },
      { url: '/cart', method: 'GET', body: undefined },
      { url: '/orders', method: 'GET', body: undefined },
      { url: '/orders/o%2F1', method: 'GET', body: undefined },
      { url: '/admin/coupons', method: 'GET', body: undefined },
      { url: '/admin/coupons/SAVE%2F10/status', method: 'PATCH', body: { status: 'ปิดใช้' } },
      { url: '/payments/o%2F1/success', method: 'POST', body: undefined },
      { url: '/payments/o%2F1/fail', method: 'POST', body: undefined },
    ])
  } finally { global.fetch = originalFetch }
})

test('mock cart editing, coupon status, optional product fields and rejected updates', async () => {
  resetSrsReferenceDb()
  await rejectsStatus(() => api.auth.login({ ...customer, password: 'wrong' }), 401)
  await api.auth.login(customer)
  await api.cart.addItem('P3', 2)
  assert.equal((await api.cart.updateItem('P3', 3)).items[0].quantity, 3)
  await rejectsStatus(() => api.cart.updateItem('P2', 1), 400)
  await rejectsStatus(() => api.cart.updateItem('P3', 1000), 400)
  assert.equal((await api.cart.applyCoupon('SAVE10')).couponCode, 'SAVE10')
  assert.equal((await api.cart.removeItem('P3')).count, 0)
  await rejectsStatus(() => api.orders.checkout(shipping), 400)
  await api.auth.login(admin)
  assert.ok((await api.coupons.list()).length > 0)
  assert.equal((await api.coupons.setStatus('SAVE10', 'ปิดใช้')).active, false)
  await rejectsStatus(() => api.coupons.setStatus('missing', 'เปิดใช้'), 404)
  await rejectsStatus(() => api.coupons.setStatus('SAVE10', 'invalid'), 400)
  const before = structuredClone(loadDb().products[0])
  const priced = await api.products.update('P1', { priceCents: 500 })
  assert.equal(priced.priceCents, 500)
  assert.equal(priced.stock, before.stock)
  const stocked = await api.products.update('P1', { stock: 9 })
  assert.equal(stocked.priceCents, 500)
  assert.equal(stocked.stock, 9)
  const dbBeforeInvalid = structuredClone(loadDb())
  await rejectsStatus(() => api.products.update('P1', { priceCents: 1, stock: -1 }), 400)
  assert.deepEqual(loadDb(), dbBeforeInvalid)
  await rejectsStatus(() => api.products.update('missing', { stock: 1 }), 404)
  await rejectsStatus(() => api.products.setStatus('P1', 'invalid'), 400)
  await api.auth.login(customer)
  await api.cart.addItem('P3', 1)
  await rejectsStatus(() => api.cart.applyCoupon('SAVE10'), 400)
  await rejectsStatus(() => api.products.update('P1', { stock: 1 }), 403)
  await rejectsStatus(() => api.coupons.list(), 403)
  await rejectsStatus(() => payment.success('missing'), 404)
  await rejectsStatus(() => payment.fail('missing'), 404)
  await rejectsStatus(() => api.orders.continueShopping(), 400)
  await api.auth.logout()
  assert.equal(await api.auth.getCurrentUser(), null)
})

test('REST gateway preserves HTTP errors and sends no callback request body', async () => {
  const originalFetch = global.fetch
  try {
    for (const status of [400, 401, 403, 404]) {
      global.fetch = async (url, options) => {
        assert.match(url, /^\/payments\/missing\/(success|fail)$/)
        assert.equal(options.method, 'POST')
        assert.equal(options.body, undefined)
        assert.equal(options.headers['Content-Type'], undefined)
        return new Response(JSON.stringify({ message: 'Gateway rejected callback.' }), { status })
      }
      for (const callback of [restPaymentCallbacks.success, restPaymentCallbacks.fail]) {
        await assert.rejects(() => callback('missing'), e => e.status === status && e.message === 'Gateway rejected callback.')
      }
    }
  } finally { global.fetch = originalFetch }
})

const pricing = require('../pricing.ts')
const prime = { username: 'cus_prime', password: 'password123' }
const city = { zone: 'inCity', speed: 'standard' }
const rejectsCode = (fn, code, extra = () => true) => assert.rejects(fn, e => e.code === code && extra(e))

for (const [name, account, items, code, address, expected] of [
  ['AC prime coupon replaces membership', prime, [['P1', 1], ['P2', 1]], 'SAVE10', city, [165, 0, 1485]],
  ['AC prime fallback floors 5 percent', prime, [['P1', 1], ['P2', 1]], null, city, [82, 0, 1568]],
  ['AC prime below-min coupon removed with notice', prime, [['P1', 2]], 'SAVE10', { zone: 'upcountry', speed: 'express' }, [45, 25, 880]],
  ['AC normal heavy remote express', customer, [['P3', 1]], null, shipping, [0, 270, 15270]],
]) test(name, async () => {
  resetSrsReferenceDb(); await api.auth.login(account)
  for (const [id, qty] of items) await api.cart.addItem(id, qty)
  if (code) await api.cart.applyCoupon(code)
  const order = await api.orders.checkout(address)
  assert.deepEqual([order.totals.discountCents, order.totals.shippingCents, order.totals.totalCents], expected)
  assert.equal(order.totals.taxCents, 0)
  assert.equal(order.notices.length, name.includes('removed') ? 1 : 0)
  if (name.includes('removed')) assert.equal(order.notices[0].code, 'COUPON_NOT_APPLICABLE')
  assert.equal(order.couponCode, name.includes('removed') ? null : code)
  const cancelled = await api.orders.cancel()
  assert.equal(cancelled.couponCode, order.couponCode)
})

test('AC disabled coupon evaluated only on successful checkout', async () => {
  resetSrsReferenceDb(); await api.auth.login(customer)
  await api.cart.addItem('P2', 1); await api.cart.applyCoupon('SAVE10')
  await api.auth.login(admin); await api.coupons.setStatus('SAVE10', 'ปิดใช้')
  await api.auth.login(customer)
  assert.equal((await api.cart.get()).couponCode, 'SAVE10')
  const before = structuredClone(loadDb())
  await rejectsCode(() => api.orders.checkout({ zone: 'invalid', speed: 'standard' }), 'VALIDATION_ERROR')
  assert.deepEqual(loadDb(), before)
  const order = await api.orders.checkout(city)
  assert.deepEqual([order.totals.discountCents, order.totals.shippingCents, order.totals.totalCents], [0, 30, 1230])
  assert.equal(order.couponCode, null); assert.equal(order.notices.length, 1)
  assert.equal(order.notices[0].code, 'COUPON_NOT_APPLICABLE')
})

test('AC weight rejection and ALL unavailable ids are transactional', async () => {
  resetSrsReferenceDb(); await api.auth.login(customer)
  await api.cart.addItem('P3', 3); await api.cart.applyCoupon('SAVE10')
  let before = structuredClone(loadDb())
  await rejectsCode(() => api.orders.checkout(city), 'WEIGHT_LIMIT_EXCEEDED')
  assert.deepEqual(loadDb(), before)
  await api.cart.addItem('P1', 1)
  await api.auth.login(admin); await api.products.setStatus('P1', 'ปิดขาย'); await api.products.setStatus('P3', 'ปิดขาย')
  await api.auth.login(customer); before = structuredClone(loadDb())
  await rejectsCode(() => api.orders.checkout(city), 'ITEMS_UNAVAILABLE', e => { assert.deepEqual(e.productIds, ['P3', 'P1']); return true })
  assert.deepEqual(loadDb(), before)
})

test('AC closed P1 and reservation conflict across accounts; cancellation restores stock', async () => {
  resetSrsReferenceDb(); await api.auth.login(customer); await api.cart.addItem('P1', 1)
  await api.auth.login(admin); await api.products.setStatus('P1', 'ปิดขาย')
  await api.auth.login(customer)
  await rejectsCode(() => api.orders.checkout(city), 'ITEMS_UNAVAILABLE', e => { assert.deepEqual(e.productIds, ['P1']); return true })
  resetSrsReferenceDb(); await api.auth.login(prime); await api.cart.addItem('P2', 1)
  await api.auth.login(customer); await api.cart.addItem('P2', 3)
  const reserved = await api.orders.checkout(city)
  assert.equal(loadDb().products[1].stock, 0)
  await api.auth.login(prime)
  await rejectsCode(() => api.cart.addItem('P2', 1), 'PRODUCT_UNAVAILABLE')
  const before = structuredClone(loadDb())
  await rejectsCode(() => api.orders.checkout(city), 'ITEMS_UNAVAILABLE')
  assert.deepEqual(loadDb(), before)
  await api.auth.login(customer); await api.orders.cancel()
  assert.equal(loadDb().products[1].stock, 3)
  assert.equal((await api.orders.get(reserved.id)).status, 'cancelled')
  await api.auth.login(prime); await api.orders.checkout(city)
})

test('AC admin invalid fields together, bounds, snapshot and role isolation', async () => {
  resetSrsReferenceDb(); await api.auth.login(customer); await api.cart.addItem('P1', 1)
  const order = await api.orders.checkout(city)
  await rejectsCode(() => api.products.update('P1', { stock: 1 }), 'AUTH_FORBIDDEN')
  await api.auth.login(admin)
  const before = structuredClone(loadDb())
  await rejectsCode(() => api.products.update('P1', { priceCents: 0, stock: 10000 }), 'VALIDATION_ERROR', e => { assert.deepEqual(e.fields, ['price', 'stock']); return true })
  assert.deepEqual(loadDb(), before)
  await api.products.update('P1', { priceCents: 50000, stock: 9999 })
  await api.auth.login(prime)
  await rejectsCode(() => api.orders.get(order.id), 'ORDER_NOT_FOUND', e => e.status === 404)
  await api.auth.login(customer)
  assert.equal((await api.orders.get(order.id)).items[0].priceCents, 450)
  await rejectsCode(() => api.cart.addItem('P1', 1), 'OPERATION_NOT_ALLOWED')
  const pending = structuredClone(loadDb()); await payment.fail(order.id); assert.deepEqual(loadDb(), pending)
  await api.auth.logout(); await payment.success(order.id); await api.auth.login(customer)
  const cart = await api.cart.get()
  assert.equal(cart.stage, 'success'); assert.equal(cart.currentOrderId, order.id)
  assert.deepEqual(cart.items, []); assert.equal(cart.couponCode, null)
  assert.equal((await api.orders.get(order.id)).status, 'paid')
  assert.equal((await api.orders.continueShopping()).stage, 'cart')
})

test('AC coupon case sensitivity, empty attach, inactive replacement and Thai empty errors', async () => {
  resetSrsReferenceDb(); await api.auth.login(customer)
  await rejectsCode(() => api.cart.removeItem('P1'), 'CART_EMPTY', e => e.message === 'ไม่มีสินค้าให้ลบ')
  await rejectsCode(() => api.orders.checkout(city), 'CART_EMPTY', e => e.message === 'ไม่สามารถชำระเงินได้ ตะกร้าว่าง')
  await rejectsCode(() => api.cart.applyCoupon('save10'), 'COUPON_NOT_FOUND')
  assert.equal((await api.cart.applyCoupon('SAVE10')).couponCode, 'SAVE10')
  await api.cart.addItem('P1', 1)
  await rejectsCode(() => api.cart.removeItem('P2'), 'ITEM_NOT_IN_CART', e => e.message === 'ไม่พบสินค้าในตะกร้า')
  await api.auth.login(admin); await api.coupons.setStatus('SAVE10', 'ปิดใช้')
  assert.equal((await api.coupons.list()).length, 1)
  await api.auth.login(customer); const before = structuredClone(loadDb())
  await rejectsCode(() => api.cart.applyCoupon('SAVE10'), 'COUPON_INVALID')
  assert.deepEqual(loadDb(), before)
})

test('DC1 quantity precedence and boundaries', () => {
  const base = { operation: 'add', quantity: 1, productExists: true, inCart: true, available: true, currentQtyInCart: 0, availableStock: 20 }
  const check = (changes, expected) => assert.equal(pricing.validateQuantityChange({ ...base, ...changes }), expected)
  for (const quantity of ['1', null, undefined, NaN, Infinity, 1.5, true]) check({ quantity, productExists: false }, 'VALIDATION_ERROR')
  for (const quantity of [0, -1, 11]) check({ quantity, productExists: false }, 'QTY_OUT_OF_RANGE')
  check({ productExists: false, available: false }, 'PRODUCT_NOT_FOUND')
  check({ operation: 'update', inCart: false, available: false }, 'ITEM_NOT_IN_CART')
  check({ available: false, currentQtyInCart: 10, availableStock: 0 }, 'PRODUCT_UNAVAILABLE')
  check({ currentQtyInCart: 10, availableStock: 0 }, 'QTY_OUT_OF_RANGE')
  check({ quantity: 10, availableStock: 9 }, 'INSUFFICIENT_STOCK')
  check({ quantity: 10, availableStock: 10 }, 'OK')
  check({ quantity: 1, currentQtyInCart: 9, availableStock: 10 }, 'OK')
  check({ operation: 'update', quantity: 10, currentQtyInCart: 10 }, 'OK')
})

test('DC1 pricing, all shipping matrix cells, weight and product boundaries', () => {
  assert.equal(pricing.isProductAvailable(true, 1), true)
  assert.equal(pricing.isProductAvailable(true, 0), false)
  assert.equal(pricing.isProductAvailable(false, 20), false)
  assert.equal(pricing.calculateSubtotal([]), 0)
  assert.equal(pricing.calculateSubtotal([{ price: 450, quantity: 2 }]), 900)
  assert.equal(pricing.calculateTotalWeight([{ weightGram: 300, quantity: 2 }]), 600)
  for (const [weight, tier] of [[0, 'light'], [1000, 'light'], [1001, 'medium'], [5000, 'medium'], [5001, 'heavy'], [20000, 'heavy'], [20001, 'overLimit']]) assert.equal(pricing.classifyWeight(weight), tier)
  for (const [tier, fees] of Object.entries({ light: [30, 50, 80], medium: [50, 80, 120], heavy: [80, 120, 180] })) {
    for (const [index, zone] of ['inCity', 'upcountry', 'remote'].entries()) {
      assert.equal(pricing.calculateShippingFee(tier, zone, 'standard', 'normal'), fees[index])
      assert.equal(pricing.calculateShippingFee(tier, zone, 'express', 'normal'), Math.floor(fees[index] * 1.5))
      assert.equal(pricing.calculateShippingFee(tier, zone, 'standard', 'prime'), 0)
      assert.equal(pricing.calculateShippingFee(tier, zone, 'express', 'prime'), Math.floor(fees[index] * .5))
    }
  }
  const c = { percent: 10, minSpend: 1000, active: true }
  assert.deepEqual(pricing.calculateDiscount(999, 'prime', c), { discount: 49, source: 'member', couponRemoved: true })
  assert.deepEqual(pricing.calculateDiscount(1000, 'prime', c), { discount: 100, source: 'coupon', couponRemoved: false })
  assert.deepEqual(pricing.calculateDiscount(1000, 'normal', { ...c, active: false }), { discount: 0, source: 'none', couponRemoved: true })
  assert.equal(pricing.calculateNetTotal(900, 45, 25), 880)
  assert.deepEqual(pricing.validateProductUpdate({}), ['price', 'stock'])
  for (const price of [1, 50000]) assert.deepEqual(pricing.validateProductUpdate({ price }), [])
  for (const price of [0, 50001, 1.5, '1', NaN, null]) assert.deepEqual(pricing.validateProductUpdate({ price }), ['price'])
  for (const stock of [0, 9999]) assert.deepEqual(pricing.validateProductUpdate({ stock }), [])
  for (const stock of [-1, 10000, 1.5, '1', NaN, null]) assert.deepEqual(pricing.validateProductUpdate({ stock }), ['stock'])
  assert.deepEqual(pricing.validateProductUpdate({ price: 0, stock: 10000 }), ['price', 'stock'])
})

test('DC1 checkout precedence and exact weight ceiling', () => {
  const line = { productId: 'P1', available: true, availableStock: 3, quantity: 1 }
  assert.deepEqual(pricing.validateCheckout({ zone: 'city', speed: 'standard', lines: [], totalWeightGram: 20001 }), { result: 'VALIDATION_ERROR' })
  assert.deepEqual(pricing.validateCheckout({ zone: 'inCity', speed: 'invalid', lines: [], totalWeightGram: 0 }), { result: 'VALIDATION_ERROR' })
  assert.deepEqual(pricing.validateCheckout({ ...city, lines: [], totalWeightGram: 20001 }), { result: 'CART_EMPTY' })
  assert.deepEqual(pricing.validateCheckout({ ...city, lines: [line], totalWeightGram: 20000 }), { result: 'OK' })
  assert.deepEqual(pricing.validateCheckout({ ...city, lines: [line], totalWeightGram: 20001 }), { result: 'WEIGHT_LIMIT_EXCEEDED' })
  assert.deepEqual(pricing.validateCheckout({ ...city, lines: [{ ...line, available: false }, { ...line, productId: 'P2', availableStock: 0 }], totalWeightGram: 20001 }), { result: 'ITEMS_UNAVAILABLE', productIds: ['P1', 'P2'] })
})

test('REST preserves domain metadata, Thai lifecycle, notices and weight', async () => {
  const originalFetch = global.fetch
  try {
    global.fetch = async () => new Response(JSON.stringify({ code: 'ITEMS_UNAVAILABLE', message: 'Unavailable', productIds: ['P1'], fields: ['price', 'stock'] }), { status: 400 })
    await rejectsCode(() => restServices.orders.checkout(city), 'ITEMS_UNAVAILABLE', e => { assert.deepEqual(e.productIds, ['P1']); assert.deepEqual(e.fields, ['price', 'stock']); return true })
    global.fetch = async () => new Response(JSON.stringify({ stage: 'สำเร็จ', count: 0, total: 0, items: [], currentOrderId: 'O1', notices: [{ code: 'COUPON_NOT_APPLICABLE', message: 'removed' }] }))
    const cart = await restServices.cart.get(); assert.equal(cart.stage, 'success'); assert.equal(cart.currentOrderId, 'O1'); assert.equal(cart.notices.length, 1); assert.equal(cart.notices[0].code, 'COUPON_NOT_APPLICABLE')
    for (const [wire, internal] of [['รอชำระเงิน', 'pending'], ['ชำระเงินแล้ว', 'paid'], ['ยกเลิก', 'cancelled']]) {
      global.fetch = async () => new Response(JSON.stringify({ orderId: 'O1', status: wire, items: [{ productId: 'P1', name: 'Coffee', price: 450, quantity: 2, weightGram: 300 }], subtotal: 900, discount: 45, shippingFee: 25, netTotal: 880, zone: 'upcountry', speed: 'express', couponCode: null }))
      const order = await restServices.orders.get('O1'); assert.equal(order.status, internal); assert.equal(order.totalWeightGram, 600); assert.equal(order.items[0].priceCents, 450)
    }
  } finally { global.fetch = originalFetch }
})

test('catalog storage version leaves old persisted data untouched', () => {
  const oldKey = 'mock-api-db-srs-002-v1.8'
  const newKey = 'mock-api-db-srs-002-v1.8-original-catalog-v1'
  const oldData = JSON.stringify(createSrsReferenceDb())
  const storage = new Map([[oldKey, oldData]])
  const originalWindow = global.window
  global.window = { sessionStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } }
  try {
    resetMockDb()
    assert.equal(loadDb().products[0].id, 'p-1')
    assert.deepEqual(loadDb().carts, {})
    assert.deepEqual(loadDb().orders, [])
    assert.equal(loadDb().sessionUserId, null)
    saveDb(loadDb())
    assert.equal(JSON.parse(storage.get(newKey)).products.length, 8)
    resetMockDb()
    assert.equal(storage.has(newKey), false)
    assert.equal(storage.get(oldKey), oldData)
  } finally {
    if (originalWindow === undefined) delete global.window
    else global.window = originalWindow
    resetMockDb()
  }
})

test('test helpers denied unless NEXT_PUBLIC_TEST_MODE is explicitly true', () => {
  const { spawnSync } = require('node:child_process')
  const bootstrap = `const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');const resolve=Module._resolveFilename;Module._resolveFilename=function(r,...a){return resolve.call(this,r.startsWith('@/')?path.resolve(r.slice(2)):r,...a)};require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);const a=require('./lib/api/index.ts');require('node:assert/strict').throws(()=>a.getTestApi(),/NEXT_PUBLIC_TEST_MODE/);require('node:assert/strict').throws(()=>require('./lib/api/mock/store.ts').resetMockDb(),/NEXT_PUBLIC_TEST_MODE/);require('node:assert/strict').throws(()=>require('./lib/api/mock/services.ts').mockPaymentCallbacks.success('O1'),/NEXT_PUBLIC_TEST_MODE/);`
  for (const value of ['', 'false', '1']) {
    const child = spawnSync(process.execPath, ['-e', bootstrap], { cwd: root, env: { ...process.env, NEXT_PUBLIC_TEST_MODE: value }, encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
  }
})

test('Original catalog, SRS accounts/coupon, auth domain codes and test helper interface', async () => {
  const { DEMO_ACCOUNTS } = require('./mock/seed.ts')
  const { getTestApi } = require('./index.ts')
  getTestApi().reset()
  assert.deepEqual(DEMO_ACCOUNTS.customer, { username: 'cus_normal', email: 'cus_normal', password: 'password123' })
  assert.equal(DEMO_ACCOUNTS.prime.username, 'cus_prime'); assert.equal(DEMO_ACCOUNTS.admin.username, 'admin01')
  assert.deepEqual(loadDb().orders, [])
  assert.deepEqual(loadDb().products.map(p => [p.id, p.name, p.priceCents, p.weightGram, p.stock, p.active]), [
    ['p-1', 'Wireless Headphones', 12999, 300, 15, true],
    ['p-2', 'Mechanical Keyboard', 8950, 900, 8, true],
    ['p-3', 'Ceramic Coffee Mug', 1499, 400, 40, true],
    ['p-4', 'Canvas Backpack', 5900, 700, 12, true],
    ['p-5', 'Minimal Desk Lamp', 3995, 1200, 0, true],
    ['p-6', 'Running Sneakers', 7499, 800, 20, true],
    ['p-7', 'Insulated Water Bottle', 2400, 450, 30, true],
    ['p-8', 'Cotton Hoodie', 4999, 600, 3, true],
  ])
  assert.deepEqual(loadDb().products.map(p => [p.description, p.category, p.imageUrl]), [
    ['Over-ear noise cancelling headphones with 30-hour battery life.', 'Electronics', '/products/headphones.png'],
    ['Compact 75% layout with hot-swappable tactile switches.', 'Electronics', '/products/keyboard.png'],
    ['Hand-glazed 350ml stoneware mug. Dishwasher safe.', 'Home', '/products/mug.png'],
    ['Water-resistant waxed canvas with a padded laptop sleeve.', 'Accessories', '/products/backpack.png'],
    ['Adjustable LED desk lamp with three color temperatures.', 'Home', '/products/lamp.png'],
    ['Lightweight breathable mesh with responsive foam cushioning.', 'Apparel', '/products/sneakers.png'],
    ['Keeps drinks cold for 24 hours or hot for 12. 750ml.', 'Accessories', '/products/bottle.png'],
    ['Heavyweight brushed-fleece hoodie in heather gray.', 'Apparel', '/products/hoodie.png'],
  ])
  assert.equal(loadDb().coupons.length, 1); assert.equal(loadDb().coupons[0].minSubtotalCents, 1000)
  await api.auth.login(customer)
  assert.deepEqual((await api.products.list()).map(p => p.id), ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8'])
  await rejectsCode(() => api.cart.addItem('p-5', 1), 'PRODUCT_UNAVAILABLE')
  await api.cart.addItem('p-1', 1)
  const catalogOrder = await api.orders.checkout(city)
  assert.equal(catalogOrder.totals.subtotalCents, 12999)
  assert.equal(catalogOrder.totalWeightGram, 300)
  assert.equal(catalogOrder.totals.taxCents, 0)
  await api.auth.login(admin)
  assert.equal((await api.products.list()).length, 8)
  resetSrsReferenceDb()
  await rejectsCode(() => api.cart.get(), 'AUTH_REQUIRED', e => e.status === 401)
  await rejectsCode(() => api.auth.login({ ...customer, password: 'wrong' }), 'AUTH_INVALID_CREDENTIALS', e => e.status === 401)
  await api.auth.login(customer)
  await rejectsCode(() => api.coupons.list(), 'AUTH_FORBIDDEN', e => e.status === 403)
  await rejectsCode(() => api.cart.addItem('missing', .5), 'VALIDATION_ERROR')
  await rejectsCode(() => api.cart.addItem('missing', 11), 'QTY_OUT_OF_RANGE')
  await rejectsCode(() => api.cart.addItem('missing', 1), 'PRODUCT_NOT_FOUND', e => e.status === 404)
  await api.cart.addItem('P1', 10)
  await rejectsCode(() => api.cart.addItem('P1', 1), 'QTY_OUT_OF_RANGE')
  await rejectsCode(() => api.cart.addItem('P2', 4), 'INSUFFICIENT_STOCK')
  const order = await api.orders.checkout(city)
  await getTestApi().payments.success(order.id)
  assert.equal((await api.orders.get(order.id)).status, 'paid')
})
