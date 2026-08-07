# Les chiffres affichés — huit défauts mesurés, une même famille

*Chantiers du 2026-08-06/07. Cette page porte les mesures, les incidents et les calibrages de
scanner ; les règles survivantes vivent dans `CLAUDE.md` (§ La VÉRITÉ VACANTE, § Le CHAMP
DÉCLARÉ, § La MOYENNE SANS SON DÉNOMINATEUR, § RÉPARTITION PAIEMENTS, § LE TOTAL CALCULÉ SUR CE
QUI EST AFFICHÉ, § Console Ops, § Le LIBELLÉ QUI TRONQUE, § Le COMMENTAIRE QUI INVENTE UN REPLI).*

**À lire avant** d'écrire un compteur, un pourcentage, une moyenne, une pastille d'état, ou un
scanner qui les surveille.

---

## 1. La vérité vacante — « toutes » sur l'ensemble vide

Un quantificateur universel est **VRAI et VIDE de sens** sur une liste vide : `.every()` rend
`true`, `.some()` rend `false` — **les deux mentent quand la liste est vide.**

Mesuré sur la console Ops : une coche verte annonçait « **Toutes vos boutiques ont démarré** »
sous « **0 inscrites** ». L'écran félicitait pour un succès que personne n'avait obtenu — et
c'était le même écran qui venait d'être corrigé pour ne plus compter les fixtures : **exclure
les fausses données a révélé une phrase qui n'était vraie que grâce à elles.**

La liste « à traiter » avait le même défaut : « aucun essai n'expire dans les 3 jours · aucune
boutique inactive · aucun paiement à vérifier » se lit comme un tableau de bord sain, alors
qu'il n'y avait simplement personne.

Autres écueils rencontrés dans le même écran :

- **Trois panneaux disaient « Aucune boutique cliente »** — on ne savait plus lequel parlait, et
  un test de rendu ne pouvait plus les distinguer (`Found multiple elements`). Trois états ⇒
  trois formulations.
- **Le SIGNAL prime sur la PHRASE.** La légende disait que les pastilles d'infrastructure ne
  peuvent pas rougir ; le point vert disait le contraire — l'œil croit la couleur. ⚠️ Le premier
  correctif a changé la couleur du point mais laissé `boxShadow: '0 0 6px var(--acc2)'` : **le
  signal s'était déplacé dans l'ombre.**
- **Un montant jamais encaissé** : le tiroir d'une boutique de démonstration annonçait
  « Valeur/mois : 25 000 FCFA », dans aucun agrégat. Neutralisé (`—`).
- **Deux nombres muets qui se contredisent** : l'onglet affichait « 0 » pendant que la liste
  montrait trois cartes. Il porte les deux (« 0 · 3 »). Les fixtures sont désormais **badgées SUR
  LA CARTE** — le rapport précédent affirmait qu'elles l'étaient, alors que seul un champ
  `isFixture` **non rendu** existait. *Une intention n'est pas un écran.*

Verrou : `adminConsoleTruth.test.tsx` (7).

## 2. Le champ déclaré qui se fait passer pour une mesure

Trois formes, et la troisième n'est visible depuis aucune des deux autres :

| Forme | Exemple mesuré | Ce qui trahit |
|---|---|---|
| **littéral dans un catalogue** | `INTEGRATIONS_LIST` portait `status:'connected'` ×11/12, plus `uptime:'99.9%'`, `calls:1847`, `lastCall:'Il y a 2 min'` | le NOM affirme une observation, la valeur est du texte dans un fichier |
| **colonne déclarée, JAMAIS écrite** | `lastLoginAt` (`schema.prisma:158`) — **0/8 comptes** en prod | rien n'est faux dans le code : c'est une **absence**, elle n'a pas de forme |
| **clé étrangère dans un compteur** | `okCount`/`allChecked` calculés sur `Object.keys(pingStatus)` | l'arithmétique naît à l'exécution, la source est valide |

**Le NOM est la moitié du correctif** : `status` → `declared: 'configured' | 'absent'`. L'état
RÉEL vient de `GET /api/integrations/status` (`lib/integrationStatus.ts`, adossé au
`providerMode()` **déjà existant** — ne pas en écrire un second). `sandbox` n'est **pas** une
nuance de `live` : c'est la différence entre encaisser et simuler.

### Une sonde vit avec sa carte

