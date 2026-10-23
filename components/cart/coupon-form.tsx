'use client'

import { useState } from 'react'
import { TicketPercent } from 'lucide-react'
import { AppMessage } from '@/components/app-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useCartMutation } from '@/lib/hooks/use-api'

export function CouponForm({ appliedCode }: { appliedCode: string | null }) {
  const run = useCartMutation()
  const [code, setCode] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  return (
    <form noValidate aria-label="Apply coupon" className="flex flex-col gap-1.5" onSubmit={async e => {
      e.preventDefault(); setError(null); setPending(true)
      try { await run(() => api.cart.applyCoupon(code)) }
      catch (err) { setError(err) } finally { setPending(false) }
    }}>
      <p className={appliedCode ? 'flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-accent px-3 py-2 text-sm text-accent-foreground' : 'text-sm text-muted-foreground'}>
        {appliedCode && <TicketPercent className="size-4" aria-hidden="true" />}
        Coupon: <span data-testid="cart-coupon-code" className="font-mono font-semibold">{appliedCode ?? ''}</span>
      </p>
      <Label htmlFor="coupon-input">Coupon code</Label>
      <div className="flex gap-2">
        <Input id="coupon-input" data-testid="coupon-input" className="font-mono" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} />
        <Button variant="outline" data-testid="coupon-apply" type="submit" disabled={pending}>Apply coupon</Button>
      </div>
      {error != null && <AppMessage error={error} />}
    </form>
  )
}
