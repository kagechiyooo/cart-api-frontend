import { ApiError, getErrorMessage } from '@/lib/api'
import type { Notice } from '@/lib/types'

export function AppMessage({ error, kind = 'info', code = 'INFO', children }: { error?: unknown; kind?: 'error' | 'notice' | 'info'; code?: string; children?: React.ReactNode }) {
  return <p role={error ? 'alert' : 'status'} data-testid="app-message" data-kind={error ? 'error' : kind} data-code={error instanceof ApiError ? error.code ?? 'UNKNOWN_ERROR' : error ? 'UNKNOWN_ERROR' : code} className={error ? 'rounded-lg border bg-card px-2.5 py-2 text-left text-sm text-destructive' : 'rounded-lg border bg-card px-2.5 py-2 text-left text-sm text-card-foreground'}>{error ? getErrorMessage(error) : children}</p>
}

export function Notices({ notices }: { notices: Notice[] }) {
  return <>{notices.map((notice, index) => <AppMessage key={`${notice.code}-${index}`} kind="notice" code={notice.code}>{notice.message}</AppMessage>)}</>
}
