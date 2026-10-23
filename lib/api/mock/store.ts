import { apiConfig, assertTestMode } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'
import { createSeedDb, type MockDb } from '@/lib/api/mock/seed'

// Isolate the restored catalog from persisted P1–P3 carts and orders; leave the old key untouched.
const STORAGE_KEY = 'mock-api-db-srs-002-v1.8-original-catalog-v1'

declare global {
  interface Window {
    /** Test hook: `true` fails every mock call, or pass operation names like ["products.list"]. */
    __MOCK_API_FAIL__?: boolean | string[]
    /** Test hook: overrides the simulated network latency in milliseconds. */
    __MOCK_API_DELAY__?: number
  }
}

let memoryDb: MockDb | null = null

/**
 * The mock "server" state lives in sessionStorage so it survives page reloads
 * within one tab, while every new browser context (e.g. each Playwright test)
 * starts from a fresh seed.
 */
export function loadDb(): MockDb {
  if (memoryDb) return memoryDb
  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        memoryDb = JSON.parse(stored) as MockDb
        // Backfill presentation assets without resetting carts, orders, or stock.
        const seedImages = new Map(createSeedDb().products.map(product => [product.id, product.imageUrl]))
        for (const product of memoryDb.products) {
          if (!product.imageUrl) product.imageUrl = seedImages.get(product.id) ?? ''
        }
        return memoryDb
      } catch {
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }
  memoryDb = createSeedDb()
  return memoryDb
}

export function saveDb(db: MockDb) {
  memoryDb = db
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  }
}

export function resetMockDb() {
  assertTestMode()
  memoryDb = null
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY)
}

function delay() {
  const ms =
    apiConfig.testMode && typeof window !== 'undefined' && typeof window.__MOCK_API_DELAY__ === 'number'
      ? window.__MOCK_API_DELAY__
      : apiConfig.mockDelayMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldFail(operation: string): boolean {
  if (!apiConfig.testMode || typeof window === 'undefined') return false
  const flag = window.__MOCK_API_FAIL__
  if (flag === true) return true
  return Array.isArray(flag) && flag.includes(operation)
}

/** Simulates a network round-trip: latency, optional forced failure, and a cloned response. */
export async function simulateRequest<T>(operation: string, handler: (db: MockDb) => T): Promise<T> {
  await delay()
  if (shouldFail(operation)) {
    throw new ApiError('The server encountered an error. Please try again.', 500)
  }
  const db = structuredClone(loadDb())
  const result = handler(db)
  saveDb(db)
  return result === undefined ? result : structuredClone(result)
}

export function generateId(db: MockDb, prefix: string): string {
  db.nextId += 1
  return `${prefix}-${db.nextId}`
}
