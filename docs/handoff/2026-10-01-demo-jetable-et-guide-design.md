# Démo jetable en libre-service + manuel d'utilisation `/guide` — design

**Date** : 2026-10-01 · **Statut** : spec validée en conception, plan non écrit · **Décisions prises par** : Nelson

Deux livrables indépendants, réunis parce qu'ils répondent à la même question — *comment un
prospect comprend le produit sans qu'on lui parle* :

1. une **démo jetable** créée en un clic depuis la vitrine, détruite au bout de 7 jours ;
2. un **manuel d'utilisation** public à `/guide`, 8 modules, 4 langues.

---

## 0. Ce que ce chantier DÉCLENCHE, et qu'il faut savoir avant de commencer

`CLAUDE.md` § Comptes démo porte cette décision, datée et signée :

> ✅ **TRANCHÉ le 2026-08-09 par Nelson : le mot de passe démo RESTE PUBLIC.** `isDemo` borne le
> **coût**, **pas l'exposition**. ⚠️ **DÉCLENCHEUR DE RÉOUVERTURE : le premier prospect envoyé sur
> la démo.**

Ce chantier **est** ce déclencheur. Il le traite en ne l'armant pas : la démo servie au prospect
n'est **pas** `demo-tenant-001`. C'est un tenant neuf, à lui, sans mot de passe publié et sans
autre visiteur dedans. Les deux démos partagées restent ce qu'elles sont — des bacs à sable
internes — et la fenêtre de sept jours du balayage PII ne s'applique pas au prospect, parce que
le prospect n'entre jamais dans un tenant partagé.

⚠️ **Corollaire à ne pas perdre** : `verify:demo-flag` continue de vérifier l'ABSENCE de
`demo1234` dans le `dist/` livré. Ce chantier ne met aucun identifiant dans le bundle. Si une
implémentation future y met un mot de passe démo, elle casse ce garde — c'est le signal, pas un
inconvénient.

---

## 1. Démo jetable

### 1.1 Forme retenue

| Décision | Valeur | Pourquoi |
|---|---|---|
| Entrée | **un clic, rien à saisir** | zéro friction, et surtout **zéro PII collectée** — donc rien à balayer ensuite, rien à écrire dans la politique de confidentialité |
| Durée de vie | **7 jours** | assez pour revenir et montrer à un associé ; assez court pour borner la base |
| Contenu | **jeu riche ouest-africain** | Rapports/Prévisions/Tableau de bord doivent être peuplés : c'est ce que le prospect vient voir |
| Point d'entrée | **bouton secondaire du hero** | là où le visiteur décide, sans concurrencer l'inscription qui reste l'objectif |

### 1.2 Approche de génération du jeu de données

**Retenu — fonction de génération** `buildDemoDataset(tx, tenantId, locale)`.

Écarté, et pourquoi c'est écrit ici plutôt qu'oublié :

- **Cloner un tenant modèle `demo-template`** — exigerait une *copie* ordonnée des 24 modèles
  portant `tenantId`, soit exactement la complexité de la purge (§ 1.5) en miroir, et le modèle
  dériverait dès qu'on le touche. Muter un tenant existant pour l'entretenir est par ailleurs
  interdit (`CLAUDE.md` § Vérification en PROD).
- **Démo partagée en lecture seule + surcouche par visiteur** — complexité sans rapport avec le
  besoin, et on retombe sur un tenant partagé, donc sur le déclencheur du § 0.

### 1.3 Route — `POST /api/demo/start`, publique

Sans authentification. **Réutilise la forme de réponse de `/api/auth/register`**
(`{ token, user, tenant }`) afin qu'`authStore` n'ait aucun cas particulier à connaître : le
front traite le retour comme une connexion ordinaire.

En une transaction :

