'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  fieldA11y,
  focusFirstError,
  FormField,
  NativeSelect,
  type FieldErrors,
} from '@/components/form-field'
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
import { api, getErrorMessage, type CouponInput } from '@/lib/api'
import { centsToDollarsInput, dollarsToCents } from '@/lib/format'
import type { Coupon, CouponType } from '@/lib/types'

type Field = 'code' | 'description' | 'value' | 'minSubtotal' | 'expiresAt'
type Values = Record<Field, string> & { type: CouponType; active: boolean }

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/

function toValues(coupon: Coupon | null): Values {
  return {
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? 'percent',
    value: coupon
      ? coupon.type === 'percent'
        ? String(coupon.value)
        : centsToDollarsInput(coupon.value)
      : '',
    minSubtotal: coupon ? centsToDollarsInput(coupon.minSubtotalCents) : '0.00',
    expiresAt: coupon?.expiresAt ?? '',
    active: coupon?.active ?? true,
  }
}

function validate(values: Values): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  if (!/^[A-Z0-9]{3,20}$/.test(values.code)) {
    errors.code = 'Use 3-20 uppercase letters or digits.'
  }
  if (!values.description.trim()) errors.description = 'Description is required.'
  if (values.type === 'percent') {
    const percent = Number(values.value)
    if (!/^\d+$/.test(values.value) || percent < 1 || percent > 100) {
      errors.value = 'Enter a whole percentage between 1 and 100.'
    }
  } else if (!MONEY_PATTERN.test(values.value) || Number(values.value) <= 0) {
    errors.value = 'Enter an amount greater than 0.'
  }
  if (!MONEY_PATTERN.test(values.minSubtotal)) {
    errors.minSubtotal = 'Enter an amount of 0 or more.'
  }
  if (values.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(values.expiresAt)) {
    errors.expiresAt = 'Enter a valid date.'
  }
  return errors
}

export function CouponFormDialog({
  open,
  onOpenChange,
  coupon,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  coupon: Coupon | null
  onSaved: () => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="coupon-form-dialog">
        {open && (
          <CouponForm
            key={coupon?.id ?? 'new'}
            coupon={coupon}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CouponForm({
  coupon,
  onDone,
  onSaved,
}: {
  coupon: Coupon | null
  onDone: () => void
  onSaved: () => Promise<void>
}) {
  const [values, setValues] = useState<Values>(() => toValues(coupon))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isEdit = coupon !== null

  function setField(id: Field, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }))
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: undefined }))
  }

  const field = (id: Field) => ({
    ...fieldA11y(id, errors[id]),
    value: values[id],
    disabled: pending,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(id, e.target.value),
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

    const input: CouponInput = {
      code: values.code,
      description: values.description.trim(),
      type: values.type,
      value: values.type === 'percent' ? Number(values.value) : dollarsToCents(values.value),
      minSubtotalCents: dollarsToCents(values.minSubtotal),
      expiresAt: values.expiresAt || null,
      active: values.active,
    }

    setPending(true)
    try {
      const saved = isEdit
        ? await api.coupons.update(coupon.id, input)
        : await api.coupons.create(input)
      await onSaved()
      toast.success(isEdit ? `Coupon ${saved.code} updated.` : `Coupon ${saved.code} created.`)
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
      aria-label={isEdit ? 'Edit coupon' : 'Add coupon'}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit coupon' : 'Add coupon'}</DialogTitle>
        <DialogDescription>
          Percentage coupons take a share off the subtotal; fixed coupons subtract an amount.
        </DialogDescription>
      </DialogHeader>

      {submitError && (
        <ErrorState title="Could not save coupon" message={submitError} testId="coupon-form-error" />
      )}

      <FormField id="code" label="Code" error={errors.code}>
        <Input
          {...field('code')}
          onChange={(e) => setField('code', e.target.value.toUpperCase())}
          className="font-mono uppercase"
          autoComplete="off"
          placeholder="SPRING25"
        />
      </FormField>
      <FormField id="description" label="Description" error={errors.description}>
        <Input {...field('description')} placeholder="25% off spring collection" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="type" label="Discount type">
          <NativeSelect
            id="type"
            value={values.type}
            disabled={pending}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, type: e.target.value as CouponType, value: '' }))
              setErrors((prev) => ({ ...prev, value: undefined }))
            }}
          >
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </NativeSelect>
        </FormField>
        <FormField
          id="value"
          label={values.type === 'percent' ? 'Percentage (%)' : 'Amount (USD)'}
          error={errors.value}
        >
          <Input
            {...field('value')}
            inputMode={values.type === 'percent' ? 'numeric' : 'decimal'}
            placeholder={values.type === 'percent' ? '10' : '5.00'}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="minSubtotal" label="Minimum subtotal (USD)" error={errors.minSubtotal}>
          <Input {...field('minSubtotal')} inputMode="decimal" />
        </FormField>
        <FormField
          id="expiresAt"
          label="Expires on"
          error={errors.expiresAt}
          hint="Leave empty for no expiry."
        >
          <Input {...field('expiresAt')} type="date" />
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
        <Label htmlFor="coupon-active">Active</Label>
        <Switch
          id="coupon-active"
          aria-label="Active"
          checked={values.active}
          onCheckedChange={(checked) => setValues((prev) => ({ ...prev, active: checked }))}
          disabled={pending}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} data-testid="save-coupon">
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon'}
        </Button>
      </DialogFooter>
    </form>
  )
}
