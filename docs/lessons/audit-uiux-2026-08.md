# Leçon — L'audit UI/UX du 2026-08-14/15, et le motif qui l'a dominé

> **8 livraisons**, `2.22.31` → `2.22.39`, 46 fichiers, +1 167 / −144 lignes, 5 verrous
> (44 cas), **25 sabotages joués** — dont un qui est PASSÉ, révélant un trou du périmètre.
> Ce fichier est le POURQUOI intégral : les mesures, les décisions écartées, et surtout
> **les douze fois où ma propre mesure était fausse**.
>
> ⚠️ La douzième est dans cet en-tête même : j'y avais écrit « 22 sabotages » sans les
> compter, dans un fichier dont la ligne suivante exige le contraire. Recomptés : 25.
>
> **À lire AVANT** de refaire un audit d'interface sur ce dépôt, ou d'écrire un verrou qui
> scanne `src/` à la recherche d'un motif visuel.
>
> ⚠️ **Recomptage** — chaque chiffre de ce fichier se recalcule. Les commandes sont en
> annexe. Un chiffre sans son moyen de recalcul redevient une affirmation.

---

## Le motif dominant : **quatre fois sur huit, la règle visée était MORTE**

C'est le seul enseignement qui vaut au-delà de ce chantier.

| Ce que l'audit visait | Ce qui existait vraiment |
|---|---|
| `.toggle` (44×24) | **0 point d'appel.** Le vrai interrupteur vivait en **8 exemplaires** stylés en ligne |
| `.stat-chip` (échec AA en clair) | **0 rendu.** Mort depuis toujours |
| `.tab-btn` / `.tabs-bar` | **0 rendu.** `TabBar.tsx` style tout en ligne |
| `.btn-success` (vert + texte blanc) | **0 rendu.** Seule règle CSS de ce motif, et personne ne l'appelait |

**Corriger une règle morte ne change rien à l'écran, et se déclare vert.** Le défaut réel
était toujours ailleurs, en plusieurs exemplaires, hors de la feuille.

⚠️ **La cause : j'auditais la SOURCE.** `index.css` est lisible, structuré, et il ment sur ce
que l'écran affiche. Ce qui a trouvé les vrais défauts, à chaque fois :

- **le DOM rendu** (`elementFromPoint`, `getComputedStyle`, `getBoundingClientRect`) ;
- **l'artefact livré** (`dist/assets/*.js` et `*.css`) ;
- **le texte accessible** (`button.textContent`).

Jamais la lecture du code. C'est la même famille que « LA SOURCE EST VALIDE, L'ARTEFACT EST
NUL » (`CLAUDE.md`) et que la leçon `tailwind-classes-livrees.md` — mais appliquée cette
fois au sens inverse : ce n'est pas l'artefact qui était vide, c'est **la source qui portait
des règles que l'artefact n'a jamais servies.**

**Règle qui en sort : avant de corriger une règle CSS, compter ses points d'appel dans
`src/`, dans `e2e/` ET dans le `dist/` livré, avec un témoin positif à côté.** Un scan qui
rend 0 sans témoin ne prouve rien.

---

## Les huit livraisons

### 1–2 · Cibles tactiles et plancher typographique (`b252b76f`, `7d2f30a1`)

`.btn-icon`, `.icon-btn` et `.footer-btn` faisaient déjà 44×44 et **portaient le commentaire
« touch target ≥44px »**. `.btn` (36), `.btn-primary` (38), `.btn-ghost`/`.mini-btn` (~35) et
`.btn-sm` (30) ne l'avaient jamais reçu — **220+ points d'appel contre 7 pour les icônes**.
Le correctif avait été appliqué à la forme qu'on regardait, pas à la famille.

⚠️ **44 vient d'iOS HIG / Android 48dp, PAS de WCAG.** Le critère AA 2.5.8 se contente de
24px et les anciennes valeurs le passaient déjà. Ne jamais justifier ce verrou par « conformité
WCAG » : une justification fausse se fait désarmer à la première revue qui la vérifie.

