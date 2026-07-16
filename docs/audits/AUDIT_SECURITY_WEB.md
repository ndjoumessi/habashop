# Audit sécurité Web — HabaShop (Agent B)

Date : 2026-06-10 · Périmètre : `apps/backend` (Fastify+Prisma) + `apps/frontend` (React+Vite). Lecture seule, aucune modification de code ni de DB.

## Synthèse

| Sévérité | Nb | Dont nouveaux |
|----------|----|----|
| P0 | 0 | 0 |
| P1 | 2 | 2 |
| P2 | 3 | 3 |
| P3 | 5 | 4 |

Constat global : l'isolation `tenantId` est **solide et cohérente** sur l'ensemble des routes métier (le scope vient toujours du JWT, jamais du body ; les `update`/`delete` utilisent `where:{id,tenantId}` → P2025→404 sur accès cross-tenant). Le RBAC est correct sur les routes critiques (refund, ticket-Z, users, plan-requests, payroll). Les failles trouvées sont concentrées sur le **module WhatsApp** (routes d'abus sans RBAC ni scope) et quelques durcissements (échappement email, RBAC fidélité manuelle). **Aucune faille d'exfiltration cross-tenant ni d'escalade de privilège.**

Réconciliation : la dette CLAUDE.md « Wave webhook fail-OPEN en sandbox » **n'existe plus dans le code** — `verifyWaveWebhook` est désormais fail-CLOSED (`wave.ts:114 if (!secret) return false`), à parité avec Orange. Le résiduel est purement opérationnel (poser `WAVE_WEBHOOK_SECRET` / `ORANGE_MONEY_WEBHOOK_SECRET` sur Railway).

---

## P1 — Abus / DoS / coût (NOUVEAUX)

### P1-1 — Routes cron WhatsApp déclenchables par n'importe quel utilisateur, sur TOUS les tenants
**Fichier** : `apps/backend/src/routes/whatsapp.ts:771-779`
```ts
app.post('/api/whatsapp/test-evening', { preHandler: authenticate }, async () => {
  await sendEveningReport()      // itère prisma.tenant.findMany() → TOUS les tenants
  return { success: true, ... }
})
app.post('/api/whatsapp/test-morning', { preHandler: authenticate }, async () => {
  await sendMorningStockAlert()  // idem, TOUS les tenants
  return { success: true, ... }
})
```
**Impact** : `sendEveningReport`/`sendMorningStockAlert` (whatsapp.ts:542,592) bouclent sur `prisma.tenant.findMany()` (aucun scope) et envoient un WhatsApp à chaque `ownerPhone` via le compte Twilio **plateforme**. N'importe quel compte authentifié — y compris un CASHIER d'un tenant quelconque — peut déclencher un envoi de masse à tous les gérants à volonté : spam, épuisement du quota Twilio, coût direct. Aucune garde de rôle, aucun rate-limit.
**Fix** : restreindre à SUPER_ADMIN (`authenticateAdmin`) OU retirer ces routes de test en prod (`NODE_ENV !== 'production'`, comme `/api/admin/test-email`). Ajouter un `config.rateLimit`.

### P1-2 — `broadcast` / `send-alert` WhatsApp : envoi vers numéros arbitraires sans RBAC ni scope tenant
**Fichier** : `apps/backend/src/routes/whatsapp.ts:782-813` (broadcast) et `740-768` (send-alert)
```ts
app.post('/api/whatsapp/broadcast', { preHandler: authenticate }, async (request, reply) => {
  const { phones, message } = request.body  // jusqu'à 20 numéros LIBRES
  ...client.messages.create({ from: TWILIO_FROM, to: `whatsapp:${formattedPhone}`, body: message })
```
**Impact** : tout compte authentifié (toute boutique, tout rôle) peut envoyer des messages WhatsApp arbitraires à des numéros arbitraires via le Twilio plateforme. Vecteur de spam / phishing « depuis » le numéro officiel HabaShop + coût. Le contenu et les destinataires ne sont liés à aucune donnée du tenant. `send-alert` accepte de même un `phone` libre.
**Fix** : au minimum réserver à ADMIN/MANAGER, ajouter un rate-limit dédié, tracer l'émetteur (audit log). Idéalement valider que les numéros appartiennent à des clients du tenant appelant.

---

## P2 — Durcissement (NOUVEAUX)

### P2-1 — HTML injection dans les emails transactionnels (échappement incohérent)
**Fichier** : `apps/backend/src/services/email.ts` — lignes 108-109, 127, 164-165, 191, 223-224, 285-288, 306, 346-347, et `subject` 254/379.
```ts
// welcome / trial / upgrade / expired : INTERPOLATION BRUTE
<h1>Bienvenue sur HabaShop, ${firstName} ! 🎉</h1>
<p>Votre boutique <strong>${shopName}</strong> est prête.
```
`escHtml()` existe (email.ts:385) et est appliqué ailleurs (alerte stock `${eShop}` l.426, invitation `${eFirst}` l.503, récap paie l.671) — mais **PAS** dans welcome, trialReminder7/3, upgradeConfirmation, trialExpired. `shopName`/`ownerName` sont saisis à l'inscription **publique** (`/api/auth/register`, rate-limit 5/h) sans sanitization.
**Impact** : un `shopName` du type `<img src=x onerror=...>` est injecté tel quel dans le HTML de l'email. Impact réel limité (la plupart de ces emails reviennent à l'admin du tenant lui-même, les clients mail neutralisent souvent le JS), mais c'est une vraie HTML injection et l'incohérence est un piège (un champ relayé vers un destinataire tiers = XSS email).
**Fix** : passer tous les `${firstName}`/`${shopName}`/`${ownerName}`/`${planLabel}` par `escHtml()` comme dans les autres templates.

