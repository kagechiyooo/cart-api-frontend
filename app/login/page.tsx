import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { LoadingState } from '@/components/states'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div data-testid="page-login" className="mx-auto flex w-full max-w-md flex-col gap-6 py-4 md:py-10">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Cartwise</h1>
        <p className="text-sm text-muted-foreground">
          Use one of the demo accounts below to explore the store.
        </p>
      </div>
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
