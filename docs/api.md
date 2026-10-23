# API

Base URL: `{API_URL}/api` (default `http://localhost:4000/api`). Interactive docs (Swagger UI) at `GET /api/docs`, raw OpenAPI JSON at `GET /api/docs.json`.

## Conventions

- All responses: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message", "details?" } }`.
- Auth: `Authorization: Bearer <accessToken>` header. The refresh token lives in an httpOnly cookie (`parts_inventory_refresh_token`, scoped to `/api/auth`) — never read or stored in JS.
- Pagination: list endpoints accept `page` (default 1) and `pageSize` (default 25, capped per-endpoint) and return `{ items, total, page, pageSize, totalPages }`.
- Every tenant-scoped endpoint requires both `requireAuth` and `requireTenant` — a Super Admin token (no tenant) gets `403 TENANT_REQUIRED` from these routes and must use `/api/admin/*` instead.

## Auth — `/api/auth`

| Method | Path | Notes |
|---|---|---|
| POST | `/login` | Body: `dealerCode, email, password, rememberMe?`. Dealer code `SUPERADMIN` routes to the platform login path. |
| POST | `/refresh` | Reads the refresh cookie, rotates it, returns a new access token. |
| POST | `/logout` | Revokes the stored refresh token hash. |
| GET | `/me` | Current user + tenant. |
| POST | `/forgot-password` | Always returns the same message regardless of whether the account exists. |
| POST | `/reset-password` | Body: `token, newPassword`. |

## Masters

`GET/POST /api/parts`, `GET/PUT /api/parts/:id`, and the same shape for `/api/stores`, `/api/bins`, `/api/racks`. Bins/Racks accept `?storeId=` to filter.

## Inventory — `/api/inventory`

`GET /` — current stock, filters: `search, storeId, binId, rackId, status (IN_STOCK|LOW_STOCK|OUT_OF_STOCK)`.
`GET /:id` — one inventory row (part+location).
`GET /:id/history` — that row's stock ledger entries.

## Purchases — `/api/purchases`

| Method | Path | Notes |
|---|---|---|
| GET | `/template` | Downloads the Excel upload template (.xlsx). |
| POST | `/upload` | `multipart/form-data`, field `file`. Validates every row, stores the file, returns a preview — **does not** write to inventory. |
| GET | `/upload/:uploadedFileId/error-report` | Downloads an .xlsx of only the invalid rows with an Error column. |
| POST | `/import` | Body: `{ uploadedFileId }`. Re-validates against current master data, imports every valid row inside one transaction per invoice number, updates inventory, writes ledger entries. |
| GET | `/`, `/:id` | List / detail. |

## Issues — `/api/issues`

`POST /` body: `{ inventoryId, quantity, reference?, remarks? }`. Rejects with `422 OUT_OF_STOCK` or `422 INSUFFICIENT_STOCK` as appropriate. `GET /`, `GET /:id`.

## Returns — `/api/returns`

`GET /lookup/:issueNumber` — returns the issue with per-line `remainingReturnableQty`. `POST /` body: `{ issueItemId, quantity, remarks? }`, rejects with `422 OVER_RETURN` if `quantity` exceeds what's left returnable. `GET /`, `GET /:id`.

## Adjustments — `/api/adjustments`

`POST /` body: `{ inventoryId, physicalQuantity, reasonType, remarks? }`. Server computes `difference` from the current system quantity; `reasonType` is one of `DAMAGE|THEFT|COUNT_CORRECTION|EXPIRY|OTHER`.

## Stock Ledger — `/api/stock-ledger`

`GET /` — filters: `partId, storeId, transactionType, invoiceNumber, transactionNumber, from, to, search`.

## Reports — `/api/reports`

`GET /stock`, `/issues`, `/returns`, `/transactions` — all accept `from`/`to` and support `?export=excel` to download an `.xlsx` instead of JSON.

## Dashboard — `GET /api/dashboard`

Cards, a 14-day stock-movement series, top issued parts, low-stock parts, and recent transactions — all computed from the ledger and current inventory, nothing hardcoded.

## Users — `/api/users` (Tenant Admin only)

Standard CRUD (`DELETE` deactivates rather than hard-deletes) plus role assignment.

## Admin (platform) — `/api/admin` (Super Admin only, no tenant)

`GET /dashboard`, `GET /plans`, `GET/POST /tenants`, `GET/PUT /tenants/:id`, `PUT /tenants/:id/activate`, `PUT /tenants/:id/deactivate`. Creating a tenant also creates its first `TENANT_ADMIN` user in the same transaction.

## Error codes worth knowing

`INVALID_CREDENTIALS`, `TENANT_INACTIVE`, `TENANT_REQUIRED`, `INSUFFICIENT_STOCK`, `OUT_OF_STOCK`, `OVER_RETURN`, `DUPLICATE_PART_NO`, `DUPLICATE_STORE_CODE`, `DUPLICATE_BIN_CODE`, `DUPLICATE_RACK_CODE`, `DUPLICATE_DEALER_CODE`, `INVALID_FILE_TYPE`, `EXCEL_PARSE_ERROR`, `NO_VALID_ROWS`, `RATE_LIMITED`, `VALIDATION_ERROR`.
