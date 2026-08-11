-- Photo de produit : une COLONNE NULLABLE AJOUTÉE, rien d'autre.
--
-- ⚠️ MIGRATION STRICTEMENT ADDITIVE. `ADD COLUMN` nullable sans défaut ne réécrit aucune
-- ligne (PostgreSQL ≥ 11 : ajout de métadonnée, pas de rewrite de table) et ne peut pas
-- perdre de donnée. Les 36 produits de production (comptés, tous tenants) restent inchangés, `image` à NULL.
--
-- ⚠️ REJOUABLE (`IF NOT EXISTS`). La base de production a déjà reçu des migrations
-- appliquées à la main puis réconciliées par `migrate resolve --applied` : une migration
-- qui échoue au second passage bloquerait toute la chaîne suivante.
--
-- ⚠️ LA COLONNE PORTE UNE URL, JAMAIS DES DONNÉES. `GET /api/products` est relu à CHAQUE
-- ouverture de caisse (la règle SW `products-cache` a été supprimée) ET persisté dans
-- AsyncStorage côté mobile pour le POS hors ligne. MESURÉ le 2026-08-11 : 600 produits
-- avec des photos base64 de 256 px pèseraient 16,4 Mo par réponse, 98 Mo à 800 px — sur
-- des connexions ouest-africaines, à chaque ouverture de caisse.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "image" TEXT;
