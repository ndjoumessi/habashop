-- Remboursement de vente (TOTAL uniquement) — additif, colonnes nullables / default.
-- Aucune perte de données : les ventes existantes prennent status='completed',
-- les autres colonnes restent NULL. Index partiel-friendly sur (tenantId, status).

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "Sale" ADD COLUMN     "refundedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN     "refundedBy" TEXT;
ALTER TABLE "Sale" ADD COLUMN     "refundReason" TEXT;
ALTER TABLE "Sale" ADD COLUMN     "restocked" BOOLEAN;

-- CreateIndex
CREATE INDEX "Sale_tenantId_status_idx" ON "Sale"("tenantId", "status");
