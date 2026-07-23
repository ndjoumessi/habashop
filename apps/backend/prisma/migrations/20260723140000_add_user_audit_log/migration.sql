-- Additive : nouvelle table d'audit d'échelle UTILISATEUR (hors boutique).
-- Rien de l'existant n'est touché — AuditLog, ses index et ses lignes sont intacts.
--
-- Un changement de mot de passe n'appartient à aucune boutique. Le tenant-scoper le
-- rendrait dépendant du contexte de session : boutique active pour un mono-boutique,
-- NULL pour un multi-boutiques n'ayant pas encore choisi — le même événement enregistré
-- à deux échelles selon qui le déclenche.
--
-- AUCUNE CLÉ ÉTRANGÈRE vers "User", volontairement : un audit de sécurité doit SURVIVRE
-- à ce qu'il audite. Avec ON DELETE CASCADE, un attaquant qui compromet un compte, change
-- le mot de passe puis supprime le compte effacerait sa propre trace ; avec RESTRICT, la
-- suppression de compte deviendrait impossible. "userId" est donc une valeur historique
-- sans contrainte, et les instantanés e-mail/nom gardent la ligne lisible une fois le
-- compte parti — un "userId" orphelin ne dit plus rien à lui seul.
CREATE TABLE IF NOT EXISTS "UserAuditLog" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "userEmailSnapshot" TEXT NOT NULL,
    "userNameSnapshot"  TEXT NOT NULL,
    "action"            TEXT NOT NULL,
    "description"       TEXT NOT NULL,
    "ip"                TEXT,
    "severity"          TEXT NOT NULL DEFAULT 'info',
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserAuditLog_userId_createdAt_idx" ON "UserAuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserAuditLog_createdAt_idx"        ON "UserAuditLog"("createdAt");
