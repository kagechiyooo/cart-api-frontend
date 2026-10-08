import type { Metadata } from 'next'
import { CartView } from '@/components/cart/cart-view'
import { RequireAuth } from '@/components/require-auth'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Shopping cart' }

export default function CartPage() {
  return (
    <>
      <PageHeader title="Shopping cart" description="Review your items before checking out." />
      <RequireAuth>
        <CartView />
      </RequireAuth>
    </>
  )
}
