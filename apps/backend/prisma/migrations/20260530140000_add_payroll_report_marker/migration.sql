-- Marqueur d'idempotence du cron récap paie mensuel (runMonthlyPayrollReports).
-- Régularise la colonne ajoutée à l'origine via `prisma db push` (hors historique).
-- NON DESTRUCTIF : colonne nullable, additive. `IF NOT EXISTS` → no-op si déjà
-- présente (cas de la prod où db push l'a déjà créée) ; appliquée normalement
-- sur une base fraîche. Marquée `--applied` sur prod (pas de ré-exécution).

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastPayrollReportMonth" TEXT;