Tokens `--touch-min` 44 / `--touch-sm` 40, ce dernier **borné** aux contrôles serrés dans un
panneau. Plancher typo : **55 sites** inline à 9 / 9,5 / 10 / 10,5 px alors que l'échelle
déclare « plancher 11px (fini 8/9/10px — a11y lisibilité) ».

**Coût vertical MESURÉ** (moteur réel, harnais Stock) : ligne 66/67 → **69 px**, nombre de
lignes visibles **inchangé** (11 à 1440 px, 10 à 390 px). La table dense de la console Ops ne
contient **aucun bouton** : elle n'était pas concernée.

#### Trois angles morts successifs, chacun invisible depuis le précédent

| # | Ce qui a échappé | Pourquoi | Parade posée |
|---|---|---|---|
| 1 | `.stock-action` (36px, **51 éléments rendus**) | périmètre dérivé du NOM (`*btn*`) ; ce nom n'en contient pas | périmètre dérivé AUSSI des classes posées sur un `<button>` |
| 2 | 3 boutons de `StockInventory` stylés EN LIGNE, dont une bascule à **29×21** — sous le minimum AA 2.5.8 | aucun scan de feuille ne les voit | lecture du DOM rendu |
| 3 | `.login-eye` (32×32) et `.login-link` (**135×21**) | définies dans un bloc `<style>` DANS `LoginPage.tsx` | la source du verrou inclut les blocs `<style>` des `.tsx` |

**Aucun des trois n'a été trouvé par un test.** Les trois viennent d'avoir lu un DOM rendu.

⚠️ `.login-eye` : la zone de frappe atteint 44px via `::before { inset:-6px }`, **le dessin ne
bouge pas**. Le bouton est en absolu dans un champ de 48px ; le porter à 44×44 y collerait un
carré de survol qui remplit presque le champ. Ce que HIG et 2.5.8 mesurent est **la région qui
accepte le pointeur**, et un pseudo-élément du bouton en fait partie.

**Résidu assumé** : un bouton inline sur un écran sans harnais ni mesure passerait encore.

---

### 3 · Les marqueurs de la carte Clients étaient TOUS NOIRS (`4e1180b7`)

Parti d'une incohérence de couleur, terminé sur un défaut de rendu bien plus grave.

`TYPE_CFG_MAP.color` valait `'var(--p)'`. Cette valeur part dans **deux chemins où un `var()`
est mort**. Mesuré dans un vrai moteur, avec témoin :

| chemin | mesuré | témoin hex |
|---|---|---|
| `stop-color` du SVG **data-URI** de `createMarkerIcon` | pixel **rgb(0,0,0)** | `#6C47FF` → rgb(108,71,255) |
| `` `${cfg.color}44` `` (bordure) | **`0px none`** | `#6C47FF44` → rgba(108,71,255,.267) |
| `linear-gradient(…,${cfg.color}99)` | **`none`** | — |

Un SVG chargé comme image est un **document isolé** : les variables CSS de la page n'y
existent pas. Tous les marqueurs étaient donc noirs quel que soit le palier — **le code
couleur ne codait rien** — et les bordures, dégradés et ombres de sélection n'existaient pas.

⚠️ **`noVarInConcatenatedColor.test.ts` ne pouvait pas l'attraper, et il le DIT** : il ne suit
que les objets littéraux parcourus par `.map` dans le MÊME fichier, et écrit noir sur blanc
« un objet importé d'un autre module passe AU TRAVERS ». **La limite était écrite, connue, et
supposée sans conséquence — c'est exactement par là que le défaut est passé.**

> **Une limite déclarée n'est pas une limite mesurée.** Quand un verrou documente ce qu'il
> ne couvre pas, cette phrase est une dette, pas une décharge.

