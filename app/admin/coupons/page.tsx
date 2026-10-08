import type { Metadata } from 'next'
import { AdminCouponsView } from '@/components/admin/admin-coupons-view'

export const metadata: Metadata = { title: 'Manage coupons' }

export default function AdminCouponsPage() {
  return <AdminCouponsView />
}
