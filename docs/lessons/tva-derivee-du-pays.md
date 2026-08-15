# TVA — le taux se dérive du pays

> ⚠️ **DÉPLACÉ DE `CLAUDE.md` LE 2026-08-15, SUR DÉCISION DE NELSON.** Ces règles ne se chargent
> plus à chaque session ; le déclencheur resté dans `CLAUDE.md` dit quand venir ici.
> **À LIRE AVANT de toucher** `lib/vatRate.ts` (2 jumeaux), `vat-rates.json` ou un `tenant.create`.
>
> Texte repris **VERBATIM** — aucune reformulation, pour qu'aucune nuance ne se perde au passage.

### ⚠️ TVA — le taux se DÉRIVE du pays, il n'a pas de valeur par défaut

**Il n'existait AUCUN mapping pays → TVA** : le taux venait du `vatRate Float @default(18)` de Prisma — le taux **UEMOA** — qu'aucun des trois chemins de création de tenant n'écrivait, si bien que **toute inscription camerounaise recevait 18 % au lieu de 19,25 %**, en silence, sur des factures.

Source unique : `docs/shared-fixtures/vat-rates.json` + **deux jumeaux**
(`apps/{frontend,backend}/src/lib/vatRate.ts`). ⚠️ **Pas de jumeau mobile** : `mobile/` ne crée
aucun tenant et ne porte aucun repli — un troisième serait du code mort.

⚠️ **CEMAC n'est PAS homogène**, contrairement à l'UEMOA. C'est tout le piège : traiter « zone
franc » comme un bloc est exactement l'erreur qu'encodait le `@default(18)`.

| | Taux |
|---|---|
| UEMOA (SN CI ML BF NE TG BJ GW) | **18** — directive d'harmonisation |
| **CM** | **19,25** = 17,5 % + 10 % de centimes additionnels communaux |
| GA | 18 |
| CG | **18,9** = 18 % + 5 % de surtaxe |
| FR | 20 — présent parce qu'un tenant de production est en FR |

⚠️ **Un pays non documenté rend `null`, et l'écriture vaut `0` — JAMAIS 18.** Sous-facturer
**bruyamment** vaut mieux que facturer faux en silence : un 0 se voit au POS dès le premier
encaissement, un 18 erroné part sur des factures sans que personne ne le remarque. Même
raisonnement que `ratingSummary` (→ `null`) et `resolvePosPayMode` (→ pas de prestataire deviné).

⚠️ **Table volontairement INCOMPLÈTE — 12 pays sur les 32 de `SUPPORTED_COUNTRIES`** (recomptés, pas recopiés : clés de `rates` dans la fixture, codes de `lib/country.ts`). On
n'inscrit que les taux SOURCÉS. La compléter au jugé reviendrait à écrire du droit fiscal de
mémoire ; **ajouter un pays impose d'en citer la source dans la fixture.**

⚠️ **Ce module ne dit pas le droit, il propose une VALEUR DE DÉPART** — le taux reste éditable
(Réglages → POS). Et **le taux standard n'est pas le taux de chaque produit** : au Cameroun les
produits alimentaires de base sont **exonérés**, donc une supérette n'applique pas 19,25 % sur
l'essentiel de son catalogue. Le produit ne modélise pas la TVA par ligne (un seul
`tenant.vatRate`) : limite **assumée et écrite**, pas masquée par un chiffre d'apparence précise.

⚠️ **Le `@default(18)` du schéma RESTE en place, et c'est délibéré** : le changer imposerait une
migration DDL sur la PROD pour un défaut qui ne doit plus jamais se déclencher. On le rend
**inatteignable** en exigeant que chaque `tenant.create` pose la valeur — vérifiable par un test,
sans toucher la base. *Un `@default` qui ne se déclenche jamais ne peut plus mentir.*

Verrous : `vatRateShared.test.ts` **des deux côtés** (back 10 / front 7, **5 sabotages**, dont
les deux sens du jumelage) — le back porte en plus les deux règles structurelles « aucun
`tenant.create` sans `vatRate` » et « plus aucun `?? 18` dans les routes », à périmètre DÉRIVÉ.

✅ **ALIGNÉ le 2026-08-09** — seul écart : le tenant FR à 18 % (la France est à 20), hérité de l'ancien `@default(18)` ; ⚠️ c'est le tenant `isPlatform` INTERNE, donc sans effet fonctionnel. `prisma/align-tenant-vat.ts` (`CONFIRM=1`) **DÉRIVE le taux de `vatRateFor(country)`** — un script qui écrirait « 20 » serait un cinquième endroit où le droit fiscal est écrit. ⚠️ Les démos ouest-africaines sont **lues, jugées concordantes, NON écrites** (18 % est correct pour SN et CI) ; un pays non documenté (`vatRateFor` → `null`) n'est jamais touché.

