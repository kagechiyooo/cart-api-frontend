import { ApiError } from '@/lib/api/errors'
import type { ApiServices } from '@/lib/api/types'

/**
 * REST adapter placeholder. Endpoint paths are intentionally not defined here:
 * replace each `notConnected(...)` with a call to `httpRequest` (see
 * `lib/api/http-client.ts`) using the existing API's documented endpoint.
 */
function notConnected(operation: string): never {
  throw new ApiError(
    `"${operation}" is not connected to the REST API yet. Map it in lib/api/rest/services.ts.`,
    501,
  )
}

export const restServices: ApiServices = {
  auth: {
    login: async () => notConnected('auth.login'),
    logout: async () => notConnected('auth.logout'),
    getCurrentUser: async () => notConnected('auth.getCurrentUser'),
  },
  products: {
    list: async () => notConnected('products.list'),
    get: async () => notConnected('products.get'),
    create: async () => notConnected('products.create'),
    update: async () => notConnected('products.update'),
    remove: async () => notConnected('products.remove'),
  },
  cart: {
    get: async () => notConnected('cart.get'),
    addItem: async () => notConnected('cart.addItem'),
    updateItem: async () => notConnected('cart.updateItem'),
    removeItem: async () => notConnected('cart.removeItem'),
    clear: async () => notConnected('cart.clear'),
    applyCoupon: async () => notConnected('cart.applyCoupon'),
    removeCoupon: async () => notConnected('cart.removeCoupon'),
  },
  orders: {
    list: async () => notConnected('orders.list'),
    get: async () => notConnected('orders.get'),
    checkout: async () => notConnected('orders.checkout'),
    cancel: async () => notConnected('orders.cancel'),
  },
  coupons: {
    list: async () => notConnected('coupons.list'),
    create: async () => notConnected('coupons.create'),
    update: async () => notConnected('coupons.update'),
    remove: async () => notConnected('coupons.remove'),
  },
}
