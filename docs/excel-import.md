# Excel Purchase Import

## Template

`GET /api/purchases/template` (or the "Download Template" button on Upload Purchase) returns an `.xlsx` with these columns, in order:

| Column | Required | Rule |
|---|---|---|
| Invoice No | Yes | Non-empty |
| Part No | Yes | Non-empty. Created automatically if it doesn't exist yet for this tenant; updated (description/tax/HSN/MRP/NDP) if it does |
| Part Description | Yes | Non-empty |
| Tax % | Yes | Numeric, 0–100 |
| HSN Code | Yes | Non-empty |
| MRP | Yes | Numeric, ≥ 0 |
| NDP (Without Tax) | Yes | Numeric, ≥ 0 |
| Quantity | Yes | Numeric, > 0 |
| Store | Yes | Must match an existing, active Store (by code or name) for this tenant |
| Bin | Yes | Must match an existing, active Bin under that Store |
| Rack | Yes | Must match an existing, active Rack under that Store |

## Flow

```
Download Template → Upload Excel → Parse & validate every row → Preview (valid vs invalid, per-row errors)
    → user reviews → Import Valid Rows → group rows by Invoice No → one Purchase per invoice, in one DB
    transaction → inventory upserted (existing location: quantity += qty; new location: new row created)
    → StockLedger PURCHASE entries written → success
```

- Parsing: `backend/src/modules/purchases/purchases.excel.ts`, using `exceljs`. Only cached cell *values* are read — formulas and macros are never evaluated.
- Validation: `backend/src/modules/purchases/purchases.validation.ts`. Field-level rules (`validateRowFields`, DB-free, unit tested) run first; Store/Bin/Rack existence checks run against live tenant master data second.
- Preview never writes to the database beyond storing the uploaded file (for the following Import step) — inventory is untouched until `/api/purchases/import` is called.
- Import re-validates against current master data (not the stale preview) before writing, so a Store deleted between preview and import is caught rather than silently imported.
- Only rows that pass validation are imported; the rest are downloadable as an error report (`GET /api/purchases/upload/:uploadedFileId/error-report`) with an added `Error` column listing every reason that row was rejected.

## Duplicate inventory handling

Uniqueness is `tenantId + partId + storeId + binId + rackId`. Importing more stock for a combination that already exists **increments** that row's quantity (inside the same locked transaction other stock mutations use — see `docs/architecture.md`); a different Store/Bin/Rack for the same part creates a separate `Inventory` row. This is enforced at the database level via a unique constraint, not just application logic.

## Security

- Extension allowlist (`.xlsx`, `.xls`) and MIME-type check, enforced by `multer` fileFilter (`backend/src/middleware/upload.middleware.ts`) before the file is even buffered.
- Size limit: `MAX_UPLOAD_SIZE_MB` (default 10 MB).
- Row limit: `MAX_EXCEL_ROWS` (default 5,000) — the upload is rejected outright if exceeded, before any row is validated.
- Files are stored via the `StorageDriver` interface (`backend/src/lib/storage.ts`) — local disk in dev, S3-ready in production — never executed, never served back as anything but a byte stream for re-parsing.
