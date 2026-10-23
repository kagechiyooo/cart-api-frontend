'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { AppMessage } from '@/components/app-message'
import { LoadingState } from '@/components/states'
import { useCart } from '@/lib/hooks/use-api'

export function CustomerStage({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { data: cart, error } = useCart()
  const pathname = usePathname()
  const router = useRouter()
  const target = cart?.stage === 'checkout' ? '/checkout' : cart?.stage === 'success' ? '/success' : pathname === '/checkout' || pathname === '/success' ? '/cart' : pathname
  useEffect(() => { if (user?.role === 'customer' && cart && target !== pathname) router.replace(target) }, [user, cart, target, pathname, router])
  if (user?.role !== 'customer') return <>{children}</>
  if (error) return <AppMessage error={error} />
  if (!cart || target !== pathname) return <LoadingState />
  return <>{children}</>
}
