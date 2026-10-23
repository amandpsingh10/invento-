import type { Prisma, PrismaClient } from "@parts-inventory-system/database";

type TxClient = PrismaClient | Prisma.TransactionClient;

/**
 * Atomically generates the next number in a per-tenant sequence, e.g.
 * PUR-2026-000001, ISS-2026-000001. Must be called within the same
 * transaction as the record it names, so a rollback also rolls back the
 * sequence increment (no gaps survive a failed transaction, though gaps
 * from unrelated rollbacks are otherwise acceptable for this business need).
 */
export async function nextSequenceNumber(
  tx: TxClient,
  tenantId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const sequenceKey = `${prefix}-${year}`;

  const seq = await tx.numberSequence.upsert({
    where: { tenantId_sequenceKey: { tenantId, sequenceKey } },
    update: { lastValue: { increment: 1 } },
    create: { tenantId, sequenceKey, lastValue: 1 },
  });

  return `${sequenceKey}-${String(seq.lastValue).padStart(6, "0")}`;
}
