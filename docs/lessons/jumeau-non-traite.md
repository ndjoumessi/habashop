# Leçon — le jumeau non traité, et la synthèse qui invente un fait

> Extrait de `CLAUDE.md` le 2026-08-07 pour l'alléger. **Rien n'a été supprimé** : ce fichier
> est le POURQUOI intégral — les cinq jumeaux mesurés du 2026-08-06, les deux qui se cachaient
> dans un fichier déjà traité, le calibrage du verrou tarifaire, la chaîne de relais qui a fait
> naître un parc d'appareils inexistant, et le **registre des messages de commit non
> réécrivables**. Le QUOI opérationnel — la règle du jumeau, le tableau des quatre angles
> morts, la règle de sabotage et « ne pas arbitrer, compter » — reste dans `CLAUDE.md`
> § « Le jumeau non traité », qui pointe ici.
> **À lire AVANT** d'écrire un verrou à périmètre, un scanner de littéraux, ou une synthèse
> qui compresse une mesure.

---

## 1. Les cinq jumeaux mesurés

**Une correction qui s'arrête au premier fichier trouvé n'est pas une correction, c'est un
déplacement.** MESURÉ le 2026-08-06 : sur une même journée, **cinq** corrections ont laissé
un jumeau vivant, dont trois n'étaient pas dans le répertoire voisin.

| Correction | Traité | Oublié |
|---|---|---|
| Témoignages fabriqués | `components/landing/` | `components/signup/` |
| Normalisation MSISDN serveur | `campayPayment.ts` | `mtnPayment.ts` |
| Grille tarifaire source unique | frontend | **`services/email.ts`** — autre workspace |
| Réserve « paiement inactif » | vitrine | `/login` |
| Densité de colonne | `/signup` | `/login` |

⚠️ **Chercher au répertoire voisin n'attrape que la moitié.** Les deux jumeaux les plus
graves se cachaient **dans un fichier déjà traité** :
- **sous un autre NOM** — `normalizeOrangePhone` vivait quarante lignes au-dessus de l'appel
  `normalizeMsisdn` déjà fusionné, dans `POS.tsx`. Le verrou assertait `calls.length === 1` :
  il **prouvait** un site d'appel et était aveugle au second. D'où la règle : **un verrou de
  normalisation juge la FORME, jamais l'identifiant** (`msisdnShared.test.ts`, 3 règles —
  quantificateur de chiffres, ancre `^\+`/`^0`, indicatif en dur concaténé ; calibrage mesuré
  0 correspondance après / 7 avant).
- **sous une autre FORME** — le verrou tarifaire cherchait `\b8000\b` quand **toute chaîne
  visible écrit « 8 000 »** (et « 8,000 » en anglais). Zéro correspondance possible : vert par
  construction, sur un motif que personne n'emploie.

⚠️ **QUATRE séparateurs de milliers coexistent** — U+0020 (copie manuelle), **U+202F**
(`toLocaleString('fr-FR')`), U+00A0 (gabarits HTML), U+002C (`en-US`). **Normaliser AVANT de
chercher, jamais l'inverse.** Corollaire eslint : `no-irregular-whitespace` interdit ces
caractères en littéral — les écrire en `\u202f`, sinon on choisit entre le lint et la
couverture.

## 2. Le périmètre écrit à la main, et son remplaçant

⚠️ **Un périmètre ÉCRIT À LA MAIN est faux dès qu'on ajoute quelque chose**, et l'assertion de
couverture ne le dira pas : elle prouve qu'on a lu N fichiers, jamais que N était le bon N.
`landingClaims.test.ts` avait tiré la leçon (périmètre DÉRIVÉ des routes d'`App.tsx`) ; le verrou
tarifaire écrit trois heures plus tard listait à nouveau ses fichiers, et omettait `signup/` **et**
tout le backend. Son remplaçant `planPriceLiterals.test.ts` **marche sur les trois cibles**
(`apps/frontend/src`, `apps/backend/src`, `mobile/src|app`) sans aucune liste, et juge **un nombre
PRÉSENTÉ COMME DE L'ARGENT** (collé à `F CFA|FCFA|CFA|XOF|XAF`, à `"price":`, ou à `monthly:`/
`yearly:`) plutôt qu'une suite de chiffres — assez spécifique pour ignorer `setTimeout(8000)`
(mesuré : 35 occurrences sur 425 fichiers de production). **Deux exemptions NOMMÉES** : `lib/plans.ts`
(la source) et le JSON-LD d'`index.html` (aucun `<script type="ld+json">` ne peut importer un module
— vérifié par ALIGNEMENT, pas exempté).

