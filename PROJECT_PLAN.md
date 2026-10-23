# PARTS INVENTORY SYSTEM — Dealer Part Inventory Management SaaS

Subtitle: Dealer Part Inventory Management System
Tagline: Smart Inventory. Better Control.

## Architecture

```
React Frontend (Vite/TS/Tailwind)
        |
    REST API (Express/TS)
        |
  Business Service Layer (services/repositories)
        |
    PostgreSQL (Prisma ORM)
        |
   S3 / Object Storage (uploaded Excel, reports)
```

Monorepo (npm workspaces):

```
/frontend         React + TS + Vite SPA
/backend          Express + TS REST API
/database         Prisma schema, migrations, seed (published as @parts-inventory-system/database, consumed by backend)
/infrastructure   Docker, AWS deployment notes
/docs             architecture, database, api, deployment, excel-import docs
```

## Multi-tenancy

- Every business table carries `tenantId`.
- `tenantId` is NEVER read from the request body/query — it is derived server-side from the authenticated JWT (`req.user.tenantId`) inside `backend/src/middleware/tenant.middleware.ts`, and all Prisma repository calls take a mandatory `tenantId` parameter that is spliced into the `where` clause. There is no code path that lets a client supply `tenantId` directly.

## Environment note

This dev container has Node v22 / npm 10 but **no `git` or `docker` CLI on PATH**. All git-related and Docker-related files are still authored correctly (Dockerfiles, docker-compose.yml, .gitignore, GitHub Actions) so the project is ready to `git init` / `docker compose up` wherever those tools exist. I cannot execute `docker build` or `git commit` in this environment — noting this rather than silently skipping it.

## Phase status

| Phase | Description | Status |
|---|---|---|
| 1 | Architecture & folder structure | Done |
| 2 | PostgreSQL + Prisma schema | Done — `prisma generate` verified against the schema |
| 3 | Auth + RBAC | Done |
| 4 | Tenant/Dealer management | Done (Super Admin `/api/admin/tenants`) |
| 5 | Part/Store/Bin/Rack masters | Done |
| 6 | Excel upload & validation | Done |
| 7 | Purchase transaction + inventory update | Done |
| 8 | Current Stock | Done |
| 9 | Issue workflow | Done |
| 10 | Return workflow | Done |
| 11 | Stock Ledger | Done |
| 12 | Stock Adjustment | Done |
| 13 | Dashboard | Done |
| 14 | Reports + Excel export | Done |
| 15 | Audit Logs | Done |
| 16 | SaaS Super Admin | Done |
| 17 | Subscription-ready architecture | Done (Plan/Subscription tables + limits; no payment webhook — see README) |
| 18 | Security hardening | Done (see README "Multi-tenancy & security model") |
| 19 | Automated tests | Done — 22 backend unit/integration tests + 4 frontend unit tests pass; Playwright e2e specs written (not run — no browser/live stack in this environment) |
| 20 | Docker & cloud deployment | Config written (Dockerfiles, docker-compose.yml); not executed here — no Docker CLI in this environment |
| 21 | CI/CD | Done — `.github/workflows/ci.yml` |

## Verified in this environment

`npm install`, `prisma generate`, `tsc` (database + backend + frontend, including Vite production build), `npm run test` (backend: 22/22 passing; frontend: 4/4 passing), and `npm run lint` (0 errors, a handful of harmless warnings) all ran successfully against the actual codebase. **Not** verified here (no Docker/PostgreSQL/git CLI available in this sandbox): `docker compose up`, live Prisma migrations against a real database, the seeded demo data actually loading, or the app running in a browser. Run `docker compose up --build` (or a local Postgres + `npm run db:migrate && npm run db:seed && npm run dev`) to see it live.
