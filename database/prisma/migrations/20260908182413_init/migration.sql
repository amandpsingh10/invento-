-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'INVENTORY_MANAGER', 'STORE_USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('PURCHASE', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('ISSUED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdjustmentReasonType" AS ENUM ('DAMAGE', 'THEFT', 'COUNT_CORRECTION', 'EXPIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PURCHASE_SUCCESS', 'PURCHASE_FAILED', 'LOW_STOCK', 'OUT_OF_STOCK', 'ISSUE_SUCCESS', 'RETURN_SUCCESS', 'ADJUSTMENT_SUCCESS', 'PASSWORD_RESET', 'USER_CREATED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxStores" INTEGER NOT NULL DEFAULT 1,
    "maxParts" INTEGER NOT NULL DEFAULT 500,
    "maxMonthlyTxns" INTEGER NOT NULL DEFAULT 1000,
    "maxExcelUploadRows" INTEGER NOT NULL DEFAULT 1000,
    "maxStorageMb" INTEGER NOT NULL DEFAULT 500,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "trialStartsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hsnCode" TEXT,
    "mrp" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ndp" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimumStockLevel" INTEGER NOT NULL DEFAULT 0,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'IMPORTED',
    "uploadedFileId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mrp" DECIMAL(12,2) NOT NULL,
    "ndp" DECIMAL(12,2) NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'ISSUED',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_items" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returnedQty" INTEGER NOT NULL DEFAULT 0,
    "mrp" DECIMAL(12,2) NOT NULL,
    "ndp" DECIMAL(12,2) NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "issue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "issueItemId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "transactionType" "StockTxnType" NOT NULL,
    "partId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "quantityChange" INTEGER NOT NULL,
    "balanceQuantity" INTEGER NOT NULL,
    "reference" TEXT,
    "purchaseId" TEXT,
    "issueId" TEXT,
    "returnId" TEXT,
    "adjustmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "systemQuantity" INTEGER NOT NULL,
    "physicalQuantity" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "reasonType" "AdjustmentReasonType" NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sequenceKey" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_dealerCode_key" ON "tenants"("dealerCode");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "stores_tenantId_idx" ON "stores"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_tenantId_code_key" ON "stores"("tenantId", "code");

-- CreateIndex
CREATE INDEX "bins_tenantId_idx" ON "bins"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "bins_tenantId_storeId_code_key" ON "bins"("tenantId", "storeId", "code");

-- CreateIndex
CREATE INDEX "racks_tenantId_idx" ON "racks"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "racks_tenantId_storeId_code_key" ON "racks"("tenantId", "storeId", "code");

-- CreateIndex
CREATE INDEX "parts_tenantId_idx" ON "parts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "parts_tenantId_partNo_key" ON "parts"("tenantId", "partNo");

-- CreateIndex
CREATE INDEX "inventory_tenantId_idx" ON "inventory"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_tenantId_partId_idx" ON "inventory"("tenantId", "partId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_tenantId_partId_storeId_binId_rackId_key" ON "inventory"("tenantId", "partId", "storeId", "binId", "rackId");

-- CreateIndex
CREATE INDEX "purchases_tenantId_idx" ON "purchases"("tenantId");

-- CreateIndex
CREATE INDEX "purchases_tenantId_invoiceNumber_idx" ON "purchases"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_tenantId_purchaseNumber_key" ON "purchases"("tenantId", "purchaseNumber");

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "issues_tenantId_idx" ON "issues"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "issues_tenantId_issueNumber_key" ON "issues"("tenantId", "issueNumber");

-- CreateIndex
CREATE INDEX "issue_items_issueId_idx" ON "issue_items"("issueId");

-- CreateIndex
CREATE INDEX "returns_tenantId_idx" ON "returns"("tenantId");

-- CreateIndex
CREATE INDEX "returns_issueId_idx" ON "returns"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "returns_tenantId_returnNumber_key" ON "returns"("tenantId", "returnNumber");

-- CreateIndex
CREATE INDEX "return_items_returnId_idx" ON "return_items"("returnId");

-- CreateIndex
CREATE INDEX "stock_ledger_tenantId_idx" ON "stock_ledger"("tenantId");

-- CreateIndex
CREATE INDEX "stock_ledger_tenantId_partId_idx" ON "stock_ledger"("tenantId", "partId");

-- CreateIndex
CREATE INDEX "stock_ledger_tenantId_transactionNumber_idx" ON "stock_ledger"("tenantId", "transactionNumber");

-- CreateIndex
CREATE INDEX "stock_ledger_tenantId_createdAt_idx" ON "stock_ledger"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_adjustments_tenantId_idx" ON "stock_adjustments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_tenantId_adjustmentNumber_key" ON "stock_adjustments"("tenantId", "adjustmentNumber");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_idx" ON "audit_logs"("tenantId", "entityType");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "uploaded_files_tenantId_idx" ON "uploaded_files"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_idx" ON "notifications"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_isRead_idx" ON "notifications"("tenantId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_tenantId_sequenceKey_key" ON "number_sequences"("tenantId", "sequenceKey");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_binId_fkey" FOREIGN KEY ("binId") REFERENCES "bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_issueItemId_fkey" FOREIGN KEY ("issueItemId") REFERENCES "issue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
