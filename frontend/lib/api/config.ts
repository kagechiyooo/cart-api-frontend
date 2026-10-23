export type ApiMode = 'mock' | 'api' | 'pay_succeed' | 'pay_failed'

export function resolveApiMode(value: string | undefined): ApiMode {
  if (value === 'rest') return 'api'
  if (value === 'api' || value === 'pay_succeed' || value === 'pay_failed') return value
  return 'mock'
}

export const apiConfig = {
  mode: resolveApiMode(process.env.NEXT_PUBLIC_API_MODE),
  testMode: process.env.NEXT_PUBLIC_TEST_MODE === 'true',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  mockDelayMs: Number(process.env.NEXT_PUBLIC_MOCK_DELAY_MS ?? 350),
} as const

export function assertTestMode(): void {
  if (!apiConfig.testMode) throw new Error('Test helpers require NEXT_PUBLIC_TEST_MODE=true.')
}

export function assertPaymentSimulation(action: 'success' | 'fail'): void {
  const allowed = action === 'success' ? 'pay_succeed' : 'pay_failed'
  if (apiConfig.mode !== allowed) assertTestMode()
}
