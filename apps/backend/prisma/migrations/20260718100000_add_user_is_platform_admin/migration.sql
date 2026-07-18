-- Additive : flag admin PLATEFORME (super-admin SaaS), orthogonal au rôle tenant.
-- Défaut false → aucun compte existant n'est promu (fail-closed). Aucune perte de données.
-- Seul ce flag ouvre /api/admin/* ; role='SUPER_ADMIN' reste un rôle interne au tenant.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
