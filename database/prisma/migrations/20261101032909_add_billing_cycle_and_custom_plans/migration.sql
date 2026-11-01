-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- Cast the existing enum column to text in place (preserves every row's
-- current value — TRIAL/BASIC/PRO/ENTERPRISE — and the plans_code_key
-- unique index, unlike Prisma's own auto-generated DROP+ADD COLUMN diff,
-- which would have wiped every plan's code).
ALTER TABLE "plans" ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;

-- DropEnum
DROP TYPE "PlanCode";
