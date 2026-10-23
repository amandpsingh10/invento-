import type { Request } from "express";
import type { Prisma, PrismaClient } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";

type TxClient = PrismaClient | Prisma.TransactionClient;

interface RecordAuditParams {
  req?: Request;
  tenantId: string | null;
  userId?: string | null;
  userEmail?: string | null;
  role?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function recordAudit(params: RecordAuditParams, tx: TxClient = prisma) {
  await tx.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      role: params.role ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue as any,
      newValue: params.newValue as any,
      ipAddress: params.req?.ip,
      userAgent: params.req?.headers["user-agent"],
    },
  });
}

export async function listAuditLogs(
  tenantId: string,
  filters: { entityType?: string; action?: string; userId?: string; from?: Date; to?: Date },
  page: number,
  pageSize: number
) {
  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { gte: filters.from, lte: filters.to } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
