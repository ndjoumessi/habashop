# Audit UI/UX Web — 12 pages (apps/frontend)

> Agent A — audit lecture seule du 2026-06-10. Chaque finding cité a été vérifié dans le code (fichier:ligne).
> Exceptions hex respectées (CLAUDE.md) : palettes sémantiques (avatars/catégories/charts/shifts/modes de paiement/types client), Google Maps, templates PDF/print, `.public-scope`, `#fff`/`#000` sur surfaces colorées, défs de thème `appStore.ts`.

## Points d'appui transversaux (vérifiés)

- ✅ `index.css:117` — `*:focus-visible { outline:2px solid var(--p2) }` global → le focus clavier est visible partout par défaut.
- ✅ `index.css:466-468` — `@media (hover:none)` rend `.customer-actions` toujours visibles au tactile… mais ce bloc ne couvre **que** cette classe.
- ✅ `components/ui/Skeleton.tsx` — shimmer via classe `.skeleton` sur `var(--bg4)/var(--bg5)` → compatible 9 thèmes (y compris Soleil).
- ⚠️ `index.css:153` — `.btn-ghost,.mini-btn { background:rgba(255,255,255,.04) }` : fond quasi nul en thème clair (la bordure `var(--border)` compense) — P3 cosmétique.
- ⚠️ `index.css:195` — `.input:focus { box-shadow:0 0 0 3px rgba(108,71,255,.15) }` : violet hardcodé global (toléré car violet verrouillé, mais hors tokens) — P3.
- Pattern récurrent n°1 : **catches silencieux** `.catch(() => {})` sur les fetchs de chargement ET certaines mutations → en cas d'échec API, l'écran reste vide ou l'UI locale diverge du serveur, sans aucun feedback.
- Pattern récurrent n°2 : modales avec `role="dialog" aria-modal="true"` ✅ mais **aucune** n'a `aria-labelledby` (vérifié : customers, suppliers, orders, pos).

## Tableau récapitulatif des scores (/100)

| Page | Skeletons | Empty/Error | A11y | Hex | Mode Soleil | Tactile | **Moyenne** |
|---|---|---|---|---|---|---|---|
| Dashboard | 80 | 55 | 80 | 95 | 90 | 85 | **81** |
| POS | 85 | 85 | 60 | 95 | 85 | 80 | **82** |
| Stock | 70 | 85 | 80 | 95 | 90 | 80 | **83** |
| Customers | 40 | 55 | 70 | 85 | 85 | 80 | **69** |
| Suppliers | 85 | 55 | 75 | 85 | 85 | 70 | **76** |
| Orders | 85 | 50 | 65 | 90 | 85 | 80 | **76** |
| HR | 70 | 90 | 55 | 90 | 85 | 65 | **76** |
| Planning | 85 | 85 | 35 | 95 | 75 | 45 | **70** |
| Payroll | 35 | 70 | 75 | 85 | 85 | 80 | **72** |
| Expenses | 75 | 55 | 70 | 80 | 70 | 65 | **69** |
| Reports | 85 | 75 | 65 | 90 | 85 | 60 | **77** |
| Settings | 55 | 70 | 70 | 75 | 80 | 80 | **72** |
| **Moyenne** | **71** | **69** | **67** | **88** | **83** | **73** | **75** |

Critères les plus faibles : **a11y (67)** et **empty/error (69)**. Le chantier hex/thèmes est globalement sain (les hex restants relèvent presque tous des exceptions documentées).

---

## Dashboard (`pages/Dashboard.tsx`)

Points forts vérifiés : skeletons KPI dédiés (`Dashboard.tsx:134-135`, rendu `:332-335`), Quick Actions = vrais `<button>` avec `aria-label={a.label}` **et** texte visible (`:389-391`), donut label `fill="#fff"` posé sur tranche colorée (`:44` — exempt), palettes `DONUT_COLORS`/`RANK_COLORS` = exception charts.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `Dashboard.tsx:147,197` | P2 | `.catch(() => {})` sur le chargement stats/activité : en cas d'échec API, KPIs à 0 et listes vides sans aucun message. | État `error` + message discret « Données indisponibles — réessayer ». |
| `Dashboard.tsx:435,453` | P2 | `<Suspense fallback={<div style={{height:190}}/>}>` (et 220) : trou vide pendant le lazy-load des charts alors que `Skeleton` existe. | `fallback={<Skeleton height={190} radius={12}/>}`. |
| `Dashboard.tsx:398-399,557-558` | P3 | Feedback hover-only (transform/boxShadow via onMouseEnter) sur Quick Actions et lignes d'activité ; rien d'équivalent au tactile (cosmétique — la navigation reste fonctionnelle, focus-visible global OK au clavier). | Optionnel : `:active { transform:scale(.98) }` via classe. |

