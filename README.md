# cart-api-frontend

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_QNoEtrnP2gvH1WfuiCKgLdE8UEZp)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## API specification integration

The frontend follows the operations in `API_design.xlsx` (API Endpoints and API Request & Response). Mock mode is the default. REST endpoint mappings live in `lib/api/rest/services.ts`; React-facing contracts live in `lib/api/types.ts` and `lib/types.ts`.

To connect a backend, create `.env.local` beside `package.json` and restart Next.js:

```env
NEXT_PUBLIC_API_MODE=rest
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

Public environment values are visible in the browser; never put secrets there. The backend must configure CORS and enforce bearer authentication and customer/admin permissions. Logout and current-user recovery are local session helpers because the workbook defines no endpoints for them.

### Supported workflow

- Login uses `username` and `password`. Seed customers are `cus_normal` and `cus_prime` (password `password123`); admin is `admin01` (password `admin123`). Passwords are demo implementation choices because the SRS does not specify them.
- Product listing requires login. Customers see only enabled products with stock ≥ 1; admins see all products. The catalog deliberately deviates from SRS section 7: the original eight products (`p-1`–`p-8`) replace P1–P3, while SRS accounts, SAVE10, and business rules remain unchanged.
- Customer cart mutations are permitted only in `cart` stage.
- Checkout accepts `zone` (`inCity`, `upcountry`, `remote`) and `speed` (`standard`, `express`). It reserves stock and retains the cart until payment succeeds.
- Checkout cancellation releases the reservation and restores cart stage. Payment failure leaves the reservation and stage unchanged. Payment success marks the order paid and clears the cart. Continue shopping returns to cart stage.
- Admin product changes are limited to price/stock and a separate sale-status operation. Coupon administration supports listing and status changes by code. Unsupported create/delete controls and cart-clear/coupon-removal operations were removed.

Payment callbacks are separate from customer services. SRS DC-3.3 gateway simulation buttons appear on checkout only when `NEXT_PUBLIC_TEST_MODE=true`; they call the guarded `getTestApi()` helpers. This term project uses a simulated gateway, not real payment processing. Gateway authentication is out of scope. Mock reset is likewise guarded; no REST reset endpoint is invented.

### Contract assumptions to confirm with the backend

The workbook contains prose response descriptions rather than complete JSON schemas. The REST adapter isolates these assumptions:

- SRS monetary values are integer Thai baht. UI formatting uses THB with no cent conversion or tax. Legacy internal `*Cents` field names contain baht for compatibility.
- The REST adapter translates Thai stages (`ตะกร้า`, `ชำระเงิน`, `สำเร็จ`) and order statuses (`รอชำระเงิน`, `ชำระเงินแล้ว`, `ยกเลิก`) to internal English values; UI status attributes use the Thai contract values.
- Product identifiers are `productId` (or `id`); collections are direct JSON arrays. Item fields use `name`, `price`, `quantity`, and `available`.
- Cart responses use `stage`, `items`, `count`, `total`, `couponCode`, and optionally `currentOrderId` / coupon details. Cancellation returns `{ order, cart }`.
- Order responses use `orderId`, `items`, `subtotal`, `discount`, `shippingFee`, `netTotal`, `zone`, `speed`, and `couponCode`.
- Product/coupon status payloads use the Thai strings shown in the workbook. Membership tiers are `normal` and `prime`.
- Pure functions in `lib/pricing.ts` implement DC-1: exact validation precedence, floor rounding, non-stacking coupon/prime discounts, weight tiers, the shipping matrix, and the 20,000 g ceiling. The mock uses these rules; REST uses authoritative server totals.

Confirm these assumptions against actual JSON examples before production integration.

### Original catalog and mock storage migration

The original IDs, names, descriptions, categories, raw `priceCents` numbers, stock, and PNG image paths are restored from Git HEAD. Those stored price numbers are now interpreted as **whole Thai baht**, not the original USD display or USD cents: for example, headphones retain `12999` and cost ฿12,999. No conversion, repricing, or tax is added.

Shipping weights are authorized estimates, not original catalog data:

| Product | Raw price (baht) | Stock | Estimated weight (g) |
| --- | ---: | ---: | ---: |
| Wireless Headphones | 12999 | 15 | 300 |
| Mechanical Keyboard | 8950 | 8 | 900 |
| Ceramic Coffee Mug | 1499 | 40 | 400 |
| Canvas Backpack | 5900 | 12 | 700 |
| Minimal Desk Lamp | 3995 | 0 | 1200 |
| Running Sneakers | 7499 | 20 | 800 |
| Insulated Water Bottle | 2400 | 30 | 450 |
| Cotton Hoodie | 4999 | 3 | 600 |

**Existing mock sessions reset on this migration.** The catalog uses the new sessionStorage key `mock-api-db-srs-002-v1.8-original-catalog-v1`, so old P1–P3 carts, orders, stock edits, and login state are not loaded. Data under the previous key is neither modified nor deleted; it is not migrated. The fresh catalog starts with no orders. Original fixed coupons, tax, and historical orders are not restored.

### Validation

```sh
node --test lib/api/spec.test.cjs
npx tsc --noEmit
```

The tests cover the restored production catalog and storage isolation as well as documented operations, SRS acceptance scenarios, pricing/boundaries, checkout lifecycle, stock reservations, ownership, permissions, domain errors, and REST mappings. SRS acceptance scenarios use an independent P1–P3 reference fixture via `createSrsReferenceDb()`; they do not assert that the production catalog exactly matches SRS section 7. They do not replace browser or live-backend integration testing.

For the test-only gateway controls, start Next.js with:

```env
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_TEST_MODE=true
```

Leave test mode unset outside a test environment. The browser mock is tab-local and cannot provide shared multi-user server persistence. A separately implemented api-server is still required for the complete SRS system; its storage/reset and behavior must be integration-tested.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
