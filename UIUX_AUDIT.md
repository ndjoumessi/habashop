# 🎨 Audit UI/UX — HabaShop Frontend

**Date :** 2026-05-25 · **Périmètre :** `apps/frontend/src` (29 pages, 40 composants, 92 fichiers, ~21 500 lignes de pages)
**Méthode :** mesures réelles sur le code (greps sur inline-styles, ARIA, couleurs, inputs, responsive) + audit Lighthouse en prod. Aucune valeur inventée.
**Note :** Lighthouse n'a pu auditer que la **landing page publique** (a11y **100**, bonnes pratiques **100**, SEO **91**). Les pages **derrière le login** (`/app/*`) ne sont pas auditées par Lighthouse — or ce sont elles qui concentrent les problèmes ci-dessous.

---

## Synthèse

| Dimension | Constat chiffré | Verdict |
|-----------|-----------------|---------|
| Styles inline | **~3 500** blocs `style={{` (HR 469, Customers 261, Forecasts 218, POS 208) | 🔴 |
| Couleurs en dur | **21 pages** contiennent du hex brand (`#6C47FF`/`#5B4EE8`) **qui ne suit pas les 7 thèmes** (HR 123 hex, Customers 119) | 🔴 |
| Labels de formulaire | **184 inputs**, dont **5** avec `aria-label`, **2** avec `id`, **3** `<label htmlFor>`, **91** en placeholder-seul | 🔴 |
| Éléments interactifs non sémantiques | **30 `<div onClick>`** sur 11 pages (non focusables clavier) | 🟠 |
| Contraste (pages app) | Motif texte muet basse opacité **omniprésent** (HR 106 rgba<.5, Customers 101, POS 57) — non audité par Lighthouse | 🟠 |
| Échelle typographique | **21 tailles de police** inline distinctes (8→64px) | 🟠 |
| Échelle d'espacement | **267 valeurs de padding** distinctes, **18 `borderRadius`** distincts | 🟠 |
| Responsive (niveau page) | Quasi **aucun** `@media`/`useMediaQuery` dans les pages (repose sur 9 breakpoints globaux + flex/grid) | 🟠 |
| Structure | **3 pages > 1 800 lignes** (HR 2875, POS 1890, Customers 1807), monolithiques | 🟠 |
| Feedback utilisateur | `toast` dans **25/28** pages ✅ ; mais **6 `confirm()` natifs** ; loading states **10/28** ; empty states **18/28** | 🟡 |

> Le frontend est **riche et fonctionnel**, avec de bons composants de formulaire (`ValidatedInput`, `PhoneInputWithCountry`, `AddressAutocompleteInput`), un design soigné et un thème sombre cohérent visuellement. Les problèmes sont surtout d'**industrialisation** (design system non appliqué, styles inline, couleurs en dur) et d'**accessibilité des pages applicatives** (labels, clavier, contraste) — la landing publique, elle, est à 100.

---

## 1. Problèmes UI/UX par priorité

### 🔴 Critique

1. **Labels de formulaire absents (a11y bloquant).** Sur **184** champs (`input`/`select`/`textarea`), seulement **5** ont un `aria-label`, **2** un `id`, et **3** un `<label htmlFor>`. **91** champs s'appuient sur le `placeholder` comme seul libellé — anti-pattern : le placeholder disparaît à la saisie, n'est pas lu de façon fiable par les lecteurs d'écran, et échoue au critère WCAG 1.3.1/4.1.2. Concerne fortement HR (35 inputs), Stock (30), Expenses (17), Suppliers (13), Users (12), Customers (10), SignupPage (8), Onboarding (9).

2. **Thématisation cassée par les couleurs en dur.** L'app applique 7 thèmes via `data-theme` + variables CSS (`AppLayout.tsx:18`). Mais **21 pages** codent en dur des couleurs hex (`#6C47FF`, `#5B4EE8`, et ~700 hex au total : HR 123, Customers 119, LandingPage 42, Dashboard 39). Ces couleurs **ne changent pas** au switch de thème → rendu incohérent (ex. boutons/accents violets figés en thème clair/forest/ocean). Régression visuelle silencieuse sur 6 des 7 thèmes.

