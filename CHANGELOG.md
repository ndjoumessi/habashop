# Changelog HabaShop

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/).
Ce changelog reflète **ce qui est réellement livré** ; les fonctionnalités codées-mais-non-déployées ou planifiées sont signalées explicitement.

## [2.3.9] — 2026-05-25 — Architecture frontend : découpe de `Reports.tsx`

> Déployé et **vérifié en production** (frontend Vercel). Refactor interne — **aucun changement de comportement**.

### ♻️ Découpe de `Reports.tsx`
- `Reports.tsx` : **698 → 219 lignes** (page conteneur : état + fetch `salesApi`, `paymentData` (useMemo), exports CSV/PDF/Excel, header + sélecteur de période + KPIs + barre d'onglets).
- JSX extrait **à l'identique** dans `src/components/reports/` :
  - **`ReportsTabs.tsx`** (459 l.) — les 5 onglets (Ventes / Stock / Clients / Finance / RH) **+** les 3 renderers Recharts (`renderActiveShape`, `CustomPayTooltip`, `renderLabel`) déplacés depuis `Reports()` (ils closent désormais sur le prop `fmt` + `RADIAN` importé).
  - **`reportsShared.tsx`** (58 l.) — type `Period`, consts `PERIOD_DATA`/`CHART_DATA`/`PAYMENT_MODES`/`RADIAN`/`TOP_PRODUCTS`/`RECENT_SALES` + composant `Trend`.
- Données calculées (`chartData`, `paymentData`, `data`, `activePayIndex`) passées en **props typées** ; couleurs des graphiques Recharts inchangées.
- **Vérifié** : `tsc` clean (du premier coup), **43/43** tests, build OK (chunk Reports 7,8 KB gzip). Smoke Playwright (`e2e/reports.spec.ts`) sur **preview local** puis **prod live** — les 5 onglets rendent (graphiques inclus : donut + area chart via les renderers déplacés), **0 erreur JS**, non-flaky ×2 (après correction d'un sélecteur de test : le titre RH `<UserCog/> Équipe` a un espace de tête → ciblé sur « Masse salariale »).

> Série de découpe complète : HR [2.3.1], Customers [2.3.2], Stock [2.3.3], POS [2.3.4], Settings [2.3.6], Reports [2.3.9].

## [2.3.8] — 2026-05-25 — Emails transactionnels (Resend)

> Déployé et **vérifié en production** (backend Railway). Clé `RESEND_API_KEY` configurée (send-restricted).

### 📧 Service email (`services/email.ts`)
- Intégration **Resend** (`npm i resend`) — gratuit 3 000 emails/mois. Helper `send()` **non-bloquant** : sans `RESEND_API_KEY` → warn + no-op (jamais d'erreur). `FROM` configurable via `EMAIL_FROM`, défaut `onboarding@resend.dev` (fonctionne sans domaine vérifié).
- **6 emails templatés** (HTML responsive + branding HabaShop) : bienvenue, rappel J-7 (avec stats), rappel J-3 (urgent), essai expiré, confirmation d'upgrade, rapport hebdomadaire.

### 🔗 Intégrations
- **`auth.ts`** : email de bienvenue après `POST /api/auth/register` (non-bloquant, `.catch`).
- **`admin.ts`** : email de confirmation après approbation d'upgrade (`PATCH /api/admin/plan-requests/:id`, action `approve`) + route **`POST /api/admin/test-email`** (dev uniquement, 403 en prod, `authenticateAdmin`).
- **`server.ts`** : crons `setInterval` — rappels d'essai (horaire) + rapport hebdo (lundi 8h). Le cron rappels **suspend** aussi les essais venant d'expirer (`status: suspended`, `isActive: false`, fenêtre ±30 min) — mutation DB prod, indépendante de la clé email ; premier run +1h après boot.
- Champs Prisma validés contre le schéma (`tenant.status`/`trialEnds`, `user.role 'ADMIN'`, `product.stockQty/stockMin` via field reference, `saleItem.groupBy`).

### ⚠️ Limite Resend à lever pour la prod réelle
- Avec `onboarding@resend.dev`, Resend n'autorise l'envoi **qu'à l'adresse du titulaire du compte**. Pour écrire aux vrais clients : **vérifier un domaine** sur Resend (DNS sous votre contrôle — pas `habashop.vercel.app`) puis définir `EMAIL_FROM`.

> Réconciliations vs spec : email d'upgrade placé dans `admin.ts` (vrai handler d'approbation, pas `billing.ts`) avec `authenticateAdmin` ; `FROM` lu depuis l'env avec défaut sûr ; requête low-stock filtrée `deletedAt: null`. Vérifié : `tsc` clean, 39/39 tests, build OK, redéploiement Railway sain.

## [2.3.7] — 2026-05-25 — SEO Afrique francophone (Lighthouse SEO 100/100)

> Déployé et **vérifié en production** (frontend Vercel). **Lighthouse SEO 100/100** (tous audits verts) ; fichiers statiques servis en 200.

### 🔎 Meta tags & données structurées (`index.html`)
- `<title>`, `description`, `keywords` (longue traîne Afrique), `robots`, `author`, **`canonical`**.
- **Open Graph** (Facebook/WhatsApp) + **Twitter Card** pointant sur `og-image.png` (1200×630), `og:locale fr_SN` + alternates (CI/ML/BF).
- **3 blocs JSON-LD** : `SoftwareApplication` (featureList, offers, aggregateRating, areaServed), `Organization` (logo, serviceArea, contactPoint), `FAQPage` (5 Q/R : offline, paiement, prix, pays, import).
- **Prix JSON-LD alignés sur le réel** : Starter 9 900 / Pro 24 900 / Enterprise 49 900 F CFA/mois (la spec proposait « Starter: 0 », corrigé).
- Polices Google (Outfit/JetBrains Mono) **conservées** (la spec les retirait → régression polices évitée) ; lien `favicon-32x32` retiré (fichier inexistant).

### 🗺️ Crawl & partage (`public/`)
- **`sitemap.xml`** (4 URLs publiques : /, /pricing, /signup, /login) + **`robots.txt`** (`Disallow /app /admin /onboarding` + ligne `Sitemap`).
- **`og-image.png`** (1200×630) généré via **Playwright** (rendu HTML réel : polices, dégradés, drapeaux) — Pillow indisponible sur l'environnement.
- **`manifest.json`** enrichi (name long, description, `categories` business/productivity/finance, `screenshots`, `shortcuts` POS/Dashboard) en **gardant les icônes PWA `pwa-192/512`** et `start_url: /app/dashboard` (la spec les supprimait/changeait → installabilité & UX préservées).

### 🌍 Contenu landing (`LandingPage.tsx`) — mots-clés naturels
- H1 enrichi : « Gérez votre **boutique en Afrique** » + « Caisse, stock, clients & RH en un seul **logiciel** » ; badge pays, sous-titre, titres de features SEO (Caisse Enregistreuse POS, Gestion de Stock Temps Réel, Gestion Clients & Fidélité, RH & Paie).
- Pricing ancré local : « prix en Franc CFA » + « payez par **Wave, Orange Money ou MTN** ».
- Nouvelle section **« Pays couverts »** (`<h2>` indexable + grille de 10 drapeaux : Sénégal, Côte d'Ivoire, Mali, Burkina, Guinée, Cameroun, Congo, Gabon, Togo, Bénin + 140 autres).
- **FAQ FR + EN alignées** sur le JSON-LD (offline, modes de paiement, coût, disponibilité pays, import CSV/Excel). FAQ ES/IT laissées telles quelles (FR = cible SEO et langue du JSON-LD).

> Vérifié : `tsc` clean, 43/43 tests, build OK, smoke Playwright (H1 + section pays + FAQ rendent, 0 erreur JS), `curl` prod 200 sur sitemap/robots/og-image, **Lighthouse SEO 100/100**.

## [2.3.6] — 2026-05-25 — Architecture frontend : découpe de `Settings.tsx`

> Déployé et **vérifié en production** (frontend Vercel). Refactor interne — **aucun changement de comportement**.

### ♻️ Découpe de `Settings.tsx`
- `Settings.tsx` : **656 → 78 lignes** (la page déléguait déjà à 6 fonctions `Section*` sans props → extraction à l'identique, **zéro threading de props**).
- JSX extrait dans `src/components/settings/` :
  - **`SectionShop.tsx`** — infos boutique + KPIs (fetch tenant/dashboard/customers).
  - **`SectionPOS.tsx`** — config POS (toggles, TVA, fond de caisse).
  - **`SectionLang.tsx`** — langue / devise / thème + couleur d'accent.
  - **`SectionNotif.tsx`** — toggles de notifications.
  - **`SectionSecurity.tsx`** — verrou paramètres, session JWT.
  - **`SectionDocs.tsx`** — export/import config, reset.
- **`settingsShared.tsx`** — primitives partagées (`L4`, `makeI`, `pick`, `panel`, `Switch`, `ToggleCard`, `Head`). Le const `SECTIONS` + la navigation restent dans `Settings.tsx`.
- **Vérifié** : `tsc` clean (du premier coup), **43/43** tests, build OK (chunk Settings 10,8 KB gzip). Smoke Playwright (les 6 sections rendent, sans action destructive) sur preview local puis **prod live** — après correction d'un sélecteur de test (le nom accessible des boutons de nav inclut leur description, et « Notifications »/« Documents » entraient en collision avec la cloche du header → ciblage par description unique).

## [2.3.5] — 2026-05-25 — Loading states généralisés + composant Skeleton

> Déployé et **vérifié en production** (frontend Vercel). Aucun changement de comportement fonctionnel.

### 🦴 Composant `Skeleton` (refonte)
- `ui/skeleton.tsx` : **export default + nommé**, props `height` / `width` / `count` / `radius` (+ className/style/props spread). Rend `count` barres **visibles** via la classe `.skeleton` (shimmer `--bg4`/`--bg5`).
- Motif : le `<Skeleton>` shadcn d'origine s'appuyait sur `bg-muted`, mais le token `--muted` n'est **pas défini** dans le projet → rendu quasi-invisible. La classe `.skeleton` (déjà utilisée par HR) est la vraie primitive.
- Casse d'import corrigée : le fichier réel est `ui/skeleton.tsx` (minuscule, convention shadcn) ; les imports en `Skeleton` majuscule déclenchaient `TS1261` (conflit de casse sur FS insensible).

### ⏳ Loading states — 8 pages
- **Suppliers / Orders / Expenses / Planning** : passage des squelettes inline `.skeleton` au composant `<Skeleton>` (dans le `<tbody>`, état vide conservé).
- **Reports / Goals** : vrai fetch au chargement (`salesApi.list` / `dashboardApi.stats`) → `finally(() => setLoading(false))` + squelette en early-return.
- **Activity / Forecasts** : **données statiques** (pas de fetch réseau au montage) — squelette bref au montage (`useEffect(() => setLoading(false), [])`), ajouté pour la cohérence visuelle ; signalé comme quasi-instantané.
- `grep -rl "Skeleton" src/pages | wc -l` → **8**.

### 🎨 Tokenisation couleurs (composants extraits)
- Script hex→var appliqué sur `components/{customers,stock,pos}` + pages Customers/Stock/POS : **1 remplacement** (`POSCart` `rgba(0,208,132,.25)` → `var(--c-green-border)`, valeur identique). Le reste était déjà tokenisé (passes précédentes) ; les hex en dégradés/alpha ne correspondent volontairement pas au motif.
- **Aucun** hex de print-HTML (`window.open`), de template SVG (`createMarkerIcon`) ou de graphique Recharts touché — vérifié avant exécution.

> Rappel : la découpe de `Stock.tsx` a été livrée en [2.3.3] (940 → 264 lignes). Non refaite.

## [2.3.4] — 2026-05-25 — Architecture frontend : découpe de `POS.tsx` + loading states

> Déployé et **vérifié en production** (frontend Vercel). Refactor interne — **aucun changement de comportement**.

### ♻️ Découpe de `POS.tsx`
- `POS.tsx` : **1891 → 569 lignes** (page conteneur : état caisse/panier, handlers `confirmSale`/`printTicket`/`addItem`, écran « caisse fermée », layout + délégation du rendu).
- JSX extrait **à l'identique** (script de découpe, zéro réécriture) dans `src/components/pos/` :
  - **`POSProductGrid.tsx`** (396 l.) — colonne catalogue : onglets Caisse/Historique, filtres catégories, recherche + scan, barre type-client/remise, grille produits, vue historique.
  - **`POSCart.tsx`** (376 l.) — colonne panier : lignes d'articles, totaux HT/TVA/TTC, 5 modes de paiement, monnaie, bouton encaisser.
  - **`POSModals.tsx`** (522 l.) — modale remise + fermeture de caisse + confirmation de vente (avec sélecteur d'indicatif pays WhatsApp).
- **`posShared.tsx`** (191 l.) — module partagé (CATS, PRODUCTS, types `PosProduct`/`CartItem`, COUNTRY_CODES, CASHIER_TEXTS, composant `CountryItem`). État/handlers passés en **props typées** ; l'orchestration (caisse, checkout) reste dans `POS.tsx`.
- **Vérifié** : `tsc` clean (a détecté `isMobile`/`mobileView` manquants dans `POSProductGrid` → corrigé), **43/43** tests, build OK (chunk POS 15,6 KB gzip < 100 KB). Smoke Playwright (`e2e/pos.spec.ts`, non-flaky ×2) + probe sur **preview local** puis **prod live** : ouverture caisse → grille + panier + modales, ajout produit au panier → modale de vente **sans déclencher d'encaissement** (pour ne pas créer de vente réelle en prod).

### ⏳ Loading states (squelettes)
- Ajout d'un état `loading` + squelettes shimmer (classe CSS `.skeleton`) pendant le fetch API sur **4 pages liste/grille** avec un vrai appel réseau : **Suppliers, Orders, Expenses, Planning** (`finally(() => setLoading(false))`, branche skeleton dans le `<tbody>` avant le contenu existant + état vide conservé).
- **Skip assumé** : pages à données statiques/seed (Goals, Activity, Payroll, Notifications, Users) où le loading serait factice ; pages charts (Reports, Forecasts) où un squelette de tableau ne convient pas.
- Le composant shadcn `<Skeleton>` n'est **pas** utilisé : il s'appuie sur `bg-muted` dont le token `--muted` n'est pas défini dans le projet (rendu quasi-invisible) ; la classe `.skeleton` (shimmer `--bg4`/`--bg5`, déjà utilisée par HR) est la vraie primitive visible.

> Note `Customers.tsx` : déjà découpé en [2.3.2] (1811 → 341 lignes) — non refait.

## [2.3.3] — 2026-05-25 — Architecture frontend : découpe de `Stock.tsx`

> Déployé et **vérifié en production** (frontend Vercel). Refactor interne — **aucun changement de comportement**.

### ♻️ Découpe de `Stock.tsx`
- `Stock.tsx` : **940 → 264 lignes** (page conteneur : imports, état, effets, handlers `saveProduct`/`resetForm`, layout + délégation du rendu).
- JSX extrait **à l'identique** (script de découpe, zéro réécriture) dans `src/components/stock/` :
  - **`StockInventory.tsx`** (239 l.) — panel inventaire : toolbar (export CSV/PDF, étiquettes, ajout), filtres, vue grille + vue liste, pagination.
  - **`StockModals.tsx`** (507 l.) — modale produit (3 onglets : Général / Prix & Stock / Avancé) + scanner code-barres + modale catégorie + modale étiquettes.
- **`stockShared.tsx`** (32 l.) — module partagé (type `ProductItem`, `PRODUCTS_INIT`, `CATEGORIES_INIT`, helper `statusOf`) — évite tout import circulaire ; état/handlers passés en **props typées**.
- Gardés **inline** dans `Stock.tsx` : header, alerte rupture, KPIs, et le panel **Catégories** (petit ; son bouton ouvre la modale catégorie de `StockModals`).
- **Vérifié** : `tsc` clean (du premier coup), **43/43** tests unitaires, build OK. Smoke Playwright (`e2e/stock.spec.ts`) sur **preview local du build** puis sur **prod live** — rendu page, ouverture des modales produit / étiquettes / catégorie ; probe étendu sur **données réelles** (édition produit depuis la liste → modale, bascule vue grille) **sans erreur runtime**.

> Couverture honnête : le smoke + probe vérifient le **rendu** des modales/vues et l'absence d'erreur JS, pas les flux d'écriture de bout en bout (création/édition produit persistées, impression d'étiquettes) — qui compilent et s'affichent sans erreur mais n'ont pas été exercés en aller-retour serveur.

## [2.3.2] — 2026-05-25 — Architecture frontend : découpe de `Customers.tsx`

> Déployé et **vérifié en production** (frontend Vercel). Refactor interne — **aucun changement de comportement**.

### ♻️ Découpe de `Customers.tsx`
- `Customers.tsx` : **1811 → 341 lignes** (page conteneur : imports, état, effets, handlers `geocodeCustomers`/`handleCreateCustomer`/`printCustomersPDF`, layout + délégation du rendu).
- JSX extrait **à l'identique** (script de découpe, zéro réécriture) dans `src/components/customers/` :
  - **`CustomerMap.tsx`** (339 l.) — carte Google Maps (composant déjà autonome, déplacé tel quel).
  - **`CustomersList.tsx`** (297 l.) — onglet Liste : filtres, vue tableau, vue grille « bento », pagination.
  - **`CustomersStats.tsx`** (105 l.) — onglet Statistiques (répartition par type + top 5 clients).
  - **`CustomersModals.tsx`** (600 l.) — 4 modales (fiche, modifier, nouveau, détail) + carte de fidélité.
- **`customersShared.tsx`** (253 l.) — module partagé (types `Customer`/`ClientType`/`GeoCustomer`, consts `TYPE_CFG`/`BENTO_CFG`/`CUSTOMERS_INIT`/`DARK_STYLE`/`SENEGAL_CITIES`, utils `mapApiCustomer`/`useGoogleMaps`/`typeLabel`/`createMarkerIcon`, `LoyaltyBar`) — évite tout import circulaire ; état/handlers passés en **props typées**.
- L'**onglet Carte est resté inline** dans `Customers.tsx` (il dépend du `useCallback` local `geocodeCustomers`) — il câble simplement `<CustomerMap>`.
- **Vérifié** : `tsc` clean (a détecté un `GMAPS_KEY` manquant dans `CustomerMap` → corrigé), **43/43** tests unitaires, build OK. Smoke Playwright (`e2e/customers.spec.ts`) sur **preview local du build** puis sur **prod live** — rendu page, bascule des onglets (Liste/Carte/Stats), ouverture de la modale « nouveau client » ; probe étendu sur **données réelles** (6 clients) exerçant les modales fiche + modifier + détail **sans erreur runtime**.

> Couverture honnête : le smoke + probe vérifient le **rendu** des onglets/modales et l'absence d'erreur JS, pas les flux d'écriture de bout en bout (création/édition/suppression client persistées) — qui compilent et s'affichent sans erreur mais n'ont pas été exercés en aller-retour serveur.

## [2.3.1] — 2026-05-25 — Architecture frontend : découpe de `HR.tsx`

> Déployé et **vérifié en production** (frontend Vercel). Refactor interne — **aucun changement de comportement**.

### ♻️ Découpe de `HR.tsx`
- `HR.tsx` : **2861 → 445 lignes** (page conteneur : imports, état, effets, handlers, layout + délégation du rendu).
- JSX extrait **à l'identique** (script de découpe, zéro réécriture) dans 3 composants `src/components/hr/` :
  - **`HREmployeeGrid.tsx`** (251 l.) — onglet Équipe : barre de filtres, vue grille, vue tableau, pagination.
  - **`HRTabs.tsx`** (1056 l.) — onglets Contrats / Rémunération (4 sous-onglets : grille, bulletins, primes, historique) / Présences / Congés.
  - **`HRModals.tsx`** (1096 l.) — les 6 modales (ajout & édition employé, prime/augmentation, nouveau contrat, détail contrat, demande de congé) + helpers `EmpModal`/`SalaryRaiseForm`/`BonusForm`/`AddressInputSimple`.
- **`hrShared.tsx`** (174 l.) — module partagé (types `Employee`/`LeaveRequest`, données statiques, `DEPT_COLORS`/`COLORS`/`STATUS_CFG`, utils `toInputDate`/`displayDate`/`calcAnciennete`, `EmpAvatar`/`Stars`) pour **éviter tout import circulaire** ; état/handlers passés en **props typées**.
- **Vérifié** : `tsc` clean, **43/43** tests unitaires, build OK. Smoke Playwright (`e2e/hr.spec.ts`) sur **preview local du build** puis sur **prod live** — rendu page + KPIs, ouverture de la modale d'édition, navigation onglets (**2/2**) ; probe étendu (4 onglets + 4 sous-onglets paie + modales contrat/congé) **sans erreur runtime**.

> Couverture honnête : le smoke vérifie le **rendu** de chaque onglet/modale et l'absence d'erreur JS, pas les flux d'écriture de bout en bout (sauvegarde employé, soumission de congé, calcul de prime) — qui compilent et s'affichent sans erreur mais n'ont pas été exercés en aller-retour.

## [2.3.0] — 2026-05-25 — Mois 3 : modularisation, base de données, soft-delete, tests & monitoring

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 🧱 Architecture backend
- `server.ts` : **2003 → 170 lignes** (bootstrap uniquement : env, CORS, JWT, rate-limit Redis, WebSocket, error handler P2025→404, `/health` + `/api/health-extended`, enregistrement des routes).
- Handlers extraits **à l'identique** dans **18 modules** `src/routes/` (`auth`, `tenant`, `products`, `customers`, `sales`, `suppliers`, `orders`, `employees`, `hr`, `expenses`, `analytics`, `export`, `billing`, `admin`, `notifications`, `whatsapp`, `ai`, `docs`).
- Middleware d'auth isolés (`src/middleware/authenticate.ts`, `superAdmin.ts`) ; client Prisma partagé (`src/db.ts`) ; augmentations de type JWT/`tenantId` déplacées dans `types.ts` (portée globale).
- `notifyTenant` + état WebSocket dans `routes/notifications.ts`, importés par `sales`/`customers`/`orders`. Crons WhatsApp enregistrés **dans** `whatsappRoutes` (plus de déclenchement à l'import — neutre en tests).
- `dist/server.js` n'est plus versionné (Railway construit depuis `src` via Dockerfile ; `dist` est git/docker-ignoré).
- **Zéro régression** : vérifié en prod (santé, 401 sur routes protégées, en-têtes rate-limit au login, handshake WebSocket → close 1008).

### 🗄️ Base de données — index composites
- **+10 index composites** (23 → **33**) sur les chemins de requête fréquents : `Sale[tenantId,paymentMode]`, `Product[tenantId,barcode]`, `Customer[tenantId,totalRevenue]` & `[tenantId,type]`, `Employee[tenantId,dept]` & `[tenantId,isActive]`, `Expense[tenantId,category]`, `AuditLog[tenantId,action]`, `PurchaseOrder[tenantId,createdAt]`, `PlanRequest[tenantId,status]`.
- Migration `20260525140000_add_composite_indexes` — **additive** (`CREATE INDEX` uniquement, zéro changement de données), appliquée en prod via `prisma migrate deploy` au déploiement (jamais `migrate dev` : `DATABASE_URL` pointe sur la prod). **Présence des 10 index confirmée en prod** (`pg_indexes`).

### 🗑️ Soft delete & validation
- **`deletedAt`** sur `Customer`, `Supplier`, `PurchaseOrder`, `Product` (+ index `[tenantId, deletedAt]` → **37 index** au total). Migration `20260525150000_add_soft_delete` — **additive** (colonnes nullables + index), appliquée via `migrate deploy`. **Colonnes + index confirmés en prod**.
- `DELETE` → suppression douce (`deletedAt = now()`) + entrée `AuditLog` ; listes/exports/analytics filtrent `deletedAt: null` ; `PATCH /api/<resource>/:id/restore` (ADMIN/SUPER_ADMIN) restaure. Fournisseur avec commandes liées : plus de 409 (la ligne est conservée). `Employee` reste sur `isActive` (pas de double mécanisme).
- **Vérifié en prod** (cycle complet sur un client jetable) : create → `DELETE` **204** (masqué de la liste, ligne conservée avec `deletedAt`) → `restore` **200** (réapparaît) → audit `DELETE_CUSTOMER`/`RESTORE_CUSTOMER` → nettoyage.
- **Validation** : produits (prix/stock négatifs), ventes (≥ 1 article, total ≥ 0), billing (plan/période/méthode) — **5/5 renvoient 400 en prod**.

### 🧪 Tests — 97 au total
- **Backend** : 39 unitaires + **15 tests d'intégration** (`integration.test.ts`, **lecture seule** contre l'API prod : auth, 401/RBAC, isolation multi-tenant, analytics, billing, super-admin, export CSV via octets bruts du BOM, santé). Connexion unique partagée pour respecter le rate-limit login (10/15 min).
- **Frontend** : **22 → 43** (`components.test.tsx` : `useI18n`, conversions de devises, `usePagination`, logique billing/thèmes/onboarding).
- Séparation **unit vs intégration** : `npm test` = unitaires seulement (hors ligne) ; `npm run test:integration` via `vitest.integration.config.ts` (timeout réseau 30 s).
- **Couverture** : `@vitest/coverage-v8` (back + front), `test:coverage` — **rapport seul, pas de seuil bloquant** (les routes sont couvertes par l'intégration distante, non instrumentée). Mesuré : hooks/stores front ~47 % (`useI18n` 92 %, `usePagination` 100 %, `appStore` 76 %).
- **E2E Playwright** : `e2e/smoke.spec.ts` (**9 tests prod, 9/9 ✓** : pages publiques + flux login/dashboard/sidebar/POS/settings/super-admin) + `playwright.config.ts` + scripts `e2e`.

### ⚙️ DevOps & monitoring (additif)
- `GET /api/health-extended` enrichi : **latence DB**, uptime, **mémoire** (heap), statut des services (redis/whatsapp/ai) — `status`/`tables` conservés (rétrocompatible).
- Filets de sécurité process : `unhandledRejection` (log, pas de crash en prod) + `uncaughtException`.
- **CI/CD** (`ci.yml`) : **7 jobs** — unit backend, unit frontend + **contrôle de taille de bundle (< 100 KB gzip)**, scan sécurité (secrets + fallback JWT + `npm audit`), tests d'intégration (lecture seule, sur `main`), **E2E Playwright** (chromium + 9 tests prod, sur `main`, rapport HTML en artefact), résumé + health check prod, **`notify-failure`** (alerte Discord). Installation **workspaces depuis la racine** (lockfile racine — pas de lockfile par app). **CI vérifiée verte** (run complet incluant le job E2E). **CI sur Node 22.**
- **Node 22** : runtime prod aligné sur la CI — `Dockerfile` `node:20-slim` → **`node:22-slim`**. `nixpacks.toml` **supprimé** (config morte : Railway utilise le `Dockerfile` via `railway.json`, et le nixpacks était cassé — phase build vide + pas de `migrate deploy`). Redéployé et **vérifié en prod sur Node 22** (build OK, boot `No pending migrations`, `/api/health-extended` 200, intégration 15/15) ; `binaryTargets` Prisma inchangés (Debian bookworm).
- **Sentry** : `@sentry/react` (front : `ErrorBoundary` + UI de repli) + `@sentry/node` (back : `captureException` sur 5xx ; P2025→404 et format de réponse **conservés**) — **inerte sans DSN** (`VITE_SENTRY_DSN` / `SENTRY_DSN`). Alertes webhook Discord/Slack (`sendAlert`, `ALERT_WEBHOOK_URL`) au crash.

### 🧹 Qualité de code
- **Typage strict des routes** : `as any`/`: any` backend **110 → 25** (objectif < 30). Helpers `Req<Body,Params,Querystring>`/`Reply`/`IdParam` + interfaces de body (`ProductBody`, `CustomerBody`, `EmployeeBody`, `SaleBody`, `OrderBody`, `BonusBody`, `SalaryHistoryBody`, `TenantUpdateBody`, `InviteUserBody`, `AdminCreateTenantBody`/`AdminReviewBody`) dans `types.ts`. `request.body`/`params`/`query` typés sur toutes les routes. `any` restants assumés : spreads d'input Prisma (supplier/expense/product), socket WS + payload JWT, `context` du rate-limit, données CSV/chat non typées. **Type-only — JS émis inchangé** (tsc OK, 39/39 tests, vérifié en prod).
- **ESLint backend** : `.eslintrc.json` (`@typescript-eslint`) + scripts `lint`/`lint:fix` — **0 erreur, 142 → 53 warnings** (suite à la réduction des `any`).
- **JSDoc** concis sur les fonctions critiques : `authenticate`, `db`/`prisma`, `billing` request-plan, `useI18n`, `convertFromXOF`.
- `src/lib/logger.ts` (front) : `log` silencieux en prod, `warn`/`error` toujours actifs.

### ♿ Accessibilité & UX (Lighthouse)
- **Lighthouse : accessibilité 91 → 100/100**, bonnes pratiques **100/100**, SEO **91/100** (audité en prod sur la landing).
- **Contraste WCAG AA** : audit `color-contrast` **PASS** (26 → 0 nœuds en échec) — texte sombre sur avatars clairs (orange/vert/bleu/rouge), labels muets `text3/text4` éclaircis, opacité de la bande pays relevée, libellé « trust » `text3`→`text2`.
- `OfflineBanner` (détection online/offline, `role="status"`) dans `AppLayout` ; lien d'évitement **skip-to-content** + `#main-content`.
- `index.html` : meta `description`, Open Graph/Twitter, `color-scheme`, titre Apple, `preconnect`/`dns-prefetch` vers l'API.

> Reportés (faible valeur / risque élevé, signalés) : réduction agressive des `any` (104 → < 50), remplacement global `console`→`logger` dans les pages, intégrations Sentry react-router/Prisma (fragiles selon la version). Contraintes type CHECK non ajoutées (non exprimables en schéma Prisma sans SQL brut). Error handler et `/health` **inchangés** (comportement vérifié conservé).

## [2.2.0] — 2026-05-25 — CRUD complet & accessibilité (Mois 2)

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 🗑️ Suppression (CRUD complet)
- `DELETE /api/customers/:id`, `/api/suppliers/:id`, `/api/orders/:id` — scopés par tenant (accès cross-tenant → **404**)
- Fournisseur avec commandes liées → **409** (FK P2003) ; commande → **ADMIN requis** + transaction (supprime d'abord les lignes)
- Frontend : `customersApi`/`suppliersApi.delete` + boutons **Supprimer** (icône Lucide, `confirm` + i18n + toast) dans les fiches client/fournisseur
- Vérifié bout en bout : create → `DELETE` → **204** → absent de la liste ; id inexistant → **404**
- (la suppression employé existante est conservée en hard-delete)

### ♿ Accessibilité (ARIA)
- Attributs `aria-*`/`role`/`scope` : **69 → 152**
- `.sr-only` ; `aria-label` sur les liens de navigation (Sidebar) et les champs de recherche ; `scope="col"` sur les tables (Customers, Admin, Stock, Expenses, Orders, HR) ; `role="dialog"` + `aria-modal` sur les modales ; `role="img"` + label sur le graphique des ventes
- (déjà en place : `:focus-visible`, `prefers-reduced-motion`, landmark `nav`, `NavLink` aria-current, `role="dialog"`)

### 🧪 Tests
- Backend **32 → 39** (`routes.test.ts` : DELETE CRUD + ARIA)

> Hors périmètre (décidé) : pas de gate de suspension par requête (enforcement allégé conservé). _(La découpe modulaire de `server.ts`, alors différée, a été livrée en [2.3.0].)_

## [2.1.1] — 2026-05-25 — Performance & qualité

### ⚡ Performance (frontend, déployé + vérifié en prod)
- **Lazy-loading des routes** (`React.lazy` + `Suspense`) : chunk `index` principal **1 507 kB → 194 kB** (380 → 58 kB gzip). Pages, `charts` (recharts) et `BarcodeScanner` chargés à la demande. `AppLayout` reste eager (shell) ; `Suspense` autour de l'`Outlet` garde sidebar/header pendant la navigation.

### 🧹 Qualité & typage
- **Backend `any` : 160 → 104** — augmentation `@fastify/jwt` typant `request.user` (`JWTPayload`), interfaces de body typées (`LoginBody` / `RegisterBody` / `BillingBody` dans `types.ts`), paramètres de handler typés.
- **Tests backend : 8 → 32** (`routes.test.ts` : rate-limit / isolation multi-tenant / config billing).
- Hook **`useI18n()`** partagé renvoyant `{ lang, i, formatDate, formatDateTime }` — dédoublonnage du helper i18n dans 8 pages.
- **ESLint** : config unique `.eslintrc.cjs` (suppression du doublon `.eslintrc.json`).

> Les changements backend de cette version sont **purement typage** (JS compilé inchangé) → aucun redéploiement Railway requis ; la perf frontend est déployée sur Vercel.

## [2.1.0] — 2026-05-25 — Billing, WebSocket & durcissement sécurité

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 💳 Système de validation des plans
- Modèle `PlanRequest` + champs billing du `Tenant` (`status`, `trialEnds`, `planActivatedAt`, `planRequestedAt`, `paymentMethod`, `paymentRef`, `suspendedAt`, `suspendReason`, `notes`, `isActive`) — migration `20260525120000_add_billing_plan_requests` **appliquée en prod**
- `register` : nouveaux tenants en `status=trial`, `trialEnds = +14 j`
- `POST /api/billing/request-plan`, `GET /api/billing/status` (auto-suspension à l'expiration de l'essai)
- `GET /api/admin/plan-requests`, `PATCH /api/admin/plan-requests/:id` (SUPER_ADMIN approve/reject)
- Frontend : `BillingBanner` (essai ≤ 7 j / expiré / demande en cours), page `/app/upgrade` (Wave / Orange Money / MTN / Virement), onglet « Demandes » dans la console super-admin
- **Vérifié de bout en bout en production (nouveau tenant)** : signup → essai 14 j → demande d'upgrade via `/app/upgrade` (Wave) → demande visible dans la console super-admin → validation → tenant passé en plan `pro` / `status=active` (tenant de test supprimé ensuite)

### 🔔 Notifications temps réel (WebSocket)
- `@fastify/websocket` ; `GET /api/ws` (auth par token en query, fermeture `1008` si token invalide)
- Diffusion isolée par tenant (`notifyTenant`) : `new_sale`, `low_stock`, `new_order`, `new_customer`
- Keepalive ping 30 s, nettoyage des sockets à la déconnexion
- Frontend : `notificationStore` (reconnexion auto 5 s), cloche du Header avec badge + dropdown — **vérifié live** (broadcast reçu, badge incrémenté, notification affichée en temps réel)

### 🔒 Sécurité (audit Semaine 1)
- **Rate-limiting** (`@fastify/rate-limit`) : login 10/15 min, register 5/h, billing 3/h — **store Redis partagé** + `trustProxy: true` (clé = vrai IP client) → 429 fiable en multi-replica (**vérifié**)
- **JWT_SECRET obligatoire** : `process.exit(1)` au démarrage si absent (suppression de la valeur de repli en dur)
- Validation des variables d'environnement requises au démarrage (`DATABASE_URL`, `JWT_SECRET`)
- **23 index Prisma** (`@@index([tenantId])` + composites) — migration appliquée en prod

### ⚙️ CI/CD & qualité
- GitHub Actions (`.github/workflows/ci.yml`) : typecheck + tests + build + scan secrets (sur push)
- `.env.example` backend/frontend à jour ; hook `useI18n()` partagé (dédoublonnage du helper i18n)

## [2.0.0] — 2026-05-25

### 🏗️ Multi-tenancy
- Isolation des données par boutique via `where: { tenantId }` sur chaque route
- JWT (HS256) contenant `userId + tenantId + role`
- Création atomique `Tenant` + `User` (rôle ADMIN) au signup (transaction Prisma)
- `User.email` globalement unique (`@unique`)
- Erreur d'accès cross-tenant mappée en **404** (handler global P2025 → 404)

### 👑 Console Super-Admin (`/admin`)
- Contrôle d'accès **basé sur le rôle** `SUPER_ADMIN` (middleware `authenticateAdmin`)
- KPIs plateforme : boutiques, utilisateurs, transactions, CA, produits, **MRR estimé**
- Répartition des plans + graphe de croissance (6 mois)
- Table des boutiques avec recherche, tri et tiroir de détail
- Onglets : Vue d'ensemble / Boutiques / Demandes
- `GET /api/admin/stats`, `GET /api/admin/tenants`, `POST /api/admin/tenants`

### 🎨 UI / UX
- 7 thèmes : Dark, Darker, Midnight, Forest, Ocean, Sunset, Light
- Icônes Lucide (remplacement des emojis d'UI), transitions, `cursor:pointer`

### 🌍 Internationalisation
- 4 langues : FR / EN / ES / IT
- 6 devises : XOF / XAF / EUR / USD / CAD / GBP — conversion temps réel
- Montants stockés en XOF, convertis à l'affichage (`useFormatAmount`)
- Graphiques Recharts re-rendus au changement de devise (`key={currency}`)

### 📊 Analytics
- `GET /api/analytics/summary` (léger, dashboard)
- `GET /api/analytics` (complet, Reports) — CA jour/mois, ventes par jour, par mode de paiement, top produits
- `GET /api/dashboard/stats`, `GET /api/reports/sales`

### 📦 Export
- CSV : `GET /api/export/:resource` (products, customers, suppliers, sales, employees)
- PDF mensuel : `GET /api/export/pdf/monthly`
- Token passé en query param pour téléchargement direct

### 🚀 Onboarding
- Flux 5 étapes : Bienvenue / Localisation / Configuration / Premier produit / Prêt
- Types de commerce : retail / wholesale / restaurant / service
- i18n 4 langues, `localStorage 'habashop_onboarded'`
- Signup → redirection vers `/onboarding`

### 💸 Pricing
- 3 plans : Starter (9 900 F/mois) · Pro (24 900) · Enterprise (49 900)
- Page `/pricing` publique, bascule mensuel/annuel, prix selon devise

### 🤖 IA & WhatsApp
- Assistant IA (Claude via Anthropic SDK) : `POST /api/ai/analyze`, `POST /api/ai/chat`
- WhatsApp (Twilio) : `broadcast`, `send-alert`, `send-ticket`, résumés programmés

### 🧪 Tests
- Frontend : **22 tests** Vitest (`currency`, `pagination`, `i18n`)
- Backend : **8 tests** Vitest (`auth` — login/register/JWT/isolation)

### 📱 PWA
- `manifest.json` + Service Worker (`vite-plugin-pwa`), installable

## [1.0.0] — 2026-05-24 — MVP

- POS / caisse, gestion stock & produits
- Clients & fournisseurs, commandes
- Employés, primes, historique salaires, dépenses
- Rapports de base
- Auth JWT
- Déploiement Railway (backend + PostgreSQL) + Vercel (frontend)

---

## 🛣️ Roadmap (non implémenté)

- **Super-Admin : activer/désactiver une boutique, changer le plan depuis la table** — le champ `isActive` existe désormais, mais les routes/boutons ne sont pas câblés.
- **Validation automatique des paiements** via Wave Business API / Orange Money API (aujourd'hui : validation manuelle prévue côté super-admin).
- **Email transactionnel** (Mailgun / SendGrid), **notifications push mobile**, **mode offline avancé**.
- **Auto-déploiement** Railway/Vercel sur push (actuellement déclenchement manuel).