1. `Tenant` — `isDemo: true`, `id` préfixé **`demo-tmp-`**, `status: 'trial'`, `isActive: true`,
   `demoExpiresAt = now + 7 j`.
   ⚠️ **`vatRate` est DÉRIVÉ du pays** (`vatRateOrZero`) — jamais laissé au `@default(18)` du
   schéma, qui est le taux UEMOA et a déjà facturé faux toute inscription camerounaise.
   ⚠️ **Cohérence zone franc CFA vérifiée** (`isCurrencyZoneConflict`) : un pays UEMOA ne peut
   pas être en XAF. Ici le couple est CONSTRUIT par nous, donc il doit être juste par
   construction, pas refusé à l'exécution.
2. `User` éphémère — mot de passe **aléatoire**, jamais affiché, jamais journalisé.
   ⚠️ L'e-mail est synthétique et non routable (motif de `deleted-<uuid>@deleted.local` déjà
   employé par `accountDeletion`) : aucune adresse réelle n'existe, donc **aucun e-mail ne peut
   partir**, y compris l'e-mail de bienvenue que `register` envoie.
3. `UserTenant` — l'utilisateur est `ADMIN` de sa démo.
4. `buildDemoDataset(...)`.

Puis `signActive(user.id, user.role, tenant.id)` et retour du JWT.

**Locale** : `SN` / `XOF` / TVA 18 %.
⚠️ **NE PAS aligner sur le marché par défaut camerounais** — `CLAUDE.md` § Comptes démo :
« LES DÉMOS RESTENT OUEST-AFRICAINES […] une démo sénégalaise sous un défaut produit camerounais
est la meilleure preuve que le multi-pays fonctionne. »

### 1.4 Ce que `isDemo: true` apporte GRATUITEMENT

À ne pas réimplémenter :

- **Refus serveur de tout ce qui coûte ou détruit** — `blockDemoTenant` (403
  `DEMO_TENANT_FORBIDDEN`), **fail-closed**, sur les 11 routes déjà gardées. Anthropic, Twilio,
  Resend sont hors d'atteinte depuis une démo.
- **Exclusion des agrégats de la console Ops** — `CLIENT_TENANTS_WHERE` décide **par propriété**
  (`isDemo`), pas par une liste d'identifiants. Une démo jetable n'entre donc ni dans le compte
  de boutiques, ni dans le CA, ni dans le MRR — sans qu'une ligne soit à écrire. Le nombre de
  fixtures écartées est déjà **dit à l'écran**.

### 1.5 Expiration et purge

#### La colonne qui rend la purge sûre par construction

Migration additive : `Tenant.demoExpiresAt DateTime?` (`ADD COLUMN IF NOT EXISTS`, aucune perte
de données, puis `prisma migrate resolve --applied`).

⚠️ **NE PAS réutiliser `trialEnds`** : c'est un champ de facturation, lu par les relances d'essai
et le garde de dépense. Y écrire une échéance de démo ferait partir des relances d'essai vers un
tenant sans adresse et mêlerait deux notions que tout le reste du code distingue.

**La purge ne sélectionne que `demoExpiresAt` non nul ET dépassé.** Conséquence :
`demo-tenant-001`, `demo-tenant-002` et `e2e-tenant` portent `null`, donc sont
**structurellement impurgeables**. Ils sont protégés par une propriété, pas par une liste de noms
— une liste vieillit, et le prochain tenant de test n'y figurerait pas.

#### Suppression DURE, et pourquoi elle ne peut pas passer par `deleteAccount`

`services/accountDeletion.ts` est un **soft delete + anonymisation** : il conserve délibérément
les données transactionnelles (`Sale`, `SalaryHistory`, `Expense`, `AuditLog`…) pour les
obligations comptables, et repose le tenant en `status: 'cancelled'`, `deletedAt`.

L'employer ici laisserait **un tenant anonymisé par visiteur en base, à vie** : la croissance ne
serait pas bornée, ce qui est précisément ce que la durée de vie de 7 jours est censée garantir.

⚠️ **Les deux opérations ne doivent pas être fondues.** Chacune répond à une obligation que
l'autre n'a pas — conserver pour la comptabilité d'un côté, disparaître réellement de l'autre.
Un module unique perdrait ce que chaque appelant distingue (`CLAUDE.md` § Refactor transverse :
*un goulot ne doit pas être un entonnoir*).

#### L'ordre de suppression est DÉRIVÉ — et le critère n'est PAS « porte un `tenantId` »

