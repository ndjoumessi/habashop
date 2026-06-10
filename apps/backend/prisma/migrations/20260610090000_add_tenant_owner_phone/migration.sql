-- Additive : numéro WhatsApp du gérant pour les rapports auto (soir/matin).
-- null = rapports désactivés pour ce tenant (plus AUCUN fallback global).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT;
