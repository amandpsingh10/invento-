# Architecture

## Layered request flow

```
React Frontend (Vite/TS/Tailwind, TanStack Query)
        |  fetch/axios, Bearer JWT + httpOnly refresh cookie
        v
REST API (Express/TS) — routes/*.routes.ts
        |  requireAuth -> requireTenant -> requireRole -> zod validation
        v
Service layer — modules/*/*.service.ts (business rules, transactions)
        |  Prisma Client
        v
PostgreSQL (via Prisma) — every dealer-scoped row carries tenantId
        |
        v
Object storage (local disk in dev, S3-ready interface) for uploaded Excel files
```

Each module under `backend/src/modules/<name>/` follows the same three-file shape:

- `*.schema.ts` — Zod input validation (never trust client input)
- `*.service.ts` — business logic, Prisma calls, transactions; takes `tenantId` as an explicit parameter (never reads it from anywhere but the argument the route passed in)
- `*.routes.ts` — Express router: auth/tenant/role middleware, schema parsing, calls the service, shapes the HTTP response

## Multi-tenancy

`tenantId` enters the system in exactly one place: `backend/src/middleware/auth.middleware.ts` decodes the JWT and sets `req.user.tenantId`. `requireTenant` / `requireTenantId` (`backend/src/middleware/tenant.middleware.ts`) are the only sanctioned way a route reads it. Every Prisma query in every service threads that value into its `where` clause. There is no code path where a client-supplied `tenantId` reaches a query — request bodies for tenant-scoped resources don't even have a `tenantId` field in their Zod schemas.

`SUPER_ADMIN` users have `tenantId = null` and operate through a disjoint route tree (`/api/admin/*`), gated by `requireRole("SUPER_ADMIN")` — they cannot read or write dealer data through the normal tenant-scoped routes, because `requireTenant` rejects a null tenant.

## Stock consistency

All four stock-changing flows (purchase import, issue, return, adjustment) share `backend/src/modules/inventory/inventory.mutations.ts`:

- `getOrCreateLockedInventory` — finds (or creates) the `Inventory` row for a Part+Store+Bin+Rack combination and takes a `SELECT ... FOR UPDATE` row lock inside the caller's transaction, so concurrent mutations against the same location serialize.
- `applyInventoryDelta` — applies a signed delta to the locked row and throws `INSUFFICIENT_STOCK` (422) if the result would go negative. This is the single choke point enforcing "available stock never goes negative," used by every caller.

Every mutation also writes a `StockLedger` row inside the same transaction, so the ledger and the `Inventory.quantity` column can never drift — either both commit or neither does.

## Frontend structure

```
frontend/src/
  components/ui/       Hand-built primitives (Button, Input, Card, Dialog, Toast, Badge, Pagination...)
  components/layout/    Sidebar/Topbar/DashboardLayout, SuperAdminLayout, nav config
  features/<domain>/    One folder per business area (auth, dashboard, inventory, purchases, issues,
                         returns, adjustments, reports, admin-tenant, super-admin, settings)
  lib/                  apiClient (axios + refresh interceptor), utils
  types/                Shared TS interfaces mirroring API DTOs
```

State: TanStack Query owns all server state (no Redux/global client store) — every list/detail page is a `useQuery`, every mutation a `useMutation` that invalidates the relevant query keys. Auth session (current user/tenant/access token) lives in `AuthContext`, backed by the same axios instance the rest of the app uses.

## Why Express (not NestJS)

The spec allowed either. Express was chosen for a smaller dependency surface and because the module shape above (schema/service/routes) already gives the same separation of concerns NestJS's modules would enforce, without the additional DI/decorator machinery — reasonable for a single-service REST API. Nothing here precludes a future move to NestJS if the API surface grows enough to want it.
