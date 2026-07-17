# Audit approfondi HabaShop — Sécurité / Archi / Code / UX

> Date : 2026-07-17 · Périmètre : monorepo **PUBLIC** `ndjoumessi/habashop`
> (`apps/frontend` React/Vite · `apps/backend` Fastify+Prisma+PostgreSQL multitenant · `mobile/` Expo).
> Baseline : `docs/audits/AUDIT_SECURITY_WEB.md`, `AUDIT_TECHNIQUE.md`, etc. — ce rapport les approfondit et corrige le brief initial.
> **Aucune action destructive (purge historique, rotation, migration) n'a été exécutée.** Ce document est un plan à valider item par item.

---

## Synthèse dirigeante

| # | Item | Sévérité | Verdict |
|---|---|---|---|
| P0.1 | Secrets commités dans l'historique d'un repo public | 🔴 **Critique** | `JWT_SECRET` + `TWILIO_AUTH_TOKEN` **toujours actifs** ; Anthropic déjà morte ; DB déjà migrée |
| P0.2 | Isolation tenant (defense-in-depth Prisma) | 🟢 **Sain** | 0 fuite cross-tenant exploitable ; 2 near-miss faibles (W1, W2) |
| P1.3 | Clé Google Maps exposée | 🟡 Moyen | Clé `VITE_` publique par nature → restreindre par referrer (Google Cloud) |
| P1.4 | `npm audit` high/moderate | 🟡 Moyen | 5 high au total, **tous corrigeables sans breaking change** |
| P1.5 | « HMAC fidélité » | 🟢 N/A | **Le brief est faux** : pas de token signé, QR = ID client en clair, sécurité portée par JWT+tenant |
| P1.6 | Validation d'entrée des routes | 🟠 **Élevé** | **~155 routes, 0 schéma déclaratif** ; rate-limit non global ; `bodyLimit` absent |
| P2.7 | TypeScript `strict` | 🟡 Moyen | `strict:false` partout ; ~746 `any` (180 back + 566 front) |
| P2.8 | Couverture de tests sécurité | 🟡 Moyen | Manque une suite d'isolation cross-tenant end-to-end |
| P3 | UX POS / fidélité / onboarding | ⚪ Après sécu | Recos progressive-disclosure, offline-first |

**Le vrai risque n'est pas là où le brief le pointait.** Les webhooks paiement sont bien faits (HMAC + `timingSafeEqual` + fail-closed partout, Wave inclus). L'isolation tenant tient. Les deux urgences réelles sont : (1) **des secrets encore vivants dans l'historique public**, (2) **l'absence totale de validation déclarative** sur les routes d'écriture/monétaires.

---

## P0.1 — Secrets exposés dans l'historique git (repo PUBLIC)

`apps/backend/.env` a été commité puis supprimé. Fichier introduit en `67a3e16a`, modifié en `0e2a9f9b`/`e3b4c1b4`/`69ae1f16`, **supprimé en `436664eb`** — mais **toujours présent dans l'historique**, donc lisible par quiconque clone le repo.

### Inventaire (NOMS uniquement — aucune valeur reproduite)

| Secret | Commits | État vérifié | Rotation |
|---|---|---|---|
| `JWT_SECRET` | `0e2a9f9b`, `e3b4c1b4`, `69ae1f16` | **hash identique au `.env` local** → très probablement toujours en prod | 🔴 **URGENT** — permet de forger le JWT de n'importe quel user/tenant (TTL 7 j, pas de révocation) |
| `TWILIO_AUTH_TOKEN` (+ `ACCOUNT_SID`, `WHATSAPP_FROM`) | `69ae1f16` | **hash identique au `.env` local** | 🔴 abus du compte Twilio (SMS/WhatsApp facturés) |
| `ANTHROPIC_API_KEY` | `69ae1f16` | **déjà invalide** (test API → HTTP 401) | 🟢 déjà neutralisée ; révoquer pour la forme |
| `DATABASE_URL` | `0e2a9f9b`, `e3b4c1b4`, `69ae1f16` | hôte `yamanote.proxy.rlwy.net` → **déjà changé** (actuel `thomas.proxy…`) | 🟡 confirmer que l'ancienne base Railway est bien détruite |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `REDIS_URL` / `JWT_REFRESH_SECRET` | `67a3e16a` | valeurs localhost/dev (MinIO local) | 🟡 faible, mais à purger de l'historique |
| `OWNER_PHONE` | `e3b4c1b4`, `69ae1f16` | numéro personnel | 🟡 PII |