**Parade : rendre l'erreur INEXPRIMABLE plutôt que scannée.** `type CouleurTier = \`#${string}\``
— `tsc` refuse `'var(--p)'` en TS2322 (sabotage vérifié), et `createMarkerIcon` le prend en
paramètre. Aucun appelant ne peut plus lui passer autre chose qu'un hex. On n'a **pas** élargi
le scanner : le suivi d'alias inter-fichiers coûte cher et produit des faux positifs, ce que le
fichier explique déjà.

Défaut d'origine, plus modeste : `TYPE_CFG` faisait diverger la classe et la couleur sur **2
paliers sur 4** (`Semi-gros` = `badge-blue` + couleur AMBRE ; `Détail` = `badge-gray` + couleur
BLEUE). La liste peint via `cls`, les stats via `color`, l'un au-dessus de l'autre sur la même
page.

⚠️ **Correction de mon propre audit : `TYPE_CFG_MAP` n'était PAS mort** — il est consommé via
`getMapCfg` (4 sites). **Compter les consommateurs directs d'un symbole ne suffit pas.**

---

### 4 · L'échelle des points de rupture (`10f7c158`)

**ONZE** valeurs pour 27 requêtes : 380 · 480 · 560 · 600 · 640 · 760 · 768 · 880 · 900 ·
1024 · 1200. Deux paires à **8 px** et **20 px** l'une de l'autre — deux échelles superposées,
pas un choix.

⚠️ **19 des 27 requêtes vivaient dans des blocs `<style>` de composants.** Mon audit initial
en annonçait 9 : il ne regardait qu'`index.css`.

**Un reliquat prouvé mort** : `index.css` portait un `@media (max-width:880px)` sur
`.login-grid`/`.login-brand`, entièrement OCCULTÉ par le bloc de `LoginPage.tsx` — mêmes
déclarations, spécificité supérieure (`body .login-grid`), seuil plus large. **0 différence sur
246 largeurs** après suppression.

**Ce qui a été consolidé, et pourquoi ces trois-là seulement** : 760→768 (8 px), 880→900
(20 px), 600→560 (40 px, taille de titre). Direction vers **900** parce que 900 pilote déjà le
repli de la BARRE LATÉRALE, la plus structurante ; la ramener à 880 l'aurait laissée visible
dans [881,900] avec 617 px de contenu utile.

⚠️ **PAS de migration vers une échelle « propre » 640/768/1024.** Y amener le repli de la barre
latérale aurait été un changement de comportement de 124 px que je ne pouvais pas valider.
**Le défaut réparé est l'AMBIGUÏTÉ, pas le nombre de marches** — c'est le verrou qui la ferme,
en refusant toute valeur hors liste et toute paire à moins de 60 px.

**Vérification** : 71 sondes **dérivées des requêtes elles-mêmes**, 738 points sur 3 pages
publiques, avant/après. **0 différence hors des bandes attendues** — [761,768], [881,900],
[561,600].

---

### 5 · Cinq boutons verts à texte blanc (`8a86303d`)

| Bouton | Fond | Contraste le long du dégradé |
|---|---|---|
| « Marquer payé » | `#22C77A→#17A866` | 2,21 → **3,07:1** · 0/5 conforme |
| « Approuver » (console) | `#22C77A→#00875A` | 2,21 → 4,55:1 · 1/5 |
| « Confirmer la réception » | `#22C77A→#059669` | 2,21 → 3,77:1 · 0/5 |
| « Commander » (catalogue public) | `#25D366→#128C7E` | **1,98** → 4,14:1 · 0/5 |
| « Envoyer la diffusion » | `#25D366→#128C7E` | 1,98 → 4,14:1 · 0/5 |

Seuil **4,5:1** pour les cinq : le 3:1 « grand texte » exige ≥18,66px gras ou ≥24px, et le
plus gros libellé fait 14px.