**E-mails de cycle de vie** (`services/email.ts`) : trois d'entre eux annonçaient **24 900 F CFA/mois**,
prix d'un plan `pro` disparu, pendant que le bouton du même e-mail menait à `/app/upgrade` qui affiche
8 000 / 25 000. Une **cinquième** grille — de libellés — vivait deux fonctions plus bas
(`plan === 'pro' ? 'Pro' : 'Enterprise'`), donc toute activation Starter annonçait
« Votre plan **Enterprise** est activé ». ⚠️ **Un prix envoyé par écrit engage plus qu'un prix
affiché.** Verrou `lifecycleEmails.test.ts` (27) : monte les vraies fonctions avec Resend mocké et
lit les **octets envoyés** — prix ∈ catalogue, libellé résolu par `getPlan()`, `paymentNotice()` sur
les quatre e-mails d'avant-paiement (absente de la confirmation, à raison), **aucune marque de
paiement inactive** proposée, aucun délai de réponse chiffré. 4 sabotages vérifiés.

**Politique MSISDN du POS** (`lib/posMsisdnPolicy.ts`) : la politique est **MESURÉE sur la route
atteinte**, et le texte montré au caissier en est **DÉRIVÉ**. Orange passe par Campay ⇒ `cm-only`
(le champ promettait « 8–15 chiffres » et acceptait un numéro sénégalais que le serveur refusait —
**6 divergences sur 9 saisies**) ; MTN reste `international` (bac à sable suédois). ⚠️ Une réserve
ou un refus écrits deux fois divergent : c'est le motif des corps `phoneInvalidBody(policy)`, et
c'est pourquoi `/login` lit `pillar1_status` **de la vitrine** au lieu de recopier sa propre réserve.

## 3. L'arité, seul angle mort sans parade automatique

⚠️ **L'ARITÉ n'a pas de parade automatique, et c'est la seule des quatre dans ce cas.**
`plan === 'pro' ? 'Pro' : 'Enterprise'` : un booléen pour un domaine à **QUATRE** valeurs
(`starter`/`business`/`enterprise` + l'alias `pro`). Aucun littéral fautif à détecter, aucun
motif textuel, aucun jumeau — juste une branche qui **n'existe pas**. Les trois verrous
précédents étaient structurellement incapables de le voir ; c'est une relecture qui l'a trouvé,
et toute activation Starter annonçait « Votre plan Enterprise est activé » depuis l'alignement
tarifaire.

**La règle i18n (§ i18n, « ternaire inline 4-langues — TOUJOURS les 4, jamais binaire FR/EN »)
est le MÊME défaut, déjà écrit ailleurs sans qu'on l'ait nommé.**

Faute de verrou, la question à poser à chaque revue : **ce booléen décrit-il vraiment un domaine
binaire ?** Un `x === 'valeur' ? A : B` sur un champ qui vient d'un enum, d'un catalogue ou de la
base est suspect **par construction** — il code une bijection sur un ensemble qui grandira.
Préférer un `Record<Domaine, T>` ou un `switch` exhaustif : le compilateur rougit alors à la
cinquième valeur, ce qu'aucun test ne fera. *(Mesure de fréquence et calibrage : `CLAUDE.md`
§ « Arité des ternaires — la parade est le `Record`, PAS un scanner ».)*

## 4. La synthèse qui invente un fait

⚠️ **Le seul de ces motifs qui vive dans la DOC, pas dans le code.** MESURÉ le 2026-08-06,
chaîne complète :

| Relais | Texte | État |
|---|---|---|
| `mobile/CLAUDE.md:58` | « le seul **BUILD** store est en runtime 1.2.0 » | **vrai** |
| `CLAUDE.md:16` (racine) | « le **PARC** store est en runtime 1.2.0 » | un parc apparaît |
| commit du 2026-08-06 | formulation racine recopiée | propagé |
| analyse de revue | « des utilisateurs voient un badge vert » | amplifié |

⚠️ **Ce tableau est un HISTORIQUE, pas un pointeur** : les trois lignes fautives sont corrigées
(`CLAUDE.md:16`, `mobile/CLAUDE.md:58` et `:90` nomment désormais « le seul build store » et
comptent les installations). Ne pas aller les chercher — elles n'y sont plus. Seul le message de
commit reste tel quel, n'étant pas réécrivable.

Un mot, et des installations existent. Ce n'est ni une omission ni une fabrication : c'est une
**affirmation vraie compressée jusqu'à présupposer ce qui est faux** — et elle a franchi trois
relais sans résistance, chacun faisant confiance au précédent parce qu'il était plus récent, pas
parce qu'il était mieux étayé. La mesure a tranché : **zéro installation réelle** (1 seul
`PushToken` en prod, sur `demo-tenant-001`, l'appareil de test), donc la réserve « l'application
mobile n'est pas encore publiée » de la vitrine est EXACTE.

