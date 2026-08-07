# Leçon — intégrité des prix POS & réconciliation du total encaissé

> Extrait de `CLAUDE.md` le 2026-07-28 pour l'alléger. **Rien n'a été supprimé** : ce fichier
> garde le raisonnement complet — ce que le mécanisme REMPLACE et pourquoi l'ancien laissait
> passer une fraude silencieuse, les expositions mesurées en prod, la justification de chaque
> borne. Les **règles** à ne pas casser restent dans `CLAUDE.md` § POS / Ventes, qui pointe ici.
> Contexte : ticket sécurité `sales.ts` (#145), Chantier B PR1/PR2, réconciliation (c).

---

- **Intégrité prix (ticket sécurité — `sales.ts`)** ⚠️ : le prix de base et le total sont **SERVEUR-autoritaires**. Un caissier authentifié pouvait forger une vente à prix arbitraire (`total:1` pour un produit à 1300) — vecteur de fraude interne silencieux, **indépendant du cache**. Désormais : le prix soumis n'est facturé QUE s'il correspond au tarif **DÉCLARÉ par la ligne** (`items[].clientType` ∈ `retail|semi|wholesale`, résolu via palier+promo à la qté par `expectedPrice`). Sinon = **divergence** : en ligne on facture le **prix serveur de ce tarif** ; « offline » on honorerait le montant encaissé — branche aujourd'hui **INATTEINTE**, cf. ci-dessous. ⚠️ **Le tarif est porté par la LIGNE, pas par la vente** : `applyPriceDrift` est une action EXPLICITE du caissier (POS.tsx), donc un panier monté en Détail puis basculé en Grossiste garde légitimement ses prix détail — envoyer le tarif COURANT ferait re-tarifer ces lignes **à la baisse**. Helper pur `toSaleItemPayload(cart)` (`saleReconcile.ts`) : il ne reçoit PAS le tarif sélectionné, ce qui rend l'erreur inécrivable. ⚠️ **Ce que remplace ce mécanisme** : `legitimatePrices` acceptait le prix s'il appartenait à **n'importe lequel** des trois tarifs (« pas besoin du clientType ») — un catalogue POS périmé dont l'ancien prix DÉTAIL coïncidait avec le prix de GROS actuel était donc facturé tel quel, **sans divergence, sans trace et sans alerte de réconciliation** (`serverTotal == netTotal`) : un client détail payait le tarif de gros, en silence, **EN LIGNE**. Accepter « un tarif quelconque » n'est pas vérifier un prix. Défaut rétro-compatible = `retail` (le POS web démarre sur Détail ; le POS **mobile n'a aucun sélecteur** et lit `sellPrice` seul). **Produit inconnu du catalogue de la boutique → 400 `UNKNOWN_PRODUCT`** : sans prix serveur, il n'y a rien à comparer ni à substituer — c'était auparavant « toléré », donc facturé au montant choisi par le client, sans trace (exposition mesurée avant correctif : **0 SaleItem orphelin** en prod). Verrou : `salesTariffIntention.test.ts` (11 tests, **4 sabotages vérifiés**) + `cartTariff.test.ts` / `saleReconcile.test.ts` côté front (**2 sabotages**). Total (`sale.total`) = Σ lignes serveur − remise − fidélité, **TVA serveur** (`tenant.vatRate`+`posVatIncluded` : TTC extrait / HT ajouté). **La déviation légitime (abîmé/négo) passe par la remise manuelle** (déjà tracée) — le panier n'offre AUCUN champ d'édition de prix de ligne. **⚠️ `clientCreatedAt` : DÉCLARÉ MAIS RENSEIGNÉ PAR PERSONNE** (mesuré 2026-07-25) — le champ n'existe que dans `mobile/src/types/index.ts`, aucun client ne l'émet (le POS web n'a AUCUNE persistance locale des ventes : hors-ligne = échec surfacé, cf. `POS.tsx`). Donc `honorClientPrice` est **toujours `false` en production** et la branche « offline honoré » est **du code mort tel que déployé** — ne pas raisonner comme si elle protégeait quoi que ce soit. Il reste par ailleurs FALSIFIABLE, donc ce n'est PAS un signal vérifiable ; la protection anti-fraude est la **TRACE**, pas la branche : toute divergence écrit `SaleItem.submittedPrice`/`catalogPrice` + `Sale.priceDivergence=true`, dans les DEUX cas (online/offline), exploitée en **audit a posteriori** (filtre `GET /api/sales?priceDivergence=true`). Verrou : `salesPriceIntegrity.test.ts` rejoue la requête forgée (prix serveur + trace). **UI d'audit (ADMIN uniquement, dans l'historique POS)** : filtre « écarts de prix » + sous-filtre « en ligne uniquement », badge par vente, détail par ligne (soumis/catalogue/**écart en argent signé**/caissier). **QUALIFICATION « tarif précédent » (Chantier B, PR1)** ⚠️ : une divergence peut venir d'un **catalogue POS périmé** (le prix a changé, le terminal était encore sur son cache) et non d'un prix forgé — les deux produisaient la MÊME ligne ambre, donc *un cache périmé accusait un caissier honnête*. Désormais `Product.previousPricing` (Json) + `Product.pricingChangedAt` instantanéisent le jeu de tarifs **sortant** à chaque écriture qui change RÉELLEMENT un prix (`PUT /products/:id` ; un renommage ne consomme pas l'instantané), et `SaleItem.staleCatalogAt` porte la qualification. **Serveur-autoritaire de bout en bout** — aucune donnée client (≠ `clientCreatedAt`, falsifiable) : les colonnes sont hors de `PRODUCT_UPDATE` (liste blanche stricte), donc non forgeables. **DEUX conditions cumulatives** : le prix soumis **est le prix du tarif DÉCLARÉ** dans les tarifs précédents (`expectedPrice(qty, previousPricing, tariff)`) **ET** `now − pricingChangedAt ≤ STALE_CATALOG_WINDOW_MS` (48 h = 2× le TTL du cache SW `api-cache`). ⚠️ **La borne est indispensable** : sans elle un prix vieux de 3 mois serait qualifié et l'audit exonérerait une vraie fraude. **Profondeur 1 assumée** (deux changements rapprochés perdent le plus ancien) → non concluant ⇒ `null` ⇒ comportement historique, **jamais une affirmation d'innocence**. **N'influence RIEN de ce qui est facturé.** Concept partagé `expectedPrice`/`normalizeTariff`/`basePriceForTariff`/`toPricingSet`/`samePricing`/`PRICING_FIELDS` dans `utils/pricing.ts` (⚠️ toute nouvelle colonne de prix sur `Product` doit être ajoutée à `PRICING_FIELDS`, sinon un changement cesse d'être instantanéisé). Verrou : `staleCatalogDivergence.test.ts` (10 tests, **3 sabotages vérifiés** : borne temporelle, appartenance, détection de changement réel).
**UI d'audit (PR2)** : l'historique POS a désormais **TROIS** traitements, tous dérivés d'une source unique `priceGapLevel(rows)` (badge + cadre de détail + sous-filtre → jamais de désaccord possible) — `look` **ambre** (écart en ligne que le serveur n'explique PAS = à regarder) · `previous` **bleu** (`--c-blue-*`/`--info`, fait établi : « le tarif venait de changer » + par ligne « était le tarif catalogue jusqu'au JJ/MM HH:MM ») · `offline` **gris** (montant honoré, bénin). ⚠️ **Biais de PRUDENCE** : une vente mêlant expliqué et inexpliqué reste `look`. Le sous-filtre a changé de sens — « En ligne uniquement » → **« À regarder »** (`priceGapLevel === 'look'`) : garder tous les écarts « en ligne » y ferait entrer les caches périmés, c.-à-d. du bruit qui ressemble à une tentative. Helpers purs **exportés** de `POSProductGrid.tsx` (`priceDivergenceRows`/`priceGapLevel`/`staleUntilLabel`), verrou `priceGapLevel.test.ts` (11 tests, sabotage vérifié).

**Deux sens DISTINCTS dérivés des lignes** : `unitPrice===catalogPrice` ⇒ **corrigé (EN LIGNE)** = tentative à regarder (ambre) ; `unitPrice===submittedPrice` ⇒ **honoré (HORS-LIGNE)** = bénin (gris). Vocabulaire **factuel** (« écart de prix », jamais « suspect »/« fraude »). Masqué aux MANAGER/CASHIER (`canAuditPrices`). Backend : `cashier.name` ajouté à l'include de `GET /api/sales`.
- **Réconciliation du total encaissé (Chantier B, (c))** ⚠️ : `confirmSale` **JETAIT** la réponse de `POST /api/sales`. Or le serveur est autoritaire sur le prix : s'il re-tarife (catalogue du terminal périmé), il facture un autre montant que celui encaissé → **caisse courte, sans cause explicable à la clôture**. Désormais la réponse est capturée ; `reconcileSaleTotal(serverTotal, netTotal)` (`components/pos/saleReconcile.ts`, tolérance **1** comme le paiement mixte) signale au caissier **combien réclamer ou rendre**, tant que le client est au comptoir (toast 15 s + `announce`). ⚠️ `authoritativeTotal` alimente **le ticket imprimé ET le reçu WhatsApp** — les deux affichaient le total CLIENT alors que la facture PDF porte le total SERVEUR (le reçu WhatsApp envoyait même le **BRUT**, remise fidélité ignorée). Le total serveur transite par une **`ref`** (`billedTotalRef`), pas un state : `printTicket` est appelé dans la même passe que l'enregistrement, et garder sa signature à zéro argument évite le piège `onPrint={printTicket}` (l'événement passerait en 1er argument). ⚠️ **`Number(null) === 0`** : sans filtre d'absence explicite, un total serveur absent déclenchait « rendre 1 000 F » sur une vente saine et imprimait un ticket à **0** — l'absence de donnée doit rester une absence (`readTotal`). **Effet de bord utile** : une alerte sur une vente au tarif courant signale une **dérive des miroirs front/back** (TVA `computePosVat`, fidélité) — c'est un signal, pas un faux positif à museler. Verrou : `saleReconcile.test.ts` (11 tests, sabotage vérifié). Aucun appel réseau ajouté au chemin critique. *(Prévenir AVANT l'encaissement = décision produit ouverte : que devient le panier quand un tarif bouge en cours de vente ?)*

---

## MISE À JOUR 2026-08 — option A : le rejeu hors-ligne est désormais HONORÉ

⚠️ **Ceci PÉRIME le passage ci-dessus qui décrit la branche hors-ligne comme « du code mort tel
que déployé ».** C'était exact au 2026-07-25 (`clientCreatedAt` n'était renseigné par personne) ;
ça ne l'est plus. `clientCreatedAt`, `REPLAY_THRESHOLD_MS` et `honorClientPrice` ont été
**SUPPRIMÉS**.

### Ce que l'option A remplace

La branche dormante honorait **n'importe quel** prix sur un simple horodatage antidaté (1 F pour
un produit à 1300), sans borne ni appartenance à un tarif. L'option A **n'ouvre donc pas une
porte** : elle remplace une porte grande ouverte et non gardée par une porte étroite et
surveillée. Ne jamais ré-adosser un honneur à une horloge client — `salesPriceIntegrity.test.ts`
échoue si on le refait.

### La condition

`honored = offlineReplay && staleCatalogAt !== null` — **DEUX conditions cumulatives**, et
l'ORDRE du bloc est load-bearing : la qualification se calcule AVANT la décision ; l'inverse
honorerait sur le seul drapeau (`tsc` le refuse, TS2448).

`offlineReplay` est posé **UNIQUEMENT** par la file mobile (`saleReplay.ts`). Sans lui, le chemin
en ligne direct est **exactement** celui de #145 : re-tarification + `reconcileSaleTotal` alerte
le caissier au comptoir.

### Le drapeau est FALSIFIABLE — vecteur assumé et BORNÉ

Un caissier forgeant `offlineReplay:true` ne peut faire passer qu'un prix qui **était réellement
celui de son tarif DÉCLARÉ il y a moins de 48 h**. Il ne peut pas inventer un montant : le gain
maximal est le delta d'un vrai changement de prix récent, sur les seuls produits concernés.

**Aucun signal non falsifiable de « c'était hors-ligne » n'existe** — `idempotencyKey` ne porte
pas le temps, l'horloge client n'est jamais transmise, un jeton pré-signé serait rejouable. La
protection est donc le **CADRE** (`staleCatalogAt`, fait serveur) **+ la TRACE** : toute
divergence écrit `submittedPrice` / `catalogPrice` / `staleCatalogAt` + `SaleItem.pricingHonored`
+ `Sale.priceDivergence=true`.

### Hors des bornes

Fenêtre **48 h**, **profondeur 1**. Hors bornes — ou tarif non qualifié, ou vente mixte
partiellement qualifiée — le serveur **re-tarife** et le mobile écrit une entrée durable
**`repriced`** (« à vérifier »), **distincte de `rejected`** (« à ressaisir ») : la vente EXISTE,
et confondre les deux la ferait compter **deux fois**.

**Jamais un honneur par défaut** : hors bornes = re-tarifer + avertir.

### L'UI d'audit passe de TROIS à QUATRE niveaux

Toujours une source unique `priceGapLevel(rows)`, par ordre de PRUDENCE :

| Niveau | Couleur | Sens |
|---|---|---|
| `look` | ambre | en ligne, inexpliqué — à regarder |
| **`honored`** | **ambre « à vérifier »** | **le montant encaissé a été facturé tel quel au rejeu** |
| `previous` | bleu | le tarif venait de changer, serveur re-tarifé |
| `offline` | gris | ventes historiques d'avant l'option A |

⚠️ **`honored` ne doit JAMAIS retomber dans le bleu.** Là-bas le serveur a corrigé, donc l'argent
est juste et le bleu se lit « fait établi » ; ici **l'argent a bougé** — il n'y a rien à établir,
il y a une caisse à vérifier. *Une trace stockée que personne ne regarde ne protège personne :
c'est toute la contrepartie de l'option A.*

### Le filtre « Écarts honorés » est résolu CÔTÉ SERVEUR

`GET /api/sales?pricingHonored=true` (`items: { some: { pricingHonored: true } }`).

⚠️ Filtrer côté client ne verrait que **la page de 50 ventes** : un écart honoré de quelques
jours deviendrait **introuvable**, et une trace qu'on ne peut pas retrouver ne protège personne.
Verrou : `salesHonoredFilter.test.ts` (6, sabotage « filtre ignoré » vérifié).

*(L'autre sous-filtre, « À regarder », reste un affinage CLIENT — le serveur ne sait pas ce
qu'il « n'explique pas ».)*

### Verrous de l'option A

- `offlineReplayHonor.test.ts` (11, **5 sabotages** : honorer sans drapeau · sans qualification ·
  sur un autre tarif · ordre inversé — rouge à `tsc` ET aux tests · ligne honorée non marquée) ;
- mobile `saleReplay.test.ts` (10, **3 sabotages** : réponse jetée · drapeau absent · motif fondu
  dans `rejected`) ;
- `priceGapLevel.test.ts` (22, **2 sabotages**) — il en comptait 11 avant l'option A.
