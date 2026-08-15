# Référence par module — HabaShop

> Extrait de `CLAUDE.md` le 2026-07-28 (section « Autres modules », 23 % du fichier chargé à
> chaque session). **Rien n'a été supprimé** : endpoints, schémas Prisma, composants, verrous et
> justifications sont ici, intégralement. `CLAUDE.md` § « Modules — index » ne garde que les
> règles transverses, celles qu'on casse **sans travailler sur le module concerné**, et pointe ici.
>
> **Ouvrir ce fichier dès qu'on touche à l'un de ces modules** — chaque entrée porte des décisions
> non devinables depuis le code (pourquoi une borne, pourquoi un refus, ce qui a déjà mal tourné).

## Sommaire

Produits (expiration de promo) · Codes-barres (Chantier A) · Étiquettes · Abonnements ·
Transferts stock · OCR factures · Facture PDF backend · Facture/devis client · Ticket Z ·
WhatsApp · Finance · RH/Planning · Paie · Rapport comptable · Intégrations · Auth · Audit ·
Multi-boutiques · Admin PLATEFORME (coquille opérateur, contenu console, états vides) ·
Sidebar · Emails Resend · GlobalSearch · Onboarding · Dépenses & budgets · Sélecteurs de date

---

- **Produits** : SKU `PRD-NNNN`, priceTiers, scan @zxing. **Expiration de promo** ⚠️ : `promotionEnd` TERMINE désormais la promo (avant : le champ ne faisait RIEN — une promo « jusqu'au 31/05 » restait facturée en juillet). Helper pur **`isPromotionActive(hasPromotion, promotionEnd, now)`** — miroir back (`utils/pricing.ts`) ↔ front (`lib/pricing.ts`), cas partagés `docs/shared-fixtures/promotion-active-cases.json`. Échéance **INCLUSIVE** au jour calendaire **UTC** (`YYYY-MM-DD`, robuste aux fuseaux — au pire une promo traîne ≤1 h, jamais coupée trop tôt) ; `promotionEnd` absent (`''`/null) = promo sans fin (comportement historique). `now` **INJECTÉ** (fonction pure, pas de `new Date()` interne). `resolveTierPrice` reste sans notion de temps : l'appelant lui passe le booléen EFFECTIF. Appliqué à : `sales.ts` (facturation + `legitimatePrices` reçoit `hasPromotion: promoActive` → un prix promo expiré n'est plus un tarif légitime), `POS.tsx` `computePriceForItem` (tuile+panier), `PublicCatalog.tsx` (×2, le client ne voit plus une promo morte). ⚠️ **Interaction Chantier B** : une promo qui expire fait « changer » le prix sans écriture admin → un terminal au catalogue périmé soumettant l'ancien prix promo produit une divergence **NON qualifiée** (`staleCatalogAt` repose sur `pricingChangedAt`, non touché par le temps) → ambre « à regarder ». Effet de bord transitoire (fenêtre = rafraîchissement cache ≤24 h) et **exposition prod = 0** (0 promo active mesurée 2026-07-24). Verrous : `promotionActiveShared.test.ts` (back) + `pricing.test.ts` (front), sabotage vérifié des 2 côtés ; `salesPromotionExpiry.test.ts` (bout en bout). ⚠️ **Miroir MOBILE (`posStore.ts`) PAS encore aligné** — son flux POS ne porte pas `promotionEnd` (port séparé, hors CI, à faire avec validation device).
- **Codes-barres (Chantier A)** : RÈGLE CANONIQUE UNIQUE `src/lib/barcode.ts` — **3 miroirs** (backend/mobile/frontend, à l'identique) testés contre `docs/shared-fixtures/barcode-cases.json`. `normalizeBarcode` (EAN-13 · EAN-8 conservé tel quel · **UPC-A→EAN-13** par préfixe « 0 », **JAMAIS de strip des zéros de tête** — casserait le round-trip scan) ; `isValidBarcode`/`isAcceptableBarcode` (garde saisie) ; `barcodeMatches` (RECHERCHE : sous-chaîne OU égalité canonique) ; `matchesScannedCode` (SCAN→panier : barcode canonique **OU SKU EXACT**, jamais sous-chaîne — un faux positif caisse coûte plus cher qu'un échec) ; `quietZonePx` (silence latéral **≥10 modules**, GS1 11). Backend `checkBarcode` (POST/PUT products) : EAN-13/EAN-8/UPC-A + **unicité par tenant** (findFirst hors soft-deleted → 400 `INVALID_BARCODE` / 409 `DUPLICATE_BARCODE`) ; PAS de `@@unique` DB (barcodes vides + soft-delete). ⚠️ Toute logique barcode passe par le lib — **méta-test** (`barcode.test.ts` front) échoue si une regex `\d{13}` locale réapparaît hors du lib. **Scan = geste PRINCIPAL** (fiche `StockModals` + POS `handleScan` web/mobile + scan de recherche inventaire) ; recherche par nom/**SKU**/barcode (web inventaire+POS, mobile stock+globale) ; « Générer » (EAN-13 interne préfixe 200, `generateEAN13`) = second recours **réservé au vrac** (sélection explicite + confirmation). **Rattrapage** guidé `StockBackfill.tsx` (produits sans code → scan/génère par ligne + planche A4). Vignette fiche (`BarcodeVignette`) = surface blanche unique cliquable-pour-copier, quiet zones bakées dans le SVG (`quietZonePx`).
- **Étiquettes** : planche **A4 Avery** (`utils/export.ts printProductLabels`, rattrapage en masse) + **thermique 40×30 mm** (`utils/thermalLabel.ts printThermalLabels`, jsPDF import dynamique, à l'unité, chunk `pdf` hors precache). Les DEUX : barcode rendu via **jsbarcode LOCAL** (plus de CDN), **EAN-13/EAN-8 uniquement** (JAMAIS de CODE128-sur-SKU = code non standard, piège caisse), quiet zones ≥10 modules (`quietZonePx`). Sans code EAN → **zone repliée** (nom/SKU/prix, étiquette de prix propre) : AUCUNE mention sur l'étiquette (face client) ; l'alerte « N sans code-barres → compléter » vit dans la modale Étiquettes AVANT impression (→ ouvre le rattrapage). **Prix en NOIR gras** sur les DEUX (jamais le violet écran `#5B4EE8` : impression bureau souvent N&B → violet = gris pâle sur l'info la plus importante + encre couleur ; thermique = monochrome, `setTextColor(0)` explicite). **Pas d'émoji sur la planche Avery** (le 📦 générique par défaut n'apporte rien, redondant avec le produit sur lequel l'étiquette est collée ; thermique n'a jamais rendu d'émoji — Helvetica). Thermique : gabarit 40 mm, marge page 1 mm → module ≈ 0,325 mm (proche nominal GS1, absorbe l'étalement d'encre).
- **Abonnements** (`pages/Subscriptions.tsx` + `components/subscriptions/`) : paniers **hebdomadaires** — `Subscription.dayOfWeek` IMPOSE l'hebdo, il n'existe aucune colonne de fréquence (la modale l'écrit en texte fixe « Chaque semaine », surtout **pas** un sélecteur qui promettrait du bi-hebdo). **Aucun total n'est stocké** : il est DÉRIVÉ de `product.sellPrice` à l'affichage (`subscriptionTotal`) et suit donc le catalogue → libellé « au tarif du jour », jamais présenté comme figé ; panier vide = **« — »**, jamais « 0 F » (un zéro affirme un montant). **`Subscription.startDate`** (nullable, PR #143) est FONCTIONNELLE : `GET /api/subscriptions/due` écarte `startDate > aujourd'hui` (borne = minuit UTC du LENDEMAIN, jour calendaire inclusif comme `promotionEnd` — un `<= now` naïf écarterait à tort un démarrage prévu plus tard le même jour). ⚠️ La date saisie **n'est pas** la première livraison : le serveur ne livre qu'aux `dayOfWeek` → `firstDeliveryFrom()` calcule la vraie date affichée (`today` injecté), sinon l'UI promettrait une livraison qui n'aura pas lieu. Modale : panier = **seul bloc en relief**, total dans le **pied épinglé**, **aucune présélection de jour** (un défaut silencieux = faux « prêt »), « Enregistrer » éteint avec la liste NOMMÉE de ce qui manque. ⚠️ **Contraste MESURÉ** : `--acc` sur le panneau or tombe à **1,57:1** en thème clair (échoue même l'AA large 3:1) → le montant bascule sur `--text` en clair via `totalAmountColor()`, le panneau teinté restant identique. Verrous : `subscriptionModal.test.tsx` (26, **5 sabotages vérifiés**) + `subscriptionStartDate.test.ts` (9, 2 sabotages). Captures : `npm run shot:subscriptions --workspace=apps/frontend` (build local + `vite preview`).
- **Transferts stock** (multi-boutiques v2) : `StockTransfer` (`pending → completed | cancelled`), MANAGER+. `POST /api/stock/transfers` (vérif accès aux 2 boutiques, anti-soi-même, **décrément gardé** `updateMany stockQty>=qty`), `GET` (source OU dest = active, `?status`), `PATCH /:id/confirm` (dest only → incrément ; produit dest retrouvé **SKU→barcode, sinon copié depuis source**), `PATCH /:id/cancel` (source ou dest → restitue stock source). Push `stock_transfer`. Front : onglet Stock « ↔ Transferts » (si >1 boutique), badge sidebar Stock = transferts reçus en attente.
- **OCR factures** : `POST /api/suppliers/scan-invoice` (multipart 10MB), Claude Sonnet 4.6 Vision. `unitPrice` OCR = devise facture → `formatInCurrency` (pas `fmt`). `suppliersApi.scanInvoice` = fetch brut FormData.
- **Facture PDF (backend, LA vraie)** : bouton historique POS → `GET /api/sales/:id/invoice` → `lib/invoicePdf.ts` (**pdfkit**), `FAC-{YYYY}-{NNNNN}` idempotent (`Sale.invoiceNumber`). ⚠️ **Générateur DISTINCT** du devis frontend (`generateInvoice`) — deux parcours vivants, corriger les DEUX. Séparateur : `pdfSafeSpaces()` (U+202F/U+00A0 → espace simple ; Helvetica/WinAnsi n'a pas de glyphe U+202F → « 8 /500 » sinon) dans `fmtMoney` → couvre facture + Ticket Z PDF (`ticketZ.ts` réutilise `fmtMoney`) + PDF TVA (`reports.ts` fmt2). Logo Sac+H vectoriel pdfkit — `drawLogo()` **exporté** d'`invoicePdf.ts` et **partagé** (facture + Ticket Z + PDF TVA, source unique du dessin) ; pill « Payée » (cercle tracé, « ● » absent en WinAnsi), mentions légales `ninea/rccm/vatNumber` si configurées. E-mails (`email.ts`) : logo = **PNG hébergé** `/pwa-192x192.png` (Outlook ne rend pas le SVG inline), plus l'emoji 🛍️.
- **Facture/devis client (`utils/export.ts` generateInvoice)** : document dédié (logo Sac+H, filet violet, statut Payée/En attente, Total TTC). **Tout montant imprimé passe par `printableAmount()`** (U+202F/U+00A0 → espace simple — sinon « 2 /800 » en monospace ; vaut aussi pour posTicket + rapport Z) et toute donnée dynamique par `escHtml()`. Pied légal : `Tenant.ninea/rccm/vatNumber` (String?, PATCH tenant trim + ''→null + max 64), UI Réglages → Boutique « Infos légales », affichés seulement si renseignés.
- **Photos produit — stockage objet (Cloudflare R2)** ⚠️ *(2026-08-12 — stockage, envoi **web** et envoi **mobile** livrés)*
  - **Interface mobile** : `src/hooks/useProductPhoto.ts` + les boutons de la modale d'édition (`app/(app)/(tabs)/stock.tsx`), la vignette `ProductThumb` servant d'aperçu. Suit le chemin de `useSupplierOcr` (permission → picker → compression → multipart), avec **deux écarts voulus** : la cible est **512 px / 0,82** et non 1920/0,7 (réglage d'OCR, ~14× plus lourd pour rien), et on borne **le plus grand côté** et non la largeur — une photo **portrait** au téléphone est le cas courant, et la borne en largeur de l'OCR ne la contraindrait pas.
  - ⚠️ **QUATRE issues, pas deux** : `ok` · `annule` · `permission` · `echec`. Un `string | null` ferait dire la même chose à « l'utilisateur a fermé le sélecteur » et « le serveur a refusé » — la première ne doit RIEN afficher, la seconde demande un geste dans les réglages du téléphone, la troisième mérite le message du serveur.
  - ⚠️ **Deux boutons EN LIGNE, jamais une feuille de choix** : une seconde `<Modal>` par-dessus la modale d'édition fait **crasher Fabric** en release sur Android d'entrée de gamme (`addViewAt`, cf. `mobile/CLAUDE.md` §8). `Alert` reste sûr (dialogue natif, pas une `Modal`) et le fichier en a déjà l'usage.
  - ⚠️ **Il n'existe PAS de création de produit sur mobile** (`productsApi` n'expose que `list` et `update`) : le cas « photo en attente » du web n'a donc **aucun équivalent** ici. C'est une simplification de SURFACE — si une création apparaît, il faudra le différé du web avec son échec partiel.
  - ⚠️ **`FormData` de React Native prend un DESCRIPTEUR `{uri,name,type}`, pas un `Blob`** — divergence de fond avec le jumeau web, qui envoie des octets. Le `as any` est inévitable (le type DOM ne connaît que `Blob | string`).
  - ⚠️ **Anti-dérive par fixture** : `docs/shared-fixtures/product-photo.json` porte `maxPx`/`qualite`, et un test jumeau de CHAQUE côté échoue si l'un bouge seul (`mobile/src/__tests__/productPhoto.test.ts` · bloc « photo de PRODUIT » d'`imageResize.test.ts`). Sans lui rien n'empêcherait le mobile de reprendre les réglages de l'OCR — R2 se facture au Go·**mois**.
  - ✅ **Portable par OTA** : `expo-image-picker` et `expo-image-manipulator` étaient **déjà** installés (OCR), `mobile/package.json` est inchangé. ⚠️ La preuve de portabilité reste l'**empreinte** (`eas fingerprint:compare --build-id …`), pas cette lecture de diff — non lancée.
  - Verrous : `productPhoto.test.ts` (5, pur + fixture) · `useProductPhoto.test.ts` (6, simulacres qui **appliquent** leurs arguments — un mock qui les ignore resterait vert si l'image d'ORIGINE partait). **3 sabotages vérifiés.**
  - **Interface web** : `components/stock/ProductPhotoField.tsx`, dans l'onglet Général de la fiche produit. ⚠️ **`StockForm.image` EST L'ÉMOJI** — il part en `emoji` et il est **préfixé au nom** (`form.image + ' ' + form.name`). `Product.image` est une URL de photo. Deux champs homonymes de sens opposés dans les mêmes fichiers : la photo ne transite donc **jamais** par `StockForm`, et côté domaine elle s'appelle **`ProductItem.photo`**, délibérément.
  - **La photo n'est PAS enregistrée par la soumission du produit** (endpoint séparé). Produit existant → envoi **immédiat** au choix du fichier. Produit **en création** → pas encore d'identifiant, le fichier est mis en attente et envoyé par `Stock.tsx` après `create`. ⚠️ **L'échec partiel est DIT** : « Produit ajouté — la photo n'a pas pu être envoyée », jamais un succès sec.
  - ⚠️ **C'est le CLIENT qui redimensionne** (`resizeToBlob`, `PRODUIT_MAX_PX = 512`), parce que le serveur n'a pas de `sharp`. **512 est une MARGE, pas une mesure** : la plus grande vignette du produit fait 64 px (56 px mobile), donc 256 suffirait à un écran 3×. Le coût n'entre pas dans l'arbitrage (36 Mo contre 12 Mo pour 600 produits, face à 10 Go gratuits).
  - ⚠️ **La photo courante ne vit dans AUCUN état** : elle se dérive de `products` via `editingId`. `setEditingId` est appelé depuis **trois** endroits (dont deux dans `StockInventory`) — un état parallèle serait un point d'appel de plus à oublier, et écrire dans `products` rafraîchit la grille du même geste.
  - ✅ **CHAÎNE PROUVÉE EN PRODUCTION le 2026-08-12** — `prisma/verify-r2-e2e.ts` (`CONFIRM=1 VERIFY_DATABASE_URL=… railway run npx tsx …`), forme (c) : tenant jetable créé, exercé, détruit, résidu vérifié à zéro. Il prouve ce qu'aucun test ne peut : multipart → route déployée → garde de dépense → écriture R2 → **le domaine public sert bien les octets** → retrait effectif. **À RELANCER après tout changement de `R2_PUBLIC_BASE_URL`** : c'est la seule chose qui dit qu'un nouveau domaine fonctionne. ⚠️ **`railway run` injecte un `DATABASE_URL` INTERNE** (`postgres.railway.internal`), injoignable d'une machine de dev — d'où `VERIFY_DATABASE_URL` pris du `.env` local. Deux sources d'environnement qui ne se recouvrent pas.
  - ⚠️ **DEUX PIÈGES MESURÉS EN EXÉCUTANT CE SCRIPT**, tous deux invisibles au raisonnement : (a) **`AuditLog.userId` est une FK en `RESTRICT`** et la route d'envoi écrit `PRODUCT_IMAGE_SET` — supprimer l'utilisateur avant les lignes d'audit fait **échouer le ménage** et laisse un tenant en production (c'est arrivé) ; l'audit se supprime EN PREMIER. (b) **`ListObjectsV2` n'est pas immédiatement cohérent après un `DELETE`** : l'objet apparaissait encore juste après une suppression réussie, puis plus rien quelques secondes après. Conclure sur une seule lecture accuse un code correct — la vérification converge, bornée.
  - **Vignettes de DÉMONSTRATION semées côté serveur** (`prisma/seed-demo-photos.ts`, `CONFIRM=1` · `RETIRER=1` pour défaire) : 25 produits des deux démos, rendus par Chromium (dégradé **teinté par catégorie — teinte DÉRIVÉE du nom, jamais une table codée en dur** — + émoji), écrits DIRECTEMENT dans R2 et en base. ⚠️ **Ce n'est PAS un contournement de la garde** : `blockDemoTenant` reste entier sur la route, c'est l'administrateur du service qui sème. Une démo AFFICHE des vignettes, personne ne peut en envoyer. ⚠️ **Ce ne sont pas des photographies** et il ne faut pas le laisser croire — aucune image tierce n'est téléchargée (licence, source non maîtrisée). ⚠️ **La clé est celle de l'APPLICATION** (`productImageKey`) : une clé maison rendrait ces objets invisibles à `keyFromPublicUrl`, donc non supprimables par le bouton « Retirer ». ⚠️ **JPEG, pas PNG** — MESURÉ : un dégradé pèse 210–245 Ko en PNG contre **11–14 Ko** en JPEG 0,82, soit 5,4 Mo au lieu de 311 Ko pour les 25. Servir 16× trop lourd à une grille de caisse contredirait le réseau lent pour lequel ce chemin existe. ⚠️ N'ÉCRASE JAMAIS une image existante.
  - ✅ **PROUVÉ DEPUIS UN VRAI NAVIGATEUR le 2026-08-12** — `e2e/product-photo.spec.ts`, sur `e2e-tenant` (non démo, donc la garde de dépense laisse passer). ⚠️ **C'est le SEUL test qui exerce le redimensionnement canvas** : jsdom n'a ni canvas ni décodeur (le module est simulé), et `verify-r2-e2e.ts` envoie des octets déjà prêts par HTTP — il saute le navigateur. L'assertion qui porte tout : une source de **1200 px** ressort en **`naturalWidth ≤ 512`**, ce qui ne peut venir que du canvas puisque le serveur n'a pas de `sharp`. Le test vérifie aussi que le domaine public SERT réellement l'image (`naturalWidth > 0`), la forme de la clé, la conversion en `.jpg`, et le retrait effectif.
  - ⚠️ **Il MUTE `e2e-tenant` et écrit un objet réel dans R2** — assumé : c'est le tenant dédié, que cette suite mute déjà. Le retrait fait partie du test (il exerce le chemin de suppression) **et** un `afterEach` idempotent rattrape tout résidu si le test casse au milieu : la suite tourne en CI à CHAQUE push `main`, un résidu s'accumulerait en silence. Vérifié indépendamment après coup : **0 objet dans le bucket**.
  - Verrou : `productPhotoField.test.ts` (10, **4 sabotages**, dont la collision émoji/photo jouée sur le DOM rendu et le cas boutique de démonstration). ⚠️ `resizeToBlob` n'est **pas** exerçable sous jsdom (ni canvas ni décodeur) : il est simulé, et ce fichier garde la DÉCISION, jamais les pixels.
  - **Routes** : `POST /api/products/:id/image` (multipart, champ libre, 3 Mo) → `{ image: url }` · `DELETE /api/products/:id/image` → `{ image: null }`. Gardes du POST : `[authenticate, blockDemoTenant, costQuota('storage')]`, puis produit cherché **dans la boutique** (404 uniforme, aucun oracle), puis configuration (503 nommé), puis type réel, puis écriture. **L'ordre est load-bearing.**
  - **`lib/productImageKey.ts` (PUR)** porte les trois décisions de sûreté, exerçables sans réseau : (a) le type se lit dans les **OCTETS** — JPEG/PNG/WebP, ⚠️ **SVG délibérément absent** (c'est du texte, aucune signature, et servi depuis notre domaine il exécute son `<script>` dans notre origine) ; (b) la clé `tenants/<t>/products/<p>/<sha256:32>.<ext>` est **cloisonnée par tenant** et porte l'**empreinte du contenu** — c'est ce qui rend l'en-tête `immutable` sûre et ce qui **invalide le cache** SW + AsyncStorage (une URL fixe servirait l'ancienne photo des jours durant) ; (c) `keyFromPublicUrl` exige **origine ET forme** et rend `null` au moindre doute.
  - ⚠️ **Le chemin retour est le point dangereux.** `Product.image` est une colonne texte libre : une valeur héritée, importée ou forgée ne doit **jamais** déclencher une suppression. Trois conditions cumulatives avant de supprimer l'ancien objet — sous notre base, forme de clé valide, **préfixe du tenant courant**. Au retrait, la colonne est effacée **même si** l'objet n'est pas à nous (sinon le commerçant garde une photo qu'il ne peut pas enlever).
  - ⚠️ **`sharp` ABSENT — la route ne REDIMENSIONNE PAS.** Le plafond de 3 Mo borne les **octets**, pas les pixels : une photo de 4000 px passe et sera servie telle quelle dans la grille de caisse. `lib/imageResize.ts` vit côté **front**. Limite ASSUMÉE de ce lot — la future interface d'envoi doit redimensionner avant d'envoyer.
  - ⚠️ **LEÇON DE VÉRIFICATION** : le sabotage « retirer `authorizeSpend` de `r2Client` » est passé **VERT** au premier tir — le cas « boutique suspendue » de la route était satisfait par `costQuota` **en amont**. Le test prouvait la route, pas le point de dépense. D'où le bloc qui appelle `putProductImage` **directement** : `costQuota` est un preHandler HTTP, il n'existe pas pour un import, un cron ou une synchro mobile. *Justesse empruntée, même famille que `spendGuardStatusOrder`.*
  - Verrous : `productImageKey.test.ts` (10, pur) · `productImageRoutes.test.ts` (17, SDK simulé qui **enregistre** bucket/clé/type) · `spendGuardAllowlist.test.ts` étendu. **4 sabotages vérifiés**, dont celui ci-dessus rejoué après correction.
- **Photo produit dans les DOCUMENTS : AUCUNE — décision du 2026-08-12, pas un oubli.** Les trois surfaces imprimées (facture PDF backend, devis/facture HTML front, étiquette thermique 40×30) n'affichent ni émoji ni photo, alors que les 18 surfaces d'ÉCRAN le font via `ProductThumb`. ⚠️ **Le raisonnement est écrit UNE SEULE FOIS, en tête d'`InvoiceSale.items` dans `apps/backend/src/lib/invoicePdf.ts`** — le recopier ici le ferait diverger. En deux lignes : imprimer `Product.image` (une URL) obligerait le SERVEUR à aller la chercher à chaque génération — surface SSRF sur une adresse lue en base, aller-retour réseau par ligne, et **aucun repli** (l'émoji de secours du POS n'existe pas en WinAnsi). L'étiquette, elle, sort d'une thermique **1 bit** de 40×30 mm : une photo y devient un aplat tramé, au détriment de la zone du code-barres. ⚠️ Le verrou `productImageSelect.test.ts` ne couvre PAS ces surfaces **par construction** — il n'exige `image` que dans les `select` qui nomment déjà `emoji`, et aucun document n'en nomme : ne pas lire son silence comme une omission.
- **Ticket Z** : `@@unique([tenantId,date])`, upsert idempotent, CA hors refunded, breakdown COALESCE(split, paymentMode).
- **WhatsApp** : auto-vente (Twilio, fail-silent), manuel (`/api/whatsapp/send-ticket`), crons gérant (20h/8h TZ Dakar, **uniquement si `Tenant.ownerPhone` non null**). Campagnes : `POST /api/marketing/whatsapp/campaign`, rate-limit 1/h Redis, segments fidélité.
- **SMS (Africa's Talking)** — canal DISTINCT de WhatsApp, extrait de `CLAUDE.md` § Dette le 2026-08-07.
  `lib/spend/smsClient.ts` est le **SEUL module autorisé à importer `africastalking`** (allowlist
  `spendGuardAllowlist.test.ts`), calqué sur `twilioClient` : garde de dépense (`SpendKind` **`sms`**,
  quotas `QUOTA_TRIAL_SMS`/`QUOTA_ACTIVE_SMS`, défauts 20/200 **placeholder**) + **`resolveRecipient`
  obligatoire** (`owner` requis — un SMS part vers un numéro, même sécurité téléphonique que WhatsApp).
  Ne throw jamais ; rend les unités des envois échoués/écartés. `services/sms.ts`
  `notifyStockAlertSms(tenantId, products)` = **digest QUOTIDIEN** au gérant, câblé dans
  `services/notificationCrons.ts` et **PAS par vente** (un SMS/jour, pas un par vente) ; opt-in tenant
  `notifSmsStock` + `ownerPhone`, flux commerçant normalisé avec `tenant.country`. Filet
  `mockPaidSdks.ts` mocke aussi `africastalking`. Verrou `smsClient.test.ts` (6 : refus téléphone
  client, pays non supporté, normalisation commerçant, quota refusé, réserve N, fail-safe clé
  absente ; sabotage vérifié). *(`notifSmsSales` = résumé ventes, fast-follow via la même infra.)*
- **Push PWA (Web Push VAPID)** — canal navigateur **DISTINCT** du push Expo mobile ; extrait de
  `CLAUDE.md` § Dette le 2026-08-07. `services/webPush.ts` est le **SEUL module autorisé à importer
  `web-push`** (fail-silent, VAPID lu à chaud depuis l'env → no-op si absent) ; `pushService.dispatch()`
  fanne chaque notification vers Expo (mobile) **ET** web (subscriptions `platform='web'`, subscription
  JSON stockée dans `PushToken.token`). Front : `utils/webPush.ts` (permission → clé VAPID serveur →
  `pushManager.subscribe` → POST token), bascule « Recevoir sur cet appareil » dans `SectionNotif`
  (**distincte** de l'opt-in tenant `notifPushAll`), handlers SW dans `public/push-sw.js` — chargé via
  workbox `importScripts` parce que **le SW généré n'accepte pas de listeners en configuration**, et
  exclu du precache. Endpoint `GET /api/notifications/vapid-public-key`. Verrous : `webPush.test.ts`
  back (parse / fail-safe / purge 404-410) + `webPush.test.ts` front (décodage base64url VAPID).
- **Fidélité — carte digitale** (extrait de `CLAUDE.md` le 2026-08-07 ; les règles transverses —
  backend autoritaire, « ne PAS envoyer le net », QR sans crypto — restent dans `CLAUDE.md` § Fidélité).
  `LoyaltyCardDigital` (maquette 04) : carte hero **teintée par palier** — couleurs **FIXES**, c'est un
  artefact PNG exporté, pas du chrome thémé ; paliers actuel/prochain (remises et seuils du tenant) ;
  activité = `loyaltyApi.get().history` (LoyaltyTransactions serveur, pas un calcul client).
- **Paiements mobiles — détail par prestataire** (extrait de `CLAUDE.md` le 2026-08-07 ; la règle
  transverse « `IS_SANDBOX` jamais pour l'auto-approbation » et le flux POS restent là-bas).
  **PayDunya** : `response_code:'00'` = succès ; IPN = SHA-512(`MASTER_KEY`), **fail-closed**,
  réconciliation seulement ; 16 tests. **Campay carte** : `/api/get_payment_link/` (underscore,
  pas de tiret), QR noir/blanc opaque, référence de bac à sable `SANDBOX-CARD-{ts}`.
  **Stats** : `GET /api/payments/today-stats` agrège par `*Reference`, en UTC, `refunded` exclus —
  ⚠️ étendre `computePaymentStats` pour **tout** nouveau prestataire, sinon ses encaissements
  disparaissent d'un total qui continue de s'afficher.
- **Fidélité — modèle serveur** (extrait de `CLAUDE.md` le 2026-08-07 ; la règle transverse
  « le front envoie le BRUT, jamais le net » reste là-bas). Backend AUTORITAIRE :
  `loyaltyDiscount = total × tierPct`, plafond **50 %**, et `sale.total` stocké est le **NET**.
  Le front envoie le montant BRUT plus `customerId` — envoyer le net appliquerait la remise
  **deux fois**. QR de carte = `HABA-CUST:<id>`, noir sur blanc opaque, **aucune crypto** :
  c'est un identifiant, pas un jeton.
- **Paiements mobiles — cadences et bac à sable** : MTN MoMo `services/mtnMomo.ts`, polling
  **3 s × 40** ; Campay `services/campay.ts`, jeton **55 min**, HMAC de webhook **fail-closed**,
  bac à sable à **montant forcé 10 XAF** ; PayDunya `services/paydunya.ts`.
- **Paiements mobiles — flux POS** (extrait de `CLAUDE.md` le 2026-08-07). Polling →
  `confirmSale(mtnRef?, campayRef?, paydunyaRef?)`. Si PayDunya est configuré, Wave et Orange
  basculent sur l'overlay QR `POSPaydunyaOverlay` (3 s × 100 = 5 min) ;
  `isPaydunyaMode = paydunyaOk && (wave || orange)`.
- **Onboarding — payload défensif** (extrait de `CLAUDE.md` le 2026-08-08) : les champs vides
  ne sont PAS envoyés, pour qu'un « Passer » n'écrase rien de ce qui existe déjà.
- **POS — placeholder honnête** : « …ou scanner » **uniquement** si `posEnableScanner` ; sinon
  « Rechercher… ». Pas de fausse promesse dans un champ de saisie.
- **POS — prix barré de référence** (extrait de `CLAUDE.md` le 2026-08-08) : affiché
  **UNIQUEMENT** si `showStrikePrice(ref, eff)`, c'est-à-dire `ref > eff` (helper `posShared`).
  Sans ce test, le tarif de gros retombant sur le prix détail affichait « 2 800 2 800 ».
- **E2E Playwright — configuration** (extrait de `CLAUDE.md` le 2026-08-08 ; les règles
  transverses — tenant dédié, navigation par clic, pas de `page.reload()` — restent là-bas).
  Fixtures **statiques** : `apps/backend/scripts/seed-e2e-tenant.ts`, idempotent, garde
  `E2E_SEED=1` + scope `e2e-tenant`, **manuel** ; jamais demo ni prod. Fixtures **datées**
  (ventes du jour → `dashboard-donut`) créées par API dans `auth.setup`
  (`e2e/helpers/fixtures.ts` — **pas de secret DB** dans un dépôt public).
  `e2e/helpers/preconditions.ts` + `test.skip` conditionnels = garde-fou (0 skip nominal).
  `storageState` dans `e2e/.auth/user.json`, `workers:1`.
  **BASE surchargeable** : `playwright.config` et chaque spec lisent leur `<ÉCRAN>_BASE` —
  `E2E_BASE`, `PAYROLL_BASE`, `POS_BASE`, `STOCK_BASE`, `PAGES_BASE`, `DASH_BASE`,
  `CUST_BASE`, `HR_BASE`, `REPORTS_BASE`, `SETTINGS_BASE` (défaut prod). ⚠️ Pour valider un
  build local : `vite preview` + **TOUTES** sur `http://localhost:PORT`, sinon cross-origin
  (auth locale ≠ site prod → redirection login). API prod = `https://habashop-production.up.railway.app`
  (Railway free-tier, démarrage à froid lent).
- **Paie — persistance et gel** (extrait de `CLAUDE.md` le 2026-08-08 ; les règles transverses
  — instantané GELÉ, source unique `payrollBreakdown`, convertir UNE fois, `month` en clé ISO —
  restent là-bas). Modèle `Payroll` `@@unique([tenantId, employeeId, month])` +
  `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/generate`, `PATCH /api/payroll/:id`.
  Rôles = **miroir exact** de `ROLE_PERMISSIONS['payroll']` côté front (ADMIN, SUPER_ADMIN,
  MANAGER, ACCOUNTANT, HR ; CASHIER exclu) — un serveur PLUS STRICT que l'UI ne protège rien,
  il produit des boutons visibles qui rendent 403. Génération **IDEMPOTENTE**
  (`skipDuplicates` + contrainte d'unicité) : rejouer ne duplique pas et ne réécrit AUCUN
  bulletin existant. `paidAt` est posé par le **serveur** — une date de versement doit être
  vérifiable, pas déclarée par le navigateur — et **effacé** si le statut repasse hors
  « PAYÉ ». ⚠️ `PayRecord` est identifié par `employeeId` (cuid), **jamais par un index de
  tableau** : c'était `i + 1`, donc « marquer payé » visait une POSITION et un changement
  d'ordre payait le mauvais bulletin.
- **Paiements mobiles — sécurité du bac à sable** (extrait de `CLAUDE.md` le 2026-08-08) :
  `IS_SANDBOX` est acceptable pour choisir une URL ou une devise, **INTERDIT** pour
  auto-approuver un paiement. Toujours un `_SANDBOX_AUTO_SUCCESS=1` **explicite**, et le
  drapeau lu **INLINE dans le handler** — une constante de module fige la valeur à
  l'import, ce qui rend inefficaces les tests qui manipulent `process.env`.
- **Finance** : CSV comptable `GET /api/reports/accounting/csv` (UTF-8 BOM, semicolons, `sanitizeCsv()` anti-injection). TVA : `GET /api/reports/vat` + `/csv` + `/pdf` (pdfkit). `buildVatData()` partagé.
- **RH/Planning** : `Attendance` (`@@unique([tenantId,employeeId,date])`), `Shift` (même type interdit), `LeaveRequest`. Planning = `shiftsByDate Record<"empId_date", {type,id}[]>`, MAJ optimiste + rollback. Clavier PlanningGrid (Entrée/flèches/Échap/Suppr via GripVertical) — ne pas casser.
- **Paie** : bulletins jsPDF, cron idempotent via `Tenant.lastPayrollReportMonth`, `dryRun:true` par défaut.
- **Rapport comptable** : `GET /api/reports/accounting?month=YYYY-MM` (Redis cache), conversion XOF→devise serveur → modale formate sans reconvertir.
- **Intégrations** : métriques réelles uniquement. `noPing` masque grille latence. Sentry = `GET /api/integrations/sentry/status` backend.
- **Auth** : JWT + bcrypt12, `ROLE_PERMISSIONS` slug-based, `canAccess(role, slug)`. Rate-limit **global** 300/min/IP + overrides (login 30/15min, register 5/h…). Register : mot de passe ≥ 8 (validé zod). WS `/api/ws` fail-closed.
- **Audit** : `AuditLog` = échelle BOUTIQUE (`tenantId` requis + FK). `UserAuditLog` = échelle UTILISATEUR, **hors boutique** (changement de mot de passe : n'appartient à aucune boutique) — **SANS FK vers User** (un audit de sécurité SURVIT à la suppression du compte ; instantanés `userEmailSnapshot`/`userNameSnapshot` gardent la ligne lisible), hors liste scopée de l'extension Prisma. Lecture : `GET /api/account/security-activity` (userId courant) + `GET /api/admin/security-events` (console plateforme). ⚠️ **TOUTE écriture d'audit passe par `writeAudit(label, promise)`** (`lib/writeAudit.ts`) : fail-open mais TRACÉ (console.error + Sentry) — remplace le `.catch(() => {})` qui rendait un échec d'audit invisible. EXCEPTION : les 3 sites en `$transaction` (`sales`, `accountDeletion` ×2) propagent (échec ATOMIQUE). Verrou : `auditWriteConvention.test.ts` (méta-test : aucun `prisma.auditLog.create` avalé hors transaction). La lecture `/api/audit-logs` REMONTE l'erreur (plus de `catch→[]` : un journal muet ment).
- **Multi-boutiques** : `UserTenant` (many-to-many User↔Tenant, **rôle PAR boutique**). JWT porte `activeTenantId` (nullable) + `role` de la boutique active ; rétro-compat anciens tokens (`tenantId`). `authenticate` → `req.tenantId = activeTenantId`, **400 `NO_ACTIVE_TENANT`** sur routes métier sans boutique (exemptés : `/api/auth/*`, `/api/dashboard/consolidated`). ⚠️ **DEUX champs tenant, DEUX helpers** (`lib/tenantId.ts`, item 10) : `request.user.tenantId` (`string|null`, source héritée du JWT) → **`getTenantId(request)`** ; `request.tenantId` (`string|undefined`, boutique ACTIVE résolue par `authenticate`, W2-correct) → **`getActiveTenantId(request)`**. Les deux rétrécissent en `string` non-nullable et LÈVENT `TENANT_CONTEXT_MISSING` (défense en profondeur si une route tenant-scopée était montée sans le garde). Placer l'appel **APRÈS les gardes 400/403** (sa levée ne doit pas préempter un refus existant). `getActiveTenantId` est la couture de la future convergence W2. ⚠️ NE PAS confondre les champs : sur une route platform-scopée (`authenticateAdmin`, non gardée par `NO_ACTIVE_TENANT`) `request.user.tenantId` est légitimement nullable → `getTenantId` y lèverait à tort. Login : 1 boutique → directe ; >1 → `activeTenantId=null` + `tenants[]` (sélecteur). Endpoints : `POST /api/auth/switch-tenant` (rate-limit 10/min, vérif `UserTenant`→403), `GET /api/auth/tenants`, `POST /api/tenants` (ADMIN+, créateur lié ADMIN), `POST /api/tenants/:id/invite`, `GET /api/dashboard/consolidated` (CA XOF tous tenants). Front : `authStore.switchTenant()` → **rechargement complet** (`window.location`, pas de TanStack Query). `SelectShop.tsx` (sélecteur login), `TenantSwitcher.tsx` (sidebar, si >1), `ConsolidatedShops.tsx` (dashboard), Settings « Mes boutiques » (`SectionShops`, ADMIN+).
- **Admin PLATEFORME (super-admin SaaS)** : `User.isPlatformAdmin` (Boolean) = **SEUL** critère d'accès à `/api/admin/*` (`middleware/superAdmin.ts` `authenticateAdmin`), claim signé dans le JWT (login/switch, relu DB au switch). ⚠️ **JAMAIS gater sur le rôle `SUPER_ADMIN`** — c'est un rôle INTERNE au tenant (suppression tenant, notifs) ; gater dessus = fuite inter-tenants (P0 corrigé, cf. `adminPlatformIsolation.test.ts`). Anciens JWT sans le claim → 403 fail-closed. Provisioning **hors API, sans mdp en dur** : `apps/backend/scripts/set-platform-admin.ts` (`CONFIRM=1 PLATFORM_ADMIN_EMAIL=…`, promeut un user EXISTANT ; option `PLATFORM_TENANT=1` marque son tenant `isPlatform`). `Tenant.isPlatform` (Boolean) = tenant staff **exclu des listings/quotas/agrégats** de `/api/admin/*` (via relation `tenant.isPlatform`, `basePrisma`). Migrations additives appliquées : `isPlatformAdmin`, `Tenant.isPlatform`.
  - **Coquille opérateur (l'app du SaaS, pas une greffe commerçant)** : à la connexion, `landingFor(user)` (authStore) envoie un `isPlatformAdmin` sur **`/admin`** — critère **EN PARALLÈLE du rôle**, JAMAIS à sa place (`getLandingForRole` basé rôle reste intact). ⚠️ **Ne JAMAIS masquer le commerçant par le RÔLE** (un ADMIN commerçant garde api-docs/intégrations/utilisateurs) — le dépouillement se fait sur `isPlatformAdmin`. **PREUVE : `platformAdminShell.test.ts`** verrouille cet accès. Masquage **INTERFACE-only** (si l'opérateur force `/app/pos` il voit SA boutique vide → aucune donnée client, PAS de gate serveur, ≠ P0). `AdminDashboard.tsx` = console standalone (pas d'`AppLayout` commerçant) : **volet compte MINIMAL** (mot de passe/langue/thème, pas la page Réglages) + déconnexion, aucune entrée/badge/bandeau commerçant. Gardée par `PlatformAdminOnly` (≠ `AdminOnly` tenant qui reste pour api-docs/integrations).
  - **Contenu console** : **ACTIVATION en héros** (boutiques inscrites n'ayant JAMAIS ajouté de produit + entonnoir Inscrites→Produit→Vente + liste triée « jamais revenues » d'abord) ; **une seule liste « boutiques à traiter »** (fusion rétention+facturation, motif en étiquette : essai ≤3j/inactive/demande de plan/paiement à vérifier) ; **santé technique** (`OpsInfrastructure`, infra récupérée des intégrations) ; **« Relancer »** = lien e-mail pré-rempli (pas d'envoi auto). ⚠️ **SUPPRIMÉS** : cartes MRR/segments/**churn estimé** + graphe 6 mois (chiffres qu'on regarde sans agir). Données réelles only. *(« Voir en tant que » = design d'audit séparé, NON construit.)*
    - ⚠️ **États vides EXPLICITES (outil de surveillance)** : une section qui **disparaît** à vide empêche de distinguer « rien à signaler » de « fonction absente » → chaque section dit son vide. **Héros activation** à 0 « jamais activées » = **état de succès** (coche verte `CheckCircle2`/`--acc2`, fond vert discret, « Toutes vos boutiques ont démarré ») — le zéro géant + liseré `--warn` n'apparaissent qu'**≥1**. **« Boutiques à traiter »** TOUJOURS rendue ; vide → **checklist** nommant chaque signal surveillé comme sain (« aucun essai n'expire dans les 3 jours », « aucune boutique inactive », « aucune demande de plan en attente », « aucun paiement à vérifier »), badge de compte = `0` factuel. Onglets Boutiques/Demandes = `EmptyState`. **Ne jamais masquer une section vide** dans la console. Légendes **factuelles** (« inscrites sans aucun produit enregistré », pas « c'est là qu'un SaaS se perd » — pas de phrase de cadrage dans l'outil quotidien).
  - **Intégrations réparties par PUBLIC** : `/app/integrations` (commerçant) = **paiements + canaux uniquement** (MTN/Campay/PayDunya, Twilio/Resend) ; l'**infra** (Prisma/Redis/Railway/Vercel/monitoring) est retirée (publiait la stack aux clients) → `OpsInfrastructure` (console `/admin`). `MERCHANT_CATS`/`OPS_CATS` exportés d'`Integrations.tsx`. `/app/api-docs` **reste commerçant** mais le « Cahier des charges » (doc interne) est retiré.
- **Sidebar** (`components/layout/Sidebar.tsx`) : **zone QUOTIDIENNE épinglée** (Point de vente / Tableau de bord / Stock, bloc distinct) + **4 groupes d'INTENTION** (`nav_sec_sell/manage/analyze/configure` : Vendre / Gérer / Analyser / Configurer). Système+Administration fusionnés dans Configurer. Pas de badge factice (seul Stock = badge réel transferts). En-têtes masqués si aucune entrée accessible (`canAccess`). `ROLE_PERMISSIONS` : CASHIER sans Finance/RH ; « Activité » (journal) = MANAGER+/ADMIN (retiré à HR).
- **Emails Resend** : `escHtml()` + `baseTemplate()`. `email @unique` libéré au soft-delete.
- **GlobalSearch** : `GlobalSearch.tsx` (cmdk), Cmd+K/Ctrl+K dans AppLayout. Catégories : produits, clients, commandes, fournisseurs, actions rapides. Filtrées par `canAccess(role, slug)`.
- **Onboarding** : wizard 5 étapes `Onboarding.tsx`, route `/onboarding`. Flag `habashop_onboarded` localStorage. Auto-redirect depuis Dashboard pour ADMIN sans produits/ventes.

## Dépenses & budgets

**Écrans** : `pages/Expenses.tsx` (onglets Journal / Budget vs Réel) · `components/expenses/*`.

### Budgets — persistés par boutique depuis le 2026-08-08

| | |
|---|---|
| Table | `ExpenseBudget` — `@@unique([tenantId, category])` |
| Routes | `GET` / `PUT /api/expense-budgets` (`routes/expenseBudgets.ts`) |
| Migration | `20260808200000_add_expense_budget` — additive, rejouable |
| Domaine | `lib/expenseCategories.ts` (back) ↔ `CATEGORIES` (front), fixture `expense-categories.json` |

⚠️ **`getActiveTenantId`, PAS `getTenantId`.** Les budgets appartiennent à la boutique
REGARDÉE, pas à celle du JWT : un gérant multi-boutiques écrirait sinon les budgets de Dakar
depuis l'écran d'Abidjan. Vérifié en production sur deux boutiques jetables, refus d'un
non-membre en **403** inclus.

⚠️ **Une catégorie inconnue est REFUSÉE en 400 `UNKNOWN_EXPENSE_CATEGORY`**, jamais filtrée en
silence : répondre 200 en ignorant la clé ferait croire à un enregistrement qui n'a pas eu lieu.
Le zod `strict()` ferme la STRUCTURE, la liste blanche ferme le DOMAINE.

⚠️ **`GET` rend TOUJOURS les huit catégories, à zéro quand rien n'est posé.** Un dictionnaire
partiel obligerait chaque appelant à inventer un défaut — et ils en inventeraient des
différents. C'est exactement d'où venaient les littéraux du front.

⚠️ **`BUDGETS_INIT` vaut ZÉRO.** Ce n'est pas un repli, c'est un fait : « aucun budget posé ».
Y remettre des montants « de départ » réafficherait des chiffres que personne n'a saisis.

⚠️ **L'écriture passe par `saved()`**, jamais `.catch(() => {})` : le store n'est mis à jour
qu'en cas de succès et la modale reste ouverte sur échec, avec le message DU SERVEUR.

Trace : `EXPENSE_BUDGET_CHANGE`, AVANT → APRÈS des seules catégories qui bougent (catégories et
nombres uniquement, aucune donnée personnelle).

📖 *Le POURQUOI — les deux populations, les trois verrous passés verts, la justesse
empruntée : `docs/lessons/chiffres-affiches.md` § 9.*

### Sélecteurs de date

Tout champ de date passe par `components/ui/DatePicker.tsx` (`DateField`, `MonthField`,
`DateRangeField`). ⚠️ Le composant **conserve un `<input type="date">` natif** comme porteur de
valeur — on ne remplace que le calendrier : le clavier, les lecteurs d'écran et le sélecteur
natif au doigt gardent leur chemin, et `hrContractDomain.test.ts` (qui interdit la saisie
libre) reste satisfait. Le panneau est en **portail** : `.modal-box` porte `overflow:hidden` et
la plupart des champs vivent dans une modale. Méta-test : plus aucun `type="date"` / `"month"`
nu dans `src/`.


---

# Règles rapatriées de `CLAUDE.md` le 2026-08-15

> ⚠️ **DÉPLACÉES SUR DÉCISION DE NELSON.** Elles ne se chargent plus à chaque session. Le
> § Modules — index de `CLAUDE.md` garde un déclencheur qui renvoie ici. Ces règles sont
> **module-LOCALES** : elles n'ont de sens qu'une fois sur la surface concernée — contrairement
> à Codes-barres, Audit, Multi-boutiques, Admin plateforme, Zone franc CFA et Facture PDF, qui
> restent dans `CLAUDE.md` parce qu'on les enfreint **sans même travailler sur le module**.
>
> Texte repris **VERBATIM**.

- **Étiquettes** ⚠️ : **EAN-13/EAN-8 uniquement**, JAMAIS de CODE128-sur-SKU (code non standard = piège caisse). Prix en **noir gras** sur les deux gabarits (Avery + thermique), jamais le violet écran. Quiet zones ≥10 modules via `quietZonePx`.
- **Expiration de promo** ⚠️ : helper pur **`isPromotionActive(hasPromotion, promotionEnd, now)`**, miroir back (`utils/pricing.ts`) ↔ front (`lib/pricing.ts`), cas partagés `promotion-active-cases.json`, `now` **injecté**. Échéance inclusive au jour calendaire **UTC**. ✅ **Miroir MOBILE (`posStore.ts`) ALIGNÉ et désormais ENFORCED** — `mobile/src/__tests__/promotionActiveShared.test.ts` exerce `isPromotionActive` sur les 9 cas partagés et tourne en CI depuis #163. *(Ce fichier a longtemps affirmé le miroir « PAS aligné » : c'était FAUX — il l'était, il n'était simplement pas enforced. Une dette d'exécution lue comme une dette de code.)*
- **Commandes** ⚠️ : **`PurchaseOrder` ne représente QUE des commandes FOURNISSEUR** — `supplierId` y est une FK obligatoire, et il n'existe ni `clientName`, ni `clientPhone`, ni colonne `type`. Les **commandes CLIENT de l'écran sont donc LOCALES et ÉPHÉMÈRES** (décision produit #171) : aucun appel serveur n'est émis pour elles. Avant, il l'était — sans `supplierId` — et se faisait refuser en **400 systématique**, dont le caissier ne voyait qu'un « Échec de la création ». Leur persistance est une **dette backend** (colonnes + zod), pas un oubli du front.
  - ⚠️ **ASYMÉTRIE écriture/lecture** : on ENVOIE `items[].product`, le serveur range en `items[].productName`. **Passer par `toOrderPayload`** — envoyer les lignes du formulaire telles quelles est exactement ce qui a cassé la création : **0 commande en base**, avec `tsc` vert parce que `create` prenait `any`.
  - **Frontière dans la frontière** : `GET /api/orders` inclut `supplier` → on reçoit la ligne Prisma **brute** (`ApiSupplier` : `categories` en CHAÎNE, `leadTime` camelCase), pas l'interface `Supplier` du front. Le `POST` ne l'inclut pas → sa réponse est plus étroite (`Omit<ApiOrder,'supplier'>`).
  - Verrous : test **JUMEAU** sur `docs/shared-fixtures/order-create-cases.json` ; plus `ordersApiTypes.test.ts` (accès fantôme = **TS2339**, comparaison hors union = **TS2367**).
- **Suppression d'employé** ⚠️ : **il n'y a PLUS de route `DELETE /api/employees/:id`** (retirée le 2026-08-11, décision de Nelson). Un employé se **DÉSACTIVE** — `PUT { isActive: false }`, bouton `UserX` ambre, la personne reste dans la liste marquée inactive. ⚠️ **NE PAS la rétablir « pour le ménage »** : les 5 FK vers Employee sont en CASCADE (présences, shifts, congés, primes, historique de salaire) — un hard delete les emportait, seuls les BULLETINS étant protégés par un `Restrict`. ⚠️ **Ce que l'absence coûte, assumé** : aucun chemin d'API n'efface plus une fiche ; `Employee.deletedAt` existe au schéma et n'est utilisé par personne — c'est la voie douce si le besoin revient. Verrous : `hrEmployeeDeactivate.test.tsx` (7) · le cas « la route n'existe plus » de `payrollPersistence.test.ts`, avec témoin discriminant (un 404 seul ne prouve rien).
- **Photo produit** ⚠️ **PIÈGE DE NOM — `StockForm.image` EST L'ÉMOJI, PAS LA PHOTO.** Il part en `emoji` et il est **préfixé au nom** (`form.image + ' ' + form.name`, `Stock.tsx`) ; `Product.image` porte une URL. Deux champs homonymes de sens **opposés**, manipulés dans les mêmes fichiers — les fondre envoie un émoji comme URL, ou écrase l'émoji par une URL. Côté domaine la photo s'appelle donc **`ProductItem.photo`**, délibérément. La photo ne transite **jamais** par `StockForm` : endpoint séparé, envoi immédiat sur un produit existant, **différé après `create`** sinon (l'échec partiel se DIT). Un rendu = `ProductThumb`. 📖 *`docs/modules.md` § Photos produit.*
