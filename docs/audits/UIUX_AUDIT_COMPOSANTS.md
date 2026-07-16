# Audit UI/UX — 4 composants HabaShop (lecture seule)

> Méthode : skill **ui-ux-pro-max** (Quick Reference §1 Accessibilité → §6 Typo/Couleur), métriques réelles + lecture intégrale des 4 fichiers. **Aucune modification de code.**
> Réconciliation des chemins du spec (n'existaient pas tels quels) :
> 1. `components/ui/LoyaltyCard.tsx` (pas `customers/`)
> 2. `components/pos/POSModals.tsx` → bloc `showModal` (modale de confirmation de vente)
> 3. `pages/Dashboard.tsx` → section « KPI cards »
> 4. `components/customers/CustomersList.tsx` → vue `grid` (cards) — page = `Customers.tsx`
>
> Contexte design system (« Daylight ») : tokens `var(--*)`, échelles `--fs-*` / `--fw-regular(500)/semibold(700)/bold(800)` / `--sp-*`, ombres `--sh-xs..xl`, **9 thèmes** dont **Mode Soleil** (clair haut-contraste). Règle projet : **Lucide uniquement, pas d'emoji UI**.

## Métriques brutes (collectées)

| Fichier | Lignes | `style={{` inline | aria/role | hex `#RRGGBB` | `var(--` | hover JS | états loading |
|---|---|---|---|---|---|---|---|
| LoyaltyCard | 222 | 29 | 2 | 3 | 28 | 0 | ⏳ texte (pas skeleton) |
| POSModals (confirm) | 531 | 78 | 11 | 4 | 91 | 0 | ✅ `isSaving`/`waSending` |
| Dashboard KPIs | 589 | 94 | 3 | 19 | 93 | 3 | ❌ aucun (zéros qui « poppent ») |
| Customers cards | 278 | 43 | 8 | 12 | 38 | 1 | n/a |

Lecture clé : taux de tokenisation **élevé partout** (le chrome est theme-aware). Les hex restants sont surtout des **couleurs-identité sémantiques** (paliers fidélité, accents KPI, types client) — acceptables — sauf quelques fuites évitables. Le vrai déficit est ailleurs : **emoji-comme-icônes**, **états hover-only**, **contraste de certaines couleurs vives en Mode Soleil**, **données factices**, **absence de skeletons**.

---

## 1. LoyaltyCard — **72 / 100**

Carte fidélité (modale) : carte premium dégradée par palier + QR + progression + historique.

### Points forts
- **Tokenisation solide** (28 `var(--)`) : surfaces/texte (`--card`/`--bg3`/`--text`/`--text2`/`--text3`/`--mono`) → theme-aware.
- **Hiérarchie typo claire** : points = 36px mono 900, nom 18px 900, header 15px bold, sous-textes 11–13px. La métrique reine (le solde) domine.
- **Distinctif** : dégradé `linear-gradient(135deg, ${tier.bg→.2}, var(--card))` + bordure 2px teintée par palier + glow emoji en filigrane (opacity .06) + QR stylisé. Loin du « carton générique ».
- Modale accessible de base : `role="dialog"` + `aria-modal`, fermeture backdrop + Échap (handler global AppLayout), `IconButton` header avec `label`.

### Points faibles (concrets)
- 🔴 **Emoji utilisés comme icônes UI** (viole la règle projet + skill `no-emoji-icons`) : `🎁` (titre), `🥉🥈🥇` (paliers), `⭐🏅🎉` (fonctionnement), `📋` (copier), `⏳` (loading). Rendu **dépendant de la police OS**, non thémable, désaligné. Les **fonctionnels** (`📋` copier, `⏳` loading) doivent passer en Lucide ; les médailles de palier peuvent rester décoratives mais gagneraient à être des SVG cohérents.
- 🔴 **Bouton « copier l'ID » = `<div onClick>`** (l.103-109) : `cursor:pointer` mais **pas de `role`/`tabIndex`/`onKeyDown`** → **inaccessible au clavier et au lecteur d'écran**, pas d'état focus/hover. (À comparer aux cards Customers qui, elles, font `role="button" tabIndex=0 onKeyDown` correctement.)
- 🟡 **Contraste en Mode Soleil** : le solde géant (36px) prend `color: cfg.color` = couleur du palier — **Silver `#A8A9AD` (gris clair)** et **Gold `#FFD700` (jaune)** sur une carte **claire** (Sun) → ratio **< 3:1** très probable (texte large mais quand même limite). Idem le badge palier (texte palier sur tint clair). Les paliers Silver/Gold sont les plus « premium » et les plus à risque.
- 🟡 **Loading = `⏳` + texte** (l.136-139), pas de **skeleton/shimmer** (skill §3 `progressive-loading`). Le composant `Skeleton` existe déjà dans le repo et n'est pas réutilisé.
- 🟢 **Graisses mélangées** : `fontWeight: 900` brut (l.100, 143) vs `var(--fw-bold)` (=800) ailleurs → incohérence avec l'échelle « graisses capées à 3 ».

### 3 améliorations prioritaires
1. **Remplacer les emoji fonctionnels par Lucide** : `📋`→`<Copy size={12}/>`, `⏳`→`<Loader2 className="spin"/>`, et idéalement les médailles par `<Medal/>`/`<Award/>` colorés via `style={{color: cfg.color}}` (cohérent avec le reste de l'app, 100% Lucide).
2. **Rendre « copier l'ID » accessible** : transformer le `<div>` en `<button type="button">` (ou `role="button" tabIndex={0}` + `onKeyDown` Enter/Space) avec `aria-label={i('Copier l'identifiant', …)}` et un état focus visible.
3. **Sécuriser le contraste palier en Mode Soleil** : pour le solde géant et le badge, ne pas utiliser la couleur métallique brute en thème clair — soit l'assombrir (ex. Gold → `#B8860B` en clair), soit garder `var(--text)` pour le chiffre et réserver `cfg.color` à l'accent (bordure/icône). Vérifier ≥ 4.5:1 (texte) / 3:1 (large) sur fond clair.

