'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { EmptyState, LoadingState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import type { Role } from '@/lib/types'

export function RequireAuth({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, user, router, pathname])

  if (isLoading || !user) return <LoadingState label="Checking your session…" />

  if (role && user.role !== role) {
    return (
      <EmptyState
        testId="access-denied"
        title="Access denied"
        description="You need an administrator account to view this page."
        action={
          <Link href="/products" className={buttonVariants({ variant: 'outline' })}>
            Back to products
          </Link>
        }
      />
    )
  }

  return <>{children}</>
}
