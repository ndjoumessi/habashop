-- Rejeu hors-ligne honoré (option A) : marque une ligne dont le montant SOUMIS a été
-- facturé tel quel (`offlineReplay` ET `staleCatalogAt` non-null). Sans elle, l'audit ne
-- distingue « honoré » de « re-tarifé » qu'en recomparant des montants — or l'argent a
-- bougé, donc la ligne doit être VÉRIFIABLE.
-- Additive : IF NOT EXISTS + DEFAULT false → aucune ligne existante invalidée.
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "pricingHonored" BOOLEAN NOT NULL DEFAULT false;
