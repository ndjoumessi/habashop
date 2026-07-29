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

-- FK employé — RESTRICT, pas CASCADE.
-- ⚠️ Divergence ASSUMÉE avec les 5 autres FK vers Employee (Attendance, Shift, LeaveRequest,
-- EmployeeBonus, SalaryHistory : toutes CASCADE). MESURÉ : `DELETE /api/employees/:id` fait un
-- HARD delete (`prisma.employee.delete`), le CASCADE s'appliquerait donc réellement. Un
-- bulletin est la preuve de ce qui a été versé — supprimer une fiche ne doit pas effacer
-- l'historique de paie. RESTRICT garde `employeeId` NON-NULLABLE, donc l'unicité
-- (tenantId, employeeId, month) reste intacte, ce qu'un SET NULL aurait cassé.
DO $$
BEGIN
    ALTER TABLE "Payroll"
        ADD CONSTRAINT "Payroll_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- FK tenant. ⚠️ `EmployeeBonus` et `SalaryHistory` n'en ont PAS — ce sont les 2 exceptions
-- sur 23 tables scopées (mesuré en prod : 20 portent bien la FK). Les copier aurait fait de
-- `Payroll` la 3e anomalie : un tenantId pointant vers une boutique inexistante serait
-- ACCEPTÉ par la base, rendant la ligne invisible à toute requête scopée et indétectable.
-- RESTRICT (défaut) : on refuse de supprimer une boutique qui a encore des bulletins.
DO $$
BEGIN
    ALTER TABLE "Payroll"
        ADD CONSTRAINT "Payroll_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