3. **Contraste non conforme sur les pages applicatives.** Le motif « texte muet en faible opacité » (`rgba(240,240,255,.42/.22)`, `text3`/`text4`) — corrigé sur la landing pour atteindre Lighthouse 100 — reste **omniprésent** ailleurs : HR 106 occurrences `rgba` alpha ≤ .5 + 79 `text3/4`, Customers 101+48, POS 57+38, Forecasts 53+34, Orders 41+33. Ces écrans n'étant pas derrière une URL publique, Lighthouse ne les a jamais audités ; ils échouent très probablement WCAG AA (4.5:1).

### 🟠 Majeur

4. **Éléments interactifs non sémantiques.** **30 `<div onClick>`** (Stock, HR, Customers, Orders, POS, Suppliers, Expenses, Users, Goals, Marketing, AdminDashboard) : non focusables au clavier, pas de `role="button"`/`tabIndex`/gestion `Enter`/`Espace`. Inaccessibles au clavier et aux lecteurs d'écran.

5. **Pages monolithiques.** HR **2 875** lignes, POS **1 890**, Customers **1 807**, Forecasts **1 361**, Orders **1 185** dans un seul composant mêlant logique, état, styles inline et markup. Difficile à maintenir, à rendre responsive et à tester ; favorise les incohérences.

6. **Absence de responsive au niveau page.** Pratiquement **aucun** `@media`/`useMediaQuery` dans les pages (seulement LandingPage 3, POS 3, SignupPage 2, LoginPage 1). Les écrans denses (tableaux POS/Stock/Orders, grilles HR) reposent uniquement sur les 9 breakpoints globaux d'`index.css` + flex/grid — risque élevé de débordements/illisibilité sur mobile, surtout vu les tailles fixes en px inline.

7. **ARIA quasi absent sur les écrans applicatifs.** Plusieurs grandes pages interactives ont **0** attribut `aria-`/`role` : Forecasts (1361 l.), AIAssistant, Payroll, Planning, Reports, Integrations, APIDocs, Onboarding. Les modales, onglets, listes et graphiques n'exposent pas leur rôle/état.

### 🟡 Mineur

8. **`confirm()` natifs (×6).** Boîtes de dialogue navigateur (style OS, non thématisées, non i18n) pour des confirmations de suppression — incohérent avec le reste de l'UI (modales custom + toasts). `alert()` : 0 ✅.

9. **États de chargement incohérents.** Seulement **10/28** pages exposent un état « loading » ; **18/28** un état vide. Les autres affichent potentiellement un écran vide pendant le fetch (pas de skeleton/spinner) ou aucun message quand la liste est vide.

10. **Échelles design non standardisées.** 21 tailles de police, 267 paddings, 18 rayons distincts → micro-incohérences visuelles partout (ex. `fontSize:11` vs `12` vs `13` pour des libellés équivalents, utilisés 200+ fois chacun).

---

## 2. Accessibilité (détail)

