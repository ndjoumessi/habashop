# Densité — ce que la mesure a dit, et ce qu'elle a disculpé

*Chantier de la console Ops et des écrans applicatifs, 2026-08-06/07. Cette page porte les
mesures et le récit ; les règles survivantes vivent dans `CLAUDE.md` (§ DENSITÉ).*

**À lire avant** de retoucher la table dense d'`AdminDashboard`, `adminTableDense.test.tsx`,
le harnais `/__dev/table` ou `e2e:density`.

---

## La table dense de la console Ops — le dessin retenu

`AdminDashboard`, onglet Boutiques : une ligne par boutique, colonnes fixes (908 px) +
colonne Boutique élastique (min 240 px), lignes 40 px, en-tête **sticky** 38 px,
`tabular-nums` sur toute colonne chiffrée. `.table-wrap` / `.data-table` / `.td-num`
**existaient déjà** — pas une seconde table.

- ⚠️ **Le MRR est une COLONNE.** Il ne vivait que dans le tiroir, alors que c'est le chiffre
  pour lequel cette console existe. Au TRI, le MRR d'une fixture vaut **0** — sinon les démos
  remontent en tête d'un classement de revenus qu'elles n'alimentent pas.
- ⚠️ **Une seule cellule colorée**, l'activité, et **seulement quand elle appelle une action**
  (cliente sans vente depuis 14 j). Une fixture inactive n'appelle rien : la couleur signale,
  elle ne décore pas.
- ⚠️ **Le tri est un `<button>` dans le `<th>`**, avec `aria-sort` — un en-tête cliquable qui
  n'est pas un bouton est inatteignable au clavier et muet pour un lecteur d'écran.

## Honnêteté sur le gain — la table est PLUS HAUTE à 2560

| Largeur | Galerie de cartes | Table dense |
|---|---|---|
| 2560 | ≈ 7 par rangée, **≈ 1 620 px** pour 50 boutiques | **≈ 2 040 px** |
| 1440 | ≈ 2 626 px | **≈ 2 040 px** (**−22 %**) |

Le gain vertical est à 1440 seulement. **Le gain réel est la comparabilité et le MRR.**
Ne pas revendiquer une compacité que la mesure ne donne pas.

## Les autres défauts mesurés

- **`marginLeft:auto` dans un bandeau large** = la note part au bord droit. Mesuré :
  **~1 400 px** entre le MRR et la note qui le commente. Bandeau borné à `maxWidth: 1180`.
- **Un tiroir en `height: 100vh` sur un contenu court** produit un vide **structurel**, pas
  accidentel (~700 px). `height: auto` + `maxHeight: calc(100vh - 32px)`. ⚠️ On le
  raccourcit ; on ne le **remplit pas** de mesures inventées pour justifier sa taille.
- **Même grille d'un onglet à l'autre** : `ReportsLiveKpis` RH était en `lg:grid-cols-2` quand
  Stock/Clients tenaient en 3-4 → la taille des cartes sautait au changement d'onglet. Passé
  en `lg:grid-cols-4` ; **deux cellules restent vides, c'est le bon résultat** — on n'invente
  pas deux indicateurs pour remplir.
- **Planning** : la légende du pied répétait la barre « ASSIGNER : » à l'identique — mêmes six
  entrées, mêmes couleurs, **mêmes horaires** (`ShiftSelector.tsx:52-56` les affiche déjà).
  Retirée ; seule l'astuce de clic, absente du haut, reste.

## Le verrou structurel — et ce qu'il ne peut PAS voir

`adminTableDense.test.tsx` (10) monte le VRAI `AdminDashboard` sur **50 clientes + 3
fixtures**, avec une **assertion de couverture** (`lignes === 53`) pour qu'un `slice`
silencieux ne rende pas les autres cas verts sur un sous-ensemble, et une vérification que
chaque ligne a autant de cellules que la table a de colonnes (une ligne courte décale tout ce
qui est à sa droite — invisible à 4 lignes). **3 sabotages vérifiés** : troncature muette ·
MRR de fixture rendu comme un montant · couleur d'alerte étendue aux fixtures.

Les noms du jeu de test sont **générés** (« Boutique 01 »…), jamais empruntés à une maquette
ni à la production.

