-- Facture PDF : numéro de facture attribué à la 1ʳᵉ demande puis figé.
-- Additif (colonne nullable + index unique composite). NULL distincts en Postgres →
-- les ventes existantes (invoiceNumber NULL) ne violent pas l'unicité. Démo/prod intactes.

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "invoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_invoiceNumber_key" ON "Sale"("tenantId", "invoiceNumber");