`checkSentryBackend()` était appelée depuis la page COMMERÇANT dont Sentry avait été retiré :
elle écrivait une clé de plus que de cartes affichées → **« 3/2 OK »** (numérateur >
dénominateur), `allChecked` = `3 === 2` **faux pour toujours**, « Joignables » figé sur `…` et la
barre sur « Vérification en cours… ». **Trois symptômes, une ligne.** La sonde n'était pas
manquante, elle était **au mauvais endroit**.

Et `pingableList` vide ⇒ `allChecked` vrai et `anyError` faux ⇒ barre **verte « Tous les
services opérationnels » sur ZÉRO sonde** — la vérité vacante, encore. Le titre disait « tous
les services » alors que 3 prestataires sur 5 ne sont pas sondables.

### `lastLoginAt`

Écrit par `POST /api/auth/login`, **après** les refus (mot de passe, compte actif) et en
**fail-open tracé** — une colonne d'affichage ne refuse pas une authentification.
`isOnlineNow` → **`loggedInRecently`** : on mesure une AUTHENTIFICATION, pas une présence.
L'absence de trace se dit **« Aucune trace »**, jamais « Jamais » : *un trou de mesure n'est pas
un fait sur la personne.*

### Le calibrage du scanner

⚠️ **Le premier critère était FAUX, et le calibrage l'a dit** : « une clé dont toutes les entrées
portent la même valeur » ne trouvait pas `status` — il valait `'connected'` onze fois et
`'disconnected'` une fois (PayDunya). *Un critère qui laisse passer le cas qui l'a motivé est
faux, pas prudent.*

La règle retenue vise le **VOCABULAIRE** (`status`, `uptime`, `calls`, `latency`, `online`…) dans
un catalogue de ≥ 3 entrées : **64 correspondances avant, 2 fichiers, zéro faux positif ailleurs**.

⚠️ La **première version du scanner rendait 2 correspondances sur 254 fichiers** en paraissant
propre : sa regex de tableau s'arrêtait au premier `]` d'un sous-tableau `features:[…]`.
**Analyse par appariement de délimiteurs, jamais par regex sur la structure.**

### Deux tests VERTS pour la mauvaise raison, attrapés par le sabotage

C'est le rappel le plus utile de ce chantier :

1. `integrationsRendered` faisait échouer `fetch` (jsdom n'a pas de réseau), donc `anyError`
   court-circuitait la branche testée et les **8 cas restaient verts sous sabotage** ;
2. le mock `bcrypt.compare` comparait le HASH et ignorait le mot de passe en clair, donc le cas
   « mot de passe faux » **ne produisait jamais d'échec**.

*Un test qui ne peut pas atteindre le chemin fautif ne garde rien.*

Verrous : `measuredNotDeclared.test.ts` (front, 5) · `lastLoginWritten.test.ts` (back, 6) ·
`integrationsRendered.test.tsx` (front, 8, DOM rendu).

## 3. La moyenne sans son dénominateur — `perf` / `rating`

`Employee.perf` et `Supplier.rating` étaient `Int NOT NULL DEFAULT 3`. Un employé jamais évalué
valait donc **3**, indiscernable d'un employé réellement noté 3 : une boutique neuve affichait
« Performance moy. **3,0/5** », un chiffre que personne n'avait saisi. Colonnes **nullables sans
défaut** depuis la migration `20260806170000_perf_rating_nullable`.

### L'information perdue ne se récupère pas

MESURÉ avant migration : aucun signal ne distingue un 3 saisi d'un 3 par défaut — l'audit RH
n'existe pas (`routes/employees.ts` n'appelle jamais `writeAudit`), et `updatedAt` est pollué par
des scripts en masse (10/10 lignes « modifiées », Δ de 45 s à 49 jours).

La décision sur les lignes existantes est donc un **choix assumé**, pas une déduction. Elle a été
rendue sûre par une preuve d'un autre ordre : les **20 valeurs** de production correspondaient
EXACTEMENT à ce que les seeds écrivent (**0 écart**), et **aucun tenant client n'existe** —
personne n'avait jamais saisi une note, et personne ne le pouvait.

### Les pièges rencontrés

- ⚠️ **Le filtre `.filter(e => e.perf)` n'écartait QUE `0`** — valeur impossible, l'échelle étant
  1..5. Il avait l'air de filtrer et ne filtrait rien. Comparer à `null`.
