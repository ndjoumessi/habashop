# Normalisation téléphonique — chantier CLOS

> ⚠️ **DÉPLACÉ DE `CLAUDE.md` LE 2026-08-15, SUR DÉCISION DE NELSON.** Ne se charge plus à chaque
> session ; le déclencheur resté dans `CLAUDE.md` dit quand venir ici.
> **À CONSULTER quand on touche** `recipientPhone.ts`, `twilioClient`, `smsClient`, `lib/country.ts` ou la surface d'envoi.
>
> Texte repris **VERBATIM** depuis `CLAUDE.md` — aucune reformulation.

### ⚠️ Normalisation téléphonique — chantier CLOS. **Ne PAS re-concevoir.**

📖 **POURQUOI intégral : `docs/lessons/normalisation-telephonique.md`** — 4 tentatives, dont
**3 fuites de données annulées** (reçus clients et résumés commerçants livrés à des inconnus),
et les faits MESURÉS sur `libphonenumber-js` qui les expliquent. **Lire ce fichier AVANT de
toucher** `recipientPhone.ts`, `twilioClient`, `smsClient` ou la surface d'envoi.

**La conception en place** (PR #100, `lib/spend/recipientPhone.ts` `resolveRecipient`) : la
question se pose **AVANT** la bibliothèque — « à qui appartient ce numéro ? » — via un paramètre
**`owner` OBLIGATOIRE** sur `sendWhatsApp`/`sendSms` (le compilateur le force à tout futur appelant) :
- **flux commerçant** (`ownerPhone`, crons) → normalisable avec `tenant.country`, UNIQUEMENT si
  `isSupportedCountry()` ; sinon refus `COUNTRY_UNKNOWN` ;
- **flux client** (reçu, send-ticket, send-alert, broadcast, campagne) → **AUCUNE inférence de
  pays** ; seul un `+` littéral que `isValid()` valide passe, sinon `PHONE_NOT_INTERNATIONAL`/
  `PHONE_INVALID`. Le flux se déduit de la **PROVENANCE**, jamais de l'intention (`send-alert`
  reçoit son numéro du corps de requête ⇒ c'est un tiers) ;
- le refus **REMONTE** (`SendResult.refused[]`) → 422, jamais un `+` deviné vers Twilio.

`resolveRecipient` est la **seule autorité** : toutes les pré-transformations amont (`00→+`,
`replace(/^0/)`, `+` collé, mapping des campagnes) sont supprimées. Verrous : `phoneCollision.test.ts`
(harnais de collision, 2 sabotages) + `phoneChokepoint.test.ts` (méta-test : `libphonenumber-js`
interdit hors du résolveur, motifs de fabrication interdits sur la surface d'envoi — **résidu
assumé** : un motif INÉDIT passerait ; la couche solide est `owner` obligatoire + relancer le
harnais sur tout nouveau chemin).

⚠️ **Les trois intuitions qui ont causé les fuites, toutes MESURÉES fausses** (détail + chiffres
dans le fichier de leçon) : le pays du commerçant n'informe **pas** le numéro de son client (plans
qui se recouvrent : `76123456` est valide en ML, BF, NE **et** TG) · la bibliothèque **fabrique**
au lieu de refuser (seul `isValid()` écarte) · « Twilio rejettera un numéro mal formé » est **faux**
(un `+` à l'aveugle produit des numéros étrangers **livrables**). Donc « on ne normalise pas » ne
vaut **jamais** « on n'envoie pas » : il faut refuser d'envoyer, explicitement.

✅ **Dette `Tenant.country` : TRAITÉE.** Le champ a contenu des LIBELLÉS français à côté d'ISO-2,
faute de validation entre `Onboarding` et `SignupPage`. Conséquence NON cosmétique :
`resolveRecipient` n'accepte que l'ISO-2, donc un tenant « France » ne recevait **ni WhatsApp ni
SMS**, en silence — *le garde faisait son travail, la donnée mentait*.

**`lib/country.ts`** (`normalizeCountry`, `SUPPORTED_COUNTRIES`) est le seul juge, appelé par les
**3** chemins d'écriture (`PATCH /api/tenant` → **400** sur l'irrésolvable, register, admin).
⚠️ **Liste blanche, PAS `^[A-Z]{2}$`** : la regex accepterait `XX`, remplaçant une valeur invalide
*bruyante* par une *silencieuse*. ⚠️ **`null` ≠ repli** — un défaut implicite sur `SN` rend
indistinguables un choix et une valeur jamais saisie. ⚠️ **Ne PAS y importer `libphonenumber-js`**
(`isSupportedCountry`) : un second point d'entrée rouvrirait ce que `phoneChokepoint.test.ts`
ferme. Table des libellés hérités conservée (une PWA en cache les envoie encore) — ensemble CLOS
de nos propres anciennes `value`, pas une inférence sur du texte libre. Front : `Onboarding` et le
champ Réglages → Boutique (qui était en TEXTE LIBRE, donc 400 garanti) passent par le sélecteur
`utils/countryList.ts`. Verrou : `tenantCountryIso.test.ts` (12, 3 sabotages). `Customer` n'a
toujours **aucun** champ pays — c'est voulu (cf. flux client).

⚠️ **Méthode — la leçon la plus chère, valable au-delà du téléphone** : ne JAMAIS poser une garantie
de sûreté par RAISONNEMENT. Les trois échecs ont le même motif — une affirmation plausible écrite en
commentaire et jamais exécutée, qu'un script de dix lignes aurait démentie **avant** le commit.
**Mesurer d'abord, coder ensuite** ; si un commentaire affirme une propriété de sûreté, un test doit
l'exercer, et être vérifié **dans les deux sens**.

