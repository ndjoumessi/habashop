# Remédiation de l'audit de sécurité de juillet 2026 — le compte rendu

> **Les règles qui survivent à ce chantier vivent dans `CLAUDE.md` § Sécurité.** Cette page
> est le JOURNAL : ce qui a été trouvé, ce qui a été posé, et le détail d'implémentation
> qu'on relit une fois — quand on touche la surface concernée, pas à chaque session.
> Audit d'origine : `docs/audits/AUDIT_APPROFONDI_2026-07.md`.

## P1.6 — le handler d'erreur rendait le message brut

`lib/errorHandler.ts`, extrait de `server.ts` pour être testable. Un **≥500 ne renvoie plus
`error.message`** au client : les messages Prisma/DB nomment des tables, des colonnes et des
contraintes. Message générique « Erreur serveur » ; le vrai message reste journalisé (log +
Sentry). Les 4xx **intentionnels** gardent le leur — zod→400, P2025→404, framework
413/415/429 — parce qu'ils sont écrits pour l'appelant. Verrou `errorHandler.test.ts`,
sabotage vérifié.

## Item 6 — validation déclarative zod

`app.setValidatorCompiler(validatorCompiler)` global dans `server.ts`. **Seul le validator,
PAS le serializer** : les réponses sont inchangées, et une route sans `schema` se comporte
exactement comme avant.

Schémas `body` / `params` / `querystring` posés sur :

- **argent** — sales, payments *, payroll ;
- **auth** — login, register, switch-tenant, password ;
- **écritures** — products, customers, suppliers, orders, employees, expenses, goals,
  subscriptions, stockTransfers.

Erreurs zod → **400 `{ error, code:'VALIDATION' }`** via le handler global. Les règles
MÉTIER (nom requis, `total < 0`, MSISDN, force du mot de passe) **restent dans les
handlers**, avec leurs messages d'origine : les faire remonter dans le schéma aurait
remplacé des messages écrits pour un commerçant par des messages écrits pour un
développeur. Schémas d'écriture mutualisés dans `src/schemas/writesB.ts`.

## Anti mass-assignment

`PUT /products/:id`, `POST|PUT /suppliers`, `POST|PUT /expenses` passaient le corps **BRUT**
à Prisma. Un `tenantId` injecté dans le corps réassignait donc la ressource à une autre
boutique. Les schémas UPDATE sont désormais une **liste blanche stricte** (`strip`) : toute
clé hors modèle — `tenantId`, `id`, horodatages, `sku` — est supprimée avant d'atteindre
Prisma. À la création, `tenantId` est imposé par le serveur.

## W1 et W2 — deux fuites d'oracle

- **W1** (`stockTransfers.ts` confirm/cancel) : le scope tenant s'évalue **avant**
  l'existence et le statut, donc un tiers reçoit un **404 uniforme** au lieu d'un 403 qui
  lui apprendrait que la ressource existe. La boutique SOURCE garde son 403 sur `/confirm` —
  elle a le droit de savoir.
- **W2** (`whatsapp.ts` send-ticket) : le reçu était brandé avec `request.user.tenantId`
  (boutique du JWT) au lieu de `request.tenantId` (boutique ACTIVE). Un gérant multi-boutiques
  envoyait un reçu au nom de la mauvaise enseigne.

## Item 5 — rate-limit global

`@fastify/rate-limit` en `global: true`, 300/min par IP (`RATE_LIMIT_MAX`). Les overrides
plus stricts sont conservés (auth, checkouts, paiements). **Exemptés** (`config.rateLimit:
false`) : webhooks/IPN de paiement — un prestataire qui rejoue ne doit pas être bloqué — et
les health checks. `bodyLimit` explicite à **4 Mo** pour les photos d'employé en base64 ; le
multipart OCR (10 Mo) n'est pas concerné.

## Item 7 — isolation cross-tenant, prouvée

`tenantIsolation.test.ts` monte un mock Prisma *tenant-aware* et prouve qu'un tenant B
reçoit 404 et n'obtient **aucune mutation** sur les ressources d'un tenant A. Effet de bord
du chantier : `PUT /customers/:id` rendait 500 sur P2025, il rend 404.

## Item 8 — extension Prisma par tenant (defense-in-depth)

`src/db.ts` exporte deux clients :

- **`prisma`** — étendu par `$extends`, auto-injecte `tenantId` sur les 19 modèles scopés
  **si absent** ; n'écrase jamais un `tenantId` explicite ;
- **`basePrisma`** — non étendu, pour le cross-tenant LÉGITIME (tableau de bord consolidé,
  purge de jetons push par valeur exacte).

Le contexte passe par un ALS (`src/lib/tenantContext.ts`), établi par un hook **`onRequest`**
(`initTenantStore`) puis renseigné par `authenticate` (`bindActiveTenant`).

⚠️ **Pourquoi `onRequest` et pas le preHandler** : `enterWith` appelé dans un preHandler,
donc APRÈS un `await`, ne remonte pas jusqu'au handler. Le contexte existait et était vide.

**Durci (#35)** — les ÉCRITURES `create` / `createMany` / `upsert` sont gardées :
`tenantId` absent → injecté ; présent et **différent** du contexte → `TenantScopeMismatchError`
(403). Jamais d'écrasement silencieux. En lecture, un `where.tenantId` explicite est respecté.

Les `findUnique` résiduels sur modèles scopés ont été convertis en `findFirst({ id, tenantId })` :
stockTransfers confirm/cancel (avec un `OR` source/destination), analytics, cron hebdomadaire.
`TicketZ` est conservé en `findUnique` — sa clé composite contient déjà `tenantId`.
`update` / `delete` par clé unique restent à la charge des handlers, et le filtrage manuel
existant est conservé.

**Comportement neutre** pour le code existant : tous les handlers filtraient déjà. C'est un
filet, pas un changement de contrat. `TxClient` (db.ts) type les `tx` du client étendu.
