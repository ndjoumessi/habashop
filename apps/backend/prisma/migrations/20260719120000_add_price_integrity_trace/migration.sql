-- Intégrité prix (ticket) : trace additive d'une divergence prix soumis (client) vs catalogue (serveur).
-- 100% additif + nullable → aucune perte de données, aucune réécriture de lignes existantes.
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "submittedPrice" DOUBLE PRECISION;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "catalogPrice"   DOUBLE PRECISION;
ALTER TABLE "Sale"     ADD COLUMN IF NOT EXISTS "priceDivergence" BOOLEAN DEFAULT false;
