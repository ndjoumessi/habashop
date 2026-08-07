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

## La boucle de mesure — Nelson EST la session authentifiée

1. Claude propose la mise en page avec les **valeurs visées écrites** (largeur max,
   gouttières, hauteur de tiroir) ;
2. Nelson envoie une capture de `/admin` à 2560 et 1440 ;
3. la mesure se fait **sur l'image**, avant et après.

Un chantier de densité sans les deux captures n'a pas de mesure, donc pas de résultat.

## Le job CI (mesures, 2026-08-07)

`density.yml`, filtré par `paths:` — **4 tests, job 64 s**. ⚠️ La géométrie diffère de **9 px
entre Ubuntu et macOS** : c'est pourquoi l'assertion porte sur le DÉBORDEMENT et l'enroulement,
**jamais sur un pixel exact**. Un seuil en pixels exacts serait vert sur une machine et rouge
sur l'autre — et c'est le runner qui aurait raison, pas la page.
