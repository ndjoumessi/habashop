# HabaShop — Cahier des charges v4

**Logiciel de gestion commerciale multi-tenant pour l'Afrique francophone**

| | |
|---|---|
| Version | 4.0 |
| Date | 7 août 2026 |
| Version du produit décrite | 2.17.x |
| Remplace | `HabaShop_CDC_v3.PERIME-2026-05.docx` — **ne pas s'y référer** |

---

## Comment lire ce document

La v3 s'ouvrait sur « Document reflétant l'état réel du code ». Elle prescrivait un
déploiement manuel qui échoue et documentait comme conception voulue un défaut d'isolation
inter-tenants corrigé depuis. **Elle n'était pas incomplète : elle était fausse, avec
l'autorité d'une spécification.**

Ce document applique une seule règle, et c'est la seule chose qui le distingue de son
prédécesseur :

> **Rien n'y est affirmé qui n'ait été compté.** Chaque capacité porte son état réel, et
> l'écart entre « le code existe » et « un commerçant peut s'en servir » est écrit à chaque
> ligne plutôt que laissé au lecteur.

Les chiffres de ce document ont été **recomptés le 7 août 2026** ; l'annexe B dit comment les
recompter. Un chiffre qu'on ne sait pas recalculer n'est pas une mesure, c'est une affirmation.

### Légende d'état — elle vaut pour tout le document

| | Signification |
|---|---|
| ✅ | **Livré et atteignable.** Un utilisateur peut s'en servir aujourd'hui. |
| ⚠️ | **Livré mais NON atteignable.** Le code existe et fonctionne ; quelque chose hors du code l'empêche d'être utilisé. La cause est nommée. |
| 🧪 | **Livré en bac à sable.** Le chemin technique est complet, aucune transaction réelle ne passe. |
| ⬜ | **Non implémenté.** |

⚠️ **`⚠️` et `🧪` ne sont pas des nuances de `✅`.** Une capacité livrée que personne ne peut
utiliser vaut, pour un commerçant, exactement autant qu'une capacité absente. Les compter
ensemble est ce qui produit les « 16 modules » d'une plaquette.

---

## 1. Objet et positionnement

### 1.1 Ce que fait le produit

Une caisse et un back-office pour les commerces de détail et de demi-gros d'Afrique
francophone : encaissement, stock, clients, fournisseurs, commandes, ressources humaines,
dépenses et rapports, dans une seule application multi-boutiques.

### 1.2 La promesse centrale, et sa réserve

**« La caisse qui continue quand le réseau s'arrête. »**

⚠️ Cette promesse est **vraie et non atteignable** à la date de ce document. La file de
ventes hors-ligne existe et fonctionne — dans l'application mobile Expo uniquement. Cette
application n'est publiée sur aucun magasin ; **une seule installation existe, sur l'appareil
de test** (mesuré : `pushToken.count()` = 1). Depuis un navigateur, la caisse exige la
connexion pour enregistrer une vente.

C'est la réserve la plus importante de ce document, et les surfaces publiques la portent déjà.

### 1.3 Marché par défaut

**Cameroun — `CM` / `XAF` / `+237`.**

Ce choix n'est pas commercial, il est **contraint** : Campay et MTN MoMo sont les seuls
prestataires de paiement câblés, et tous deux desservent le Cameroun. Le produit reste
multi-pays ; c'est le défaut d'une boutique neuve qui pointe le seul marché où le paiement
peut fonctionner.

### 1.4 Base installée — mesurée le 7 août 2026

| | |
|---|---|
| Boutiques clientes | **0** |
| Tenants en base | **4** — `demo-tenant-001`, `demo-tenant-002`, `e2e-tenant`, un tenant interne FR en essai |
| Ventes de marchands réels | **0** |
| Lignes dans `Sale` | 1 911 — **toutes** issues des tenants de démonstration et de la fixture E2E |

⚠️ Toute affirmation de traction dans une version antérieure de ce document ou sur un support
commercial est sans fondement mesuré. Les surfaces publiques ont été purgées le 6 août 2026
de trois témoignages fabriqués, d'une note agrégée sur des avis inexistants et de quatre
compteurs de pays contradictoires.

