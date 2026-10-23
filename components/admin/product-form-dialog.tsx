'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { fieldA11y, focusFirstError, FormField, type FieldErrors } from '@/components/form-field'
import { AppMessage } from '@/components/app-message'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api, getErrorMessage } from '@/lib/api'
import { centsToDollarsInput, dollarsToCents } from '@/lib/format'
import type { Product } from '@/lib/types'

type Field = 'price' | 'stock'

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSaved: () => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="product-form-dialog">
        {open && product && <ProductForm key={product.id} product={product} onDone={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function ProductForm({ product, onDone, onSaved }: { product: Product; onDone: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState({ price: centsToDollarsInput(product.priceCents), stock: String(product.stock) })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: FieldErrors<Field> = {}
    if (!/^\d+$/.test(values.price.trim()) || !Number.isSafeInteger(dollarsToCents(values.price)) || Number(values.price) < 0) next.price = 'Enter a non-negative price in whole baht.'
    if (!/^\d+$/.test(values.stock.trim()) || !Number.isSafeInteger(Number(values.stock))) next.stock = 'Enter a non-negative whole number.'
    setErrors(next)
    if (Object.keys(next).length) { focusFirstError(next); return }
    setPending(true)
    setSubmitError(null)
    try {
      await api.products.update(product.id, { priceCents: dollarsToCents(values.price), stock: Number(values.stock) })
      await onSaved()
      toast.success(`${product.name} updated.`)
      onDone()
    } catch (error) {
      setSubmitError(error)
    } finally { setPending(false) }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Edit product" className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Edit {product.name}</DialogTitle>
        <DialogDescription>Update price and stock. Sale status is managed separately.</DialogDescription>
      </DialogHeader>
      {submitError != null && <AppMessage error={submitError} />}
      {(['price', 'stock'] as const).map((field) => (
        <FormField key={field} id={field} label={field === 'price' ? 'Price (THB)' : 'Stock'} error={errors[field]}>
          <Input {...fieldA11y(field, errors[field])} value={values[field]} inputMode={'numeric'} disabled={pending} onChange={(event) => setValues({ ...values, [field]: event.target.value })} />
        </FormField>
      ))}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending} data-testid="save-product">{pending ? 'Saving…' : 'Save changes'}</Button>
      </DialogFooter>
    </form>
  )
}
