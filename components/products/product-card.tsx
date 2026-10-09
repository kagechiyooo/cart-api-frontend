'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { AppMessage } from '@/components/app-message'
import { ProductImage } from '@/components/products/product-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useCartMutation } from '@/lib/hooks/use-api'
import type { Product } from '@/lib/types'

export function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth()
  const run = useCartMutation()
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const headingId = `product-${product.id}-name`
  const stockTone = product.stock === 0 ? 'text-destructive' : product.stock <= 5 ? 'text-amber-700' : 'text-muted-foreground'

  return (
    <article aria-labelledby={headingId} data-testid={`product-row-${product.id}`} className="flex w-full flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm">
      <div className="relative aspect-square bg-muted">
        <ProductImage src={product.imageUrl} alt={product.name} />
        <Badge variant="secondary" className="absolute top-2 left-2 bg-card/90">{product.category}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 id={headingId} data-testid="product-name" className="font-medium leading-snug">{product.name}</h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p data-testid="product-price" data-value={product.priceCents} className="text-lg font-semibold tabular-nums">{formatCurrency(product.priceCents)}</p>
          <p data-testid="product-stock" data-value={product.stock} className={`text-xs font-medium ${stockTone}`}>In stock: {product.stock}</p>
        </div>
        {error != null && <AppMessage error={error} />}
        {user?.role === 'customer' && (
          <form noValidate onSubmit={async e => {
            e.preventDefault(); setError(null); setPending(true)
            try { await run(() => api.cart.addItem(product.id, quantity.trim() ? Number(quantity) : NaN)) }
            catch (err) { setError(err) } finally { setPending(false) }
          }} className="flex flex-col gap-2">
            <Label htmlFor={`add-${product.id}`}>Quantity for {product.name}</Label>
            <Input id={`add-${product.id}`} data-testid="product-add-qty" type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
            <Button data-testid="product-add-button" disabled={pending} type="submit"><ShoppingCart aria-hidden="true" />Add to cart</Button>
          </form>
        )}
      </div>
    </article>
  )
}
