-- Budgets de dépense persistés par boutique.
--
-- ⚠️ MIGRATION STRICTEMENT ADDITIVE : une table NEUVE, aucune colonne altérée, aucune
-- ligne existante touchée. Vérifié par `prisma migrate diff` contre la base de
-- PRODUCTION avant écriture — la sortie ne contenait que ce CREATE TABLE.
--
-- ⚠️ REJOUABLE (`IF NOT EXISTS` + contrainte gardée). La base de production a déjà reçu
-- des migrations appliquées à la main puis réconciliées par `migrate resolve --applied` :
-- une migration qui échoue au second passage bloque toute la chaîne suivante.

CREATE TABLE IF NOT EXISTS "ExpenseBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseBudget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExpenseBudget_tenantId_idx" ON "ExpenseBudget"("tenantId");

-- UNE ligne par catégorie et par boutique : c'est ce qui rend l'écriture idempotente
-- (`upsert`) et interdit deux budgets concurrents pour la même catégorie.
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseBudget_tenantId_category_key" ON "ExpenseBudget"("tenantId", "category");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseBudget_tenantId_fkey'
  ) THEN
    ALTER TABLE "ExpenseBudget"
      ADD CONSTRAINT "ExpenseBudget_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
