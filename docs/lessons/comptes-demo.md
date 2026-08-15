# Comptes et tenants de démonstration

> ⚠️ **DÉPLACÉ DE `CLAUDE.md` LE 2026-08-15, SUR DÉCISION DE NELSON.** Ne se charge plus à chaque
> session ; le déclencheur resté dans `CLAUDE.md` dit quand venir ici.
> **À CONSULTER quand on touche** les tenants `demo-*`, le seed, ou le balayage PII.
>
> Texte repris **VERBATIM** depuis `CLAUDE.md` — aucune reformulation.

## Comptes démo

⚠️ **`demo-tenant-001` et `demo-tenant-002` portent `isDemo = true`** depuis 2026-07-22 : toute action à coût externe ou destructive y est refusée côté serveur (403 `DEMO_TENANT_FORBIDDEN`, cf. § Garde de dépense). Le mot de passe démo est PUBLIC — c'est ce flag qui protège, pas la discrétion.

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant principal `demo-tenant-001` (« HabaShop — Dakar Central »). 5 employés (`demo-emp-${name}`). Données hors seed : `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.

⚠️ **QUATRE tenants** — un cinquième, orphelin, a été supprimé le 2026-08-09 (`prisma/delete-orphan-tenant.ts`, `CONFIRM=1`). ⚠️ **Le comptage des références se DÉRIVE des relations inverses de `model Tenant`, jamais des champs nommés `tenantId`** : un scan par nom de champ annonçait « 0 référence » en ayant manqué `StockTransfer` (`fromTenantId`/`toTenantId`) — *un périmètre dérivé de la mauvaise propriété rend un zéro qui a l'air d'une preuve.*

⚠️ **DEVISES DES TENANTS — ne PAS recopier d'inventaire ici, il se RELIT** (`tenant.findMany`). Ce fichier a déjà annoncé « EUR 2 / XOF 2 » sur la foi d'un `PATCH` non revérifié, et `demo-001` a porté `XAF` — un tenant sénégalais en devise d'Afrique CENTRALE, que rien ne pouvait signaler puisque les deux calculent à l'identique. Corrigé et vérifié le 2026-08-07 ; depuis le 2026-08-08 un garde empêche le couple incohérent de revenir. 📖 *`docs/lessons/demos-devise-et-pii.md`.*

⚠️ **`e2e-tenant` reste en EUR, et c'est DÉLIBÉRÉ — ne pas « harmoniser ».** En XOF (0 décimale, taux 1), convertir zéro, une ou deux fois donne le **même affichage** : tous les défauts de conversion y sont invisibles. C'est exactement la raison pour laquelle les cas dorés de paie doublent chaque cas XOF d'un cas EUR (§ Paie). `HabaShop Ops` est un tenant interne, pas une boutique.
⚠️ **LES DÉMOS RESTENT OUEST-AFRICAINES — ne pas « aligner » sur le marché par défaut.** Mesuré avant de décider : chaque démo est ancrée sur 16 lignes (SN pour `demo-001`, CI pour `demo-002`), l'indicatif dérive déjà de `tenant.country`, et **la TVA à 18 % est CORRECTE pour SN et CI**. Une démo sénégalaise sous un défaut produit camerounais est la meilleure preuve que le multi-pays fonctionne.

⚠️ **Et « re-seeder » ne ferait RIEN** : tous les `upsert` du seed ont `update: {}` (seules exceptions : `lang` sur le tenant, `role`/`name` sur les users). Le seed a d'ailleurs **déjà dérivé** du contenu de la base, et un re-seed ne réconcilierait pas l'écart — il ne réécrit aucune ligne existante.

✅ **DONNÉES PERSONNELLES RÉELLES — TRAITÉES le 2026-08-06, et surveillées depuis** (un client de `demo-001` portait nom, mobile, adresse et e-mail réels, **trois semaines** en lecture publique ; anonymisé). 📖 *`docs/lessons/demos-devise-et-pii.md`.*

⚠️ **LE TIROIR MENTAIT, ET C'EST LA LEÇON** : l'écran affichait « Aucun achat », la base portait **1 abonnement actif** — c'est ce comptage qui a imposé l'ANONYMISATION plutôt que la suppression (`Subscription.customerId` non nullable). **Compter les références avant de choisir, jamais déduire de l'écran.**

⚠️ **BALAYAGE HEBDOMADAIRE** — `runDemoPiiSweep` (lundi 9h), `lib/piiSweep.ts`. Il **RAPPORTE, il n'empêche pas** : empêcher supposerait de refuser des saisies dans une démo dont l'intérêt est qu'on puisse tout y faire. Détection **de FORME** (indicatif, domaine), jamais par liste de pays ou de messageries — le critère « absent des seeds » a été ABANDONNÉ après **8 faux positifs sur 12**. ⚠️ Le rapport ne reproduit **aucune valeur**, seulement identifiants et noms de champs : le recopier l'écrirait dans les logs Railway et **déplacerait la fuite au lieu de la fermer**. Périmètre `isDemo` UNIQUEMENT.

✅ **TRANCHÉ le 2026-08-09 par Nelson : le mot de passe démo RESTE PUBLIC**, le balayage PII hebdomadaire pour seule borne — `isDemo` borne le **coût** (403 sur toute dépense externe), **pas l'exposition**. **DÉCLENCHEUR DE RÉOUVERTURE : le premier prospect envoyé sur la démo** ; ce jour-là le mot de passe public devient un choix, plus un reliquat. ⚠️ `runDemoPiiSweep` réduit la fenêtre à sept jours — **il ne la ferme pas**.

**Multi-boutiques** : `admin@` et `manager@` sont liés à une 2ᵉ boutique `demo-tenant-002` (« Alimentation Koné — Abidjan », XOF) via `UserTenant` → login déclenche le sélecteur. `admin@` = SUPER_ADMIN/ADMIN, `manager@` = MANAGER/MANAGER. Les 3 autres restent mono-boutique.

