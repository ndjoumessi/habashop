# HabaShop — État du projet

Guide pour Claude Code. Lis ce fichier en premier avant de bosser sur le repo.

## C'est quoi

SaaS de gestion commerciale multi-tenant pour boutiques/superettes (Afrique de l'Ouest & francophone, puis international). Monorepo npm workspaces.

## Stack technique

- **`apps/frontend`** — React 18 + TypeScript + **Vite 8** + **vitest 4**, Zustand (state, persisté localStorage), React Router (≥6.30.4, open redirect patché), Lucide icons, recharts, jsbarcode (EAN-13 SVG), @zxing (scan caméra), qrcode + html2canvas (carte fidélité), Playwright (E2E), Sentry (`@sentry/react` + `@sentry/vite-plugin`, source maps au build, org **haba-76** / projet **habashop-web**), PWA via vite-plugin-pwa 1.x.
- **Perf web** : routes toutes lazy (App.tsx) + préchauffage idle Dashboard/POS post-login (mêmes spécifieurs d'import → même chunk). Precache PWA ~1,7 MB : les chunks `charts`/`barcode`/`canvas` (manualChunks) sont EXCLUS du precache (`workbox.globIgnores`) et servis en runtime CacheFirst `lazy-chunks-cache` — préserver ce découpage si on touche vite.config.ts. Chunk principal ~68 KB gz.
- **`apps/backend`** — Fastify + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend (emails), pdfkit (factures + Ticket Z, PDF serveur), twilio (WhatsApp auto + manuel), Sentry, crons `setInterval` natifs.
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF** + conversion) et multi-langues (fr/en/es/it).

## Déploiement

### Frontend — Vercel (`habashop.vercel.app`)
- **Toujours depuis la racine** `/Users/nelson/Documents/Projets/habashop` :
  ```bash
  vercel --prod --yes
  vercel alias set habashop-<hash>-ndjoumessis-projects.vercel.app habashop.vercel.app
  ```
- ⚠️ **JAMAIS depuis `apps/frontend`** — `vercel.json` est à la racine, le CLI résout les paths depuis `cwd` → path doublé `apps/frontend/apps/frontend` = échec.
- Auto-deploy GitHub actif (push `main`). S'il lag (>10 min), forcer avec les 2 commandes ci-dessus.

### Backend — Railway (`habashop-production.up.railway.app`)
- Service `habashop` dans le projet `grateful-happiness`. Depuis la racine (après `railway link` une fois) : `railway up --ci`.
- Auto-deploy GitHub actif sur push `main`.

## ⚠️ Pièges critiques (lis avant de lancer une commande)

1. **Node par défaut = v10 → casse tous les builds** (`tsc`/`vite`/`vercel`/`railway`/`tsx`). Toujours préfixer :
   ```bash
   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
   ```
2. **`DATABASE_URL` pointe sur la DB PROD Railway** — PAS de DB locale. JAMAIS `db:migrate`/`db:seed`/`migrate dev` sans confirmation explicite de Nelson. `prisma db push` accepté pour ajouts sans risque de data loss.
3. **Git : commit + push directement sur `main`.** Pas de feature branch.
4. **Vercel = depuis la racine, jamais depuis `apps/frontend`.**

## Commandes

Toujours avec le PATH Node 20. Depuis `apps/frontend` :
```bash
npx tsc --noEmit        # typecheck — 0 erreur
npm test                # vitest
npm run build           # tsc && vite build
```
Backend (`apps/backend`) : `npx tsc --noEmit` · `npx prisma db push` · `npx tsx <script>.ts` (one-shot DB : pattern check-X.ts / fix-X.ts).

**Rituel avant CHAQUE commit** : `tsc --noEmit` (0) → `npm test` (tous verts) → `npm run build` (OK) → commit/push main. Auto-deploy lent ? front : `vercel --prod --yes` + alias ; back : `railway up --ci`.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran (Dashboard, POS, Stock, Orders, Customers, HR,
                 #   Planning, Payroll, Goals, Expenses, Reports, Forecasts, Users,
                 #   Settings, Activity, Notifications, AIAssistant, APIDocs, Integrations,
                 #   AdminDashboard, UpgradePlan, PaymentCallback, Onboarding, LandingPage,
                 #   SignupPage, LoginPage, Marketing, Pricing, Privacy)
                 #   ⚠️ /privacy = route PUBLIQUE (hors auth) — URL exigée par Google Play
  components/    # par domaine : customers/ hr/ pos/ stock/ reports/ settings/ orders/
                 #   planning/ payroll/ users/ suppliers/ expenses/ landing/ signup/
                 #   integrations/ layout/ ui/ → chaque domaine a souvent un `*Shared.tsx`
  stores/        # appStore.ts (lang, currency, tenant, caisse, cart… persisté localStorage)
                 # authStore.ts (user, token, ROLE_PERMISSIONS + canAccess slug)
  hooks/         # useI18n.ts, usePagination.ts, useFormatAmount…
  i18n/index.ts  # dictionnaire t() : { fr, en, es, it }, 575+ clés
  utils/export.ts # CSV / PDF / labels (JsBarcode SVG)
  lib/api.ts     # tous les *Api (productsApi, salesApi, customersApi, shiftsApi,
                 #   leaveRequestsApi, attendanceApi, tenantApi, loyaltyApi…)
```

## i18n — convention CRUCIALE (100% fr/en/es/it)

Trois mécanismes coexistent ; **utilise celui déjà présent dans le fichier** :
1. **Helper `i(fr, en, es, it)`** via `useI18n()` — standard nouveau code.
2. **Ternaire inline 4-langues** — TOUJOURS les 4 (jamais binaire FR/EN).
3. **`t('key')`** global → `src/i18n/index.ts` ; nouvelle clé = dans **les 4 blocs**.

Autres helpers : `makeI(lang)` (settings), `pick(lang, obj)`.

**Pattern data traduites** : map `Record<string, Record<lang, string>>` + `xxxLabel(value, lang)` — la **valeur FR reste la clé** (filtres/data), seul l'affichage est traduit. Ex : `hrShared.tsx`, `posShared.tsx`, `stockShared.tsx`. Les chaînes FR apparentes dans les data/filtres = ce pattern, **ne pas y toucher**.

**NE PAS traduire** : marques (HabaShop, Wave, Orange Money, MTN, Railway, Vercel, WhatsApp…), codes (XOF, EUR, FCFA), enums/clés API, noms de pays. PDF (`utils/export.ts`) hors périmètre i18n.

## Conventions de code

- Montants : `useFormatAmount()` ou `fmt()` — jamais de formatage manuel.
- Icônes : **Lucide uniquement** (pas d'emoji UI), `cursor:pointer` + transitions sur cliquables.
- Couleurs : **`var(--*)`** systématiquement — jamais de hex hardcodé (9 thèmes). Exceptions intentionnelles : palettes sémantiques (avatars/catégories/charts/shifts), styles Google Maps, templates PDF, pages publiques `.public-scope`, `#fff` sur boutons colorés, défs de thème (`appStore.ts`). Le chantier de conversion est **CLOS** — ne pas relancer de lot, le restant est correct.
- Graisses : **tokens `--fw-regular(500)/--fw-semibold(700)/--fw-bold(800)` uniquement** — jamais de `fontWeight` numérique brut (sweep 266 occ. fait ; exclusions assumées : templates print/PDF embarqués, SVG data-URL Maps, pages publiques `.public-scope`). Semibold = titres page/panel/modale, valeurs héro mono, boutons primaires ; regular = le reste.
- **Toasts sans emoji** (purge faite sur 26 fichiers) — texte seul. Mutations clés : appeler **`announce(msg)`** (`@/lib/announce`, région aria-live globale AppLayout) à côté du `toast.success`.
- **Toute nouvelle modale** : `const boxRef = useModalFocus<HTMLDivElement>()` (`@/hooks/useModalFocus` — piège Tab, pile de modales, restauration du focus) + `ref` sur la `.modal-box` + `role="dialog"`/`aria-modal`/`aria-label` i18n sur le backdrop. 34 modales branchées. ⚠️ `aria-grabbed`/`aria-dropeffect` = dépréciés ARIA 1.1, ne pas en poser (utiliser aria-pressed + aria-live).
- Pills de statut : pattern tokens `--c-{green,orange,blue,red,amber}-bg/-border` + couleur texte sémantique (`--acc2`/`--warn`/`--acc3`/`--danger`), `--r-full`, 12px semibold — cf. `ordersShared.OrderStatusPill`, `suppliersShared.SupplierStatusPill`.
- Logs : `logger.log/warn` (`@/lib/logger`, filtre `import.meta.env.DEV`) ; pas de `console.*` en commit.
- Éditions de masse multi-octets/emoji : script Python ou `.ts` tsx-runnable, pas de `sed`.
- UI : primitives `components/ui/` (`ResponsiveGrid`, `IconButton`, `Tabs`/TabBar, `Button`/AppButton, `FocusTooltip`, `Skeleton`, `FilterSelect`) — voir `components/ui/README.md`. Tokens `--sp-*`, `--fs-*` (plancher 11px), `--fw-*` (3 graisses). ⚠️ FS macOS case-insensitive : ne pas créer `Button.tsx`/`Tabs.tsx`/`Tooltip.tsx` (collision scaffolds shadcn minuscules, conservés car importés entre eux).

## Specs prescriptives

Nelson fournit souvent des specs détaillées. Si une instruction ne matche pas le code réel (fichier/string introuvable, déjà fait), **réconcilie et continue** — ne bloque pas. Questions réservées aux choix à fort enjeu / irréversibles. Vérifie qu'un fichier/flag mentionné existe encore avant de t'appuyer dessus.

## État fonctionnel — ce qui marche

### Core métier (CRUD + backend, scope tenant partout)
- **Produits/Stock** : SKU auto `PRD-NNNN` (`@@unique([tenantId,sku])`), EAN-13 (génération/validation/SVG JsBarcode), scan caméra @zxing, supplierId FK, multi-prix `priceTiers`, étiquettes imprimables (presets Avery).
- **POS/Ventes** : caisse, panier (persisté appStore, `clearCart()` au login/logout), paiements cash/wave/orange/mtn/card, remises, fidélité. **Remboursement TOTAL** (`POST /api/sales/:id/refund`, manager/admin, motif requis, restock optionnel, idempotent 409, status `refunded` exclu du CA partout, retire les points). **Idempotence création** (`idempotencyKey` body ou header `Idempotency-Key`, `@@unique([tenantId,idempotencyKey])`, course P2002 gérée). **Paiement mixte** : `Sale.cashAmount/mobileMoneyAmount/cardAmount`, validation `|somme−total|≤1` + ≥2 modes (`MIXED_SUM_MISMATCH`/`MIXED_NEEDS_TWO`), `paymentMode='mixed'` ; simple → ventilé dans le bon seau. Helper `lib/paymentSplit.ts`. Champ « Montant reçu » : négatif interdit (clamp), états rouge insuffisant / vert + monnaie à rendre.
- **MTN MoMo** (Cameroun) : `services/mtnMomo.ts` — token Basic auth + cache, `requestToPay()` (HTTP 202), `getPaymentStatus()`. Route `POST /api/payments/mtn/request` (CASHIER+) : reçoit XOF, convertit en **EUR en sandbox** (`xofToCurrency`, min 1 €) ou **XAF en prod** (parité 1:1). Polling 3s × 40 tours côté front (`mtnMomoApi`). `Sale.mtnMomoReference String?`. **Sandbox** : `MTN_SANDBOX_AUTO_SUCCESS=1` requis explicitement pour simuler PENDING→SUCCESSFUL (jamais déclenché par var absente → fail-open interdit). Env : `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_USER_ID`, `MTN_MOMO_API_KEY`, `MTN_MOMO_ENVIRONMENT` (sandbox/production).
- **Orange Money via Campay** (Cameroun) : `services/campay.ts` — token cache 55 min + fallback `CAMPAY_TOKEN` permanent, `collect()`, `getStatus()`. Routes `POST /api/payments/campay/request|status|webhook`. Sandbox : **montant forcé à 10 XAF** (limite 25 XAF max sandbox Campay) ; `CAMPAY_SANDBOX_AUTO_SUCCESS=1` pour simuler PENDING→SUCCESSFUL. Webhook fail-closed si `CAMPAY_WEBHOOK_KEY` absent, HMAC-SHA256 `timingSafeEqual`. `Sale.campayReference String?`. Env : `CAMPAY_USERNAME`, `CAMPAY_PASSWORD`, `CAMPAY_TOKEN`, `CAMPAY_WEBHOOK_KEY`, `CAMPAY_ENVIRONMENT` (demo/production), `CAMPAY_SANDBOX_AUTO_SUCCESS`.
- **Flux polling POS (MTN + Orange)** : bouton "Encaisser" → modale de confirmation → section polling (champ numéro, spinner, SUCCESSFUL → `confirmSale(mtnRef?, campayRef?)`, failed/timeout → Réessayer). Le bouton Confirmer standard est masqué (`isMtnMode`/`isOrangeMode`). Reset complet sur `onMtnRetry`/`onOrangeRetry`. **Wave** conserve son bouton Confirmer inline dans le panier (pas de polling API). `normalizeOrangePhone`/`normalizeCameroonPhone` : accepte 8–15 chiffres (tout pays), normalise les numéros Cameroun (6XXXXXXXXX → 237XXXXXXXXX, +237/237 → forme canonique).
- **Campay carte (Visa/Mastercard)** : `getPaymentLink()` (`services/campay.ts`, POST `/api/get_payment_link/` **underscore**, champ réponse `link`, `payment_options:'CARD'`). Route `POST /api/payments/campay/card-link` → QR code hébergé (`qrcode` lib, noir/blanc opaque) scanné par le client. La référence du lien hébergé est **JWT-incompatible** avec `/status` → en sandbox auto-success, référence locale `SANDBOX-CARD-{ts}` que `/status` reconnaît et approuve sans appel réseau (front affiche un indicateur TestTube au lieu d'un QR fictif).
- **Stats paiement du jour** (`GET /api/payments/today-stats`, lecture tout-membre, scope tenant) : count + montant XOF + dernière réussite **par fournisseur** (MTN via `mtnMomoReference`, Campay via `campayReference`), jour **UTC** (même borne que Ticket Z), refunded exclus. Helper pur `computePaymentStats` (5 tests). Consommé par la page Intégrations (cartes MTN/Campay) ; le front convertit XOF→devise via `fmt`.
- **Page Intégrations** (`pages/Integrations.tsx`, route `/app/integrations`, **AdminOnly**) : cartes groupées par catégorie (Paiements / Notifications / Base de données / Hébergement / Monitoring & IA). Métriques **réelles uniquement** — latence + taux d'erreur dérivés du **ping HEAD live** (`mode:'no-cors'`), transactions du jour depuis `today-stats`. Les services sans endpoint testable (`noPing`: paiements, Redis) **masquent** la grille latence/erreurs au lieu d'afficher du faux. ⚠️ **Ne PAS réintroduire** de `calls/mois`/`uptime`/« il y a X min » hardcodés (purgés — c'étaient des valeurs inventées du design d'origine). Modal config **PayDunya** : champs clés API en état React **éphémère** (JAMAIS de secret en localStorage — XSS), bouton Save désactivé « Bientôt » tant que le backend PayDunya n'est pas branché.
- **Facture PDF** : `GET /api/sales/:id/invoice` (pdfkit serveur, `lib/invoicePdf.ts`). Numéro `FAC-{YYYY}-{NNNNN}` figé à la 1ʳᵉ demande (`Sale.invoiceNumber`, unique tenant, idempotent). Front : `openAuthedPdf` (fetch JWT → blob → onglet ; `window.open` direct n'enverrait pas l'Authorization).
- **Ticket Z** : modèle `TicketZ` (`@@unique([tenantId,date])`, regénérable). `POST /api/ticket-z/generate` (MANAGER/ADMIN, jour UTC, upsert idempotent) + `/today` + `/history` + `/:id/pdf`. `computeTicketZ` : CA hors refunded, breakdown paiement = **COALESCE**(split, fallback `paymentMode` pour anciennes ventes).
- **Fidélité** : `Customer.loyaltyPoints` + `LoyaltyTransaction` (earn/reverse). Créditage 100% **serveur** (`floor(NET/pointsPerAmount)` si `enableLoyalty`). Config par tenant : `pointsPerAmount`/`bronzeThreshold`/`silverThreshold` (1000/2000/5000) + remises par palier `bronzeDiscount/silverDiscount/goldDiscount` (5/10/15%), ADMIN only, validation bronze<silver. **Modèle A backend autoritaire** : si client lié + loyalty on, `POST /api/sales` calcule `loyaltyDiscount = total × tierPct` (plafond combiné 50%), pose **`sale.total = NET`**, points + CA sur le NET. Le front envoie le **BRUT** + `customerId` et calcule le NET localement pour l'affichage — **ne PAS envoyer le net** (double remise). Helpers purs `lib/loyalty.ts`. Remise/points seulement si client lié.
- **Sélecteur client inline POS** (`POSCustomerSelector` dans POSCart) : recherche debouncée 300ms ≥2 chars → `GET /api/customers?search=X` (filtre nom/tél, limite 8, enrichi tier ; <2 chars → liste complète rétro-compat) ; ou scan QR (`BarcodeScanner` @zxing réutilisé, lit le QR nativement) → `GET /api/customers/:id`. QR carte = `HABA-CUST:<id>` complet (le label `HS-XXXXXXXX` affiché reste tronqué). Chip palier/remise gated sur `enableLoyalty` (préférence per-device).
- **Carte fidélité numérique** (`LoyaltyCardDigital.tsx`, `GET /api/customers/:id/loyalty-card`) : zone haute = fonds sombres FIXES par palier (artefact PNG exporté, pas du chrome thémé), QR **noir/blanc opaque** ; zone basse thémée. Téléchargement PNG (html2canvas) + Web Share.
- **WhatsApp auto (Twilio)** : compte plateforme (env Railway `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM`), opt-in `Tenant.enableAutoWhatsApp`. `services/whatsappSend.ts` : envoi gardé (phone + toggle + 3 env), **fail-silent**, hook async non bloquant dans `POST /api/sales`. ≠ `autoWhatsApp` = envoi MANUEL (`/api/whatsapp/send-ticket`, numéro saisi en modale ; devise+langue tenant). 3ᵉ mécanisme : **rapports gérant** (crons `routes/whatsapp.ts` 20h résumé / 8h alerte stock, TZ Dakar) → envoyés UNIQUEMENT si `Tenant.ownerPhone` est configuré (Réglages → Notifications ; null = rien — l'ancien fallback numéro hardcodé = fuite multi-tenant, supprimé). Sandbox : client doit `join <mot>-<mot>` ; prod = Business API + template.
- **Rapports stock** (`GET /api/reports/inventory`, cache 5 min) : à réapprovisionner (stock ≤ stockMin, vélocité 30j) + dormants (0 vente 60j ET stock>0, valeur immobilisée). + résumé Dashboard.
- **Rapport comptable mensuel** (`GET /api/reports/accounting?month=YYYY-MM`) : RBAC ADMIN/MANAGER/ACCOUNTANT, cache Redis, revenus = `Sale.total` (réconcilie le dashboard), salaires = `Employee.salary` projeté (pas de table Payroll), JSON `resultBeforePayroll` + `resultAfterPayrollEstimate`. Conversion XOF → devise tenant côté serveur (`lib/currency.ts`) ; la modale formate **sans reconvertir**.
- **Clients** : CRUD, Google Maps (`VITE_GOOGLE_MAPS_KEY`), loyalty, revenus cumulés. **Fournisseurs** : CRUD, soft-delete restorable. **Commandes (PurchaseOrder = fournisseurs)** : CRUD, statuts.
- **RH** : employés, contrats CDI/CDD, primes, historique salaires. **Présences/Planning/Congés = 100% backend, multi-device** : `Attendance` (status PRESENT|LATE|ABSENT|HALF|LEAVE|REST, `@@unique([tenantId,employeeId,date])`), `Shift` daté (`shiftTypeKey` morning|afternoon|full|night|rest|leave, `@@unique([tenantId,employeeId,date,shiftTypeKey])` = **multi-shift/jour mais pas 2× le même type**), `LeaveRequest` (PENDING|APPROVED|REFUSED). Écritures ADMIN/SUPER_ADMIN/MANAGER/HR (403 sinon), lecture tout-membre. Approve congé → Shift `leave` + Attendance LEAVE par jour (`eachDateInclusive`, best-effort) + cellules verrouillées ; shift `rest` → Attendance REST auto. Planning : état `shiftsByDate` `Record<"empId_date", {type,id}[]>`, MAJ optimiste + rollback atomique, copie de semaine (ignore congés), drag&drop, vue mois 6×7 (pastilles agrégées + drill semaine). Plus AUCUN localStorage planning/présences.
- **Paie** : bulletins PDF front/jsPDF, calcul brut/CNSS/IR/net. Cron récap mensuel (`services/payrollReport.ts`, toggle `notifEmailPayroll`, 1er du mois 8h, idempotent via `Tenant.lastPayrollReportMonth`, devise tenant, email localisé, destinataire ADMIN dérivé serveur) + route test `POST /api/admin/payroll-report/run` (**dryRun:true par défaut**).
- **Dépenses** : CRUD catégories (Loyer/Énergie/Transport/… — **pas** de « Salaires »).
- **Utilisateurs** : invite (Resend + bcrypt 12), toggle active/2FA, soft-delete avec libération email (suffix `_deleted_${ts}`). `requireAdmin` = ADMIN + SUPER_ADMIN ; validation `body.role` whitelist.
- **Objectifs (Goals)** : CRUD backend, `linkedMetric` enrichi live depuis dashboardApi.stats.
- **Activity/Audit** : `GET /api/audit-logs` par tenant, render i18n (21 actions).
- **Dashboard** : KPIs tendances réelles (`computeTrend`, null si prev≤0 → pas de badge), skeletons, donut catégories (fusion par clé normalisée `normCat()`).
- **Catalogue WhatsApp public** (`/c/:slug`) + auto-détection devise selon pays (Signup/Onboarding, fallback XOF).

### Settings (persistance backend)
Shop (nom/email/phone/address/country/vatRate), POS (9 params dont enableLoyalty, priceMode…), Notifications (6 toggles consommés par crons : `notifEmailSales` weekly, `notifEmailStock` daily 7h, `notifEmailPayroll` mensuel), Lang (poussée tenant + restore au login), Security (changePassword, JWT info, settingsLocked).

### Auth & RBAC
- JWT + bcrypt12. `ROLE_PERMISSIONS` slug-based : ADMIN/SUPER_ADMIN = `*`, MANAGER/CASHIER/ACCOUNTANT/HR = listes. Guard `canAccess(role, slug)`.
- Rate-limit login **30 / 15 min / IP** (CGNAT mobile Afrique de l'Ouest regroupe des users légitimes derrière 1 IP — ne pas redescendre à 10) ; register 5/1h. WebSocket `/api/ws` : auth fail-closed inline (`lib/wsAuth.ts` `decideWsAuth`, check `isUserActive` + tenantId).

### Emails Resend
Welcome, trial reminders, upgrade, weekly report, invitation, stock alert, récap paie. `escHtml()` sur les interpolations, `baseTemplate()` commun.

### Multi-tenant
Scope `tenantId` sur toutes les routes ; soft-delete `deletedAt` partout ; `email @unique` global libéré au soft-delete.

### Accessibilité (chantier 2026-06 — audité)
- **Scores audités** (lecture seule, post-correctifs) : UI/UX Paie 93 / Réglages 93 / Planning 95 (moyenne 93,7) ; a11y globale 91 (pondérée 7 pages).
- Infra : `useModalFocus` (34 modales : piège Tab + pile + restauration), `lib/announce.ts` + région aria-live AppLayout (mutations annoncées sur 8 domaines), skip-link → `#main-content`, `*:focus-visible` global, `prefers-reduced-motion`.
- Planning : déplacement de créneau **clavier + tactile** via poignée GripVertical (Entrée/tap = saisir, flèches/Tab/tap = cibler, Entrée/tap = déposer, Échap = annuler, Suppr = effacer) — réutilise `onMoveShift`, drag souris inchangé. Ne pas casser ce dispositif en retouchant PlanningGrid.
- Tables labellisées (`aria-label` + `scope="col"`), `role="status"` sur compteurs de résultats/états vides, dropdowns maison en `aria-expanded`/listbox, Switch settings = `role="switch"` + `aria-checked` + label + `aria-describedby`.

### Tests
- **405 vitest front / 353 back** (vitest 4 ; helpers purs + anchor tests de découpe + contraste AA 9 thèmes). Tests backend = **prisma mocké** (`vi.mock('../db')`) — jamais la DB prod. Routes testées via `Fastify().register(routes)` + `app.inject()` en mockant `../middleware/authenticate`.
- **Playwright E2E = live contre prod** (`baseURL = https://habashop.vercel.app`, login démo). Session réutilisée via `storageState` (projet `setup` → `e2e/.auth/user.json` gitignored) ; specs : `login()` no-op + **un SEUL `page.goto`** par test (un 2ᵉ goto annule le `/me` → `.catch(logout)` → bounce `/login`). **`workers:1`** (backend mono-réplique → parallélisation = cold starts = logout). `smoke.spec` surcharge storageState vide.
- ⚠️ **Tenant démo partagé** : `i18n-es-it.spec` change la langue tenant (persistée) → reset **déterministe via API** (`PATCH /api/tenant {lang:'fr'}` awaité) en afterEach + afterAll, échec = throw. Seed force `lang:'fr'` (create ET update). Remède manuel si drift : `PATCH /api/tenant {lang:'fr'}`.

## Dette technique — points OUVERTS

### 🔴 Critique
- **SMS** (`notifSmsSales`/`notifSmsStock`) : infra à choisir (reco : Africa's Talking). `services/sms.ts`, env `SMS_API_KEY`. **XL**
- **Push PWA** (`notifPushAll`) : VAPID keys (Railway + Vercel `VITE_VAPID_PUBLIC_KEY`), modèle `PushToken` prêt mais inutilisé, SW sans handler push, pipeline complet à créer. **XL**
- **Wave webhook fail-OPEN en sandbox** (`services/wave.ts`) : `if (!WAVE_SECRET) return true`. **Bloquant go-live Wave prod** : poser `WAVE_WEBHOOK_SECRET` (Railway) ET vérifier qu'une signature invalide → 401. **S**
- **`CAMPAY_WEBHOOK_KEY` à poser sur Railway** : sans lui, le webhook Campay (Orange Money Cameroun) rejette toutes les notifications (fail-closed). Poser aussi `CAMPAY_USERNAME`/`CAMPAY_PASSWORD`/`CAMPAY_ENVIRONMENT=production` pour go-live Campay prod. **S**

### 🟡 / 🟢
- **Paie : statuts non persistés** — « Générer la paie »/« Marquer payé » = state local pur (`pages/Payroll.tsx`), perdu au refresh ; il n'existe pas de table Payroll en base. Seul point structurel relevé par les audits UI/UX. **M** (modèle + routes + câblage).
- **Bundle recharts ~105KB gz** : lazy ET hors precache PWA (runtime cache) ; remplacer par visx pour réduire le poids brut = **L**, non fait.
- **Sweep styles inline → tokens** + migration long-tail vers primitives ui/ : incrémental, partiellement fait (font-weights ✅, gradients CustomersModals ✅ ; restent ~65 grilles fixes, fallbacks `var(--acc3,#00B8FF)`, ambres SectionLang).
- A11y résiduel signalé (mineur) : 3 champs SectionCatalog sans label, panneau indicatif pays POSModals non-listbox (restructuration DOM), vue liste Stock en divs sans sémantique table.
- Tests logique métier backend au-delà des helpers existants : possible, **L**.

> Tout le reste de l'ancienne dette est **CLOS** (découpes pages <600L avec anchor tests, HR XL, aria-labels, couleurs hardcodées chrome, WebSocket auth, devise SectionLang, og-image webp, i18n Marketing, émojis Head, **npm audit 0 vuln** — vite 8/vitest 4 front+back sans aucun ajustement de config, **redesign visuel 10 pages**, **chantier a11y** — voir section A11y). Ne pas relancer ces chantiers.

## Application mobile

- CDC : `MOBILE_APP_CDC.md` à la racine. Stack cible React Native. **À démarrer.**

## Comptes démo

Seedés dans le backend réel (`demo1234`) → login normal = vrai JWT. L'ancien fallback démo « hors-ligne » (`demo-token-local`) a été **SUPPRIMÉ** (causait un P0 de déconnexion immédiate) ; les boutons démo de LoginPage préremplissent juste le formulaire.
- `admin@` / `manager@` / `cashier@` / `accountant@` / `hr@habashop.com` — tous `demo1234`, tenant `demo-tenant-001` (admin = ADMIN, etc.).
- 5 employés seedés (Marie Bakayoko, Kofi Diallo, Aminata Touré, Seydou Koné, Fatoumata Ndiaye), IDs `demo-emp-${name}` (pas des cuid).

## ⚠️ Règles devise / montants (source de bugs récurrents)

- **Tout est stocké en base XOF.** `useFormatAmount`/`fmt`/`formatAmount`/`fmtMoney` **convertissent EUX-MÊMES** XOF→devise. Ne JAMAIS pré-`convertCurrency` avant (= **double conversion**, cf. BUG 2 bulletin paie : 450 000 XOF → ~1,05 € au lieu de 686,02 €). Avant de conclure un bug de conversion, **vérifier la donnée prod réelle** (script tsx read-only).
- **Exception inverse** : valeurs **déjà en devise tenant** (`pointsPerAmount`, remises fidélité, « Valeur dispo. » carte) → `formatInCurrency` **SANS conversion**. `totalRevenue` = XOF → convertir. Ne pas confondre les deux sens.
- **Devise d'affichage = préférence per-device** (ne pousse PAS au tenant) ; `appStore.setTenant` n'adopte `tenant.currency` qu'au **changement de boutique**. La devise réelle du tenant est fixée à l'onboarding. `lang` garde le pattern push-tenant (bénin).
- **Catalogue/pages publiques** : pas de `useFormatAmount` (hook lié au store auth) → `convertAmount` + `formatInCurrency` (fonctions pures d'appStore).
- Saisie de montants dans les formulaires : en devise d'**affichage**, conversion `toXOF()` au submit (pattern EmpModal/NewContractModal). Suffixe = symbole (`CURRENCY_SYMBOLS`), pas le code ISO.
- Agrégats financiers : tout nouveau total CA DOIT réutiliser la source dashboard (`Sale.total`, bornes `new Date(y,m,1)` heure serveur, refunded exclus) — sinon double comptage.

## Pièges connus / patterns

### Frontend
- **Découper un gros composant : test d'ancrage D'ABORD** (rendu + interactions, flux les plus riches en props/état), découpe à comportement identique, i18n ensuite. `tsc` ne couvre pas le câblage de props au runtime.
- **`appStore` persiste tout par défaut** (`partialize` avec `...rest`) → resetter les états de session (cart, cashier) dans authStore login/logout ou exclure de partialize.
- **Code-barres/QR pour scanner physique = TOUJOURS noir sur blanc opaque** — jamais `var(--text)`/`transparent` (inversion en thème sombre = illisible). Taille naturelle (pas `width:100%`).
- **`transform` (même identité) sur un ancêtre casse `position:fixed`** : un fill-mode `both` laisse `matrix(1,…)` au repos → devient bloc conteneur des modales. Fix : animer l'**opacité seule**. Diag : `getComputedStyle(...).transform` en remontant les ancêtres.
- **% affiché = UNE source de vérité** : calculer une fois et embarquer dans la ligne de données (`data.map((d,i)=>({...d, pct}))`) — recharts `p.percent` est parfois undefined au survol.
- **Palette par index = TOUJOURS `% COLORS.length`** à tous les points d'accès (pose ET lecture), sinon `undefined` au-delà de la taille.
- **`applyAccentColor()` écrase `--p/--p2/--p3`** (appelé après `applyTheme`) → verrouiller une couleur primaire d'un thème DANS `applyAccentColor()` (keyed sur `body.className`). `data-theme` n'est pas le témoin du mode clair — la preuve = `color-scheme` + vars CSS.
- **Date « now » jamais en littéral** (`new Date('YYYY-MM-DD')`, `startsWith('YYYY-MM')` en dur = bug latent). Rendre `now` injectable : param optionnel défaut `new Date()` → prod correcte + tests déterministes.
- **SVG + `var()`** : un attribut `fill="var(--…)"` ne résout pas → poser `style={{color}}` sur le `<svg>` + `fill="currentColor"`. Idem strokes recharts (laisser tel quel).
- Les ids employés sont des **cuid string** (`demo-emp-Marie`) — jamais `Number(value)` sur un id.
- Test de contraste auto `contrast-aa.test.ts` (9 thèmes, AA ≥4.5) : un changement de palette qui casse l'AA fait échouer la CI.
- **Polling + setInterval = fermeture stale** : dans un `setInterval`, les variables capturées au moment de la création ne se mettent pas à jour. Fix : `const refRef = useRef(null); refRef.current = ref;` → lire `refRef.current` dans le callback. Pour déclencher la logique de succès, utiliser un `useEffect([status])` séparé avec une closure fraîche (ne pas le mettre dans le callback de l'interval).

### E2E Playwright (live contre prod)
- **Le SW PWA court-circuite `page.route()`** → `test.use({ serviceWorkers: 'block' })` sur les specs qui mockent une API.
- **Le reporter HTML purge `playwright-report/`** en fin de run → écrire les captures à conserver dans `e2e/screenshots/` (gitignored).
- **Caméra factice** pour le scanner @zxing : `launchOptions.args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']` + `permissions:['camera']`.
- **Pas de `page.reload()`** (re-tape `/me` → cold-start Railway → logout) : seeder thème/flags avant le 1er `goto` via `page.addInitScript` (patch localStorage). Vérifier un rendu par luminance calculée, pas un hex en dur.
- `beforeinstallprompt` ne fire jamais en headless → le dispatcher synthétiquement. Animations opacity/transform : attendre ~500ms avant capture.
- **Tooltip donut recharts** : ne pas `hover()` le secteur (bbox = trou central) → balayer l'anneau via `page.mouse.move` sur un rayon entre inner/outerRadius.

### Backend / déploiement
- **Tests backend = prisma mocké, JAMAIS la DB prod.** Extraire la logique en helpers purs pour tester sans Fastify.
- **Régulariser un `prisma db push`** : migration additive idempotente (`ADD COLUMN IF NOT EXISTS`) + `prisma migrate resolve --applied` — JAMAIS `migrate reset`/`migrate dev` sur prod.
- **Déploiement back+front couplé : Railway D'ABORD**, puis Vercel (sinon le front lit des champs `undefined`).
- **Railway flaky** : `railway up` peut renvoyer des 500 transitoires, l'auto-deploy GitHub lague (~20-25 min). Remèdes : commit vide pour re-déclencher le webhook ; boucle de retry `railway up` ~2 min ; vérifier le nouveau build via un **endpoint nouvellement ajouté** (200 = bon build).
- **Logs Railway** : `railway logs` **stream** par défaut (ne se termine pas → `timeout` absent sur macOS). Pour un snapshot : `railway logs --deployment --lines N --json` (historique, sort). Déclencher un endpoint authentifié = login démo (`POST /api/auth/login`) → JWT → `curl -H "Authorization: Bearer …"`. ⚠️ `console.log(array)` de Node **s'imprime sur plusieurs lignes** que Railway **interleave** avec les requêtes concurrentes → illisible ; pour un diagnostic, logger **une ligne par entrée via `JSON.stringify(...)`**. Logs diag = temporaires, retirer après (règle « pas de `console.*` en commit »).
- **Crons = `setInterval` horaire + garde fenêtre-temps** ; vraie idempotence = marqueur en base (ex. `Tenant.lastPayrollReportMonth`) filtré dans le `findMany`. Cœur en service partagé cron + route admin `dryRun:true` par défaut.
- **Webhooks paiement** : signature HMAC-SHA256 du raw body (`timingSafeEqual`). Campay = fail-closed si `CAMPAY_WEBHOOK_KEY` absent ; Wave = fail-open sans secret (cf. dette). Env : `CAMPAY_WEBHOOK_KEY`, `WAVE_WEBHOOK_SECRET`.
- **`IS_SANDBOX` = sûr pour URL/devise, interdit pour auto-approbation paiement** : `(process.env.MTN_MOMO_ENVIRONMENT ?? 'sandbox') === 'sandbox'` évite les crashes env manquant mais ne JAMAIS utiliser `IS_SANDBOX` seul pour simuler un paiement PENDING→SUCCESSFUL. Toujours exiger `_SANDBOX_AUTO_SUCCESS=1` explicite. Une var manquante en prod ne doit pas approuver des paiements.
- **Flag sandbox = inline dans le handler, PAS une constante de module** : `const sandboxAutoSuccess = process.env.MTN_SANDBOX_AUTO_SUCCESS === '1' && IS_SANDBOX` — évalué à chaque requête. Si défini au niveau du module (`const SANDBOX = process.env... === '1'`), les tests `process.env` ne prennent pas effet (module déjà importé).
- **Numéros de téléphone = PII → jamais dans les logs backend** : utiliser `request.log.error({ err, step, amount, currency }, '...')` sans phoneNumber. Railway logs sont visibles à l'équipe.
- **Tester un PDF** : signature `%PDF` + taille >500o ; pdfkit rend en vitest (Helvetica intégrée) ; le Read tool lit les PDF (vérif visuelle).
- **Secrets frontend** : `apps/frontend/.env` est **tracké par git** (contient `VITE_GOOGLE_MAPS_KEY`) → JAMAIS de secret dedans ; utiliser `.env.local` (gitignored, ex. `SENTRY_AUTH_TOKEN` build-side) + variables de build Vercel.
- **Conversion d'images** : `sharp` (déjà en dépendance) — sips/cwebp/magick absents ou incapables.
- **Co-édition / prompts parallèles** : « file modified since read » ou commit inattendu = un prompt parallèle a commité → relire l'état réel (`git status`/`git log`/`grep`), réconcilier, re-`tsc`. Risque vécu : feature commitée **sans ses migrations** → prod casse.
- **Avant de conclure un root-cause** : vérifier la donnée prod réelle (script tsx read-only) ET le comportement runtime (test/E2E). Deux faux root-causes vécus (champ API, conversion PDF).

## Env vars (référence)

- **Railway (backend)** : `DATABASE_URL` (prod !), `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis.
  - MTN MoMo : `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_USER_ID`, `MTN_MOMO_API_KEY`, `MTN_MOMO_ENVIRONMENT` (sandbox/production), `MTN_SANDBOX_AUTO_SUCCESS` (=1 sandbox uniquement).
  - Campay (Orange Money CM) : `CAMPAY_USERNAME`, `CAMPAY_PASSWORD`, `CAMPAY_TOKEN` (token permanent fallback), `CAMPAY_WEBHOOK_KEY`, `CAMPAY_ENVIRONMENT` (demo/production), `CAMPAY_SANDBOX_AUTO_SUCCESS` (=1 sandbox uniquement).
- **Vercel / frontend** : `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (build-side, .env.local / build Vercel), `VITE_VAPID_PUBLIC_KEY` (à venir, push).

## Historique

i18n complété en 8 lots (fr/en/es/it partout). Découpes/refontes/design system « Daylight » (3 vagues : lisibilité AA, 6 primitives ui/, tokens + thème soleil ☀️ haut-contraste 9ᵉ thème) livrés. Thème par défaut `gold` (violet verrouillé + or `--acc2`). 2026-06 : redesign visuel des 10 pages (pills statut, `.data-table`, cards bg2, KPI sans glow) ; typo → tokens `--fw-*` (266 occ.) ; upgrade vite 8/vitest 4 (npm audit 0) ; precache PWA −39 % + warmup routes critiques ; chantier a11y complet audité (UI/UX 93,7 / a11y 91 — boucle audit→fix→re-audit, rapports `UIUX_AUDIT_COMPOSANTS.md` + transcripts) ; intégrations MTN MoMo + Campay/Orange Money Cameroun (USSD push, polling, sandbox simulation gated, sécurité PII + fail-open) ; Campay carte Visa/MC (lien hébergé QR) ; page Intégrations enrichie (catégories, +Sentry/Redis, pills méthodes, modal PayDunya sans secret localStorage) + endpoint `today-stats` (transactions paiement du jour, données réelles, faux chiffres décoratifs purgés). Détails : `git log`, `I18N_AUDIT.md`.
