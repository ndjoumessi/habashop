-- Idempotence création de vente. Additif : colonne nullable + index unique composite.
-- Postgres traite les NULL comme distincts dans un index unique → les ventes existantes
-- (idempotencyKey NULL) ne violent PAS la contrainte. Démo/prod intactes.

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_idempotencyKey_key" ON "Sale"("tenantId", "idempotencyKey");
