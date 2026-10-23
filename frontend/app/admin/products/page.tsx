import type { Metadata } from 'next'
import { AdminProductsView } from '@/components/admin/admin-products-view'

export const metadata: Metadata = { title: 'Manage products' }

export default function AdminProductsPage() {
  return <AdminProductsView />
}
