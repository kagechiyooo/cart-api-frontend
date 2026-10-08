'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { api, type LoginInput } from '@/lib/api'
import { swrKeys } from '@/lib/hooks/keys'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (input: LoginInput) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { mutate: globalMutate } = useSWRConfig()
  const { data, isLoading, mutate } = useSWR(swrKeys.currentUser, () => api.auth.getCurrentUser())

  const clearUserScopedCache = useCallback(
    () =>
      globalMutate((key) => key !== swrKeys.currentUser, undefined, {
        revalidate: false,
      }),
    [globalMutate],
  )

  const login = useCallback(
    async (input: LoginInput) => {
      const user = await api.auth.login(input)
      await clearUserScopedCache()
      await mutate(user, { revalidate: false })
      return user
    },
    [clearUserScopedCache, mutate],
  )

  const logout = useCallback(async () => {
    await api.auth.logout()
    await clearUserScopedCache()
    await mutate(null, { revalidate: false })
  }, [clearUserScopedCache, mutate])

  const value = useMemo(
    () => ({ user: data ?? null, isLoading, login, logout }),
    [data, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
