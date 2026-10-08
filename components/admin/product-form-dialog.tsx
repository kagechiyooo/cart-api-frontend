'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { fieldA11y, focusFirstError, FormField, type FieldErrors } from '@/components/form-field'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api, getErrorMessage, type ProductInput } from '@/lib/api'
import { centsToDollarsInput, dollarsToCents } from '@/lib/format'
import type { Product } from '@/lib/types'

type Field = 'name' | 'description' | 'price' | 'stock' | 'category' | 'imageUrl'
type Values = Record<Field, string> & { active: boolean }

function toValues(product: Product | null): Values {
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? centsToDollarsInput(product.priceCents) : '',
    stock: product ? String(product.stock) : '',
    category: product?.category ?? '',
    imageUrl: product?.imageUrl ?? '',
    active: product?.active ?? true,
  }
}

function validate(values: Values): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  if (!values.name.trim()) errors.name = 'Name is required.'
  else if (values.name.trim().length > 80) errors.name = 'Name must be 80 characters or fewer.'
  if (!values.description.trim()) errors.description = 'Description is required.'
  const price = Number(values.price)
  if (!values.price.trim() || !Number.isFinite(price) || price <= 0) {
    errors.price = 'Enter a price greater than 0.'
  } else if (!/^\d+(\.\d{1,2})?$/.test(values.price.trim())) {
    errors.price = 'Use at most two decimal places.'
  }
  if (!/^\d+$/.test(values.stock.trim())) errors.stock = 'Stock must be a whole number of 0 or more.'
  if (!values.category.trim()) errors.category = 'Category is required.'
  return errors
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSaved: () => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="product-form-dialog">
        {open && (
          <ProductForm
            key={product?.id ?? 'new'}
            product={product}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProductForm({
  product,
  onDone,
  onSaved,
}: {
  product: Product | null
  onDone: () => void
  onSaved: () => Promise<void>
}) {
  const [values, setValues] = useState<Values>(() => toValues(product))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isEdit = product !== null

  const field = (id: Field) => ({
    ...fieldA11y(id, errors[id]),
    value: values[id],
    disabled: pending,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [id]: e.target.value }))
      if (errors[id]) setErrors((prev) => ({ ...prev, [id]: undefined }))
    },
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstError(nextErrors)
      return
    }

    const input: ProductInput = {
      name: values.name.trim(),
      description: values.description.trim(),
      priceCents: dollarsToCents(values.price),
      stock: Number.parseInt(values.stock, 10),
      category: values.category.trim(),
      imageUrl: values.imageUrl.trim(),
      active: values.active,
    }

    setPending(true)
    try {
      const saved = isEdit
        ? await api.products.update(product.id, input)
        : await api.products.create(input)
      await onSaved()
      toast.success(isEdit ? `${saved.name} updated.` : `${saved.name} created.`)
      onDone()
    } catch (error) {
      setSubmitError(getErrorMessage(error))
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isEdit ? 'Edit product' : 'Add product'}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit product' : 'Add product'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update the product details below.' : 'Fill in the details for the new product.'}
        </DialogDescription>
      </DialogHeader>

      {submitError && (
        <ErrorState title="Could not save product" message={submitError} testId="product-form-error" />
      )}

      <FormField id="name" label="Name" error={errors.name}>
        <Input {...field('name')} />
      </FormField>
      <FormField id="description" label="Description" error={errors.description}>
        <Textarea {...field('description')} rows={3} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="price" label="Price (USD)" error={errors.price}>
          <Input {...field('price')} inputMode="decimal" placeholder="19.99" />
        </FormField>
        <FormField id="stock" label="Stock" error={errors.stock}>
          <Input {...field('stock')} inputMode="numeric" placeholder="10" />
        </FormField>
      </div>
      <FormField id="category" label="Category" error={errors.category}>
        <Input {...field('category')} placeholder="e.g. Electronics" />
      </FormField>
      <FormField
        id="imageUrl"
        label="Image URL"
        error={errors.imageUrl}
        hint="Optional. A placeholder is shown when empty."
      >
        <Input {...field('imageUrl')} placeholder="/products/example.png" />
      </FormField>
      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
        <div className="flex flex-col">
          <Label htmlFor="product-active">Visible in store</Label>
          <span className="text-xs text-muted-foreground">
            Hidden products are not shown to customers.
          </span>
        </div>
        <Switch
          id="product-active"
          aria-label="Visible in store"
          checked={values.active}
          onCheckedChange={(checked) => setValues((prev) => ({ ...prev, active: checked }))}
          disabled={pending}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} data-testid="save-product">
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </DialogFooter>
    </form>
  )
}
