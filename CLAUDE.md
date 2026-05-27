# CLAUDE.md — HabaShop

Guide pour Claude Code. Lis ce fichier en premier avant de bosser sur le repo.

## C'est quoi

SaaS de gestion commerciale multi-tenant pour boutiques/superettes (Afrique de l'Ouest & francophone, puis international). Monorepo npm workspaces.

- **`apps/frontend`** — React 18 + TypeScript + Vite, Zustand (state, persisté localStorage), React Router, Lucide icons, recharts. Déployé sur **Vercel**.
- **`apps/backend`** — Fastify + Prisma + PostgreSQL, Redis. Déployé sur **Railway**.
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, base XOF + conversion live) et multi-langues (fr/en/es/it).

## ⚠️ Pièges critiques (lis avant de lancer une commande)

1. **Node par défaut = v10 → casse tous les builds (tsc/vite/vercel).** Toujours préfixer par le Node 20 :
   ```bash
   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
   ```
   Mets ça en tête de chaque session shell qui build/test/déploie.

2. **`DATABASE_URL` pointe sur la DB PROD Railway** — il n'y a PAS de DB locale de dev. Ne lance JAMAIS `db:migrate`, `db:seed`, `migrate dev` sans confirmation explicite de Nelson.

3. **Git : commit directement sur `main`.** Pas de feature branch. Commit + push straight to main.

## Commandes

Toujours avec le PATH Node 20 (voir ci-dessus). Depuis `apps/frontend` :
```bash
npx tsc --noEmit        # typecheck — doit être 0 erreur
npm test                # vitest — 43 tests doivent passer
npm run build           # tsc && vite build
vercel --prod --yes     # déploiement prod frontend (alias → habashop.vercel.app)
```
Backend (`apps/backend`) : `npm run dev` (tsx watch), `npm run build` (tsc). Déploiement Railway : service `habashop` dans le projet `grateful-happiness` ; `railway up --ci` depuis la racine après `railway link`.

### Rituel de vérification avant CHAQUE commit
`tsc --noEmit` (0 erreur) → `npm test` (43/43) → `npm run build` (OK). Puis commit/push sur main, puis `vercel --prod` si frontend touché.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran (Dashboard, POS, Stock, Orders, Customers,
                 #   HR, Planning, Payroll, Goals, Expenses, Reports, Forecasts,
                 #   Users, Settings, Activity, Notifications, AIAssistant, APIDocs,
                 #   Integrations, AdminDashboard, UpgradePlan, PaymentCallback,
                 #   Onboarding, LandingPage, SignupPage, LoginPage, Marketing, Pricing, Privacy)
                 #   ⚠️ /privacy = route PUBLIQUE (hors auth, avant le catch-all) — URL exigée par Google Play, ne pas la passer sous ProtectedRoute
  components/    # par domaine : customers/ hr/ pos/ stock/ reports/ settings/
                 #   integrations/ layout/ (Header, Sidebar, AppLayout) ui/
                 #   → chaque domaine a souvent un `*Shared.tsx` (helpers + maps i18n)
  stores/        # appStore.ts (Zustand : lang, currency, tenant, caisse… persisté)
  hooks/         # useI18n.ts, usePagination.ts, useFormatAmount…
  i18n/index.ts  # dictionnaire t() : translations = { fr, en, es, it }, 575 clés
  utils/export.ts # génération CSV / PDF (factures, bulletins…)
```

## i18n — convention CRUCIALE (le projet est 100% fr/en/es/it)

Trois mécanismes coexistent ; **utilise celui déjà présent dans le fichier** :

1. **Helper `i(fr, en, es, it)`** via `useI18n()` (le standard pour le nouveau code) :
   ```ts
   import { useI18n } from '@/hooks/useI18n'
   const { i, lang, formatDate } = useI18n()
   <button>{i('Enregistrer', 'Save', 'Guardar', 'Salva')}</button>
   ```
2. **Ternaire inline 4-langues** (beaucoup de fichiers existants) — TOUJOURS les 4 :
   ```ts
   {lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : lang === 'it' ? 'Salva' : 'Enregistrer'}
   ```
   ⚠️ Ne JAMAIS laisser un ternaire binaire `lang === 'fr' ? fr : en` (es/it retomberaient en anglais).
3. **`t('key')`** (global, depuis appStore) — pioche dans `src/i18n/index.ts`. Fallback : `translations[lang]?.[key] ?? translations.fr[key] ?? key`. Si tu ajoutes une clé, ajoute-la dans **les 4 blocs** (fr/en/es/it).

Autres helpers utiles : `makeI(lang)` (settings), `pick(lang, obj)`.

**Pattern pour valeurs « data » traduites** (rôles, départements, statuts, catégories) : map `Record<string, Record<lang, string>>` + fonction `xxxLabel(value, lang)` qui **garde la valeur FR comme clé** (filtres/data) et ne traduit que l'affichage ; les valeurs custom passent en fallback. Exemples dans `components/hr/hrShared.tsx` (`roleLabel`, `deptLabel`, `contractLabel`, `attendStatusLabel`, `calcAnciennete(date, lang)`) et `components/pos/posShared.tsx`.

**`lang` est disponible partout, même avant login** (Zustand persisté, défaut `'fr'`). LandingPage a le sélecteur de langue.

**NE PAS traduire** : noms de marque (HabaShop, Wave, Orange Money, MTN, Railway, Vercel, Claude/Anthropic, WhatsApp), codes (XOF, EUR, FCFA…), enums/clés envoyés à l'API, noms de pays (valeurs data), dates au format numérique. Les PDF générés (`utils/export.ts`) et `pages/stubs.tsx` (code mort, non importé) sont hors périmètre i18n.

## Conventions de code

- Montants : `useFormatAmount()` (hook) ou `fmt()` — jamais de formatage manuel ; suit la devise du tenant.
- Icônes : **Lucide uniquement** (pas d'emoji comme icône UI), `cursor: pointer` + transitions sur les éléments cliquables.
- Champs d'icône typés `JSX.Element`.
- Pour éditer des chaînes multi-octets/emoji en masse, préférer un script Python à des `sed` fragiles.

## Specs prescriptives

Nelson fournit souvent des specs détaillées (ex : « lot N i18n »). Si une instruction du spec ne matche pas le code réel (numéro de lot déjà pris, fichier/string introuvable, ternaire déjà 4-langues), **réconcilie et continue** — ne bloque pas. Réserve les questions aux choix à fort enjeu / irréversibles (ex : élargir le périmètre à des milliers de lignes). Vérifie toujours qu'un fichier/flag mentionné existe encore avant de t'appuyer dessus.

## Historique récent

i18n complété en 8 lots (sept. 2024–mai 2026) : tout le texte d'interface (in-app + pages publiques/pré-login) est en fr/en/es/it. Détails dans `I18N_AUDIT.md` et le git log (`feat: i18n lot N`).
