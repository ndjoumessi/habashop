-- Intégrité référentielle de `tenantId` sur EmployeeBonus et SalaryHistory (#183).
--
-- Les deux tables portaient une colonne `tenantId` et un `@@index([tenantId])`, mais AUCUNE
-- relation : une ligne pouvait référencer un tenant supprimé — ou inexistant — sans que rien
-- ne s'y oppose. La colonne existait, la garantie non.
--
-- ⚠️ ADDITIVE PURE : deux contraintes ajoutées, aucune donnée réécrite, aucun DROP.
--
-- ⚠️ PRÉALABLE VÉRIFIÉ AVANT ÉCRITURE (lecture seule, base de prod, 2026-08-05) : ajouter une
-- FK échoue si une seule ligne porte un `tenantId` sans Tenant correspondant. Compté :
--     EmployeeBonus : 0 ligne au total, 0 orpheline
--     SalaryHistory : 0 ligne au total, 0 orpheline
-- Les deux tables sont vides — la contrainte ne peut donc rien rejeter à la pose.
--
-- ⚠️ `ON DELETE RESTRICT` = DÉFAUT Prisma, et c'est la convention MESURÉE du schéma : 20 des
-- 21 relations vers `Tenant` ne déclarent aucun `onDelete` ; l'unique exception est
-- `UserTenant`, une table de jointure. Le `onDelete: Cascade` visible dans ces deux modèles
-- porte sur la relation `employee`, PAS sur `tenant` — les aligner confondrait deux relations
-- distinctes. RESTRICT est aussi le choix sûr : supprimer un tenant qui a encore des primes ou
-- un historique salarial échoue bruyamment au lieu de les effacer en silence.
--
-- ⚠️ Idempotent (garde `pg_constraint`) : rejouer la migration ne lève pas « already exists ».
-- `ADD CONSTRAINT` n'accepte pas `IF NOT EXISTS`, d'où le bloc DO.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeBonus_tenantId_fkey'
  ) THEN
    ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalaryHistory_tenantId_fkey'
  ) THEN
    ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
