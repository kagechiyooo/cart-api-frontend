# Cart API frontend

Next.js shopping-cart frontend with an Express API and Supabase PostgreSQL, implementing SRS-CART-002. Local development runs three services: frontend **3000**, API **3001**, and PostgreSQL **54322**. `database-server` contains database scripts, not another HTTP server.

## One-time setup (macOS)

**Run every command below from the project root (`cart-api-frontend`).** Parenthesized commands temporarily switch directories and return you to the root. Assume Homebrew and **Node.js 22+** (including npm) are installed.

### 1. Install Docker Desktop and Supabase CLI

```sh
brew install --cask docker
open -a Docker
brew tap supabase/tap
brew install supabase
node --version
npm --version
docker info
supabase --version
```

Finish Docker's first-run prompts and wait until `docker info` succeeds before continuing.

### 2. Install dependencies

```sh
npm install
(cd simple-backend/database-server && npm ci)
(cd simple-backend/backend-server && npm ci)
```

The frontend declares `pnpm@12.3.4`, but also includes `package-lock.json`; this guide uses npm consistently. Install both backend packages because the API imports the database store.

### 3. Start Supabase and get the database URL

```sh
(cd simple-backend/database-server && supabase start && supabase status)
```

The first start downloads Docker images and may take several minutes. `simple-backend/database-server/supabase/config.toml` already exists: **do not run `supabase init` routinely**. Only if that file is absent, run `(cd simple-backend/database-server && supabase init)` before starting.

Use the actual **Database URL** shown by `supabase status`, not the HTTP API/Studio URL or an API key. The default is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Status output contains keys; keep it private.

### 4. Configure environment files

Copy each example **only if its destination is missing**:

```sh
if [ ! -f simple-backend/database-server/.env ]; then
  cp simple-backend/database-server/.env.example simple-backend/database-server/.env
fi
if [ ! -f simple-backend/backend-server/.env ]; then
  cp simple-backend/backend-server/.env.example simple-backend/backend-server/.env
fi
```

Edit these files in your editor; preserve unrelated existing settings. Use the actual Database URL from step 3 in **both** files.

`simple-backend/database-server/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_SSL=false
NODE_ENV=development
```

`simple-backend/backend-server/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_SSL=false
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
ENABLE_TEST_ROUTES=false
```

Create root `.env.local` only if missing; otherwise edit it without overwriting existing settings:

```dotenv
NEXT_PUBLIC_API_MODE=rest
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

The frontend defaults to mock mode without `NEXT_PUBLIC_API_MODE=rest`. Never put database credentials or secrets in `NEXT_PUBLIC_*` variables. Restart the API/frontend after changing their env files. Local Supabase needs `DATABASE_SSL=false`; hosted connections need verified TLS (`DATABASE_SSL=true`). Unencrypted database connections are rejected in backend production mode.

### 5. Build the backend, migrate and seed

```sh
(cd simple-backend/database-server && npm run build && npm run migrate && npm run seed)
(cd simple-backend/backend-server && npm run build)
```

These application migrations create the `cart_api` schema; `supabase start` does not apply them automatically. Migration/seed read the database package's `.env`. Seed preserves existing accounts, carts, orders and product prices/stock while refreshing original-catalog PNG paths. Referenced legacy products are retained; do not reset the database to update images. Rerun migrations for schema updates and seed only for intentional demo-data updates, not every day.

## Daily startup: three services

Start each terminal at the project root. If Supabase is still running from setup, skip starting it again.

**1. Database (Docker + Supabase)**

```sh
open -a Docker
# Wait for Docker to be ready.
docker info
(cd simple-backend/database-server && supabase start && supabase status)
```

**2. API — separate terminal**

```sh
(cd simple-backend/backend-server && npm run dev)
```

API `dev` does not watch files; restart after edits. For automatic restarts, use `(cd simple-backend/backend-server && npx --no-install tsx watch server.ts)` instead, not alongside it.

**3. Frontend — separate terminal**

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in using a demo account below.

For compiled runs, build **before** starting: root `npm run build` then `npm start` runs Next.js; `(cd simple-backend/backend-server && npm run build && npm start)` runs Express. Rebuild after source changes. Do not set backend `NODE_ENV=production` with the local non-TLS database. Database-package `npm start` runs a migration, not a service.

## Stop

Press **Ctrl+C** in the frontend and API terminals, then from the project root:

```sh
(cd simple-backend/database-server && supabase stop)
```

Normal stop preserves local database data. Do not use `--no-backup` or `supabase db reset` for routine shutdown. Quit Docker Desktop afterward if desired. Next startup does not need a reinstall or reseed.

## Demo accounts and catalog

Development/test only; never seed these known credentials into a public production deployment.

| Username | Password | Role | Tier |
| --- | --- | --- | --- |
| `cus_normal` | `password123` | Customer | normal |
| `cus_prime` | `password123` | Customer | prime |
| `admin01` | `admin123` | Admin | normal |

The original eight products (`p-1`–`p-8`) use PNG images. The lamp starts with **stock 0**, so customers cannot see it; admins see all eight. Shipping weights are estimates. Prices are raw **whole Thai baht** numbers, even where legacy fields are named `priceCents`: `12999` means ฿12,999, not ฿129.99. No currency conversion or tax is added.

| Product | Price (baht) | Initial stock | Estimated weight (g) |
| --- | ---: | ---: | ---: |
| Wireless Headphones | 12999 | 15 | 300 |
| Mechanical Keyboard | 8950 | 8 | 900 |
| Ceramic Coffee Mug | 1499 | 40 | 400 |
| Canvas Backpack | 5900 | 12 | 700 |
| Minimal Desk Lamp | 3995 | 0 | 1200 |
| Running Sneakers | 7499 | 20 | 800 |
| Insulated Water Bottle | 2400 | 30 | 450 |
| Cotton Hoodie | 4999 | 3 | 600 |

Coupon `SAVE10`: 10% discount, minimum 1000 baht. This catalog deliberately replaces SRS section 7's P1–P3 catalog; SRS accounts and business rules remain. Tests use a separate P1–P3 reference fixture. Existing mock data is isolated under a versioned sessionStorage key, not migrated from the older catalog.

## Quick API check (Postman)

1. POST `http://localhost:3001/auth/login`, Body → raw → JSON:
   ```json
   {"username":"cus_normal","password":"password123"}
   ```
