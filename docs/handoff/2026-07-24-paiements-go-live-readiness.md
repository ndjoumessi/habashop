# Paiements — rapport de préparation go-live (audit LECTURE SEULE)

**Date** : 2026-07-24 · **Méthode** : lecture de code uniquement — aucune mutation, aucun
envoi, aucun basculement. Le flip du live reste le geste de Nelson (credentials + argent réel).

Providers : **Wave**, **Orange** (via PayDunya en prod), **Campay** (carte + mobile money CM),
**PayDunya** (SN/UEMOA), **MTN MoMo** (CM).

---

## ✅ Ce qui est PRÊT (vérifié)

### 1. Vérification de signature webhook — FAIL-CLOSED partout
- **Wave** (`services/wave.ts:112` `verifyWaveWebhook`) : `if (!secret) return false` + `if (!signature) return false` + `timingSafeEqual`. Sans `WAVE_WEBHOOK_SECRET` → rejet.
- **Campay** (`routes/campayPayment.ts:154-192`) : `if (!webhookKey) → 401` · signature manquante → 401 · HMAC-SHA256(rawBody, key) + `timingSafeEqual` · mismatch → 401.
- **PayDunya** (`services/paydunya.ts:100` `verifyIpnHash` + `routes/paydunyaPayment.ts:90`) : hash = `SHA-512(MASTER_KEY)` + `timingSafeEqual`, MASTER_KEY absente ou hash invalide → 401. **Réconciliation only** (ne fait pas confiance au montant du webhook).
- Tous les webhooks sont **exemptés du rate-limit** (`config.rateLimit:false`) — correct (bursts/retries provider légitimes, authentifiés par signature).

### 2. Auto-approbation sandbox — SÛRE PAR CONSTRUCTION
Les trois gardes exigent **le flag explicite ET l'environnement sandbox** :
- Campay : `CAMPAY_SANDBOX_AUTO_SUCCESS === '1' && IS_SANDBOX` (`campayPayment.ts:85,122`)
- MTN : `MTN_SANDBOX_AUTO_SUCCESS === '1' && IS_SANDBOX` (`mtnPayment.ts:68`)
- PayDunya : `PAYDUNYA_SANDBOX_AUTO_SUCCESS === '1' && IS_TEST` (`paydunyaPayment.ts:67`)

⇒ En prod (`CAMPAY_ENVIRONMENT=production` / `PAYDUNYA_MODE=live` / `MTN_MOMO_ENVIRONMENT≠sandbox`),
`IS_SANDBOX`/`IS_TEST` = false → **l'auto-approbation ne peut JAMAIS se déclencher**, même si un
flag `*_SANDBOX_AUTO_SUCCESS=1` traînait par erreur. C'est la sécurité que le CLAUDE.md exige.

### 3. Stats / réconciliation
`computePaymentStats` (`routes/paymentStats.ts:27`) couvre **mtn / campay / paydunya** (par
`*Reference`, refunded exclus). Wave + Orange passent par l'overlay **PayDunya** en prod → couverts
via `paydunyaReference`.

---

## ✅ BLOQUEUR CAMPAY — CORRIGÉ (PR rawBody, 2026-07-24)

Le parser `application/json` capturant `rawBody` a été ajouté au plugin `campayPaymentRoutes`
(identique à celui de `payments.ts`, encapsulé → aucun effet sur les autres routes). Verrou :
`campayWebhookRawBody.test.ts` — un body JSON **avec espaces** signé sur les octets exacts est
ACCEPTÉ (un fallback `JSON.stringify` compact échouerait) ; sabotage vérifié (parser retiré →
seul ce cas rougit). **Il ne reste plus que les variables d'env à poser** (checklist ci-dessous).

<details><summary>Description originale du bug (historique)</summary>

**Le webhook Campay ne pourra pas vérifier sa signature en production.**

Campay signe son JSON en `HMAC-SHA256(rawBody, key)`. Le code (`campayPayment.ts:171`) lit
`request.rawBody`, sinon retombe sur `JSON.stringify(request.body)`. Or **le parser qui capture
`rawBody` pour le JSON est ENCAPSULÉ au plugin `payments.ts`** (`payments.ts:103-107`, commentaire
« ne s'applique qu'aux routes de ce plugin ») — il sert Wave/Orange. `campayPaymentRoutes` est un
**plugin séparé** (`server.ts:290` vs `292`) → `request.rawBody` y est **toujours `undefined`**
→ fallback `JSON.stringify(request.body)`.

⇒ Le JSON re-sérialisé ne reproduit **presque jamais** les octets exacts signés par Campay (ordre
des clés, espaces, échappement Unicode) → `timingSafeEqual` échoue → **tous les webhooks Campay
légitimes rejetés en 401**. Les paiements Campay ne seraient jamais confirmés.

**Correctif** (code, avant go-live) : enregistrer le parser `application/json` qui pose `rawBody`
**aussi** pour le plugin Campay — soit en le déplaçant en global dans `server.ts`, soit en
l'ajoutant dans `campayPayment.ts`. PayDunya n'est PAS concerné (son hash porte sur MASTER_KEY, pas
sur le body ; il lit l'urlencoded `_form` déjà capturé). Wave/Orange OK (parser dans leur plugin).

</details>

**Correctif retenu** : parser ajouté dans `campayPayment.ts` (option encapsulée, blast radius minimal).

---

## 🟡 Points de vigilance (mineurs)

- **Campay ne re-vérifie pas le MONTANT** facturé (`campayPayment.ts:204+` fait confiance au
  `status` signé). Risque faible : la signature authentifie le corps (pas de forge possible). À
  décider produit : réconcilier le montant contre l'intention de paiement.
- **`CAMPAY_SANDBOX_AUTO_SUCCESS` force le montant à 10 XAF** en sandbox (`campayPayment.ts:53`) —
  inoffensif en prod (gaté sur `IS_SANDBOX`), mais s'assurer que le flag est **absent/0** en prod
  par propreté.

---

## Checklist go-live (Railway — geste de Nelson, avec ses credentials)

| Provider | Variables à poser | Pré-requis code |
|---|---|---|
| **Wave** | `WAVE_WEBHOOK_SECRET` | — (fail-closed déjà en place) |
| **Campay** | `CAMPAY_ENVIRONMENT=production` · `CAMPAY_WEBHOOK_KEY` · `CAMPAY_USERNAME/PASSWORD/TOKEN` (live) | ✅ rawBody corrigé (2026-07-24) |
| **PayDunya** | `PAYDUNYA_MODE=live` · `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN` (live) | — |
| **MTN** (si activé) | `MTN_MOMO_ENVIRONMENT=production` + clés live | — |
| **tous** | s'assurer que les `*_SANDBOX_AUTO_SUCCESS` sont **absents** en prod | (sûr même si présents) |

Après le flip : valider **end-to-end** un paiement réel par provider (petit montant), confirmer que
le webhook marque la vente `completed`, et que `today-stats` la compte. La preuve d'un paiement se
fait par une VRAIE transaction de bout en bout (ce que seul Nelson peut faire côté prod).
