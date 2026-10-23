import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OrderDetailsView } from '@/components/orders/order-details-view'
import { RequireAuth } from '@/components/require-auth'
import { LoadingState } from '@/components/states'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Order ${id}` }
}

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequireAuth role="customer">
      <Suspense fallback={<LoadingState />}>
        <OrderDetailsView id={decodeURIComponent(id)} />
      </Suspense>
    </RequireAuth>
  )
}
