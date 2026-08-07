# La carte graphify — périmètre, coût, et pourquoi elle se périme

> Sorti de `CLAUDE.md` le 2026-08-07. La règle qui se charge à chaque session est
> restée là-bas (§ « Carte du dépôt ») ; ici vivent les mesures, l'archéologie et
> le raisonnement qui les a produites. **Lire cette page avant de retoucher
> `.graphifyignore` ou d'affirmer un chiffre de couverture.**

## Ce que la carte est, et ce qu'elle n'est pas

Le graphe **oriente**, il ne répond pas : il rend des chemins de fichiers et des
numéros de ligne, pas une chaîne causale. La lecture du code reste nécessaire pour
conclure, et c'est elle qui fait autorité. Sorties dans `graphify-out/`, **gitignoré**
— la carte ne voyage pas avec le dépôt, chacun la reconstruit.

## Passes mesurées

| Passe | Corpus | Nœuds | Arêtes | Communautés | Jetons d'entrée | Documents |
|---|---|---|---|---|---|---|
| 2026-07-31 | — | — | — | — | 134 637 | 173 (en-tête) |
| 2026-08-07 | 922 fichiers | 5 109 | 10 711 | 321 | **1 033 525** | 81 |

**Le coût suit le volume de DOCUMENTATION, pas celui du code** — le code est en AST,
coût nul. 7,7× d'une passe à l'autre, sans que le code ait grossi d'autant : ce qui
avait grossi, c'était `CLAUDE.md` et `docs/lessons/`.

## Une carte périmée décrit un territoire disparu

Mesuré : la passe du 01/08 avait **86 commits** de retard, et **29 modules de source
unique** lui manquaient — `msisdn.ts`, les trois jumeaux `defaultMarket.ts`,
`vatRate.ts`, `paymentMethods.ts`, `posMsisdnPolicy.ts`, `ratingSummary.ts`,
`pourcentages.ts`, `salePaymentModes.ts`, `categoryBreakdown.ts`. Exactement les
fichiers que `CLAUDE.md` traite comme faisant autorité.

**Une carte qui ignore les sources uniques est pire qu'aucune carte : elle répond, et
elle répond à côté.** D'où le déclencheur en deux branches — 50 commits (mécanique)
ou la création d'un module de source unique (celle qui coûte cher quand on l'oublie).

## Le « N files » de la *Corpus Check* n'est PAS la couverture

C'est le nombre de fichiers passés par l'extraction sémantique. Le rapport du 01/08
affichait « 173 files » alors que le graphe référençait **738** fichiers. Pour mesurer
la couverture, compter les `source_file` distincts de `graph.json` — jamais lire
l'en-tête.

## Périmètre mesuré le 2026-08-07, AVANT `.graphifyignore`

| | |
|---|---|
| production couverte (git-tracké, `apps\|mobile\|packages`, extensions de code) | **757 / 793** |
| fichiers du graphe, toutes natures (`source_file` distincts) | **857** |
| corpus détecté (manifeste) | **922** |

Définition exacte du dénominateur 793, pour qu'il soit **recalculable** et non
recopié : fichiers git-tracké sous `apps/`, `mobile/`, `packages/` dont l'extension
est dans `{.ts .tsx .js .jsx .mjs .cjs .sql .prisma}`. Les 36 non couverts sont
**les 35 migrations SQL + `schema.prisma`**, pour deux raisons distinctes :
`.prisma` n'est pas une extension supportée, et les `.sql` exigent `graphifyy[sql]`
(`tree_sitter_sql`, absent).

```python
# Recalcul (à lancer depuis la racine, graphify-out/ présent)
import json, os, subprocess
tracked = subprocess.run(['git','ls-files'], capture_output=True, text=True).stdout.split()
srcs = {n['source_file'] for n in json.load(open('graphify-out/graph.json'))['nodes']
        if n.get('source_file')}
E = {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.sql','.prisma'}
prod = [p for p in tracked
        if p.startswith(('apps/','mobile/','packages/'))
        and os.path.splitext(p)[1].lower() in E]
print(len([p for p in prod if p in srcs]), '/', len(prod))
```

## Ce que `.graphifyignore` a changé (2026-08-07)

Mesuré en appelant `graphify.detect.detect()` avec puis sans le fichier :

| | sans | avec |
|---|---|---|
| corpus total | 922 | **893** |
| dont `code` | 825 | **811** (−14 fixtures partagées) |
| dont `image` | 15 | **0** |
| dont `document` | 82 | 82 |
| entrées `ignored` (visibles au rapport) | 26 | **44** |
| `skipped` en ÉCHEC | 5 (dont 2 `.docx`) | **3** |

Trois familles écartées, et la raison de chacune :

**Les 15 images** — favicons, icônes PWA, splash, adaptive icon, feature graphic,
og-image, lockup, plus `docs/ux-mockups/06-abonnement-modale.png`. Valeur de graphe
nulle (aucune n'a jamais produit un nœud), coût vision réel, et la passe les
**reproposait à chaque exécution** tant qu'elles n'étaient pas exclues. La 6ᵉ maquette
est le seul cas discutable : les cinq autres sont en `.html` et restent dans le corpus.

**Les 2 `.docx`** — ils ne sont *pas* dans le corpus : `convert_office_file` échoue
faute de `python-docx`, et graphify les range dans `skipped` avec
« office conversion failed — pip install graphifyy[office] », **à chaque passe**.
Les laisser échouer était le pire des trois choix. Installer l'extra aurait été le bon
si leur contenu était vivant ; il ne l'est pas :

| fichier | contenu | jumeau markdown déjà dans le graphe |
|---|---|---|
| `docs/AUDIT_REPORT.docx` | audit au commit `79b3de09`, 25/05/2026 | `docs/audits/AUDIT_REPORT.md` — **même audit re-scoré** à `bfc2d90c` |
| `docs/HabaShop_CDC_v3.docx` | CDC v3.0, « état réel du code » au 25/05/2026 | supersédé par `CLAUDE.md` + `docs/modules.md` |

Payer une ingestion pour injecter une vérité de mai 2026 dans une carte dont tout
l'intérêt est d'être à jour, c'est acheter la régression qu'on cherche à éviter.
**Déclencheur de réouverture : un `.docx` sans jumeau markdown plus récent.**

**Les 14 fixtures de `docs/shared-fixtures/`** — dans le corpus, mais **zéro nœud** :
données pures, rien à extraire pour l'AST. Elles étaient comptées couvertes et
n'étaient lisibles par aucune requête. ⚠️ *Un fichier compté couvert et invisible au
graphe est pire qu'un fichier exclu, parce que l'exclusion se voit* — elle est listée
dans `ignored` au rapport de passe. Limite assumée : si une version future de graphify
savait extraire des nœuds de données JSON, ces fichiers y resteraient aveugles.

⚠️ **La couverture de PRODUCTION est inchangée par ces exclusions**, et c'est vérifié,
pas supposé : aucune des trois familles n'a d'extension du dénominateur 793
(`.png/.svg/.webp`, `.docx` et `.json` en sont tous absents), et aucune ne vit sous
`apps/`, `mobile/` ou `packages/` — sauf les images, qui n'y comptaient déjà pas.

## Note de mécanique

`.graphifyignore` suit la syntaxe gitignore. graphify lit `.gitignore` **puis**
`.graphifyignore` : ce dernier ne peut qu'exclure **davantage**, jamais réintroduire.
`.graphifyinclude` n'existe plus (no-op depuis que les répertoires en point sont
indexés) — pour réintroduire, il faut une négation `!` dans `.graphifyignore`.
