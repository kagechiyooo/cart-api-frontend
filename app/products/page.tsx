import { CustomerStage } from '@/components/customer-stage'
import type { Metadata } from 'next'
import { RequireAuth } from '@/components/require-auth'
import { ProductsView } from '@/components/products/products-view'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Products' }

export default function ProductsPage() {
  return (
    <section data-testid="page-products">
      <PageHeader title="Products" description="Browse the catalog and add items to your cart." />
      <RequireAuth><CustomerStage><ProductsView /></CustomerStage></RequireAuth>
    </section>
  )
}
