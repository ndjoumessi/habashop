-- Démos jetables en libre-service : échéance de suppression.
-- Additive, sans perte : colonne nullable, sans défaut.
-- ⚠️ `IF NOT EXISTS` — la base de PROD a reçu ce delta par `prisma db push` avant que la
-- migration ne soit enregistrée (convention du dépôt pour les ajouts sans perte).
-- ⚠️ Index NON partiel, délibérément : Prisma ne sait pas exprimer un index partiel, et un
-- index écrit à la main que le schéma ne décrit pas produirait une dérive PERMANENTE entre
-- `schema.prisma` et la base — dérive qui masquerait ensuite toute dérive réelle.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Tenant_demoExpiresAt_idx" ON "Tenant"("demoExpiresAt");