**Périmètre réduit — bonne nouvelle** : les secrets **paiement (Wave, Orange Money, Campay, PayDunya) n'ont JAMAIS été commités**. Ils n'apparaissent que dans `.env.example` (noms seulement), ajoutés **après** la suppression du `.env` réel. La rotation urgente se limite donc à **JWT + Twilio**.

### Checklist de rotation (action manuelle de Nelson — je ne tourne rien)

1. **`JWT_SECRET`** (Railway → backend → Variables) : générer `openssl rand -base64 48`, remplacer, redéployer. ⚠️ **Effet de bord** : invalide toutes les sessions → tous les utilisateurs sont déconnectés (acceptable, à faire hors heure de pointe).
2. **Twilio** (console.twilio.com → Account → Auth Token → *Secondary → Promote*) : rotation à deux temps pour ne rien casser, puis mettre à jour `TWILIO_AUTH_TOKEN` sur Railway.
3. **Anthropic** (console.anthropic.com → API Keys) : révoquer l'ancienne (déjà 401) par hygiène.
4. **Railway DB** : confirmer que l'instance `yamanote.proxy.rlwy.net:10839` est supprimée (dashboard Railway → projet → base retirée).
5. Après rotation → **purge d'historique** (ci-dessous) pour que les valeurs mortes ne restent pas indexées/clonables.

### Purge d'historique — ⚠️ DESTRUCTIF, à ne lancer qu'après accord explicite

- **Prérequis** : backup complet du repo (`git clone --mirror`), prévenir les collaborateurs (tout clone/fork existant garde les secrets), rotation faite AVANT.
- **Outil recommandé** : `git filter-repo --path apps/backend/.env --invert-paths` (plus sûr et rapide que BFG ; installer via `brew install git-filter-repo`).
- Puis `git push --force --all` + `git push --force --tags`. Réécrit l'historique → **casse tous les forks/clones/PR ouvertes**.
- Alternative moins invasive si la purge est jugée trop risquée : considérer les secrets comme définitivement brûlés (rotation faite) et **ne pas** réécrire l'historique. La rotation seule neutralise le risque d'exploitation ; la purge ne fait que retirer les valeurs déjà mortes de la vue publique.
- Renforcer `.gitignore` : déjà correct (`.env` ignoré, seul `apps/frontend/.env.production` volontairement tracké). Ajouter un hook `pre-commit` (gitleaks) pour prévenir les récidives.

---

## P0.2 — Isolation tenant (defense-in-depth Prisma)

**~230 requêtes Prisma auditées** (35 fichiers), **0 `$queryRaw`/`$executeRaw`**. Mécanisme : `authenticate.ts` pose `request.tenantId = activeTenantId` et renvoie `400 NO_ACTIVE_TENANT` sur toute route métier sans boutique active. Pattern dominant et **sûr** : `findFirst({where:{id, tenantId}})` (404 sinon) puis `update/delete({where:{id}})`.

### Résultat : aucune fuite cross-tenant (catégorie A) exploitable

Les ~60 requêtes « sans tenantId visible » de la baseline sont **toutes** soit indirectement protégées (chaîne vérifiée), soit des routes super-admin/webhook intentionnelles. **2 faiblesses de faible gravité** seulement :

| # | Fichier:ligne | Nature | Correctif |
|---|---|---|---|
| **W1** | `routes/stockTransfers.ts:102-105` (confirm) | **Oracle d'existence** : `findUnique({where:{id}})` puis check statut (l.104) **avant** check tenant (l.105) → un manager tiers distingue 404 / 400 « déjà traité » / 403. Aucune donnée renvoyée. | Placer le check `toTenantId !== tenantId` **en premier**, avant toute divulgation de statut. |
| **W2** | `routes/whatsapp.ts:153` (`send-ticket`) | Utilise `request.user.tenantId` (tenant **principal** du JWT) au lieu de `request.tenantId` (tenant **actif**) → reçu WhatsApp brandé avec la mauvaise boutique en multi-boutiques. **Pas une fuite.** | Remplacer par `request.tenantId`. |

### StockTransfer (modèle sans `tenantId`)

