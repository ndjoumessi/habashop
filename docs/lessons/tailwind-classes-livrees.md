# Leçon — Tailwind n'émet rien, et l'audit des classes livrées

> Extrait de `CLAUDE.md` le 2026-08-07 pour l'alléger. **Rien n'a été supprimé** : ce fichier
> est le POURQUOI intégral (la mesure du 2026-08-06, les cinq angles morts du scanner, le
> sabotage passé vert, la suppression des 18 modules shadcn). Le QUOI opérationnel — la règle
> « toute variante responsive s'écrit à la main dans `index.css` », le tableau des quatre cas
> et les verrous — reste dans `CLAUDE.md` § « Tailwind n'émet rien », qui pointe ici.
> **À lire AVANT** de toucher `index.css`, `tailwind.config.js`, `scripts/classAudit.mjs`
> ou `classesLivrees.test.ts`.

---

### ⚠️ TAILWIND N'ÉMET RIEN — toute classe `sm:`/`lg:` du source est MORTE

**MESURÉ le 2026-08-06 sur le CSS LIVRÉ : 0 occurrence de `lg\:grid-cols`, 0 de
`grid-cols-1`.** `tailwind.config.js` et `postcss.config.js` existent, mais `index.css` ne
porte **aucune directive `@tailwind`** (retirée pour la chaîne critique, cf. en-tête du
fichier) — donc tailwind ne génère rien, et les 14 usages de `lg:grid-cols-*` du dépôt
étaient soit **inertes**, soit **figés** à la valeur de base.

| Écrit dans le source | Ce qui s'appliquait |
|---|---|
| `grid grid-cols-2 lg:grid-cols-4` | `.grid-cols-2` existe → **2 colonnes à TOUTE largeur**, jamais 4 |
| `grid grid-cols-1 lg:grid-cols-2` | ni l'un ni l'autre n'existe → **aucune** `grid-template-columns`, cartes pleine largeur empilées |