⚠️ **CE VERROU PROUVE LA STRUCTURE, PAS LA GÉOMÉTRIE — jsdom ne fait AUCUNE mise en page.**
Ni largeur, ni retour à la ligne, ni débordement. La table dense n'avait donc **jamais été
vue** : on affirmait qu'elle tient à 390 px sans l'avoir mesuré. D'où `e2e:density` —
Playwright, vrai moteur de rendu, sur un harnais `/__dev/table` qui n'existe qu'en dev.

Son absence du bundle livré est **VÉRIFIÉE, pas affirmée** : `verify:demo-flag` cherche aussi
le marqueur `__habashop_dev_table_harness__` (0 occurrence sur les 87 fichiers de `dist/`).
Le `import()` doit rester DANS la branche `import.meta.env.DEV ? … : null` — même motif que
`demo1234`, et **l'artefact décide**, pas le ternaire.

## La mesure a disculpé la table et trouvé un autre défaut

| Largeur | `.table-wrap` | Page (avant) | Page (après) |
|---|---|---|---|
| 2560 | 2512/2512 — tient | 2560 | 2560 |
| 1440 | 1392/1392 — tient | 1440 | 1440 |
| **390** | 1223/**342** — **défile, par dessin** | **421 ❌** | **390 ✅** |

À 390 px la table défile proprement dans son conteneur ; c'est la **rangée d'actions de
l'en-tête** qui atteignait `right = 431 px` et faisait défiler **la page entière**. Un
`flexWrap: 'wrap'` a suffi. *C'est exactement ce qu'on ne peut pas obtenir en affirmant.*

## Trois détecteurs d'enroulement avant le bon

Les deux premiers criaient au loup :

1. hauteur du `<td>` (41 px, padding compris) vs `line-height` (~19 px) → **vrai partout** ;
2. hauteur de contenu ÷ `line-height` → un `<td>` s'étire à la hauteur de SA RANGÉE, donc
   quand le nom de boutique voisin passe à deux lignes (colonne élastique, comportement
   VOULU) toutes les cellules mesurent deux lignes sans qu'aucune ne se soit enroulée ;
3. **le bon** mesure le **TEXTE** : `Range.getClientRects()` rend un rectangle **par ligne
   rendue**.

2 sabotages vérifiés (`nowrap` retiré d'une cellule monétaire → 1 rouge · `overflow-x` retiré
du conteneur → 3 rouges).

## Le workflow densité en CI

Depuis le 2026-08-07 (`density.yml`, filtré par `paths:`). Preuve sur runner, pas
affirmation : le `webServer` **démarre** (`> vite`, ready 439 ms — jamais réutilisé,
`reuseExistingServer: !process.env.CI`), 4 tests en **9,8 s**, job **64 s** au total dont
43 s d'installation.

⚠️ La géométrie mesurée sur Ubuntu diffère de **9 px** du macOS local à 390 px (`.table-wrap`
1232 vs 1223) — rendu de police. **L'assertion porte sur le DÉBORDEMENT et l'enroulement,
jamais sur un pixel exact** : c'est ce qui la rend portable.

## La boucle de mesure — ⚠️ CETTE SECTION ÉTAIT VRAIE, ELLE NE L'EST PLUS

Elle disait : *« Nelson EST la session authentifiée — il envoie une capture, la mesure se fait
sur l'image. Un chantier de densité sans les deux captures n'a pas de mesure. »*

**Faux depuis le 2026-08-15.** `e2e/dev/ecrans.ts` amorce la session dans `localStorage`
(`seedEcran`) et `ouvrirEcran` navigue vers n'importe quel chemin, `/__dev/table` compris. Ces
écrans se mesurent et se capturent **tout seuls**, à chaque exécution, sur un vrai moteur de
rendu. La contrainte n'a jamais été technique : elle était **supposée**, écrite une fois, et
plus jamais réexaminée — pendant ce temps le harnais qui la levait existait déjà dans le dépôt.

*C'est le motif du « commentaire qui invente un repli », appliqué à une limite plutôt qu'à une
capacité : une affirmation plausible, jamais exécutée, qui a orienté une méthode de travail
entière.* La leçon opératoire : **une limite déclarée se re-teste comme une garantie déclarée.**

Verrou : `e2e/dev/ecrans-gestion-density.spec.ts` — console Ops, Rapports, RH et Planning à
2560/1440/390, débordement + enroulement + redondance, avec témoin positif par écran.

## Le job CI (mesures, 2026-08-07)

`density.yml`, filtré par `paths:` — **4 tests, job 64 s**. ⚠️ La géométrie diffère de **9 px
entre Ubuntu et macOS** : c'est pourquoi l'assertion porte sur le DÉBORDEMENT et l'enroulement,
**jamais sur un pixel exact**. Un seuil en pixels exacts serait vert sur une machine et rouge
sur l'autre — et c'est le runner qui aurait raison, pas la page.


---

## Passe du 2026-08-15 — ce que la mesure autonome a trouvé

Les cinq défauts de 2026-08-06/07 ont été **revérifiés dans le code** : tous corrigés. Ce qui
suit est ce que la mesure a trouvé EN PLUS, une fois qu'elle a pu tourner seule.

| Écran | Défaut | Nature |
|---|---|---|
| Planning | `T.clearTip` rendu **deux fois** (barre du haut + pied) | redondance |
| RH | libellé « Dept » au-dessus du **vide** | l'absence ne se disait pas |
| RH | `deptColor` = `'var(--p)'` **concaténé** avec une alpha → fond et bordure DISPARUS | CSS invalide |
| RH | `depts` embarquait `undefined` → `<option key={undefined}>` | avertissement React à chaque rendu |
| Rapports | « **1 MODES** » | pluriel qui ne suit pas le compte |
| Activity | `moduleColor` = `'var(--text3)'` concaténé — **même défaut, autre fichier** | trouvé par le verrou étendu |

⚠️ **Le pied du Planning est le cas le plus instructif.** La correction de 2026-08-07 avait
retiré la légende des six postes en GARDANT cette astuce, au motif écrit dans le code qu'elle
était « le seul élément que la barre du haut ne porte pas ». `PlanningFilters.tsx:45` rend
`{T.assignTip} · {T.clearTip}` — les deux. *Le raisonnement était juste, sa prémisse ne l'était
pas, et rien ne l'avait vérifiée.*

⚠️ **Et les deux `var(--…)` concaténés étaient un piège DÉJÀ documenté**, avec un verrou
(`noVarInConcatenatedColor.test.ts`) qui ne voyait que la forme `${objet.champ}NN`. La forme
`const c = MAP[k] ?? 'var(--x)'` puis `${c}NN` lui échappait — c'est le REPLI qui était fautif,
pas la table, dont tous les membres sont des `#hex`. Le second axe ajouté ce jour-là a trouvé
la seconde instance **immédiatement**, dans un fichier que personne ne regardait.

⚠️ **Trois détecteurs de mesure ont été faux avant d'être justes**, ce jour-là encore : la zone
de contenu ne matchait rien sur `/__dev/table` (trois mesures sur douze ne mesuraient RIEN et se
lisaient « propre ») ; les « coupables » de débordement comptaient la barre latérale off-canvas ;
et le détecteur de vide mettait son curseur au bas de page dès le premier conteneur pleine
hauteur, si bien qu'il ne trouvait **jamais** de trou. *Un détecteur qui rend zéro doit prouver
qu'il sait rendre autre chose.*


## La carte MRR — et la fixture qui décrivait un écran inexistant

Signalée comme « ~1 250 px de vide » d'après une capture du harnais. **La mesure a d'abord
disculpé à moitié, puis accusé.**

Le harnais rendait `mrr: 640_000` quand `AdminDashboard` lit `mrrXof`, `mrrParPlan` et
`fixtureTenants` (`routes/admin.ts:109-112`). Les trois valaient `undefined` : le bandeau
affichait « 0 FCFA · Aucun plan facturé » et **taisait complètement le troisième bloc**.
*Un harnais de GÉOMÉTRIE nourri d'une forme périmée mesure la géométrie d'un écran qui
n'existe pas* — et c'est sur cette base que le « vide » avait été rapporté.

Fixture corrigée depuis la ROUTE (pas de mémoire), remesure :

| Largeur | panneau | contenu | vide | remplissage |
|---|---|---|---|---|
| 2560 (avant) | 2512 | 947 | **1 533** | 36 % |
| 1440 (avant) | 1392 | 947 | 413 | 68 % |
| 2560 / 1440 (après) | 1180 | 947 | 201 | **80 %** |

**On RÉTRÉCIT, on ne REMPLIT pas.** Les KPI (segments, churn) ont été retirés à l'étape 2
comme « des chiffres qu'on regarde sans pouvoir agir dessus » : les rappeler pour occuper la
place aurait défait une décision produit, et la règle du tiroir l'interdit déjà.

⚠️ **Coût assumé et écrit** : à 2560 la carte (1 180) est plus étroite que le panneau
Activation en dessous (2 512). On lit une bande de SYNTHÈSE au-dessus d'un panneau de DÉTAIL.
C'est un choix, pas une fatalité — si Nelson préfère l'alignement, la conversation est ouverte.

Verrou sans pixel absolu (portable Ubuntu/macOS) : **le vide ne doit pas dépasser la largeur
du contenu**, plus une garde « contenu > 500 px » qui rougit si la fixture redevient périmée.
Les deux sabotages ont dû être joués SÉPARÉMENT — la garde de fixture rougissait la première
et masquait celle du remplissage.

---

## Sortie de recharts — mesure d'abord, migration ensuite (2026-08-15)

| | avant | après |
|---|---|---|
| chunk `charts` livré | **107 808 o gz** | **18 650 o gz** (−82,7 %) |
| dépendance | `recharts@2.12.7` | `@visx/shape` + `@visx/scale` |
| points d'appel | 3 fichiers, 2 formes | inchangé |

**La mesure a précédé la décision.** Une sonde jetable (`@visx/shape` + `scale` + `axis` +
`group`, React externalisé) a donné un plancher de **28 404 o gz**. Le résultat final est
plus bas parce que `@visx/axis` et `@visx/group` se sont révélés inutiles : les axes tiennent
en vingt lignes de SVG dans la primitive, et le `<g transform>` est natif.

### La décision de conception qui a limité le risque

⚠️ **Les CONTRATS de recharts sont conservés à l'identique.** Le renderer d'étiquettes reçoit
toujours `{cx, cy, midAngle, innerRadius, outerRadius, index}`, l'infobulle toujours
`{active, payload}`. Conséquence : `makeDonutLabel`, `CatTooltip`, `CustomTooltip` et
`CustomPayTooltip` n'ont **pas changé d'une ligne**.

*Ce sont des graphiques d'ARGENT. Une migration qui réécrit la plomberie ET les formules
d'affichage en même temps rend toute régression indémêlable.* On change une chose.

Seule subtilité, écrite dans le fichier plutôt que redéduite : visx compte en radians depuis
midi, sens horaire ; recharts en degrés depuis 3 h, sens trigonométrique — d'où **m = 90° − a**.

### Ce que la vérification a coûté avant de valoir quelque chose

⚠️ **Premier tir : VACANT.** Le Dashboard rendait son état vide (aucune vente dans le
harnais), donc « 0 anneau, 0 aire » — et le test passait. *Un harnais qui ne fournit pas la
donnée ne teste pas l'absence de défaut, il teste l'absence d'écran.*

⚠️ **Deuxième tir : la moitié.** J'ai posé `categoryBreakdown` sur `/api/reports/sales` alors
que le composant le lit dans la réponse de `dashboardApi.stats()`. L'aire apparaissait, le
donut restait invisible. Deux fixtures périmées ou mal placées dans la même journée, après
celle du MRR : **le harnais est du code, il se périme comme le reste.**

Les seuils du verrou sont donc **strictement positifs et exacts** (4 secteurs sur le
Dashboard, 1 sur Rapports) : ils échouent sur un écran vide, pas seulement sur un écran faux.

### Ce qui reste vrai à l'écran

Étiquettes du donut Dashboard : **47 / 29 / 15 / 9** — identiques à la légende, somme 100.
L'invariant « la géométrie et le chiffre écrit dessus sont le même nombre, par construction »
survit à la migration, parce que c'est toujours notre série d'entiers qui alimente l'angle.

### Les trois specs E2E étaient couplés aux classes internes de recharts

`.recharts-surface`, `.recharts-pie-sector`, `.recharts-tooltip-wrapper`,
`.recharts-xAxis .recharts-cartesian-axis-tick-value` → remplacés par des `data-testid`
stables. ⚠️ Une différence de comportement est **assumée et écrite** : recharts gardait le
conteneur d'infobulle monté en permanence et basculait sa `visibility` ; la primitive le
monte au survol et le démonte à la sortie — plus honnête pour un lecteur d'écran. Le spec
exige donc l'attachement **après** un premier survol, pas avant.
