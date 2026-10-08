import { formatOrderStatus } from '@/lib/format'
import type { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusStyles: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  shipped: 'bg-accent text-accent-foreground',
  delivered: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-muted text-muted-foreground line-through',
}

export function OrderStatusBadge({ status, testId }: { status: OrderStatus; testId?: string }) {
  return (
    <span
      data-testid={testId ?? 'order-status'}
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {formatOrderStatus(status)}
    </span>
  )
}
