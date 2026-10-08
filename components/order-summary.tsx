import { formatCurrency } from '@/lib/format'
import type { Totals } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OrderSummary({
  totals,
  couponCode,
  className,
}: {
  totals: Totals
  couponCode?: string | null
  className?: string
}) {
  const rows = [
    { label: 'Subtotal', value: formatCurrency(totals.subtotalCents), testId: 'summary-subtotal' },
    ...(totals.discountCents > 0
      ? [
          {
            label: couponCode ? `Discount (${couponCode})` : 'Discount',
            value: `-${formatCurrency(totals.discountCents)}`,
            testId: 'summary-discount',
          },
        ]
      : []),
    {
      label: 'Shipping',
      value: totals.shippingCents === 0 ? 'Free' : formatCurrency(totals.shippingCents),
      testId: 'summary-shipping',
    },
    { label: 'Tax', value: formatCurrency(totals.taxCents), testId: 'summary-tax' },
  ]

  return (
    <dl className={cn('flex flex-col gap-2 text-sm', className)} aria-label="Order totals">
      {rows.map((row) => (
        <div key={row.testId} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd data-testid={row.testId} className="tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd data-testid="summary-total" className="tabular-nums">
          {formatCurrency(totals.totalCents)}
        </dd>
      </div>
    </dl>
  )
}
