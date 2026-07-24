# Chantier B — fraîcheur du cache POS · phase 0 (mesurée)

**Date** : 2026-07-24 · **État** : mesure terminée, **politique non tranchée** (aucun code écrit).
**Pré-requis levé** : item 10 / strict TS mergé (#118).

Ce document ne contient que des faits **mesurés**, avec leur commande de reproduction.
Aucune garantie posée par raisonnement — cf. CLAUDE.md § « Méthode — la leçon la plus chère ».

---

## 1. Le cache POS n'a qu'UNE couche

`POS.tsx:57` charge le catalogue via `productsApi.list()` → `fetch` → intercepté par le
service worker. `appStore` ne persiste **aucun** produit (grep `products` sur
`src/stores/appStore.ts` = vide). Il n'existe donc pas de cache applicatif : toute la
fraîcheur des prix POS dépend du SW.

## 2. La règle `products-cache` est du CODE MORT en prod

Ordre d'enregistrement dans le `sw.js` **déployé** :

```bash
curl -s https://habashop.vercel.app/sw.js | grep -o "registerRoute([^;]*"
```

```
1. CacheFirst            lazy-chunks-cache
2. NetworkFirst          api-cache        /^https:\/\/habashop-production…\/api\//   ← 24 h
3. StaleWhileRevalidate  products-cache   /\/api\/products/                          ← 7 j
```

`node_modules/workbox-routing/Router.js:259-266` (`findMatchingRoute`) retourne le
**premier** match. La base API du bundle prod déployé est bien l'URL Railway :

```bash
curl -s https://habashop.vercel.app/assets/index-<hash>.js | grep -o "https://habashop-production.up.railway.app"
```

⇒ `/api/products` est servi par la règle **#2**. La configuration « 7 jours / 500 entrées »,
que tout lecteur de `vite.config.ts` prend pour *le* cache produits du POS, **ne s'est jamais
exécutée en production**. (Elle ne peut matcher qu'en même origine, or `devOptions.enabled:false`
⇒ pas de SW en dev non plus.)

## 3. La péremption réelle est 24 h — et elle mord AUSSI en ligne

`networkTimeoutSeconds: 5` sur la règle #2 + cold start Railway free-tier ⇒ au-delà de 5 s,
le SW sert **silencieusement** un catalogue vieux de ≤ 24 h **à un terminal en ligne**.
La péremption n'est donc pas un problème hors-ligne. C'était l'appui de la politique proposée
en phase 0 précédente : **cet appui est faux**.

## 4. Hypothèse du mémo précédent : CONFIRMÉE

`sales.ts:157-194` — le prix soumis n'est facturé que s'il appartient à l'ensemble des tarifs
serveur légitimes (`legit`, résolus via palier+promo à la quantité) ; sinon **divergence** →
en ligne on facture `retail.price`, hors-ligne (`honorClientPrice`, rejeu > `REPLAY_THRESHOLD_MS`
= 90 s) on honore le montant encaissé.

⇒ Être **facturé** un prix périmé n'existe bien qu'**hors-ligne**.

## 5. Mais la conséquence est INVERSÉE — c'est ici que vit le vrai sujet

La re-tarification en ligne n'est pas neutre. Prix passé de 1000 → 1200, terminal encore sur
le catalogue en cache :

- l'écran affiche 1000, le caissier encaisse 1000, **le serveur facture 1200** ⇒ la caisse est
  courte de 200, et `gapLevel` affiche à la clôture un écart **sans cause explicable** ;
- la vente est écrite avec `priceDivergence=true` ⇒ elle remonte dans l'**UI d'audit ADMIN**
  (historique POS) en « corrigé (EN LIGNE) — tentative à regarder » (ambre).

**Un cache périmé fabrique donc une accusation contre un caissier honnête.** Le vrai enjeu du
Chantier B n'est pas le chiffre d'affaires : c'est **l'intégrité de l'écran anti-fraude de
l'item 11**. La trace ne sait pas distinguer « cache périmé » de « prix forgé » — les deux
produisent exactement la même ligne.

## 6. Pas de dérive temporelle des prix (borne l'exposition)

`promotionEnd` n'est appliqué **nulle part** : ni `apps/backend/src/utils/pricing.ts`, ni son
miroir `apps/frontend/src/lib/pricing.ts` (`resolveTierPrice` teste `promotion.active` seul).
Une promo court jusqu'à ce qu'on décoche `hasPromotion`. Les prix ne bougent donc que sur
**écriture admin explicite** — il n'existe aucun scénario où un prix change tout seul.

> **Bug distinct, hors périmètre** : une « date de fin de promo » saisie dans `StockModals`
> qui ne termine aucune promo.

---

## Décision en attente (non tranchée avec Nelson)

Trois surfaces candidates, **une seule à la fois** :

- **(a) Distinguer périmé vs forgé dans la trace** — rendre l'audit ADMIN honnête. Piste
  serveur-autoritaire : mémoriser prix précédent + date de changement sur `Product`, pour que
  le serveur puisse affirmer « ce prix ÉTAIT le tarif jusqu'à T » **sans dépendre d'une donnée
  client falsifiable** (≠ `clientCreatedAt`). Traite le point 5.
- ~~**(b) Réparer la couche cache**~~ — **FAIT** (PR3). Règle morte supprimée (et non remontée :
  SWR servirait un prix périmé même en ligne et rapide) ; la règle API matche le **chemin**, plus
  l'hôte en dur ; garde CI `verify:sw-routes` sur le `dist/sw.js` livré, vérifiée dans les deux
  sens (règle occultée → « règle MORTE » ; règle mise en tête → mauvais cache détecté).
  Le TTL n'a **pas** été raccourci : il ne joue qu'hors-ligne / cold start, c'est-à-dire
  précisément là où l'on VEUT le cache pour ne jamais bloquer une vente.
- ~~**(c) Réconcilier le total encaissé**~~ — **FAIT** (PR4), sous une forme plus sûre que la
  revalidation *avant* encaissement initialement envisagée. `confirmSale` jetait la réponse de
  `POST /api/sales` : le serveur renvoie pourtant le total qu'il a RÉELLEMENT facturé. On le
  compare au net encaissé (tolérance 1, comme le paiement mixte) et on dit au caissier, tant que
  le client est au comptoir, combien réclamer ou rendre. Aucun appel réseau ajouté sur le chemin
  critique, aucun nouveau mode d'échec : on exploite une réponse qui existait déjà.
  Corrige aussi **deux documents qui mentaient** : le ticket imprimé et le reçu WhatsApp
  affichaient le total client (et le reçu envoyait même le BRUT, remise fidélité ignorée) alors
  que la facture PDF portait le total serveur.
  **Non fait, décision produit ouverte** : prévenir *avant* l'encaissement suppose de décider ce
  qu'il advient du panier quand un tarif bouge en cours de vente (mise à jour automatique ou
  confirmation explicite) — à trancher avec Nelson, pas à inventer.

## Annexes — deux défauts trouvés au passage, hors périmètre

- `apps/frontend/.env.production` (**tracké**) baked `VITE_API_URL=https://api.habashop.com`,
  hôte qui **ne résout pas** (`dig +short` vide, `curl` → `000`). La prod ne fonctionne que
  parce que la variable d'environnement Vercel l'écrase. Un build prod local est cassé.
- Le commentaire de `.env.local` affirme qu'aucun outil ne consomme `SENTRY_AUTH_TOKEN` —
  `vite.config.ts` l'utilise bien (`sentryVitePlugin`).
