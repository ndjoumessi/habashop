# AUDIT DESIGN WEB — HabaShop (Agent C)

> Audit lecture seule du 2026-06-10 sur `apps/frontend/src` (grep systématique).
> Référentiel : CLAUDE.md « Conventions de code » — le chantier couleurs est **CLOS**, avec
> exceptions intentionnelles (palettes sémantiques avatars/catégories/charts/shifts, styles
> Google Maps, templates PDF/print, pages publiques `.public-scope`, `#fff` sur boutons colorés,
> défs de thème `appStore.ts`). Cet audit distingue ces exceptions des violations résiduelles.

---

## 1. Métriques chiffrées (état avant)

| Métrique | Valeur |
|---|---|
| Hex littéraux totaux (`#xxx`/`#xxxxxx`, ts/tsx/css) | **1 090** |
| … dans fichiers d'exception déclarés¹ | **575** (53 %) |
| … hors fichiers d'exception | **515** |
| ……… dont `#fff`/`#000` (boutons colorés, knobs toggle, overlays scanner — légitime) | ~116 |
| ……… dont palettes sémantiques `*Shared.tsx` (légitime) | ~124 |
| ……… dont template print bulletin `pages/HR.tsx` (assimilable « template PDF ») | 25 |
| ……… dont couleurs de marque SVG `pages/Integrations.tsx` (légitime) | 20 |
| ……… **reste à trier (charts inline, gradients dupliqués, vraies violations)** | **~230** |
| `boxShadow`/`box-shadow` avec `rgba()` en dur (hors `var(--sh-*)`) | **79** |
| `boxShadow` tokenisés `var(--sh-*)` | 37 (32 %) |
| Tokens ombre existants | **OUI** : `--sh-xs/sm/md/lg/xl/p/p2/acc/acc2/glow` (index.css:62-92) — **non surchargés par thème** (aucun `--sh-` dans `THEMES` d'appStore.ts) |
| `font-weight`/`fontWeight` littéraux 600–900 | **461** |
| … par valeur : 500→2 · **600→150** · 700→73 · 800→52 · **900→163** | |
| Usages `var(--fw-*)` | 514 (53 % de tokenisation) |
| Échelle tokens graisse | `--fw-regular:500 · --fw-semibold:700 · --fw-bold:800` (index.css:83) → **600 et 900 sont HORS échelle** (313 occurrences) |
| Échelle espacement | `--sp-1:4 · sp-2:8 · sp-3:12 · sp-4:16 · sp-5:24 · sp-6:32` (index.css:78) |
| Spacing littéraux px (padding/margin/gap, tsx inline) | ~2 600 occurrences ; hors échelle les plus fréquents : **6px (330) · 10px (256) · 14px (160) · 5px (104) · 20px (87) · 18px (25) · 28px (19)** |

¹ `stores/appStore.ts` (192), `utils/export.ts` (67), `index.css` (58, défs de tokens), `styles/public.css` (26), `tests/` (13), `components/landing/*` + `components/signup/*` + pages publiques (Marketing, Pricing, Privacy, Login, Onboarding, UpgradePlan, PublicCatalog, APIDocs), `CustomerMap.tsx` (styles Google Maps), `LoyaltyCardDigital.tsx` (artefact PNG paliers, QR noir/blanc imposé).

---

## 2. Hex hardcodés — violations réelles vs exceptions

### Exceptions confirmées légitimes (NE PAS toucher)
- Palettes sémantiques : `customersShared.tsx` (types client), `hrShared/stockShared/posShared/planningShared/payrollShared/expensesShared` (~124 occ.), `DONUT_COLORS`/`RANK_COLORS` de `pages/Dashboard.tsx:18,30` (charts), barres catégories `ReportsTabs.tsx:331-361`.
- Marques : `pages/Integrations.tsx:22-122` (SVG Wave/WhatsApp/Google Maps/etc.).
- Codes-barres/QR : `StockModals.tsx:65-66` (`#FFFFFF`/`#000000` JsBarcode), `StockModals.tsx:340` (fond blanc autour de l'EAN) — règle « scanner = noir sur blanc opaque ».
- Template print bulletin : `pages/HR.tsx:380-430` (HTML imprimé, même statut que les PDF).
- Knobs de toggle `background:'#fff'` sur piste colorée (settingsShared:20, StockModals:530/563, POSCart:343, POSModals:346, EditUserModal:110/142, ExpenseDetailModal:97, Notifications:275).
- `#fff` sur boutons à fond gradient/coloré (~83 `color:'#fff'`).

### Violations réelles (top, fichier:ligne)

| # | Localisation | Problème |
|---|---|---|
| 1 | `components/stock/StockModals.tsx:96-97` | Bandeau warning **light-only** en dur : `background:'#FFFBEB'`, `border:#FCD34D`, `color:#92400E`, icône `#D97706`. Cassé visuellement dans les 7 thèmes sombres (bloc crème dans une modale sombre). Devrait utiliser `var(--warn)` + alpha. |
| 2 | `components/ui/Pagination.tsx:56` | `linear-gradient(135deg,#6C47FF,#8B6FFF)` = **copie exacte de `--grad-p`** (index.css:58). Remplacer par `var(--grad-p)`. |
| 3 | `pages/AIAssistant.tsx:205,213` (+ 7 autres occ. repo) | `linear-gradient(135deg,#6C47FF,#A991FF)` ≈ `--grad-p` dupliqué inline (9 occurrences de ce gradient exact dans src). |
| 4 | `components/ui/BillingBanner.tsx:49,65` | `linear-gradient(135deg,#FF3B5C,#FF6B6B)` ≈ `--grad-danger` (index.css:95) ; `#FFB800,#FF9500` ≈ `--grad-acc` (index.css:94). |
| 5 | `components/ui/ConfirmModal.tsx:73` | Gradient mixte `var(--danger),#dc2626` — moitié token, moitié hex (hex Tailwind étranger à la palette HabaShop). |
| 6 | `components/customers/CustomersModals.tsx:369-373` et `390-395` | Map de gradients par type client **dupliquée deux fois inline** dans le même fichier — devrait vivre dans `customersShared.tsx` à côté de la palette existante (l.30-43). |
| 7 | `pages/Integrations.tsx:158-160` | Statuts ok/slow/error en `#10B981/#F59E0B/#EF4444` alors que `--acc2/--warn/--danger` existent (statuts ≠ marques). |
| 8 | `components/customers/CustomersList.tsx:211-212`, `CustomerMap.tsx:335` | `#FFB800` pour points fidélité — `var(--warn)` existe ; jaune en dur = contraste douteux sur thèmes clairs (cf. §5). |
| 9 | `pages/Dashboard.tsx:339-342` | KPIs portent à la fois `color:'var(--p2)'` **et** `hex:'#6C47FF'` (double source de vérité couleur pour la même donnée). |
| 10 | `pages/ReportsTabs.tsx:119-132` | Area chart `stopColor/stroke #6C47FF` en dur alors que le fichier utilise déjà `useThemeColor('--text3', '#888')` l.30 — le pattern résolu existe dans le fichier même. |

**Verdict** : le chantier est bien « clos » au sens chrome applicatif (sidebar, header, panels = 100 % `var()`). Le résiduel réel ≈ **30-40 lignes**, concentré sur des **gradients dupliquant des tokens existants** et **1 vrai bug visuel** (StockModals:96).

---

## 3. Ombres — 79 `rgba()` inline pour 10 tokens existants

Les tokens `--sh-*` existent (index.css:62-69, 91-92) mais seulement **37 usages vs 79 hardcodés** (32 % d'adoption). Trois familles de hardcodés :

1. **Quasi-doublons de tokens** (remplacement trivial) :
   - `'0 24px 80px rgba(0,0,0,.5)'` (`NewOrderModal.tsx:51`) ≈ `--sh-xl`
   - `'0 12px 40px rgba(0,0,0,.6)'` (`NewOrderModal.tsx:172,223`, `AddressAutocomplete*.tsx:162/168`) ≈ `--sh-lg`
   - `'0 4px 16px rgba(0,0,0,.5)'` (`CustomerMap.tsx:392,399`) ≈ `--sh-sm`
   - `'0 4px 14px rgba(108,71,255,.4)'` (`AIAssistant.tsx:207`, `AdminDashboard.tsx:180`, `LandingNav.tsx:32`) ≈ `--sh-p`
   - `box-shadow:0 40px 100px rgba(0,0,0,.6)` dans `.modal` (**index.css:293 lui-même !**) et `BulletinModal.tsx:29` — pas de token « modal » alors que c'est l'ombre la plus répétée.
2. **Hover inline JS** (`el.style.boxShadow = '…rgba…'`) : LandingHero/CTA/Nav/Pricing, UserCard:43, Activity:333, AdminDashboard:209/332, StockInventory:187, POSProductGrid:226 — non tokenisables sans refactor, mais les valeurs pourraient lire `getComputedStyle`/classes CSS `:hover`.
3. **Ombres très sombres dans des composants utilisés en thème clair** : `PhoneInputWithCountry.tsx:237` (`rgba(0,0,0,.85)`), `AddressAutocomplete*.tsx` (`.8`) — voir §5.

⚠️ **Constat structurel** : les tokens `--sh-*` sont calibrés pour fond sombre (alpha .35→.8) et **aucun thème ne les surcharge** (zéro `--sh-` dans `THEMES`, appStore.ts). En light/soleil, toutes les ombres (tokens compris) restent des ombres « nuit » très lourdes. Un futur lot pourrait surcharger `--sh-*` dans les 2 thèmes clairs (alphas ÷3) — un seul endroit, effet global, zéro risque AA (le test ne couvre pas les ombres).

---

## 4. Graisses — 461 littéraux, dont 313 HORS échelle

Échelle déclarée : 3 graisses (`500/700/800`). Réalité :

| Valeur | Occurrences | Statut |
|---|---|---|
| `var(--fw-*)` | 514 | ✅ conforme |
| 700 littéral | 73 | = `--fw-semibold`, substitution **iso-rendu** |
| 800 littéral | 52 | = `--fw-bold`, substitution **iso-rendu** |
| 500 littéral | 2 | = `--fw-regular`, substitution **iso-rendu** |
| **600 littéral** | **150** | ❌ hors échelle (entre regular et semibold) |
| **900 littéral** | **163** | ❌ hors échelle (au-delà de bold) — usage réel : chiffres KPI en `var(--mono)` (ReportsTabs:48,78,95,191,226,390 ; POSCart ; UpgradePlan ×9 ; Onboarding ×7…) |

Le « 3 graisses » de CLAUDE.md n'est tenu qu'à ~53 %. Le 900 est un **usage typographique cohérent** (display numérique mono) → mérite un 4ᵉ token `--fw-display:900` plutôt qu'un écrasement à 800. Le 600 est du bruit → normaliser vers `--fw-semibold` (700) au cas par cas, ou l'assumer en alias `--fw-medium:600`. Décision d'échelle = à arbitrer avec Nelson ; la substitution iso-rendu (127 occ. de 500/700/800 → tokens) est, elle, **sans aucun risque**.

---

## 5. Mode Soleil / thèmes clairs — incohérences

Couverture actuelle de `tests/contrast-aa.test.ts` : paires **`--text2/3/4` × `--bg/bg2/bg3`** pour les 9 thèmes (AA ≥ 4.5), + présence des thèmes gold/light/soleil. **Non couvert** : accents sur fonds (`--p3`, `--warn`, `--acc2` sur bg), `#fff` sur boutons colorés, palettes sémantiques hex, ombres, états hover. Aucun des fixes proposés ici ne touche `--text*`/`--bg*` → **zéro risque de casser la CI contraste**.

Risques relevés pour light/soleil :
1. **`#FFB800`/jaunes en dur sur fond clair** : `CustomersList.tsx:211-212` (points fidélité), `CustomerMap.tsx:335`, `CustomersModals.tsx:500` (`#FFD700` Gold) — jaune pur sur blanc ≈ ratio < 2:1. `var(--warn)` est probablement ajusté par thème ; les hex, jamais.
2. **Ombres noires .8/.85 dans les dropdowns** (`PhoneInputWithCountry.tsx:237`, `AddressAutocomplete*.tsx`) : en soleil, halo charbon brutal autour d'un dropdown blanc.
3. **Tokens `--sh-*` non surchargés en thème clair** (cf. §3) — incohérence systémique plus que ponctuelle.
4. **Inverse** : `StockModals.tsx:96` est le seul bloc « light en dur » → correct en soleil, cassé dans les 7 thèmes sombres.
5. Knob toggle `#fff` sur piste `var(--border)` : en soleil, piste claire + knob blanc = affordance off/on faible (à vérifier visuellement, pas bloquant).

---

## 6. Top 5 composants `components/ui/` à polir

| Rang | Composant | Dette (hex/shadow/fw hors tokens) | Polish proposé |
|---|---|---|---|
| 1 | `BillingBanner.tsx` | 8 hex + 1 ombre + 3 fw | Gradients → `--grad-danger`/`--grad-acc` ; ombre → `--sh-*` ; ⚠️ contient un emoji UI `⚡` (l.65) contraire à la règle « Lucide uniquement » |
| 2 | `Pagination.tsx` | 3 hex + 1 ombre | l.56 : gradient = copie de `--grad-p` → `var(--grad-p)` |
| 3 | `PhoneInput.tsx` + `PhoneInputWithCountry.tsx` | 3 ombres + 2 fw | Ombres dropdown `.4/.85` → `--sh-lg/xl` (et bénéficieront d'une future surcharge thème clair) |
| 4 | `ConfirmModal.tsx` | 2 hex | l.73 : `#dc2626` étranger à la palette → gradient 100 % tokens |
| 5 | `PWAInstallButton.tsx` / `TabBar.tsx` | 2-4 chacun | Ombres `.4` → tokens ; TabBar:78 `#fff` sur fond actif = légitime (bouton coloré), à laisser |

**Bonus structurel** : il n'existe **pas de primitive `Toggle/Switch`** alors que le pattern knob-blanc-sur-piste est dupliqué inline dans ≥ 7 fichiers (settingsShared:20, StockModals:530/563, POSCart:343, POSModals:346, EditUserModal:110/142, ExpenseDetailModal:97, Notifications:275). C'est le candidat n°1 à une nouvelle primitive `components/ui/`.

---

## 7. Fixes SÛRS priorisés (iso-comportement, aucun risque contrast-aa)

Le test contrast-aa ne lit que `THEMES`/`--text*`/`--bg*` : aucun fix ci-dessous n'y touche.

| Prio | Fix | Effort | Fichiers |
|---|---|---|---|
| P1 | Bandeau warning StockModals → `color-mix`/rgba de `var(--warn)` (seul vrai bug visuel multi-thème) | XS | `StockModals.tsx:96-97` |
| P1 | `var(--grad-p)` à la place des copies du gradient primaire | XS | `Pagination.tsx:56`, `AIAssistant.tsx:205,213` (+6 occ.) |
| P1 | BillingBanner : `--grad-danger`/`--grad-acc` + remplacer l'emoji `⚡` par `<Zap/>` Lucide | XS | `BillingBanner.tsx:49,65` |
| P2 | Substitution iso-rendu des graisses : littéraux 500→`--fw-regular`, 700→`--fw-semibold`, 800→`--fw-bold` (127 occ., rendu strictement identique — script tsx, pas sed) | S | repo-wide |
| P2 | Décision d'échelle : ajouter `--fw-display:900` (163 occ. display mono) et statuer sur 600 (150 occ.) | S (après arbitrage) | `index.css:83` + repo |
| P2 | Ombres quasi-doublons → tokens (`--sh-lg/xl/sm/p`, ~15 occ. listées §3.1) + créer `--sh-modal: 0 40px 100px …` (utilisé par `.modal` ET BulletinModal) | S | NewOrderModal, AddressAutocomplete×2, CustomerMap, BulletinModal, index.css:293 |
| P2 | Statuts Integrations ok/slow/error → `--acc2/--warn/--danger` | XS | `Integrations.tsx:158-160` |
| P3 | Dédupliquer la map de gradients types client (×2 inline) vers `customersShared.tsx` | XS | `CustomersModals.tsx:369-395` |
| P3 | Surcharge `--sh-*` dans les thèmes light/soleil (alphas réduits) — 1 endroit, effet global | S | `appStore.ts` THEMES (light, soleil) |
| P3 | `#FFB800` fidélité → `var(--warn)` (contraste thèmes clairs) | XS | `CustomersList.tsx:211-212`, `CustomerMap.tsx:335` |
| P4 | Primitive `Toggle` ui/ (déduplique 7+ knobs inline) — petit refactor, à faire avec test d'ancrage | M | nouveau `components/ui/Toggle.tsx`² |
| P4 | Spacing : ne PAS mass-convertir (~2 600 occ.) ; documenter la demi-échelle de facto 6/10/14 (546 occ.) — soit l'ajouter en tokens `--sp-1_5/2_5/3_5`, soit normaliser au fil de l'eau | L (fil de l'eau) | repo-wide |

² ⚠️ FS macOS case-insensitive : ne pas nommer `Toggle.tsx` s'il existait un `toggle.tsx` shadcn — vérifié : absent de `components/ui/`, le nom est libre (contrairement à Button/Tabs/Tooltip).

---

## 8. Synthèse

Le design system tient sa promesse sur le **chrome applicatif** (nav, panels, modales = tokens partout) et la moitié des hex restants sont des exceptions documentées. La dette réelle se concentre sur : (1) **gradients/ombres inline qui dupliquent des tokens existants** (adoption `--sh-*` : 32 %), (2) **l'échelle de graisses non tenue** (313 littéraux hors échelle, dont un usage display 900 légitime à officialiser), (3) **un seul vrai bug multi-thème** (bandeau StockModals), (4) une **absence de surcharge des ombres en thème clair** qui pénalise le mode Soleil de façon systémique.