Les relations `tenant` n'ont **presque aucun `onDelete: Cascade`** — le défaut Prisma est
`Restrict` — donc `prisma.tenant.delete()` seul **échoue** sur un tenant peuplé.

⚠️ **NE PAS poser de `Cascade` par migration pour contourner.** Cela changerait le comportement
pour un **client réel** : l'effacement en cascade de ses écritures comptables serait un dégât,
pas une commodité. La contrainte `Restrict` est une protection, on ne la retire pas pour
simplifier un cas de fixture.

⚠️ **PREMIÈRE VERSION DE CE DESIGN, FAUSSE, GARDÉE ICI** : « les modèles portant `tenantId`,
triés topologiquement ». **24 modèles** en portent un — mais **trois cas la contournent**, et
c'est l'auto-revue de cette spec qui les a trouvés, pas sa rédaction :

| Modèle | Pourquoi le critère `tenantId` le rate | Conséquence |
|---|---|---|
| `StockTransfer` | porte **`fromTenantId` / `toTenantId`**, jamais `tenantId` | deux relations `Tenant` en `Restrict` → le `tenant.delete()` **échoue** |
| `SaleItem` | aucun champ tenant ; `sale Sale` **sans `onDelete`** (donc `Restrict`) | doit partir **avant** `Sale` |
| `PurchaseOrderItem` | idem ; `order PurchaseOrder` **sans `onDelete`** | doit partir **avant** `PurchaseOrder` |

C'est l'angle mort **« Forme »** du § Le JUMEAU NON TRAITÉ : *le scan est vert parce qu'il
cherche ce qui ne PEUT PAS exister*. Un nom de champ n'est pas un critère ; la relation l'est.

