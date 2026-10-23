import { apiConfig } from '@/lib/api/config'
import { assertTestMode } from '@/lib/api/config'
import { resetMockDb } from '@/lib/api/mock/store'
import { mockServices, mockPaymentCallbacks } from '@/lib/api/mock/services'
import { restServices, restPaymentCallbacks } from '@/lib/api/rest/services'
import type { ApiServices } from '@/lib/api/types'

export const api: ApiServices = apiConfig.mode === 'mock' ? mockServices : restServices

/** Only available with explicit public test mode. Callbacks remain outside customer services. */
export function getTestApi() {
  assertTestMode()
  return { payments: apiConfig.mode === 'mock' ? mockPaymentCallbacks : restPaymentCallbacks,
    reset: () => { assertTestMode(); if (apiConfig.mode !== 'mock') throw new Error('REST reset is not a documented endpoint.'); resetMockDb() } }
}

export function payOrder(orderId: string) {
  if (apiConfig.mode === 'pay_succeed') return restPaymentCallbacks.success(orderId)
  if (apiConfig.mode === 'pay_failed') return restPaymentCallbacks.fail(orderId)
  throw new Error('Payment simulation requires pay_succeed or pay_failed mode.')
}

export { ApiError, getErrorMessage } from '@/lib/api/errors'
export type * from '@/lib/api/types'