Porte `fromTenantId` + `toTenantId` (2 FK Tenant) + `productId`. Isolation prouvée par les **deux FK boutique**, pas par un champ unique :
- Création : `fromTenantId = request.tenantId`, garde `userHasTenant(userId, toTenantId)`, produit `findFirst{id, tenantId: fromTenantId}`, décrément `updateMany{id, tenantId, stockQty>=qty}` — **sûr**.
- Liste : `OR:[{fromTenantId:tenantId},{toTenantId:tenantId}]` — **sûr**.
- Confirm/Cancel : gardes 403 explicites — **sûrs** (sauf l'ordre W1 sur confirm).
- Tests présents : `stockTransfers.test.ts` (source-confirme→403, tierce-annule→403, dest non autorisée→403).

### Proposition defense-in-depth (extension Prisma)

Aujourd'hui chaque handler ajoute le filtre à la main — robuste mais **1 oubli = 1 fuite**. Filet de sécurité recommandé :

```ts
// src/db.ts — AsyncLocalStorage lié à request.tenantId (posé dans authenticate.ts)
import { AsyncLocalStorage } from 'node:async_hooks'
export const tenantCtx = new AsyncLocalStorage<{ tenantId: string }>()

const TENANT_MODELS = new Set(['Product','Sale','Customer','Supplier','PurchaseOrder',
  'Employee','Attendance','Shift','LeaveRequest','Expense','Goal','Subscription',
  'Campaign','TicketZ','LoyaltyTransaction','EmployeeBonus','SalaryHistory','PushToken','AuditLog'])

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = tenantCtx.getStore()
        // AVANT : where sans tenantId → risque si un handler oublie le filtre.
        // APRÈS : injection auto sur les modèles tenant-scopés, en lecture/màj/suppression.
        if (ctx && model && TENANT_MODELS.has(model) &&
            /^(findMany|findFirst|updateMany|deleteMany|count|aggregate|groupBy)$/.test(operation)) {
          args.where = { ...(args.where ?? {}), tenantId: ctx.tenantId }
        }
        return query(args)
      },
    },
  },
})
```

- **Bénéfice** : même si un futur handler oublie `where:{tenantId}`, l'extension le rajoute. Les routes super-admin (`admin.ts`) et webhooks utilisent un client **non étendu** (`basePrisma`) explicite.
- **Effort** : moyen (migration progressive, un modèle à la fois, tests d'isolation à chaque étape). `findUnique`/`create` restent gérés à la main (Prisma n'autorise pas `tenantId` non-unique dans un `findUnique`).
- **Régression possible** : les routes cross-tenant légitimes (dashboard consolidé, invite, switch-tenant) doivent explicitement sortir du contexte → à tester en priorité.

### Tests d'isolation manquants

`multiTenant.test.ts` couvre la frontière d'auth (login/switch-tenant/dashboard), **pas** l'accès direct par `:id` à une ressource d'un autre tenant. Les autres tests mockent Prisma → ne valident pas le filtrage SQL réel. **Recommandation** : suite paramétrée « tenant A demande un id du tenant B → 404 » sur products, customers, suppliers, orders, sales/refund, sales/invoice, goals, subscriptions, shifts, attendance, leaveRequests, salary-history, employees, expenses (nécessite une DB de test réelle ou des mocks simulant `where.tenantId`).

---

## P1.3 — Clé Google Maps

`VITE_GOOGLE_MAPS_KEY` est une clé **client** : embarquée dans le bundle JS livré au navigateur **par conception**. La retirer du `.env` tracké ne la cache pas (elle est dans le build). Utilisée dans `customersShared.tsx:114`, `AddressAutocomplete*.tsx`, `CustomerMap.tsx`.

**Correctif réel** (Google Cloud Console, action manuelle) :
1. APIs & Services → Credentials → cette clé → **Application restrictions → HTTP referrers** : `https://habashop.vercel.app/*`, `https://*.vercel.app/*` (previews), `http://localhost:*/*` (dev).
2. **API restrictions** : limiter à Maps JavaScript API + Places API + Geocoding (ce que l'app utilise réellement).
3. Poser des **quotas** journaliers pour plafonner l'abus.
4. Optionnel : générer une 2ᵉ clé dédiée dev/preview pour ne pas exposer la clé prod en preview.

---

## P1.4 — `npm audit`

**Tous les correctifs sont non-breaking (`fix: true`).**

| Package | Sévérité | Vuln principale |
|---|---|---|
| `undici` | high | bypass validation TLS (SOCKS5), injection header, DoS WebSocket, poisoning cache |
| `form-data` | high | injection CRLF via noms de champs multipart |
| `hono` (frontend) | high | — |
| chaîne `@opentelemetry/*`, `@sentry/node` | moderate | DoS allocation mémoire (W3C Baggage) |
| `js-yaml` | moderate | DoS complexité quadratique (merge keys) |
| `esbuild` | low | lecture fichier arbitraire (dev server, Windows) |

**Stratégie** : `npm audit fix` (sans `--force`) sur `apps/backend` puis `apps/frontend`, `npm run build` + `vitest run` + suite E2E chromium pour prouver l'absence de régression. Une PR par package/lot.

---

## P1.5 — « HMAC fidélité » : le brief est factuellement faux

**Il n'existe aucun token QR signé HMAC.** Le QR de fidélité est un identifiant client **en clair** :

```
HABA-CUST:<customerId>   // customerId = cuid Prisma, PAS un secret
```

- Généré côté client : `frontend/…/LoyaltyCardDigital.tsx:42`, `mobile/…/LoyaltyCardDigital.tsx:48`.
- Consommé : scan → `parseScannedCustomerId()` (`POSCustomerSelector.tsx:27`) → `GET /api/customers/:id` (protégé `authenticate` + scope `tenantId`).
- `src/lib/loyalty.ts` = **fonctions pures** (points, paliers, remises). Zéro crypto.

**Le QR ne crédite ni ne dépense rien** : il ne fait que *sélectionner* un client. Les points sont calculés autoritairement par le backend à la vente (`sales.ts:180-195`), idempotence via `@@unique([tenantId, idempotencyKey])`. Donc :

| Critère | Verdict |
|---|---|
| (a) Expiration | Sans objet (ID permanent, pas de token) |
| (b) Anti-rejeu | Sans objet (rescanner ne crédite rien — comportement voulu d'une carte permanente) |
| (c) `timingSafeEqual` | Sans objet côté fidélité (résolution = `findFirst{id, tenantId}`) |
| (d) Clé / rotation | Sans objet (aucune clé dans le QR) |
| (e) Tenant dans le payload | Non — mais **rattrapé serveur** : `findFirst{id, tenantId}` → 404 si le QR du tenant A est scanné chez B |

**Recommandation : ne PAS ajouter de HMAC.** Ce serait de la complexité sans bénéfice — la conception actuelle est saine. N'introduire signature + jti + expiration + tenant + marquage DB anti-rejeu **que si** un jour le QR doit porter une *valeur consommable* (coupon, crédit). Seul risque résiduel : un caissier du **même tenant** peut lier un mauvais client de sa propre boutique (abus interne mineur, pas de fuite). Documenter que le QR est un sélecteur, pas un secret.

### Crypto applicative (bonus) — état sain

- Mots de passe : **bcryptjs coût 12** (correct).
- Refs/anonymisation : `crypto.randomUUID()` (usage non-sécuritaire, OK).
- Webhooks paiement : SHA-256/512 + `timingSafeEqual` + **fail-closed partout, Wave inclus** (`wave.ts:114` : `if (!secret) return false` — la note « fail-open » du CLAUDE.md est **obsolète**, le code est corrigé ; reste à poser `WAVE_WEBHOOK_SECRET` en prod).
- EAN-13 GS1 : généré **côté frontend** (`StockModals.tsx:38`, JsBarcode) — rien à durcir côté backend.
- **Manque fonctionnel** : pas de flux forgot/reset-password (changement de mdp = POST authentifié avec `currentPassword`). JWT TTL **7 j sans révocation ni kid** → dette à traiter avec la rotation P0.

---

## P1.6 — Validation d'entrée des routes Fastify (🟠 le vrai gros trou)

- **~155 routes, 0 schéma de validation déclaratif.** Aucun `schema:{body/params/querystring}`, aucun zod, aucun typebox. Validation 100 % manuelle et inconstante (`if (!amount)…`), champs partant directement vers Prisma sans contrôle de format/longueur/bornes.
- **Rate-limit non global** : `@fastify/rate-limit` enregistré avec `global:false` → seules **~12 routes** le déclarent (login, register, checkouts…). Ventes, produits, exports, IA, reports… **sans rate-limit**.
- **`bodyLimit` absent** → défaut 1 MB (multipart borné à 10 MB). À fixer explicitement.
- CORS ✅ (allowlist + credentials), Helmet ✅ (CSP off assumée pour API JSON), JWT obligatoire au boot ✅, `trustProxy:true` ✅.
- Error handler renvoie `error.message` au client (à surveiller — fuite d'info potentielle).

### Routes critiques sans validation (extrait — écriture/argent/auth)

`POST /api/sales` (`sales.ts:35`), `POST /api/sales/:id/refund` (`:258`), tous les `POST /api/payments/*` (mtn/campay/paydunya/wave/orange), `POST /api/admin/payroll-report/run`, `POST /api/bonuses`, `POST /api/salary-history`, auth login/register/switch-tenant/password, + toutes les mutations produits/clients/commandes/fournisseurs/employés/dépenses/objectifs/abonnements/transferts/tenant.

### Stratégie (quick win à fort ROI)

1. Adopter **zod** (ou TypeBox pour rester natif Fastify+fast-json-stringify) et ajouter `schema.body/params/querystring` route par route, en commençant par argent → auth → écriture DB.
2. Valider systématiquement les `:id` (format cuid) en `params`.
3. Passer `@fastify/rate-limit` en `global:true` avec un plafond par défaut, + overrides plus stricts sur login/paiement.
4. Fixer un `bodyLimit` explicite (ex. 512 KB hors multipart).
5. **Régression** : le typage strict des bodies peut rejeter des payloads que le frontend envoyait « en trop » → dérouler par lots avec E2E vert à chaque PR.

---

## P2.7 — TypeScript `strict`

`strict:false` sur backend + frontend. **~746 `any`** (180 back, 566 front). Chantier progressif, une PR isolée par étape, `tsc` vert à chaque fois :
1. Activer `strict` package par package via des overrides, ou activer les flags un par un (`noImplicitAny` → `strictNullChecks` → …).
2. Consolider les types partagés front/back (dossier `packages/shared` ou types dérivés de Prisma/zod).
3. Prioriser les modules argent/tenant/auth.

## P2.8 — Tests

Compléter : suite d'isolation cross-tenant (cf. P0.2), tests de validation (rejet des payloads malformés une fois les schémas posés), garder l'E2E `e2e-tenant` vert. Ne pas casser les tests d'idempotence/paiement existants.

---

## P3 — UX (après la sécurité)

À dérouler une fois P0/P1 traités. Cohérent avec le design system NKONI (Geist, logo Sac+H, thèmes Sombre/Clair/Système).
- **POS** : densité terrain, gros boutons tactiles, offline-first (file d'attente de ventes + resync), scan client (QR = sélecteur) et produit (EAN-13) au même endroit, feedback sonore/haptique.
- **Fidélité** : rendre lisible « points → palier → remise » au moment de l'encaissement (progressive disclosure), carte digitale déjà présente.
- **Onboarding tenant** : assistant multi-étapes (boutique → devise → 1er produit → 1er utilisateur), valeurs par défaut sensées, pas de mur de formulaire.
- Livrables : wireframes + composants React/RN concrets par écran clé.

---

## Plan d'exécution proposé (à valider item par item)

| Ordre | Item | Effort | Régression | Destructif ? |
|---|---|---|---|---|
| 1 | Rotation JWT + Twilio (Nelson, dashboards) | faible | déconnexion de tous les users | non (mais impact users) |
| 2 | `npm audit fix` back + front (PR + E2E) | faible | faible (non-breaking) | non |
| 3 | Restriction clé Google Maps (Nelson, GCP) | faible | nulle | non |
| 4 | Fix W1 (ordre gardes stockTransfers) + W2 (whatsapp tenant) | faible | faible | non |
| 5 | Rate-limit global + `bodyLimit` | faible | à tester (limites) | non |
| 6 | Schémas de validation zod (argent → auth → écriture) | moyen/élevé | moyenne | non |
| 7 | Suite de tests isolation cross-tenant | moyen | nulle | non |
| 8 | Extension Prisma tenant (defense-in-depth) | moyen | moyenne | non |
| 9 | Purge d'historique git (`git filter-repo`) | faible | **casse forks/clones** | 🔴 **OUI** — accord explicite + backup |
| 10 | `strict` TS progressif | élevé | faible/étape | non |
| 11 | Refonte UX POS / fidélité / onboarding | élevé | n/a | non |

**Rien de destructif ne sera lancé sans accord explicite, étape par étape.** La purge d'historique (item 9) n'a de sens qu'**après** la rotation (items 1) et avec un backup.
