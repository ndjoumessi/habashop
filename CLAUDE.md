# HabaShop — État du projet

Guide pour Claude Code. Lis ce fichier en premier avant de bosser sur le repo.

## C'est quoi

SaaS de gestion commerciale multi-tenant pour boutiques/superettes (Afrique de l'Ouest & francophone). Monorepo npm workspaces.

## Stack

- **Frontend** (`apps/frontend`) : React 18 + TS + Vite 8 + vitest 4, Zustand (persisté localStorage), React Router ≥6.30.4, Lucide, recharts, jsbarcode (EAN-13), @zxing (scan), qrcode+html2canvas (carte fidélité), Playwright E2E, Sentry (org **haba-76** / projet **habashop-web**), PWA vite-plugin-pwa 1.x. Chunks `charts`/`barcode`/`canvas` EXCLUS du precache (runtime CacheFirst `lazy-chunks-cache`) — préserver si on touche `vite.config.ts`. Chunk principal ~68 KB gz.
- **Backend** (`apps/backend`) : Fastify + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend, pdfkit, twilio, `@anthropic-ai/sdk ^0.96.0` (OCR Vision), `@fastify/multipart`.
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF**), multi-langues (fr/en/es/it).

## Déploiement & commandes

**⚠️ Node défaut = v10 → casse tout.** Toujours :
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

**Frontend Vercel** — **TOUJOURS depuis la racine** (jamais `apps/frontend` → path doublé = échec) :
```bash
vercel --prod --yes
vercel alias set habashop-<hash>-ndjoumessis-projects.vercel.app habashop.vercel.app
```

**Backend Railway** — service `habashop`, projet `grateful-happiness` :
```bash
railway up --ci   # depuis la racine
```
Auto-deploy GitHub sur push `main` (lag ~20-25 min → `railway up --ci` pour forcer). **Déploiement couplé : Railway D'ABORD, puis Vercel.**

**Commandes** (depuis `apps/frontend`) :
```bash
npx tsc --noEmit && npm test && npm run build
```
Backend : `npx tsc --noEmit` · `npx prisma db push` · `npx tsx <script>.ts`.

**Rituel commit** : tsc (0) → tests (verts) → build (OK) → commit/push `main`.

## Pièges critiques

- **`DATABASE_URL` = DB PROD Railway.** JAMAIS `migrate dev/reset/seed` sans confirmation. `prisma db push` OK pour ajouts sans data loss.
- **Git : push directement sur `main`.** Pas de feature branch.
- **`apps/frontend/.env` tracké par git** → JAMAIS de secret ; `.env.local` gitignored (`SENTRY_AUTH_TOKEN` build-side).
- **Logs Railway** : `railway logs` stream infini → `railway logs --deployment --lines N --json`. Logs diag = temporaires.
- **Co-édition** : "file modified since read" = prompt parallèle → `git status`/`git log`, réconcilier, re-`tsc`.
- **`prisma db push`** prod : migration additive (`ADD COLUMN IF NOT EXISTS`) + `prisma migrate resolve --applied`. JAMAIS `migrate reset/dev`.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran. ⚠️ /privacy = route PUBLIQUE (Google Play)
  components/    # par domaine — souvent un `*Shared.tsx` par domaine
  stores/        # appStore.ts (lang, currency, tenant, caisse, cart — persisté localStorage)
                 # authStore.ts (user, token, ROLE_PERMISSIONS + canAccess slug)
  i18n/index.ts  # dictionnaire t() : { fr, en, es, it }, 575+ clés
  lib/api.ts     # tous les *Api
  components/ui/ # ResponsiveGrid, IconButton, Tabs/TabBar, Button/AppButton,
                 # FocusTooltip, Skeleton, FilterSelect — voir README.md
