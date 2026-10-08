'use client'

import { useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProductImage } from '@/components/products/product-image'
import { Button } from '@/components/ui/button'
import { api, getErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useCartMutation } from '@/lib/hooks/use-api'
import { MAX_QUANTITY_PER_ITEM } from '@/lib/pricing'
import type { CartItem } from '@/lib/types'

export function CartItemRow({ item }: { item: CartItem }) {
  const runCartMutation = useCartMutation()
  const [pending, setPending] = useState<'update' | 'remove' | null>(null)
  const maxQuantity = Math.min(item.stock, MAX_QUANTITY_PER_ITEM)

  async function run(kind: 'update' | 'remove', operation: () => Promise<unknown>) {
    setPending(kind)
    try {
      await operation()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  function changeQuantity(quantity: number) {
    return run('update', () =>
      runCartMutation(() => api.cart.updateItem(item.productId, quantity)),
    )
  }

  function remove() {
    return run('remove', async () => {
      await runCartMutation(() => api.cart.removeItem(item.productId))
      toast.success(`${item.name} removed from cart.`)
    })
  }

  return (
    <li
      data-testid={`cart-item-${item.productId}`}
      aria-busy={pending !== null}
      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
          <ProductImage src={item.imageUrl} alt="" />
        </div>
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate font-medium">{item.name}</h3>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(item.priceCents)} each
          </p>
          {item.quantity >= item.stock && (
            <p className="text-xs text-amber-700">Maximum available stock reached</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div
          role="group"
          aria-label={`Quantity for ${item.name}`}
          className="flex items-center rounded-md border"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Decrease quantity of ${item.name}`}
            onClick={() => changeQuantity(item.quantity - 1)}
            disabled={pending !== null || item.quantity <= 1}
            data-testid="decrease-quantity"
          >
            <Minus aria-hidden="true" />
          </Button>
          <output
            aria-live="polite"
            aria-label={`Quantity of ${item.name}`}
            data-testid="item-quantity"
            className="w-8 text-center text-sm font-medium tabular-nums"
          >
            {item.quantity}
          </output>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Increase quantity of ${item.name}`}
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={pending !== null || item.quantity >= maxQuantity}
            data-testid="increase-quantity"
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>

        <p className="w-24 text-right font-medium tabular-nums" data-testid="item-line-total">
          {formatCurrency(item.priceCents * item.quantity)}
        </p>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.name} from cart`}
          onClick={remove}
          disabled={pending !== null}
          data-testid="remove-item"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