C'est ce qui a fait qu'un correctif de grille **n'atteignait pas l'écran** : la source était
juste, l'artefact vide. Même famille que l'ordre des règles du service worker et que le
`<!--` dans une balise `<meta>` (cf. `CLAUDE.md` § « LA SOURCE EST VALIDE, L'ARTEFACT EST NUL »).

Les utilitaires manquants sont écrits **à la main dans `index.css`**, là où vivent déjà
`.grid`, `.gap-4`, `.flex` — avec de vraies media queries alignées sur les points de rupture
tailwind (640 / 1024). ⚠️ **NE PAS « réparer » en ajoutant `@tailwind base`** : le reset
écraserait toute la feuille écrite à la main. ⚠️ Toute nouvelle variante responsive doit être
**ajoutée là** — l'écrire dans un `className` ne suffit pas, et rien ne le signale.

**Verrou : `npm run verify:classes --workspace=apps/frontend`** (CI, après le build) — échoue
si un jeton de classe du code ATTEIGNABLE manque au `dist/` livré. La LOGIQUE est gardée par
`classesLivrees.test.ts` (16, **4 sabotages vérifiés**), qui REJOUE l'état d'avant depuis des
fixtures extraites par `git show` : il rougit sur les 17 utilitaires, aux fréquences exactes.
Le verrou d'artefact ne peut pas vivre dans la suite — **la CI lance `vitest` AVANT `build`**.

⚠️ **CORPUS = TOUT `dist/`, JS COMPRIS.** Les blocs `<style>{`…`}</style>` (LoginPage,
SubscriptionModal, LandingNav) partent dans le **bundle JS**. En lisant les seuls
`dist/assets/*.css`, l'audit comptait **89** jetons absents ; corpus élargi, **44**. Un
corpus trop étroit rend un chiffre faux avec l'air d'un fait — `lp-nav-login` et `login-spin`
sont ainsi ABSENTS d'`index.css` et pourtant bien livrés.

⚠️ **« Absent de la feuille » ne veut PAS dire « style manquant » — QUATRE cas, et écrire du
CSS n'est le bon geste que dans le DERNIER.** L'audit initial les confondait, et disait
d'un message de connexion qu'il était « sans style » alors qu'il était intégralement stylé
inline (vérifié sur le rendu réel : seul l'attribut `class` changeait).

| Cas | Signe | Geste |
|---|---|---|
| **poignée morte** | un `style={{…}}` complet à côté | **retirer la classe** — `login-error`, `lp-btn-ghost`, `dashboard-chart-wide` |
| **mauvais nom** | la règle existe sous un autre nom | **corriger l'APPEL** — `badge-ok`→`badge-green`, `btn-secondary`→`btn btn-ghost`. En définir un synonyme serait pire |
| **poignée E2E** | le jeton est cité dans `e2e/` | **ne rien faire** — `sub-modal`, `sub-body` sont des sélecteurs Playwright. Exemption **DÉRIVÉE** des specs, jamais listée |
| **réellement manquant** | rien ne le porte | **l'écrire** — 17 utilitaires + `form-label` |

Mesuré au passage : `badge-ok` rendait un badge **neutre** à côté d'un « Remboursé » rouge ;
`btn-secondary` laissait `cursor:auto` sur deux boutons (le pointeur vient de `.btn`, pas de
`.btn-ghost`) ; `form-label` laissait **7 libellés** de la modale Employé au style par défaut
du navigateur pendant que la modale Fournisseur voisine stylait les siens.

⚠️ **CINQ angles morts, chacun découvert en se faisant avoir** — les quatre premiers ont
produit des **faux positifs**, c'est-à-dire un verrou qui accuse du code correct, et qui se
fait désarmer aussi sûrement qu'un verrou qui laisse passer :

1. **Échappement CSS** — `lg:grid-cols-4` s'écrit `.lg\:grid-cols-4`. N'échapper que le point
   faisait remonter les **4 variantes responsives sur 12 sites**, pourtant bien livrées.
2. **Interpolation de gabarit** — le `${` en fin de ligne faisait passer `o.status` et
   `s.mode` pour des classes. Découpe par appariement, jamais une regex.
3. **Commentaires** — `skeleton.tsx` documente son usage par `<Skeleton className="h-4 w-20" />`
   en JSDoc : `h-4` et `w-20` remontaient. `codeSeul()` avant tout scan (même leçon que
   `ratingDenominator`).
4. **Code MORT** — 18 modules shadcn jamais importés portaient à eux seuls **253** jetons
   absents. Périmètre **DÉRIVÉ** du graphe depuis `main.tsx`.
5. **Faux NÉGATIF, celui-là** — les littéraux **dans** une interpolation
   (`` `badge ${x ? 'badge-green' : 'badge-red'}` ``, motif très courant) n'étaient pas
   scannés. Un commentaire affirmait qu'ils étaient « rattrapés par les tours suivants de la
   boucle » : ils ne l'étaient pas. **Trouvé par le test, pas par la relecture** — encore un
   commentaire qui invente un repli.

⚠️ **Un sabotage doit VÉRIFIER QUE LE BUILD A RÉUSSI.** Le sabotage « remettre la feuille
d'avant » est passé **vert** au premier tir : `tsc` échouait (le nouveau test importait un
`.mjs` sans déclaration, TS7016), donc `npm run build` s'arrêtait et `dist/` restait
**PÉRIMÉ** — le verrou jugeait l'artefact d'avant le sabotage. C'est le défaut même que ce
verrou garde, reproduit dans sa propre procédure de validation. D'où `scripts/classAudit.d.mts`,
et la règle : *un sabotage qui régénère un artefact doit asserter que la régénération a eu lieu.*

✅ **18 modules shadcn supprimés** (`alert-dialog` … `textarea`) — ensemble CLOS, aucune arête
sortante, aucun import hors de `components/ui/`. ⚠️ **Diff de bundle MESURÉ : ZÉRO octet**
(`js_total` 3 766 591 o identique, 81 chunks identiques) : le tree-shaking les écartait déjà.
Le gain est de **clarté**, pas de poids — ils faisaient croire à un système de design branché.
`tooltip.tsx` est réduit à `TooltipProvider` (importé par `main.tsx:5`, aucune classe rendue) ;
ses trois autres exports portaient **18 des 20 derniers jetons absents**. L'infobulle réelle du
produit est `components/ui/FocusTooltip.tsx`.