```

## i18n — convention CRUCIALE

Trois mécanismes coexistent — **utilise celui déjà présent dans le fichier** :
1. `i(fr, en, es, it)` via `useI18n()` — standard nouveau code.
2. Ternaire inline 4-langues — TOUJOURS les 4 (jamais binaire FR/EN).
3. `t('key')` → `src/i18n/index.ts` ; nouvelle clé = dans **les 4 blocs**.

Autres helpers : `makeI(lang)` (settings), `pick(lang, obj)`.

**Pattern data traduites** : `Record<string, Record<lang, string>>` + `xxxLabel(value, lang)` — valeur FR = clé (filtres/data), seul l'affichage traduit. Cf. `hrShared.tsx`, `posShared.tsx`. Ne pas toucher les chaînes FR dans les data.

**NE PAS traduire** : marques, codes devises (XOF/EUR/FCFA), enums API, pays. PDF hors périmètre.

## Conventions de code

- **Montants** : `useFormatAmount()`/`fmt()` — jamais formatage manuel.
- **Icônes** : Lucide uniquement (pas d'emoji UI), `cursor:pointer` + transitions.
- **Couleurs** : `var(--)` systématiquement (9 thèmes). Exceptions : palettes sémantiques, Google Maps, PDF, `.public-scope`, `#fff` boutons colorés, défs thème appStore.ts. Chantier CLOS.
- **Graisses** : `--fw-regular/--fw-semibold/--fw-bold` uniquement. Exclusions : PDF, SVG Maps, `.public-scope`. ⚠️ FS macOS : ne pas créer `Button.tsx`/`Tabs.tsx`/`Tooltip.tsx` (collision shadcn minuscules).
- **Toasts** : sans emoji. Mutations clés → `announce(msg)` (`@/lib/announce`) + `toast.success`.
- **Modales** : `useModalFocus<HTMLDivElement>()` + `ref` sur `.modal-box` + `role="dialog"`/`aria-modal`/`aria-label`. ⚠️ `aria-grabbed`/`aria-dropeffect` = dépréciés.
- **Pills de statut** : tokens `--c-{green,orange,blue,red,amber}-bg/-border` + texte sémantique, `--r-full`, 12px semibold.
- **Logs** : `logger.log/warn` (`@/lib/logger`, filtre DEV) — pas de `console.*` en commit.
- **Éditions masse multi-octets/emoji** : script Python ou tsx, pas `sed`.

## Specs prescriptives

Si une instruction ne matche pas le code réel, **réconcilie et continue**. Questions réservées aux choix irréversibles. Vérifie qu'un fichier/flag existe encore avant de t'appuyer dessus.

## État fonctionnel

### POS / Ventes
- **Paiements** : cash/wave/orange/mtn/card. **Mixte** : `Sale.cashAmount/mobileMoneyAmount/cardAmount`, `|somme−total|≤1` + ≥2 modes. Helper `lib/paymentSplit.ts`.
- **Idempotence création** : `idempotencyKey` (`@@unique([tenantId,idempotencyKey])`), P2002 gérée.
- **Remboursement** : `POST /api/sales/:id/refund`, motif requis, restock optionnel, idempotent 409, `refunded` exclu CA + retire points.
- **Anti-survente** : backend `400 INSUFFICIENT_STOCK` (garde AVANT tx, décrément atomique). Front : `confirmSale` surface l'erreur + refetch stock après vente. Tuile rupture grisée `opacity .45`. 4 tests `overselling.test.ts`.
- **Session caisse** : `cashierIsOpen = requireCashier ? cashierOpen : !cashierForcedClosed` — sélecteur `useCashierIsOpen()` partout. `cashierForcedClosed` persisté ; `cashierOpen/Fund/Tx/CA`+`cart` exclus de partialize (session). `requireCashier` refetché au montage POS. Montants caisse XOF → `fmt()`. ⚠️ `onClick={() => confirmSale()}` jamais `onClick={confirmSale}` (event = JSON circulaire).

### Paiements mobiles

| Provider | Service | Env clés |
|---|---|---|
| **MTN MoMo** (CM) | `services/mtnMomo.ts` — polling 3s×40 | `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS=1` |
| **Campay/Orange** (CM) | `services/campay.ts` — token 55min, HMAC webhook fail-closed | `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS=1` (montant forcé 10 XAF) |
| **PayDunya** (SN/UEMOA) | `services/paydunya.ts` — URL `app.paydunya.com/{sandbox-api\|api}/v1` | `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS=1` |

**Flux POS** : polling → `confirmSale(mtnRef?, campayRef?, paydunyaRef?)`. Si PayDunya configuré, Wave+Orange → overlay QR `POSPaydunyaOverlay` (3s×100=5min) au lieu de Campay/inline. `isPaydunyaMode = paydunyaOk && (wave||orange)`.

**PayDunya** : `response_code:'00'` = succès, IPN = SHA-512(MASTER_KEY) fail-closed, réconciliation only (vente créée par polling). 16 tests.

**Campay carte** : `/api/get_payment_link/` (underscore), QR noir/blanc opaque. Sandbox : référence `SANDBOX-CARD-{ts}`.

**Stats** : `GET /api/payments/today-stats` (par `*Reference`, UTC, refunded exclus). Étendre `computePaymentStats` pour tout nouveau provider.

**⚠️ Sécurité sandbox** : `IS_SANDBOX` OK pour URL/devise, INTERDIT pour auto-approbation. Toujours `_SANDBOX_AUTO_SUCCESS=1` **explicite** + flag **inline dans le handler** (pas constante module → tests process.env inefficaces).