**CRITÈRE CORRIGÉ — le sous-graphe de clés étrangères ATTEIGNABLE depuis `Tenant`**, dérivé du
DMMF Prisma et supprimé en ordre topologique **inverse** (les feuilles d'abord). Il attrape les
trois cas ci-dessus par construction, quel que soit le nom de leurs champs.

⚠️ **`UserAuditLog` n'a AUCUNE clé étrangère** — ni vers `User`, ni vers `Tenant`, et c'est
délibéré : *un audit de sécurité survit à la suppression du compte*. Il est donc
**structurellement hors du sous-graphe**, et doit le rester — ne pas « compléter » la purge en
l'y ajoutant. Pour une démo il ne retient de toute façon qu'un e-mail synthétique et un nom
d'emprunt : aucune PII.

Une liste écrite à la main serait fausse dès le prochain modèle, et une simple assertion
d'exécution ne le dirait pas : elle prouverait qu'on a supprimé N tables, jamais que N était le
bon N (angle mort **« Périmètre »**).

**Tranché — dérivation à l'EXÉCUTION**, pas une liste figée au build : une liste figée est une
liste écrite à la main avec une étape de plus, et elle se périme au modèle suivant sans que rien
ne rougisse.

#### Cron

Convention du dépôt (`server.ts` : `setInterval` + garde fenêtre-temps). Une passe quotidienne.

⚠️ **Pas de marqueur idempotent en base, et c'est raisonné** : la sélection se fait sur
l'échéance, donc la purge est idempotente **par nature** — une seconde passe ne trouve plus
rien. Ajouter un marqueur « par convention » serait du code qui ne protège de rien.

⚠️ **Le compte est ASSÉRÉ avant/après**, et le résultat est DIT. Règle du ménage E2E : *un
ménage s'asserte sur le COMPTE avant/après et n'est jamais « best-effort »*. Un échec part en
Sentry — `console.error` seul est un signal que personne ne reçoit
(§ « L'ALARME QUI NE PEUT PAS SONNER »).

### 1.6 Anti-abus

Une route publique qui écrit en base est une surface d'abus. Deux plafonds, et le second est la
vraie protection :

- **Par IP — volontairement GÉNÉREUX.** ⚠️ Le CGNAT ouest-africain fait partager une IP à des
  boutiques sans lien, et les caisses d'un même magasin sortent par la même adresse : un plafond
  serré par IP refuserait des visiteurs légitimes. C'est pour la même raison que la rafale du
  garde de dépense est par TENANT et non par IP.
- **Plafond GLOBAL journalier** — refus explicite au-delà, avec repli nommé vers l'inscription.
  C'est lui qui borne réellement la croissance de la base.

Valeurs de départ proposées : **20/h par IP**, **200/jour au global**. ⚠️ Ce sont des choix, pas
des mesures — à réviser dès qu'on a du trafic réel. Elles sont lues **par variable
d'environnement, À L'APPEL** (ajustables sans redéploiement, convention du dépôt), et
⚠️ **sans `|| <défaut>`** : `Number('0') || 200` rendrait la désactivation inopérante.

Aucun `SpendKind` n'est requis : aucun SDK facturé n'est atteint (pas d'e-mail, pas de SMS).

### 1.7 Front

- **Hero** — bouton secondaire « Essayer la démo » à côté de « Créer ma boutique », en second
  rang visuel. 100 % tokens `var(--)` comme le reste du hero.
  ⚠️ **Le bouton n'est JAMAIS désactivé par une validation** — il n'a aucun champ à valider ;
  il l'est pendant la requête en vol seulement (anti double-soumission), exemption déjà nommée
  par `landingClaims.test.ts`.
- **Bandeau dans l'app** — « Démo — expire le JJ/MM », la date venant **du serveur**, jamais un
  « 7 jours » recopié côté client. C'est la règle du champ mesuré plutôt que déclaré ; et
  `fmtDate()` pour l'affichage, jamais `toLocaleDateString()` sur l'ISO.
- Le jeton se stocke par `authStore` (clé `habashop_token`), comme une connexion ordinaire.

---

## 2. Manuel d'utilisation — `/guide`

### 2.1 Forme

Route **publique** (hors `ProtectedRoute`), chargée paresseusement, sur le modèle de `/privacy`
et `/terms`. Sommaire + une section par module. Liée depuis le **pied de page de la vitrine** et
ajoutée au `sitemap.xml` (`scripts/gen-seo.mjs`).

⚠️ `verify:seo-urls` inspecte le `dist/` LIVRÉ : aucun `%VITE_*%` non substitué, `content` non
vide sur chaque `<meta name>`, JSON-LD analysable. Une page publique neuve passe sous ce garde.

### 2.2 Périmètre — les 8 modules du quotidien

Caisse · Stock & produits · Codes-barres & étiquettes · Clients & fidélité · Dépenses ·
Rapports · Réglages · Mobile & hors-ligne.

Les modules moins ouverts (Fournisseurs, RH, Paie, Planning, Abonnements, Multi-boutiques,
Objectifs, Marketing) sont **hors périmètre de cette première livraison** — décision assumée :
en 4 langues, ils doubleraient le volume, et les sections les moins lues vieilliraient sans
qu'on les relise.

### 2.3 Contrainte de contenu — on ne documente que ce qui est ✅

`docs/HabaShop_CDC_v4.md` porte l'état RÉEL de chaque capacité : ✅ atteignable · ⚠️ livré mais
inerte · 🧪 bac à sable · ⬜ absent.

⚠️ **Le manuel ne décrit QUE les ✅.** Documenter une capacité inerte est exactement ce que la
vitrine a déjà payé — « Déployé dans 150+ pays » et les badges SSL/TLS ont été retirés parce
qu'ils étaient faux, et `login.anchor.test.tsx` fige aujourd'hui leur absence. Un manuel est
plus crédible qu'une vitrine : une fausseté y coûte plus cher.

⚠️ Conséquence à écrire noir sur blanc dans les sections concernées : le SMS, le push PWA, Wave,
Campay en production et PayDunya en production sont **inertes faute de clés** (`CLAUDE.md` §
Dette ouverte). Ils ne figurent pas au manuel tant qu'ils ne sont pas activés.

### 2.4 i18n

Convention du dépôt : `i(fr, en, es, it)` — **les 4 langues, toujours**, jamais un binaire
FR/EN. C'est le gros du volume de rédaction et il est chiffré comme tel dans le plan.

⚠️ L'espagnol et l'italien **rallongent** les libellés : tout titre de section ou entrée de
sommaire doit être vérifié dans les 4 langues, pas seulement en français (cf. § Le LIBELLÉ QUI
TRONQUE — la cause y était une contrainte de largeur mesurée, pas une chaîne trop longue).

---

## 3. Verrous

| Verrou | Ce qu'il affirme |
|---|---|
| `demoSelfServe.test.ts` | tenant créé conforme : `isDemo`, préfixe `demo-tmp-`, `demoExpiresAt` posé, **`vatRate` dérivé du pays**, couple pays/devise cohérent ; **aucun SDK payant appelé** (assertion sur la DÉCISION, SDK mocké) ; le plafond global refuse avec un code explicite |
| `demoPurge.test.ts` | ne sélectionne **que** `demoExpiresAt` non nul et dépassé. **Sabotage décisif** : un tenant à `demoExpiresAt` nul ne doit JAMAIS être sélectionné — c'est ce cas qui protège `demo-tenant-001` |
| `demoPurgeCoverage.test.ts` | la liste dérivée couvre **tout modèle atteignable depuis `Tenant`** par clé étrangère — rouge si un modèle est ajouté sans être purgé. Doit inclure nommément les trois cas que le critère naïf ratait (`StockTransfer`, `SaleItem`, `PurchaseOrderItem`) et exclure `UserAuditLog`. Assertion de COUVERTURE, pas de simple exécution |
| complétude i18n du guide | chaque chaîne du guide porte ses 4 langues |

⚠️ **Chaque verrou est vérifié DANS LES DEUX SENS** — on le casse volontairement pour prouver
qu'il détecte. Et le sabotage se **copie** depuis le fichier de production
(`git show HEAD:<fichier>`), jamais retapé de mémoire : un sabotage écrit de mémoire hérite des
hypothèses du détecteur, et les deux tombent ensemble.

⚠️ **Le mock doit APPLIQUER le filtre.** Un `mockResolvedValue([…])` qui rend la même liste quel
que soit le `where` laisserait `demoPurge` vert même si le code cessait d'envoyer la condition
`demoExpiresAt` — un vert qui décrit un monde qui n'existe pas.

---

## 4. Ce que ce chantier NE fait PAS

- Il ne touche pas à `demo-tenant-001` / `-002` ni à `e2e-tenant` — aucune mutation d'un tenant
  existant (§ Vérification en PROD).
- Il ne rend pas le raccourci `DemoRoleLogin` visible en production ; `verify:demo-flag` reste
  en place, inchangé.
- Il n'ajoute pas de `onDelete: Cascade` au schéma.
- Il ne documente pas les capacités inertes.
- Il ne collecte aucune adresse e-mail, donc n'élargit pas le périmètre de la politique de
  confidentialité ni du balayage PII.

---

## 5. Points ouverts pour le plan

1. **Volume exact du jeu de démonstration.** Il doit dépasser les seuils qui masquent les
   défauts : ⚠️ `demo-tenant-001` a **exactement 6 catégories**, or le camembert « CA par
   catégorie » en affiche 6 — le reliquat y était donc toujours nul et le défaut, réel sur
   `demo-002`, restait invisible. *Une démonstration calée sur la valeur limite ne démontre rien.*
   Viser **8+ catégories**, plusieurs mois de ventes, et des employés **non évalués** (`perf`
   nul) pour que l'état « — » soit visible.
2. **Durée de la transaction de création.** ~500 lignes en une transaction : à mesurer, et à
   borner si le temps de réponse dépasse ce qu'un bouton peut tenir. Ne pas répondre avant que
   le jeu soit complet — une démo à moitié remplie se lit comme un produit cassé.
3. **Le tri topologique n'est plus un point ouvert** — tranché au § 1.5 : dérivé du DMMF à
   l'exécution, sur le critère d'atteignabilité depuis `Tenant`. Reste à mesurer au plan : le
   coût d'un `tenant.delete()` complet sur un jeu de démonstration, pour dimensionner la passe
   de purge quotidienne.
