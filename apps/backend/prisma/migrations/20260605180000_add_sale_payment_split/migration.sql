-- Paiement mixte (split) : ventilation du total d'une vente par mode de paiement.
-- Additif (3 colonnes nullables). Ventes existantes → NULL (fallback paymentMode
-- via COALESCE dans le Ticket Z). Aucune perte de données.

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "cashAmount" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "mobileMoneyAmount" DOUBLE PRECISION;
ALTER TABLE "Sale" ADD COLUMN "cardAmount" DOUBLE PRECISION;
