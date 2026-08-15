# Marché par défaut — Cameroun / XAF / +237

> ⚠️ **DÉPLACÉ DE `CLAUDE.md` LE 2026-08-15, SUR DÉCISION DE NELSON.** Ces règles ne se chargent
> plus à chaque session ; le déclencheur resté dans `CLAUDE.md` dit quand venir ici.
> **À LIRE AVANT de toucher** `defaultMarket.ts` (3 jumeaux), `dialCodeFor`, une liste de pays ou un défaut de devise.
>
> Texte repris **VERBATIM** — aucune reformulation, pour qu'aucune nuance ne se perde au passage.

### Marché par défaut ⚠️ — SOURCE UNIQUE `defaultMarket.ts`

**DÉCISION PRODUIT du 2026-08-06 : Cameroun / XAF / +237.** Motif MESURÉ — les seuls
prestataires câblés ET appelables sont camerounais (Campay est en politique `cm-only`,
MTN MoMo est camerounais) ; **Wave est sénégalais et n'a aucune clé**, Orange non plus.
Un commerçant qui s'inscrivait avec les valeurs par défaut obtenait SN + XOF, puis se
voyait proposer le seul chemin de paiement qui ne fonctionne pas.

Fixture `docs/shared-fixtures/default-market.json` + **TROIS jumeaux**
(`apps/{frontend,backend}/src/lib/defaultMarket.ts`, `mobile/src/lib/defaultMarket.ts`),
lus à l'exécution — contexte Docker oblige.

⚠️ **XOF → XAF n'a AUCUN effet sur les montants**, vérifié dans le code et non supposé :
`TO_XOF_RATES` XOF:1 / XAF:1 · `CURRENCY_DECIMALS` 0 / 0 · symbole « FCFA » des deux
côtés. `lib/plans.ts` ne dépend pas du code de devise (`XOF` n'y nomme que l'unité de
base). Aucun recalcul, aucun prix ne bouge.

⚠️ **L'INDICATIF N'EST PAS UNE CONSTANTE — il se DÉRIVE de `tenant.country`.** Corriger
`useState('+221')` en `useState('+237')` aurait créé une SEPTIÈME valeur par défaut au lieu
d'en supprimer six. `dialCodeFor(country)` (+ `useTenantDialCode`) rend le préfixe du pays
DÉCLARÉ ; `DEFAULT_MARKET.dialCode` n'est que le repli. Une boutique de Dakar ne doit pas
plus recevoir +237 qu'une boutique de Douala ne devait recevoir +221. ⚠️ **Ce n'est pas une
inférence de pays** : on part d'un pays connu pour proposer un préfixe, on ne devine pas le
pays d'un numéro — et `resolveRecipient` reste seul juge côté serveur. On corrige la CAUSE
(un préfixe faux proposé au caissier), pas le symptôme : **ne pas retirer la garde serveur**.

⚠️ **`dialCodeFor` prend `unknown`, pas `string | null`.** Le pays vient d'un JSON d'API et
d'un store persisté : le typer `string` est une AFFIRMATION, pas une garantie — un objet y
est arrivé et a fait lever `.toUpperCase()`. Même raisonnement que `resolvePlanId(raw: unknown)`.

**Ce que le verrou distingue** (`defaultMarket.test.ts`) : un DÉFAUT (ce qu'on obtient quand
personne n'a choisi) d'un MEMBRE DE LISTE (`countryList.ts` contient légitimement `'SN'`) et
d'un REPLI D'AFFICHAGE (`tenant.currency ?? 'XOF'` rend une devise absente, il ne décide
d'aucun marché — **décision explicite : on les laisse**, ils sont exemptés par raison nommée
sur une fenêtre de ±3 lignes, pas par fichier). Il vise la FORME (`??` · `||` · `useState` ·
champ de formulaire · const `DEFAULT_*`), jamais l'identifiant. Sabotages COPIÉS depuis
`fixtures/default-market-avant.txt`, extrait par `git show`.

⚠️ **Un verrou justifié par la MESURE, pas par principe** — et c'est l'inverse de l'arité des
ternaires : là-bas 1 211 chaînes sur 1 268 étaient correctes et un scanner aurait crié au
loup ; ici la quasi-totalité des occurrences était à corriger.

⚠️ **SIX listes de pays, pas cinq.** La sixième (`Onboarding.tsx`) est un **tableau de tableaux**
que la détection par forme, qui cherchait `{ iso: … }`, n'a **PAS** vue — trouvée à l'inventaire
de l'imaginaire, pas par le scanner. **Limite assumée** : les listes sont exemptées au FICHIER,
un vrai défaut ajouté dedans passerait.

⚠️ **Deux tests figeaient le défaut d'hier** et ont rougi alors que rien n'était cassé :
`signup.anchor` exigeait « Sénégal » en dur, il lit désormais `DEFAULT_MARKET`. Un test qui
nomme le défaut au lieu de le dériver devient un frein au changement qu'il devrait garder.

⚠️ **Piège d'insertion d'import, rencontré DEUX fois dans ce chantier** : ajouter un `import`
après « la dernière ligne qui commence par `import` » le place **à l'intérieur** d'un bloc
`import {` multi-ligne → TS1003 en cascade. Ancrer sur la fin du bloc (`} from '…'`), ou
balayer après coup : `if (/^import\s/.test(l) && /^import (type )?\{\s*$/.test(lignePrécédente))`.

**Preuve de non-régression** : le basculement ne touche **AUCUN** tenant existant — vérifié sur
tenant jetable (`verif-market-tmp`, détruit, orphelins 0). ⚠️ La valeur de l'empreinte a été
perdue à une compression : elle se **RECALCULE** — hash du
`(id, country, currency, vatRate, updatedAt)` des 4 tenants, trié par id. *Une assertion dont on a supprimé le moyen de
vérification n'est plus une preuve, c'est une affirmation.*

