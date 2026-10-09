import { CustomerStage } from '@/components/customer-stage'
import type { Metadata } from 'next'
import { CartView } from '@/components/cart/cart-view'
import { RequireAuth } from '@/components/require-auth'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Shopping cart' }

export default function CartPage() {
  return (
    <section data-testid="page-cart">
      <PageHeader title="Shopping cart" description="Review your items before checking out." />
      <RequireAuth role="customer">
        <CustomerStage><CartView /></CustomerStage>
      </RequireAuth>
    </section>
  )
}
