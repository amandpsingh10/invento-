# PARTS INVENTORY SYSTEM

**Dealer Part Inventory Management System**
*Smart Inventory. Better Control.*

PARTS INVENTORY SYSTEM is a multi-tenant SaaS application for automobile dealers to manage spare-parts inventory: purchase intake via Excel, real-time stock, part issue/return, an immutable stock ledger, stock adjustments, reporting, and a platform-level Super Admin area for onboarding dealers.

This is a real, working full-stack application — React frontend, Express/TypeScript REST API, PostgreSQL via Prisma — not a static prototype. Every screen is backed by the database through the API; nothing is mocked.

## Architecture

```
React (Vite/TS/Tailwind)  →  REST API (Express/TS)  →  Service Layer  →  PostgreSQL (Prisma)
                                                                       →  Object storage (S3-ready)
```

See [docs/architecture.md](docs/architecture.md) for the full breakdown, [docs/database.md](docs/database.md) for the schema, [docs/api.md](docs/api.md) for the REST surface, [docs/excel-import.md](docs/excel-import.md) for the purchase upload flow, and [docs/deployment.md](docs/deployment.md) for cloud deployment.

## Project structure

```
/frontend         React + TypeScript + Vite SPA
/backend          Express + TypeScript REST API
/database         Prisma schema, migrations, seed data (@parts-inventory-system/database)
/infrastructure   AWS deployment notes
/e2e              Playwright end-to-end tests
/docs             Architecture, database, API, deployment, Excel-import docs
```

## Prerequisites

- Node.js 20+
- Docker Desktop (for the one-command local stack) — **or** a local PostgreSQL 16 instance if you'd rather run services natively
- npm 10+

## Quick start (Docker — recommended)

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL, runs migrations + seed data, and starts the backend (`:4000`) and frontend (`:8080`, proxying `/api` to the backend). Open http://localhost:8080.

## Quick start (local Node, no Docker)

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your local Postgres
npm run db:generate
npm run db:migrate            # applies migrations, prompts for a migration name on first run
npm run db:seed
npm run dev                   # runs backend (:4000) and frontend (:5173) together
```

## Demo credentials (seeded)

| Role | Dealer Code | Email | Password |
|---|---|---|---|
| Super Admin | `SUPERADMIN` | `superadmin@parts_inventory.app` | `SuperAdmin@1234` |
| Tenant Admin | `DEMO001` | `admin@demo.com` | `Demo@1234` |
| Inventory Manager | `DEMO001` | `inventory@demo.com` | `Demo@1234` |
| Store User | `DEMO001` | `store@demo.com` | `Demo@1234` |

(Passwords are set by `SUPER_ADMIN_PASSWORD` / the seed script — override via `.env` before seeding in any shared environment.)

## Scripts (from repo root)

```bash
npm run dev          # backend + frontend concurrently
npm run build         # build all workspaces
npm run lint          # lint backend + frontend
npm run test          # unit + integration tests, backend + frontend
npm run db:generate    # regenerate the Prisma client
npm run db:migrate      # create/apply a dev migration
npm run db:deploy       # apply migrations in production (no prompts)
npm run db:seed         # (re)seed demo data
```

Backend API docs (Swagger UI) are served at `http://localhost:4000/api/docs` once the backend is running.

## Multi-tenancy & security model

- Every dealer-scoped table carries `tenantId`. The backend derives `tenantId` **exclusively** from the authenticated user's signed JWT (`backend/src/middleware/tenant.middleware.ts`) — it is never accepted from the request body, query string, or path.
- RBAC is enforced per-route via `requireRole(...)` (`backend/src/middleware/rbac.middleware.ts`), backed by seeded `Role`/`Permission`/`RolePermission` tables.
- Stock mutations (purchase, issue, return, adjustment) run inside a Postgres transaction that row-locks the `Inventory` record with `SELECT ... FOR UPDATE` before mutating it (`backend/src/modules/inventory/inventory.mutations.ts`), so concurrent requests against the same Part+Store+Bin+Rack serialize instead of racing, and the balance can never go negative.
- The stock ledger (`stock_ledger` table) is append-only — no route ever updates or deletes a ledger row. Corrections are new transactions.
- Passwords are hashed with bcrypt; JWT access tokens are short-lived (15 min default) and refreshed via an httpOnly, `SameSite=Lax` cookie scoped to `/api/auth`, with rotation and reuse detection.
- Uploaded Excel files are validated by extension + MIME type, size-capped, row-capped, and parsed with ExcelJS, which never executes formulas or macros.

## What's implemented vs. scaffolded

Implemented end-to-end (real DB + API + UI, no mocks): auth (login/refresh/logout/forgot-reset password), RBAC, tenant isolation, Part/Store/Bin/Rack masters, Excel purchase upload → validate → preview → import with duplicate-location stock merging, current stock, part issue with over-issue/out-of-stock guards, part return with over-return guards, immutable stock ledger, stock adjustments, dashboard (cards/charts/recent activity), 4 reports with Excel export, audit log, notifications, Super Admin dealer management, subscription plan scaffolding, Docker, CI pipeline, unit + integration + e2e test scaffolding.

Intentionally left as documented extension points (see comments at the referenced files): S3 storage driver (`backend/src/lib/storage.ts` — local disk driver ships by default, interface is S3-ready), payment provider integration (Stripe/Razorpay — plan/subscription tables exist, no billing webhook), transactional email delivery for password reset (logged server-side instead of sent, since no email provider is configured).
