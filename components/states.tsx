import { CircleAlert, LoaderCircle, RotateCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LoadingState({
  label = 'Loading…',
  className,
  testId = 'loading-state',
}: {
  label?: string
  className?: string
  testId?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-sm text-muted-foreground',
        className,
      )}
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  testId = 'error-state',
}: {
  title?: string
  message: string
  onRetry?: () => void
  testId?: string
}) {
  return (
    <Alert variant="destructive" data-testid={testId}>
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({
  title,
  description,
  action,
  testId = 'empty-state',
}: {
  title: string
  description?: string
  action?: React.ReactNode
  testId?: string
}) {
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-14 text-center"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </section>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
