'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { AppMessage, Notices } from '@/components/app-message'
import { OrderSummary } from '@/components/order-summary'
import { LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { api, getTestApi } from '@/lib/api'
import { useCart, useCartMutation, useOrder, useRevalidate } from '@/lib/hooks/use-api'
import { swrKeys } from '@/lib/hooks/keys'
import { formatCurrency } from '@/lib/format'

export function CheckoutView({ success = false }: { success?: boolean }) {
  const { data: cart, error: cartError } = useCart()
  const { data: order, error: orderError } = useOrder(cart?.currentOrderId ?? '')
  const run = useCartMutation()
  const revalidate = useRevalidate()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const [error, setError] = useState<unknown>(null)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  async function refresh() { await Promise.all([revalidate.cart(), revalidate.orders(), revalidate.products(), mutate(swrKeys.currentUser)]) }
  async function action(payment?: 'success' | 'fail') {
    if (!order || pending) return
    setPending(true); setError(null); setFailed(false)
    try {
      if (payment) {
        const gateway = getTestApi()
        await gateway.payments[payment](order.id)
        await refresh()
        if (payment === 'success') router.push('/success'); else setFailed(true)
      } else {
        await run(() => success ? api.orders.continueShopping() : api.orders.cancel())
        await refresh(); router.push(success ? '/products' : '/cart')
      }
    } catch (err) { setError(err) } finally { setPending(false) }
  }
  if (cartError || orderError) return <AppMessage error={cartError || orderError} />
  if (!order) return <LoadingState />
  const prefix = success ? 'success' : 'checkout'
  return (
    <div data-status={success ? 'สำเร็จ' : 'ชำระเงิน'} className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <section aria-labelledby="payment-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
        <h2 id="payment-heading" className="text-base font-semibold">{success ? 'Payment successful' : 'Awaiting payment'}</h2>
        <p className="text-sm text-muted-foreground">Order <span data-testid={`${prefix}-order-id`} className="font-mono">{order.id}</span></p>
        <Notices notices={order.notices} />
        {error != null && <AppMessage error={error} />}
        {failed && <AppMessage code="PAYMENT_FAILED">การชำระเงินล้มเหลว กรุณาลองใหม่</AppMessage>}
        <Button size="lg" onClick={() => action()} disabled={pending} data-testid={success ? 'continue-shopping-button' : 'cancel-checkout-button'}>{success ? 'Continue shopping' : 'Cancel checkout'}</Button>
        {!success && <Button variant="outline" onClick={async () => { try { await refresh() } catch (err) { setError(err) } }}>Check payment status</Button>}
        {!success && process.env.NEXT_PUBLIC_TEST_MODE === 'true' && <div className="flex flex-wrap gap-2"><Button data-testid="gateway-pay-success" disabled={pending} onClick={() => action('success')}>Test successful payment</Button><Button data-testid="gateway-pay-fail" disabled={pending} onClick={() => action('fail')}>Test failed payment</Button></div>}
      </section>
      <aside aria-labelledby="checkout-summary-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:sticky lg:top-24">
        <h2 id="checkout-summary-heading" className="font-medium">Order summary</h2>
        <ul className="flex flex-col gap-2 text-sm" aria-label="Items in this order">
          {order.items.map(item => (
            <li className="flex justify-between gap-3" key={item.productId} data-testid={`${prefix}-line-${item.productId}`}>
              <span className="text-muted-foreground"><span data-testid={`${prefix}-line-name`}>{item.name}</span> <span className="tabular-nums">× <span data-testid={`${prefix}-line-qty`} data-value={item.quantity}>{item.quantity}</span></span></span>
              <span className="flex shrink-0 flex-col items-end tabular-nums"><span>{formatCurrency(item.priceCents * item.quantity)}</span><span className="text-xs text-muted-foreground"><span data-testid={`${prefix}-line-unit-price`} data-value={item.priceCents}>{formatCurrency(item.priceCents)}</span> each</span></span>
            </li>
          ))}
        </ul>
        <OrderSummary totals={order.totals} couponCode={order.couponCode} prefix={prefix} className="border-t pt-4" />
      </aside>
    </div>
  )
}
