# Domaines de type — le cast qui rétrécit et l'arité des ternaires

*Mesures du 2026-08-06. Cette page porte les balayages, les tables de verdict et
l'archéologie ; les règles survivantes vivent dans `CLAUDE.md` (§ `as '…'|'…'`,
§ Arité des ternaires).*

**À lire avant** d'écrire un scanner sur ces motifs, ou de « corriger » un cast au jugé.

---

## Partie 1 — le cast qui rétrécit

Un `as` vers une union de littéraux n'est pas une annotation : c'est une affirmation que `tsc`
a été prié d'accepter **sans la vérifier**. Il éteint la seule parade automatique (le `Record`
exhaustif). *Le ternaire avale dans son `else` ; le cast avale tout court.*

### Le défaut : `Employee.type`

Typé `'CDI' | 'CDD'` alors que :

- `CONTRACT_LABELS`, **trente lignes plus bas dans le même fichier**, en libellait **CINQ** ;
- `schema.prisma` porte `type String` — **aucun enum** ;
- le zod backend est `z.string().optional()`.

Le type ne décrivait pas la donnée : **il décrivait ce que le plus pauvre des trois formulaires
savait offrir.**

Deux dégâts, tous deux SILENCIEUX :

1. l'alerte d'échéance testait `type === 'CDD'` → un **Stage daté n'était jamais signalé** ;
2. `NewContractModal` **jetait `endAt`** pour tout type autre que CDD.

⚠️ **Le cast n'était pas encore passé en PRODUCTION** (base : CDI 8 · CDD 2 · rien d'autre) —
parce qu'aucun tenant client n'existe et que les seeds n'écrivent que CDI/CDD. Le chemin, lui,
était ouvert : deux des trois écrans proposaient les cinq valeurs.

> **Un défaut latent se mesure au CHEMIN, pas au contenu de la table.**

### Balayage des trois cibles : 12 casts, UN seul défaut

La distinction est nette et un scanner naïf s'y trompe :

| Forme | Verdict |
|---|---|
| `'medium' as 'small'\|'medium'\|'large'` (Stock, POS) | **ÉLARGIT** un littéral pour l'inférence de `useState` — idiome correct |
| `mimeType as 'image/jpeg'\|…` (`invoiceOcr:52`) | **correct** : précédé de `if (IMAGE_TYPES.includes(mimeType))`, garde runtime que TS ne sait pas inférer |
| `(t.priceMode === 'HT' ? 'HT' : 'TTC') as 'TTC'\|'HT'` | redondant, l'expression a déjà ce type |
| `lang as 'fr'\|'en'\|'es'\|'it'` (planningShared) | rétrécit, mais **gardé** par un `?? [repli]` |
| `contractForm.type as 'CDI'\|'CDD'` | **LE DÉFAUT** — supprimé |

### `posDefaultPayment` — « inatteignable » était FAUX

Premier diagnostic : « aucun écran n'écrit ce champ, il vaut toujours `'cash'` ». L'historique
dit l'inverse — `Settings.tsx:646` (commit `1e519fca`, **2026-05-20 → 05-24**) offrait un
sélecteur à CINQ options sous un `as 'cash'|'card'|'mobile'` :

```
déclaré au type     cash · card · mobile
offert à l'écran    cash · card · wave · orange · mobile      ← le cast mentait DANS LES DEUX SENS
accepté par le POS  cash · card · wave · orange · mtn
```

⚠️ **Et `appStore` est PERSISTÉ en localStorage** (`partialize` garde ce champ dans `...rest`) :
un commerçant ayant choisi « 📱 Mobile » pendant ces quatre jours l'a **toujours dans son
navigateur**, et le POS lui pré-sélectionnait une tuile inexistante. L'écran a disparu quatre
jours plus tard — la valeur est devenue inatteignable **en écriture**, jamais **en lecture**.

