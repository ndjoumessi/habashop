# HabaShop — État du projet

Guide pour Claude Code. Lis ce fichier en premier avant de bosser sur le repo.

## C'est quoi

SaaS de gestion commerciale multi-tenant pour boutiques/superettes (Afrique de l'Ouest & francophone, puis international). Monorepo npm workspaces.

## Stack technique

- **`apps/frontend`** — React 18 + TypeScript + Vite, Zustand (state, persisté localStorage), React Router, Lucide icons, recharts, jsbarcode (EAN-13 SVG), @zxing (scan caméra), Playwright (E2E). PWA installable via vite-plugin-pwa.
- **`apps/backend`** — Fastify + Prisma + PostgreSQL (Railway), bcryptjs auth + JWT, Resend (emails), Sentry, cron `setInterval` natifs.
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, base XOF + conversion live) et multi-langues (fr/en/es/it).

## Déploiement

### Frontend — Vercel (`habashop.vercel.app`)
- **Toujours depuis la racine** `/Users/nelson/Documents/Projets/habashop` :
  ```bash
  vercel --prod --yes
  vercel alias set habashop-<hash>-ndjoumessis-projects.vercel.app habashop.vercel.app
  ```
- ⚠️ **JAMAIS depuis `apps/frontend`** — `vercel.json` est à la racine et le CLI résout les paths relatifs depuis `cwd`. Lancer depuis `apps/frontend` produit un path doublé `apps/frontend/apps/frontend` et échoue.
- Auto-deploy GitHub Vercel actif (push `main` → build + promote `habashop.vercel.app`). Si l'auto-deploy lag (parfois >10 min), forcer manuellement avec les 2 commandes ci-dessus.

### Backend — Railway (`habashop-production.up.railway.app`)
- Service `habashop` dans le projet `grateful-happiness`.
- Depuis la racine (après `railway link` une fois) :
  ```bash
  railway up --ci
  ```
- Auto-deploy GitHub Railway actif sur push `main`.

## ⚠️ Pièges critiques (lis avant de lancer une commande)

1. **Node par défaut = v10 → casse tous les builds** (`tsc`/`vite`/`vercel`/`railway`/`tsx`). Toujours préfixer par le Node 20 :
   ```bash
   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
   ```
   Mets ça en tête de chaque session shell qui build/test/déploie.

2. **`DATABASE_URL` pointe sur la DB PROD Railway** — il n'y a PAS de DB locale de dev. Ne lance JAMAIS `db:migrate`, `db:seed`, `migrate dev` sans confirmation explicite de Nelson. `prisma db push` accepté pour les ajouts de colonnes/tables sans risque de data loss (sinon ajouter `--accept-data-loss` après vérification doublons).

3. **Git : commit directement sur `main`.** Pas de feature branch. Commit + push straight to main.

4. **Vercel = depuis racine, jamais depuis `apps/frontend`** (voir Déploiement).

## Commandes

Toujours avec le PATH Node 20. Depuis `apps/frontend` :
```bash
npx tsc --noEmit        # typecheck — doit être 0 erreur
npm test                # vitest — 43 tests doivent passer
npm run build           # tsc && vite build
```
Backend (`apps/backend`) :
```bash
npx tsc --noEmit        # typecheck
npx prisma db push      # appliquer schema.prisma sur prod (sans migration versionnée)
npx tsx <script>.ts     # one-shot scripts DB (pattern utilisé : check-X.ts, fix-X.ts)
```

