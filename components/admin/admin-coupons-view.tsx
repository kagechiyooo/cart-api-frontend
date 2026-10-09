'use client'

import { useState } from 'react'
import { AppMessage } from '@/components/app-message'
import { EmptyState, LoadingState, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/format'
import { useCoupons, useRevalidate } from '@/lib/hooks/use-api'
import type { Coupon } from '@/lib/types'

function CouponRow({ coupon }: { coupon: Coupon }) {
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const revalidate = useRevalidate()

  async function toggleStatus() {
    setPending(true)
    setError(null)
    try {
      await api.coupons.setStatus(coupon.code, coupon.active ? 'ปิดใช้' : 'เปิดใช้')
      await revalidate.coupons()
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  return (
    <TableRow data-testid={`admin-coupon-row-${coupon.code}`}>
      <TableCell className="pl-4">
        <div className="flex flex-col">
          <span className="font-mono font-semibold">{coupon.code}</span>
          <span className="text-xs text-muted-foreground">{coupon.description}</span>
        </div>
      </TableCell>
      <TableCell data-testid="admin-coupon-percent" data-value={coupon.value}>{coupon.value}%</TableCell>
      <TableCell className="hidden tabular-nums md:table-cell" data-testid="admin-coupon-min-spend" data-value={coupon.minSubtotalCents}>
        {formatCurrency(coupon.minSubtotalCents)}
      </TableCell>
      <TableCell className="hidden md:table-cell">{coupon.expiresAt ? formatDate(`${coupon.expiresAt}T12:00:00Z`) : 'Never'}</TableCell>
      <TableCell>
        <Badge data-testid="admin-coupon-status" data-status={coupon.active ? 'เปิดใช้' : 'ปิดใช้'} variant={coupon.active ? 'default' : 'secondary'}>
          {coupon.active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="pr-4">
        <Switch aria-label={`Enable coupon ${coupon.code}`} checked={coupon.active} disabled={pending} onCheckedChange={() => void toggleStatus()} data-testid="admin-coupon-toggle-status" />
        {error != null && <div className="mt-2"><AppMessage error={error} /></div>}
      </TableCell>
    </TableRow>
  )
}

export function AdminCouponsView() {
  const { data, error } = useCoupons()
  return (
    <section data-testid="page-admin-coupons">
      <PageHeader title="Coupons" description="Manage coupon status" />
      {error ? <AppMessage error={error} /> : !data ? <LoadingState label="Loading coupons…" /> : data.length === 0 ? (
        <EmptyState title="No coupons yet" description="No coupons are available." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table data-testid="admin-coupons-table">
            <caption className="sr-only">All coupons</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="hidden md:table-cell">Min. subtotal</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{data.map(coupon => <CouponRow key={coupon.code} coupon={coupon} />)}</TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
