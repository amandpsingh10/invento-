import type { Prisma } from "@parts-inventory-system/database";
import { ApiError } from "../../lib/apiError";

type Tx = Prisma.TransactionClient;

/**
 * Finds (or creates) the Inventory row for a Part+Store+Bin+Rack combination
 * and locks it for the remainder of the transaction with SELECT ... FOR
 * UPDATE, so concurrent purchase/issue/return/adjustment transactions on the
 * same location serialize instead of racing on the quantity column.
 *
 * Must be called inside an interactive prisma.$transaction — the lock is
 * released when that transaction commits or rolls back.
 */
export async function getOrCreateLockedInventory(
  tx: Tx,
  tenantId: string,
  partId: string,
  storeId: string,
  binId: string,
  rackId: string
): Promise<{ id: string; quantity: number }> {
  // Prisma's default (no @map) column names are the exact camelCase field
  // names, which Postgres folds to lowercase unless quoted — every
  // mixed-case identifier below must be double-quoted to match the real
  // column names ("tenantId", not tenantid).
  //
  // quantity is NUMERIC(12,3) in the DB (to support fractional ML/KGS
  // quantities) — the Postgres driver returns NUMERIC as a string by
  // default to avoid float precision loss, so it's cast to float8 here to
  // get a plain JS number back directly. float8's ~15-digit precision is
  // far beyond anything a real inventory quantity needs.
  const existing = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
    SELECT id, quantity::float8 AS quantity FROM inventory
    WHERE "tenantId" = ${tenantId} AND "partId" = ${partId} AND "storeId" = ${storeId}
      AND "binId" = ${binId} AND "rackId" = ${rackId}
    FOR UPDATE
  `;
  if (existing[0]) return existing[0];

  try {
    const created = await tx.inventory.create({
      data: { tenantId, partId, storeId, binId, rackId, quantity: 0 },
    });
    return { id: created.id, quantity: 0 };
  } catch {
    // Lost the race to create — another concurrent transaction created it
    // first. Re-select and lock the now-existing row.
    const retried = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
      SELECT id, quantity::float8 AS quantity FROM inventory
      WHERE "tenantId" = ${tenantId} AND "partId" = ${partId} AND "storeId" = ${storeId}
        AND "binId" = ${binId} AND "rackId" = ${rackId}
      FOR UPDATE
    `;
    if (!retried[0]) throw ApiError.internal("Failed to resolve inventory row");
    return retried[0];
  }
}

/**
 * Applies a signed quantity delta to an already-locked inventory row.
 * Never allows the resulting balance to go negative — this is the single
 * choke point that enforces "available stock must never be negative" for
 * every caller (purchase, issue, return, adjustment).
 */
export async function applyInventoryDelta(
  tx: Tx,
  inventoryId: string,
  currentQuantity: number,
  delta: number
): Promise<number> {
  // Round to the column's 3-decimal precision to avoid binary-float drift
  // (0.1 + 0.2 style errors) accumulating across many fractional ML/KGS
  // transactions on the same inventory row.
  const newQuantity = Math.round((currentQuantity + delta) * 1000) / 1000;
  if (newQuantity < 0) {
    throw ApiError.unprocessable(
      `Insufficient stock. Available quantity: ${currentQuantity}.`,
      "INSUFFICIENT_STOCK"
    );
  }
  await tx.inventory.update({ where: { id: inventoryId }, data: { quantity: newQuantity } });
  return newQuantity;
}
