import { apiConfig } from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'

const TOKEN_STORAGE_KEY = 'auth-token'

export const authToken = {
  get(): string | null {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
  },
  set(token: string | null) {
    if (typeof window === 'undefined') return
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  },
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/** Generic JSON request helper for the REST adapter. Paths are supplied by the caller. */
export async function httpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...init } = options
  const token = authToken.get()

  let response: Response
  try {
    response = await fetch(`${apiConfig.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0)
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`
    let code: string | undefined
    let fields: ('price' | 'stock')[] | undefined
    let productIds: string[] | undefined
    try {
      const data = await response.json()
      if (typeof data?.message === 'string') message = data.message
      code = data?.code
      fields = data?.fields
      productIds = data?.productIds
    } catch {
      // Response had no JSON body; keep the generic message.
    }
    throw new ApiError(message, response.status, code, fields, productIds)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
