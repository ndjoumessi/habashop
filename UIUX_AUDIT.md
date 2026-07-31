# 🎨 Audit UI/UX — HabaShop (frontend web)

**Date :** 2026-07-31 · **Périmètre :** `apps/frontend/src` (34 pages, ~13 300 lignes + composants)
**Méthode :** mesures réelles sur le code (greps), pas d'estimation. Focus demandé : Clients + Stock.

---

## Constat central — à lire en premier

**HabaShop possède déjà une bibliothèque de composants mature et accessible.** L'audit standard recommande de *créer* `Field`, `ConfirmModal`, `IconButton`, `EmptyState` — **ils existent tous**, et `IconButton` **impose même un `label` obligatoire** (aria-label + title + hit-area 44px, commenté « règle la dette d'accessibilité »).

> La dette UI/UX de HabaShop n'est **pas** un manque de composants. C'est leur **adoption inégale** : les bons outils existent, mais la moitié du code les contourne.

Preuve chiffrée (mesurée à l'**AST**, après que 3 détecteurs regex aient menti) : **5 boutons** étaient icône-seule sans nom — dont la **suppression d'un employé** et 4 croix de fermeture/effacement. Tous **corrigés** (aria-label i18n), guard AST posé. Le vrai axe faible restant est le **responsive**.

---

## Synthèse

| Dimension           | Score | Statut |
|---------------------|-------|--------|
| Accessibilité       | 7/10  | 🟢 |
| Formulaires         | 6/10  | 🟡 |
| Cohérence visuelle  | 8/10  | 🟢 |
| Responsive          | 7/10  | 🟢 |
| Performance perçue  | 6/10  | 🟡 |
| Architecture code   | 7/10  | 🟢 |
| **TOTAL**           | **41/60** | 🟢 |

**Score global : 68 %** — base saine, plus mature que l'audit initial ne le croyait. Après mesure complète, les deux « axes faibles » annoncés se sont **dissous** : le responsive est assuré par `ResponsiveGrid` (38 fichiers), les KPI colorés sont un choix et non un bug. Le concret livré : **5 `aria-label` + 1 couleur de bouton**.

---

## 🔴 Problèmes critiques

### 1. Boutons icône-seule sans nom — 5 trouvés, corrigés
**Réel :** 5 `<button>` étaient de vrais contrôles sans nom (WCAG 4.1.2), tous lus à la main : `EditEmployeeModal:337` (**supprimer un employé**, destructif), `SectionShops:90` et `:126`, `StockTransfers:236` et `:257` (croix de fermeture / effacement). Corrigés par `aria-label` i18n.
**Leçon chère :** la question a demandé **six** mesures. Trois détecteurs texte ont donné trois réponses (≈500 → 67 → 39 → 0, puis 1, puis 2) — tous faux. Le `>` de `=>` dans `onClick={() => …}` casse tout `/<button.*?>/` et mal-découpe ~75 % des boutons. **Seul l'AST TypeScript a trouvé les 5 vrais**, confirmés à la lecture. C'est gravé ici parce que le doc prêchait déjà « l'accessibilité ne se mesure pas au regex » — et l'a réappris à ses dépens.
**Verrou :** `tests/iconButtonName.test.ts` scanne désormais à l'**AST** (+ assertion de couverture anti-scan-vide) ; 0 violation, rougit sur toute régression.

### 2. ~~Responsive quasi absent~~ — assuré (artefact de mesure)
**Réel :** le responsive n'est **pas** absent — il passe par `ResponsiveGrid` (`auto-fit/minmax`, responsive **sans media query**), adopté dans **38 fichiers**, plus des breakpoints Tailwind (`lg:grid-cols-4`) sur les grilles KPI. Le composant documente avoir réglé des causes racines « P0-1/P2-5 » : une passe responsive a déjà eu lieu.
**Erreur d'origine :** le grep `@media/isMobile/innerWidth` (4 pages) ne voyait NI `ResponsiveGrid` (auto-fit CSS) NI Tailwind — les deux vrais mécanismes. Même classe d'artefact que les boutons.
**Reste :** au cas par cas, les rares grilles `gridTemplateColumns` fixes inline pas encore passées à `ResponsiveGrid`. Finition ponctuelle, pas un chantier.

---

## 🟠 Problèmes majeurs

### 3. États « données rares » lus comme des échecs
**Impact :** le premier écran d'une boutique neuve semble cassé.
**Preuve :** Clients avec 1 client affiche « Panier moyen 0,00 € » et « Rétention 0 % » (`Customers.tsx:144,292`). `EmptyState` existe (`{ icon, title, message, action }`) mais ne couvre que le cas *zéro ligne*, pas le cas *données trop rares pour un KPI*.
**Fix :** distinguer *0 = pas de donnée* de *0 = mauvaise perf* : masquer/remplacer les KPI dérivés (rétention, panier moyen) par un `EmptyState` incitatif tant que le volume est sous un seuil.

### 4. `confirm()` natif résiduel
**Impact :** dialogue navigateur non stylé, non piégé au clavier, incohérent avec le reste.
**Preuve :** `ConfirmModal` custom (`await confirm({…})`) est adopté partout **sauf** `pages/Subscriptions.tsx:215` qui appelle le `confirm()` natif.
**Fix :** migrer cette ligne vers le `confirm()` maison. 1 ligne.

### 5. Association label→input faible
**Impact :** clic sur le label ne focalise pas le champ ; lien programmatique manquant.
**Preuve :** 203 inputs, 107 `<label>`, mais seulement **7 `htmlFor`**. Bon point compensatoire : **295 `aria-label`** (couverture correcte). `Field.tsx` existe (association `htmlFor`/`id` via `useId`) mais est peu utilisé.
**Fix :** router les champs de formulaire par `<Field>`, qui règle l'association automatiquement.

### 6. Couleur — 1 seul vrai smell (le reste est un choix), corrigé
**Réel :** les KPI colorés par métrique (violet/vert/orange/bleu) sont un **style dashboard délibéré**, pas un « vert succès » galvaudé — la rétention 0 % est en bleu, le panier en orange. Pas de bug là.
**Le vrai point, corrigé :** le bouton **« Commander »** de la bannière stock (`Stock.tsx:352`) était en **rouge** (`var(--danger)`) — couleur danger sur une action positive. Passé en primaire (`var(--c-purple-bg)` / `var(--p3)`), la paire déjà utilisée par la nav active (`index.css:344`) ; 3 rgba en dur disparaissent au passage. Seul changement couleur réel.
**⚠️ Contraste MESURÉ, pas supposé** (libellé sur le fond composé sur `--card`) : `--p3` rend **6,31:1 en sombre** et **4,44:1 en clair**, contre 5,17 / **2,46** pour le rouge d'avant — mieux sur les DEUX thèmes. `--p2`, d'abord retenu, faisait 4,48 / 3,04, soit une **régression du sombre sous AA**. Le clair reste **sous 4,5:1** : ce n'est pas propre à ce bouton, c'est la paire `--c-purple-bg`/`--p3` de toute la nav — **dette de palette à traiter en clair**, pas ici.

---

## 🟡 Améliorations mineures

- **Skeleton sous-adopté.** `Skeleton.tsx` existe déjà (style shadcn ; classe `.skeleton` + keyframe `shimmer` dans `index.css:404`), mais 23 pages gèrent un `loading` au **spinner seul** sans l'utiliser. Correction mesurée : contrairement à une première lecture, **aucun composant recommandé ne manque**. L'adopter pour la performance perçue.
- **Dispersion typographique.** ~25 valeurs de `fontSize` inline distinctes (concentrées sur 11/12/13 px mais longue traîne jusqu'à 56 px). Définir une échelle typo en tokens.
- **40 hex bruts résiduels** (sur 5 561 `var(--)`, soit 99,3 % tokenisé — excellent). Concentrés dans `Integrations.tsx` (15). Passer au script de tokenisation.
- **28 `<div onClick>`** (6 pages + 22 composants) : distinguer backdrops de modale (OK) des contrôles feuilles (→ `<button>`).
- **1 monolithe :** `POS.tsx` (1 396 lignes). À découper (modales, grille, barre KPI).

---

## 📊 Score UX par page (focus + pages notables)

| Page | Score | Points forts | Points faibles |
|------|-------|-------------|----------------|
| Customers | 65/100 | découpage propre (List/Modals/Stats), tokenisé | KPI données-rares, boutons page bruts, 0 responsive |
| Stock | 60/100 | tokenisé, statuts stock clairs | StockModals 32 btn/19 label, 0 responsive, marge invisible |
| AdminDashboard | 58/100 | aria correct (23) | 139 styles inline, 741 lignes |
| POS | 52/100 | a du responsive (7) | monolithe 1 396 lignes |
| Integrations | 50/100 | riche | 15 hex bruts, 100 inline, 982 lignes |
| Marketing | 45/100 | — | 1 aria / 704 lignes, 97 inline |

Rubrique : accessibilité 30 % + cohérence 25 % + responsive 20 % + loading 15 % + architecture 10 %.

---

## 🎯 Plan d'action

### Sprint 1 — Critique (semaine 1) : adopter l'existant + verrouiller
- [ ] Migrer les boutons icône-seule vers `<IconButton label={…}>` (priorité : StockModals, CustomersModals, tables d'action). Le label devient obligatoire par construction.
- [ ] **Règle d'enforcement** (ESLint custom ou meta-test) : interdire un `<button>` sans texte ni `aria-label`. Sans elle, la dette revient au prochain écran.
- [ ] Migrer `Subscriptions.tsx:215` du `confirm()` natif vers le `confirm()` maison.
- [ ] Adopter `<Skeleton>` (déjà présent) à la place des spinners sur 3-4 écrans data-lourds.

### Sprint 2 — Important (semaine 2-3)
- [ ] Généraliser `ResponsiveGrid` aux grilles KPI et tables (Clients, Stock, Dashboard) ; 2 breakpoints.
- [ ] Router les inputs de formulaire par `<Field>` (association `htmlFor`).
- [ ] Sémantique couleur : vert = deltas positifs seulement ; « Commander » en primaire ; état données-rares via `EmptyState`.
- [ ] Ajouter la **marge** (prix vente − prix achat) dans Stock — plus fort ajout de valeur métier.

### Sprint 3 — Optimisation (mois 2)
- [ ] Tokeniser les 40 hex résiduels (script fourni) + échelle typo.
- [ ] Découper `POS.tsx` (< 600 lignes/fichier).
- [ ] `<div onClick>` feuilles → `<button>`.

---

## 🧩 Composants — état réel

| Composant recommandé | Statut dans HabaShop | Action |
|----------------------|----------------------|--------|
| `IconButton` (label requis) | ✅ existe, bien conçu | **adopter** (18 fichiers seulement) |
| `Field` (htmlFor/id) | ✅ existe | **adopter** (7 htmlFor) |
| `ConfirmModal` / `confirm()` | ✅ existe, adopté | 1 résidu natif à migrer |
| `EmptyState` | ✅ existe | étendre au cas « données rares » |
| `ResponsiveGrid` | ✅ existe | **adopter** (7 pages) |
| `KPICard` | ✅ existe | — |
| `Skeleton` | ✅ existe (shadcn) | **adopter** (spinner-only, 23 pages) |

> Le vrai levier n'est pas d'écrire des composants, c'est de **faire respecter** ceux qui existent — par une règle qui rougit, comme le reste du dépôt.
