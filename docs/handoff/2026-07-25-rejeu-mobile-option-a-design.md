# Rejeu mobile — option A (honorer) : design d'intégration avec #145

> **État : DESIGN, non implémenté.** Aucune ligne de facturation écrite. Attend validation.
> Contexte : surface « rejeu mobile (b) ». Étape 1 (vérification de `staleCatalogAt`) et
> étape 2 (registre durable des ventes non enregistrées) sont livrées en #149.

---

## Q2 — `staleCatalogAt` par tarif déclaré : **déjà fait**

`sales.ts:238` (livré par #145) :

```ts
if (prev && Math.round(expectedPrice(item.qty, prev, tariff).price) === Math.round(submitted))
  staleCatalogAt = changedAt
```

La qualification interroge **le tarif précédent DU TARIF DÉCLARÉ** (`tariff` =
`normalizeTariff(item.clientType)`), pas l'ensemble des anciens tarifs. Le trou de
coïncidence fermé côté facturation par #145 est donc **déjà** fermé côté qualification —
c'était le sens du test « ancien prix de GROS soumis sur une ligne DÉTAIL → NON qualifié ».

**Conclusion : aucun travail supplémentaire, et l'invariant demandé est structurellement
garanti par la fonction que la facturation utiliserait.**

---

## Q1 — Les deux voies

### Voie 1 — drapeau « rejeu offline », honorer seulement au rejeu

`POST /api/sales` accepte `offlineReplay?: boolean` (niveau VENTE : une vente en file est
rejouée entièrement). Dans la branche de divergence :

```
charged = (offlineReplay && staleCatalogAt) ? submitted : expected.price
```

- **En ligne direct : #145 strictement intact** — pas de drapeau, donc re-tarification,
  donc `reconcileSaleTotal` continue d'alerter le caissier au comptoir.
- **Coût** : le drapeau est **déclaré par le client, donc falsifiable**.
- **Ce que la falsifiabilité permet réellement** — et c'est la seule chose qui compte :
  un caissier qui forgerait `offlineReplay:true` ne peut faire passer qu'un prix qui
  **était le tarif de son tarif déclaré il y a moins de 48 h**. Il ne peut pas inventer un
  montant ; il ne peut exploiter qu'un **vrai changement de prix récent**, et seulement sur
  les produits concernés. Le gain maximal = le delta d'un changement réel, sur 48 h.
  Toute occurrence écrit `submittedPrice`/`catalogPrice`/`staleCatalogAt` et remonte à
  l'audit. **Le drapeau ouvre la porte ; `staleCatalogAt` par tarif en fixe le cadre.**

### Voie 2 — honorer uniformément si `<48 h`, sans drapeau

- **Coût, et il est lourd** : un terminal **en ligne** au catalogue périmé serait désormais
  **facturé à l'ancien prix**. Une hausse de prix ne s'appliquerait qu'au rythme du
  rafraîchissement des caches — jusqu'à 48 h de ventes à l'ancien tarif, sur tous les
  terminaux. C'est une **politique tarifaire**, pas une correction de fraîcheur.
- Pire : `serverTotal === netTotal` ⇒ **`reconcileSaleTotal` ne dit plus rien**. On perdrait
  l'avertissement au comptoir livré au Chantier B (c), alors que le client est encore là et
  que c'est le moment le moins coûteux pour corriger.
- Elle défait donc, en pratique, ce que #145 vient d'établir : le serveur autoritaire sur
  le prix en ligne.

**Recommandation : voie 1.** La voie 2 échange un problème de tiroir hors-ligne (rare,
borné, traçable) contre une fuite de revenu en ligne (courante, non signalée).

---

## Un point qui change la lecture du risque

Le code **actuel** contient déjà une branche « honorer » :

```ts
const honorClientPrice = replayMs > REPLAY_THRESHOLD_MS   // clientCreatedAt, falsifiable
const charged = honorClientPrice ? submitted : expected.price
```

Elle est **dormante** (personne n'envoie `clientCreatedAt` — mesuré) mais, si elle était
réveillée, elle honorerait **n'importe quel prix soumis**, sans aucune borne : pas de
`staleCatalogAt`, pas d'appartenance à un tarif, rien. Un `clientCreatedAt` antidaté
suffirait à facturer 1 F un produit à 1300.

Le design proposé **remplace** cette branche par un gate borné. Il faut donc lire
l'option A non pas comme « on ouvre une porte », mais comme « **on remplace une porte
grande ouverte et non gardée par une porte étroite et surveillée** » — et on supprime au
passage `clientCreatedAt` + `REPLAY_THRESHOLD_MS`.

---

## Design retenu (à valider)

### Backend — `sales.ts`, branche de divergence uniquement

1. `SALE_BODY` gagne `offlineReplay: z.boolean().nullish()`.
2. **Réordonner** : calculer `staleCatalogAt` **avant** `charged` (aujourd'hui l'inverse).
   ⚠️ C'est le seul point mécanique délicat : on touche le bloc que #145 vient de durcir.
   Mitigation : les 16 tests de `salesTariffIntention.test.ts` + les 15 de
   `staleCatalogDivergence.test.ts` encadrent déjà ce bloc, sabotages compris.
3. Décision :
   ```
   honored = offlineReplay === true && staleCatalogAt !== null
   charged = honored ? submitted : expected.price
   ```
4. Supprimer `clientCreatedAt`, `REPLAY_THRESHOLD_MS`, `honorClientPrice`.
5. Trace inchangée (`submittedPrice`, `catalogPrice`, `staleCatalogAt`) + nouveau champ
   `SaleItem.pricingHonored: Boolean @default(false)` — sans lui, l'audit ne peut pas
   distinguer « honoré » de « re-tarifé » autrement qu'en comparant des montants.
   *(Migration additive, colonne booléenne, défaut false.)*

**Chemin en ligne direct : inchangé.** Sans `offlineReplay`, `honored` est faux et le
comportement est exactement celui de #145.

### Mobile

6. `useOfflineSync` pose `offlineReplay: true` sur le payload rejoué (et **seulement** là ;
   `submitSaleResilient` en ligne ne le pose pas).
7. **Cesser de jeter la réponse** (`useOfflineSync:37`) : comparer le total serveur au total
   encaissé.
   - **égaux** (honoré, ou aucun écart) → rien à dire ;
   - **différents** (hors bornes : > 48 h, profondeur 2, ou tarif non qualifié) →
     **entrée durable** « vente enregistrée à un prix différent — vérifiez la caisse »,
     avec les deux montants. Réutilise le registre de #149 avec un motif `repriced`
     (distinct de `rejected`/`exhausted` : ici la vente **existe**, c'est le montant qui
     diffère — les deux libellés doivent rester distincts, sinon on brouille « à ressaisir »
     et « à vérifier »).

### Audit #92 — ce qu'il faut y changer

Mesuré : `priceDivergenceRows` lit déjà `submittedPrice`/`catalogPrice`/`staleCatalogAt`, et
`priceGapLevel` classe une ligne honorée (`corrected=false`, `staleAt` posé) en **`previous`
(bleu)**. Le câblage existe donc déjà. Mais le bleu se lit aujourd'hui « fait établi, pas une
alerte » — or **sous A, l'argent a bougé**. Deux ajustements minimaux :

- libellé du niveau `previous` : dire explicitement « facturé au tarif précédent — montant
  encaissé honoré », avec `deltaXOF` (déjà calculé, signé) ;
- un filtre admin « écarts honorés » (`pricingHonored=true`), pour que la trace soit
  consultable et pas seulement stockée.

---

## Ce que le design NE résout pas (à assumer explicitement)

- **Hors bornes** (> 48 h, deux changements pendant la coupure) : re-tarification + entrée
  durable. Le tiroir reste faux ce jour-là ; il est simplement **dit**, plus jamais tu.
- **Vente mixte** (certaines lignes qualifiées, d'autres non) : le total diverge quand même
  → entrée durable. Le total, pas la ligne, est ce que le tiroir compare.
- **Le drapeau reste falsifiable.** Borné par `staleCatalogAt` par tarif, tracé, auditable —
  mais pas vérifiable. Aucun signal non falsifiable de « c'était hors-ligne » n'existe :
  `idempotencyKey` ne porte pas le temps, `OfflineAction.createdAt` est une horloge client
  jamais transmise, et un jeton pré-signé serait lui-même rejouable.

## Verdict de faisabilité

**Tractable, pas trop risqué** — à trois conditions : le réordonnancement du bloc de
divergence est couvert par les harnais existants (il l'est), la colonne `pricingHonored`
est ajoutée (sinon l'audit ne distingue rien), et le mobile cesse de jeter la réponse
(nécessaire de toute façon pour le hors-bornes).

Si l'un des trois saute, **se rabattre sur B** : re-tarifer + avertir. B est strictement
plus simple, n'introduit aucun drapeau falsifiable, et son coût — la charge de
réconciliation — est réel mais visible.
