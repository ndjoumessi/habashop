# HabaShop — Guide Claude Code

SaaS de gestion commerciale multi-tenant **et multi-boutiques** (boutiques/superettes, Afrique de l'Ouest). **Monorepo unique `habashop`** : web (npm workspaces `apps/*`) + `mobile/` (Expo, hors workspaces) + `legal/` (pages légales).

## Stack

- **Frontend** (`apps/frontend`) : React 18 + TS + Vite 8 + vitest 4, Zustand (persisté localStorage), React Router ≥6.30.4, Lucide, recharts, jsbarcode (EAN-13/EAN-8/UPC-A), @zxing (scan), qrcode+html2canvas (fidélité), jspdf (étiquettes thermiques, **import dynamique**), cmdk (GlobalSearch), Playwright E2E, Sentry (org **haba-76** / projet **habashop-web**), PWA vite-plugin-pwa 1.x. Chunks `charts`/`barcode`/`canvas`/`pdf` EXCLUS du precache (runtime CacheFirst `lazy-chunks-cache`) — préserver si on touche `vite.config.ts`.
- **Backend** (`apps/backend`) : Fastify 5 + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend, pdfkit, twilio, `@anthropic-ai/sdk ^0.96.0` (OCR Vision), `@fastify/multipart`, `@fastify/rate-limit` (**global**), **validation déclarative zod** (`fastify-type-provider-zod`, `validatorCompiler` global — cf. § Sécurité).
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF**), multi-langues (fr/en/es/it).

## Structure du repo (monorepo)

Un seul repo `ndjoumessi/habashop` depuis juillet 2026 — fusion de `habashop-mobile` et `habashop-legal` via `git subtree` (historique préservé) :

- `apps/frontend`, `apps/backend` → **web** (workspaces racine `apps/*` + `packages/*`).
- `mobile/` → **app Expo** (ex-`habashop-mobile`). **Hors workspaces npm** : `package.json` + `package-lock.json` propres → `npm ci` à lancer *dans* `mobile/`. Builds/OTA EAS depuis `mobile/` (`cd mobile && eas update --branch preview`). Projet EAS inchangé (`projectId e7399d7a-…`, canal `preview`).
- `legal/` → **pages légales** (ex-`habashop-legal`). Publiées via `.github/workflows/pages.yml` sur **`https://ndjoumessi.github.io/habashop/legal/`** (suppression compte : `.../legal/account-deletion.html`). ⚠️ URL référencée dans Google Play Console.

## Commandes courantes

**⚠️ Node défaut = v10 → casse tout.** Toujours en premier (vaut pour dev, tests, builds ET déploiements) :
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

```bash
npm run dev                                  # front (5173) + back (3001) via concurrently — ou --workspace=apps/backend pour l'API seule
cd apps/frontend && npx vitest run           # tests front COMPLETS (requis avant push landing/login/thème)
cd apps/backend  && npx vitest run           # tests back
npx vitest run src/tests/foo.test.ts         # un seul fichier — depuis le workspace concerné (idem front src/**/*.test.ts*)
cd apps/frontend && npm run e2e              # Playwright live prod (tenant e2e) ; un spec : npx playwright test e2e/pos.spec.ts
npx tsc --noEmit                             # typecheck — dans chaque workspace touché
npm run lint --workspaces                    # eslint front+back
```

⚠️ `README.md` est **daté** (Fastify 4, 7 thèmes, 22/8 tests, « vercel depuis apps/frontend »…) — en cas de conflit, **ce fichier fait foi**.

## Déploiement

**Frontend Vercel** — TOUJOURS depuis la **racine** (jamais `apps/frontend` → path doublé = échec) :
```bash
vercel --prod --yes
```

**Backend Railway** — service `habashop`, projet `grateful-happiness` :
```bash
railway up --ci   # depuis la racine
```
Auto-deploy GitHub sur push `main` (lag ~20-25 min → `railway up --ci` pour forcer).
**Déploiement couplé : Railway D'ABORD, puis Vercel.**

**Rituel commit** : `npx tsc --noEmit` (0) → `npm test` (verts) → `npm run build` (OK) → commit/push `main`. Git : push direct sur `main`, pas de feature branch.

## Versionnage ⚠️ SOURCE UNIQUE