- ⚠️ **Côté fournisseurs, le NUMÉRATEUR était faux aussi** : `Number(sup.rating) || 0` divisé par
  `suppliers.length` faisait compter un non-évalué **pour zéro**. MESURÉ : un unique fournisseur
  noté 5 sur 3 affichait « **1,7** ».
- ⚠️ **`z.coerce.number()` transforme `null` en 0.** Poser `.nullable()` AVANT toute coercition
  (`ZodNullable` intercepte `null` sans appeler le schéma interne).
- ⚠️ **Cinq étoiles éteintes se lisent « 0/5 ».** `StarRating(null)` et la grille RH rendent
  « Non évalué ». Re-cliquer l'étoile courante **remet à non évalué** : sans ce retour, un clic
  accidentel serait définitif et l'état vide inatteignable.
- **Le seed laisse une partie NON évaluée** (`Fatoumata Ndiaye`, `TOMAPOR`, `Moussa Bamba`,
  `Distrib. Hygiène CI`) — *une démonstration qui note tout le monde ne montre jamais l'état vide.*

⚠️ **La règle a été EXÉCUTÉE CONTRE SON CAS DÉCLENCHEUR avant d'être gardée**, parce que le
verrou précédent (« constante à une seule valeur ») ratait PayDunya, donc ratait le défaut qui
l'avait motivé. Les deux formules d'origine sont rejouées depuis
`fixtures/rating-average.avant.txt` (extrait par `git show`) et le test prouve qu'elles rendent
« 0.0/5 » et « 1.7 ».

⚠️ Le scanner a rougi au premier tir **sur ses propres commentaires** — ceux qui citent la forme
interdite pour l'expliquer. `codeSeul()` retire les commentaires avant de conclure : *un scanner
qui lit les commentaires interdit d'expliquer ce qu'il interdit.* Il a par ailleurs trouvé un
site classé « correct » à la lecture (`NewOrderModal` `rating ?? 0`).

Verrou : `ratingDenominator.test.tsx` (19), 3 sabotages vérifiés.

## 4. Répartition paiements — quatre dénominateurs sur un seul camembert

MESURÉ le 2026-08-07. L'écran Rapports → Ventes portait, pour le même dessin et les mêmes
ventes, **quatre populations différentes**. Aucune n'était visible à la relecture : chacune était
correcte *localement*.

| Surface | Dénominateur | Sur `demo-tenant-001` |
|---|---|---|
| légende / infobulle | toutes les ventes chargées | Σ = **96 %** |
| donut (`percent` de recharts) | Σ des parts **rendues** | Σ = **101 %**, `cash` à 38 % vs 36 % |
| PDF imprimé, pied de tableau | **littéral `'100 %'`** | et un total en argent **court de 11 535 XOF** |
| KPI « Transactions » (juste au-dessus) | ventes de la **période** | **8** — contre « 50 transactions » sous le camembert |

⚠️ **La quatrième est la pire, et elle n'était pas dans la commande** : le sélecteur de période
n'agissait pas sur ce panneau. Sur `demo-tenant-002`, la carte annonçait **0 transaction**
pendant que le camembert en répartissait **50** avec assurance.

**Cause unique : une liste de modes RÉÉNUMÉRÉE en dur** (`cash · mobile · wave · orange · card`),
fausse dans les deux sens — `mobile` rendu alors que le serveur ne l'écrit **jamais** (0 sur
1 908 ventes), `mtn` et `mixed` écrits et **avalés**. Les 2 ventes avalées sur 50 sont tout
l'écart 96/101 : *tant que rien ne manque, les deux dénominateurs coïncident, et le défaut dort.*

### Le repli fabriqué était MORT

Le repli `62/22/16/8/5` (**Σ = 113 %**) ne s'atteignait jamais : `Reports.tsx` rendait déjà un
état vide 140 lignes plus haut. **Justesse empruntée** — il aurait resurgi au premier déplacement
de la garde. Le sous-titre « Données de démonstration » était le second vestige de la même
croyance.

### Le sabotage S4 est passé VERT au premier tir — leçon neuve

La règle « aucune ligne de TOTAL n'affirme son propre pourcentage » scrutait **la ligne**. Or ma
propre correction venait d'éclater la ligne du total sur six lignes : la règle était devenue
aveugle à la forme **que le code venait de prendre**.

