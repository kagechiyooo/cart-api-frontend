import { AdminNav } from '@/components/admin/admin-nav'
import { RequireAuth } from '@/components/require-auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="admin">
      <div className="flex flex-col gap-6">
        <AdminNav />
        {children}
      </div>
    </RequireAuth>
  )
}
