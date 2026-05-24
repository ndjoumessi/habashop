-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "planActivatedAt" TIMESTAMP(3),
ADD COLUMN     "planRequestedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "trialEnds" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlanRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "paymentMethod" TEXT NOT NULL,
    "paymentRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "PlanRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
