import type { Metadata } from 'next'
import { RequireAuth } from '@/components/require-auth'
import { CustomerStage } from '@/components/customer-stage'
import { CheckoutView } from '@/components/checkout/checkout-view'
export const metadata: Metadata = { title: 'Payment successful' }
export default function SuccessPage() {
  return <section data-testid="page-success"><RequireAuth role="customer"><CustomerStage><CheckoutView success /></CustomerStage></RequireAuth></section>
}
