import { CustomerStage } from '@/components/customer-stage'
import type { Metadata } from 'next'
import { CheckoutView } from '@/components/checkout/checkout-view'
import { RequireAuth } from '@/components/require-auth'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Checkout' }

export default function CheckoutPage() {
  return (
    <section data-testid="page-checkout">
      <PageHeader title="Checkout" description="Choose your delivery zone and speed." />
      <RequireAuth role="customer">
        <CustomerStage><CheckoutView /></CustomerStage>
      </RequireAuth>
    </section>
  )
}
