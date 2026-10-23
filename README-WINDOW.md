# Windows setup (Command Prompt)

This guide runs the complete application locally on Windows using **CMD**, not PowerShell or Git Bash.

| Component | Local address |
| --- | --- |
| Next.js frontend | http://localhost:3000 |
| Express API | http://localhost:3001 |
| Supabase PostgreSQL | 127.0.0.1:54322 |

`backend/database` contains the database store and management scripts. It is not another HTTP server.

The commands below use this checkout location:

```text
Y:\work\year_IV\testing\project\cart-api-frontend
```

Replace that path if your checkout is elsewhere. CMD's `cd /d` switches both the drive and directory.

## 1. Install prerequisites

Install:

- **Node.js 22 or later**, including npm. Node.js 24 LTS is suitable: https://nodejs.org/
- **Docker Desktop for Windows**: https://www.docker.com/products/docker-desktop/

Complete Docker's setup, including any WSL 2 requirements or Windows restart it requests. Use Linux containers. Open Docker Desktop and wait for its engine to start.

Open a new CMD window and verify:

```cmd
node --version
npm --version
docker info
```

Continue only when `docker info` includes a successful **Server** section. Zero images or containers is normal before the first start. Warnings about unsupported `blkio` throttling or cgroup v1 deprecation alone do not mean Docker failed to start.

This guide runs the Supabase CLI through `npx`; a global Supabase CLI installation is not required. The first invocation downloads the CLI, and the first Supabase start downloads Docker images, so internet access is required.

## 2. Install dependencies

Stop any running frontend or API with **Ctrl+C** before installing.

The frontend declares `pnpm@12.3.4`, but this repository also includes npm lockfiles. This guide follows the main README's npm workflow. Use npm consistently for this workflow rather than alternating package managers.

If the frontend's existing `node_modules` was installed using pnpm, remove that generated directory before switching to npm:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
if exist node_modules rmdir /s /q node_modules
```

Install the frontend dependencies:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
npm install
```

Install both backend packages; the API imports the database store:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npm ci
```

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm ci
```

Check that each command succeeds before continuing. Changes to `package-lock.json` may include npm-generated metadata such as `"peer": true`; do not edit that metadata manually.

## 3. Start Supabase

Keep Docker Desktop running, then run:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npx --yes supabase start
```

The initial image downloads may take several minutes. After startup succeeds:

```cmd
npx --yes supabase status
```

The repository already includes `backend/database/supabase/config.toml`. **Do not run `supabase init` as part of normal setup.**

Find the **Database URL** in the status output. The default documented configuration is:

```text
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Use the actual Database URL shown on your machine if it differs. Do not use the HTTP API URL, Studio URL, or an API key as `DATABASE_URL`.

Status output may contain keys; keep it private.

## 4. Configure environment files

Create or edit the three files below. If a file already exists, preserve unrelated settings and update the relevant values instead of overwriting the entire file.

Create the environment files manually using the settings below.

### Database package

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
notepad .env
```

If prompted to create the file, choose **Yes**. Enter and save:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_SSL=false
NODE_ENV=development
```

Replace `DATABASE_URL` with the actual value from Supabase status if necessary.

### Backend API

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
notepad .env
```

Enter and save:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_SSL=false
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
ENABLE_TEST_ROUTES=false
```

Use the same Database URL in both backend environment files.

Local Supabase uses `DATABASE_SSL=false`. Do not set `NODE_ENV=production` with this local non-TLS connection: the backend rejects unencrypted production connections. Hosted databases require verified TLS; do not disable certificate verification.

### Frontend

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
notepad .env.local
```

Enter and save:

```dotenv
NEXT_PUBLIC_API_MODE=rest
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Without `NEXT_PUBLIC_API_MODE=rest`, the frontend uses its mock adapter rather than the real API.

Do not put database credentials or secrets in `NEXT_PUBLIC_*` variables; these values are exposed to the browser. Leave `NEXT_PUBLIC_TEST_MODE` unset for normal use.

If using Notepad's Save As dialog, select **All files** so the filenames remain `.env` and `.env.local`, not `.env.txt` or `.env.local.txt`.

Restart the frontend or API after changing its environment file. Environment files are loaded relative to each package's working directory, so use the directories shown in this guide.

## 5. Build, migrate, and seed

With Supabase running, run these commands in order. Stop and resolve any error before continuing:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npm run build
npm run migrate
npm run seed
```

Application migrations create the `cart_api` schema. `supabase start` does not apply these application migrations automatically.

Seed preserves existing accounts, carts, orders, and product prices/stock while refreshing original-catalog image paths. Do not reset the database to update images. Rerun migrations when schema updates require them, and seed only for intentional demo-data updates—not every day.

Build the API:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm run build
```

## 6. Start the API

