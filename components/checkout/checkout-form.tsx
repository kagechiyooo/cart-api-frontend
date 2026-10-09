'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import {
  fieldA11y,
  focusFirstError,
  FormField,
  NativeSelect,
  type FieldErrors,
} from '@/components/form-field'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, getErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useRevalidate } from '@/lib/hooks/use-api'
import type { PaymentMethod } from '@/lib/types'

const COUNTRIES = ['Thailand', 'United States', 'Canada', 'United Kingdom', 'Germany', 'Brazil', 'Australia']

type Field =
  | 'fullName'
  | 'addressLine'
  | 'city'
  | 'postalCode'
  | 'country'
  | 'cardName'
  | 'cardNumber'
  | 'cardExpiry'
  | 'cardCvc'

type FormValues = Record<Field, string>

function validate(values: FormValues, paymentMethod: PaymentMethod): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  if (!values.fullName.trim()) errors.fullName = 'Full name is required.'
  if (!values.addressLine.trim()) errors.addressLine = 'Address is required.'
  if (!values.city.trim()) errors.city = 'City is required.'
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(values.postalCode.trim())) {
    errors.postalCode = 'Enter a valid postal code.'
  }
  if (!values.country) errors.country = 'Select a country.'

  if (paymentMethod === 'card') {
    if (!values.cardName.trim()) errors.cardName = 'Name on card is required.'
    if (!/^\d{16}$/.test(values.cardNumber.replace(/\s/g, ''))) {
      errors.cardNumber = 'Card number must be 16 digits.'
    }
    const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(values.cardExpiry.trim())
    if (!expiry) {
      errors.cardExpiry = 'Use the format MM/YY.'
    } else {
      const endOfMonth = new Date(2000 + Number(expiry[2]), Number(expiry[1]), 1)
      if (endOfMonth.getTime() <= Date.now()) errors.cardExpiry = 'This card has expired.'
    }
    if (!/^\d{3,4}$/.test(values.cardCvc.trim())) errors.cardCvc = 'CVC must be 3 or 4 digits.'
  }
  return errors
}

export function CheckoutForm({ totalCents }: { totalCents: number }) {
  const { user } = useAuth()
  const router = useRouter()
  const revalidate = useRevalidate()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [zone, setZone] = useState('inCity')
  const [speed, setSpeed] = useState('standard')
  const [values, setValues] = useState<FormValues>({
    fullName: user?.name ?? '',
    addressLine: '',
    city: '',
    postalCode: '',
    country: '',
    cardName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
  })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function update(field: Field) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    const nextErrors = validate(values, paymentMethod)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstError(nextErrors)
      return
    }

    setPending(true)
    try {
      const order = await api.orders.checkout({
        paymentMethod,
        shippingAddress: {
          fullName: values.fullName.trim(),
          addressLine: values.addressLine.trim(),
          city: values.city.trim(),
          postalCode: values.postalCode.trim(),
          country: values.country,
        },
      })
      await Promise.all([revalidate.cart(), revalidate.orders(), revalidate.products()])
      toast.success(`Order ${order.id} placed.`)
      router.push(`/orders/${order.id}?placed=1`)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
      setPending(false)
    }
  }

  const field = (id: Field) => ({
    ...fieldA11y(id, errors[id]),
    value: values[id],
    onChange: update(id),
    disabled: pending,
  })

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Checkout"
      data-testid="checkout-form"
      className="flex flex-col gap-6"
    >
      {submitError && (
        <ErrorState
          title="We couldn't place your order"
          message={submitError}
          testId="checkout-error"
        />
      )}

      <fieldset className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <legend className="px-1 font-medium">Shipping address</legend>
        <FormField id="fullName" label="Full name" error={errors.fullName}>
          <Input {...field('fullName')} autoComplete="name" />
        </FormField>
        <FormField id="addressLine" label="Street address" error={errors.addressLine}>
          <Input {...field('addressLine')} autoComplete="street-address" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="city" label="City" error={errors.city}>
            <Input {...field('city')} autoComplete="address-level2" />
          </FormField>
          <FormField id="postalCode" label="Postal code" error={errors.postalCode}>
            <Input {...field('postalCode')} autoComplete="postal-code" />
          </FormField>
        </div>
        <FormField id="country" label="Country" error={errors.country}>
          <NativeSelect {...field('country')} autoComplete="country-name">
            <option value="">Select a country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </fieldset>


      <fieldset className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <legend className="px-1 font-medium">
          Shipping options
        </legend>

        <div className="flex flex-col gap-2">
          <label htmlFor="shipping-zone" className="text-sm font-medium">
            Shipping Zone
          </label>

          <select
            id="shipping-zone"
            aria-label="Shipping Zone"
            data-testid="shipping-zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="inCity">In City</option>
            <option value="upcountry">Upcountry</option>
            <option value="remote">Remote</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="shipping-speed" className="text-sm font-medium">
            Shipping Speed
          </label>

          <select
            id="shipping-speed"
            aria-label="Shipping Speed"
            data-testid="shipping-speed"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border bg-background p-2 text-sm"
          >
            <option value="standard">Standard</option>
            <option value="express">Express</option>
          </select>
        </div>
      </fieldset>


      <fieldset className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <legend className="px-1 font-medium">Payment method</legend>
        <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: 'card', label: 'Credit card' },
              { value: 'paypal', label: 'PayPal' },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm has-checked:border-primary has-checked:bg-accent"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={paymentMethod === option.value}
                onChange={() => setPaymentMethod(option.value)}
                disabled={pending}
                className="accent-primary"
                data-testid={`payment-${option.value}`}
              />
              {option.label}
            </label>
          ))}
        </div>

        {paymentMethod === 'card' ? (
          <div className="flex flex-col gap-4" data-testid="card-fields">
            <FormField id="cardName" label="Name on card" error={errors.cardName}>
              <Input {...field('cardName')} autoComplete="cc-name" />
            </FormField>
            <FormField
              id="cardNumber"
              label="Card number"
              error={errors.cardNumber}
              hint="Demo only: card details are validated locally and never sent."
            >
              <Input
                {...field('cardNumber')}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="cardExpiry" label="Expiry (MM/YY)" error={errors.cardExpiry}>
                <Input {...field('cardExpiry')} autoComplete="cc-exp" placeholder="12/29" />
              </FormField>
              <FormField id="cardCvc" label="CVC" error={errors.cardCvc}>
                <Input
                  {...field('cardCvc')}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                />
              </FormField>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="paypal-note">
            {"You'll confirm the PayPal payment after placing your order."}
          </p>
        )}
      </fieldset>

      <Button type="submit" size="lg" disabled={pending} data-testid="place-order">
        <CreditCard aria-hidden="true" />
        {pending ? 'Placing order…' : `Place order · ${formatCurrency(totalCents)}`}
      </Button>
    </form>
  )
}
