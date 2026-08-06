-- NOTE DE PERFORMANCE / DE FOURNISSEUR : nullable, sans valeur par défaut.
--
-- POURQUOI — `Employee.perf` et `Supplier.rating` étaient `Int NOT NULL DEFAULT 3`.
-- Un employé jamais évalué valait donc 3, INDISCERNABLE d'un employé réellement noté 3, et
-- la barre RH en faisait la moyenne : une boutique neuve affichait « Performance moy. 3,0/5 »,
-- un chiffre que personne n'avait saisi. Même famille que `lastLoginAt` (colonne déclarée,
-- jamais écrite) et que la pastille de santé Ops : un signal qui ne peut pas être absent
-- ne distingue rien.
--
-- MESURÉ le 2026-08-06 avant migration : 10 employés et 10 fournisseurs en production,
-- répartis sur 3 tenants dont AUCUN n'est un client (2 démos + 1 fixture E2E). Les 20
-- valeurs correspondent EXACTEMENT à ce que les seeds écrivent — zéro écart. Personne n'a
-- jamais saisi une note, et personne ne le pouvait. Aucun signal (audit RH inexistant,
-- `updatedAt` pollué par des scripts en masse) ne permettrait de toute façon de distinguer
-- une note saisie d'une note par défaut : c'est précisément l'information que ce défaut
-- détruisait, et que la migration ne peut pas reconstituer.
--
-- ⚠️ AUCUNE LIGNE N'EST ÉCRITE ICI. Le passage de quelques lignes de démonstration à NULL
-- est un acte SÉPARÉ, validé explicitement, pour rester diffable indépendamment.
ALTER TABLE "Employee" ALTER COLUMN "perf"   DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "perf"   DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "rating" DROP NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "rating" DROP DEFAULT;
