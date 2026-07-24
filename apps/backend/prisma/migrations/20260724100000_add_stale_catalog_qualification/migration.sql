-- Chantier B (fraîcheur du cache POS) : QUALIFICATION d'une divergence de prix.
-- Permet au serveur de distinguer « catalogue POS périmé » (prix qui ÉTAIT un tarif légitime
-- jusqu'au dernier changement, assez récemment pour qu'un cache l'explique) d'un prix FORGÉ,
-- au lieu de les présenter à l'identique dans l'écran d'audit ADMIN.
-- 100% additif + nullable → aucune perte de données, aucune réécriture de lignes existantes.
-- Rétro-compat : les produits jamais re-tarifés restent à NULL → divergence « non qualifiée »,
-- c'est-à-dire exactement le comportement historique. Aucune vente passée n'est réinterprétée.
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "previousPricing"  JSONB;
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "pricingChangedAt" TIMESTAMP(3);
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "staleCatalogAt"   TIMESTAMP(3);
