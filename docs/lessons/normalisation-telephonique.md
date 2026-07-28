# Leçon — normalisation téléphonique (chantier RÉSOLU à la 5ᵉ tentative)

> Extrait de `CLAUDE.md` le 2026-07-28 pour l'alléger. **Rien n'a été supprimé** : ce
> fichier est le POURQUOI intégral (4 tentatives, 3 fuites annulées, faits mesurés sur
> `libphonenumber-js`). Le QUOI opérationnel — la conception en place et les invariants —
> reste dans `CLAUDE.md` § « Normalisation téléphonique », qui pointe ici.
> **À lire AVANT toute retouche** de `lib/spend/recipientPhone.ts`, `twilioClient`,
> `smsClient`, ou de la surface d'envoi WhatsApp/SMS.

---

### ⚠️ Chantier NORMALISATION téléphonique — RÉSOLU à la 5ᵉ tentative. Lire avant de retoucher.

**Une normalisation EST désormais en place** (PR #100, `lib/spend/recipientPhone.ts`
`resolveRecipient`) — après **4 échecs** dont **3 fuites** annulées. Ce qui a marché,
et qui manquait aux quatre premières : poser la question **AVANT** la bibliothèque —
« à qui appartient ce numéro ? » — via un **paramètre `owner` OBLIGATOIRE** sur
`sendWhatsApp` (`{ kind:'merchant', country } | { kind:'customer' }`) :
- **flux commerçant** (`ownerPhone`, crons) → normalisable avec `tenant.country`
  UNIQUEMENT si `isSupportedCountry()` ; sinon refus `COUNTRY_UNKNOWN` ;
- **flux client** (reçu, send-ticket, send-alert, broadcast, campagne) → AUCUNE
  inférence de pays ; on n'accepte qu'un `+` littéral que `isValid()` valide, sinon
  refus `PHONE_NOT_INTERNATIONAL`/`PHONE_INVALID` ;
- le refus REMONTE (`SendResult.refused[]`) → 422 « format international requis », jamais
  un `+` deviné vers Twilio.
Le compilateur force `owner` sur tout futur appelant ; les pré-transformations amont
(`00→+`, `replace(/^0/)`, `+` collé, le mapping des campagnes) sont **supprimées** — le
goulot `resolveRecipient` est la seule autorité. Verrous : `phoneCollision.test.ts`
(harnais de collision, 2 sabotages) + `phoneChokepoint.test.ts` (méta-test : `libphonenumber-js`
interdit hors du résolveur, motifs de fabrication `'+' +`/`` `+${…}` ``/`replace(/^0/)`
interdits sur la surface d'envoi — **résidu assumé** : un motif de fabrication INÉDIT
passerait, la couche solide est `owner` obligatoire + relancer le harnais sur tout nouveau
chemin). **Ne PAS revenir sur cette conception** ; l'historique ci-dessous est le POURQUOI.

Les quatre tentatives précédentes, dont trois fuites de données annulées :

| # | Commits | Annulé par | Ce qui fuyait |
|---|---|---|---|
| 1 | `7fe8b4e7`/`da26197e` (`lib/spend/phone.ts`) | `1ae8f9c0` | table `trunkZero` écrite à la main + repli Sénégal → numéro mal formé réécrit en **SN valide**, donc livré |
| 2 | `18cc6eb9` (`lib/phoneE164.ts`) | `77d954f6` | `Tenant.country` appliqué au numéro du **DESTINATAIRE** |
| 3 | `f447a462` (`SendAudience`) | `61f94c7d` | la réécriture `00`→`+`, pourtant documentée « sans supposition de pays » |

Chaque fois : avant, Twilio rejetait (21211) et **rien ne partait** ; après, un numéro
**valide d'un autre pays** était fabriqué et **livré**. Reçus clients et résumés de
commerçants expédiés à des inconnus.

#### Faits MESURÉS — ne pas les re-dériver, ils ont coûté trois fuites

Vérifiés sur `libphonenumber-js` 1.13.9. Chacun infirme une garantie qui « allait de soi » :

- **Le pays du commerçant n'est PAS une information sur le numéro de son CLIENT.**
  `isValid()` ne sépare que des plans **disjoints**. Collisions réelles :
  `621234567` est valide en **CM** (`+237…`) *et* en **GN** (`+224…`) ; `76123456` est
  valide simultanément en **ML, BF, NE, TG**. Une boutique camerounaise avec une cliente
  guinéenne fabriquait donc un `+237…` réel appartenant à un tiers.
- **La bibliothèque FABRIQUE, elle ne refuse pas.**
  `parsePhoneNumberFromString('0701234567','SN')` renvoie un objet **non nul** dont
  `.number` vaut `+2210701234567`. Seul `isValid()` (faux ici) l'écarte. Renvoyer
  `.number` sans exiger `isValid()` = la fuite d'origine, à l'identique.
- **`00`→`+` n'est PAS une réécriture « purement syntaxique ».** Elle suppose que les
  chiffres suivants commencent par un indicatif pays. `00622123456` → `+622123456`,
  numéro **indonésien valide**. Une caissière à qui l'UI dit « format international »
  tape le préfixe qu'elle connaît, et le reçu part à Jakarta.
