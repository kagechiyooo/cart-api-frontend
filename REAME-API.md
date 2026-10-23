# API modes and payment testing

This guide explains the frontend's four API modes and how to complete a simulated payment using the Express API.

For full installation instructions, see [README.md](README.md) or [Windows CMD setup](README-WINDOW.md).

## 1. Choose a mode

Set `NEXT_PUBLIC_API_MODE` in **`frontend/.env.local`**:

| Mode | Uses Express and PostgreSQL? | Payment behavior |
| --- | --- | --- |
| `mock` | No | Uses browser-only simulated data. No Pay button is shown. |
| `api` | Yes | Waits for an external payment callback, for example from Postman or curl. No Pay button is shown. |
| `pay_succeed` | Yes | Shows a **Pay** button that sends the successful-payment callback. |
| `pay_failed` | Yes | Shows a **Pay** button that sends the failed-payment callback. |

The payment modes apply when **Pay is clicked**, not automatically when checkout opens. They choose a simulated outcome; network errors, unavailable services, or invalid order states can still prevent a callback from completing.

All three backend-connected modes use the **same configured backend and database**. They are not separate databases. Payment simulation changes real data in that configured database.

The legacy value `rest` is accepted as an alias for `api`. Missing or unrecognized mode values currently fall back to `mock`; use one of the four documented values to avoid accidental mock operation.

### Mock mode

```dotenv
NEXT_PUBLIC_API_MODE=mock
```

Run only the frontend. Docker, Supabase, and Express are not needed. Data is stored in the browser's sessionStorage; sending requests to Express does not change that mock data.

### API mode

```dotenv
NEXT_PUBLIC_API_MODE=api
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Run Supabase, Express, and the frontend. Create an order, then send a payment callback externally as described below.

### Successful-payment simulation

```dotenv
NEXT_PUBLIC_API_MODE=pay_succeed
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Run all services, create an order, and click **Pay**. The frontend calls `POST /payments/{orderId}/success` and navigates to `/success` after the operation completes.

### Failed-payment simulation

```dotenv
NEXT_PUBLIC_API_MODE=pay_failed
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Run all services, create an order, and click **Pay**. The frontend calls `POST /payments/{orderId}/fail` and displays a payment-failure message. The order stays pending; it is not cancelled automatically.

### Apply environment changes

Preserve unrelated values when editing `.env.local`. Restart Next.js after changing the mode or base URL:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
npm run dev
```

Stop the previous frontend process with **Ctrl+C** before restarting. The footer displays the resolved API mode.

`NEXT_PUBLIC_TEST_MODE` is a separate legacy flag for programmatic test helpers. It is not an API mode, does not select a database, and is not required for the Pay button in `pay_succeed` or `pay_failed` mode. It no longer controls checkout payment buttons.

## 2. Start the services for backend-connected modes

Docker Desktop must be running. The setup guide's dependency installation, environment configuration, migration, and seed steps must already be complete.

### Database

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npx --yes supabase start
```

### Express API — separate CMD window

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm run dev
```

### Frontend — separate CMD window

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
npm run dev
```

Open http://localhost:3000. The API normally listens at http://localhost:3001. The frontend connects to PostgreSQL **through Express**, never directly.

## 3. Create an order in API mode

1. Set `NEXT_PUBLIC_API_MODE=api` and restart the frontend.
2. Sign in using a seeded customer account:

   | Username | Password |
   | --- | --- |
   | `cus_normal` | `password123` |
   | `cus_prime` | `password123` |

3. Add available products to the cart.
4. Choose the delivery zone and speed, then start checkout.
5. On **Awaiting payment**, copy the order ID exactly.

Use the order ID created in the current backend. A mock-mode order does not exist in PostgreSQL, even if its displayed ID looks similar.

## 4. Send a successful-payment callback

### Postman

- Method: **POST**
- URL: `http://localhost:3001/payments/YOUR_ORDER_ID/success`
- Authorization: **No Auth** for this callback route in the current implementation
- Body: **none**

Replace `YOUR_ORDER_ID` with the actual pending order ID, then click **Send**.

### Windows CMD

Replace `YOUR_ORDER_ID` before running:

```cmd
curl -i -X POST http://localhost:3001/payments/YOUR_ORDER_ID/success
```

Expected response: HTTP 200, with a body like:

```json
{
  "orderId": "YOUR_ORDER_ID",
  "status": "ชำระเงินแล้ว"
}
```

The backend marks the order paid, clears the customer's cart lines, clears the coupon, and changes the cart stage to success. Stock was already reserved during checkout; successful payment does not reserve it a second time.

Return to the frontend and click **Check payment status** to refresh the state. This button reads the current state; it does not trigger payment.

## 5. Send a failed-payment callback

In Postman, use **POST**, no authorization, and no body:

```text
http://localhost:3001/payments/YOUR_ORDER_ID/fail
```

Or in CMD:

```cmd
curl -i -X POST http://localhost:3001/payments/YOUR_ORDER_ID/fail
```

Expected response: HTTP 200 with a body like:

```json
{
  "orderId": "YOUR_ORDER_ID",
  "message": "การชำระเงินล้มเหลว กรุณาลองใหม่"
}
```

A failed payment is a handled business outcome, so this route returns HTTP 200 rather than an HTTP server error. The order remains pending, and its reserved stock is not restored. You can later send a successful callback for that pending order or cancel checkout through the frontend. Cancellation restores the reserved stock.

An external failed callback returns the failure message to Postman/curl; it does not push a failure notification into the browser. Use `pay_failed` mode to display the failure message directly from the frontend Pay action.

## 6. Authentication and callback errors

Normal customer endpoints require a bearer token. For example, obtain a token with:

```cmd
curl -i -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d "{\"username\":\"cus_normal\",\"password\":\"password123\"}"
```

Then, replacing `YOUR_TOKEN` with the returned token:

```cmd
curl -i http://localhost:3001/products -H "Authorization: Bearer YOUR_TOKEN"
```

Keep tokens private. Customer credentials above are for development only.

The payment callback routes are different: the current backend registers them without customer authentication. They require an existing pending order that is still the customer's active checkout.

| Result | Meaning |
| --- | --- |
| 200 from `/success` | Payment was recorded as successful. |
| 200 from `/fail` | Failure was simulated; the order remains pending. |
| 404 with `ORDER_NOT_FOUND` | The supplied order does not exist in this database. |
| 400 with `OPERATION_NOT_ALLOWED` | The order is no longer pending or is not the active checkout. |
| Connection refused | Verify that the API is running and that its port is correct. |

Callbacks are not repeatable once an order is paid or cancelled: sending another callback is rejected by the order-state checks.

## 7. Safety and troubleshooting

- **These are simulated payments.** No payment provider is contacted and no money is charged.
- **Do not expose the current callback routes publicly.** They lack payment-provider signature verification and can change order state without customer authentication. A real deployment needs verified gateway callbacks and appropriate access controls.
- `pay_succeed` and `pay_failed` are local-development conveniences, not production payment integrations. Use only a development database.
- `NEXT_PUBLIC_*` settings are visible to the browser. Never put database credentials, gateway secrets, or private API keys in them.
- Mock and backend data are separate. Switching modes does not transfer carts or orders.
- If no Pay button appears, check the footer and restart the frontend after selecting `pay_succeed` or `pay_failed`. No Pay button is expected in `mock` or `api` mode.
- For browser CORS errors, check the API's `CORS_ORIGIN=http://localhost:3000` and the frontend's base URL, then restart the affected services.
- Leave backend test-reset routes disabled during ordinary payment testing. Payment callbacks do not require `ENABLE_TEST_ROUTES=true`.
