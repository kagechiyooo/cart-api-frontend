import type { Metadata } from 'next'
import { OrdersView } from '@/components/orders/orders-view'
import { RequireAuth } from '@/components/require-auth'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Order history' }

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Order history" description="Track and review your past orders." />
      <RequireAuth>
        <OrdersView />
      </RequireAuth>
    </>
  )
}