## 5. Traces NON RÉÉCRIVABLES — messages de commit portant une affirmation fausse

Un message de commit ne se corrige pas. Il se **RECENSE**, sinon il redevient une source :
c'est un texte daté, signé, que `git log` remonte en premier et qu'on relit sans le suspecter.

| Commit | Ce qu'il affirme | Ce qui est mesuré |
|---|---|---|
| 2026-08-06 (parc mobile) | « le parc store est en runtime 1.2.0 » | **aucun parc** — 1 seul `PushToken`, sur l'appareil de test |
| `01f37fe5` | « cliquet faux d'un cran **depuis `e076b7aa`**, CI rouge **en continu** » | `e076b7aa` a été poussé avec `0a07d5b5` : leur run est **VERT**, le cliquet à 209 était **JUSTE**. La CI est passée au rouge à `da31e7a9`, **le soir même** — **14 runs** depuis `e076b7aa`, **5 rouges**, fenêtre de **6 h**, **5 commits** poussés dessus. Cause : `da31e7a9`, c'est-à-dire **le même auteur, 3 h plus tôt** |
| `d73a62d4` | « si les **minutes** Actions sont épuisées, aucun correctif n'y changera rien » ; Billing → Actions renvoyé à Nelson | **impossible** : le dépôt est **PUBLIC**, minutes runner standard gratuites et illimitées. La cause réelle est une **panne Actions** (incident `critical` ouvert 15h22 UTC). Sur les 5 runs rouges, **3 n'ont exécuté aucune étape** — la moitié du « 6 h de rouge » n'était pas notre code |

⚠️ **Les deux lignes ci-dessus ont été écrites à trois heures d'intervalle, par le même auteur, dans deux commits qui prétendaient chacun corriger le précédent.** C'est le vrai enseignement : ce n'est pas une erreur isolée, c'est un RÉFLEXE — désigner une cause plausible avant d'avoir mesuré, puis l'écrire dans un fichier qui fait autorité. Les deux fois, **une seule commande** aurait tranché (`gh run list` pour dater, `gh api /repos/…` pour la visibilité). Les deux fois, elle n'a été lancée qu'APRÈS que Nelson a demandé de mesurer.

⚠️ Le motif de `01f37fe5` n'est pas la synthèse qui compresse (ci-dessus) mais son symétrique :
**attribuer à une dette HÉRITÉE ce qu'on vient soi-même d'introduire**. Il naît du même
raccourci — un cliquet trouvé faux, un commit ancien qui l'a posé, et la conclusion tirée sans
mesurer l'intervalle. La parade est identique et tient en une commande : `git log`/`gh run list`
**datent** le basculement, ils ne le supposent pas. **Un « depuis <commit> » qu'on n'a pas daté
run par run est une hypothèse, pas un fait** — et celle-ci s'est trompée de coupable.

⚠️ **Les deux affirmations en litige étaient FAUSSES toutes les deux**, et c'est le point qu'on
retient mal : « aucun build production, jamais » l'était aussi — **deux AAB `FINISHED` existent**
(1.0.0/vc2 et 1.2.0/vc3, tous deux Android, artefacts **expirés le 2026-06-26**), et **aucun build
iOS n'a jamais abouti**. Arbitrer entre deux sources contradictoires en choisissant l'une des deux
suppose qu'une au moins soit juste : ici il fallait aller mesurer.

⚠️ **NE PAS ARBITRER — COMPTER.** Corollaire écrit d'abord sous la forme « entre deux
affirmations contradictoires, arbitrer par la preuve citée, jamais par la date ». **Cette
formulation était fausse, et pour la raison même que le motif décrit** : arbitrer présuppose
qu'au moins une des deux sources soit juste. Ici les DEUX l'étaient à moitié — « le parc store en
runtime 1.2.0 » inventait une population, et « aucun build production, jamais » était démenti par
**deux AAB `FINISHED`** (`1f6bf56f` 1.2.0 canal production, `4c5d7888` 1.0.0). Choisir l'une ou
l'autre menait à une erreur dans les deux sens.

**Quand deux sources se contredisent sur une entité DÉNOMBRABLE, la contradiction n'est pas à
trancher : elle est le signal qu'aucune des deux n'a compté.** Aller compter — ici
`pushToken.groupBy` a rendu **1**, sur `demo-tenant-001`. Le parc entier tenait dans une ligne, et
six commandes ont clos six jours de doute. La date et la preuve citée sont toutes deux des
raccourcis ; seule la mesure tranche.
