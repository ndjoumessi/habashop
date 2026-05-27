-- Suppression de compte in-app (conformité Google Play / RGPD)
-- Ajout du soft-delete (deletedAt) sur Tenant, User, Employee.
-- Customer et Supplier l'ont déjà (migration 20260525150000_add_soft_delete).
-- NON DESTRUCTIF : colonnes nullables (lignes existantes => NULL = actif), + index.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Tenant_deletedAt_idx" ON "Tenant"("deletedAt");

-- CreateIndex
CREATE INDEX "User_tenantId_deletedAt_idx" ON "User"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "Employee_tenantId_deletedAt_idx" ON "Employee"("tenantId", "deletedAt");