| Critère | État | Détail |
|---------|------|--------|
| Contraste (landing) | ✅ | WCAG AA — Lighthouse `color-contrast` PASS, score a11y **100** |
| Contraste (app `/app/*`) | 🔴 | Motif texte basse-opacité massif (HR 106, Customers 101…) — non vérifié, probable échec AA |
| Labels de champ | 🔴 | 5/184 `aria-label`, 91 placeholder-seul, 3 `<label htmlFor>` |
| Clavier / focus | 🟠 | `*:focus-visible` global ✅ + skip-nav ✅ (ajoutés), mais **30 `<div onClick>`** non focusables ; pas de focus-trap dans les modales |
| Rôles ARIA | 🟠 | ~152 attributs au total mais concentrés ; 8+ grandes pages à 0 `aria`/`role` |
| `prefers-reduced-motion` | ✅ | respecté globalement (`index.css`) |
| Images | ✅ | 2 `<img>`, 2 avec `alt` (l'UI est surtout icônes Lucide + emoji) |
| Langue | ✅ | `<html lang="fr">`, i18n 4 langues via `useI18n()` |
| Landmarks | 🟡 | `<nav aria-label>` (Sidebar) + `#main-content` ✅ ; mais peu de `<main>/<section>` sémantiques dans les pages (tout en `<div>`) |

**Top actions a11y :** (1) composant `Field`/`FormRow` avec `<label htmlFor>` + `id` généré, appliqué aux 184 inputs ; (2) remplacer les `<div onClick>` par `<button>` ; (3) rejouer la passe contraste (basse-opacité → `var(--text2/3)` opaques) sur les pages app ; (4) `role`/`aria-modal`/focus-trap sur les modales.

---

## 3. Incohérences visuelles

- **Couleurs.** Mélange variables CSS (`var(--p)`, `var(--text2)`) **et** hex en dur (~700 occurrences). Les hex en dur cassent les 7 thèmes (cf. Critique #2). Beaucoup de pages re-déclarent une palette locale (ex. `LandingPage`, `Forecasts`) au lieu de réutiliser les tokens globaux.
- **Typographie.** 21 tailles inline (8/9/10/11/12/13/14/15/16/17/18/20/22/24/26/28/30/32/36/56/64). Aucune échelle nommée → libellés « équivalents » rendus à des tailles différentes selon la page.
- **Espacements & rayons.** 267 valeurs de `padding` distinctes, 18 `borderRadius` (2→24 + 99). Pas de tokens d'espacement (4/8/12/16…) appliqués de façon cohérente.
- **Conséquence.** L'œil perçoit une UI « presque » cohérente, mais les écarts s'accumulent (alignements, rythme vertical, densités) entre pages développées à des moments différents.

---

## 4. Composants mal structurés / non responsive

- **Monolithes** : HR/POS/Customers/Forecasts/Orders (cf. Majeur #5) — à découper en sous-composants (header, filtres, table, modale, carte).
- **Styles inline omniprésents** : ~3 500 `style={{` → la logique de présentation vit dans le JSX, non réutilisable, non responsive (valeurs px figées). Migrer vers classes utilitaires/CSS modules + tokens.
- **Responsive** : tables larges (POS, Stock, Orders) sans stratégie mobile visible (scroll horizontal, cartes empilées) → cf. Majeur #6.
- **Positif** : `AppLayout` (shell + Suspense + lazy routes), `Sidebar` (nav sémantique), `BillingBanner`/`OfflineBanner`, et les inputs spécialisés (`ValidatedInput`, `PhoneInputWithCountry`, `AddressAutocompleteInput`) sont de bons composants réutilisables — la base existe, elle est juste sous-utilisée par les pages.

---

## 5. Formulaires — bonnes pratiques UX

| Bonne pratique | État |
|----------------|------|
| Label visible et associé (`htmlFor`/`id`) | 🔴 3/184 |
| `aria-label` à défaut de label | 🔴 5/184 |
| Placeholder comme aide (pas comme label) | 🔴 91 placeholders servent de label |
| Validation inline + messages | 🟡 `ValidatedInput` existe et est utilisé par endroits (HR…), mais pas généralisé |
| Saisie spécialisée (tél., adresse) | ✅ `PhoneInputWithCountry`, `AddressAutocompleteInput` |
| Feedback succès/erreur | ✅ `toast` (25 pages) |
| Confirmation destructive | 🟡 modales custom par endroits, mais **6 `confirm()` natifs** subsistent |
| États disabled/loading sur submit | 🟡 à vérifier page par page (loading global 10/28) |

**Recommandation :** un composant `<Field label … hint … error …>` encapsulant `<label htmlFor>` + `id` + `aria-describedby`, à substituer aux `<input>` bruts (gros gain a11y + cohérence en une passe).

---

## 6. Pages avec le plus de problèmes (classement)

| Rang | Page | Lignes | Inline | Hex en dur | `div onClick`/onClick | Inputs (labels faibles) | Contraste risque |
|------|------|-------:|-------:|-----------:|----------------------:|------------------------:|-----------------:|
| 1 | **HR** | 2875 | 469 | 123 | 66 | 35 | 106+79 |
| 2 | **Customers** | 1807 | 261 | 119 | 46 | 10 | 101+48 |
| 3 | **POS** | 1890 | 208 | 32 | 33 | 8 | 57+38 |
| 4 | **Forecasts** | 1361 | 218 | 34 | 16 | 0 | 53+34 (0 aria) |
| 5 | **Orders** | 1185 | 151 | 20 | 33 | 6 | 41+33 |
| 6 | **Stock** | 940 | 143 | 28 | 42 | 30 | 20+24 |
| 7 | **Settings** | 655 | 150 | 13 | 18 | 5 | — |
| 8 | **Expenses** | 716 | 114 | 10 | 29 | 17 | — |

---

## 7. Score UX estimé par page

**Rubrique (sur 100) :** Accessibilité 35 (labels, ARIA, clavier, contraste) · Cohérence visuelle 25 (hex vs tokens, inline) · Structure/maintenabilité 15 · Responsive 15 · Patterns UX 10 (loading/empty/feedback). Scores **estimés** à partir des métriques mesurées (seule la landing est validée par Lighthouse).

| Page | Score | Page | Score |
|------|------:|------|------:|
| LandingPage* | **74** | Notifications | 64 |
| APIDocs | 70 | UpgradePlan | 64 |
| Pricing | 68 | Goals | 63 |
| LoginPage | 67 | Activity | 62 |
| AdminDashboard | 64 | Integrations | 62 |
| Dashboard | 63 | Users | 61 |
| AIAssistant | 61 | Marketing | 61 |
| Suppliers | 60 | Payroll | 60 |
| SignupPage | 59 | Reports | 59 |
| Planning | 58 | Onboarding | 57 |
| Settings | 57 | Expenses | 57 |
| Stock | 54 | Orders | 54 |
| POS | 53 | Forecasts | 51 |
| Customers | 50 | **HR** | **48** |

\* Landing : a11y vérifiée **100** (Lighthouse) — pénalisée surtout par la densité de styles inline (146) et hex (42), pas par l'accessibilité.

**Moyenne pondérée estimée ≈ 60/100.** Plafond tiré vers le bas par les pages cœur-métier les plus utilisées (HR, Customers, POS, Stock, Orders).

---

## 8. Plan d'action recommandé (impact / effort)

1. **Composant `<Field>` + migration des 184 inputs** → labels associés (a11y critique, fort impact, effort moyen).
2. **Tokeniser les couleurs** : remplacer les hex en dur par `var(--…)` (répare les 7 thèmes ; commencer par HR/Customers/Dashboard). Fort impact visuel.
3. **Passe contraste sur `/app/*`** : basse-opacité → `var(--text2/3)` opaques (réutiliser la méthode validée sur la landing).
4. **`<div onClick>` → `<button>`** (30 occurrences) + focus-trap modales.
5. **Échelle design** : tokens de typo (6-8 tailles), d'espacement (4/8/12/16/24/32) et de rayon (6/10/14/99) ; lint pour interdire les valeurs hors-échelle.
6. **Découper HR/POS/Customers/Forecasts/Orders** en sous-composants + stratégie responsive (tables → scroll/cartes).
7. **Auditer `/app/*` avec Lighthouse authentifié** (via storageState Playwright) pour chiffrer l'a11y réelle des écrans applicatifs.

> Aucun fichier source modifié — ce rapport est purement analytique.
