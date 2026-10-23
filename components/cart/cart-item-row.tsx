'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { AppMessage } from '@/components/app-message'
import { ProductImage } from '@/components/products/product-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useCartMutation } from '@/lib/hooks/use-api'
import type { CartItem } from '@/lib/types'

export function CartItemRow({ item }: { item: CartItem }) {
  const run = useCartMutation()
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => setQuantity(String(item.quantity)), [item.quantity])
  async function act(remove: boolean) {
    if (pending) return
    setError(null); setPending(true)
    try {
      const updatedCart = await run(() => remove ? api.cart.removeItem(item.id) : api.cart.updateItem(item.id, quantity.trim() ? Number(quantity) : NaN))
      const updatedItem = updatedCart.items.find(line => line.productId === item.productId)
      if (updatedItem) setQuantity(String(updatedItem.quantity))
    }
    catch (err) { setError(err) } finally { setPending(false) }
  }
  return (
    <li data-testid={`cart-line-${item.productId}`} aria-busy={pending} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted"><ProductImage src={item.imageUrl} alt="" /></div>
          <div className="flex min-w-0 flex-col">
            <h3 data-testid="cart-line-name" className="truncate font-medium">{item.name}</h3>
            <p className="text-sm text-muted-foreground tabular-nums"><span data-testid="cart-line-unit-price" data-value={item.priceCents}>{formatCurrency(item.priceCents)}</span> each</p>
            <p data-testid="cart-line-qty" data-value={item.quantity} className="text-xs text-muted-foreground tabular-nums">Quantity: {item.quantity}</p>
            <p data-testid="cart-line-availability" data-available={item.available} className={item.available ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{item.available ? 'Available' : 'Unavailable'}</p>
          </div>
        </div>
        <p className="text-right font-medium tabular-nums sm:w-24">{formatCurrency(item.priceCents * item.quantity)}</p>
      </div>
      <form noValidate onSubmit={e => { e.preventDefault(); void act(false) }} className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Label htmlFor={`qty-${item.productId}`}>Quantity for {item.name}</Label>
        <Input className="w-24" id={`qty-${item.productId}`} data-testid="cart-line-qty-input" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
        <Button type="submit" variant="outline" data-testid="cart-line-update" disabled={pending}>Update quantity</Button>
        <Button type="button" variant="ghost" data-testid="cart-line-remove" disabled={pending} onClick={() => act(true)}><Trash2 aria-hidden="true" />Remove</Button>
      </form>
      {error != null && <AppMessage error={error} />}
    </li>
  )
}