⚠️ **`--acc2` (#22C77A) reste INCHANGÉ**, et c'est la décision qui compte. C'est une couleur de
**PREMIER PLAN** — texte, pastilles, points d'état — où elle mesure 6,83:1 sur une carte.
L'assombrir aurait « corrigé » les cinq boutons **en cassant une soixantaine d'indicateurs
corrects**. Ce qui manquait n'était pas un vert plus sombre, c'était **un vert de SURFACE**.

⚠️ **Les deux boutons WhatsApp n'étaient réparables par AUCUNE couleur de texte** : le dégradé
s'étale trop en luminance — le blanc échoue au clair (1,98:1), un texte sombre échoue au foncé
(4,17:1). **C'est le DÉGRADÉ qui était le défaut.** D'où l'aplat de marque exact
(`--brand-whatsapp`) + encre sombre (`--brand-whatsapp-ink` #0A1F14) : 8,69:1. Le texte sombre
sur vert appartient au langage de WhatsApp — leurs bulles de message en sont.
**Alternative écartée, écrite dans le code** : le teal foncé officiel `#075E54` avec du blanc
(7,67:1), conforme aussi, mais il éteint un bouton de CONVERSION sur une page publique.

---

### 6–8 · Le ménage, les interrupteurs, les glyphes (`c1b49f0f`, `6cf19136`, `3f267a51`)

`.btn-success` supprimée — **seule règle CSS du dépôt** posant un fond vert et du texte blanc,
trouvée en comptant les boutons verts, corrigée avec eux, **et rendue par personne**. Elle
aurait ressuscité conforme, mais ressuscité quand même.

**Interrupteurs** : `.switch-hit` porte la cible à 44 px sans toucher au dessin — hauteur
**absolue** sur le pseudo-élément, jamais un `inset` négatif (les pistes font 24 OU 26 px, et
`inset:-9px` aurait rendu 42 sur les unes et 44 sur les autres). Mesuré :
piste 26 → cible **44**, piste 24 → cible **44**, témoin sans la classe → 27.

Deux défauts plus graves trouvés en chemin :

- **`EditUserModal` ×2** : des `<div role="switch">` **sans `onClick`, sans `tabIndex`, sans
  `onKeyDown`** — la ligne parente, un `<div onClick>` elle aussi, portait toute l'action. Ils
  annonçaient un rôle de contrôle sur un élément qui n'en était pas un, **inatteignable au
  clavier** : WCAG 2.1.1, niveau **A**. Devenus de vrais `<button>`.
- **`Notifications`** : bouton sans `role` ni `aria-checked`.
  ⚠️ **Trouvé par un SABOTAGE** : retirer la classe n'a rien fait rougir, parce que le
  périmètre du verrou dérive de `role="switch"` et que ce bouton n'en portait pas.
  > **Un périmètre dérivé du bon critère ne garde rien si l'élément ne porte pas ce critère.**

**Glyphes** : sur `/signup`, le texte **accessible** du bouton pays valait `🇨🇲Cameroun▼`. Un
lecteur d'écran annonçait « Cameroun, black down-pointing triangle » — le caractère fait partie
du contenu textuel du bouton, il n'est pas décoratif. Après : `🇨🇲Cameroun`. Hauteur du bouton
**50 px inchangée**, décentrage **0 avant comme après**.

`ExpensesBudget` (`prefix: '▲ +' / '▼ -'`) **n'est pas corrigé** : c'est un préfixe de DONNÉE
dans une chaîne affichée, pas une icône. Exemption nommée, avec sa raison.

---

## Les douze fois où MA mesure était fausse

C'est la partie la plus utile de ce fichier. Aucune de ces erreurs n'a été trouvée par un
test : toutes par un contrôle positif, un témoin, ou une contre-mesure.

| # | L'erreur | Ce qui l'a démasquée |
|---|---|---|
| 1 | Compte des points de rupture : **9** annoncés, **11** réels | ne regardait qu'`index.css` |
| 2 | Compte des `fontSize` sous 11px : **49** puis **55** | ancre `[,}]` trop étroite, formes `.5` manquées |
| 3 | Compte des boutons verts : **4** puis **5** | motif exigeant le guillemet juste après `color:`, aveugle à `? … : '#fff'` |
| 4 | Compte des glyphes : **3** annoncés, **5** réels | ne cherchait que `▼` |
| 5 | `TYPE_CFG_MAP` déclaré mort | comptait les consommateurs DIRECTS, pas `getMapCfg` |
| 6 | Sonde `elementFromPoint` → 43 px | comptait des PAS entiers, pas une largeur de bande |
| 7 | `topbar-btn` « régressé » sur 142 points | lisait une valeur INTERMÉDIAIRE de `transition: all .15s` |
| 8 | `.login-grid` « régressé » sur landing/signup | mon banc y injectait des classes qui n'existent que dans `LoginPage` |
| 9 | Verrou accusant `POSModals` | regex ratissant 900 car. EN AVANT, attribuant le rôle au mauvais parent |
| 10 | « `.toggle-dot` toujours présent » | lisait le CSS **avec** les commentaires — le mien la nomme |
| 11 | « `#22C77A` absent », « `▼` absent du JS livré » | grep sensible à la casse ; puis corpus ne contenant AUCUNE requête média |
| 12 | « 22 sabotages » dans l'en-tête de CE fichier | recomptés livraison par livraison : **25** |

**Trois familles s'en dégagent, et elles se répètent :**

1. **Le scanneur qui présume de la FORME.** Chercher un caractère ne trouve pas une famille ;
   exiger un guillemet à une position ne voit pas un ternaire ; une regex qui découpe sur la
   virgule ne peut pas lire un `linear-gradient(135deg,var(--acc2),…)`.
2. **La sonde qui ne se met pas elle-même en cause.** Elle mesure sa propre latence
   (transitions), son propre échantillonnage (pas entiers), son propre banc (classes injectées
   hors contexte) — et rend des régressions qui n'existent pas.
3. **Le témoin vacant.** Un « 0 » sur un corpus qui n'en contient aucune se lit exactement comme
   un succès. Trois fois : le JS chargé depuis `index.html` ne contient pas les écrans publics
   (fragments paresseux) · `grep -c '22C77A'` sur du CSS minifié en minuscules · `@media` cherché
   avec `max-width` alors que le minifieur écrit `width<=768px`.

> **Un contrôle positif dans la MÊME invocation, systématiquement.** Sur les 11 erreurs,
> 8 auraient été invisibles sans lui, et les 3 autres ont été trouvées parce qu'un témoin
> attendu à ≥1 valait 0.

---

## Le piège zsh, encore

`git checkout -- $FICHIERS` **non quoté n'est PAS découpé par zsh** : la commande a reçu la
chaîne entière comme un seul chemin, a échoué, et le relevé « avant » a été pris sur l'état
MODIFIÉ. Les deux relevés étaient identiques — détecté par un `cmp`, refait avec un **tableau**.

C'est la ligne 2 du tableau des faux zéros de `CLAUDE.md`, commise par l'auteur qui venait de
la relire trois fois dans la même session.

---

## Les cinq verrous

| Fichier | Cas | Ce qu'il garde |
|---|---|---|
| `touchTargets.test.ts` | 16 | cibles ≥44/40, ordre de cascade de `.btn-sm`, plancher typo 11px, interrupteurs, `.toggle` morte |
| `tierColorCoherence.test.ts` | 9 | classe ↔ couleur de palier (famille DÉDUITE de la teinte), source unique, CSS mort |
| `breakpointScale.test.ts` | 7 | échelle CLOSE, chaque marche portant sa raison, aucune paire < 60 px, aucune orpheline |
| `greenSurfaceContrast.test.ts` | 7 | contraste CALCULÉ des surfaces vertes, `--acc2` non assombri |
| `noGlyphIcons.test.ts` | 5 | 12 glyphes interdits, exemptions nommées avec leur raison |

**Principes communs, tous nés d'un échec de ce chantier :**

- **Le périmètre se DÉRIVE, jamais ne se liste** — et souvent par **deux voies** (nom + rôle
  ARIA, ou nom + classe posée sur un `<button>`), parce qu'une seule laisse passer.
- **La source du verrou = la feuille LIVRÉE**, `index.css` **plus** les blocs `<style>` des
  `.tsx`.
- **Les commentaires sont retirés avant toute analyse de structure** — sinon le verrou
  s'interdit d'expliquer ce qu'il interdit.
- **On juge la propriété, pas le nom** : `greenSurfaceContrast` calcule un ratio ; interdire
  « vert + blanc » crierait au loup sur un vert légitimement sombre, et un garde qui crie au
  loup se fait désarmer.
- **`color-mix(… %, transparent)` n'est pas jugeable statiquement** — son contraste dépend d'un
  fond inconnu du scan. Ignoré, limite écrite. *(Un faux positif réel : dans `Onboarding`, les
  branches sont APPARIÉES — fond violet + blanc d'un côté, teinte verte + texte vert de
  l'autre — et le blanc ne touche jamais le vert.)*
- **Le sabotage se COPIE depuis le dépôt** (`git show HEAD:<fichier>`), jamais ne se retape :
  un sabotage écrit de mémoire hérite des hypothèses du détecteur et tombe avec lui.

---

## Ce qui reste ouvert

- **`--text-on-success`** : `#fff` sur `#22C77A` mesure **2,1:1**. Les 5 boutons sont corrigés,
  mais **le nombre de surfaces vertes portant du blanc ailleurs n'a jamais été compté** —
  `greenSurfaceContrast` le garde désormais, sans que l'inventaire ait été fait.
- **Le rendu réel de la plupart des correctifs n'a PAS été vu** : POS, Stock, Réglages, RH,
  console Ops et carte Clients sont derrière authentification, et le catalogue public n'a aucun
  catalogue publié (en activer un mutrait un tenant — hors des trois formes de vérification
  autorisées). Les preuves sont des mesures sur la vraie feuille et sur l'artefact, pas des
  captures.
- **Les axes non traités de l'audit** : états `:active` absents sur `.btn-ghost`/`.mini-btn`,
  `env(safe-area-inset-*)` jamais posé, tooltips recharts inatteignables au clavier (0/6).

---

## Annexe — recomptage

```bash
# Les 8 livraisons et leur volume
git log --oneline f982ed1d..3f267a51 --reverse
git diff --shortstat f982ed1d..3f267a51

# Cas par verrou
for f in touchTargets tierColorCoherence breakpointScale greenSurfaceContrast noGlyphIcons; do
  printf "%-24s %s\n" "$f" "$(grep -c '^\s*it(' apps/frontend/src/tests/$f.test.ts)"
done

# Points de rupture LIVRÉS (⚠️ le minifieur écrit `width<=768px`, pas `max-width`)
cat apps/frontend/dist/assets/*.css apps/frontend/dist/assets/*.js \
  | grep -oE "@media[^{]{0,60}" | grep -oE "[0-9]+px" | sort -n | uniq -c

# Interrupteurs, et par quelle voie ils atteignent 44px
grep -rn 'role="switch"' --include="*.tsx" apps/frontend/src | grep -v /tests/

# Une classe est-elle MORTE ? (toujours avec un témoin positif à côté)
for c in stat-chip btn-success modal-box; do
  printf "%-14s src=%s dist=%s\n" ".$c" \
    "$(grep -rn "$c" --include='*.tsx' apps/frontend/src | grep -vc /tests/)" \
    "$(grep -rlo "$c" apps/frontend/dist/assets/*.js | wc -l | tr -d ' ')"
done
```
