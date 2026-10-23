# SRS-CART-002 v1.8 — lib interface handoff

## UI contract

- All `priceCents`, `minSubtotalCents`, and `Totals.*Cents` numbers now contain **whole baht**, not satang. UI formatting has already been updated by the parent.
- Product, cart item, and order item expose `weightGram`. Orders also expose `totalWeightGram` and `discountSource: 'coupon' | 'member' | 'none'`.
- `User.memberTier` is `normal | prime` (optional for compatibility). Prime fallback is floor(subtotal × 5%); a valid coupon replaces it.
- Cart and order expose `notices: { code: string; message: string }[]`. Successful checkout removes an inactive/below-minimum attached coupon and emits `COUPON_NOT_APPLICABLE`. Rejected checkout never removes a coupon. Continuing shopping clears notices.
- Internal stages remain `cart | checkout | success`. For UI `data-status`, map to `ตะกร้า | ชำระเงิน | สำเร็จ`.
- Internal SRS order statuses remain `pending | paid | cancelled`. For UI `data-status`, map to `รอชำระเงิน | ชำระเงินแล้ว | ยกเลิก`. Legacy additional status types remain for UI compatibility but SRS adapters do not emit them.
- Zone remains `inCity | upcountry | remote`; speed remains `standard | express`.
- `ApiError` exposes `status`, `code`, optional `fields: ('price'|'stock')[]`, and optional `productIds: string[]`. REST preserves these domain fields.
- Payment success retains `currentOrderId`, clears items/coupon, and changes stage to success. Continue shopping returns to cart and clears the current order reference.

## Seed accounts and data

`DEMO_ACCOUNTS` is exported from `lib/api/mock/seed.ts`:

| Key | Username | Password | Membership/role |
| --- | --- | --- | --- |
| customer | cus_normal | password123 | normal/customer |
| prime | cus_prime | password123 | prime/customer |
| admin | admin01 | admin123 | admin |

Products: P1 Coffee Beans 250g, 450 baht, 300 g, stock 20; P2 Drip Kettle, 1200 baht, 900 g, stock 3; P3 Espresso Machine, 15000 baht, 8000 g, stock 5. All active. Only coupon is SAVE10: 10%, minimum 1000 baht, active. No initial orders.

## Pure DC1 functions

Exports in `lib/pricing.ts`: `isProductAvailable`, `validateQuantityChange`, `calculateSubtotal`, `calculateTotalWeight`, `calculateDiscount`, `classifyWeight`, `calculateShippingFee`, `calculateNetTotal`, `validateCheckout`, `validateProductUpdate`.

`validateCheckout({ zone, speed, lines, totalWeightGram })` accepts unknown zone/speed, lines of `{ productId: string; quantity: number; available: boolean; availableStock: number }`, and a numeric total weight calculated beforehand with `calculateTotalWeight`. Unavailable lines or quantities exceeding available stock return all affected product IDs before the weight-limit check. Its result union is `{ result: 'OK' } | { result: 'VALIDATION_ERROR' | 'CART_EMPTY' | 'WEIGHT_LIMIT_EXCEEDED' } | { result: 'ITEMS_UNAVAILABLE'; productIds: string[] }. `calculateDiscount` returns `{ discount, source, couponRemoved }` without mutating the coupon. Product update validation uses wire name `price`, while `api.products.update` retains internal `priceCents`.

## Test-only UI integration

Set `NEXT_PUBLIC_TEST_MODE=true` explicitly before starting/building Next.js. Import `getTestApi` from `@/lib/api`:

```ts
const testApi = getTestApi()
await testApi.payments.success(orderId)
// or await testApi.payments.fail(orderId)
// mock mode only:
testApi.reset()
```

Access is rejected without the exact flag. Gateway callbacks stay outside `api` customer services. REST callbacks use the two documented payment endpoints; REST reset is rejected because no reset endpoint is specified. Mock latency/failure window hooks are ignored outside test mode.

After callbacks/reset, the parent should revalidate affected SWR keys (cart/orders/products/session as appropriate); the helpers intentionally do not depend on React/SWR.

## REST and mock boundaries

REST implements the existing 18 endpoint contracts (including separate payment callbacks), normalizes Thai lifecycle values and Customer/Admin roles, and never scales baht values. Login/logout/current-user session helpers do not invent extra endpoints.

The browser mock is **not backend persistence**: state is stored in memory and tab-local sessionStorage, survives reload within that tab, and is not shared across tabs/devices. The versioned storage key resets legacy demo data. Requests clone state and commit only after successful handlers, providing transactional validation/reservation within this mock. Gateway callbacks resolve the owning cart by order, independently of the current login session.

## Validation

Run `node --test lib/api/spec.test.cjs` and `npx tsc --noEmit --incremental false`. Tests include the supplied acceptance scenarios, DC1 boundaries/precedence, all shipping matrix combinations, REST endpoint requests/mappings/domain metadata, and strict test-mode guards. No real backend integration is claimed.