### Fidélité
Backend autoritaire : `loyaltyDiscount = total × tierPct` (plafond 50%), `sale.total = NET`. Front envoie BRUT + `customerId` — **ne PAS envoyer le net** (double remise). Config par tenant : `pointsPerAmount`, seuils/remises paliers. QR carte = `HABA-CUST:<id>`, noir/blanc opaque.

### Autres modules
- **Produits** : SKU `PRD-NNNN`, EAN-13, scan @zxing, priceTiers, étiquettes Avery.
- **OCR factures** : `POST /api/suppliers/scan-invoice` (multipart 10MB), Claude Sonnet 4.6 Vision, auto-fill NewOrderModal. `unitPrice` OCR = devise facture → `formatInCurrency` (pas `fmt`). `suppliersApi.scanInvoice` = fetch brut FormData.
- **Facture PDF** : `openAuthedPdf` (fetch JWT → blob), `FAC-{YYYY}-{NNNNN}` idempotent (`Sale.invoiceNumber`).
- **Ticket Z** : `@@unique([tenantId,date])`, upsert idempotent, CA hors refunded, breakdown COALESCE(split, paymentMode).
- **WhatsApp** : 3 mécanismes — auto-vente (Twilio, fail-silent dans `POST /api/sales`), manuel (`/api/whatsapp/send-ticket`), rapports gérant (crons 20h/8h TZ Dakar, **uniquement si `Tenant.ownerPhone` configuré** — null = rien).
- **RH/Planning** : `Attendance` (`@@unique([tenantId,employeeId,date])`), `Shift` (multi-shift/jour, même type interdit), `LeaveRequest`. 100% backend. Planning = `shiftsByDate Record<"empId_date", {type,id}[]>`, MAJ optimiste + rollback. Clavier PlanningGrid (Entrée/flèches/Échap/Suppr via GripVertical) — ne pas casser.
- **Paie** : bulletins jsPDF, cron idempotent via `Tenant.lastPayrollReportMonth`, `dryRun:true` par défaut.
- **Rapport comptable** : `GET /api/reports/accounting?month=YYYY-MM` (Redis cache), conversion XOF→devise serveur → modale formate sans reconvertir.
- **Page Intégrations** : métriques réelles uniquement. Services `noPing` masquent grille latence. Sentry = `GET /api/integrations/sentry/status` backend (`SENTRY_AUTH_TOKEN`). Pas de `calls/mois`/`uptime` hardcodés. Secrets API = état React éphémère (JAMAIS localStorage).
- **Clients** : CRUD, Google Maps (`VITE_GOOGLE_MAPS_KEY`), loyalty, revenus. **Fournisseurs** : soft-delete restorable. **Commandes (PurchaseOrder)** : CRUD, statuts.
- **Auth** : JWT + bcrypt12, `ROLE_PERMISSIONS` slug-based, `canAccess(role, slug)`. Rate-limit login 30/15min/IP. WS `/api/ws` fail-closed (`lib/wsAuth.ts`).
- **Emails Resend** : `escHtml()` + `baseTemplate()`. Multi-tenant : `tenantId` partout, soft-delete `deletedAt`, `email @unique` libéré.
- **Settings** : Shop/POS (9 params dont `enableLoyalty`, `requireCashier`…) / Notifications (6 toggles crons) / Lang (push tenant) / Security.

### Tests & A11y
- **Front : 405 vitest** (helpers purs + anchor tests + contraste AA 9 thèmes). **Back : 381 vitest** (prisma mocké `vi.mock('../db')`, routes via `app.inject()`, mock `authenticate`). OCR : `vi.hoisted()` + classe constructeur.
- **E2E Playwright** : live prod, `storageState` `e2e/.auth/user.json`, `workers:1`. **Un seul `page.goto` par test** (2ᵉ → logout). Langue tenant → reset `PATCH /api/tenant {lang:'fr'}` afterEach/afterAll.
- **A11y** (audité 2026-06) : UI/UX 93,7 / a11y 91. Infra : `useModalFocus` (34 modales), `announce()` (8 domaines), skip-link, `*:focus-visible`, `prefers-reduced-motion`.

## Règles devise / montants ⚠️

