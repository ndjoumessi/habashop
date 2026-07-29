-- Bulletins de paie persistés (#173 → dette « Paie statuts »).
--
-- ⚠️ MIGRATION ADDITIVE PURE : création d'une table neuve, aucune colonne touchée sur
-- l'existant, aucune donnée réécrite. Sûre à appliquer sur la PROD.
--
-- Avant : les statuts de paie vivaient dans un `useState` de `Payroll.tsx` et disparaissaient
-- au rafraîchissement — un gérant marquait des salaires « PAYÉ », rechargeait, et tout
-- revenait à « EN ATTENTE ». On ne pouvait plus savoir qui avait été payé.
--
-- Les montants sont un INSTANTANÉ GELÉ (copie au moment de la génération), pas une jointure
-- vers Employee.salary : une augmentation ultérieure ne doit pas réécrire une paie passée.

CREATE TABLE IF NOT EXISTS "Payroll" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "employeeId"   TEXT NOT NULL,
    "month"        TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'GÉNÉRÉ',
    "paidAt"       TIMESTAMP(3),
    "employeeName" TEXT NOT NULL,
    "role"         TEXT NOT NULL DEFAULT '',
    "baseSalary"   DOUBLE PRECISION NOT NULL,
    "bonus"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absences"     INTEGER NOT NULL DEFAULT 0,
    "net"          DOUBLE PRECISION NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- Idempotence de « Générer » : rejouer sur le même mois ne duplique pas les bulletins.
CREATE UNIQUE INDEX IF NOT EXISTS "Payroll_tenantId_employeeId_month_key"
    ON "Payroll"("tenantId", "employeeId", "month");

CREATE INDEX IF NOT EXISTS "Payroll_tenantId_idx"       ON "Payroll"("tenantId");
CREATE INDEX IF NOT EXISTS "Payroll_tenantId_month_idx" ON "Payroll"("tenantId", "month");
CREATE INDEX IF NOT EXISTS "Payroll_employeeId_idx"     ON "Payroll"("employeeId");

DO $$
BEGIN
    ALTER TABLE "Payroll"
        ADD CONSTRAINT "Payroll_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
