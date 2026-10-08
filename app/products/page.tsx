import type { Metadata } from 'next'
import { ProductsView } from '@/components/products/products-view'
import { PageHeader } from '@/components/states'

export const metadata: Metadata = { title: 'Products' }

export default function ProductsPage() {
  return (
    <>
      <PageHeader title="Products" description="Browse the catalog and add items to your cart." />
      <ProductsView />
    </>
  )
}
