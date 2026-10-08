'use client'

import { useState } from 'react'
import { TicketPercent } from 'lucide-react'
import { toast } from 'sonner'
import { fieldA11y } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, getErrorMessage } from '@/lib/api'
import { useCartMutation } from '@/lib/hooks/use-api'

export function CouponForm({ appliedCode }: { appliedCode: string | null }) {
  const runCartMutation = useCartMutation()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)

  async function handleApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!code.trim()) {
      setError('Enter a coupon code.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      const cart = await runCartMutation(() => api.cart.applyCoupon(code))
      toast.success(`Coupon ${cart.couponCode} applied.`)
      setCode('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function handleRemove() {
    setPending(true)
    try {
      await runCartMutation(() => api.cart.removeCoupon())
      toast.success('Coupon removed.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  if (appliedCode) {
    return (
      <div
        data-testid="applied-coupon"
        className="flex items-center justify-between gap-3 rounded-md border border-dashed border-primary/40 bg-accent px-3 py-2"
      >
        <p className="flex items-center gap-2 text-sm text-accent-foreground">
          <TicketPercent className="size-4" aria-hidden="true" />
          <span>
            Coupon <span className="font-mono font-semibold">{appliedCode}</span> applied
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={pending}
          data-testid="remove-coupon"
        >
          {pending ? 'Removing…' : 'Remove'}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleApply} noValidate aria-label="Apply coupon" className="flex flex-col gap-1.5">
      <Label htmlFor="coupon-code">Coupon code</Label>
      <div className="flex gap-2">
        <Input
          {...fieldA11y('coupon-code', error)}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(undefined)
          }}
          placeholder="e.g. SAVE10"
          autoComplete="off"
          disabled={pending}
          className="font-mono uppercase"
        />
        <Button type="submit" variant="outline" disabled={pending} data-testid="apply-coupon">
          {pending ? 'Applying…' : 'Apply'}
        </Button>
      </div>
      {error && (
        <p
          id="coupon-code-error"
          role="alert"
          data-testid="coupon-error"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  )
}