**La version PRODUIT vit dans UN SEUL endroit : `version` du `package.json` RACINE** (actuellement **2.6.0**). Tout affichage/retour de version en dérive — **jamais de littéral en dur** (on a eu 6 versions divergentes : admin 2.6.0, /health 2.1.0, /health-extended 2.3.0, /api/docs 2.0.0, sidebar 1.0.0…).
- **Web** : injectée au build par Vite (`vite.config.ts` lit `../../package.json` racine) → `__APP_VERSION__` (brut « 2.6.0 ») + `__BUILD_SHORT__` (« v2.6.0 · JJ/MM », sidebar) + `__BUILD_ID__` (horodatage+SHA, `title`/Réglages). `AdminDashboard` utilise `__APP_VERSION__`. ⚠️ NE PAS lire `apps/frontend/package.json` (resté à 1.0.0).
- **Backend** : `getAppVersion()` (`src/lib/version.ts`) lit le `package.json` racine au boot (remonte jusqu'à `name === 'habashop'`, robuste dev/dist/cwd) → `/health`, `/api/health-extended`, `/api/docs` renvoient tous la même.
- **Garde** : méta-tests `versionSource.test.ts` (front + back) — échouent si un semver entre guillemets réapparaît dans `src/` (même principe que le méta-test quiet zones). Un repli non-semver (`'0.0.0-unknown'`) est toléré.
- **QUAND bumper** (sinon la version se fige comme les `package.json` se sont figés à 1.0.0) : **à chaque release fonctionnelle visible**, éditer la racine avant déploiement — `npm version <patch|minor|major> --no-git-tag-version` à la racine (patch = fix, minor = feature, major = rupture). Fait partie du rituel de release.
- **Mobile = piste SÉPARÉE, NE PAS aligner** ⚠️ : `mobile/app.json` `version` (1.5.0) pilote le `runtimeVersion` (policy `appVersion`) → c'est un **paramètre fonctionnel de l'OTA**, pas un numéro d'affichage. L'aligner sur la version produit **casserait la continuité OTA** (les installs existantes ne recevraient plus les updates jusqu'à réinstallation). Réglages mobile affiche `Constants.expoConfig.version` (= app.json) : c'est **intentionnel**, ne pas « corriger » cette divergence.

## Pièges critiques

- **`DATABASE_URL` = DB PROD Railway.** JAMAIS `migrate dev/reset/seed` sans confirmation. `prisma db push` OK pour ajouts sans data loss. Migration additive : `ADD COLUMN IF NOT EXISTS` + `prisma migrate resolve --applied`.
- **`apps/frontend/.env` tracké par git** → JAMAIS de secret. `.env.local` gitignored (`SENTRY_AUTH_TOKEN` build-side).
- **Logs Railway** : `railway logs` = stream infini → `railway logs --deployment --lines N --json`.
- **Co-édition** : "file modified since read" = prompt parallèle → `git status`/`git log`, réconcilier, re-`tsc`.
- **`appStore` partialize** : `...rest` persiste tout → exclure états session (`cart`, `cashier*`) ou resetter dans authStore login/logout.
- **Secrets API** = état React éphémère — JAMAIS localStorage.
- **PII** : numéros téléphone jamais dans les logs Railway.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran. ⚠️ /privacy = route PUBLIQUE (Google Play) ; pages légales hébergées désormais sous legal/ → Pages
  components/    # par domaine — souvent un *Shared.tsx par domaine
  stores/        # appStore.ts (lang, currency, tenant, caisse, cart)
                 # authStore.ts (user, token, tenants[], activeTenantId, switchTenant, ROLE_PERMISSIONS + canAccess slug)
  i18n/index.ts  # t() : { fr, en, es, it }, 575+ clés
  lib/api.ts     # tous les *Api
  components/ui/ # ResponsiveGrid, IconButton, Tabs/TabBar, AppButton,
                 # FocusTooltip, Skeleton, FilterSelect — voir README.md
```

## i18n — convention CRUCIALE

**Utilise le mécanisme déjà présent dans le fichier** :
1. `i(fr, en, es, it)` via `useI18n()` — standard nouveau code.
2. Ternaire inline 4-langues — TOUJOURS les 4 (jamais binaire FR/EN).
3. `t('key')` → `src/i18n/index.ts` ; nouvelle clé = dans les 4 blocs.

Helpers : `makeI(lang)` (settings), `pick(lang, obj)`.
**Pattern data traduites** : `Record<string, Record<lang, string>>` + `xxxLabel(value, lang)` — valeur FR = clé. Cf. `hrShared.tsx`, `posShared.tsx`. Ne pas toucher les chaînes FR dans les data.
**NE PAS traduire** : marques, codes devises (XOF/EUR/FCFA), enums API, pays. PDF hors périmètre.

## Conventions de code

- **Montants** : `useFormatAmount()`/`fmt()` — jamais formatage manuel.
- **Icônes** : Lucide uniquement (pas d'emoji UI), `cursor:pointer` + transitions.
- **Couleurs** : `var(--)` systématiquement. Exceptions : palettes sémantiques, Google Maps, PDF, `.public-scope`, `#fff` boutons colorés, défs thème. ⚠️ FS macOS : ne pas créer `Button.tsx`/`Tabs.tsx`/`Tooltip.tsx` (collision shadcn minuscules).
- **Branding / thème** : logo **« Sac + H »** = composant `components/ui/LogoMark.tsx` (SVG, violet `#6C47FF` + or) — utilisé Sidebar/Login/PWA/SelectShop/Landing. Assets dans `public/` + `mobile/assets/` (source éditable : `../habashop-brand/`). **Mode sombre = « NKONI »** (bleu-noir `#0A0C14`, cartes `#121724`, or `#FFB020`, `--border3` glow violet sur cartes clés, CTA `--grad-p` violet→bleu). Police UI = **Geist** (`@fontsource-variable/geist`, `--font`) ; mono = JetBrains.
- **Thèmes = 3 seulement** (`appStore.ts` `Theme='dark'|'light'|'system'`, défaut `dark`) : **Sombre (NKONI)** / **Clair** / **Système**. `system` n'a pas de palette → `resolveTheme()` le résout en dark/light selon `prefers-color-scheme` (+ listener `matchMedia` réactif) ; `applyTheme` pose `body.className=theme-<resolved>`. `THEMES` ne contient QUE `dark`+`light` ; `THEME_OPTIONS` = les 3 options du sélecteur (`SectionLang`). **Fallback gracieux** : thème persisté obsolète (ancien `darker/midnight/forest/ocean/sunset/gold/soleil`) → `merge` retombe sur `dark` (`VALID_THEMES`). Détection clair côté JS = `isThemeLight(theme)` (résout `system`), **pas** `t==='light'`. Sélecteur d'accent (6 pastilles `ACCENT_PAIRS`) conservé. `THEMES.dark.vars` **doit rester synchro** avec le `:root` sombre d'`index.css` (sinon `applyTheme` réintroduit l'ancien fond) ; miroir `BASE` de `contrast-aa.test.ts` idem. *(Mobile aligné : 3 thèmes aussi, cf. #19.)*
- **Login** (`pages/LoginPage.tsx`) : split marque/formulaire, sélecteurs stables **`data-testid="login-email/login-password/login-submit"`** — E2E en dépend. Lien **« ← Retour à l'accueil »** + logo cliquable → `/` (pas de cul-de-sac). Bloc **« Connexion instantanée par rôle »** : 5 puces (`DEMO_ROLES`, testids `demo-admin|demo-manager|demo-cashier|demo-accountant|demo-hr`) → connexion directe au compte démo du rôle (`admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com` + `demo1234`), grille 2 col (1 col < 380px, RH pleine largeur).
- **Landing hero** (`components/landing/LandingHero.tsx`) : **split 2 colonnes** (texte / carte aperçu produit), **100 % tokens CSS** (`var(--…)` + `color-mix`, theme-aware) — pas la palette `D` hex. H1 unique, mot d'accent en `--p2`. `< 900px` → colonne unique. `LandingNav` masque « Connexion » `< 640px` (`.lp-nav-login`).
- **Graisses** : `--fw-regular/--fw-semibold/--fw-bold` uniquement. Exclusions : PDF, SVG Maps, `.public-scope`.
- **Toasts** : sans emoji. Mutations clés → `announce(msg)` (`@/lib/announce`) + `toast.success`.
- **Modales** : `useModalFocus<HTMLDivElement>()` + `ref` sur `.modal-box` + `role="dialog"`/`aria-modal`/`aria-label`. ⚠️ `aria-grabbed`/`aria-dropeffect` = dépréciés.
- **Pills de statut** : tokens `--c-{green,orange,blue,red,amber}-bg/-border`, `--r-full`, 12px semibold.
- **Logs** : `logger.log/warn` (`@/lib/logger`, filtre DEV) — pas de `console.*` en commit.
- **Éditions masse multi-octets/emoji** : script Python ou tsx, pas `sed`.
- **Specs prescriptives** : si instruction ≠ code réel → réconcilie et continue. Questions réservées aux choix irréversibles.

## État fonctionnel

### POS / Ventes
- **Paiements** : cash/wave/orange/mtn/card. **Mixte** : `Sale.cashAmount/mobileMoneyAmount/cardAmount`, `|somme−total|≤1` + ≥2 modes. Helper `lib/paymentSplit.ts`.
- **Idempotence** : `idempotencyKey` (`@@unique([tenantId,idempotencyKey])`), P2002 gérée.
- **Remboursement** : `POST /api/sales/:id/refund`, motif requis, restock optionnel, idempotent 409, `refunded` exclu CA + retire points.
- **Anti-survente** : backend `400 INSUFFICIENT_STOCK` (garde AVANT tx, décrément atomique). Front : `confirmSale` surface l'erreur + refetch stock. Tuile rupture grisée `opacity .45`. 4 tests `overselling.test.ts`.
- **Session caisse** : `cashierIsOpen = requireCashier ? cashierOpen : !cashierForcedClosed` — sélecteur `useCashierIsOpen()` partout. `cashierForcedClosed` persisté ; `cashierOpen/Fund/Tx/CA`+`cart` exclus de partialize. `requireCashier` refetché au montage POS. Montants caisse XOF → `fmt()`. ⚠️ `onClick={() => confirmSale()}` jamais `onClick={confirmSale}` (event = JSON circulaire).

### Paiements mobiles

| Provider | Service | Env clés |
|---|---|---|
| **MTN MoMo** (CM) | `services/mtnMomo.ts` — polling 3s×40 | `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS=1` |
| **Campay/Orange** (CM) | `services/campay.ts` — token 55min, HMAC webhook fail-closed | `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS=1` (montant forcé 10 XAF) |
| **PayDunya** (SN/UEMOA) | `services/paydunya.ts` | `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS=1` |

**Flux POS** : polling → `confirmSale(mtnRef?, campayRef?, paydunyaRef?)`. Si PayDunya configuré, Wave+Orange → overlay QR `POSPaydunyaOverlay` (3s×100=5min). `isPaydunyaMode = paydunyaOk && (wave||orange)`.
**PayDunya** : `response_code:'00'` = succès, IPN = SHA-512(MASTER_KEY) fail-closed, réconciliation only. 16 tests.
**Campay carte** : `/api/get_payment_link/` (underscore), QR noir/blanc opaque. Sandbox : référence `SANDBOX-CARD-{ts}`.
**Stats** : `GET /api/payments/today-stats` (par `*Reference`, UTC, refunded exclus). Étendre `computePaymentStats` pour tout nouveau provider.
**⚠️ Sécurité sandbox** : `IS_SANDBOX` OK pour URL/devise, INTERDIT pour auto-approbation. Toujours `_SANDBOX_AUTO_SUCCESS=1` **explicite** + flag **inline dans le handler** (pas constante module → tests process.env inefficaces).

### UI POS/fidélité/onboarding — item 11 (maquettes) ⚠️
Refonte 2026-07 fidèle aux **maquettes faisant foi** `docs/ux-mockups/0N-*.view.html` (+ `docs/SPECS_UX_pos_fidelite_onboarding.md` en complément). À préserver :
- **POS plein écran** : classe `.pos-fullbleed` sur le wrapper → neutralise padding/scroll de `.page-content` (sinon débordement ~2×padding, CTA coupé). Colonnes grid `1.6fr / minmax(270px,1fr)` ; **< 900px** = vue panier dédiée (feuille défilante).
- **Header POS unique** : icône Store + nom boutique · pill « Caisse ouverte » **cliquable = modale de clôture** · recherche avec l'icône code-barres **dans le champ** (max 360px, hit-area 44px, réutilise `handleScan` — PAS de duplication) **gatée sur `posEnableScanner`** ; placeholder **honnête** : « …ou scanner » seulement si scan activé, sinon « Rechercher… » (pas de fausse promesse) · Historique en icône · badge réseau **uniquement hors-ligne**. ⚠️ Le « Scanner » du **panier** est le scanner de **carte fidélité** (QR `HABA-CUST:`, `POSCustomerSelector`) — fonction DISTINCTE du scan produit, ne pas confondre / fusionner.
- **Panier SANS modes de paiement** : la sélection vit dans la **feuille d'encaissement** (`POSModals` showModal) — Total à payer or + « dont TVA », tuiles 3×2 (Mixte pointillée, offline → cash-only), `POSCashField` (extrait, testable : clamp négatif, raccourcis Exact/arrondis dynamiques via `totalDisplay` **+ décimales devise** — pas 1000/5000 hors XOF, cf. `currencyDecimals`, « Rendu monnaie »), PayDunya = bouton brandé → overlay. Tuiles catalogue : prix = **montant or + suffixe devise séparés** (`amountLabel`/`curSuffix`, pas `fmt()` entier) ; stock bas = bordure `--warn` + point. **Prix barré (référence) UNIQUEMENT si `showStrikePrice(ref, eff)=ref>eff`** (helper `posShared`) — sinon « 2 800 2 800 » quand le tarif de gros retombe sur le prix détail. Modale remise : suffixe = symbole devise dynamique (`currencySymbol`), pas « F » figé ; icône type = Coins/Percent. **Mention tarif actif** discrète au-dessus de la grille (« Tarif Grossiste/Demi-gros appliqué », `--p2`) affichée hors Détail — le sélecteur de tarif est loin à droite.
- **Clôture caisse (maquette 03)** : ventilation par mode = ventes du JOUR via `salesApi.list` (lecture seule, repli CA session hors-ligne) ; **espèces attendues = fond + ventes ESPÈCES** (pas le CA tous modes) ; écart coloré par **MAGNITUDE** via `gapLevel` unique (écran ET rapport imprimé) : |é|≤1 XOF vert · < max(500 XOF, 5%) ambre · sinon rouge, surplus comme manque. Rapport imprimé : **TOUTE interpolation via `esc()`** (anti-XSS — `cashierName` = donnée utilisateur). `TicketZModal` (Z serveur, MANAGER+) inchangé.
- **Onboarding (maquette 05)** : tokens NKONI (plus de `public-scope`), 5 étapes à icônes, « Passer pour l'instant » partout (jamais bloquant), **payload défensif** (champs vides non envoyés — un skip n'écrase rien). `shopType` = UI only (non envoyé).
- **Captures maquette↔impl** : scripts `apps/frontend/e2e/pos-item11*.shot.mjs` (⚠️ `serviceWorkers:'block'` sinon le SW court-circuite `page.route` ; sorties `e2e/screenshots/item11/`). BillingBanner : masquée sur `/app/pos` + garde `status` malformé (anti « undefined jour(s) »).

### Fidélité
Backend autoritaire : `loyaltyDiscount = total × tierPct` (plafond 50%), `sale.total = NET`. Front envoie BRUT + `customerId` — **ne PAS envoyer le net** (double remise). QR carte = `HABA-CUST:<id>`, noir/blanc opaque, **aucune crypto**. `LoyaltyCardDigital` (maquette 04) : carte hero **teintée par palier** (couleurs FIXES — artefact PNG exporté, pas du chrome thémé), paliers actuel/prochain (remises/seuils tenant), activité = `loyaltyApi.get().history` (LoyaltyTransactions serveur).

### Autres modules
- **Produits** : SKU `PRD-NNNN`, priceTiers, scan @zxing.
- **Codes-barres (Chantier A)** : RÈGLE CANONIQUE UNIQUE `src/lib/barcode.ts` — **3 miroirs** (backend/mobile/frontend, à l'identique) testés contre `docs/shared-fixtures/barcode-cases.json`. `normalizeBarcode` (EAN-13 · EAN-8 conservé tel quel · **UPC-A→EAN-13** par préfixe « 0 », **JAMAIS de strip des zéros de tête** — casserait le round-trip scan) ; `isValidBarcode`/`isAcceptableBarcode` (garde saisie) ; `barcodeMatches` (RECHERCHE : sous-chaîne OU égalité canonique) ; `matchesScannedCode` (SCAN→panier : barcode canonique **OU SKU EXACT**, jamais sous-chaîne — un faux positif caisse coûte plus cher qu'un échec) ; `quietZonePx` (silence latéral **≥10 modules**, GS1 11). Backend `checkBarcode` (POST/PUT products) : EAN-13/EAN-8/UPC-A + **unicité par tenant** (findFirst hors soft-deleted → 400 `INVALID_BARCODE` / 409 `DUPLICATE_BARCODE`) ; PAS de `@@unique` DB (barcodes vides + soft-delete). ⚠️ Toute logique barcode passe par le lib — **méta-test** (`barcode.test.ts` front) échoue si une regex `\d{13}` locale réapparaît hors du lib. **Scan = geste PRINCIPAL** (fiche `StockModals` + POS `handleScan` web/mobile + scan de recherche inventaire) ; recherche par nom/**SKU**/barcode (web inventaire+POS, mobile stock+globale) ; « Générer » (EAN-13 interne préfixe 200, `generateEAN13`) = second recours **réservé au vrac** (sélection explicite + confirmation). **Rattrapage** guidé `StockBackfill.tsx` (produits sans code → scan/génère par ligne + planche A4). Vignette fiche (`BarcodeVignette`) = surface blanche unique cliquable-pour-copier, quiet zones bakées dans le SVG (`quietZonePx`).
- **Étiquettes** : planche **A4 Avery** (`utils/export.ts printProductLabels`, rattrapage en masse) + **thermique 40×30 mm** (`utils/thermalLabel.ts printThermalLabels`, jsPDF import dynamique, à l'unité, chunk `pdf` hors precache). Les DEUX : barcode rendu via **jsbarcode LOCAL** (plus de CDN), **EAN-13/EAN-8 uniquement** (JAMAIS de CODE128-sur-SKU = code non standard, piège caisse), quiet zones ≥10 modules (`quietZonePx`). Sans code EAN → **zone repliée** (nom/SKU/prix, étiquette de prix propre) : AUCUNE mention sur l'étiquette (face client) ; l'alerte « N sans code-barres → compléter » vit dans la modale Étiquettes AVANT impression (→ ouvre le rattrapage). **Prix en NOIR gras** sur les DEUX (jamais le violet écran `#5B4EE8` : impression bureau souvent N&B → violet = gris pâle sur l'info la plus importante + encre couleur ; thermique = monochrome, `setTextColor(0)` explicite). **Pas d'émoji sur la planche Avery** (le 📦 générique par défaut n'apporte rien, redondant avec le produit sur lequel l'étiquette est collée ; thermique n'a jamais rendu d'émoji — Helvetica). Thermique : gabarit 40 mm, marge page 1 mm → module ≈ 0,325 mm (proche nominal GS1, absorbe l'étalement d'encre).
- **Transferts stock** (multi-boutiques v2) : `StockTransfer` (`pending → completed | cancelled`), MANAGER+. `POST /api/stock/transfers` (vérif accès aux 2 boutiques, anti-soi-même, **décrément gardé** `updateMany stockQty>=qty`), `GET` (source OU dest = active, `?status`), `PATCH /:id/confirm` (dest only → incrément ; produit dest retrouvé **SKU→barcode, sinon copié depuis source**), `PATCH /:id/cancel` (source ou dest → restitue stock source). Push `stock_transfer`. Front : onglet Stock « ↔ Transferts » (si >1 boutique), badge sidebar Stock = transferts reçus en attente.
- **OCR factures** : `POST /api/suppliers/scan-invoice` (multipart 10MB), Claude Sonnet 4.6 Vision. `unitPrice` OCR = devise facture → `formatInCurrency` (pas `fmt`). `suppliersApi.scanInvoice` = fetch brut FormData.
- **Facture PDF (backend, LA vraie)** : bouton historique POS → `GET /api/sales/:id/invoice` → `lib/invoicePdf.ts` (**pdfkit**), `FAC-{YYYY}-{NNNNN}` idempotent (`Sale.invoiceNumber`). ⚠️ **Générateur DISTINCT** du devis frontend (`generateInvoice`) — deux parcours vivants, corriger les DEUX. Séparateur : `pdfSafeSpaces()` (U+202F/U+00A0 → espace simple ; Helvetica/WinAnsi n'a pas de glyphe U+202F → « 8 /500 » sinon) dans `fmtMoney` → couvre facture + Ticket Z PDF (`ticketZ.ts` réutilise `fmtMoney`) + PDF TVA (`reports.ts` fmt2). Logo Sac+H vectoriel pdfkit — `drawLogo()` **exporté** d'`invoicePdf.ts` et **partagé** (facture + Ticket Z + PDF TVA, source unique du dessin) ; pill « Payée » (cercle tracé, « ● » absent en WinAnsi), mentions légales `ninea/rccm/vatNumber` si configurées. E-mails (`email.ts`) : logo = **PNG hébergé** `/pwa-192x192.png` (Outlook ne rend pas le SVG inline), plus l'emoji 🛍️.
- **Facture/devis client (`utils/export.ts` generateInvoice)** : document dédié (logo Sac+H, filet violet, statut Payée/En attente, Total TTC). **Tout montant imprimé passe par `printableAmount()`** (U+202F/U+00A0 → espace simple — sinon « 2 /800 » en monospace ; vaut aussi pour posTicket + rapport Z) et toute donnée dynamique par `escHtml()`. Pied légal : `Tenant.ninea/rccm/vatNumber` (String?, PATCH tenant trim + ''→null + max 64), UI Réglages → Boutique « Infos légales », affichés seulement si renseignés.
- **Ticket Z** : `@@unique([tenantId,date])`, upsert idempotent, CA hors refunded, breakdown COALESCE(split, paymentMode).
- **WhatsApp** : auto-vente (Twilio, fail-silent), manuel (`/api/whatsapp/send-ticket`), crons gérant (20h/8h TZ Dakar, **uniquement si `Tenant.ownerPhone` non null**). Campagnes : `POST /api/marketing/whatsapp/campaign`, rate-limit 1/h Redis, segments fidélité.
- **Finance** : CSV comptable `GET /api/reports/accounting/csv` (UTF-8 BOM, semicolons, `sanitizeCsv()` anti-injection). TVA : `GET /api/reports/vat` + `/csv` + `/pdf` (pdfkit). `buildVatData()` partagé.
- **RH/Planning** : `Attendance` (`@@unique([tenantId,employeeId,date])`), `Shift` (même type interdit), `LeaveRequest`. Planning = `shiftsByDate Record<"empId_date", {type,id}[]>`, MAJ optimiste + rollback. Clavier PlanningGrid (Entrée/flèches/Échap/Suppr via GripVertical) — ne pas casser.
- **Paie** : bulletins jsPDF, cron idempotent via `Tenant.lastPayrollReportMonth`, `dryRun:true` par défaut.
- **Rapport comptable** : `GET /api/reports/accounting?month=YYYY-MM` (Redis cache), conversion XOF→devise serveur → modale formate sans reconvertir.
- **Intégrations** : métriques réelles uniquement. `noPing` masque grille latence. Sentry = `GET /api/integrations/sentry/status` backend.
- **Auth** : JWT + bcrypt12, `ROLE_PERMISSIONS` slug-based, `canAccess(role, slug)`. Rate-limit **global** 300/min/IP + overrides (login 30/15min, register 5/h…). Register : mot de passe ≥ 8 (validé zod). WS `/api/ws` fail-closed.
- **Multi-boutiques** : `UserTenant` (many-to-many User↔Tenant, **rôle PAR boutique**). JWT porte `activeTenantId` (nullable) + `role` de la boutique active ; rétro-compat anciens tokens (`tenantId`). `authenticate` → `req.tenantId = activeTenantId`, **400 `NO_ACTIVE_TENANT`** sur routes métier sans boutique (exemptés : `/api/auth/*`, `/api/dashboard/consolidated`). Login : 1 boutique → directe ; >1 → `activeTenantId=null` + `tenants[]` (sélecteur). Endpoints : `POST /api/auth/switch-tenant` (rate-limit 10/min, vérif `UserTenant`→403), `GET /api/auth/tenants`, `POST /api/tenants` (ADMIN+, créateur lié ADMIN), `POST /api/tenants/:id/invite`, `GET /api/dashboard/consolidated` (CA XOF tous tenants). Front : `authStore.switchTenant()` → **rechargement complet** (`window.location`, pas de TanStack Query). `SelectShop.tsx` (sélecteur login), `TenantSwitcher.tsx` (sidebar, si >1), `ConsolidatedShops.tsx` (dashboard), Settings « Mes boutiques » (`SectionShops`, ADMIN+).
- **Admin PLATEFORME (super-admin SaaS)** : `User.isPlatformAdmin` (Boolean) = **SEUL** critère d'accès à `/api/admin/*` (`middleware/superAdmin.ts` `authenticateAdmin`), claim signé dans le JWT (login/switch, relu DB au switch). ⚠️ **JAMAIS gater sur le rôle `SUPER_ADMIN`** — c'est un rôle INTERNE au tenant (suppression tenant, notifs) ; gater dessus = fuite inter-tenants (P0 corrigé, cf. `adminPlatformIsolation.test.ts`). Anciens JWT sans le claim → 403 fail-closed. Provisioning **hors API, sans mdp en dur** : `apps/backend/scripts/set-platform-admin.ts` (`CONFIRM=1 PLATFORM_ADMIN_EMAIL=…`, promeut un user EXISTANT ; option `PLATFORM_TENANT=1` marque son tenant `isPlatform`). `Tenant.isPlatform` (Boolean) = tenant staff **exclu des listings/quotas/agrégats** de `/api/admin/*` (via relation `tenant.isPlatform`, `basePrisma`). Front : `AdminDashboard.tsx` = **console plateforme** (bandeau contexte « TOUTES les boutiques », KPI MRR/boutiques segmentées/CA/**churn estimé**, alertes actionnables, CA+dernière activité par boutique) gardée par `PlatformAdminOnly` (≠ `AdminOnly` tenant qui reste pour api-docs/integrations) ; entrée sidebar « Admin Panel » sur `isPlatformAdmin`. Migrations additives appliquées : `isPlatformAdmin`, `Tenant.isPlatform`.
- **Sidebar** (`components/layout/Sidebar.tsx`) : **zone QUOTIDIENNE épinglée** (Point de vente / Tableau de bord / Stock, bloc distinct) + **4 groupes d'INTENTION** (`nav_sec_sell/manage/analyze/configure` : Vendre / Gérer / Analyser / Configurer). Système+Administration fusionnés dans Configurer. Pas de badge factice (seul Stock = badge réel transferts). En-têtes masqués si aucune entrée accessible (`canAccess`). `ROLE_PERMISSIONS` : CASHIER sans Finance/RH ; « Activité » (journal) = MANAGER+/ADMIN (retiré à HR).
- **Emails Resend** : `escHtml()` + `baseTemplate()`. `email @unique` libéré au soft-delete.
- **GlobalSearch** : `GlobalSearch.tsx` (cmdk), Cmd+K/Ctrl+K dans AppLayout. Catégories : produits, clients, commandes, fournisseurs, actions rapides. Filtrées par `canAccess(role, slug)`.
- **Onboarding** : wizard 5 étapes `Onboarding.tsx`, route `/onboarding`. Flag `habashop_onboarded` localStorage. Auto-redirect depuis Dashboard pour ADMIN sans produits/ventes.

### Tests
- **Front : 420 vitest / 48 fichiers** (helpers purs + anchor tests + contraste AA sur les 2 thèmes concrets dark+light). Lancer **`vitest run` COMPLET** avant tout push touchant landing/login/thème (`landing.anchor.test.tsx` fige le H1 du hero). **Back : 564 vitest** (prisma mocké `vi.mock('../db')`, routes via `app.inject()`, mock `authenticate` via `vi.hoisted`). **Mobile : 193 jest.** **Cas PARTAGÉS backend↔mobile↔frontend (anti-dérive)** via `docs/shared-fixtures/*.json` lus par les tests jumeaux des différents côtés — modifier la règle d'un côté sans l'autre fait échouer le test : `loyalty-discount-cases.json` (`computeLoyaltyDiscount` : arrondi/plafond 50 %/remise manuelle) ; `barcode-cases.json` (`normalizeBarcode`/`isValidBarcode`/`barcodeMatches`/`matchesScannedCode` — canonicalisation, recherche, résolution scan). ⚠️ Codes-barres : **méta-test** (front `barcode.test.ts`) échoue si une regex `\d{13}` locale réapparaît hors de `lib/barcode.ts` ; les 3 rendus (vignette écran + Avery + thermique) ont un test qui verrouille les **quiet zones ≥10 modules** ; PDF étiquettes non grep-ables → mocker jsbarcode/jsPDF et capturer les options (cf. `exportLabels`/`thermalLabel`/`barcodeVignette`). OCR : `vi.hoisted()` + classe constructeur. **PDF pdfkit non grep-able** (buffer binaire) → tester présence/absence de texte en **mockant pdfkit** et capturant les `.text()` (cf. `invoiceBilledTo.test.ts`). ⚠️ Route avec `schema` zod → `app.setValidatorCompiler(validatorCompiler)` avant `register` (cf. § Sécurité). Isolation cross-tenant : `tenantIsolation.test.ts` (mock Prisma tenant-aware).
- **E2E Playwright** : live prod sur **tenant dédié `e2e-tenant`** (EUR, `requireCashier=true`, compte `e2e@habashop.com` SUPER_ADMIN mono-boutique) — issue #5 close. Fixtures **statiques** via `apps/backend/scripts/seed-e2e-tenant.ts` (idempotent, guard `E2E_SEED=1` + scope `e2e-tenant`, **manuel** ; jamais demo/prod). Fixtures **datées** (ventes du jour → `dashboard-donut`) créées par API dans `auth.setup` (`e2e/helpers/fixtures.ts`, **pas de secret DB** en repo public). `auth.setup` login `e2e@` ; `e2e/helpers/preconditions.ts` + `test.skip` conditionnels = garde-fou (0 skip nominal). `storageState` `e2e/.auth/user.json`, `workers:1`. **Smoke : navigation par clic** (pas `page.goto` après login → logout cold-start). **BASE surchargeable** : `playwright.config` + chaque spec lisent `E2E_BASE`/`PAYROLL_BASE`/`POS_BASE`/`STOCK_BASE`/`PAGES_BASE`/`DASH_BASE`/`CUST_BASE`/`HR_BASE`/`REPORTS_BASE`/`SETTINGS_BASE` (défaut prod) → pour valider un build local, `vite preview` + **tout** mettre sur `http://localhost:PORT` (sinon cross-origin : auth locale ≠ site prod → redirection login). API prod (build) = `https://habashop-production.up.railway.app` (Railway, cold-start ~lent, free-tier).
- **A11y** : `useModalFocus` (34 modales), `announce()` (8 domaines), skip-link, `*:focus-visible`, `prefers-reduced-motion`.

## Règles devise / montants ⚠️

- **Tout XOF en base.** `fmt()`/`useFormatAmount()` convertissent XOF→devise. **Ne JAMAIS pré-convertir** (= double conversion).
- **Exception** : valeurs déjà en devise tenant (`pointsPerAmount`, remises fidélité, valeur carte) → `formatInCurrency` SANS conversion.
- **Pages publiques** : `convertAmount` + `formatInCurrency` (fonctions pures — pas le hook).
- **Devise affichage = per-device** ; `setTenant` n'adopte `tenant.currency` qu'au changement de boutique.
- Saisie formulaires : devise affichage → `toXOF()` au submit. Suffixe = `CURRENCY_SYMBOLS`.
- Agrégats CA : `Sale.total`, bornes `new Date(y,m,1)` serveur, refunded exclus.

## Pièges techniques

### Frontend
- **QR/barcode** : noir sur blanc opaque (jamais `var(--text)`/`transparent`).
- **`transform` sur ancêtre** → casse `position:fixed`. Animer opacité seule.
- **`applyAccentColor()`** écrase `--p/--p2/--p3` via `ACCENT_PAIRS` (plus de verrouillage `body.className` depuis le retrait de `gold`/`soleil`). Détection clair = **`isThemeLight(theme)`** d'appStore (résout `system`), jamais une comparaison littérale à `'light'`/`'soleil'`.
- **Date « now »** : param injectable défaut `new Date()` — jamais de littéral `new Date('...')`.
- **SVG + `var()`** : `fill="var(--…)"` ne résout pas → `style={{color}}` + `fill="currentColor"`.
- **Polling** : closure stale → `useRef` pour valeur courante. Logique succès dans `useEffect([status])` séparé.
- **Google Maps** : re-init via compteur `mapVersion` (state) + `key={mapVersion}` sur div.
- **IDs employés** : cuid string — jamais `Number(id)`.
- **% recharts** : `p.percent` undefined au survol → UNE source de vérité dans les données. Palette : `% COLORS.length`.
- **Découpe composant** : test ancrage d'abord (rendu + interactions), puis découpe identique.

### E2E Playwright
- SW PWA court-circuite `page.route()` → `serviceWorkers: 'block'`.
- Caméra @zxing : `--use-fake-device-for-media-stream` + `--use-fake-ui-for-media-stream`.
- Pas de `page.reload()` (→ logout). Seeder via `page.addInitScript`.
- Tooltip donut recharts : `page.mouse.move` sur rayon inner/outerRadius.

### Backend
- **Crons** : `setInterval` + garde fenêtre-temps + marqueur idempotent en base.
- **Webhooks** : HMAC-SHA256 raw body, `timingSafeEqual`, **fail-closed partout** (Wave inclus : `wave.ts` `if (!secret) return false`). Reste à poser `WAVE_WEBHOOK_SECRET` en prod.
- **Tests PDF** : signature `%PDF` + taille >500o.
- **CSV injection** : `sanitizeCsv(v)` → préfixe `'` si valeur commence par `=+−@\t\r`.

### Sécurité (remédiation audit 2026-07 — `docs/audits/AUDIT_APPROFONDI_2026-07.md`)
- **Validation déclarative zod** (item 6) : `app.setValidatorCompiler(validatorCompiler)` global dans `server.ts` (seul le **validator**, PAS le serializer → réponses inchangées ; routes sans `schema` inchangées). Schémas `body/params/querystring` sur les routes **argent** (sales, payments *, payroll), **auth** (login/register/switch-tenant/password), **écritures** (products, customers, suppliers, orders, employees, expenses, goals, subscriptions, stockTransfers). Erreurs zod → **400 `{ error, code:'VALIDATION' }`** (handler global). Les règles métier (nom requis, `total<0`, MSISDN, force mdp) **restent dans les handlers** (messages conservés). ⚠️ **Tout test qui monte une route avec `schema` zod DOIT appeler `app.setValidatorCompiler(validatorCompiler)` avant `register`** (sinon Ajv casse : « schema is invalid »). Schémas d'écriture mutualisés : `src/schemas/writesB.ts`.
- **Anti mass-assignment** : `PUT /products/:id`, `POST|PUT /suppliers`, `POST|PUT /expenses` passaient le body BRUT à Prisma → un `tenantId` injecté réassignait la ressource. Schémas UPDATE = **liste blanche stricte (strip)** → clés hors modèle (`tenantId`/`id`/timestamps/`sku`) supprimées. `create` : `tenantId` imposé serveur.
- **W1** (`stockTransfers.ts` confirm/cancel) : scope tenant **avant** existence/statut → **404 uniforme** pour un tiers (pas d'oracle). La source garde son 403 sur `/confirm`.
- **W2** (`whatsapp.ts` send-ticket) : reçu brandé avec `request.tenantId` (boutique **active**), pas `request.user.tenantId`.
- **Rate-limit GLOBAL** (item 5) : `@fastify/rate-limit` `global:true`, 300/min par IP (ajustable `RATE_LIMIT_MAX`). Overrides plus stricts conservés (auth, checkouts, paiements). **Exemptés** (`config.rateLimit:false`) : webhooks/IPN paiement + health checks. `bodyLimit` explicite **4 Mo** (photos employé base64 ; multipart OCR 10 Mo non concerné).
- **Isolation cross-tenant** (item 7) : `tenantIsolation.test.ts` (mock Prisma tenant-aware) prouve 404/aucune mutation pour tenant B sur les ressources de tenant A. `PUT /customers/:id` : P2025 → **404** (était 500).
- **Extension Prisma tenant** (item 8, defense-in-depth) : `src/db.ts` exporte `prisma` (étendu `$extends`) + **`basePrisma`** (non étendu, pour cross-tenant légitime — dashboard consolidé). Auto-injecte `tenantId` sur 19 modèles scopés **si absent** (n'écrase jamais un tenantId explicite). Contexte ALS (`src/lib/tenantContext.ts`) établi par un hook **`onRequest`** (`initTenantStore`) puis renseigné par `authenticate` (`bindActiveTenant`). ⚠️ `enterWith` dans un preHandler (après `await`) ne remonte PAS au handler → d'où l'établissement en `onRequest`. **Durci (#35)** : les ÉCRITURES `create`/`createMany`/`upsert` sont GARDÉES — `tenantId` absent → injecté ; présent et ≠ contexte → `TenantScopeMismatchError` (403), jamais d'écrasement silencieux (lectures : `where.tenantId` explicite respecté). `findUnique` résiduels sur modèles scopés convertis en `findFirst({id,tenantId})` (stockTransfers confirm/cancel = `OR` source/dest, analytics, cron hebdo ; TicketZ conservé — clé composite contient tenantId). Purge push tokens = `basePrisma` (nettoyage cross-tenant par token exact). `update`/`delete` par clé unique restent aux handlers. Filtrage manuel conservé. `TxClient` (db.ts) type les `tx` du client étendu. **Comportement neutre** pour le code existant (tous les handlers filtrent déjà) — c'est un filet.
- **Rotation secrets (P0.1, action Nelson)** : `apps/backend/.env` fut commité (repo PUBLIC) — `JWT_SECRET` + `TWILIO_AUTH_TOKEN` à tourner (Anthropic déjà 401, DB déjà migrée). Purge d'historique = destructive, après rotation + accord.

## Dette ouverte

### 🔴 Critique
- **SMS** (`notifSmsSales`/`notifSmsStock`) : Africa's Talking reco. `services/sms.ts`, `SMS_API_KEY`. **XL**
- **Push PWA** : VAPID keys, `PushToken` prêt inutilisé, SW sans handler. **XL**
- **Wave webhook** : code **fail-CLOSED** (`if (!secret) return false`) ✅ — reste à poser `WAVE_WEBHOOK_SECRET` Railway pour activer la vérif en prod. **S**
- **Campay go-live** : `CAMPAY_WEBHOOK_KEY` + `CAMPAY_ENVIRONMENT=production`. **S**
- **PayDunya go-live** : `PAYDUNYA_MODE=live` + clés live. Flux POS non validé end-to-end. **S**

### 🟡 Medium
- **Paie statuts** : state local pur (`Payroll.tsx`), perdu au refresh. Pas de table Payroll en base. **M**
- **Bundle recharts ~105KB gz** : lazy + hors precache. Remplacer visx = **L**.
- **A11y résiduel** : 3 champs SectionCatalog sans label, POSModals pays non-listbox, Stock liste divs.

## Comptes démo

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant principal `demo-tenant-001` (« HabaShop — Dakar Central »). 5 employés (`demo-emp-${name}`). Données hors seed : `currency='EUR'`, `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.
**Multi-boutiques** : `admin@` et `manager@` sont liés à une 2ᵉ boutique `demo-tenant-002` (« Alimentation Koné — Abidjan », XOF) via `UserTenant` → login déclenche le sélecteur. `admin@` = SUPER_ADMIN/ADMIN, `manager@` = MANAGER/MANAGER. Les 3 autres restent mono-boutique.

## Env vars

**Railway** : `DATABASE_URL`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`.
- MTN : `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS`
- Campay : `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS`
- PayDunya : `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS`

**Vercel** : `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (.env.local), `VITE_VAPID_PUBLIC_KEY` (à venir).
