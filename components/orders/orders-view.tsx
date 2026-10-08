'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NativeSelect } from '@/components/form-field'
import { OrderStatusBadge } from '@/components/order-status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api'
import { formatCurrency, formatDate, formatOrderStatus } from '@/lib/format'
import { useOrders } from '@/lib/hooks/use-api'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types'

export function OrdersView() {
  const { data: orders, error, isLoading, mutate } = useOrders()
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')

  if (isLoading) return <LoadingState label="Loading your orders…" />
  if (error || !orders) {
    return (
      <ErrorState
        title="Could not load your orders"
        message={getErrorMessage(error)}
        onRetry={() => mutate()}
      />
    )
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        testId="orders-empty"
        title="No orders yet"
        description="When you place an order, it will show up here."
        action={
          <Link href="/products" className={buttonVariants()}>
            Start shopping
          </Link>
        }
      />
    )
  }

  const visible = status === 'all' ? orders : orders.filter((o) => o.status === status)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 sm:w-56">
        <Label htmlFor="order-status-filter">Filter by status</Label>
        <NativeSelect
          id="order-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | 'all')}
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatOrderStatus(s)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No matching orders"
          description="No orders have this status. Try a different filter."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table data-testid="orders-table">
            <caption className="sr-only">Your orders</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden sm:table-cell">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((order) => (
                <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                  <TableCell className="font-mono font-medium">{order.id}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {order.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(order.totals.totalCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      aria-label={`View order ${order.id}`}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