### Rituel de vérification avant CHAQUE commit
`tsc --noEmit` (0 erreur) → `npm test` (43/43) → `npm run build` (OK). Puis commit/push sur main. Si frontend touché et auto-deploy lent : `vercel --prod --yes` depuis la racine + alias. Si backend touché et auto-deploy lent : `railway up --ci`.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran (Dashboard, POS, Stock, Orders, Customers,
                 #   HR, Planning, Payroll, Goals, Expenses, Reports, Forecasts,
                 #   Users, Settings, Activity, Notifications, AIAssistant, APIDocs,
                 #   Integrations, AdminDashboard, UpgradePlan, PaymentCallback,
                 #   Onboarding, LandingPage, SignupPage, LoginPage, Marketing, Pricing, Privacy)
                 #   ⚠️ /privacy = route PUBLIQUE (hors auth, avant le catch-all) — URL exigée par Google Play
  components/    # par domaine : customers/ hr/ pos/ stock/ reports/ settings/
                 #   integrations/ layout/ (Header, Sidebar, AppLayout) ui/
                 #   → chaque domaine a souvent un `*Shared.tsx` (helpers + maps i18n)
  stores/        # appStore.ts (Zustand : lang, currency, tenant, caisse… persisté localStorage)
                 # authStore.ts (user, token, ROLE_PERMISSIONS + canAccess slug)
  hooks/         # useI18n.ts, usePagination.ts, useFormatAmount…
  i18n/index.ts  # dictionnaire t() : translations = { fr, en, es, it }, 575+ clés
  utils/export.ts # génération CSV / PDF / labels (JsBarcode SVG scannable)
  lib/api.ts     # tous les *Api : productsApi, salesApi, customersApi, suppliersApi,
                 #   ordersApi, employeesApi, hrApi (bonusesApi, salaryHistoryApi),
                 #   expensesApi, tenantApi, usersApi, goalsApi, auditApi, authApi…
```

## i18n — convention CRUCIALE (le projet est 100% fr/en/es/it)

Trois mécanismes coexistent ; **utilise celui déjà présent dans le fichier** :

1. **Helper `i(fr, en, es, it)`** via `useI18n()` ou local au composant — standard pour le nouveau code.
2. **Ternaire inline 4-langues** — TOUJOURS les 4 (jamais binaire FR/EN qui ferait retomber ES/IT en anglais).
3. **`t('key')`** (global, depuis appStore) — pioche dans `src/i18n/index.ts`. Si tu ajoutes une clé, ajoute-la dans **les 4 blocs**.

Autres helpers : `makeI(lang)` (settings), `pick(lang, obj)`.

**Pattern data traduites** : map `Record<string, Record<lang, string>>` + fonction `xxxLabel(value, lang)` qui garde la valeur FR comme clé (filtres/data) et ne traduit que l'affichage. Exemples : `hr/hrShared.tsx`, `pos/posShared.tsx`, `stock/stockShared.tsx`.

**NE PAS traduire** : noms de marque (HabaShop, Wave, Orange Money, MTN, Railway, Vercel, Claude, WhatsApp), codes (XOF, EUR, FCFA), enums/clés API, noms de pays. Les PDF générés (`utils/export.ts`) sont hors périmètre i18n.

## Conventions de code

- Montants : `useFormatAmount()` ou `fmt()` — jamais de formatage manuel ; suit la devise du tenant.
- Icônes : **Lucide uniquement** (pas d'emoji UI), `cursor: pointer` + transitions sur cliquables.
- Couleurs : **`var(--*)`** systématiquement — jamais de `#RRGGBB` hardcodé (sinon les thèmes claire/forêt/etc. cassent).
- Logs : utiliser `logger.log/warn` depuis `@/lib/logger` (filtre `import.meta.env.DEV`). `console.*` à éviter en code commit.
- Pour éditer des chaînes multi-octets/emoji en masse, préférer un script Python ou un fichier `.ts` tsx-runnable à des `sed` fragiles.

## Specs prescriptives

Nelson fournit souvent des specs détaillées (ex : « lot N i18n »). Si une instruction du spec ne matche pas le code réel (numéro de lot déjà pris, fichier/string introuvable, ternaire déjà 4-langues), **réconcilie et continue** — ne bloque pas. Réserve les questions aux choix à fort enjeu / irréversibles (ex : élargir le périmètre à des milliers de lignes). Vérifie toujours qu'un fichier/flag mentionné existe encore avant de t'appuyer dessus.

## Derniers commits livrés

```
7336bd60  feat(goals+notifs)  Goals persistés en base (Prisma+CRUD+frontend) + cron alerte stock email quotidien
f6efe49d  fix(security)       settingsLocked conditionnel dans header + edge cases JWT + migration Lucide/var(--*)
5503c161  feat(settings)      Refonte design — sidebar épurée, header section, cards uniformes, forms structurés
ca85f932  feat(settings)      Persiste POS + Notif + Langue en base (migration Prisma + backend + frontend branché)
2c379360  feat(activity)      Refonte journal — descriptions lisibles + icônes par action + design enrichi
f8cfa5b1  fix(activity)       Ajoute activityLog aux deps useMemo — liste vide au premier load
08545a01  fix(users)          Refonte design modales invitation/modification (icônes inline, toggles switch, layout cohérent)
c577cac2  fix(users)          Libère l'email au soft-delete (contrainte unique globale)
4b76a395  fix(users)          requireAdmin accepte SUPER_ADMIN
e7e517ab  feat(users)         Masque boutons d'action aux non-admins (UI cohérente avec les checks backend)
```

## État fonctionnel — ce qui marche

### Core métier (CRUD complet + persistance backend)
- **Produits / Stock** : create/update/delete, SKU auto-séquentiel par tenant `PRD-NNNN` + `@@unique([tenantId, sku])`, code-barres EAN-13 (génération + validation 13 chiffres + rendu SVG scannable via JsBarcode), supplierId FK, description/notes, scan caméra via @zxing
- **POS / Ventes** : caisse, paniers, modes paiement (cash/wave/orange/mtn/card), remises, customer linking, fidélité (toggle)
- **Clients** : CRUD complet, carte Google Maps (sous `VITE_GOOGLE_MAPS_KEY`), loyalty points, revenus cumulés
- **Fournisseurs** : CRUD, catégories, lead time, rating, soft-delete restorable
- **Commandes (PurchaseOrder)** : CRUD, statuts, items
- **Employés / RH** : CRUD, contrats CDI/CDD, primes (`EmployeeBonus`), historique salaires (`SalaryHistory`) avec DELETE + timeline zigzag responsive (commit `93de0d09` + `e797310b`)
- **Présences (Attendance) — backend + frontend câblés (Phase 1+2)** (`c1dd19b9` → `1c1377e9`) : modèle Prisma `Attendance` (`date` String "YYYY-MM-DD", `status` String `PRESENT|LATE|ABSENT|HALF|LEAVE|REST` validé route, `@@unique([tenantId,employeeId,date])`) + routes `/api/attendance` (GET ?month=YYYY-MM lecture tout-membre ; POST upsert / PATCH / DELETE écriture **ADMIN/SUPER_ADMIN/MANAGER/HR** → 403 sinon ; isolation tenant stricte). Migration `20260531150000_add_attendance` **additive**, prod via `migrate deploy`. **Phase 2 (câblage) faite** : `HRAttendanceTab` persiste côté serveur — `HR.tsx` charge le mois via `attendanceApi.list(month)` + `saveAttendance` (MAJ optimiste + upsert) ; prop `onSaveAttendance` (parent gère l'upsert) ; mapping statut feuille (minuscule) ⇄ API (MAJUSCULE) via `attendStatusToApi`/`attendStatusFromApi` (hrShared) ; `HALF`=mi-temps, `LEAVE/REST` repliés sur 'absent' à l'affichage. **localStorage `habashop_attendance` SUPPRIMÉ** (DB = source de vérité). **Phase 3 faite** (`1a6f780c`) : (1) code orphelin `POINTAGE`/`calcHeures`/`calcPonctualite` **supprimé** de hrShared (+ 7 tests morts retirés) ; (2) **rollback optimiste** sur `saveAttendance` (échec API → revert atomique en un seul `setAttendance` : restaure l'ancienne entrée ou retire la clé si création) ; (3) **`LEAVE`/`REST` surfacés** dans la feuille (avant : repliés sur 'absent') — `AttendUiStatus` étendu à `leave`/`rest`, mappings 1:1, labels (Congé/Leave/Permiso/Congedo · Repos/Rest/Descanso/Riposo), boutons sélectionnables teal Umbrella / gris Coffee. **Phase 4 faite** (`695dd6a0`) : **LEAVE auto** — à l'approbation d'un congé (`handleLeaveAction`), upsert une entrée Attendance LEAVE par jour couvert (`eachDateInclusive`, best-effort `.catch` → n'échoue jamais l'approbation) en plus du `writeLeaveShiftsToPlanning` existant (e2e leave-planning intact). **REST auto = BLOQUÉ/documenté** : planning = localStorage keyé par **index jour-de-semaine** (agnostique de la date) + écriture fragmentée (assign/confirm/clear, sémantique toggle) → mapper vers une Attendance REST datée est ambigu/fragile. **Phase 5 FAITE — backend planning + leaves** (`75c2f515`, déployée) : modèles Prisma **`Shift`** (daté `date` "YYYY-MM-DD", `shiftTypeKey` morning|afternoon|full|night|rest|leave, `@@unique([tenantId,employeeId,date])` = 1/jour/employé — passage de l'index jour-de-semaine à une vraie date) + **`LeaveRequest`** (startDate/endDate, status PENDING|APPROVED|REFUSED, approvedBy/At). Migration `20260531160000_add_shifts_leaves` additive via `migrate deploy`. Routes `/api/shifts` (GET ?month lecture tout-membre ; POST/PATCH/DELETE écriture ADMIN/SUPER_ADMIN/MANAGER/HR → 403 ; **REST auto** : shiftTypeKey `rest` → upsert Attendance REST best-effort) ; `/api/leave-requests` (GET ?status ; POST self-ou-approbateur ; PATCH hors-status ; **POST /:id/approve** → APPROVED + approvedBy/At + Shift `leave` + Attendance LEAVE par jour via `eachDateInclusive` (`lib/dates`), best-effort ; **POST /:id/refuse** → REFUSED). +26 tests (shifts 11, leave-requests 11, dates 4). **Phase 6 LEAVES FAITE** (`c9e8c031`, déployée, e2e live ✅) : les congés passent par l'API (fin de l'in-memory). `lib/api` **`leaveRequestsApi`** (list/create/approve/refuse/update) ; `HR.tsx` charge via `GET /api/leave-requests` au montage (`leavesLoading` + toast erreur) ; `createLeave` → POST + prepend ; `handleLeaveAction` → `POST /:id/approve|refuse` (MAJ optimiste + **revert si échec**). **`writeLeaveShiftsToPlanning` + boucle `attendanceApi.upsert` RETIRÉS** (le backend `/approve` crée déjà Shift `leave` + Attendance LEAVE). `mapApiLeave` (hrShared) mappe API↔front ; `LeaveRequest.id/empId` → string ; `LeaveRequestModal` : `setLeaves` → prop `onSubmitLeave`. **Vérifié prod** : approve → LeaveRequest APPROVED + 3 Shift `leave` + Attendance LEAVE. **Phase 6-PLANNING FAITE** (`f31af5d4`, déployée, live ✅ POST /api/shifts → 200) : la grille planning est **DATÉE via /api/shifts** (fin du localStorage week-agnostic — lundi 25/05 ≠ lundi 01/06). `lib/api` **`shiftsApi`** (list/upsert/update/remove). `Planning.tsx` : état maître **`shiftsByDate`** keyé `"empId_YYYY-MM-DD"` (`{type,id}`, lookup O(1)), chargé par `GET /api/shifts?month` au montage + changement de semaine ; **vue dérivée di-keyée** (`useMemo`) → `PlanningGrid`/filtres/stats/export **inchangés**. Écritures = optimiste + **rollback atomique** + toast (`setCell`/`removeCell`, date = `weekDays[di]`). **Verrouillage re-dérivé** de `GET /api/leave-requests?status=APPROVED` (`eachDateInclusive` → `Set` "empId_date" → `lockedForWeek`) → cellules congé approuvé non modifiables. **NETTOYAGE** : `SHIFTS_STORAGE_KEY`/`LOCKED_SHIFTS_KEY`/`readLockedShifts`/`weekdayIndicesForRange`/`writeLeaveShiftsToPlanning` **supprimés** (planningShared) + `planning-leave.test.ts` supprimé. ⇒ **Saga présences/planning CLÔTURÉE** : tout (présences + planning + congés) est **backend-backed, multi-tenant, partagé entre appareils** ; congés approuvés → Shift `leave` + Attendance LEAVE + cellule verrouillée ; shift `rest` → Attendance REST auto. Pas de backfill localStorage (planning repart vide, assumé). **e2e `leave-planning.spec` re-confirmé vert** (Soumettre→`POST /api/leave-requests` ; Approuver→`POST /:id/approve` ; statut→Approuvé). **Phase 7 — COPIE DE SEMAINE FAITE** (`5b5e1b45`, déployée, live ✅) : bouton « Copier → suiv. » (`PlanningHeader`, prop `onCopyWeek`, i18n 4 langues) → `copyWeekToNext` duplique les shifts de la semaine affichée à J+7 via `shiftsApi.upsert` (MAJ optimiste + navigation vers la semaine suivante) ; **ignore les congés** (`leave`) et ne remplace pas un congé approuvé cible (`lockedDates`). +1 test anchor (copie → upsert au lundi suivant). **Phase 7 — DRAG&DROP FAITE** : `moveShift` (Planning) + câblage DnD `PlanningGrid` (chip `draggable` → `onDragStart` met la source dans `dataTransfer` ; cellule = drop target → `onMoveShift`) déplacent un shift d'une case à l'autre (upsert cible + delete source) ; respecte le verrouillage congé et ignore le type `leave`. **Phase 7 — MULTI-SHIFT/JOUR FAITE** (`80f1d9b3`, déployée, **live ✅** : morning+night même jour/employé → 2 lignes distinctes via API prod, vérifié + nettoyé) : un employé peut avoir **plusieurs shifts le même jour** (ex. matin + soir), mais **pas deux fois le même type**. **Schéma** : `Shift @@unique([tenantId,employeeId,date])` → `@@unique([tenantId,employeeId,date,shiftTypeKey])`. Migration `20260531170000_multi_shift_per_day` **non-destructive** (`DROP INDEX` ancien + `CREATE UNIQUE INDEX` nouveau ; superset de l'ancienne contrainte qui garantissait déjà ≤1 ligne/(tenant,emp,date) → 0 doublon possible), prod via `migrate deploy`. **Backend** : upsert `POST /api/shifts` + side-effect congé approuvé (`leaveRequests.applyApprovedLeaveSideEffects`) ciblent la **clé composite-4** `tenantId_employeeId_date_shiftTypeKey` ⇒ un 2ᵉ type le même jour CRÉE une 2ᵉ ligne (n'écrase plus) ; **REST auto** (`syncRestAttendance`, clé `…_date`) + **Attendance LEAVE** (clé `…_date`) **inchangés** (toujours 1 Attendance/jour). +1 test backend (« 2 types/jour → 2 upserts clés distinctes »). **Frontend** : état `shiftsByDate` = **`Record<"empId_date", {type,id}[]>`** (TABLEAU par case — mappe 1:1 le rendu chips empilés + la vue dérivée par index jour) ; `setCell` = **ADD-only** (skip-if-present, optimiste + rollback), `removeCell(empId,di,type?)` = sélectif (type→ce type seul ; sinon→tous), `assignShift` (clic case pleine) = ajoute le type actif, `clearShift` (double-clic) = retire **uniquement** le type actif, `moveShift(...,type)` déplace un type précis, `copyWeekToNext` copie **tous** les types de chaque case, `loadWeek` regroupe en tableaux et remplace les clés des mois rechargés (gère aussi les suppressions distantes). **`PlanningGrid`** : shifts empilés (1 = look mono-shift conservé / ≥2 = chips compacts colorés), chaque chip `draggable` porteur de SON type. +2 tests anchor (ajout d'un 2ᵉ type coexiste ; DnD via chip). Front 238 / back 204 verts. **Phase 7 — VUE MOIS FAITE** (`c966a0f8`, déployée, **live ✅**) : bascule **Semaine/Mois** (`PlanningHeader` segmented control ; navigation adaptée ±7j / ±1 mois, sous-titre = nom du mois, i18n 4 langues `month:`). **`PlanningMonth`** = grille calendaire **6×7** (42 cases, lundi-first, débordement mois adjacents grisé) ; chaque jour **agrège** les shifts des employés filtrés en **pastilles colorées par type + compteur** (les « dots multi-shift ») ; clic sur un jour → **drill** vers la vue semaine de ce jour (`onPickDay` → `setPlanningWeek(d)` + `setView('week')`). Chargement généralisé : `loadWeek` interroge **tous les mois touchés** par la plage active (≤3 en vue mois, `range.map(ymd).slice(0,7)` dédupliqué). Stats (`weekStats`/`monthStats`) + export CSV adaptés à la vue active ; `ShiftSelector` + bouton « Copier » masqués en vue mois (assignation = vue semaine). `ymd` exporté de `planningShared` (dédup avec Planning.tsx). +2 tests anchor (rendu+agrégation pastilles ; drill mois→semaine) → **240 front**. **Vérifié live** (`planning-month.spec.ts`, vert contre prod) : bascule Mois → grille 6×7, jours mois adjacents grisés, aujourd'hui surligné, pastilles multi-shift avec compteur, « Copier » masqué en vue mois, drill jour→semaine OK (capture `playwright-report/planning-month.png`). ⇒ **Phase 7 + saga présences/planning/congés intégralement CLÔTURÉES** (multi-shift/jour, drag&drop, copie de semaine, vue mois tous livrés ET vérifiés live ; tout backend-backed, multi-tenant, multi-device).
- **Paie** : génération bulletins PDF, calcul brut/CNSS/IR/net
- **Dépenses** : CRUD avec catégories
- **Utilisateurs (`/app/users`)** : invite (email Resend + audit + bcrypt 12), update, toggle active, toggle 2FA (self-service ou admin), soft-delete avec libération email (`_deleted_${ts}` suffix). `requireAdmin` accepte `ADMIN` + `SUPER_ADMIN`. UI conditionnée par rôle (boutons masqués aux non-admins).
- **Objectifs (Goals)** : CRUD persisté backend (commit `7336bd60`), `linkedMetric` ('salesMonth' / 'transactionsMonth' / 'avgBasket') pour l'enrichissement live depuis dashboardApi.stats. Plus de localStorage.
- **Activity / Audit log** : route GET `/api/audit-logs` filtrée par tenant + render i18n par action (ACTION_LABELS 21 actions, ACTION_ICONS), parseDescription extrait nom/email du JSON, design card moderne (commit `2c379360`)

### Settings — persistance backend complète
- **Shop** : nom/email/phone/address/country/vatRate → `tenantApi.update`
- **POS** : 9 paramètres (vatRate, posVatIncluded, posAutoprint, autoWhatsApp, enableLoyalty, requireCashier, enableScanner, priceMode, posDefaultFund) → backend (commit `ca85f932`)
- **Notifications** : 6 toggles persistés (notifEmail×3, notifSms×2, notifPush) ; **consommés par les crons** : `notifEmailSales` (weekly), `notifEmailStock` (daily 7h, commit `7336bd60`), `notifEmailPayroll` (récap paie mensuel, 1er du mois 8h)
- **Lang & Currency** : `cfg.setLang` + `tenantApi.update({lang})`, currency idem. `setTenant` restore lang au login.
- **Security** : changePassword backend (`PATCH /api/auth/password`), JWT info avec edge cases (expiré/expire aujourd'hui/actif), confirmation logout, settingsLocked **conditionnel** dans Header (commit `f6efe49d`)

### Auth & RBAC
- JWT bcrypt12, register/login/me/changePassword
- `ROLE_PERMISSIONS` slug-based : ADMIN/SUPER_ADMIN = `*`, MANAGER/CASHIER/ACCOUNTANT/HR avec listes
- Route guard `canAccess(role, slug)` redirige vers landing si refus
- Backend `requireAdmin` helper + validation `body.role` whitelist sur tous les writes users

### Emails Resend
- Welcome (signup), trial reminder 7d/3d, trial expired, upgrade confirmation, weekly report, user invitation, stock alert (daily), **récap paie mensuel** (`sendPayrollSummaryEmail`, localisé fr/en/es/it + devise tenant)
- Helper `escHtml()` appliqué aux interpolations (defense-in-depth XSS)
- Template `baseTemplate()` cohérent avec footer désabonnement

### Multi-tenant
- Scope `tenantId` sur toutes les routes write/read
- Soft-delete `deletedAt` partout pour permettre restoration
- `email @unique` global (User) avec libération au soft-delete via suffix `_deleted_${ts}`

### i18n & thèmes
- 100% fr/en/es/it sur l'in-app + landing/login/signup (8 lots i18n)
- 4 thèmes (dark/light/forêt/+accent custom) — préférence per-device (localStorage)

### Tests
- **236 tests vitest front** / 203 back (front : currency, pagination, components UI, anchors de découpe, logique métier pure : paie/CNSS/IRPP, dates HR incl. `eachDateInclusive`, libellés HR, conversion EUR/USD rapport comptable, catégories Stock, matrice permissions/escalade Users, lookup Open Food Facts, hook couleur thème ; back : route lang/devise ADMIN-only, CRUD présences incl. HALF, **CRUD shifts + leave-requests + approbation transactionnelle**). *(Notes : `calcHeures`/`calcPonctualite` + 7 tests retirés en Phase 3 ; `planning-leave.test`/`weekdayIndicesForRange` retirés en Phase 6-planning — code mort migré sur API.)*
- Playwright E2E configuré (`baseURL = https://habashop.vercel.app` → tourne en **live** contre prod ; login `/api/auth/login` rate-limité 10/15 min/IP → ne pas relancer en rafale). Specs connectées via login démo `admin@habashop.com`/`demo1234`. **2 specs servent de vérif live des fixes** : `bulletin-pdf.spec.ts` (PDF paie = écran en EUR), `leave-planning.spec.ts` (congé approuvé → shifts Congé).

## Dette technique — points à fixer

### 🔴 Critique
- **`notifSmsSales` + `notifSmsStock`** : infra SMS à choisir (recommandé : **Africa's Talking** pour XOF/XAF pricing). Crée `services/sms.ts`, env `SMS_API_KEY`, gère format international. **XL**
- **`notifPushAll`** : web-push PWA à implémenter. **XL** (révisé après audit)
  - VAPID keys à générer + ajouter Railway (backend) + Vercel (frontend `VITE_VAPID_PUBLIC_KEY`)
  - Modèle Prisma `PushToken` prêt mais inutilisé
  - SW PWA existe (`public/sw.js`, 39 lignes) mais sans handler `push`/`notificationclick`
  - Pipeline complet à créer : route POST/DELETE `/api/push-tokens`, service `sendPushNotification(userId, payload)`, SW handlers, frontend `pushManager.subscribe()` + bouton "Activer" dans SectionNotif, émetteurs sur 3-5 events (vente importante, rupture stock, paiement reçu, objectif atteint, invite user)
- **Wave webhook — fail-OPEN en sandbox** (`services/wave.ts`) : `verifyWaveWebhook` fait `if (!WAVE_SECRET) return true` → toute signature passe sans `WAVE_WEBHOOK_SECRET`. Sûr tant que sandbox, **bloquant go-live** : avant passage Wave **prod**, poser `WAVE_WEBHOOK_SECRET` (Railway) ET vérifier que le chemin prod **rejette** réellement une signature invalide (mesurer un POST signé KO → 401). **S** (≠ Orange, déjà fail-closed)
- **Action ops — `ORANGE_MONEY_WEBHOOK_SECRET` à poser sur Railway** : sans lui, `verifyOrangeWebhook` rejette **tous** les webhooks Orange (fail-closed = sûr mais **auto-activation Orange inerte**). Mécanisme détaillé en *Patterns / pièges* (webhooks sécurisés). **S**

### 🟡 Important
- ~~**7 pages in-app > 600L à découper**~~ ✅ **CLOS** (Sprint 9+). Les 7 pages décomposées par la même méthode (**test d'ancrage d'abord → découpe à comportement identique → i18n ensuite** — l'i18n était déjà propre sur toutes, pattern FR-comme-clé) : **Orders** 1104→296L, **Users** 821→219L (`components/users/` 7 fichiers), **Expenses** 739→307L (`components/expenses/` 7), **Planning** 708→190L (`components/planning/` 7), **POS** 627→495L (déjà découpé ; extraction écran caisse-fermée + `posTicket.ts`), **Suppliers** 619→230L (`components/suppliers/` 6), **Payroll** 601→155L (`components/payroll/` 4, `buildMonths`/`monthLabel` ré-exportés pour `payroll-months.test`). HR déjà traité (HR XL). Chaque page a son `*.anchor.test.tsx` (4–9 cas) figeant le comportement avant/après. **Plus aucune page in-app > 600L.** Pages **publiques** aussi décomposées : **LandingPage** 1384→43L (`components/landing/` : `landingShared.ts` = `LANDING_TRANSLATIONS` + palette + helpers, **13 sections**, conteneur = pur composition root ; `landing.anchor.test.tsx` 6 cas) et **SignupPage** 938→202L (`components/signup/` : `signupShared.tsx` = `TX` 4-langues + `COUNTRIES` + palette + `getStrength` + helpers `inputBase`/`focusOn`/`focusOff`/`Label` ; `SignupBranding` + `SignupStep1` [état dropdown pays co-localisé] + `SignupStep2` [force mdp] ; `signup.anchor.test.tsx` 6 cas). **Plus AUCUNE page du repo > 600L.** Suite de tests : 84 → **134**.
- ~~**`HRTabs.tsx` (1171L) + `HRModals.tsx` (1096L)** à splitter + i18n. **XL**~~ ✅ **CLOS** (voir Sprint 9 « HR XL »). Méthode suivie : **test d'ancrage d'abord** (`hrmodals.anchor.test.tsx` 10 cas, `EditEmployeeModal` en priorité — la modale la plus riche en props/état), **découpe à comportement identique**, **i18n ensuite** (7 chaînes résiduelles : placeholders + headers). 84/84 tests.
- ~~**431 boutons icon-only sans aria-label**~~ ✅ **CLOS** — un scan AST-léger (`<button>` dont le contenu est *uniquement* une icône Lucide, sans `aria-label`/`title`/texte) a isolé les **37 vrais cas** sans nom accessible (les ~334 autres « icon-only » ont en fait un libellé via `{expression}` → faux positifs). `aria-label` localisé 4-langues ajouté à chacun (fermeture modale X, Trash2/Pencil isolés, étoiles de notation `Note ${s}/5`, PDF/Facture/Effacer/Retirer), via le mécanisme i18n déjà présent dans chaque fichier (`i()` ou ternaire `lang`). Re-scan = **0**.
- **Bundle recharts 411KB + barcode 443KB** — ✅ **différés hors rendu initial** (le poids brut reste, mais ne bloque plus). `barcode` (@zxing 443KB) déjà lazy (POS + StockModals via `React.lazy`). `charts` (recharts+d3, 110KB gz) : sorti des imports statiques de **Dashboard** (2 blocs → `components/charts/DashSalesArea`+`DashCategoryDonut` lazy sous Suspense ; tooltips/labels sans dépendance recharts restent dans Dashboard, passés en props) et de **Reports** (import recharts mort supprimé + `ReportsTabs` lazy). Chunks Dashboard 6,3 kB gz / Reports 3,9 kB gz, KPIs affichés sans attendre les charts. **Reste possible (L, non fait)** : remplacer recharts par une lib plus légère (visx) pour réduire les 110 kB eux-mêmes.
- ~~**WebSocket `/api/ws` auth** à vérifier~~ ✅ **VÉRIFIÉ + DURCI**. Faux positif sur le fond : l'auth était bien présente (token `?token=`/header → `app.jwt.verify` → `close(1008)` si invalide, **fail-closed**) — juste **inline** dans le handler, pas via `preHandler` (impossible proprement avant l'upgrade WS). 2 écarts réels vs l'auth HTTP corrigés : (1) **`isUserActive`** n'était pas checké → un compte supprimé/désactivé pouvait se connecter pendant les 7 j de validité du JWT (ajout du check, parité avec `authenticate`) ; (2) garde **`tenantId` manquant** (évitait d'indexer un socket sous clé `undefined`). Logique extraite en helper **pur** `lib/wsAuth.ts` (`decideWsAuth`, zéro dépendance DB/Redis) + **5 tests** (no-token/invalide/no-tenant/valide/verify hostile). Handler passé `async` pour `await isUserActive`. Frontend inchangé (`notificationStore` connecte via `?token=<JWT>`).
- ~~**SectionLang devise** : `.catch(()=>{})` silencieux, divergence possible local/serveur~~ ✅ **CLOS** (commit `8d3c40e6`). Le sélecteur « Devise d'affichage » ne pousse plus au tenant (`tenantApi.update({currency})` retiré) → c'est une **préférence d'affichage par appareil** (montants stockés base XOF, convertis via `useFormatAmount`). `appStore.setTenant` adopte `tenant.currency` **uniquement au changement de boutique** (plus à chaque `/me`/refresh), préservant le choix local tout en gardant le correctif anti « EUR persisté convertit des XOF ». Cause racine du bug démo (tenant-001 rebasculait en EUR via sessions publiques) supprimée. La devise réelle du tenant est fixée à l'onboarding. **Latent ✅ corrigé** (commit `0f5264d1`) : le rapport comptable (`/api/reports/accounting`) convertit désormais les montants base XOF → `tenant.currency` (`lib/currency.ts` partagé avec le récap paie) ; modale `AccountingReportModal` formate sans reconvertir (`formatInCurrency(n, data.currency)`). **lang** garde le même pattern (push tenant) — bénin, non touché (restore login documenté).

### 🟢 Nice-to-have
- ~~**Couleurs hardcodées → `var(--*)`**~~ ✅ **CHROME CLOS — CLÔTURE DÉFINITIVE** (**8 lots**, `e853ea38`→`bfadac31`). Tout le *chrome* in-app theme-breaking (surfaces navy `#0D0D1C`, bordures/boîtes/survols `rgba(255,255,255,…)`, fonds `rgba(0,0,0,…)`) est migré en `var(--*)` → cohérent thèmes clair/sombre. Migration **progressive, cohérence multi-thème**. **✅ VÉRIFIÉ EN THÈME CLAIR** (captures Playwright live sur prod, lots 6-7 : `ViewField` générique, `SectionShop`, `Dashboard`, modale HR, `PayrollPayslips`/`PayrollHistory` → boîtes/bordures désormais visibles gris-clair vs blanc-sur-blanc invisible avant). Tous les lots partagent les **mêmes tokens** (`var(--border)`/`--bg3`/`--bg4`/`--card`) → cohérence garantie sur l'ensemble. (Thème = préférence device-local → vérif en contexte test éphémère, **aucune pollution prod**.)
  - **Lot 8 ✅** (`bfadac31`, **clôture définitive**) : dernier leftover — `AddressAutocomplete` bandeau « Powered by Google » `rgba(0,0,0,.15)` → `var(--bg3)`. Un **scan large** (au-delà des patterns initiaux : `rgba(0,0,0,.x)` comme surfaces + `#fff` texte) confirme qu'il **ne reste QUE des keeps intentionnels** : scrim caméra `BarcodeScanner` (`rgba(0,0,0,.85)`), ombrage week-end `PlanningGrid` (`rgba(0,0,0,.1)`, paire hover JS), `#fff` sur surfaces colorées (~53 occ. sémantiques : boutons/avatars/badges), `AdminDashboard` déjà en `var(--border,rgba(0,0,0,.06))` (var+fallback), maquette WhatsApp `Marketing`, template PDF, strokes recharts (var() non résolu en attribut SVG), zebra, pages publiques. **⇒ Plus AUCUNE surface chrome theme-breaking convertible — ne pas relancer de "lot 9" (les occurrences restantes sont toutes correctes/sémantiques, les convertir casserait l'apparence).**
  - **Lot 1 ✅** (`e853ea38`) : 3 widgets de formulaire réutilisables (`PhoneInputWithCountry`, `AddressAutocompleteInput`, `AddressAutocomplete`) — dropdown navy `#0D0D1C` + bordures/survols blancs → `var(--card)`/`--border`/`--bg3`/`--bg4`. C'était la casse la plus visible (boîte noire sur formulaire en thème clair).
  - **Méthode / classification** (le « 920 hex » brut est trompeur — la vraie cible = le *chrome* in-app) : **CONVERTIR** = fonds/bordures/texte d'UI sombres hardcodés (`#0D0D1C`, `#1a1a2e`, `rgba(255,255,255,…)`) dans des composants in-app. **NE PAS toucher** = palettes **sémantiques** (avatars/catégories/charts/status : `COLORS`/`DONUT_COLORS`/`CATEGORY_STYLE`/`SHIFT_TYPES`/`PAY_COLORS`… couleurs-identité par entité), **styles Google Maps** (`customersShared`, hex requis par l'API), **templates PDF** (`HR.tsx`/`export.ts`, doc imprimé sans CSS vars), **pages publiques** (`.public-scope`, palette `D` dark voulue : `landing*`/`signup*`/`Pricing`/`Privacy`/`Onboarding`/`UpgradePlan`), **défs de thème** (`appStore.ts`), `#fff` sur boutons colorés. Tints violet `rgba(108,71,255,…)` = sémantiques → garder.
  - **Lot 2 ✅** (`6c89b6ef`) : bordures de champ des modales vue/détail (`background:transparent` + `border 1px rgba(255,255,255,.06)` → invisible en clair) → `var(--border)` : `ExpenseDetailModal`, `ContractDetailModal` (+ footer `rgba(0,0,0,.15)`→`var(--bg3)`), `StockModals` (2 bordures). **Inspecté & laissé (tout sémantique)** : `CustomersModals` (médailles fidélité or/argent/bronze/platine + accents marque), palette hex de `StockModals` (= color-picker catégories).
  - **Lot 3 ✅** (`e330e362`) : `Pagination` (fonds/bordures des contrôles page-size/prev-next/pages inactives) + `UserCard` (2FA off-state + boîtes info) — blanc neutre → `var(--bg3)`/`var(--border)`. Conservé : gradient violet page active, tint emerald 2FA-on, dots statut online/offline, accents rôle.
  - **Lot 4 ✅** (`95611ddc`) : `Header` + sections Settings (`settingsShared` Switch/ToggleCard, `SectionLang`, `SectionPOS`, `SectionDocs`) — cards/toggles/rows/hovers blancs → `var(--bg3)`/`--bg4`/`--border`. Conservé : swatches preview thème/accent, tints violet/warn sélection, **halo blanc sur swatch accent coloré** (`SectionLang:174`, intentionnel).
  - **Lot 5 ✅** (`048990f2`, clôture) : `NewOrderModal` (dropdowns autocomplete), `PlanningGrid` (bordure cellule week-end), `MarkdownRenderer` (bordure tableau), `Goals` (anneaux/barre de progression — stroke SVG → `var(--border)`), `Forecasts`.
  - **Lot 6 ✅** (`679e7fbb`, passage de reprise) : leftovers chrome haute-visibilité repérés par re-scan ciblé → `ui/ViewField` (générique, omniprésent : bordure boîte vue), `hr/modals/EditEmployeeModal` (5 : fermeture, boîte vue, footer `rgba(0,0,0,.2)`, 2 boutons secondaires), `pos/POSCart` (séparateur ligne panier), `Dashboard` (piste barre progression → `var(--bg4)`), `settings/SectionShop` (champ lecture-seule) → `var(--bg3)`/`--border`. **Vérifié visuellement en thème clair** (captures Playwright live : boîtes désormais visibles vs blanc-sur-blanc avant). Conservé : zebra `.01/.02` (MarkdownRenderer), hover JS `.025` (Dashboard, paire onMouseEnter/Leave).
  - **Lot 7 ✅** (`6997da4c`, **clôture chrome in-app**) : derniers convertibles — `PayrollPayslips` (séparateur ligne bulletin), `PayrollHistory` (fond icône 34×34) → `var(--border)`/`--bg3`. **Tout le reste audité = INTENTIONNEL, non convertible** : maquette UI **WhatsApp** dans `Marketing` (couleurs marque fixes `#1F2C34`/`#005C4B`/`#E9EAE0`, blanc-translucide sur fond sombre — pas du chrome thémé) ; spinners `#fff` sur boutons colorés (Marketing/AIAssistant) ; halo accent `SectionLang:174` ; template PDF `HR.tsx` ; **recharts `CartesianGrid` stroke** (`ReportsTabs`/`DashSalesArea`) → `var()` NON résolu dans un attribut de présentation SVG, laissé tel quel (nécessiterait une couleur calculée JS depuis le thème) ; zebra, week-end `PlanningGrid`, pages publiques. **⇒ Plus aucun chrome in-app theme-breaking convertible.**
  - **Laissé INTENTIONNELLEMENT** (NON-bug — blanc sur surface colorée / contexte non-thémé) : `BulletinModal` (header gradient violet), `CustomerMap` (badges sur marqueur coloré, string HTML map), zebra ultra-fin `.01/.02` (`PlanningGrid`/`MarkdownRenderer`, négligeable), page dark autonome `UpgradePlan`, + tout le **sémantique** listé dans la classification ci-dessus. Ces occurrences restantes de `rgba(255,255,255,…)`/hex sont **correctes**, ne pas convertir.
- ~~**`og-image.png` 53KB** → WebP~~ ✅ **FAIT** (`5ad07f8e`) : `og-image.webp` **24,6KB** (−53%) via `sharp` q80 (1200×630). Refs MAJ : `index.html` (og:image + twitter:image + JSON-LD screenshot, + `og:image:type`) et `manifest.json` ; PNG source supprimé. Conversion sans outil système (sips ne sait pas *écrire* le webp ; `cwebp`/`magick` absents) → **`sharp` (déjà en dépendance) pour tout besoin de conversion d'image**.
- **Tests de logique métier** : ⏳ **bien couvert** (`3b3f038e`→`76964e23`, **239 front** / 150 back). Fonctions **pures** testées : `pricing.test.ts` (paliers POS), `rbac.test.ts` + `users-permissions.test.ts` (`canAccess`/`getLandingForRole` + **matrice `ROLE_PERMISSIONS`/prévention escalade**), `payroll-calc.test.ts` (`calcNet`/`calcBrut` + **`payrollBreakdown` CNSS/IRPP**), `hr-logic.test.ts` (`calcAnciennete`/`toInputDate`/`displayDate` + `calcHeures`/`calcPonctualite`), `hr-labels.test.ts` (**`localeOf`/`roleLabel`/`deptLabel`/`contractLabel`/`attendStatusLabel`/`leaveStatusLabel` — pattern FR=clé/traduction/fallback**), `stock-status.test.ts` + `stock-logic.test.ts` (`statusOf` + `stockCatLabel`/`stockCatDesc`), `productCurrency.test.ts` (valorisation XOF↔devise), `productLookup.test.ts` (Open Food Facts), `country-currency.test.ts`, backend `reports.test.ts` (**conversion EUR/USD + arrondis + devise inconnue**). **Surface pure HR épuisée.** **Limites assumées (non testables en pur sans refactor interdit)** : valorisation stock = `reduce` INLINE (Stock.tsx) ; validations user = composant `ValidatedInput` ; expiration CDD « ≤30 j » + jours de congé = inline composants ; statuts/soft-delete + isolation tenant = backend middleware. Reste possible (non fait, **L**) : logique métier backend au-delà des helpers déjà testés.
- **`npm audit` (note permanente, pas un blocage)** : audit fonctionnel (racine + par app) ; **6 vulns modérées DEV-only** (chaîne esbuild→vite→vitest→vite-plugin-pwa, advisory serveur-de-dev uniquement, jamais en prod). Aucun fix non-breaking — corrigeable seulement via vite 5→8 / vitest 1→3 (**majeur**), à planifier comme upgrade outillage dédié.
- ~~**i18n résiduel — page Marketing**~~ ✅ **AUDITÉ — RAS** (`3ff3393c`) : dict `MK` complet sur les 4 langues + KPIs en ternaires inline 4-langues ; 0 chaîne FR hardcodée, 0 ternaire binaire. **i18n in-app = 100%.** (Les chaînes FR apparentes ailleurs = pattern **valeur-FR-comme-clé** filtres/data, à NE PAS toucher.)
- ~~**Émojis dans `Head` shared** (`settingsShared.tsx`) → Lucide~~ ✅ **FAIT** (`3ff3393c`) : `Head` prend un `icon` (élément Lucide), couleur `var(--p2)` ; **13 callers / 7 sections** migrés (Store/ShoppingCart/Bell/ClipboardList/Lock/Globe/Coins/Palette/Eye-EyeOff/Link2/Pencil/MessageCircle). Bordure `rgba` → `var(--border)` au passage.

## Application mobile

- **CDC disponible** : `MOBILE_APP_CDC.md` à la racine
- **Stack cible** : React Native
- **État** : à démarrer (pas commencé)

## Comptes démo

Démo bypass auth via `authStore.ts:90+` — mot de passe `demo1234` accepté pour ces comptes :
- `admin@habashop.com` / `demo1234` (rôle ADMIN sur `demo-tenant-001`)
- `manager@habashop.com` / `demo1234` (rôle MANAGER)
- `cashier@habashop.com` / `demo1234` (rôle CASHIER)
- `accountant@habashop.com` / `demo1234` (rôle ACCOUNTANT)
- `hr@habashop.com` / `demo1234` (rôle HR)

Le tenant `demo-tenant-001` contient 5 employés seedés (Marie Bakayoko, Kofi Diallo, Aminata Touré, Seydou Koné, Fatoumata Ndiaye) avec IDs `demo-emp-${name}` (pas des cuid — voir `seed.ts`).

## Historique récent

i18n complété en 8 lots (sept. 2024–mai 2026) : tout le texte d'interface (in-app + pages publiques/pré-login) est en fr/en/es/it. Détails dans `I18N_AUDIT.md` et le git log (`feat: i18n lot N`).

Refonte design complète : Settings (commit `5503c161`), Activity (commit `2c379360`), modales Users (commit `08545a01`), timeline HR salaires (commit `93de0d09` + `e797310b`).

Sécurité & multi-tenant : routes user management durcies admin-only + validation role whitelist + HTML escape email (commits `c66d9adb` + `4b76a395`), libération email au soft-delete (commit `c577cac2`).

## Sprint 9 — session 30 mai 2026

### Mobile (`habashop-mobile`)
- Navbar FAB POS outlined/filled selon état actif
- Settings : bloc profil avec avatar initiales + badge rôle (ADMIN/MANAGER/etc.)
- Fix `GO_BACK` Caisse (guard `router.canGoBack`)

### Web (`habashop`) — features métier
- **Étiquettes prix imprimables** : sélection inline (checkbox par ligne) + presets Avery (L7160/L7163/L7165/L7651) + ActionBar contextuelle
- **Multi-prix par paliers de quantité** : `priceTiers` JSON sur `Product` + fix bug `updateQty` POS (recalcul prix au franchissement de palier)
- **Catalogue WhatsApp partageable** (`/c/:slug`) : route publique + section Settings + message `wa.me` pré-rempli + slugs auto-générés (backfill 6 tenants)
- **Auto-détection devise selon pays** dans Signup/Onboarding (util `currencyForCountry`/`suggestedCurrencyForCountry`, fallback XOF, préremplissage jusqu'à choix manuel)
- **Rapport comptable mensuel** (remplace le stub « Bientôt disponible » de `SectionDocs`) :
  - Backend `GET /api/reports/accounting?month=YYYY-MM` (`routes/reports.ts`) : RBAC ADMIN/SUPER_ADMIN/MANAGER/ACCOUNTANT, `tenantId` STRICT depuis le JWT, cache Redis `reports:accounting:{tenant}:{YYYY-MM}` (TTL 5 min mois courant / 30 min passés, invalidé sur vente/dépense via `invalidateTenantCache` étendu). Helpers purs `resolveMonth`/`computeReport`/`buildAccountingReport` (testés : mois vide→0, agrégation, isolation tenant, paie=0).
  - **Source revenus = `Sale.total`** sur `createdAt ∈ [new Date(y,m,1), mois+1)` (heure serveur) → **réconcilie exactement** avec le `caMonth` du dashboard (`prisma.sale.aggregate({_sum:{total}})`). Pas de modèle Order client (`PurchaseOrder` = fournisseurs).
  - **Salaires = source unique `Employee.salary`** (employés actifs) = masse salariale **projetée** (aucune catégorie dépense « Salaires » ni table Payroll). JAMAIS dans le net.
  - JSON dédoublé pour ne pas tromper : `resultBeforePayroll` (= revenu − dépenses Expense) **et** `resultAfterPayrollEstimate` (= − payroll, ESTIMATION). Pas de champ orphelin `net`.
  - Frontend `AccountingReportModal.tsx` : sélecteur mois localisé, KPIs (« Résultat avant masse salariale » + bannière « Résultat estimé après paie » badge *estimé*, masquée si paie=0), ventilation par catégorie (barres), états loading/erreur/vide, export PDF+CSV (réutilise `openPDF`/`htmlKPIs`/`htmlTable`/`exportCSV`), i18n fr/en/es/it.

### Backend — récap paie mensuel (livré)
- **Cron récap paie mensuel** (`runMonthlyPayrollReports`, `services/payrollReport.ts`) : honore enfin le toggle `notifEmailPayroll` — 1er du mois ~8h, **opt-in strict**, **idempotent** via `Tenant.lastPayrollReportMonth` (filtre `null` ou `≠ mois`), montants convertis en **devise du tenant**, email **localisé** fr/en/es/it, destinataire = **ADMIN du tenant dérivé serveur** (jamais d'email client en entrée).
- **Route admin `POST /api/admin/payroll-report/run`** : déclenchement à la demande pour test, **`dryRun:true` par défaut** (calcule + renvoie le récap, AUCUN email/marqueur), RBAC ADMIN, **cœur partagé** avec le cron (zéro duplication).
- **Migration `lastPayrollReportMonth` régularisée** : colonne jadis ajoutée par `db push` (hors historique) → migration additive **idempotente** (`ADD COLUMN IF NOT EXISTS`, `20260530140000_add_payroll_report_marker`) + `migrate resolve --applied` sur prod → `migrate status` propre, aucune ré-exécution.
> Mécanisme (cron `setInterval` + garde fenêtre-temps, idempotence, régularisation `db push`) détaillé dans **Patterns / pièges nouveaux**.

### Web — refonte architecture (découpage Orders) ✅ CLOS
- **`Orders.tsx` découpé 1104 → 296L** (conteneur fin : état, effets de chargement, handlers, orchestration — alimente 6 enfants par props). Découpe **à comportement strictement identique** (JSX déplacé verbatim, substitutions mécaniques seulement).
- **6 composants `components/orders/`** :
  - `ordersShared.tsx` — types (`Order`/`OrderStatus`/`OrderItem`) + `STATUS_CONFIG`/`STATUSES` + `ORDER_STATUS_LABELS` (4-langues) + `orderStatusLabel` + `API_TO_LOCAL_STATUS`/`LOCAL_TO_API_STATUS` + `mapApiOrder`.
  - `OrdersKpis` / `OrdersCalendar` / `OrdersListPanel` / `OrderDetailModal` / `NewOrderModal` (460L, le plus riche en props/état) — **présentationnels**, appellent `useConfig`/`useI18n`/`useFormatAmount`/`t` en interne.
- **Contrat de comportement** : `src/tests/orders.anchor.test.tsx` (**9 cas**) couvre load+KPIs / filtre recherche / modale détail / onglet calendrier / changement de statut **+ flux de création** (commande client, bon de commande fournisseur, bouton créer désactivé tant que client+article manquent, picker ajout/retrait panier). **À garder vert avec assertions inchangées** : c'est lui qui prouve le câblage props/état au runtime (tsc ne le couvre pas) et protège l'i18n.
- **i18n Orders : CLOS** — tout en `i()`/`t()`/ternaire 4-langues ; seule dette d'affichage restante (badge « Retard ») passée en clé 4-langues. Pattern **FR=clé intact** : `STATUS_CONFIG`/`STATUSES`, `unit:'unité'` (data), filtres → **non touchés** (valeur FR = clé de données/filtre, seul l'affichage est traduit via `orderStatusLabel`).

### Web — HR XL : découpe + i18n ✅ CLOS
Dernier module in-app monolithique traité (même méthode qu'Orders : **test d'ancrage d'abord → découpe à comportement identique → i18n ensuite**).
- **`HRTabs.tsx` 1172 → 82L** (conteneur fin) + **8 composants `components/hr/tabs/`** : `HRContractsTab`, `HRPayrollTab` (conteneur des 4 sous-onglets) + `PayrollGrid`/`PayrollPayslips`/`PayrollBonuses`/`PayrollHistory`, `HRAttendanceTab`, `HRLeavesTab`. **État co-localisé** : `isMobile`+resize → `PayrollHistory`, `expandedEmpBonuses`/`deleteOneBonus` → `PayrollBonuses`. Ancrage `src/tests/hrtabs.anchor.test.tsx` **8 cas** (étendu en cours de session : `PayrollHistory`/`PayrollPayslips` couverts après la découpe initiale).
- **`HRModals.tsx` 1097 → 118L** (dispatcher fin : flag d'ouverture → composant) + **8 composants `components/hr/modals/`** : `SalaryModal` (+ `SalaryRaiseForm`, `BonusForm`), `EmpModal` (ajout), `EditEmployeeModal` (édition premium, **333L — la plus riche en props/état**), `NewContractModal`, `ContractDetailModal`, `LeaveRequestModal`. **`AddressInputSimple` (code mort, 0 référence) supprimé.** Ancrage `src/tests/hrmodals.anchor.test.tsx` **10 cas** (priorité `EditEmployeeModal` : save→`employeesApi.update`, cancel→`openEditModal`, delete→`confirm`).
- **i18n** : **9 chaînes HRTabs** (Actif/Inactif, bannière congés en attente + suffixe jours, en-têtes CSV + colonne Actions, NET/ACTIONS/TOTAL) + **7 chaînes HRModals** (PERFORMANCE, Net preview ×2, placeholders date `JJ/MM/AAAA` + emails) passées en 4-langues. **Validation & soumission déjà localisées.** Pattern **FR=clé intact** : `CDI`/`CDD`/types contrat, rôles, départements (traduits à l'affichage via `contractLabel`/`roleLabel`/`deptLabel`), codes `CNSS`/`IR`, noms propres (exemples) → non touchés.
- Total après lots HR : **tsc 0, 84/84 tests, build OK**. HRTabs/HRModals = derniers monolithes in-app ⇒ dette « découpe + i18n in-app » close (les 7 pages de la ligne dette 🟡 restent ouvertes, fichiers non traités).

### Web — bugs corrigés
- Devise form Stock : conversion XOF↔devise aux frontières I/O (helpers hydrate/dehydrate)
- Prix catalogue public : conversion XOF→devise
- Cache-busting devise catalogue (`s-maxage=0`)
- Caisse après refresh : reset conditionnel dans `App.tsx` (seulement si pas de session active)
- Panier POS après navigation/refresh : `cart` déplacé dans `appStore` (Zustand persist)
- `clearCart()` au login ET logout (panier vide à chaque nouvelle session)
- Guard cash POS : encaissement bloqué si montant reçu < total (modes Wave/Orange/Carte non concernés)
- Thème modales customers : fond `#0D0D1C` hardcodé → `var(--card)` (détail + création)
- Bannière PWA : mémorisée 7 jours après « Plus tard » (`localStorage` `pwa-install-dismissed`)
- Libellé FCFA sans espace (« F CFA » → « FCFA »)
- Badge hero landing lisible (fond translucide + bordure violette + texte gradient)
- **Payroll : année réelle dans les clés/labels de mois** — `MONTHS` ne code plus `2026` en dur (`buildMonths(new Date().getFullYear())`). Le mois n'est qu'une **clé d'affichage/filtre côté client** (records générés depuis `employeesApi`, jamais persistés) → blast radius nul ; format de clé `"Mois AAAA"` inchangé, affichage localisé via `monthLabel` (`Intl`). `buildMonths`/`monthLabel` exportés + testés (passage 2027, 4 langues).
- **Bug-class « date "aujourd'hui" figée en dur » — sweep complet** (commits `d5e9027d`+`0a07e0b0`+`db336332`). Révélé par les tests métier HR ; la même classe de bug (un littéral de date servant de *now*) existait à 3 endroits, tous corrigés :
  - **`calcAnciennete` (`hr/hrShared.tsx`)** : calculait l'ancienneté contre `new Date('2026-05-18')` → ancienneté **gelée**. Fix : 3e param OPTIONNEL `now: Date = new Date()` (après `hiredAt, lang` → call sites `HREmployeeGrid`/`ContractDetailModal` intacts via défaut) ; tests injectent un `now` fixe pour rester déterministes + 1 test prouve que le défaut avance.
  - **Expenses (`pages/Expenses.tsx`)** : KPI « dépenses du mois » filtrait `startsWith('2026-05')` en dur → épinglé à mai 2026, alors que le **libellé** `ExpensesKpis` était déjà dynamique (`new Date()`) → label/donnée incohérents hors mai. Fix : préfixe `AAAA-MM` dérivé de `new Date()` (heure locale) ; renommé `may/totalMay`→`thisMonth/totalThisMonth` (le nom « May » trompeur était la cause).
  - **Payroll `paidAt` (`pages/Payroll.tsx`)** : `markPaid` stampait `'14/05/2026'` en dur → date de paiement fixe. Fix : `new Date().toLocaleDateString(locale selon lang)`. Client-only (records non persistés).
  - **Laissé (NON bug-class)** : `posShared.tsx` `promotionEnd:'2026-05-31'` = **donnée de fixture démo**, pas une réf. *now*. La logique d'expiration CDD « ≤30 j » (`HRContractsTab`) utilise déjà `new Date()` réel → correcte.
  > Leçon : un littéral de date comme *now* (`new Date('YYYY-MM-DD')`, `startsWith('YYYY-MM')`, string de date stampée) = bug latent invisible jusqu'au changement de date. Rendre `now` **injectable** (param optionnel défaut `new Date()`) concilie prod-correcte + tests déterministes.
- **`console.log` API debug → `logger.log` DEV-gated** (`api.ts:43`) : ne s'exécute plus en prod (`logger` filtre sur `import.meta.env.DEV`) et ne logge que la **présence** du token (`✅/❌`), jamais sa valeur. Retiré de la dette 🟡.
- **Carte fidélité — seuils en FCFA figés → devise tenant** (`beae5027`) : `LoyaltyCard.tsx` affichait « X point par tranche de 1 000 FCFA » (×3 tiers) + « Remise > 10 000 FCFA » en FCFA hardcodé → faux sur tenant EUR/USD. Remplacé par `fmt(1000)`/`fmt(10000)` (`useFormatAmount`, base XOF→devise affichée) interpolés dans les chaînes `i()` 4 langues (texte entourant traduit conservé). Paliers en **points** (2 000/5 000 pts) laissés (= points, pas devise).
- **HR — 3 bugs UI** (commits `3fe4fcf1` + `67f44a4b`) : (1) **suffixe devise** des champs salaire — affichaient le **code ISO** (« XOF ») au lieu du **symbole** (« FCFA »/« € »/« CA$ »). Source canonique = `CURRENCY_SYMBOLS` (appStore). `NewContractModal` utilise la **devise officielle du tenant** (`tenant.currency`, salaire contractuel ; threadé via prop `tenantCurrency`, suffixe = `CURRENCY_SYMBOLS[tenantCurrency] ?? tenantCurrency`) ; `SalaryRaiseForm`/`BonusForm`/`EditEmployeeModal`/`EmpModal` la **devise d'affichage** (`useCurrencyInfo().symbol` ou prop `currencySymbol`). `EmpModal` garde `code` pour la logique `code==='XOF'`. (2) **`LeaveRequestModal` dropdown employé injélectable** : les ids sont des **cuid STRING** en prod/démo (`demo-emp-Marie`), mais `onChange` faisait `Number(e.target.value)=NaN` → la sélection ne tenait jamais (le test d'ancrage le masquait avec un id numérique). Fix : `empId` gardé en string + compare souple `String(e.id)===String(empId)` + `option value=String(e.id)`. (3) **`AssignShiftModal` (planning) thème non respecté** : fond `#0D0D1C` + cartes rgba blanc hardcodés → `var(--card)`/`var(--border)`/`var(--bg3)`/`var(--sh-xl)` (conservé : scrim `rgba(0,0,0,.7)` overlay standard, couleurs sémantiques de shift `s.color`/`s.bg`).

### Web — 4 bugs prod HR/Paie/Planning (session 31 mai 2026, commits `194ac1e1`+`02476901`+`4e9f4678` ; vérifs live `77625488`+`a20288ce`)
> ⚠️ Méthode : avant de conclure une cause, **vérifier la donnée prod réelle** (script tsx read-only sur `DATABASE_URL`) ET le **comportement runtime** (test de rendu / E2E live). Cas vécu ici : un root-cause « mismatch de champ API » s'est avéré **faux** une fois la donnée et le test consultés.
- **BUG 1 — `NewContractModal` affichait « FCFA » en devise d'affichage EUR.** Fix : aligné sur le pattern `EmpModal` → saisie en **devise d'AFFICHAGE** (`currencySymbol` via prop, ex. « € »), conversion `toXOF()` au submit. **⚠️ SUPERSEDE la ligne « HR — 3 bugs UI » §(1)** : `NewContractModal` n'utilise plus la devise *officielle du tenant* (`tenantCurrency`) mais la devise d'**affichage** locale (les autres modales l'utilisaient déjà). Le prop `tenantCurrency` de `HRModals` est conservé `?` (déprécié, compat appelant). Bonus : la modale stockait le montant **brut non converti** dans `newEmp.salary` → re-mélangé par la grille (XOF→affichage) ; corrigé via `toXOF`.
- **BUG 2 — Bulletin PDF ≠ écran (montants faux).** Cause : **double conversion**. `formatAmount(xof, cur)` (appStore) convertit DÉJÀ XOF→devise en interne ; `printBulletin` faisait `formatCurrency(convertCurrency(n,'XOF',cur), cur)` → pré-convertissait PUIS reconvertissait (450 000 XOF → 686,02 → traité comme XOF → ~1,05 €). L'écran (`useFormatAmount`, 1 conversion) était juste. Fix : `fmtP = (n) => formatAmount(n, currency)` (conversion unique, identique à l'écran). **Pattern à retenir** : `formatAmount`/`formatCurrency` prennent un montant **XOF** et convertissent eux-mêmes ; ne JAMAIS pré-`convertCurrency` avant. **Vérifié live** (`bulletin-pdf.spec.ts`) : PDF de Fatoumata Ndiaye (450 000 XOF) = `686,02 €`, identique à l'écran, CNSS `38,42 €`.
- **BUG 3 — Congé approuvé non reporté sur le planning : GAP fonctionnel (jamais implémenté), PAS une régression de découpe.** Les congés vivent dans l'état HR ; les shifts dans `localStorage('habashop_shifts')` keyé `(empId, indexJourSemaine 0-6)` — aucun lien n'a jamais existé. Implémenté : `handleLeaveAction('approved')` → `writeLeaveShiftsToPlanning(empId, from, to)` (dans `planningShared`) écrit des shifts `'leave'` sur les index jours couverts (helper pur **`weekdayIndicesForRange`**, testé). Planning lit la **clé partagée `SHIFTS_STORAGE_KEY`** à son montage → congé visible après navigation. **⚠️ Limite connue (documentée)** : modèle planning indexé par jour de semaine (0-6), **agnostique de la semaine** → le congé s'affiche sur ces jours quelle que soit la semaine ; un report **daté** précis exigerait un modèle de shift daté + persistance backend. **Vérifié live** (`leave-planning.spec.ts`) : congé Lun→Mer → `{"demo-emp-Fatoumata Ndiaye":{"0":"leave","1":"leave","2":"leave"}}` + 3 cellules « Congé » rendues.
- **BUG 4 — « filtres Planning inopérants » : PAS un bug de code.** Le filtre département **et** le filtre shift fonctionnent (logique correcte + test d'ancrage dept déjà vert + nouveau test shift). Mon root-cause initial (« l'API renvoie `department`, Planning lit `dept` ») était **FAUX** : la route `GET /api/employees` renvoie l'objet Prisma **brut** → champ `dept` (pas `department`) et `isActive` (pas `active`) ; l'original `e.dept` lisait déjà bien. Vérif prod : `demo-tenant-001` (4 dépts distincts) + `demo-tenant-002` (2) → **0 employé sans département, 0 tenant client réel** (seuls les 2 tenants démo existent). Le mapping Planning a quand même été passé en `e.department ?? e.dept` / `e.active ?? e.isActive ?? …` = **robustesse défensive inoffensive** (alignée sur HR), pas un fix. Symptôme utilisateur le plus plausible si jamais reproduit : tenant à département **unique/vide** (rien à réduire) ou filtre shift sur une semaine **sans shift** (grille vide = correct).

### Web — design
- **Thème « Violet & Or ✨ » (`gold`)** ajouté comme thème par défaut (`DEFAULT_CONFIG.theme = 'gold'`) — violet `#7C3AED` verrouillé via `applyAccentColor` (indépendant de l'accent), or via `--acc2` (`#EAB308`, 203 usages)
- Refonte **landing/login/signup** : palette violet+gold (design system `src/styles/public.css`, scope `.public-scope`), stats hero (500+ boutiques · 12 pays · 99.9%), témoignage client, inputs premium
- **Tarifs** : équivalence EUR sous les prix FCFA (taux fixe 1 €=655,957 XOF)
- **Onboarding** aligné palette violet+gold
- **Section Sécurité** Settings harmonisée (cards `var(--card)`, inputs `var(--bg3)` distincts de la card)
- **Page API Docs** thémée (fond sombre, code block dark + coloration syntaxique)
- **Page Intégrations API** : cards statut coloré (vert/orange/rouge) + glow + bouton « Tester » live (spinner + toast)

### Patterns / pièges nouveaux
- **Découper un gros composant SANS tests → écrire d'abord un test d'ancrage** (rendu + interactions clés, en priorité les flux les plus riches en props/état — ex. la modale de création). Il doit passer **à l'identique AVANT et APRÈS** la découpe : `tsc` valide les types mais **ne couvre pas le câblage de props au runtime** (un `onClose`/`setState` mal rebranché compile), c'est le test qui le prouve. Ensuite seulement, faire l'i18n par-dessus (mêmes assertions = filet anti-régression). Cas vécu : Orders 1104→296L + 6 composants, `orders.anchor.test.tsx` 5→9 cas.
- **`appStore` persiste tout par défaut** : la `partialize` utilise `...rest` → toute nouvelle state ajoutée à `appStore` est persistée dans `localStorage`. Penser à **resetter les états de session** (cart, cashier) dans `authStore` login/logout, ou les exclure de `partialize`.
- **PWA banner** : headless Chromium ne fire jamais `beforeinstallprompt` → le **dispatcher synthétiquement** dans les tests Playwright (`window.dispatchEvent(new Event('beforeinstallprompt'))`).
- **`applyAccentColor()` écrase `--p/--p2/--p3`** (appelé APRÈS `applyTheme`) → pour verrouiller une couleur primaire dans un thème, poser les valeurs **dans `applyAccentColor()`** quand `body.className === 'theme-gold'` (une seule source de vérité, couvre updateConfig/setTheme/rehydrate/reset).
- **Animation `slideUp` sans `fill-mode forwards`** (`index.css`) : opacity+transform animés → un screenshot CI peut capturer l'élément transparent/décalé. **Attendre ~500ms** avant capture.
- **Catalogue public** : NE PAS utiliser `useFormatAmount` (hook lié au store auth) → utiliser `convertAmount` + `formatInCurrency` (fonctions pures exportées d'`appStore`).
- **Agrégats financiers = réconcilier avec le dashboard** : tout nouveau total CA/revenus DOIT réutiliser la source du dashboard (`Sale.total`, bornes `new Date(y,m,1)` heure serveur) pour éviter le double comptage. Modèles réels : `Sale` (revenu POS), `Expense` (dépenses, catégories Loyer/Énergie/Transport/Maintenance/Fournitures/Marketing/Formation/Autre — **pas** de « Salaires »), **pas** de table `Payroll` ni `Transaction`/`Order` client. Salaires = `Employee.salary` (projeté).
- **Tests backend = prisma mocké** (`vi.mock('../db')`, vitest) → ne JAMAIS toucher la DB prod. Extraire la logique en helpers purs (`computeReport`, `resolveMonth`, `decideOrangeWebhook`) pour les tester sans Fastify. Pour tester une **route** (RBAC, dryRun, etc.) : `Fastify().register(routes)` + `app.inject()` en mockant `../middleware/authenticate` (injecter `request.user.role`/`tenantId` via headers de test).
- **Régulariser un `prisma db push`** : un `db push` (ajout colonne sans migration) crée un **drift** invisible (`migrate status` reste « up to date » car il ne compare que l'historique). Pour régulariser SANS perte : créer une migration additive **idempotente** (`ADD COLUMN IF NOT EXISTS`) puis `prisma migrate resolve --applied <migration>` (enregistre l'historique sans ré-exécuter, la colonne existant déjà). JAMAIS `migrate reset`/`migrate dev` sur la DB prod.
- **Déploiement back+front couplé** : quand un changement de forme JSON touche back ET front, déployer **Railway d'abord** (route/champ dispo) puis Vercel, sinon le front lit des champs `undefined`.
- **Crons = `setInterval` horaire + garde fenêtre-temps** (`server.ts`, ex. `getDate()===1 && getHours()===8 && getMinutes()<=5`). Pour une vraie idempotence (resists restart/rejeu), ajouter un **marqueur en base** (ex. `Tenant.lastPayrollReportMonth`) et filtrer dessus dans le `findMany`. Cœur extrait en service (`payrollReport.ts` : `buildPayrollReport`/`deliverPayrollReport`) partagé entre le **cron** (`runMonthlyPayrollReports`) ET une **route admin de déclenchement à la demande** (`POST /api/admin/payroll-report/run`, RBAC ADMIN, `dryRun:true` par défaut, destinataire dérivé serveur, jamais d'email du client) → zéro duplication. Montants paie = base XOF → **convertir vers la devise du tenant** dans le service (`Employee.salary` est en base, comme tout ; taux fixes miroir du frontend).
- **Webhooks paiement sécurisés (`payments.ts`)** : Wave ET Orange Money vérifient désormais une signature **HMAC-SHA256 du raw body** (`timingSafeEqual`). Orange est **fail CLOSED** (`verifyOrangeWebhook` : sans secret ni signature → rejet) + validation montant/devise/référence contre la `PlanRequest` en attente + idempotence. **Env requise** : `ORANGE_MONEY_WEBHOOK_SECRET` (à poser sur Railway pour réactiver l'auto-activation Orange ; sinon tous les webhooks Orange sont rejetés = sûr mais inerte). `WAVE_WEBHOOK_SECRET` côté Wave.