---

## 2. Modale POS — confirmation de vente — **80 / 100**

La plus aboutie des quatre. Récap panier + total + toggle WhatsApp + sélecteur indicatif + actions.

### Points forts
- **CTA primaire unique et clair** (skill `primary-action`) : bouton « Valider/Encaisser » en dégradé `var(--acc2)→#059669` plein, secondaires (Ticket/Facture) en `mini-btn` discrets.
- **États interactifs exemplaires** : `disabled` quand `blocked` → fond `--bg4`, `opacity .6`, `cursor:not-allowed`, `box-shadow:none`, `color:--text3` + **`title` explicatif** (« Saisissez le montant reçu ») ; **loading** distinct (`waSending` → spinner+texte, `isSaving` → « Enregistrement… »). C'est le modèle à suivre (skill §8 `disabled-states`, `loading-buttons`).
- **Accessibilité** : `role="dialog"`/`aria-modal`, X avec `aria-label` i18n, input recherche avec `aria-label` + fermeture Échap, fermeture backdrop. 11 attributs aria/role.
- Tokenisation très élevée (91 `var(--)`), header avec pastille succès `CheckCircle` (Lucide).

### Points faibles (concrets)
- 🔴 **Toggle WhatsApp invisible en Mode Soleil (état OFF)** : piste OFF = `background: var(--bg4)` → en Soleil `--bg4 = #FFFFFF` ⇒ **piste blanche sur carte blanche** = toggle quasi invisible quand désactivé. (skill « state contrast parity » light/dark.)
- 🟡 **Cible tactile du toggle** : `44×24px` → hauteur **24px < 44px** (skill `touch-target-size`). Le pouce d'un commerçant mobile vise petit.
- 🟡 **Emoji / glyphes texte comme icônes** : `▼` caret du sélecteur pays (l.359) et `🔍` dans le placeholder de recherche (l.376) → remplacer par `<ChevronDown/>` et icône `<Search/>` dans le champ (cohérence Lucide).
- 🟢 **Pluriel FR codé en dur** : `article{cart.length > 1 ? 's' : ''}` (l.260) → uniquement français (en/es/it auront « 1 articles » faux si réutilisé). Mineur.
- 🟢 **Graisses brutes** : `fontWeight: 900` (total l.304), `600` (l.316, 471) au lieu des tokens `--fw-*`.

