-- Multi-shift par jour : un employé peut avoir plusieurs shifts le même jour
-- (ex. matin + soir), mais pas deux fois le MÊME type le même jour.
-- Non-destructif : l'ancienne contrainte garantissait déjà ≤1 ligne par
-- (tenant,emp,date) → la nouvelle (superset avec shiftTypeKey) ne peut créer
-- aucun doublon sur les données existantes.

-- DropIndex
DROP INDEX "Shift_tenantId_employeeId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "Shift_tenantId_employeeId_date_shiftTypeKey_key" ON "Shift"("tenantId", "employeeId", "date", "shiftTypeKey");