### P2-2 — Ajustement manuel de points fidélité sans RBAC
**Fichier** : `apps/backend/src/routes/customers.ts` — `POST /api/customers/:id/loyalty` (dernier handler)
```ts
app.post('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
  const { points } = request.body  // n'importe quel entier non nul
  ... loyaltyPoints: { increment: points }
```
**Impact** : tout rôle authentifié (y compris CASHIER) peut créditer arbitrairement des points fidélité à un client de son tenant. Les points pilotent les paliers Bronze/Silver/Gold → **remises automatiques** (plafond combiné 50% du total, cf. sales.ts loyalty v2). Un caissier peut s'octroyer des remises via un client complice. Scope tenant OK, mais pas de séparation de responsabilité.
**Fix** : réserver l'ajustement manuel à ADMIN/MANAGER (même logique que `canRefund`).

### P2-3 — Fuites de messages d'erreur internes dans les réponses 500
**Fichiers** : `customers.ts` (`details: err.message`, `reply.code(500).send({ error: err.message })`), `products.ts:81` (`details: err.message`), `employees.ts:45,80,91`, `hr.ts`, `ai.ts` (`details: err.message`). Le `setErrorHandler` global (server.ts:155) renvoie aussi `error.message`.
**Impact** : messages Prisma/Node bruts (noms de colonnes, contraintes) renvoyés au client → fingerprinting de schéma.
**Fix** : en production, message générique au client + détail loggé serveur (Sentry).

---

## P3 — Mineur / informationnel

### P3-1 (NOUVEAU) — `GET /api/whatsapp/test` sans authentification
`whatsapp.ts:728` — expose l'état Twilio, le numéro `from`, la version SDK. Fix : ajouter `preHandler: authenticate` ou retirer en prod.

### P3-2 (NOUVEAU) — Garde « self-only » des demandes de congé inopérante
`leaveRequests.ts:570` compare `b.employeeId` (id **Employee**) à `request.user.userId` (id **User**) — entités distinctes qui ne coïncident jamais. La garde ne protège rien (et bloque tout non-approbateur). Bug fonctionnel à saveur sécurité. Fix : résoudre l'Employee lié au User avant comparaison.

