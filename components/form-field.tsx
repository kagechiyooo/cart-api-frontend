import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type FieldErrors<T extends string> = Partial<Record<T, string>>

/** Accessibility props that link a control to its error message. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    name: id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  }
}

export function focusFirstError(errors: Record<string, string | undefined>) {
  const firstId = Object.keys(errors).find((key) => errors[key])
  if (firstId) document.getElementById(firstId)?.focus()
}

export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} data-testid={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
