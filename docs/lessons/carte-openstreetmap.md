# Google Maps → OpenStreetMap — ce que les règles d'usage ont imposé

> **Les règles survivantes vivent dans `CLAUDE.md` § Pièges techniques › Carte** et dans
> l'en-tête de `apps/frontend/src/lib/geo.ts`. Cette page porte les MESURES. **À lire avant**
> de toucher `lib/geo.ts`, `CustomerMap.tsx`, `AddressAutocompleteInput.tsx` ou le chunk `maps`.

## Les politiques d'abord — elles ont décidé de l'architecture

Lues sur les pages officielles le 2026-09-13, avant d'écrire une ligne :

| Règle (citée) | Conséquence dans le code |
|---|---|
| Nominatim : « you must not implement such a service [auto-complete] on the client side » | saisie d'adresse sur **Photon** (komoot), jamais Nominatim |
| Nominatim : « Results must be cached on your side […] may be classified as faulty and blocked » | cache **persistant** + ≤ 1 requête réseau/s, échecs mémorisés 7 j |
| Tuiles : « Commercial services […] access may be withdrawn at any point » | `VITE_MAP_TILE_URL` : bascule vers un fournisseur à clé sans code |
| Tuiles : « Offline use is not permitted » | chunk `maps` hors précache ; **aucune** règle SW sur les tuiles |
| « Show OpenStreetMap licence attribution clearly » | attribution visible, non recouverte, **contraste AA vérifié** |
| Tuiles : « Bulk downloading is any pre-emptive fetching » | la CI intercepte les tuiles (PNG 1 px) — zéro octet vers OSM |

⚠️ **L'ancien code Google géocodait TOUS les clients à CHAQUE ouverture de l'onglet**, par
rafales de cinq, sans cache. Chez Google cela coûtait en silence ; transposé tel quel chez un
fournisseur communautaire, c'était un blocage d'IP assuré. Le verrou d'écran le prouve :
**10 clients placés pour 4 requêtes**, et le sabotage du cache en rend 10.

## Deux pièges mesurés sur l'API réelle

- **`coordinates` = [longitude, latitude]** (GeoJSON). Inverser pose Douala au large du Gabon,
  sans erreur. Garde : bornes ±90/±180 + test sur une réponse réelle relevée.
- **`lang=es` et `lang=it` → HTTP 400** ; seuls `default/en/de/fr` passent. Transmettre la
  langue de l'app cassait l'autocomplétion espagnole et italienne **en silence** (une erreur
  réseau d'autocomplétion ne s'affiche pas). `photonLang` les omet.

## Ce que l'écran a trouvé, que les tests unitaires ne pouvaient pas voir

1. **Attribution illisible — 1,11:1.** `leaflet.css` vit dans le chunk paresseux, donc chargé
   APRÈS `index.css` : à spécificité égale, l'ordre gagne et l'habillage sombre était écrasé.
   Parade : préfixe `.hs-map.leaflet-container`. *La source était juste, l'artefact ne
   l'appliquait pas.*
2. **Le popup se refermait au rendu suivant.** `visibleList` recalculée à chaque rendu →
   l'effet des marqueurs se rejouait → `setSelected` au clic détruisait le marqueur et son
   popup. **Le test passait** : il lisait le popup dans la milliseconde précédant ce rendu.
   C'est la capture qui l'a montré ; le verrou revérifie après 1,2 s.
3. **Marqueur bleu, popup orange.** Une table `POPUP_HEX` divergeait de `TYPE_CFG` sur deux
   paliers sur quatre. Supprimée ; le verrou compare la couleur lue dans la data-URI de l'icône
   cliquée à celle de l'en-tête du popup.

## Défauts préexistants corrigés en passant

- **« Clients sans adresse »** rangeait aussi les adresses EXISTANTES mais introuvables : deux
  listes désormais, deux gestes différents (saisir / préciser).
- **Initiales non échappées dans le SVG du marqueur** : « &Co » → XML invalide → marqueur
  invisible. `escHtml`.