> *Un verrou qui ne détecte pas son défaut dans la forme ACTUELLE du code ne garde rien.*

C'est distinct de l'angle « forme » (chercher ce qui ne peut pas exister) : ici la forme cherchée
existait hier et plus aujourd'hui. Réécrit par **appariement de crochets**.

### Calibrage — deux formulations rejetées avant la bonne

| Regex | Résultat |
|---|---|
| `/['"]100\s*%['"]/` | **87 fichiers** (tout `width: '100%'`) |
| `/['"]\d+ %['"]/` | 5 sites dont **4 légitimes** — les colonnes « taux » d'un bulletin de paie (`'100 %'` pour le salaire de base, `'25 %'` pour les heures sup) sont des constantes de **barème**, pas des totaux |
| **retenu** | pourcentage en dur **dans la même ligne de tableau** qu'un marqueur de total — 1 avant, 0 après |

### Deux pièges d'outillage rencontrés

- ⚠️ `expect` de **jest ne prend PAS de message** (c'est un vitest-isme) : passé quand même, il
  lève « Expect takes at most one argument ».
- ⚠️ Un commentaire JSX `{/* … */}` **ne peut pas vivre dans une liste d'attributs** (TS1005,
  commis deux fois) : l'ancrer au-dessus de l'élément.

Verrou : `paymentBreakdown.test.tsx` (18), cas déclencheur rejoué depuis
`fixtures/reports-paymentData.avant.txt`. Jumeau mobile : `salePaymentModesShared.test.ts` (4).
**5 sabotages vérifiés.**

## 5. Le total calculé sur ce qui est AFFICHÉ

**TROIS instances en deux jours**, même forme :

| Surface | Ce qui manquait au dénominateur |
|---|---|
| Répartition paiements (légende vs donut) | 2 ventes sur 50 → Σ = **96 %** / **101 %** |
| Tableau PDF des paiements | **11 535 XOF** absents d'un total imprimé, sous un « 100 % » littéral |
| Camembert « CA par catégorie » | la 7ᵉ catégorie et au-delà — **77 000 XOF** en mars sur `demo-002` |

⚠️ **`demo-tenant-001` a EXACTEMENT 6 catégories** — au catalogue comme dans ses ventes. Le
serveur tronquait à 6. La boutique de démonstration de référence était donc **pile sur la valeur
limite**, `perdu = 0` toujours : c'est ce qui explique que personne n'ait jamais vu le défaut.
`demo-tenant-002` en a **sept**, et il y était bien réel — **trois mois consécutifs**
(2026-03 : 77 000 · 04 : 27 500 · 05 : 65 600 XOF), en silence.

> **Une démonstration calée sur la valeur limite ne démontre rien : elle masque.**

### L'arrondi du Dashboard se trompait de 45 % en relatif

Le Dashboard corrigeait le **dernier** secteur à `100 − Σ` : la somme valait 100, mais toute
l'erreur atterrissait sur une seule part — la dernière, donc la plus petite. Mesuré sur la
distribution réelle de `demo-002` (mars, 7 catégories), la dernière part passait de **1 à 2 %**
sur une valeur exacte de **1,83 %**. Écart max par part : **0,83 pt → 0,56 pt**.

C'est l'origine du « dernier secteur diverge de ±1 » qu'avait attrapé l'assertion F1 de
`dashboard-donut.spec.ts`.

### Balayage de la classe — la « quatrième occurrence » N'EXISTE PAS

681 fichiers lus sur les trois workspaces (`.slice(0,N)` · `take: N` · `.head(`) : `analytics.ts`
était le **seul** site dont la troncature alimentait un dénominateur.

Les autres sont d'une autre nature et **correctes** — `export.ts` calcule `totalCA` **avant** son
`slice(0,30)` d'affichage, les barres de « Top produits » (web et mobile) sont relatives au
**maximum** et non à un total. *Écrit pour qu'on ne re-balaye pas cette classe en croyant qu'elle
est ouverte.*

⚠️ Le premier balayage a rendu **zéro correspondance** : `--include=*.ts` non quoté est mangé par
zsh. Un scan qui ne lit rien rend un résultat propre — **contrôle positif obligatoire** (ici :
`analytics.ts` contient `.slice(0, 6)`, le scan doit le trouver).

Verrou : `categoryBreakdown.test.ts` (9), exercé de **0 à 20 catégories**.