> **Un champ persisté n'a pas de domaine « actuel » : il a l'union de tous ceux qu'il a eus.**
> Chercher qui écrit AUJOURD'HUI ne suffit pas ; il faut `git log -S` sur le champ.

**Corrigé** : `POS_PAY_MODES` / `PosPayMode` dans `appStore`, les deux casts de `POS.tsx`
supprimés, et **`resolvePosPayMode(raw: unknown)` appelée par `merge`** — même forme de repli
gracieux que `VALID_THEMES`.

**DÉCISION PRODUIT : `'mobile'` → `'cash'`, jamais vers un prestataire.** Le commerçant a choisi
« Mobile » quand l'écran ne demandait pas lequel ; en désigner un à sa place inventerait sa
décision, et la disponibilité réelle dépend de la config SERVEUR du tenant, pas de l'appareil.

⚠️ Domaine tenu **DISTINCT** de `PaymentMethodId` (paiement d'ABONNEMENT :
`wave|orange_money|mtn_money|virement|card`) — se ressemblent, diffèrent, et les fondre perdrait
ce que chacun distingue.

⚠️ **Le sabotage décisif du verrou est passé VERT au premier tir** : le test rejouait la règle de
repli à l'identique au lieu d'appeler celle du store, donc « `'mobile'` → `'wave'` » ne le
touchait pas. D'où l'extraction en fonction NOMMÉE, exercée telle quelle — *une règle réécrite
dans un test ne prouve rien de ce que le code fait.*

Verrous : `posPayModeDomain.test.ts` (6, **5 sabotages**, périmètre DÉRIVÉ des tuiles rendues) ·
`hrContractDomain.test.ts` (11, **5 sabotages**), qui juge la FORME et non l'identifiant.

⚠️ **Un test qui NOMME le défaut le protège.** `hrmodals.anchor` cherchait
`getByLabelText('Nom complet *')` : il figeait donc le DOUBLE marqueur de champ requis
(`ValidatedInput` rend déjà son propre `*`) et serait devenu un frein à sa correction. Il dérive
désormais (`/^Nom complet/`). Même motif que `signup.anchor` figeant « Sénégal ».

---

## Partie 2 — l'arité des ternaires

**MESURÉ sur 425 fichiers de production** (web + API + mobile) : **1 268 chaînes** de ternaires
portant sur un domaine typé, dont **1 211 exhaustives**. Le motif `x === 'litéral' ? A : B` est
donc massivement CORRECT — 57 chaînes seulement avalaient ≥ 2 valeurs, et après lecture il ne
restait que **25 défauts réels**.

### Pourquoi on n'écrit PAS de scanner sur ce motif

Décision prise après mesure, pas par principe : **à 95 % de justes, un scanner crie au loup et se
fait désarmer.**

Surtout, la seule liaison qu'il puisse faire à bas coût — **par NOM DE VARIABLE** — s'est révélée
FAUSSE au cours de la mesure elle-même :

| Attribué à | En réalité |
|---|---|
| `e.status` → domaine des statuts de tenant | statut de **dépense** (PAYÉ/EN ATTENTE), cardinalité 2 |
| `alert.level` → `priceGapLevel` | autre domaine |
| `filterStatus` → statuts de `PlanRequest` | autre domaine |

Des ternaires **binaires corrects sur un domaine binaire**, comptés comme défauts.
**La seule liaison sûre est par les LITTÉRAUX testés** : la chaîne appartient au domaine D si
*tous* ses littéraux appartiennent à D.

⚠️ **Second piège de mesure : la QUEUE d'une chaîne ressemble à un binaire.**
`lang === 'en' ? … : lang === 'es' ? … : lang === 'it' ? … : fr` produit quatre correspondances,
dont la dernière semble binaire. Sans regroupement par offsets d'expression : **1 366 faux
positifs**. Regrouper d'abord, juger ensuite.

### Les quatre `Record` posés, et pourquoi