## POS (`pages/POS.tsx`, `components/pos/`)

Points forts vérifiés : `loadingProducts`, panier vide explicite (`POSCart.tsx:146-151`), erreurs facture/historique → toast (`POSProductGrid.tsx:420`), palette modes de paiement (`POS.tsx:304-308`) = exception, `#fff` sur bouton coloré (`POS.tsx:611`) = exception.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `POSProductGrid.tsx:200-211` | P1 | Tuile produit = `<div onClick={() => addItem(p)}>` sans `role`, `tabIndex` ni handler clavier → l'action cœur du POS est inaccessible au clavier. | Passer en `<button type="button">` (reset styles) ou `role="button" tabIndex={0}` + Enter/Espace. |
| `POSCart.tsx:119-126` | P3 | Bouton « Vider le panier » 26×26 px (cible < 40 px) ; `title` présent, pas d'`aria-label`. | `aria-label` (reprendre le title) + zone cliquable ≥ 36-40 px (padding). |
| `POSProductGrid.tsx:128-129` | P3 | Bouton scanner caméra icon-only : `title` seul (nom accessible OK mais fragile). | Ajouter `aria-label` identique au title. |

## Stock (`pages/Stock.tsx`, `components/stock/`)

Points forts vérifiés : `EmptyState` utilisé, `role="toolbar"` sur la barre d'actions étiquettes (`Stock.tsx:338`), `IconButton` (label intégré) pour l'export, hex = palette catégories + `#fff` sur bouton coloré (`:363`) = exceptions.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `pages/Stock.tsx` | P2 | Aucun import `Skeleton` : pas d'état de chargement structuré pendant le fetch initial des produits (le composant existe et est utilisé ailleurs). | Skeleton de grille (6-8 tuiles) pendant `loading`. |
| `StockInventory.tsx:85-87` | P3 | Toggles vue grille/liste : `title` seul, pas d'`aria-label`, pas d'état exposé (`aria-pressed`). | `aria-label` + `aria-pressed={view==='grid'}`. |
| `Stock.tsx:399-400` | P3 | Hover-only (transform/shadow) sur cartes catégories — cosmétique. | Optionnel `:active` tactile. |

## Customers (`pages/Customers.tsx`, `components/customers/`)

