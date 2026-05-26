# 🌍 Audit i18n — HabaShop v2.6.0

**Date :** 2026-05-26
**Langues :** Français (fr) · English (en) · Español (es) · Italiano (it)
**Méthode :** greps réels sur `apps/frontend/src` (patterns i18n + ternaires binaires). Mesures, pas d'estimation inventée.

---

## Système i18n en place (à NE PAS changer)

Trois mécanismes coexistent — **tous conservés** :

1. **`useI18n().i(fr, en, es, it)`** (hook `hooks/useI18n.ts`) — **4 langues**, complet. **415 appels** dans pages + composants.
2. **`t('clé')`** (dictionnaire `stores/appStore.ts`, `translations[lang]`) — fr/en/es/it complet par clé.
3. **Ternaire inline `lang === 'fr' ? … : …`** — utilisé partout. C'est ici que se trouve la dette : beaucoup sont **binaires fr/en** → **es/it retombent en anglais**.

> ⚠️ La spec proposait de **réécrire `useI18n.ts`** avec un helper `t()`/`tk()` : cela aurait **supprimé `i()` et cassé le build** (415 usages). Le hook existant a été **conservé tel quel**.

---

## Résumé couverture

| Langue | Couverture | Statut |
|--------|-----------|--------|
| Français | 100 % (référence) | 🟢 |
| English  | ~100 % | 🟢 |
| Español  | partielle — ~**514** chaînes inline en repli anglais | 🟡 |
| Italiano | partielle — mêmes ~**514** chaînes | 🟡 |

`es`/`it` sont **complets** partout où l'app utilise `i()` (415), le dico `t()`, ou un ternaire 4-langues — et **incomplets** sur les ~514 ternaires **binaires fr/en** restants (l'utilisateur es/it y voit l'anglais, pas un bug bloquant mais une localisation partielle).

---

## Corrigé dans ce sprint (binaire fr/en → 4 langues)

Priorité donnée au **chrome persistant** (visible sur tous les écrans) + **écrans cœur** :

| Fichier | Chaînes corrigées | Pourquoi prioritaire |
|---------|------------------:|----------------------|
| `components/layout/Sidebar.tsx` | 6 | Navigation — chaque écran |
| `components/layout/Header.tsx` | 22 | Barre du haut, recherche, notifs, badge essai — chaque écran |
| `pages/Dashboard.tsx` | 18 | Écran post-login |
| `pages/POS.tsx` | 7 | Caisse (cœur métier) |
| `pages/Stock.tsx` | 5 | Gestion stock (cœur métier) |
| **Total** | **~58** | |

Vérifié : `tsc` 0 erreur · 43/43 tests · build OK. Ces fichiers n'ont plus de ternaire binaire fr/en (résidu mesuré 0 ; les « 1 » de Sidebar/Header sont des ternaires 4-langues multi-lignes, faux positifs du grep).

---

## Backlog restant (par fichier, mesuré)

Ternaires binaires `lang === 'fr' ? FR : EN` à étendre en 4 langues (es/it actuellement en anglais) :

| Fichier | Gaps es/it | Fichier | Gaps es/it |
|---------|-----------:|---------|-----------:|
| `hr/HRModals.tsx` | 93 | `pages/Reports.tsx` | 15 |
| `hr/HRTabs.tsx` | 68 | `stock/StockModals.tsx` | 13 |
| `reports/ReportsTabs.tsx` | 43 | `pages/Planning.tsx` | 10 |
| `pages/HR.tsx` | 29 | `pos/POSCart.tsx` | 10 |
| `pages/Expenses.tsx` | 27 | `hr/HREmployeeGrid.tsx` | 9 |
| `pages/Integrations.tsx` | 24 | `pages/Activity.tsx` | 8 |
| `pages/Forecasts.tsx` | 22 | `pages/Marketing.tsx` | 5 |
| `pages/APIDocs.tsx` | 22 | `pages/Payroll.tsx` | 4 |
| `integrations/ResendMonitor.tsx` | 18 | `pos/POSProductGrid.tsx` | 4 |
| `pages/Goals.tsx` | 18 | `pages/LandingPage.tsx` | 4 |
| `pages/Users.tsx` | 17 | `hr/HRStatsBar.tsx` | 4 |
| `customers/CustomersModals.tsx` | 16 | (+ ~10 fichiers à 1–3) | ~20 |
| `pages/AIAssistant.tsx` | 16 | | |

**Total backlog ≈ 514 chaînes** sur ~27 fichiers. Les plus gros (HRModals 93, HRTabs 68, ReportsTabs 43) concentrent ~40 % de la dette.

---

## Règle de correction (pour le backlog)

Conserver le pattern du fichier ; étendre le binaire en 4 langues :

```tsx
// AVANT (es/it → anglais)
lang === 'fr' ? 'Encaisser' : 'Checkout'
// APRÈS
lang === 'en' ? 'Checkout' : lang === 'es' ? 'Cobrar' : lang === 'it' ? 'Incassa' : 'Encaisser'
```

Les fichiers qui importent déjà `useI18n` peuvent préférer `i('Encaisser','Checkout','Cobrar','Incassa')`.

**Ne pas traduire :** noms propres (Wave, Orange Money, HabaShop), codes (XOF, EUR), formats de date, valeurs DB, noms techniques.

---

## Recommandation

La localisation es/it est **fonctionnelle sur la navigation et les écrans cœur** après ce sprint. Le backlog (~514 chaînes) est **mécanique mais volumineux** ; le traiter en un seul passage serait risqué (erreurs de chaîne, JSX). Recommandation : le résorber **par lots de fichiers** (prochain lot conseillé : HRModals + HRTabs + ReportsTabs = ~204 chaînes, soit 40 % de la dette).