- **« Twilio rejettera un numéro mal formé » est FAUX.** `+622123456` est valide.
  Préfixer `+` à l'aveugle produit des numéros étrangers **livrables**. Donc
  *« on ne normalise pas »* ne vaut **jamais** *« on n'envoie pas »* : il faut refuser
  d'envoyer explicitement.
- **Le zéro de tête n'est pas uniforme** : CI/BJ/**CG** le CONSERVENT
  (`061234567` → `+242061234567`), **GA** le RETIRE (`062345678` → `+24162345678`).
  D'où l'interdiction de toute table écrite à la main.

#### Invariants pour la reprise

1. **Pays inconnu ou absent → on NE normalise PAS.** Jamais de repli, surtout pas SN.
2. **On n'envoie QU'À un E.164 validé.** Non résolvable ⇒ destinataire écarté, pas un `+`
   deviné. Un message non envoyé est bénin ; un message au mauvais destinataire est une fuite.
3. **Séparer les flux** (fondation, validée avec Nelson) : numéro lu dans `Tenant.ownerPhone`
   ⇒ normalisable avec le pays de la boutique ; **toute autre provenance** (fiche client,
   corps de requête, liste de diffusion) ⇒ international EXIGÉ, aucun pays consulté. Le flux
   se déduit de la **PROVENANCE**, jamais de l'intention — `send-alert` reçoit son numéro du
   corps de requête, donc c'est un tiers.
4. **`libphonenumber-js` est nécessaire mais PAS suffisant** : c'est le gate `isValid()` +
   la séparation des flux qui protègent, pas la bibliothèque.

#### État réel des données (lecture seule, 2026-07-23)

- `Tenant.country` : `String @default("SN")` **non nullable**, + `country ?? 'SN'` dans
  `auth.ts:166` / `admin.ts:62` / `tenant.ts:65`, + `SignupPage.tsx:29` pré-sélectionne SN.
  « Pays absent » **n'existe pas en base** : un tenant ivoirien qui n'ouvre jamais la liste
  est stocké « SN ». Pire, `Onboarding.tsx` PATCHe des **noms français** là où `SignupPage`
  envoie de l'ISO-2 → prod contient `CI`, `SN` et **`France`**. `sales.ts` ne lit pas le champ.
- **`Customer` n'a AUCUN champ pays** → aucune donnée ne permet de résoudre un national de client.
- **9 téléphones clients sur 9 sont déjà internationaux** en prod → l'exposition actuelle est
  nulle, mais rien ne la maintient ainsi.

#### Défauts PRÉEXISTANTS — TOUS RÉSOLUS (sous-surfaces 1 & 2, PR #100/#102/#105/#106)

Les quatre invariants ci-dessus sont désormais IMPLÉMENTÉS par `resolveRecipient`. Et
toute la dette qui les entourait a été traitée :

- ✅ `twilioClient.normalize()` (`+` aveugle) et send-alert `replace(/^0/)` → **SUPPRIMÉS**,
  remplacés par le goulot `resolveRecipient` (#100).
- ✅ `broadcast`/`campaign` normalisaient différemment → **unifiés** au goulot (#100).
- ✅ `failed: 0` quand Twilio absent + table `TWILIO_ERRORS` inatteignable → **corrigés** :
  `SendResult` compte exactement (`failed: N`) et remonte `errorCodes[]` (#102, PR A).
- ✅ créneau horaire 1/h brûlé sur un refus → **réserve-puis-libère**, consommé QUE sur un
  envoi réel (#105, PR C).
- ✅ campagnes et reçus partageaient un seau + reçu soumis au plafond minute → **deux seaux
  `SpendKind`** (`whatsapp` transactionnel / `whatsapp_marketing`) + le reçu de vente
  AUTOMATIQUE exempté de la rafale via `flow:'sale_receipt'` (#106, PR B — cf. § Garde de dépense).

⚠️ **Reste non traité** (dette `Tenant.country`, cf. « État réel des données » ci-dessus) :
la prod contient `CI`/`SN`/`France` (`Onboarding` PATCHe des noms FR). `resolveRecipient`
s'en protège (`isSupportedCountry()` écarte « France » → refus `COUNTRY_UNKNOWN`), mais le
CHAMP reste incohérent — à normaliser en ISO-2 dans sa propre surface si le flux commerçant
doit couvrir ces tenants.

#### ⚠️ Méthode — la leçon la plus chère

**Ne JAMAIS poser une garantie de sûreté par RAISONNEMENT sur ce code.** Les trois échecs
ont le même motif : une affirmation plausible (« un pays fiable protège », « Twilio
rejettera », « `00` ne suppose rien ») écrite en commentaire et jamais exécutée. Les trois
fois, un script de dix lignes appelant la bibliothèque l'aurait démentie **avant** le commit.
**Mesurer d'abord, coder ensuite** — et si un commentaire affirme une propriété de sûreté,
un test doit l'exercer.

Corollaires : une surface à la fois, revue entre chaque, on ne clôt que sur une revue qui
revient **vide**. Un test « gardien » doit être vérifié **dans les deux sens** — celui de la
tentative 2 restait vert parce que son cas échouait par la **longueur** des plans (CI 10
chiffres vs SN 9), pas par un garde réel : toute la moitié dangereuse (plans qui se
recouvrent) n'était pas testée.