Points forts vérifiés : `@media (hover:none)` corrige les actions hover-only des cards (`index.css:466-468` + commentaire `CustomersList.tsx:258`), empty states présents (`CustomersList.tsx:157-158, 274-275`), toggles vue avec `title` (`:43-48`), palette types client (`CustomersList.tsx:171-174`, `CustomerMap.tsx:9`) = exception sémantique, popup Maps = exception.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `Customers.tsx:33-36` | P1 | `customersApi.list().catch(() => {})` et **aucun état loading sur la page** : pendant le fetch (ou en cas d'échec), la liste affiche « Aucun client trouvé » — indiscernable d'une vraie liste vide. | État `loading` + `<Skeleton>` dans CustomersList, `toast.error` ou bandeau erreur au catch. |
| `CustomersModals.tsx:38,138,233,354` | P2 | 4 modales `role="dialog" aria-modal="true"` sans `aria-labelledby` ni `aria-label` → titre non annoncé par les lecteurs d'écran. | `id` sur le `<h3>` du header + `aria-labelledby` sur le backdrop (pattern à reproduire dans suppliers/orders/pos). |
| `CustomersModals.tsx:247,256,332` | P3 | Gradient décoratif rose hardcodé `#F472B6→#EC4899` (header modale). Branding « client » assumé, mais hors tokens. | Toléré ; sinon 2 vars dédiées. |
| `CustomersList.tsx:43-48` | P3 | Toggles vue : cible ~24-26 px, pas d'`aria-pressed`. | Padding ≥ 36 px + `aria-pressed`. |

## Suppliers (`pages/Suppliers.tsx`, `components/suppliers/`)

Points forts vérifiés : `Skeleton` pendant le chargement (SuppliersTable), ligne vide explicite (`SuppliersTable.tsx:156`), `title` sur tous les boutons d'action + `aria-label` contextualisé sur Supprimer (`:138-144`), modales `role="dialog"` ✅.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `Suppliers.tsx:32,116,135,155` | P1 | Catches silencieux sur load **et** update fournisseur : un échec de sauvegarde laisse l'UI locale modifiée sans rien dire (désynchro). | `toast.error` + re-fetch (ou rollback) au catch. |
| `suppliersShared.tsx:33-41` | P2 | `StarRating` purement visuel (5 icônes `Star`) : la note n'est pas exposée aux lecteurs d'écran. | Wrapper `role="img" aria-label={`${r}/5`}`. |
| `SuppliersTable.tsx:131-137` | P3 | Boutons Eye/Phone/Pencil : `title` seul (acceptable), icônes 12 px dans `.btn-sm` → cible ~26-28 px. | `aria-label` + padding pour ≥ 36 px. |
| `SuppliersTable.tsx:147` | P3 | `rgba(91,78,232,0.15)` violet hardcodé sur le bouton « Commander ». | `color-mix(in srgb, var(--p2) 15%, transparent)`. |

## Orders (`pages/Orders.tsx`, `components/orders/`)

Points forts vérifiés : `Skeleton` (`OrdersListPanel.tsx:143`), empty state (`:211`), modales `role="dialog"` ✅, nav calendrier avec texte visible (`OrdersCalendar.tsx:21,29`), `cfg.color` statuts + KPI hex = palettes sémantiques (exception), `#f8f7ff` (`Orders.tsx:187`) dans un template HTML imprimable (exempt).

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `Orders.tsx:27,64,79,90,110,156` | P1 | 6 catches silencieux, dont `updateStatus` (`:110`) : un changement de statut peut échouer côté serveur en restant affiché côté client, sans feedback. | `toast.error` + rollback/re-fetch sur les mutations ; bandeau erreur au load. |
| `OrdersListPanel.tsx:112-117` | P2 | Filtres de statut : état sélectionné rendu uniquement par la couleur, pas d'`aria-pressed`. | `aria-pressed={statusFilter === s}`. |
| `NewOrderModal.tsx` (~l.117-180) | P2 | Autocomplete client (input + dropdown `:153,178`) sans pattern combobox ARIA (`role="combobox"`, `aria-expanded`, `aria-controls`). | Appliquer le pattern ARIA combobox ; navigation flèches optionnelle. |
| `OrderDetailModal.tsx:95` | P3 | `#059669` hardcodé dans le gradient du bouton (avec `var(--acc2)`). | Remplacer par une déclinaison de `var(--acc2)` (color-mix). |

## HR (`pages/HR.tsx`, `components/hr/`)

Points forts vérifiés : toasts d'erreur systématiques (10 refs), `EmptyState` (`HR.tsx:556`), rollback de `saveAttendance`, skeletons vue grille (`HREmployeeGrid.tsx:78-90`), `<th scope="col">` ✅, bulletin imprimable (`HR.tsx:387-430`) = template print exempt, `#000` sur badge `var(--acc)` (`HR.tsx:546`) = équivalent exception.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `HREmployeeGrid.tsx:55-66` | P1 | Toggles vue grille/table : boutons icon-only 28×28 px **sans aria-label ni title** + `#fff` fixe sur `var(--p)` (OK) mais cible < 40 px. | `aria-label` 4-langues + `aria-pressed` + taille ≥ 36 px. |
| `HREmployeeGrid.tsx:~205` | P2 | Lignes du tableau cliquables (`<tr onClick>` + cursor:pointer) sans `tabIndex`/handler clavier → édition employé inaccessible au clavier en vue table. | Bouton « Modifier » explicite dans la ligne, ou `tabIndex={0}` + Enter. |
| `HREmployeeGrid.tsx:78-90 vs 188+` | P2 | Skeleton uniquement en vue grille ; en vue table, `loadingEmployees` n'affiche rien (tableau vide). | Réutiliser `<Skeleton height={34} count={6}/>` dans un `<td colSpan>` (pattern OrdersListPanel:143). |

## Planning (`pages/Planning.tsx`, `components/planning/`)

Points forts vérifiés : `Skeleton` (PlanningGrid:102, PlanningMonth:44), empty states, toasts + rollback optimiste atomique, cellules ≥ 58 px, couleurs `SHIFT_TYPES` = exception documentée.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `PlanningGrid.tsx:174-182,238-247` | P1 | Déplacement de shift = **drag&drop natif uniquement** (`draggable` sur divs, `onDrop`/`onDragOver`) : impossible au clavier et au tactile (HTML5 D&D ne fonctionne pas au doigt). L'assignation par tap reste possible (clic cellule → modale) mais pas le déplacement. | Ajouter « Déplacer vers… » dans la modale d'assignation/chip (sélecteur jour) — comportement identique, chemin alternatif. |
| `PlanningGrid.tsx:191` | P1 | Suppression d'un shift par `onDoubleClick` uniquement : fragile au tactile, impossible au clavier, et totalement non découvrable. | Bouton supprimer (X) sur le chip ou dans la modale. |
| `PlanningGrid.tsx:183-190` + `PlanningMonth.tsx:70` | P2 | Cellules cliquables = divs sans `role="button"`/`tabIndex` → la grille entière est invisible au clavier. | `role="gridcell"` + `tabIndex={0}` + Enter = ouvrir l'assignation. |
| `PlanningGrid.tsx:254,262` | P3 | Texte en `s.color` (couleur shift pleine) sur fond `${color}66`/teinté : contraste non garanti en Mode Soleil (le test contrast-aa couvre les tokens, pas ces mix). | Vérifier les 6 couleurs SHIFT_TYPES sur fond clair ; sinon texte `var(--text)` + pastille colorée. |

## Payroll (`pages/Payroll.tsx`, `components/payroll/`)

Points forts vérifiés : `EmptyState` (`Payroll.tsx:126`), `aria-label` sur PDF et close (PayrollTable:99, BulletinModal:54), boutons à texte visible, `PAY_COLORS` = palette avatars (exception), `rgba(255,255,255,.2)` du header BulletinModal posé sur gradient violet fixe (OK en Soleil).

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `Payroll.tsx:30-51` | P1 | **Aucun état de chargement** (ni flag, ni Skeleton) : tableau et KPIs vides pendant `employeesApi.list()` ; `catch(() => {})` silencieux (`:51`) → échec = page « vide » sans explication. | `loading` + `Skeleton` (KPIs + lignes) + `toast.error` au catch. |
| `BulletinModal.tsx:217` | P3 | `#059669` hardcodé dans le gradient du bouton « Marquer payé ». | Décliner `var(--acc2)` (même fix que OrderDetailModal:95). |

## Expenses (`pages/Expenses.tsx`, `components/expenses/`)

Points forts vérifiés : `Skeleton` + `EmptyState` dans ExpensesJournal, toasts succès sur les mutations, `title` sur les mini-btn d'action (`ExpensesJournal.tsx:135-138`), checkbox récurrente avec `accentColor` + label lié.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `Expenses.tsx:43,152,159,174,191` | P1 | Catches silencieux sur load **et mutations** (markPaid/delete/update `_apiId`) : l'état local est modifié même si l'API échoue → données divergentes au prochain reload, sans feedback. | `toast.error` + rollback de l'état local au catch. |
| `ExpenseDetailModal.tsx:95-99` | P2 | Toggle custom (vrai `<button>` ✅) sans `aria-pressed`/`role="switch"` ; knob `background:'#fff'` sur piste `var(--bg4)` à l'état OFF → quasi invisible en Mode Soleil (piste claire). | `aria-pressed={recurrent}` + knob `var(--card)` + `border:1px solid var(--border)`. |
| `ExpensesJournal.tsx:124-126` | P3 | Badges statut : `rgba(14,196,126,…)`/`rgba(240,165,0,…)` = valeurs de `--acc2`/`--acc` figées en dur (le texte utilise bien les vars). | `color-mix(in srgb, var(--acc2) 15%, transparent)`. |
| `ExpensesJournal.tsx:135-138` | P3 | Mini-btn d'action : cible ~27 px de haut (`.mini-btn` padding 7px). | Padding vertical ≥ 9-10 px ou min-height 36 px. |

## Reports (`pages/Reports.tsx`, `components/reports/`)

Points forts vérifiés : `Skeleton` au chargement (`Reports.tsx:188`), `EmptyState` (`:201`), état erreur InventoryInsights (`InventoryInsights.tsx:49-53`), label donut `fill:'#fff'` (`ReportsTabs.tsx:95`) posé **sur la tranche colorée** = exempt et lisible en Soleil, palette paiements + `#6C47FF` area chart = exception charts.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `ReportsTabs.tsx:201-213` | P2 | Lignes de légende du donut : highlight `onMouseEnter/Leave` uniquement, avec `cursor:pointer` **sans onClick** → affordance trompeuse et aucun équivalent tactile/clavier. | `onClick={() => setActivePayIndex(i === activePayIndex ? null : i)}` + `onFocus`/`tabIndex` (visuel inchangé). |
| `InventoryInsights.tsx:46-53` | P2 | Loading = phrase texte (pas de Skeleton) ; état erreur sans bouton « Réessayer ». | `<Skeleton height={56} count={3}/>` + bouton retry rappelant le fetch. |
| `ReportsTabs.tsx:119-132` | P3 | `#6C47FF` (gradient + stroke area chart) : exception charts admise, mais ne suivra pas un éventuel changement d'accent. | Toléré (chantier clos) ; option : lire `--p2` via getComputedStyle. |

## Settings (`pages/Settings.tsx`, `components/settings/`)

Points forts vérifiés : toasts sur Shop/POS/Catalog/ownerPhone (`SectionNotif.tsx:80-81`), `loading` dans SectionCatalog, inputs Security avec aria-labels, `#25D366` = brand WhatsApp (exempt), `IconButton` dans AccountingReportModal.

| Réf | Sév | Finding | Fix |
|---|---|---|---|
| `SectionNotif.tsx:30,55` | P2 | `tenantApi.update(...).catch(() => {})` sur les **toggles de notification** : un toggle peut s'afficher activé sans avoir été sauvegardé (et le load `:30` est silencieux). | Au catch : revert du toggle + `toast.error` (pattern déjà présent pour ownerPhone `:81`). |
| `SectionShop.tsx` / `SectionPOS.tsx` / `SectionNotif.tsx` | P2 | Fetch `tenantApi.get()` sans état de chargement → flicker valeurs par défaut → valeurs réelles (SectionCatalog gère, lui, un `loading`). | Skeleton de section ou rendu différé tant que le tenant n'est pas chargé. |
| `Settings.tsx:74-101` | P2 | Nav sections (sidebar) : état actif rendu par la couleur seule, pas d'`aria-current`. | `aria-current={isActive || undefined}`. |
| `SectionLang.tsx:71,73` + `SectionPOS.tsx:227` + `SectionShop.tsx:74` | P3 | `rgba(108,71,255,…)` violet hardcodé pour les états sélectionnés/tints (≠ tokens ; visuellement stable car violet verrouillé). | `color-mix(in srgb, var(--p) 10%, transparent)`. |

---

## TOP 15 fixes priorisés (a11y/visuel uniquement, comportement fonctionnel inchangé)

| # | Sév | Fix | Fichiers | Effort |
|---|---|---|---|---|
| 1 | P1 | Tuile produit POS → `<button>` (ou role+tabIndex+Enter) : l'action n°1 de l'app devient accessible clavier | `POSProductGrid.tsx:200-211` | S |
| 2 | P1 | Feedback d'erreur sur les catches silencieux de **mutations** (statut commande, dépenses markPaid/delete/update, update fournisseur) : `toast.error` + rollback | `Orders.tsx:110,156` · `Expenses.tsx:152-191` · `Suppliers.tsx:116-155` | S |
| 3 | P1 | État loading + Skeleton sur **Payroll** (page entièrement muette pendant le fetch) | `Payroll.tsx:30-51` | S |
| 4 | P1 | État loading + Skeleton + erreur sur **Customers** (vide silencieux confondable avec « aucun client ») | `Customers.tsx:33-36` + `CustomersList.tsx` | S |
| 5 | P1 | Alternative tactile/clavier à la **suppression de shift** (bouton X sur chip/modale, en plus du double-clic) | `PlanningGrid.tsx:191` | S |
| 6 | P1 | Alternative au **drag&drop Planning** : « Déplacer vers… » dans la modale d'assignation | `PlanningGrid.tsx:174-247` + `AssignShiftModal` | M |
| 7 | P1 | `aria-label` + `aria-pressed` + cible ≥ 36 px sur les toggles vue HR (aucun nom accessible aujourd'hui) | `HREmployeeGrid.tsx:55-66` | S |
| 8 | P2 | `aria-labelledby` sur toutes les modales `role="dialog"` (id sur le titre) — 10+ modales, pattern mécanique | `CustomersModals.tsx:38…` + suppliers/orders/pos | S |
| 9 | P2 | Toasts d'erreur sur les catches silencieux de **chargement** (Dashboard, Suppliers, Orders, Expenses, SectionNotif) | `Dashboard.tsx:147,197` etc. | S |
| 10 | P2 | `aria-pressed` sur les boutons-filtres à état (statuts Orders, toggles vue Stock/Customers, devises SectionLang) | `OrdersListPanel.tsx:112` · `StockInventory.tsx:85` · `CustomersList.tsx:43` | S |
| 11 | P2 | Fallbacks `Suspense` du Dashboard → `<Skeleton>` au lieu de divs vides | `Dashboard.tsx:435,453` | XS |
| 12 | P2 | Légende donut Reports : `onClick`/`onFocus` en plus du hover (le `cursor:pointer` actuel ne fait rien au clic) | `ReportsTabs.tsx:201-213` | XS |
| 13 | P2 | Toggle récurrent Expenses : `aria-pressed` + knob `var(--card)`+border (lisible en Mode Soleil à l'état OFF) | `ExpenseDetailModal.tsx:95-99` | XS |
| 14 | P2 | `StarRating` : wrapper `role="img" aria-label="n/5"` | `suppliersShared.tsx:33-41` | XS |
| 15 | P2 | Vue table HR : skeleton de chargement (pattern OrdersListPanel:143) + accès clavier aux lignes cliquables | `HREmployeeGrid.tsx:78-90,205` | S |

**Hors TOP 15 (P3 groupables en un sweep cosmétique)** : violets/verts hardcodés en `rgba`/hex isolés → `color-mix` sur tokens (`SuppliersTable.tsx:147`, `OrderDetailModal.tsx:95`, `BulletinModal.tsx:217`, `SectionLang.tsx:71,73`, `SectionPOS.tsx:227`, `ExpensesJournal.tsx:124-126`, `index.css:195`) ; `aria-label` doublant les `title` existants ; cibles tactiles < 36 px des `.mini-btn`/toggles.

## Bilan des findings

- **P0 : 0** — rien de cassé/bloquant ; le socle (focus-visible global, dialogs aria-modal, Skeleton/EmptyState primitives, test contraste AA 9 thèmes) est solide.
- **P1 : 9** — accessibilité clavier du POS et du Planning, pages muettes (Payroll, Customers), erreurs silencieuses sur mutations (Orders, Expenses, Suppliers), toggles HR sans nom accessible.
- **P2 : 16** — aria-labelledby modales, aria-pressed manquants, skeletons partiels, flicker Settings, légende Reports hover-only.
- **P3 : ~19** — cosmétique : hex/rgba isolés hors tokens, titles sans aria-label, cibles tactiles un peu petites, hover-enhancements sans équivalent tactile.

Claims écartés après vérification (faux positifs d'analyse intermédiaire) : Quick Actions Dashboard ont bien `aria-label` + texte (`Dashboard.tsx:391`) ; le `#fff` des labels donut (`ReportsTabs.tsx:95`, `Dashboard.tsx:44`) est posé sur tranche colorée donc lisible dans tous les thèmes ; le composant `Skeleton` est bien thémé via `var(--bg4)/var(--bg5)` (pas de blanc hardcodé).
