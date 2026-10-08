'use client'

import { useCallback } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useAuth } from '@/components/auth-provider'
import { api } from '@/lib/api'
import { isOrdersKey, isProductsKey, swrKeys } from '@/lib/hooks/keys'
import type { Cart } from '@/lib/types'

export function useProducts({ includeInactive = false } = {}) {
  return useSWR(swrKeys.products(includeInactive), () => api.products.list({ includeInactive }))
}

export function useCart() {
  const { user } = useAuth()
  return useSWR(user ? swrKeys.cart : null, () => api.cart.get())
}

export function useOrders() {
  const { user } = useAuth()
  return useSWR(user ? swrKeys.orders : null, () => api.orders.list())
}

export function useOrder(id: string) {
  const { user } = useAuth()
  return useSWR(user ? swrKeys.order(id) : null, () => api.orders.get(id))
}

export function useCoupons() {
  const { user } = useAuth()
  return useSWR(user?.role === 'admin' ? swrKeys.coupons : null, () => api.coupons.list())
}

/** Runs a cart mutation and writes the returned cart straight into the cache. */
export function useCartMutation() {
  const { mutate } = useSWRConfig()
  return useCallback(
    async (operation: () => Promise<Cart>) => {
      const cart = await operation()
      await mutate(swrKeys.cart, cart, { revalidate: false })
      return cart
    },
    [mutate],
  )
}

export function useRevalidate() {
  const { mutate } = useSWRConfig()
  return {
    products: useCallback(() => mutate(isProductsKey), [mutate]),
    orders: useCallback(() => mutate(isOrdersKey), [mutate]),
    cart: useCallback(() => mutate(swrKeys.cart), [mutate]),
    coupons: useCallback(() => mutate(swrKeys.coupons), [mutate]),
  }
}