In one CMD window:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm run dev
```

Keep this window open. The API listens on port **3001**.

The API's `dev` script does not watch files. Restart it after edits. For automatic restarts, use this instead of—not alongside—`npm run dev`:

```cmd
npx --no-install tsx watch server.ts
```

## 7. Start the frontend

Open a separate CMD window:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
npm run dev
```

Keep this window open and visit:

```text
http://localhost:3000
```

Use `localhost:3000`, matching the backend's configured CORS origin. If Next.js chooses another port, resolve the port conflict or deliberately update `CORS_ORIGIN` and restart the API. Port **3001** is reserved for the API.

## 8. Sign in

This branch uses **usernames**, not the email-based demo accounts from older versions.

| Username | Password | Role | Tier |
| --- | --- | --- | --- |
| `cus_normal` | `password123` | Customer | normal |
| `cus_prime` | `password123` | Customer | prime |
| `admin01` | `admin123` | Admin | normal |

These credentials are for development/test only. Never seed them into a public production deployment.

The lamp initially has stock 0 and is hidden from customers; admins can see all eight catalog products. Prices are whole Thai baht, even where legacy field names contain `priceCents`. Coupon `SAVE10` gives a 10% discount with a minimum of 1000 baht.

Payment is simulated, not real processing. Do not expose the development API publicly without addressing gateway callback verification and access control described in the main README.

### Optional API check

From another CMD window:

```cmd
curl -i -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d "{\"username\":\"cus_normal\",\"password\":\"password123\"}"
```

Expect HTTP 200 with `token`, `role`, and `memberTier`. Keep the returned token private. Requests to `/products` require a bearer token; an unauthenticated request returning 401 is expected.

## Daily startup

No reinstall or reseed is needed for routine startup.

### 1. Database

Open Docker Desktop, wait for it to be ready, then run:

```cmd
docker info
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npx --yes supabase start
```

If Supabase is already running, you can check it with `npx --yes supabase status` instead.

### 2. API — separate CMD window

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm run dev
```

### 3. Frontend — separate CMD window

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
npm run dev
```

Open http://localhost:3000.

## Stop safely

Press **Ctrl+C** in the API and frontend windows. If CMD asks `Terminate batch job (Y/N)?`, enter `Y`.

Then stop Supabase:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npx --yes supabase stop
```

Normal stop preserves local database data. **Do not use `--no-backup` or `supabase db reset` for routine shutdown.** Quit Docker Desktop afterward if desired.

## Optional compiled runs

For the frontend, build before starting:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
npm run build
npm start
```

For the API, in a separate CMD window:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm run build
npm start
```

Keep Supabase running. Rebuild after source changes. Do not run development and compiled servers on the same ports at the same time. Do not set the API to production mode with the local non-TLS database.

The database package's `npm start` runs a migration, not a persistent service.

## Optional checks

Frontend specification tests and type check:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\frontend
node --test lib/api/spec.test.cjs
npx --no-install tsc --noEmit
```

Database-package tests:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\database
npm test
```

Backend tests:

```cmd
cd /d Y:\work\year_IV\testing\project\cart-api-frontend\backend\api
npm test
```

Backend database integration tests are skipped by default. They require an explicitly configured, migrated, isolated disposable database and test flags. They destructively reset all `cart_api` data and invalidate sessions. **Do not enable them against your normal development, shared, or production database.** See the main README for the integration-test requirements; keep test routes disabled during normal use.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `node` or `npm` is not recognized | Install Node.js with PATH support, then reopen CMD. |
| Docker cannot connect to its server | Open Docker Desktop, complete WSL/setup prompts, and wait until `docker info` succeeds. |
| Supabase cannot start | Check Docker and the reported error. Inspect `supabase/config.toml` for port conflicts; do not delete/reset data to free a port. |
| Database ports were deliberately changed | Run Supabase status and update `DATABASE_URL` in both backend `.env` files. |
| `DATABASE_URL is required` | Check the `.env` filename and run the API from `backend/api`. |
| Database connection or TLS error | Use the PostgreSQL Database URL, not the HTTP URL. Local settings need `DATABASE_SSL=false` and `NODE_ENV=development`. |
| Browser fetch or CORS error | Verify API port 3001, frontend REST variables, and exact `CORS_ORIGIN=http://localhost:3000`. Restart both applications after environment changes. |
| Frontend works but backend receives no requests | Check that `frontend/.env.local` sets `NEXT_PUBLIC_API_MODE=rest`, then restart Next.js. |
| Production build is missing | Run `npm run build` before `npm start` in the relevant package, or use `npm run dev`. |
| Hydration warning mentions `data-darkreader-*`, `bis_register`, or injected attributes | Test in a private window with extensions disabled. Disable Dark Reader or other page-modifying extensions for localhost. Do not hide the warning before ruling out extensions. |

For a failing command, inspect its first relevant error before proceeding. Avoid sharing environment files, full Supabase status output, or authentication tokens when requesting help.
