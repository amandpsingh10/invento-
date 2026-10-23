# Database

PostgreSQL via Prisma. Full schema: `database/prisma/schema.prisma`.

## Core tables

| Table | Purpose | Tenant-scoped? |
|---|---|---|
| `tenants` | One row per dealer | — (this *is* the tenant) |
| `plans` / `subscriptions` | SaaS billing plans and a tenant's active subscription | subscriptions: yes |
| `roles` / `permissions` / `role_permissions` | RBAC | platform-level, shared |
| `users` / `user_roles` | Dealer staff (and platform Super Admins, `tenantId = null`) | yes (nullable for Super Admin) |
| `stores` / `bins` / `racks` | Location masters. Bin/Rack both reference Store directly (not nested under each other), matching the "Bin and Rack independently associated with Store" option from the spec | yes |
| `parts` | Part master (pricing, tax, HSN, reorder threshold) | yes |
| `inventory` | Current quantity per Part+Store+Bin+Rack combination — the row every stock mutation locks and updates | yes |
| `purchases` / `purchase_items` | One `Purchase` per unique Invoice No within an Excel import; items reference `inventory` directly | yes |
| `issues` / `issue_items` | Part issue transactions; `issue_items.returnedQty` tracks cumulative returns against that line | yes |
| `returns` / `return_items` | Part returns, always referencing the originating `issue_items` row | yes |
| `stock_ledger` | Append-only movement log — the source of truth for `AVAILABLE STOCK = OPENING + PURCHASE + RETURN + ADJUSTMENT - ISSUE` | yes |
| `stock_adjustments` | Authorized physical-count corrections | yes |
| `audit_logs` | Who did what, when, from where | yes (nullable for platform-level actions) |
| `uploaded_files` | Metadata for Excel uploads / generated reports (actual bytes live in object storage) | yes |
| `notifications` | In-app notification bell feed | yes |
| `number_sequences` | Per-tenant, per-prefix atomic counters backing `PUR-2026-000001` style numbers | yes |

## Key unique constraints

- `tenants.dealerCode` — globally unique
- `parts (tenantId, partNo)`
- `stores (tenantId, code)`
- `bins (tenantId, storeId, code)`
- `racks (tenantId, storeId, code)`
- `inventory (tenantId, partId, storeId, binId, rackId)` — this is what makes "same Part+Store+Bin+Rack increases quantity, different location creates a separate row" work: purchase import always `upsert`s against this key
- `users (tenantId, email)` — same email can exist across different dealers, never twice within one
- `purchases (tenantId, purchaseNumber)`, `issues (tenantId, issueNumber)`, `returns (tenantId, returnNumber)`, `stock_adjustments (tenantId, adjustmentNumber)`

## Indexes

Every tenant-scoped table indexes `tenantId` at minimum; hot lookup paths add compound indexes: `inventory (tenantId, partId)`, `stock_ledger (tenantId, partId)`, `stock_ledger (tenantId, transactionNumber)`, `stock_ledger (tenantId, createdAt)`, `purchases (tenantId, invoiceNumber)`, `audit_logs (tenantId, entityType)`, `audit_logs (tenantId, createdAt)`.

## Migrations

Prisma migrations live in `database/prisma/migrations/` once generated. This repo ships the schema but not a checked-in migration history (none has been generated in this environment — no `prisma` CLI database connection was available here). On first run:

```bash
npm run db:migrate -w database   # dev: creates + applies a migration, prompts for a name
npm run db:deploy -w database    # production: applies existing migrations, no prompts, no schema drift check bypass
```

`prisma migrate deploy` is the production-safe command — it never generates new migrations or resets data, it only applies what's already committed to `migrations/`.

## Seed data

`database/prisma/seed.ts` creates: 4 subscription plans, all 5 roles with their permission sets, a platform Super Admin, one demo tenant (`DEMO001`) with 3 users (one per non-Viewer role), a store with 2 bins/2 racks, 5 demo parts, and a full purchase → issue → return cycle for `BRK-PAD-001` matching the worked example in the spec (purchase 10 → issue 3 → return 1 → balance 8), plus extra stock rows tuned to demonstrate low-stock and out-of-stock states on the dashboard immediately after install.