- **Marqueur retrouvé par NOM** (`getTitle() === name`) : deux homonymes, mauvaise fiche. Par id.
- **Composant mort** `AddressAutocomplete.tsx` (0 import, 3 avertissements) supprimé → plafond
  lint front 199 → 196, mesuré fichier par fichier avant/après.

## Limites assumées, écrites plutôt que masquées

- **Empilement** : des clients géocodés au même point (adresse au niveau du quartier — fréquent
  dans les marchés visés) forment une seule punaise cliquable. Déjà vrai sous Google. Parade
  future : regroupement (`leaflet.markercluster`), non livré.
- ~~Centre de repli = Dakar~~ — **CLOS le 2026-09-13** : sans client placé, la carte cadre le
  **pays de la boutique** (`vueDuPays`, `lib/geo.ts`). Emprises MESURÉES sur Photon pour les 32
  pays de `SUPPORTED_COUNTRIES`, réponse brute versionnée (`tests/fixtures/emprises-photon-2026-09-13.json`)
  et confrontée entrée par entrée. ⚠️ Piège mesuré : l'emprise OSM de **FR, US et NL inclut
  l'outre-mer** (FR et US couvrent le globe) — point du pays + zoom choisi à la place.
  ⚠️ Un contrôle « sud < nord, ouest < est » NE VOIT PAS une inversion lat/lng sur un pays dont
  les deux valeurs restent plausibles (sabotage sur le Tchad : vert) — d'où la confrontation à
  la mesure brute. À l'écran (`carte-osm.spec.ts`), boutique IVOIRIENNE : seul pays qui fait
  échouer à la fois l'ancien Dakar et un repli qui ignorerait la boutique. ⚠️ La première sonde
  unissait TOUTES les tuiles demandées (vue initiale + préchargement) et mesurait autre chose
  que l'écran ; elle lit désormais la tuile sous chaque coin — par rectangle, car Leaflet pose
  `pointer-events: none` sur les tuiles et `elementsFromPoint` les ignore.
- **« Adresse introuvable » se MESURE, il ne se DÉDUIT pas — CLOS le 2026-09-14.** La liste
  valait « adresse présente ET aucune position » : avant la première requête, les 11 fiches y
  figuraient (mesuré : affichées à 3 ms, recherche partie à 272 ms), et une PANNE réseau s'y
  rangeait aussi, sous « à préciser », alors que l'adresse était peut-être juste. Désormais la
  liste ne porte que ce que le géocodeur a RÉPONDU (`introuvable`, liée à l'adresse jugée), une
  panne a sa propre liste « Localisation interrompue », et une adresse de ≤ 3 caractères —
  jamais envoyée — reste « à préciser ». ⚠️ Un état transitoire faux ne se voit PAS à l'état
  final : le verrou (`carte-osm.spec.ts`) enregistre par `MutationObserver` le PLUS GRAND
  effectif jamais affiché. Sabotages : page de HEAD → « 11 fiches » ; panne rangée sous
  introuvable → rouge.
- **Un seul client placé** est désormais cadré (l'ancien `length > 1` le laissait hors champ),
  avec `maxZoom: 14` quand tous partagent un point.
- **Carte de chaleur** : cercles translucides superposés, pas un dégradé flouté (`leaflet.heat`
  n'est plus maintenu depuis 2015 et patche l'objet global).
- **Photon public = « fair use », sans garantie** : `VITE_GEOCODER_URL` pour une instance dédiée.

## Deux erreurs de méthode, les miennes

- **`for f in dist/assets/$motif`** a rendu une mesure de poids VIDE : zsh ne développe pas un
  motif contenu dans une variable non quotée — faux zéro n°2 de `hygiene-shell.md`, recommis.
- **Le port 5173 était tenu par un AUTRE projet** (`gestlocpro`) : la page servie montait
  `SessionProvider`, `ThemeProvider`… inexistants ici. **Le jeton d'identité du harnais a
  refusé de mesurer**, exactement comme prévu. Harnais relancé sur un port libre avec
  `HARNESS_BASE` + `HARNESS_NONCE`, sans toucher au serveur d'autrui.