⚠️ **Le chiffre à surveiller n'est pas « 1 911 ventes », c'est « 0 marchand ».** Un tableau de
bord qui agrège la base sans exclure les fixtures affiche un chiffre d'affaires qui n'est celui
de personne — c'est arrivé, et c'est pourquoi la console plateforme exclut les fixtures des
agrégats **et dit combien elle en exclut**.

---

## 2. Architecture

### 2.1 Dépôt

Monorepo unique `ndjoumessi/habashop`, issu de la fusion de trois dépôts par `git subtree`
(historique préservé) :

| Chemin | Contenu | Hors workspaces npm |
|---|---|---|
| `apps/frontend` | Web — React 18, TypeScript, Vite 8, Zustand, React Router 7 | non |
| `apps/backend` | API — Fastify 5, Prisma, PostgreSQL | non |
| `mobile/` | Application Expo | **oui** — `npm ci` à lancer dedans |
| `legal/` | Pages légales, publiées par GitHub Pages | oui |

**29 modèles Prisma, 35 migrations** appliquées.

### 2.2 Hébergement

| | |
|---|---|
| Frontend | Vercel — `habashop.vercel.app` |
| Backend | Railway — `habashop-production.up.railway.app` |
| Base | PostgreSQL (Railway) |
| Cache | Redis (Railway) |
| Erreurs | Sentry, front et back |