- **Tout XOF en base.** `fmt()`/`useFormatAmount()` convertissent XOF→devise. **Ne JAMAIS pré-convertir** (= double conversion).
- **Exception** : valeurs déjà en devise tenant (`pointsPerAmount`, remises fidélité, valeur carte) → `formatInCurrency` SANS conversion.
- **Pages publiques** : `convertAmount` + `formatInCurrency` (fonctions pures — pas le hook).
- **Devise affichage = per-device** ; `setTenant` n'adopte `tenant.currency` qu'au changement de boutique.
- Saisie formulaires : devise affichage → `toXOF()` au submit. Suffixe = `CURRENCY_SYMBOLS`.
- Agrégats CA : `Sale.total`, bornes `new Date(y,m,1)` serveur, refunded exclus.

## Pièges techniques

### Frontend
- **Découpe composant** : test ancrage d'abord (rendu + interactions), puis découpe identique.
- **`appStore` partialize** : `...rest` persiste tout → exclure états session (cart, cashier) ou resetter dans authStore login/logout.
- **QR/barcode scan** : noir sur blanc opaque (jamais `var(--text)`/`transparent`).
- **`transform` sur ancêtre** → casse `position:fixed`. Animer opacité seule. Diag : `getComputedStyle(...).transform`.
- **`applyAccentColor()`** écrase `--p/--p2/--p3` → verrouiller thème DANS `applyAccentColor()` (keyed `body.className`). `IS_LIGHT_THEME = t => t === 'light' || t === 'soleil'` pour styles externes.
- **Date « now »** : param injectable défaut `new Date()` — jamais de littéral `new Date('...')`.
- **SVG + `var()`** : `fill="var(--…)"` ne résout pas → `style={{color}}` + `fill="currentColor"`.
- **Polling setInterval** : closure stale → `useRef` pour valeur courante. Logique succès dans `useEffect([status])` séparé.
- **Google Maps** : re-init via compteur `mapVersion` (state) + `key={mapVersion}` sur div. `setOptions({styles})` non fiable à chaud.
- **IDs employés** : cuid string — jamais `Number(id)`.
- **% recharts** : UNE source de vérité dans les données — `p.percent` undefined au survol. **Palette index** : toujours `% COLORS.length`.
- **PII** : numéros téléphone jamais dans les logs Railway.

### E2E Playwright
- SW PWA court-circuite `page.route()` → `serviceWorkers: 'block'`.
- Captures à conserver → `e2e/screenshots/` (gitignored).
- Caméra @zxing : `--use-fake-device-for-media-stream` + `--use-fake-ui-for-media-stream`.
- Pas de `page.reload()` (→ logout). Seeder via `page.addInitScript`.
- Tooltip donut recharts : `page.mouse.move` sur rayon inner/outerRadius (hover secteur = trou central).

### Backend
- **Crons** : `setInterval` + garde fenêtre-temps + marqueur idempotent en base.
- **Webhooks** : HMAC-SHA256 raw body, `timingSafeEqual`. Wave fail-open sans secret (cf. dette).
- **Tests PDF** : signature `%PDF` + taille >500o. `sharp` pour conversion images.

## Dette ouverte

### 🔴 Critique
- **SMS** (`notifSmsSales`/`notifSmsStock`) : Africa's Talking reco. `services/sms.ts`, `SMS_API_KEY`. **XL**
- **Push PWA** : VAPID keys, `PushToken` prêt inutilisé, SW sans handler. **XL**
- **Wave webhook fail-OPEN** (`services/wave.ts` : `if (!WAVE_SECRET) return true`) → poser `WAVE_WEBHOOK_SECRET` Railway. **S**
- **Campay go-live** : poser `CAMPAY_WEBHOOK_KEY` + `CAMPAY_ENVIRONMENT=production`. **S**
- **PayDunya go-live** : `PAYDUNYA_MODE=live` + clés live. Flux POS non validé runtime end-to-end. **S**

### 🟡 Medium
- **Paie statuts** : state local pur (`Payroll.tsx`), perdu au refresh. Pas de table Payroll en base. **M**
- **Bundle recharts ~105KB gz** : lazy + hors precache. Remplacer visx = **L**.
- **A11y résiduel** : 3 champs SectionCatalog sans label, POSModals pays non-listbox, Stock liste divs.
- **Styles inline long-tail** : ~65 grilles fixes, fallbacks `var(--acc3,#00B8FF)`.

## Comptes démo

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant `demo-tenant-001`. 5 employés (IDs `demo-emp-${name}`). Données prod hors seed : `currency='EUR'`, `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.

## Env vars

**Railway** : `DATABASE_URL`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`.
- MTN : `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS`
- Campay : `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS`
- PayDunya : `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS`

**Vercel** : `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (.env.local), `VITE_VAPID_PUBLIC_KEY` (à venir).

## Mobile

CDC : `MOBILE_APP_CDC.md`. Stack cible React Native. À démarrer.
