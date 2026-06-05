-- Fidélité configurable par tenant. Additif : 3 colonnes avec DEFAULT = valeurs v1.
-- Les tenants existants prennent automatiquement 1000/2000/5000 → comportement
-- inchangé (non-rétroactif). Aucune donnée touchée. Démo/prod intactes.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "pointsPerAmount" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "Tenant" ADD COLUMN "bronzeThreshold" INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE "Tenant" ADD COLUMN "silverThreshold" INTEGER NOT NULL DEFAULT 5000;
