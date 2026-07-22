-- Additive : marque une boutique de DÉMONSTRATION (comptes partagés, mot de passe public).
-- Défaut false → aucune boutique cliente existante n'est affectée. Aucune perte de données.
-- Ce flag ferme côté SERVEUR les actions à coût externe (Anthropic / Twilio / Resend) et
-- destructives : 403 DEMO_TENANT_FORBIDDEN (cf. middleware/demoTenant.ts). Masquer le bouton
-- démo côté front ne protège rien — le mot de passe démo est public (dépôt public + bundle JS).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
