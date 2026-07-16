# 🎨 Audit UX/A11y v2 — HabaShop

**Date :** 2026-05-26
**Comparaison avec l'audit initial** (`UIUX_AUDIT.md`, 2026-05-25)
**Méthode :** mêmes greps que l'audit initial sur `apps/frontend/src/pages/` + Lighthouse v12.8.2 (prod). Aucune valeur inventée.

> ⚠️ **Limite Lighthouse :** seule la **landing publique** est auditable. Les écrans `/app/*` (derrière login) ne le sont pas — les métriques code ci-dessous restent le meilleur proxy de leur a11y.

---

## Progression globale

| Métrique | Avant | Après | Delta |
|----------|------:|------:|------:|
| Inputs (`input`/`select`/`textarea`) dans les pages | 184 | **97** | −87¹ |
| Champs avec `aria-label` (pages) | 5 | **53** | **+48** |
| `<label htmlFor>` (pages) | 3 | **3** | → |
| `window.confirm` (natif) | 6 | **0** | **−6** ✅ |
| `<div onClick>` | 30 | **17** | **−13** |
| Pages avec état loading (`setLoading`/`Skeleton`) | 10 | **16** | +6 |
| Hex `#RRGGBB` en dur (toutes pages) | ~700 | **305** | **−≈395** |
| `var(--…)` (tokens CSS) | (mixte) | **931** | tokenisation forte |
| Lighthouse A11y (landing) | 100 | **100** | → |
| Lighthouse SEO (landing) | 91 | **100** | **+9**² |
| Score moyen pages (estimé) | 60 | **≈72** | +12 |

¹ Baisse due au **découpage des pages** : beaucoup d'inputs ont migré dans des composants (`HRModals`, `CustomersModals`, `Field`, `ValidatedInput`) — non comptés dans `pages/`.
² L'audit initial indiquait A11y **100** et SEO **91** pour la landing. La ligne « A11y 91 » du brief correspondait en réalité au **SEO** ; corrigé ici (A11y 100 → 100, SEO 91 → 100).

---

## Score par page (mis à jour)

Les pages cœur-métier ont été **massivement refactorisées** (sous-composants, tokens) depuis l'audit initial — d'où la chute des lignes et des hex :

| Page | Lignes avant | Lignes après | Hex avant | Hex après | Score initial | Score actuel (est.) |
|------|------------:|------------:|----------:|----------:|--------------:|--------------------:|
| **HR** | 2 875 | **455** | 123 | **12** | 48 | **~74** |
| **Customers** | 1 807 | **354** | 119 | **0** | 50 | **~76** |
| **POS** | 1 890 | **575** | 32 | **5** | 53 | **~74** |
| **Forecasts** | 1 361 | **299** | 34 | (n/a) | 51 | **~70** |
| **Dashboard** | ~534 | **534** | 39 | **24** | 63 | **~68** |
| **Orders** | 1 185 | **1 104** | 20 | — | 54 | **~58** |
| **LandingPage** | 1 337 | **1 337** | 42 | **28** | 74 | **~78** |

> Scores **estimés** selon la rubrique de l'audit initial (a11y 35 / cohérence 25 / structure 15 / responsive 15 / patterns 10), recalibrés sur les métriques mesurées. Seule la landing est validée par Lighthouse (a11y 100). **Orders** reste le principal monolithe non découpé (1 104 lignes).

---

## Nouveaux composants créés (tous présents ✅)

- `components/ui/Field.tsx` ✅ — champ avec label associé
- `components/ui/ConfirmModal.tsx` ✅ — confirmation thématisée (via `@/lib/confirm`, 5+ pages)
- `components/ui/skeleton.tsx` ✅ — états de chargement
- `components/ui/EmptyState.tsx` ✅ — états vides (7 pages)
- Bonus existants : `ValidatedInput`, `PhoneInputWithCountry`, `AddressAutocompleteInput`
- **68 composants** au total dans `components/`.

---

## Ce qui s'est nettement amélioré

1. **`window.confirm` éradiqué (6 → 0).** Toutes les confirmations destructives passent par un **modal custom thématisé et i18n** (`await confirm({ title, message, danger })`) — cohérent, accessible, multilingue.
2. **Couleurs tokenisées.** Hex en dur ~700 → **305** ; **931** usages de `var(--…)`. HR 123 → 12, Customers 119 → **0**. Les 7 thèmes tiennent bien mieux.
3. **Pages dé-monolithisées.** HR −84 %, Customers −80 %, POS −70 %, Forecasts −78 % de lignes → maintenabilité et lisibilité fortement accrues.
4. **A11y des champs.** `aria-label` 5 → **53** ; le composant `Field` existe pour généraliser `<label htmlFor>`.
5. **Landing : Lighthouse 100/100/100** (a11y, SEO, bonnes pratiques).

## Ce qui reste

1. **`<div onClick>` (17 restants).** À convertir en `<button>` (focus clavier, rôle).
2. **`<label htmlFor>` toujours à 3.** `Field` existe mais n'est pas encore généralisé aux 97 inputs → préférer `aria-label`/`Field` partout.
3. **`Orders.tsx` (1 104 lignes)** reste monolithique — dernier gros chantier de découpe.
4. **Contraste `/app/*` non mesuré** (Lighthouse limité à la landing) — rejouer une passe contraste + un Lighthouse authentifié.
5. **EmptyState** présent sur **7** pages ; à étendre (le « 18/28 » initial comptait un motif plus large, non comparable directement).

> Rapport analytique — aucun fichier source modifié.
