-- WhatsApp auto : envoi serveur du reçu après vente (opt-in par tenant). Additif.
ALTER TABLE "Tenant" ADD COLUMN "enableAutoWhatsApp" BOOLEAN NOT NULL DEFAULT false;
