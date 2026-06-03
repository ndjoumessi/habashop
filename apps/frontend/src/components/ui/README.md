# `components/ui/` — primitives du design system

Composants **canoniques** de l'app (Vagues 2-3 Daylight). Règle d'industrialisation :
**ces primitives sont les seules à utiliser** pour leur rôle — on ne réécrit plus de
grille / bouton-icône / onglets / bouton-loading / tooltip / skeleton inline.

Tous suivent l'idiome maison : **styles inline + `var(--*)`** (pas de Tailwind/shadcn pour
l'app — les fichiers `button.tsx`/`tabs.tsx`/`tooltip.tsx` en minuscules sont des scaffolds
shadcn, conservés car importés par d'autres scaffolds, mais **non utilisés dans l'app**).

> ⚠️ FS macOS **insensible à la casse** : `Button.tsx`/`Tabs.tsx`/`Tooltip.tsx` entreraient en
> collision avec les scaffolds `button.tsx`/`tabs.tsx`/`tooltip.tsx`. D'où les noms de fichiers
> `AppButton`/`TabBar`/`FocusTooltip` (les composants exportés s'appellent bien `Button`/`Tabs`).

| Rôle | Fichier | Import | Clés |
|------|---------|--------|------|
| Grille responsive | `ResponsiveGrid.tsx` | `import ResponsiveGrid from '@/components/ui/ResponsiveGrid'` | `min` (px) → `auto-fit` N→1 col, anti-overflow. Remplace les `gridTemplateColumns` inline. |
| Bouton icône | `IconButton.tsx` | `import IconButton from '@/components/ui/IconButton'` | `label` **requis** (aria-label+title) + hit-area **44px**. `danger`/`active`/`variant`. |
| Onglets | `TabBar.tsx` (export `Tabs`) | `import Tabs from '@/components/ui/TabBar'` | scroll-x <768px + clavier (←/→/Home/End) + `variant` `pill`\|`segmented`. `onChange` typé `(id:string)` → caster côté page. |
| Bouton + loading | `AppButton.tsx` (export `Button`) | `import Button from '@/components/ui/AppButton'` | `loading` (spinner+disabled+aria-busy), `variant` `primary`\|`ghost`\|`danger`, `leftIcon`, `fullWidth`. |
| Tooltip accessible | `FocusTooltip.tsx` | `import FocusTooltip from '@/components/ui/FocusTooltip'` | s'affiche au **survol ET focus clavier**, Échap, `aria-describedby`. Enrobe un trigger focusable. |
| Skeleton | `skeleton.tsx` (export `Skeleton`) | `import Skeleton from '@/components/ui/skeleton'` | `height`/`width`/`count`/`radius`. Shimmer `.skeleton`. |

## Tokens du design system (`index.css :root`)

- **Spacing** : `--sp-1`(4) … `--sp-6`(32). Utiliser pour les paddings/margins (pas de px inline hardcodé).
- **Typo** (plancher **11px**, fini 8/10px) : `--fs-display`(24) · `--fs-title`(15) · `--fs-body`(14) · `--fs-label`(12) · `--fs-caption`(11).
- **Graisses** capées à 3 : `--fw-regular`(500) · `--fw-semibold`(700) · `--fw-bold`(800).
- **Accents sémantiques** (un seul dominant par écran) : **violet** = primaire (`--p`) · **vert** = positif (`--success`/`--acc2`) · **rouge** = danger (`--danger`) · **orange/ambre** = argent/montants (`--warn`).

## Thèmes

9 thèmes (`THEMES` dans `appStore.ts`), dont **`soleil`** (clair haut-contraste, étal extérieur)
basculable d'un tap via le bouton ☀️ du header (`SunModeToggle`). Tout couple texte/fond lu de
chaque thème est garanti **AA** par `tests/contrast-aa.test.ts` (régression bloquée).

## Suivi (migration de masse, non terminée)

Le balayage des ~65 grilles fixes + ~76 boutons icon-only + paddings/tailles inline restants
(hors surfaces déjà migrées) vers ces primitives est **incrémental**. Cible : zéro implémentation
inline pour ces 6 rôles.