- **`paymentMethod`** — `lib/paymentMethods.ts`, jumeaux front/back + fixture partagée
  `docs/shared-fixtures/payment-methods.json`. Il y avait **TROIS** implémentations avec quatre
  divergences : UpgradePlan ignorait `card` et donnait `#00B3FF` à Wave quand `--brand-wave` vaut
  `#1B9AF5` · `email.ts` collait le pictogramme DANS le libellé · AdminDashboard rendait le champ
  BRUT (« virement », « mtn_money ») au-delà de deux marques. `offeredInTunnel` distingue ce qu'on
  PROPOSE de ce qu'on sait NOMMER.
- **`payMode` mobile** — `mobile/src/lib/paymentLabel.ts`. Les deux reçus (`printReceipt.ts`,
  `whatsappTicket.ts`) portaient la MÊME chaîne à trois branches sur un domaine de cinq : une
  vente **MTN MoMo s'imprimait « Carte »** sur le document remis à l'acheteur. ⚠️ Le défaut
  semblait inatteignable (`posStore.PaymentMode` du mobile ne contient pas `mtn`) — il ne l'est
  pas : `app/(app)/sales/index.tsx` réimprime depuis `sale.paymentMode`, une vente **relue du
  serveur**, encaissée sur le web.
- **`Sale.paymentMode` WEB** — `apps/frontend/src/lib/salePaymentModes.ts`, jumeau du mobile,
  fixture `docs/shared-fixtures/sale-payment-modes.json`. **CINQUIÈME et SIXIÈME instances du même
  domaine, dans le même fichier**, deux jours après la correction mobile — la preuve que corriger
  un jumeau ne ferme rien tant que la SOURCE n'existe pas. Les deux erreurs étaient
  **symétriques**, et c'est ce qui les rendait invisibles à la relecture : `mobile` était RENDU
  alors que le serveur ne l'écrit **jamais** (0 sur 1 908 ventes), pendant que `mtn` et `mixed`
  étaient écrits et **absents du graphique**.
- **`Tenant.status`** — `mobile/src/lib/tenantStatus.ts`. `pending_payment` et `cancelled`
  tombaient dans le VERT « actif », libellés par le champ brut de la base. Or `pending_payment`
  est l'état de **tout futur client payant** (la voie d'abonnement est manuelle). ⚠️ La colonne
  est un `String`, pas un enum : une valeur inconnue doit être **neutre et VISIBLE**.

### La justesse EMPRUNTÉE — l'enregistrer, ne pas la « corriger »

`spendGuard.quotaLimit` mappe cinq statuts sur deux paliers de quota : l'expression **n'est pas
fausse** (il n'existe que deux jeux de plafonds). Elle n'est juste que parce que `authorizeSpend`
applique ses gardes dans l'ordre **démo → statut → rafale → quota** et que `tenantSpendState`
refuse `suspended` et `cancelled` AVANT d'atteindre cette ligne — sinon une boutique suspendue
hériterait du palier PAYANT sur un chemin de dépense facturée.

> **Une justesse qui dépend d'un invariant distant et que rien n'enregistre est une justesse
> empruntée** : elle disparaît au premier réordonnancement, sans qu'aucune suite ne rougisse
> (`tsc` ne voit rien, les deux fonctions étant valides séparément).

D'où `spendGuardStatusOrder.test.ts` — il ne teste pas le plafond, il teste que **ce que
`quotaLimit` n'a pas à distinguer, quelqu'un d'autre le refuse**. Sabotage vérifié : retirer la
garde amont → 4 rouges.

### `lang` n'a pas besoin d'un `Record`

La convention `i(fr,en,es,it)` existe et tient à 95 %. Les traînards se rattrapent en passant.

⚠️ Mesuré au passage — `Header.tsx` rendait `Plan X` pour fr **et** es faute de branche
espagnole ; c'était juste *par coïncidence*, les deux langues employant le même mot. **Une branche
correcte pour la mauvaise raison reste à écrire**, sans quoi la première reformulation française
emporte l'espagnol.