### P3-3 (NOUVEAU) — JWT 7 jours, stateless, non révocable individuellement
`auth.ts:39`/`100` — `expiresIn: '7d'`, HS256. Atténué par `isUserActive` (~30 s cache, authenticate.ts:18 + wsAuth) qui rejette les comptes supprimés/désactivés. Pas de blacklist (un changement de mdp n'invalide pas les JWT émis). Acceptable ; envisager un `tokenVersion` côté User.

### P3-4 (NOUVEAU) — `react-router` open-redirect (dépendance PROD)
`npm audit --omit=dev` : `react-router` 6.7.0–6.30.3, moderate, open redirect via URL protocol-relative (`//`). Seule vuln runtime restante. Fix : bump vers 6.30.x patché.

### P3-5 (déjà connu — CLAUDE.md) — Secrets webhook paiement à poser sur Railway
`WAVE_WEBHOOK_SECRET` / `ORANGE_MONEY_WEBHOOK_SECRET`. Réconciliation : le code est fail-CLOSED des deux côtés (`wave.ts:114`, `orangeMoney.ts:26`) → sans secret, tous les webhooks sont rejetés (401). Ce n'est plus un fail-open mais une condition d'activation. Poser les secrets puis vérifier qu'une signature invalide → 401.

---

## npm audit (high/critical uniquement)

- **Full (dev inclus)** : 3 critical, 6 moderate. Les 3 critical sont **DEV-only** : `vitest` + `@vitest/coverage-v8` (chaîne vite/vite-node) et `shell-quote` (transitif de `concurrently`). Aucun embarqué dans le runtime serveur.
- **Production (`--omit=dev`)** : **0 critical / 0 high**, 2 moderate (`react-router`/`react-router-dom`, cf. P3-4).
- **Fix** : les critical dev exigent un bump majeur vitest/vite (déjà dette CLAUDE.md) — pas de fix sans upgrade majeur, sans impact prod. Différable.

---

## Vérifications passées au vert (pas de finding)

- **Isolation tenantId** : toutes les routes métier scopent via `request.user.tenantId`/`request.tenantId` (JWT). Les `update`/`delete` Prisma utilisent `where:{id, tenantId}` → cross-tenant = P2025 → 404 (server.ts:147). Les anciennes `findUnique({where:{id}})` ont été remplacées par `findFirst({where:{id, tenantId}})`.
- **Champs sensibles** : `passwordHash`/`twoFASecret` systématiquement strippés (tenant.ts:166,211,247,277,302). `/api/public/catalog/:slug` (public.ts) utilise des `select` explicites (pas de buyPrice/marge/email). `/api/auth/me` et login ne renvoient jamais le hash.
- **RBAC critique** : refund (sales.ts:230), ticket-Z (ticketZ.ts:23), users CRUD (`requireAdmin`), plan-requests (`authenticateAdmin`/SUPER_ADMIN), payroll-report (admin + scope tenant), accounting report (ADMIN/MANAGER/ACCOUNTANT), attendance/shifts/leave écriture (WRITE_ROLES). Cohérents avec ROLE_PERMISSIONS.
- **Webhooks paiement** : HMAC-SHA256 timing-safe sur raw body, fail-closed, validation montant/devise/référence contre le record, idempotence, activation depuis le RECORD jamais le payload (payments.ts:45-303).
- **XSS frontend** : aucun `dangerouslySetInnerHTML`/`innerHTML`/`insertAdjacentHTML` dans `apps/frontend/src`.
- **Secrets hardcodés** : aucun. Tous via `process.env`. `JWT_SECRET`/`DATABASE_URL` requis au boot (server.ts:51, exit si absent).
- **CORS / Helmet** : allowlist stricte (Vercel + FRONTEND_URL + localhost dev), Helmet (HSTS, frameguard), `trustProxy:true` correct derrière Railway.
