'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { fieldA11y, focusFirstError, FormField, type FieldErrors } from '@/components/form-field'
import { AppMessage } from '@/components/app-message'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api'
import { DEMO_ACCOUNTS } from '@/lib/api/mock/seed'

type Field = 'username' | 'password'


function getSafeRedirect(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

export function LoginForm() {
  const { user, login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {}
    if (!username.trim()) next.username = 'Username is required.'
    if (!password) next.password = 'Password is required.'
    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    setPending(true)
    try {
      const signedIn = await login({ username: username.trim(), password })
      toast.success(`Welcome back, ${signedIn.name}.`)
      const fallback = signedIn.role === 'admin' ? '/admin/products' : '/products'
      router.replace(getSafeRedirect(searchParams.get('next')) ?? fallback)
    } catch (error) {
      setFormError(error)
    } finally {
      setPending(false)
    }
  }

  function fillDemo(account: keyof typeof DEMO_ACCOUNTS) {
    setUsername(DEMO_ACCOUNTS[account].username)
    setPassword(DEMO_ACCOUNTS[account].password)
    setErrors({})
    setFormError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {user && (
        <p
          data-testid="already-signed-in"
          className="rounded-md border bg-accent px-4 py-3 text-sm text-accent-foreground"
        >
          {"You're signed in as "}
          <span className="font-medium">{user.name}</span>.{' '}
          <Link href="/products" className="font-medium underline underline-offset-4">
            Browse products
          </Link>
        </p>
      )}

      <Card>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label="Sign in"
            data-testid="login-form"
            className="flex flex-col gap-4"
          >
            {formError != null && (
              <AppMessage error={formError} />
            )}

            <FormField id="username" label="Username" error={errors.username}>
              <Input
                {...fieldA11y('username', errors.username)} data-testid="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={pending}
              />
            </FormField>

            <FormField id="password" label="Password" error={errors.password}>
              <Input
                {...fieldA11y('password', errors.password)} data-testid="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </FormField>

            <Button type="submit" disabled={pending} data-testid="login-submit">
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section
        aria-labelledby="demo-accounts-heading"
        className="flex flex-col gap-3 rounded-lg border border-dashed p-4"
      >
        <h2 id="demo-accounts-heading" className="text-sm font-medium">
          Demo accounts
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((account) => (
            <li key={account} className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="font-medium capitalize">{account}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {DEMO_ACCOUNTS[account].username} / {DEMO_ACCOUNTS[account].password}
                </span>
              </span>
              <button
                type="button"
                onClick={() => fillDemo(account)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                data-testid={`fill-${account}`}
              >
                Use {account}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
