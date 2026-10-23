import { formatCurrency } from '@/lib/format'
import type { Totals } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OrderSummary({ totals, couponCode, className, prefix = 'summary' }: { totals: Totals; couponCode?: string | null; className?: string; prefix?: string }) {
  const rows = [
    ['subtotal', 'Subtotal', totals.subtotalCents],
    ['discount', couponCode ? `Discount (${couponCode})` : 'Discount', totals.discountCents],
    ['shipping', 'Shipping', totals.shippingCents],
  ] as const
  return (
    <dl className={cn('flex flex-col gap-2 text-sm', className)} aria-label="Order totals">
      {rows.map(([key, label, value]) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd data-testid={`${prefix}-${key}`} data-value={value} className="tabular-nums">{key === 'discount' && value > 0 ? '-' : ''}{formatCurrency(value)}</dd>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd data-testid={`${prefix}-total`} data-value={totals.totalCents} className="tabular-nums">{formatCurrency(totals.totalCents)}</dd>
      </div>
    </dl>
  )
}
