'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppMessage } from '@/components/app-message'
import { NativeSelect } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { api, type CheckoutInput } from '@/lib/api'
import { useCart, useRevalidate } from '@/lib/hooks/use-api'

export function CheckoutForm({ zone, speed, onZoneChange, onSpeedChange }: {
  zone: CheckoutInput['zone']
  speed: CheckoutInput['speed']
  onZoneChange: (zone: CheckoutInput['zone']) => void
  onSpeedChange: (speed: CheckoutInput['speed']) => void
}) {
  const { data: cart } = useCart()
  const revalidate = useRevalidate()
  const router = useRouter()

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  return <form noValidate className="flex flex-col gap-4" onSubmit={async e => { e.preventDefault(); if (pending) return; setPending(true); setError(null); try { await api.orders.checkout({ zone, speed }); await Promise.all([revalidate.cart(), revalidate.orders(), revalidate.products()]); router.push('/checkout') } catch (err) { setError(err) } finally { setPending(false) } }}>
    <Label htmlFor="zone-select">Shipping zone</Label><NativeSelect id="zone-select" data-testid="zone-select" value={zone} onChange={e => onZoneChange(e.target.value as CheckoutInput['zone'])}><option value="inCity">In city</option><option value="upcountry">Upcountry</option><option value="remote">Remote area</option></NativeSelect>
    <Label htmlFor="speed-select">Shipping speed</Label><NativeSelect id="speed-select" data-testid="speed-select" value={speed} onChange={e => onSpeedChange(e.target.value as CheckoutInput['speed'])}><option value="standard">Standard</option><option value="express">Express</option></NativeSelect>
    <Button type="submit" size="lg" className="w-full" data-testid="checkout-button" disabled={!cart?.items.length || cart.stage !== 'cart'} aria-busy={pending}>{pending ? 'Processing…' : 'Checkout'}</Button>{error != null && <AppMessage error={error} />}
  </form>
}
