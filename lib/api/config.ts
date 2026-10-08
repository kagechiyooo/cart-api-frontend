export const apiConfig = {
  /** Set NEXT_PUBLIC_API_MODE=rest to switch from the mock adapter to the REST adapter. */
  mode: process.env.NEXT_PUBLIC_API_MODE === 'rest' ? 'rest' : 'mock',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  mockDelayMs: Number(process.env.NEXT_PUBLIC_MOCK_DELAY_MS ?? 350),
} as const
