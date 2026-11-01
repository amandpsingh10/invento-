-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "reissuedFromInvoiceId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_reissuedFromInvoiceId_idx" ON "invoices"("reissuedFromInvoiceId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reissuedFromInvoiceId_fkey" FOREIGN KEY ("reissuedFromInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