Redis sert **trois usages distincts**, tous mesurables dans le code : le cache des analyses et
rapports (`getCached`, TTL 300 s, 7 points d'appel dans `analytics.ts` et `reports.ts`), la
garde de dépense externe (compteurs de quota par tenant) et la limitation de débit.
⬜ **Il ne porte aucune session** — l'authentification est un JWT sans état.

⚠️ **Le déploiement ne dépend pas de la CI.** Un push sur `main` déclenche le déploiement
Railway et Vercel indépendamment du résultat des tests. C'est confortable sans client ; ça ne
le sera plus avec un. Voir §9.2.

⚠️ **Le déploiement manuel `vercel --prod` est proscrit** — redondant, il consomme le quota et
son chemin échoue. La v3 le prescrivait.

### 2.3 Isolation multi-tenant

Toute requête est scopée par `tenantId` via une extension Prisma. La console plateforme
(`/admin`) est gardée sur `isPlatformAdmin`, **jamais sur un rôle de boutique** — un gating
sur `SUPER_ADMIN` a produit une fuite inter-tenants, corrigée, et la garde est vérifiée à
trois endroits plus un test E2E qui fige l'**absence** du panneau pour un `SUPER_ADMIN` de
boutique.

⚠️ La v3 §6.3 documente le gating par rôle comme la conception voulue. C'est le défaut, pas
la spécification.

---

## 3. Modèle commercial

### 3.1 Grille tarifaire

| Plan | Mensuel | Annuel | Équivalent € | Achetable en libre-service |
|---|---|---|---|---|
| **Starter** | 8 000 FCFA | 80 000 | 12,20 € | ✅ |
| **Business** | 25 000 FCFA | 250 000 | 38,11 € | ✅ |
| **Enterprise** | sur devis | — | — | ⬜ non — `422 PLAN_QUOTE_ONLY`, oriente vers le contact |

- Abonnement annuel facturé **10 mois** — deux mois offerts.
- Essai **14 jours**, sans carte bancaire, sur tous les plans.
- Le franc CFA est le prix affiché ; l'euro est une contrepartie calculée **depuis** le FCFA à
  la parité **fixe 655,957**. Ce n'est pas une approximation de change, seulement un arrondi
  au centime.

⚠️ **Ces montants sont portés par une source unique** (`docs/shared-fixtures/plan-catalog.json`
et ses jumeaux front/back). Ils ont divergé : la vitrine annonçait 14 400 / 34 750, le tunnel
facturait 24 900 / 49 900, l'admin affichait un quatrième jeu, et les e-mails de cycle de vie
un cinquième. Un verrou compare désormais les deux côtés et échoue si un plan vendu n'existe
pas dans le tunnel.

### 3.2 Encaissement de l'abonnement

🧪 **Aucun paiement en ligne ne fonctionne.** Le tunnel automatique existe et refuse
proprement : un secret absent produit `422 PAYMENT_NOT_CONFIGURED` avec une orientation vers
le contact, **jamais un lien de paiement plausible**.

La voie opérante est manuelle : `POST /api/billing/request-plan`, puis activation par la
console plateforme. Les surfaces publiques le disent — grille tarifaire, page d'inscription et
e-mails d'avant-paiement.

### 3.3 TVA

| Zone | Taux |
|---|---|
| UEMOA — SN, CI, ML, BF, NE, TG, BJ, GW | 18 % |
| Cameroun | 19,25 % (17,5 % + 10 % de centimes additionnels) |
| Gabon | 18 % |
| Congo | 18,9 % (18 % + 5 % de surtaxe) |
| France | 20 % |

⚠️ **La table est volontairement incomplète** — **12 pays documentés sur 32 supportés**
(comptés dans `docs/shared-fixtures/vat-rates.json` et `lib/country.ts`, pas recopiés). Seuls
les taux sourcés y figurent ; compléter au jugé reviendrait à écrire du droit fiscal de mémoire.
Un pays non documenté écrit **0**, jamais 18 : sous-facturer bruyamment vaut mieux que
facturer faux en silence — un 0 se voit au premier encaissement.

⬜ **La TVA par ligne n'est pas modélisée.** Un seul taux par boutique. Au Cameroun, les
produits alimentaires de base sont exonérés : une supérette n'applique donc pas 19,25 % sur
l'essentiel de son catalogue. Le module propose une valeur de départ, éditable ; **il ne dit
pas le droit.**

---

## 4. Paiements

### 4.1 Prestataires — état réel

| Prestataire | Câblage | Secrets | État | Couverture |
|---|---|---|---|---|
| **MTN MoMo** | ✅ | présents | 🧪 bac à sable | 40+ pays MTN |
| **Campay** | ✅ | présents | 🧪 bac à sable | Cameroun, Gabon — Orange Money, Visa/MC, USSD |
| **PayDunya** | ✅ | présents | 🧪 mode test | Sénégal, CIV, Mali — Wave, Orange Money, Free Money |
| **Wave** (direct) | ✅ | **absents** | ⚠️ refus fail-closed | Sénégal |
| **Orange Money** (direct) | ✅ | **absents** | ⚠️ refus fail-closed | — |

**Aucun de ces cinq chemins ne déplace d'argent réel.**

### 4.2 Règle de sûreté

⚠️ **Un secret absent échoue FERMÉ.** Deux prestataires renvoyaient auparavant une URL de
paiement plausible vers un bac à sable lorsque leur clé manquait — un commerçant recevait un
lien crédible menant nulle part. Trois états sont désormais distingués :

| État | Condition |
|---|---|
| `live` | secrets présents |
| `simulated` | secrets absents **et** variable de bac à sable explicite — inopérant en production |
| `unconfigured` | secrets absents — refus |

Un verrou échoue si une fonction de paiement rend une URL de checkout alors que son secret est
absent et qu'aucun mode simulé n'est explicitement demandé.

### 4.3 Modes d'encaissement au comptoir

✅ Espèces · Carte · Mixte · MTN MoMo 🧪 · Orange Money via Campay 🧪 · PayDunya 🧪

La normalisation du numéro appelé est **serveur-autoritaire** : une garde de navigateur n'est
pas une garde. Une règle de nettoyage unique, deux politiques — `international` pour MTN
(son bac à sable emploie des numéros étrangers), `cm-only` pour Campay (seul pays desservi).
Le texte montré au caissier est **dérivé de la politique de la route réellement atteinte**.

---

## 5. Fonctionnalités

### 5.1 Quotidien

| | État | Notes |
|---|---|---|
| Point de vente | ✅ | Tarifs détail / demi-gros / gros par ligne, remise manuelle tracée, paiement mixte |
| Ticket 80 mm | ✅ | Impression navigateur ; sur mobile, via le service d'impression du système |
| Ticket par WhatsApp | ✅ | Twilio |
| **Vente hors-ligne** | ⚠️ | **Mobile uniquement, et l'application n'est publiée nulle part** |
| Tableau de bord | ✅ | |
| Stock & produits | ✅ | Codes-barres EAN, scan douchette ou caméra, étiquettes Avery et thermiques |
| Import de produits par fichier | ⬜ | Annoncé par erreur sur la vitrine jusqu'au 6 août, retiré |

### 5.2 Vendre

| | État |
|---|---|
| Clients, segments, carte de fidélité avec QR | ✅ |
| Historique d'achats par client | ✅ |
| Carte géographique des clients | ✅ |
| Abonnements clients | ✅ |
| Marketing WhatsApp — envoi ciblé et par segment | ✅ |

### 5.3 Gérer

| | État |
|---|---|
| Fournisseurs, notation, historique de commandes | ✅ |
| Commandes client et bons de commande fournisseur | ✅ |
| Import d'une facture fournisseur par OCR | ✅ Claude Vision — voir la réserve §5.6 |
| Employés, contrats, planning, présences, congés | ✅ |
| Paie — bulletins **gelés**, export | ✅ |

### 5.4 Analyser

| | État |
|---|---|
| Dépenses | ✅ |
| Rapports — ventes, stock, clients, finance, RH | ✅ |
| Prévisions, objectifs & KPI | ✅ |
| Assistant IA — analyses commerciales | ✅ Claude — voir la réserve §5.6 |
| Export CSV, XLSX, PDF | ✅ — voir la réserve §9.1 |

### 5.5 Configurer

| | État |
|---|---|
| Multi-boutiques, sélecteur de boutique | ✅ |
| Utilisateurs, **6 rôles**, matrice de permissions | ✅ — ADMIN, SUPER_ADMIN, MANAGER, ACCOUNTANT, HR, CASHIER |
| Journal d'activité, audit des écarts de prix | ✅ |
| API publique et documentation | ✅ |
| Console plateforme (`/admin`) | ✅ |
| Notifications push web | ⚠️ **VAPID — clés absentes de l'environnement Railway, le canal est inerte** |
| Notifications push mobile | ⚠️ Expo — application non publiée |
| Alertes de stock par SMS | ⚠️ **Africa's Talking — clé absente, le canal est inerte** |

### 5.6 Réserve sur les capacités adossées à l'IA

Les deux capacités Claude — OCR de facture fournisseur et assistant d'analyse — sont marquées
✅ parce que la clé est **présente** dans l'environnement de production
(`/api/health-extended` rend `ai: configured`). ⚠️ **`configured` dit qu'une clé est
déclarée, pas qu'un appel aboutit** — et la vérifier coûterait un appel facturé, ce que la
règle de vérification en production interdit. Leur état est donc *déclaré*, pas *mesuré* :
c'est le seul ✅ de ce document qui repose sur une déclaration.

---

## 6. Application mobile

**Expo, Android. ⚠️ Non publiée.**

| | Mesuré |
|---|---|
| Builds de production | 2 AAB, **expirés le 26 juin 2026** |
| Canal `production` | lié à aucune branche |
| Builds iOS | aucun n'a jamais abouti |
| Fiche Play Store | aucune |
| Fiche App Store | aucune |
| Installations réelles | **1** — l'appareil de test (`pushToken.count()` = 1) |

**Conséquence :** la file de ventes hors-ligne, seule capacité qui distingue réellement le
produit, n'est accessible à personne. La publication est le goulot du positionnement
commercial, pas une tâche mobile parmi d'autres.

⚠️ Deux prérequis, dans cet ordre : lier le canal `production` à une branche, puis
reconstruire (les artefacts existants ont expiré).

---

## 7. Internationalisation

- **4 langues** livrées : français, anglais, espagnol, italien.
- **6 devises** : XOF, XAF, EUR, USD, CAD, GBP. **Unité de base : XOF.**
- Format local respecté — franc CFA sans décimale, séparateur de milliers attendu.

⚠️ **XOF et XAF sont numériquement identiques** (parité 1, zéro décimale, même symbole
affiché). Leur distinction est sémantique : l'une est ouest-africaine, l'autre d'Afrique
centrale. Aucun calcul ne les sépare — ce qui rend une erreur d'attribution invisible à
l'écran.

⚠️ **Et cette erreur EXISTE, en production, aujourd'hui.** Mesuré le 7 août 2026 :
`demo-tenant-001` porte `country = SN` (Sénégal, zone UEMOA) et `currency = XAF` (Afrique
centrale). Rien ne l'a signalé parce que rien ne peut le signaler : les deux devises calculent
à l'identique. C'est la démonstration littérale du paragraphe précédent — **et la raison pour
laquelle une incohérence pays/devise doit être détectée à l'écriture, pas à l'affichage.**

⚠️ **Le symbole de devise s'affiche à la même taille que le montant.** XOF et EUR diffèrent
d'un facteur 656 : un symbole atténué rend le nombre ininterprétable, et c'est ainsi qu'un
salaire mensuel a pu s'afficher à 656 fois sa valeur.

---

## 8. Qualité

Compté le 7 août 2026 — suites réellement exécutées, pas estimées.

| | |
|---|---|
| Tests | **2 777** — 1 200 front · 1 262 back · 315 mobile |
| Suites exécutées | 254 — 109 front · 116 back · 29 mobile |
| Fichiers de test dans le dépôt | **275** sur **724** fichiers TypeScript, dont 20 specs Playwright |
| Couverture backend | **1,07** ligne de test par ligne de source (15 179 / 14 236) |
| E2E | Playwright, contre la production, tenant dédié |
| CI | GitHub Actions — 3 workflows ; `ci.yml` porte **8 jobs** |

### 8.1 Conventions exécutoires

Ce projet ne repose pas sur la relecture. Les règles qui l'ont protégé sont des **verrous** —
des tests qui échouent quand une règle est enfreinte — et chacun a été vérifié en le sabotant
délibérément. Les principales, écrites dans `CLAUDE.md` :

- Une correction s'applique à **tous les jumeaux**, jamais au seul cas signalé.
- Un verrou juge la **forme**, jamais l'identifiant — un défaut change de nom.
- Le périmètre d'un verrou est **dérivé**, jamais écrit à la main.
- Ce qui est **généré** se vérifie sur le produit livré, jamais sur la source.
- Un contrôle doit être **discriminant** : prouver qu'il trouve X *et pas* Y.
- Un affichage qui n'a qu'un seul état possible n'est pas une information.

---

## 9. Limites connues

Elles sont ici parce qu'elles ont été mesurées, avec la condition qui les rouvrira.

### 9.1 Export CSV plafonné en silence

`routes/export.ts` plafonne l'export des ventes à 1 000 lignes, sans le dire. Une boutique
faisant 1 200 ventes dans le mois en reçoit 1 000, et rien ne le signale — un CSV part chez un
comptable. Le rapport mensuel liste de même les 30 premières ventes sans l'annoncer.

**Réouverture :** le premier commerçant dépassant 1 000 ventes sur une période exportée.

### 9.2 Le déploiement n'attend pas la vérification

Un push sur `main` déploie, que la CI passe ou non. Sans client, c'est confortable ; avec un
client, c'est un chemin direct entre un commit et sa caisse.

**Réouverture :** la première boutique cliente en production.

### 9.3 Mot de passe de démonstration public

Le tenant de démonstration est ouvert. Des coordonnées personnelles réelles y ont séjourné
trois semaines avant d'être anonymisées. Un balayage hebdomadaire borne désormais la fenêtre
à sept jours ; il ne la ferme pas.

**Réouverture :** le jour où un prospect y est envoyé.

### 9.4 Modèle de données invisible à l'outillage

Les migrations SQL et `schema.prisma` ne sont pas indexés par la carte de code. Pour un projet
dont les défauts ont été majoritairement de forme de donnée, c'est l'angle mort le plus coûteux.

### 9.5 Incohérence pays / devise — gardée depuis le 7 août, valeur non corrigée

✅ Les quatre chemins d'écriture d'un tenant refusent désormais le **mauvais franc CFA**
(`400 CURRENCY_ZONE_MISMATCH`) : un pays UEMOA ne peut plus être en XAF, ni un pays CEMAC en
XOF. Le `PATCH` juge le couple **effectif** — un corps qui ne porte que `currency` est
confronté au pays déjà en base, sinon la moitié des conflits passe.

⚠️ Le garde a immédiatement exposé un second défaut, préexistant : créer une deuxième boutique
sans rien préciser produisait **CM + XOF**, le pays venant du marché par défaut et la devise
d'un littéral `'XOF'`. La devise se dérive maintenant du pays.

⬜ **La valeur en base n'est pas corrigée.** `demo-tenant-001` est toujours `SN` / `XAF`.
Le script existe et est commité (`prisma/fix-demo001-currency.ts`, `CONFIRM=1`), il attend une
validation. ⚠️ **L'écrivain du `XAF` n'a jamais été identifié** — `PATCH /api/tenant` n'écrit
aucun audit, et c'est ce trou-là qui rend la question insoluble.

**Réouverture :** l'audit des écritures sur `Tenant`, qui n'existe pas.

---

## 10. Ce qui reste à faire

Aucun de ces points n'est bloqué par le code.

| Ordre | Point | Bloqué par |
|---|---|---|
| 1 | Lier le canal OTA, puis publier l'application mobile | temps, comptes développeur |
| 2 | Ouvrir les comptes marchands Campay et MTN | prestataires |
| 3 | Secret de webhook Wave — **avec** la clé d'API, jamais l'une sans l'autre | Wave |
| 4 | Poser les clés VAPID et Africa's Talking — deux canaux livrés et inertes | — |
| 5 | Premier commerçant | — |

⚠️ **Poser `WAVE_API_KEY` sans `WAVE_WEBHOOK_SECRET` est pire que ne rien poser** : le tunnel
passerait en direct, un commerçant paierait réellement, le rappel serait rejeté faute de
signature, et son plan ne s'activerait jamais.

---

## Annexe A — pourquoi ce document existe

La v3 a été écrite le 25 mai 2026 et déclarait refléter l'état réel du code. Le 7 août, deux
de ses sections prescrivaient encore des gestes fermés depuis — dont un défaut d'isolation
inter-tenants présenté comme la conception voulue.

Un document de référence périmé ne se contente pas de ne rien dire : **il dit le contraire,
avec autorité.** C'est pourquoi la v3 a été renommée pour porter sa péremption dans son nom,
et pourquoi celle-ci est en Markdown — versionnée, diffable, lisible par l'outillage, et
jumelée au code qu'elle décrit.

**Elle se régénère, elle ne s'amende pas.** Le jour où elle sera fausse, il faudra la
réécrire depuis la source de vérité, pas la corriger par ajout — un ajout n'annule pas ce
qu'il contredit, et on lit depuis le haut.

## Annexe B — comment recompter

Un chiffre sans son moyen de recalcul redevient une affirmation à la première session. Depuis
la racine du dépôt :

| Chiffre | Commande |
|---|---|
| Version du produit | `node -p "require('./package.json').version"` |
| Tests, par suite | `cd apps/frontend && npx vitest run` · idem `apps/backend` · `cd mobile && npx jest` |
| Fichiers TS / fichiers de test | `git ls-files '*.ts' '*.tsx' \| wc -l` · idem filtré sur `.test.`, `.spec.`, `__tests__` |
| Jobs CI | `grep -cE '^  [a-z0-9-]+:$' .github/workflows/ci.yml` moins les clés de déclencheur |
| Grille tarifaire | `docs/shared-fixtures/plan-catalog.json` — source unique, jamais recopiée |
| Pays TVA / pays supportés | clés de `rates` dans `vat-rates.json` · `SUPPORTED_COUNTRIES` de `lib/country.ts` |
| Modèles Prisma / migrations | `grep -c '^model ' apps/backend/prisma/schema.prisma` · `ls apps/backend/prisma/migrations` |
| Base installée | requête Prisma en **lecture seule** — `tenant.findMany`, `sale.count`, `pushToken.count` |

⚠️ **La base installée est le seul chiffre qui exige la production.** Il se lit, jamais il ne
s'écrit : muter un tenant existant pour vérifier quoi que ce soit est interdit par les
conventions du dépôt.
