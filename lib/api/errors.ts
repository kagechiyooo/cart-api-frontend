export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status = 500, readonly code?: string, readonly fields?: ('price' | 'stock')[], readonly productIds?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}
