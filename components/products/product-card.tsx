'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { ProductImage } from '@/components/products/product-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, getErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useCartMutation } from '@/lib/hooks/use-api'
import type { Product } from '@/lib/types'

function getStockLabel(stock: number) {
  if (stock === 0) return { text: 'Out of stock', tone: 'text-destructive' }
  if (stock <= 5) return { text: `Only ${stock} left`, tone: 'text-amber-700' }
  return { text: 'In stock', tone: 'text-muted-foreground' }
}

export function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const runCartMutation = useCartMutation()
  const [adding, setAdding] = useState(false)

  const headingId = `product-${product.id}-name`
  const stock = getStockLabel(product.stock)
  const outOfStock = product.stock === 0

  async function handleAddToCart() {
    if (!user) {
      toast.info('Please sign in to add items to your cart.')
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    setAdding(true)
    try {
      await runCartMutation(() => api.cart.addItem(product.id, 1))
      toast.success(`${product.name} added to cart.`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setAdding(false)
    }
  }

  return (
    <article
      aria-labelledby={headingId}
      data-testid={`product-card-${product.id}`}
      className="flex w-full flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm"
    >
      <div className="relative aspect-square bg-muted">
        <ProductImage src={product.imageUrl} alt={product.name} />
        <Badge variant="secondary" className="absolute top-2 left-2 bg-card/90">
          {product.category}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 id={headingId} className="font-medium leading-snug">
          {product.name}
        </h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-lg font-semibold tabular-nums" data-testid="product-price">
            {formatCurrency(product.priceCents)}
          </p>
          <p className={`text-xs font-medium ${stock.tone}`} data-testid="product-stock">
            {stock.text}
          </p>
        </div>
        <Button
          onClick={handleAddToCart}
          disabled={adding || outOfStock}
          aria-label={`Add ${product.name} to cart`}
          data-testid="add-to-cart"
        >
          <ShoppingCart aria-hidden="true" />
          {outOfStock ? 'Out of stock' : adding ? 'Adding…' : 'Add to cart'}
        </Button>
      </div>
    </article>
  )
}