## 6. Console Ops — les fixtures ne sont pas des clients

MESURÉ le 2026-08-06, la console annonçait « 3 boutiques inscrites, toutes ont démarré » :

```
                AVANT      APRÈS
boutiques           3  →       0
comptes             7  →       0
ventes           1905  →       0
CA (XOF)     49 696 665  →      0        fixtures écartées et comptées à part : 4
```

⚠️ **Pas de drapeau `isFixture` en base**, bien que ce fût plus propre : le poser sur
`e2e-tenant` serait une MUTATION d'un tenant existant, interdite.

⚠️ **« ACTIF » AVAIT DEUX SENS sur le même écran** — l'onglet Boutiques disait « • Actif »
(ABONNEMENT) pendant que Vue d'ensemble disait « INACTIVE » (ACTIVITÉ) pour la même boutique.
Deux notions orthogonales : une boutique peut payer et ne rien vendre.

⚠️ **UNE PASTILLE QUI NE PEUT PAS ROUGIR NE PROUVE RIEN.** « Santé technique » lisait
`itg.status === 'connected'`, un **littéral** de `pages/Integrations.tsx` : aucune requête n'était
émise. Sonder Sentry/Resend/Twilio demanderait un relais serveur : **dette assumée, écrite plutôt
que masquée par du vert.**

## 7. Le libellé qui tronque — corriger la CONTRAINTE, pas la chaîne

DEUX occurrences dans la même session (« Marketing WhatsApp », puis « Paiements & cana… »),
toutes deux « corrigées » en raccourcissant l'étiquette. *Deux fois, ce n'est plus deux
accidents.*

**LA CAUSE** : l'état actif ne change **ni le padding ni la largeur** — il change la **GRAISSE**
(`--fw-regular` 500 → `--fw-bold` 800). Le même texte est donc plus large une fois sélectionné,
dans un conteneur identique. D'où une troncature qui n'apparaît **que sur l'élément actif**, et
qu'on ne voit jamais en relisant le code.

```
largeur utile d'un libellé = --sidebar − marge 16 − padding 20 − icône 30 − gap 8
  avant  220 − 74 = 146 px   → 21 caractères impossibles à toute graisse utilisable
  après  264 − 74 = 190 px   → budget 22 caractères, un de plus que le plus long
plus longs libellés : « Pannello di controllo » (it) et « Registro de actividad » (es), 21
```

⚠️ **L'espagnol et l'italien rallongent** — un libellé qui tient en français ne prouve rien.
`--sidebar` **264px** + `.nav-label` en `--fs-sm` (13 px) : à 14 px la marge restait de l'ordre du
pixel, et une marge de cet ordre se referme à la traduction suivante.

⚠️ **C'est un BUDGET DE CARACTÈRES, pas une mesure en pixels** : jsdom n'a ni police ni moteur de
rendu. L'hypothèse (`0,64 em/caractère` en graisse 800, volontairement haute) est écrite dans le
fichier ; **si une capture montre encore une troncature, c'est CE nombre qu'il faut relever — pas
le libellé qu'il faut raccourcir.**

Verrou : `navLabelWidth.test.ts` (4) — géométrie **LUE** dans `index.css`, libellés **DÉRIVÉS**
de `Sidebar.tsx`, budget vérifié dans les 4 langues, et une règle qui échoue si `.nav-item.active`
acquiert un `padding`/`width`/`border-width`. 2 sabotages vérifiés.

## 8. Le commentaire qui invente un repli

TROIS occurrences dans la même session, chacune justifiant une décision par un chemin qui
n'existait pas :

| Commentaire | Réalité mesurée |
|---|---|
| `LandingNav` : « le login reste accessible via le CTA / le hero » | **ZÉRO `<a href="/login">`** dans la page à 390, 360 et 320 px — ni nav, ni hero, ni pied. Le CTA dit « Créer ma boutique ». Un client existant sur téléphone ne pouvait pas se connecter |
| `CLAUDE.md` : « le parc store est en runtime 1.2.0 » | aucun parc — 1 seul `PushToken`, sur le tenant de démo |
| `quotaLimit` | rien n'indiquait que sa justesse tenait à l'ordre des gardes (→ `spendGuardStatusOrder.test.ts`) |

Le motif est constant : **l'affirmation est plausible, jamais exécutée, et personne ne la vérifie
parce qu'elle sert de justification à autre chose.**
