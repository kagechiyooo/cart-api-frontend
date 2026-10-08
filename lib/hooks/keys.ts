export const swrKeys = {
  currentUser: 'auth/current-user',
  products: (includeInactive: boolean) => ['products', includeInactive] as const,
  cart: 'cart',
  orders: 'orders',
  order: (id: string) => ['orders', id] as const,
  coupons: 'coupons',
}

/** Matches every products cache entry regardless of filters. */
export function isProductsKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'products'
}

/** Matches the order list and every single-order cache entry. */
export function isOrdersKey(key: unknown): boolean {
  return key === swrKeys.orders || (Array.isArray(key) && key[0] === 'orders')
}
