# MSISDN — une règle de nettoyage, deux politiques

*Chantier CLOS. Cette page porte le raisonnement et les divergences mesurées ; la règle
survivante vit dans `CLAUDE.md` (§ Tests → MSISDN).*

**À lire avant** de toucher `lib/msisdn.ts`, `campayPayment.ts`, `mtnPayment.ts` ou
`providerConfig.ts` — et **avant de câbler un 3ᵉ prestataire de paiement**.

⚠️ À ne pas confondre avec `normalisation-telephonique.md`, qui traite du **destinataire d'un
message** (`resolveRecipient`, param `owner`). Ici il s'agit du **payeur d'une transaction**.

---

## Le point de départ : deux fonctions HOMONYMES

Il existait deux `normalizeCameroonPhone` — `POS.tsx` (→ MTN) et `campayPayment.ts` (→ Campay).
**8 entrées sur 20 divergeaient.**

Deux axes s'y superposaient, et il fallait les séparer **avant** de fusionner : sans cela,
« fusionner » revenait à choisir au hasard le comportement d'un des deux appelants.

### (a) Ponctuation — divergence ACCIDENTELLE

Le back retirait le point et faisait `trim()`, pas le front : « 699.000.001 » était accepté
d'un côté, refusé de l'autre. Aucune intention derrière l'écart → **on prend le SUR-ENSEMBLE**.

### (b) Périmètre géographique — divergence DÉLIBÉRÉE

| | Accepte |
|---|---|
| **MTN MoMo** | 8–15 chiffres **de tout pays** — son bac à sable utilise des numéros ÉTRANGERS (`46733123453` = Suède) |
| **Campay** | **Cameroun uniquement** — c'est le seul pays desservi |

Aplatir cassait forcément un côté :

- **permissif** → Campay expédie un numéro français à une API qui ne sait pas le traiter, **en
  silence** ;
- **strict** → le flux de test MTN meurt.

D'où `normalizeMsisdn(raw, policy)` avec `policy` **sans valeur par défaut** : le compilateur
force chaque futur appelant à choisir, exactement comme le `owner` de `resolveRecipient`.

## La politique se verrouille AU POINT D'APPEL

Basculer POS en `'cm-only'` laissait **toute la suite VERTE** (sabotage S20) et aurait tué le
bac à sable MTN en silence.

> *Un invariant garanti sur le module ne dit rien de ce que l'appelant en demande.*

6 sabotages vérifiés : aplatissement dans les deux sens, régression de ponctuation, jumeau qui
bouge seul, politique retournée à chaque point d'appel.

## La garde du navigateur n'est pas une garde

MTN ne normalisait **PAS** côté serveur : son zod ne vérifiait que `min(1)` et le numéro partait
tel que le client l'envoyait — la normalisation n'existant que dans `POS.tsx`. Un appel direct à
l'API passait.

Les **DEUX** routes normalisent désormais côté serveur : `campayPayment.ts` (`cm-only`) et
`mtnPayment.ts` (`international`). Un numéro irrécupérable rend **400 `PHONE_INVALID`** et le SDK
n'est jamais appelé ; le numéro n'apparaît pas dans le message (PII, cf. `redactPhone`).

Le verrou énumère les routes **NOMMÉMENT** et échoue si une route de `routes/` appelle
`normalizeMsisdn` sans y figurer — **un 3ᵉ prestataire ne peut pas entrer en douce.**

## La FORME du refus est verrouillée aussi

Corps unique `phoneInvalidBody(policy)` (`lib/payments/providerConfig.ts`), **message DÉRIVÉ de
la politique**. Écrit à la main, un « format Cameroun attendu » survivrait à un passage en
`international` et dirait au commerçant l'inverse de ce que la route accepte.

Les deux routes avaient **déjà divergé** dessus (`{ error }` nu contre `{ error, code }`) :
verrouiller la politique sans verrouiller le refus laissait l'écart revenir par l'autre bout.
