'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CouponFormDialog } from '@/components/admin/coupon-form-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, getErrorMessage } from '@/lib/api'
import { formatCouponValue, formatCurrency, formatDate } from '@/lib/format'
import { useCoupons, useRevalidate } from '@/lib/hooks/use-api'
import { isCouponExpired } from '@/lib/pricing'
import type { Coupon } from '@/lib/types'

function CouponStatus({ coupon }: { coupon: Coupon }) {
  if (!coupon.active) return <Badge variant="secondary">Inactive</Badge>
  if (isCouponExpired(coupon)) return <Badge variant="destructive">Expired</Badge>
  return <Badge>Active</Badge>
}

export function AdminCouponsView() {
  const { data: coupons, error, isLoading, mutate } = useCoupons()
  const revalidate = useRevalidate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [deleting, setDeleting] = useState<Coupon | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  async function refreshAfterChange() {
    await Promise.all([revalidate.coupons(), revalidate.cart()])
  }

  async function toggleActive(coupon: Coupon, active: boolean) {
    setTogglingId(coupon.id)
    try {
      const { id: _id, ...input } = coupon
      await api.coupons.update(coupon.id, { ...input, active })
      await refreshAfterChange()
      toast.success(`${coupon.code} ${active ? 'activated' : 'deactivated'}.`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  let content: React.ReactNode
  if (isLoading) {
    content = <LoadingState label="Loading coupons…" />
  } else if (error || !coupons) {
    content = (
      <ErrorState
        title="Could not load coupons"
        message={getErrorMessage(error)}
        onRetry={() => mutate()}
      />
    )
  } else if (coupons.length === 0) {
    content = (
      <EmptyState
        title="No coupons yet"
        description="Create a coupon to offer discounts at checkout."
        action={<Button onClick={openCreate}>Add coupon</Button>}
      />
    )
  } else {
    content = (
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
              <TableHead>Enabled</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => (
              <TableRow key={coupon.id} data-testid={`admin-coupon-row-${coupon.code}`}>
                <TableCell className="pl-4">
                  <div className="flex flex-col">
                    <span className="font-mono font-semibold">{coupon.code}</span>
                    <span className="text-xs text-muted-foreground">{coupon.description}</span>
                  </div>
                </TableCell>
                <TableCell>{formatCouponValue(coupon)}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {coupon.minSubtotalCents > 0 ? formatCurrency(coupon.minSubtotalCents) : 'None'}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {coupon.expiresAt ? formatDate(`${coupon.expiresAt}T12:00:00Z`) : 'Never'}
                </TableCell>
                <TableCell>
                  <CouponStatus coupon={coupon} />
                </TableCell>
                <TableCell>
                  <Switch
                    aria-label={`Enable coupon ${coupon.code}`}
                    checked={coupon.active}
                    disabled={togglingId === coupon.id}
                    onCheckedChange={(checked) => toggleActive(coupon, checked)}
                    data-testid="toggle-coupon"
                  />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit coupon ${coupon.code}`}
                      onClick={() => {
                        setEditing(coupon)
                        setFormOpen(true)
                      }}
                      data-testid="edit-coupon"
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete coupon ${coupon.code}`}
                      onClick={() => setDeleting(coupon)}
                      data-testid="delete-coupon"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Manage discount codes customers can apply in their cart."
        actions={
          <Button onClick={openCreate} data-testid="add-coupon">
            <Plus aria-hidden="true" />
            Add coupon
          </Button>
        }
      />
      {content}

      <CouponFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        coupon={editing}
        onSaved={refreshAfterChange}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete coupon ${deleting?.code ?? ''}?`}
        description="Customers will no longer be able to use this code."
        confirmLabel="Delete coupon"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!deleting) return
          await api.coupons.remove(deleting.id)
          await refreshAfterChange()
          toast.success(`Coupon ${deleting.code} deleted.`)
        }}
      />
    </>
  )
}
