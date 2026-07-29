-- Les cotisations font partie de l'INSTANTANÉ GELÉ du bulletin.
--
-- ⚠️ ADDITIVE PURE : deux colonnes ajoutées avec DEFAULT, aucune donnée réécrite, aucun DROP.
--
-- POURQUOI les geler alors que `net` l'est déjà : `cnss` et `ir` dépendent de TAUX fixés par la
-- loi. Les recalculer à l'affichage rejouerait un bulletin passé au barème du jour — la ligne
-- afficherait un net gelé et des retenues qui ne l'expliquent pas. Geler `baseSalary` sans
-- geler `cnss` ne suffit donc pas à rendre le bulletin reproductible.
--
-- La pénalité d'absence n'est PAS gelée : elle se redérive de `absences` + `baseSalary` (tous
-- deux gelés) et de la constante structurelle de 26 jours ouvrés, pas d'un taux légal.

ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "cnss" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "ir"   DOUBLE PRECISION NOT NULL DEFAULT 0;
