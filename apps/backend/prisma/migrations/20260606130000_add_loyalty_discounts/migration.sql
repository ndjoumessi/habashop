-- Loyalty v2 : remises % par palier (Tenant) + remise fidélité appliquée (Sale). Additif.
ALTER TABLE "Tenant" ADD COLUMN "bronzeDiscount" DOUBLE PRECISION NOT NULL DEFAULT 5.0;
ALTER TABLE "Tenant" ADD COLUMN "silverDiscount" DOUBLE PRECISION NOT NULL DEFAULT 10.0;
ALTER TABLE "Tenant" ADD COLUMN "goldDiscount" DOUBLE PRECISION NOT NULL DEFAULT 15.0;
ALTER TABLE "Sale" ADD COLUMN "loyaltyDiscount" DOUBLE PRECISION DEFAULT 0;