### 3 améliorations prioritaires
1. **Corriger la piste du toggle OFF** : `background: sendWhatsApp ? '#25D366' : 'var(--bg5)'` ou une bordure `1px solid var(--border)` sur la piste → visible dans les 9 thèmes. Et porter la hauteur à 28–44px (knob 24px) pour la cible tactile.
2. **Glyphes → Lucide** : `▼`→`<ChevronDown size={12}/>`, et icône de recherche en préfixe du champ (pattern `search-wrap`/`search-icon` déjà présent ailleurs dans l'app) au lieu de `🔍` dans le placeholder.
3. **Skeleton de soumission / focus** : à l'ouverture, déplacer le focus sur le CTA (ou le champ WhatsApp si actif) pour une vraie nav clavier ; et passer le pluriel en `i()` 4 langues.

---

## 3. Dashboard — section KPI — **74 / 100**

4 cartes KPI (CA jour héro, stock, employés, CA mois) + quick-actions.

### Points forts
- **Icônes Lucide** (DollarSign/Package/Users/TrendingUp), **pas d'emoji** ici. 👍
- **Métrique reine** : CA du jour à **30px** (flag `hero`) vs 24px les autres → hiérarchie inter-cartes claire. Classes `.kpi-card/.kpi-label/.kpi-value/.kpi-sub` themable + `ResponsiveGrid` (auto-fit min 180).
- **Quick-actions** soignées : `aria-label`, `cursor:pointer`, hover JS (translateY + `var(--sh-sm)` **token**), focus implicite (bouton natif).
- Carte = identité couleur par KPI (violet/orange/vert/cyan) avec glow radial subtil → distinctif sans être tape-à-l'œil.

### Points faibles (concrets)
- 🔴 **Badges d'évolution FACTICES codés en dur** : `evol:'+12%'`, `'−3'`, `'+7%'` (l.322-325) sont **statiques** — ils n'ont **aucun lien avec les données réelles**. Pour un commerçant, voir « +12 % » figé à chaque visite = perçu comme **cassé ou malhonnête**. C'est le défaut le plus visible et le plus dommageable en crédibilité.
- 🟡 **Aucun état de chargement** : `stats` démarre à 0 → les cartes affichent « 0 € / 0 » puis « poppent » vers les vraies valeurs au retour de `dashboardApi.stats` (flash + micro-CLS). Pas de **skeleton** (pourtant dispo dans le repo).
- 🟡 **19 hex en dur** (`#6C47FF/#FF9500/#00D084/#00B8FF`) : pragmatiques (l'astuce `${hex}18`/`${hex}28` d'opacité exige du hex, impossible sur une `var()`), mais ils **dupliquent** `--p/--acc/--acc2/--acc3`. À centraliser dans une petite palette `KPI_ACCENTS` (déjà à moitié fait via `k.bg`) pour éviter la divergence.
- 🟢 La couleur de tendance n'est pas que couleur (icône `TrendingUp/Down` présente) → OK `color-not-only`.

### 3 améliorations prioritaires
1. **Brancher (ou retirer) les tendances** : calculer l'évolution vs J-1 / mois-1 côté `dashboardApi.stats` (ou supprimer le badge tant que la donnée n'existe pas). Une fausse métrique nuit plus qu'une métrique absente.
2. **Ajouter un skeleton KPI** : pendant le chargement, afficher 4 `<Skeleton>` aux mêmes dimensions (réserver l'espace → CLS ≈ 0, pas de flash 0→valeur).
3. **Centraliser les accents KPI** : un tableau `KPI_ACCENTS = [{ token:'--p', hex:'#6C47FF' }, …]` (source unique) pour aligner gradient/border/glow sur les tokens et éviter les 19 littéraux dispersés.

---

## 4. Cards clients (vue grille) — **76 / 100**

Cards riches : bande couleur par type + avatar dégradé + badge type + points + 3 métriques + contact.

### Points forts
- **Meilleure accessibilité des 4** : `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Espace) + `aria-label` + `aria-pressed` → **pleinement opérable au clavier** (modèle à diffuser, cf. LoyaltyCard).
- **Identité visuelle forte** : 4 couleurs de type (`tc.h/tc.rgb`) déclinées en bande, avatar dégradé, badge tint + point, glow `rgba(tc.rgb,.35)`. Densité d'info maîtrisée (3 métriques en bandeau séparé par lignes `var(--border)`).
- Surfaces/texte tokenisés (`--card/--border/--text/--text2/--text4`), ellipsis sur nom/téléphone (pas de débordement).

### Points faibles (concrets)
- 🔴 **Actions révélées au HOVER uniquement** (`.customer-actions` opacity/maxHeight pilotés par `onMouseEnter/Leave`, l.186-187) → **inaccessibles au tactile** (pas de hover sur mobile) et au clavier. Marché cible = **mobile-first Afrique de l'Ouest** ⇒ régression UX réelle. Le clic ouvre bien la modale détail (fallback), mais les actions inline (éditer/supprimer/PDF…) sont hors d'atteinte sans souris (skill `hover-vs-tap`, `gesture-alternative`).
- 🟡 **Ombre hover en dur** : `box-shadow: 0 12px 32px rgba(0,0,0,.3)` (l.186) au lieu d'un token `--sh-md/lg`. En **Mode Soleil**, une ombre **noire à 30 %** est trop lourde/sale sur fond clair (les quick-actions du Dashboard utilisent `var(--sh-sm)` — incohérence à l'intérieur du même produit).
- 🟡 **« Point en ligne » trompeur** : un point **vert** (`#00D084`, sémantique « en ligne/actif ») s'affiche si `loyaltyPoints > 100` (l.195) — un client n'est pas « en ligne ». Glyphe sémantiquement faux ; préférer un indicateur « fidèle » neutre (étoile/cocarde) ou le retirer (le bloc points existe déjà).
- 🟢 **Titre de carte un peu petit** : nom à **13px** — pour l'élément principal d'une card, 14–15px (`--fs-body/title`) améliorerait la hiérarchie. Métriques 12px mono 900 (graisse brute).
- 🟢 Hex sémantiques `#FF9500/#00D084/#FFB800` qui dupliquent `--acc/--acc2/--warn` (mineur).

### 3 améliorations prioritaires
1. **Désaccoupler les actions du hover** : afficher les actions **toujours** sur tactile (`@media (hover:none)` → opacity 1) ou via un bouton « ⋯ » (menu) accessible clavier/tactile ; ne jamais cacher une action critique derrière un survol.
2. **Ombre via token** : `box-shadow: var(--sh-md)` au hover (cohérent avec le reste + adapté Soleil), idem aligner le `transform` sur les autres cards.
3. **Corriger l'indicateur** : remplacer le « point en ligne » par un marqueur de fidélité explicite (ex. `<Star/>` ou une cocarde), et monter le nom à `--fs-body` (14px) pour asseoir le titre.

---

## Synthèse & recommandation

| # | Composant | Score | Faille dominante |
|---|---|---|---|
| 2 | Modale POS (confirmation) | **80** | Toggle OFF invisible en Soleil + cible 24px |
| 4 | Cards clients | **76** | Actions **hover-only** (mortes en tactile) |
| 3 | Dashboard KPIs | **74** | **Tendances factices** + pas de skeleton |
| 1 | LoyaltyCard | **72** | **Emoji-icônes** + copie non accessible + contraste palier Soleil |

### Patterns transverses (à industrialiser)
- **Emoji → Lucide** partout (LoyaltyCard surtout, glyphes POS) : c'est la règle projet, et c'est ce qui fait le plus « générique/amateur ».
- **Graisses** : `900`/`600` bruts → tokens `--fw-regular/semibold/bold` (échelle déjà capée à 3).
- **Ombres** : `rgba(0,0,0,…)` en dur → `--sh-*` (cohérence + Mode Soleil).
- **Hover-only** = anti-pattern tactile : tout ce qui est révélé au survol doit avoir un chemin tactile/clavier.
- **Skeletons** : réutiliser le composant `Skeleton` existant (LoyaltyCard, KPIs).

### ➡️ À améliorer en PREMIER (impact visuel maximum) : **Dashboard — section KPI**

Raisons :
1. **Visibilité n°1** — c'est le premier écran de chaque session, vu par 100 % des utilisateurs, plusieurs fois/jour.
2. **Crédibilité** — les **badges +12 %/−3/+7 % factices** sont un défaut *visible* qui décrédibilise instantanément tout le tableau de bord (un commerçant qui voit la même « hausse » figée pense que l'app est cassée). Le corriger/retirer change la perception de sérieux du produit entier.
3. **Effort faible, gain élevé** — brancher la vraie évolution (ou retirer le badge) + ajouter 4 skeletons = quelques heures, zéro refonte visuelle, et supprime à la fois le flash de chargement (0→valeur) et la fausse donnée.

*Si l'objectif est plutôt la cohérence « marque/polish » : le 2ᵉ chantier le plus rentable est **LoyaltyCard** (purge emoji + accessibilité copie + contraste Soleil) — c'est le composant le plus « premium » donc celui où l'incohérence emoji se voit le plus.*

— Audit lecture seule, aucun code modifié.
