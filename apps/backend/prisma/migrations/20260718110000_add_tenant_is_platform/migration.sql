-- Additive : marque un tenant comme INTERNE plateforme (staff super-admin SaaS),
-- exclu des listings/quotas/agrégats de la console. Défaut false → aucune boutique
-- cliente existante n'est affectée. Aucune perte de données.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isPlatform" BOOLEAN NOT NULL DEFAULT false;