2. Expect HTTP 200 with `token`, `role` and `memberTier`. Keep the token in a private local variable; do not share/export it.
3. GET `http://localhost:3001/products`, Authorization → Bearer Token → the returned token. Expect a JSON array of active, in-stock products. Use `admin01` to see all products.
4. Without a token, `/products` returns 401. A wrong password also returns 401. Errors use `{code,message,fields?,productIds?}`; input/business errors are 400, forbidden roles 403, and missing entities 404.

Checkout reserves stock; cancellation restores it; successful payment clears the cart. Payment is simulated, not real processing. Gateway success/fail callbacks are unauthenticated under the SRS boundary: do not expose them publicly without external gateway verification/access control. `NEXT_PUBLIC_TEST_MODE=true` enables frontend test controls only, not backend reset routes; leave it unset outside testing.

## Tests

Run from the project root:

```sh
node --test lib/api/spec.test.cjs
npx tsc --noEmit
(cd simple-backend/database-server && npm test)
(cd simple-backend/backend-server && npm test)
```

Backend `npm test` runs database-free pricing tests and **skips database integration by default**. Integration requires an explicitly supplied `DATABASE_URL` pointing to a migrated, isolated disposable database, plus `NODE_ENV=test`, `ENABLE_TEST_ROUTES=true` and `ISOLATED_TEST_DATABASE=true`. It destructively resets all `cart_api` data and invalidates sessions: never target your normal development, shared or production database.

`POST /test/reset` is unauthenticated and available only with `NODE_ENV=test` and `ENABLE_TEST_ROUTES=true`; otherwise it is 404. The isolation flag guards the integration runner, not route registration. Keep reset-capable servers isolated and test flags off during normal use.

## Troubleshooting

- **Missing package/config/env:** check you are at the project root and use the grouped commands above. Env files load from each package's working directory.
- **Supabase cannot start:** check `docker info`. For port conflicts, inspect `simple-backend/database-server/supabase/config.toml` and other running projects; do not delete/reset data to free a port. After any deliberate port change, read `supabase status` and update both `DATABASE_URL` values.
- **Database connection/TLS error:** use the PostgreSQL Database URL, not port 54321's HTTP URL. Local settings must be `DATABASE_SSL=false` and `NODE_ENV=development`; hosted connections require verified TLS. Do not disable certificate verification.
- **Next.js production build missing:** run root `npm run build` before `npm start`, or use `npm run dev`. API compiled start separately requires its own build.
- **Browser API/CORS error:** confirm API port 3001, frontend REST env values, and exact `CORS_ORIGIN=http://localhost:3000` (scheme, hostname and port must match). Restart both apps after changes. If Next.js selects another port, free 3000 or deliberately update CORS. On another device, `localhost` points to that device, not your Mac.
