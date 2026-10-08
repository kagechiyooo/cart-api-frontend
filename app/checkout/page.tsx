import type { Metadata } from 'next'
import { CheckoutView } from '@/components/checkout/checkout-view'
import { RequireAuth } from '@/components/require-auth'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <>
      <PageHeader title="Checkout" description="Enter your shipping and payment details." />
      <RequireAuth>
        <CheckoutView />
      </RequireAuth>
    </>
  )
}
