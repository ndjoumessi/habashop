# Tenants de démonstration — la devise corrigée et les données personnelles réelles

*Deux incidents CLOS le 2026-08-06. Cette page porte le récit et les mesures ; les règles
survivantes vivent dans `CLAUDE.md` (§ Comptes démo).*

**À lire avant** de muter un tenant de démonstration, de « re-seeder », ou de retoucher
`lib/piiSweep.ts`.

---

## `demo-tenant-001` était en EUR — et ce n'était pas un bug de seed

Une boutique nommée « Dakar Central » s'affichait en **€** pendant que la vitrine promet le
Franc CFA.

L'enquête a écarté le seed : `prisma/seed.ts:34` **et** `prisma/fix-demo001.ts:50` posent tous
deux `XOF`. Le tenant est créé le **16/06** et modifié le **26/07**, six semaines plus tard —
l'EUR venait d'un `PATCH /api/tenant` **manuel**. Et les deux fixtures E2E écrivaient déjà
`currency:'XOF'` (`e2e/customers-uiux.shot.mjs:28`, `e2e/__ops.mjs:22`) : **la production était
seule à diverger.**

Mutation appliquée sur validation explicite de Nelson, **un seul champ** — diff de l'instantané
complet : `currency` + `updatedAt` automatique, rien d'autre. **Aucun montant n'a bougé** : tout
est stocké en XOF de base, `tenant.currency` n'est qu'une préférence d'AFFICHAGE.

Répartition après correction : **EUR 2 / XOF 2**.

## Pourquoi les démos restent ouest-africaines

Mesuré **avant** de décider, quand le marché par défaut est passé au Cameroun :

| Tenant | Ancrage | Lignes concernées |
|---|---|---|
| `demo-001` | Sénégal | **16** (tenant, 5 employés, 6 fournisseurs, 3 libellés de dépense « Senelec ») |
| `demo-002` | Côte d'Ivoire | **16** autres, dont **5 clients sénégalais** délibérés et documentés (`seed-demo.ts:78`) |

Les **12 produits sont neutres** (sucre, riz, huile…), l'indicatif dérive déjà de
`tenant.country`, et **la TVA à 18 % est CORRECTE pour SN et CI**.

Une démo sénégalaise sous un défaut produit camerounais est la meilleure preuve que le
multi-pays fonctionne. La basculer coûterait un UPDATE manuel sur 16 lignes d'un tenant
existant, pour un gain nul.

## Le seed a déjà dérivé — et un re-seed ne le réconcilierait pas

Tous les `upsert` du seed ont `update: {}` (seules exceptions : `lang` sur le tenant,
`role`/`name` sur les users). Le seed écrit « HabaShop — Boutique Centrale » depuis la
neutralisation des exemples, quand la base porte toujours « Dakar Central ».

**Un re-seed ne réécrit aucune ligne existante.**

## Données personnelles réelles — trois semaines en lecture publique

L'unique client de `demo-001` portait un **nom réel**, un mobile `+336`, une **adresse postale à
Marseille** et un e-mail personnel — **du 17/07 au 06/08**.

Anonymisé : `Client Démo 01`, `+221 77 000 09 01`, `client01@demo.sn`, « Médina, Dakar ».
L'abonnement qui le référençait n'a pas été orphelin. Un débris de vérification
(`verif-notes-tmp`, e2e-tenant, 0 référence) a été supprimé au passage.

### LE TIROIR MENTAIT, et c'est la leçon

L'écran affichait « Aucun achat », 0 point. **La base portait 1 abonnement actif.**

C'est ce comptage, et lui seul, qui a fait choisir l'**ANONYMISATION** plutôt que la suppression :
`Subscription.customerId` est non nullable, supprimer aurait violé la FK.

> **Compter les références avant de choisir, jamais déduire de l'écran.**

## Le balayage hebdomadaire — et le critère abandonné

`runDemoPiiSweep` (lundi 9h), `lib/piiSweep.ts`. Détection **de FORME** : indicatif hors
`+221/+225/+237`, domaine hors fixture — jamais par liste de pays ou de messageries. Périmètre
`isDemo` UNIQUEMENT.

⚠️ **Le critère « absent des seeds » de l'audit initial est ABANDONNÉ** : il a produit **8 faux
positifs sur 12** — apostrophe échappée `N\'Guessan`, domaines `.ci` et `.test` pourtant écrits
par les seeds. *Un critère qui se trompe deux fois sur trois se fait désarmer.*

Verrou : `piiSweep.test.ts` (11), dont le cas réel rejoué et les 8 faux positifs figés en
silence.
