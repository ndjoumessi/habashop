# 🎨 Audit UI/UX — HabaShop Mobile

**Date :** 2026-05-27 · **Périmètre :** React Native / Expo SDK 54 — `app/**` + `src/components/**`
(14 fichiers `.tsx`, ~3 180 lignes)
**Méthode :** mesures réelles sur le code (grep/regex) + lecture intégrale de `settings.tsx` & `pos/index.tsx`.
Scoring via la formule Phase 4 (voir § Méthodologie).

> ⚠️ Le skill `/mnt/skills/user/uiux-audit/SKILL.md` est **introuvable** sur cette machine
> (`/mnt` inexistant). Audit réalisé sur la spec inline fournie, adaptée React Native.

---

## Synthèse

| Dimension | Score | Statut |
|-----------|:-----:|:------:|
| ♿ Accessibilité (a11y) | **0/10** | 🔴 |
| 📝 Formulaires / Inputs | 4/10 | 🟠 |
| 🎨 Design tokens | 9/10 | 🟢 |
| ⏳ Loading / Feedback | 7/10 | 🟢 |
| 🌍 i18n couverture | 9/10 | 🟢 |
| 🏗️ Architecture code | 7/10 | 🟢 |
| **TOTAL** | **36/60** | 🟡 |

**Score global (pondéré par lignes) : 62.5 % 🟡** — moyenne simple 55 %.

> **Verdict en une phrase :** une base **excellente** sur les tokens (`Colors.*`), l'i18n (155 appels `i()`),
> `StyleSheet.create` et les états de chargement — **plombée par une accessibilité littéralement
> inexistante** : **0 attribut `accessibility*`** dans toute l'app, sur **131 Touchables/Pressables** et
> **11 `TextInput`**. C'est le seul axe vraiment critique, mais il l'est pour 100 % des écrans.

---

## 🔴 Problèmes critiques (accessibilité)

### 1. `TouchableOpacity` / `Pressable` sans `accessibilityLabel` ni `accessibilityRole`
**Impact :** TalkBack (Android) / VoiceOver (iOS) annoncent un élément **sans nom ni rôle** → app
quasi inutilisable au lecteur d'écran.
**Preuve :** **131** Touchables/Pressables, **0** attribut `accessibility*` (mesuré sur tout `app/` + `src/`).
Exemples : `settings.tsx` (sélecteurs langue/devise, 3 `Switch`, déconnexion), `pos/index.tsx` (cartes
produit, +/- panier, modes de paiement), `stock.tsx` (24 `onPress`), `dashboard.tsx` (actions rapides).

```tsx
// AVANT (settings.tsx — sélecteur de langue)
<Pressable onPress={() => handleSetLang(l.code)}>
  <Text>{l.label}</Text>
</Pressable>

// APRÈS
<Pressable
  onPress={() => handleSetLang(l.code)}
  accessibilityRole="button"
  accessibilityState={{ selected: lang === l.code }}
  accessibilityLabel={i('Langue','Language','Idioma','Lingua') + ' ' + l.label}
>
  <Text>{l.label}</Text>
</Pressable>
```

### 2. `TextInput` sans `accessibilityLabel`
**Impact :** champs de saisie illisibles au lecteur d'écran ; le `placeholder` (qui disparaît à la saisie)
sert souvent de seul indice.
**Preuve :** **11** `TextInput` (login email/mot de passe, recherche POS, montant espèces, édition qté
stock, recherche clients), **0** `accessibilityLabel`.

```tsx
<TextInput
  accessibilityLabel={i('Email','Email','Email','Email')}
  accessibilityHint={i('Entrez votre adresse email','Enter your email','Ingrese su email','Inserisci email')}
  value={email} onChangeText={setEmail}
/>
```

### 3. `Switch` non étiquetés (settings.tsx)
Les 3 toggles notifications ont leur libellé dans un `<Text>` **séparé**, non relié au `Switch` → le
lecteur annonce « interrupteur, activé » sans dire de quoi. Ajouter `accessibilityLabel` sur chaque `Switch`.

---

## 🟠 Problèmes majeurs

### 4. `pos/index.tsx` monolithique (659 lignes)
Caisse = écran le plus utilisé, regroupe grille produits, panier, modales panier/confirmation, scanner,
offline, ticket WhatsApp dans **un seul composant**. À découper (`ProductGrid`, `CartSheet`, `ConfirmModal`).
`dashboard.tsx` (528) est dans une moindre mesure concerné.

### 5. Couleurs `rgba()` hardcodées (primaire/danger avec alpha)
Tokens **très bien** utilisés (384 `Colors.*`), mais quelques `rgba(108,71,255,0.x)` / `rgba(255,59,92,0.x)`
en dur (settings, customers, BarcodeScanner) = la couleur primaire/danger avec opacité, recopiée à la main.
→ Helper `withAlpha(Colors.primary, 0.15)` ou tokens dédiés. `BarcodeScanner.tsx` : 7 hex (`#000`/`#fff`
de l'overlay caméra) — acceptable mais tokenisable.

### 6. États d'erreur API peu visibles
Plusieurs écrans gèrent le chargement (`ActivityIndicator`/`RefreshControl` : 10/13 fichiers) et un
état d'erreur (`isError` → retry dans POS/Dashboard), mais d'autres « avalent » l'erreur (`.catch(() => {})`,
ex. `Expenses`/chargement settings) sans feedback utilisateur. Standardiser un état d'erreur + retry.

---

## 🟡 Améliorations mineures

- **7. Contraste** : `placeholderTextColor={Colors.text4}` (#404060) et textes `text4` sur fond sombre → sous le seuil WCAG AA probable.
- **8. Cibles tactiles** : certaines lignes/icônes < 44×44 pt (`mini` boutons, `gridCheck`) — vérifier la taille de hit (`hitSlop`).
- **9. Haptique** : présent au POS (ajout produit, succès vente) mais absent ailleurs (toggles, navigation) → cohérence.
- **10. Sprawl typo** : tailles de police variées via `FontSize` (bien) mais quelques littéraux (`fontSize: 9/10/11/13/22`) en dur dans les styles.

> ✅ **Faux positifs vérifiés** (à NE PAS « corriger ») : i18n déjà complet (155 `i()`, 0 `tr()` orphelin) ;
> pas de `onPress` sur `<View>` ; pas d'`<Image>` sans label (l'UI est en icônes Ionicons + emojis).

---

## 📊 Score par écran

| Écran | Score | Points forts | Points faibles |
|-------|:-----:|--------------|----------------|
| `(tabs)/stock` | 70/100 | tokens, i18n, loading, StyleSheet | 0 a11y (24 onPress) |
| `reports/index` | 70/100 | tokens, i18n, loading, barres CSS | 0 a11y |
| `(tabs)/customers` | 69/100 | tokens, i18n, loading | 0 a11y, 1 hex |
| `(tabs)/dashboard` | 67/100 | tokens, i18n, loading | 0 a11y, 528 l. |
| `(auth)/login` | 67/100 | tokens, loading | 0 a11y, 3 inputs nus |
| `pos/index` | 64/100 | tokens, i18n, loading, haptics | 0 a11y, **659 l.** monolithe |
| `(tabs)/settings` | 53/100 | tokens, i18n, StyleSheet exemplaires | 0 a11y (16 Pressable/Switch), pas de loading |
| `components/pos/BarcodeScanner` | 42/100 | i18n, gère permission caméra | 0 a11y, 7 hex (`#000`/`#fff`) |

*(Fichiers de plomberie `_layout.tsx` / `index.tsx` exclus du tableau — peu de surface UI.)*

---

## 🎯 Plan d'action

### Sprint A — Critique (accessibilité, semaine 1)
- [ ] `accessibilityRole="button"` + `accessibilityLabel` sur **tous** les Touchable/Pressable (131)
- [ ] `accessibilityLabel` (+ `accessibilityHint`) sur **tous** les `TextInput` (11)
- [ ] `accessibilityLabel` + `accessibilityState` sur les 3 `Switch` de settings
- [ ] Tester au lecteur d'écran (TalkBack) sur POS, login, settings

### Sprint B — Important (semaine 2)
- [ ] Composants `AccessibleButton` / `AccessibleInput` (ci-dessous) et migration progressive
- [ ] Helper `withAlpha()` pour les `rgba()` primaire/danger ; tokeniser les `#000/#fff` du scanner
- [ ] État d'erreur + retry standardisé (remplacer les `.catch(() => {})` silencieux)

### Sprint C — Optimisation (mois 2)
- [ ] Découper `pos/index.tsx` (ProductGrid / CartSheet / ConfirmModal) et alléger `dashboard.tsx`
- [ ] Haptique cohérente (toggles, navigation) via un wrapper
- [ ] Vérifier cibles tactiles ≥ 44 pt + contrastes `text4`

---

## 🧩 Composants recommandés (React Native)

### `AccessibleButton.tsx`
```tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, BorderRadius, FontSize } from '@/constants/theme'

interface Props {
  label: string; onPress: () => void
  variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; hint?: string
}

export default function AccessibleButton({ label, onPress, variant = 'primary', disabled = false, hint }: Props) {
  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress() }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={[s.btn, s[variant], disabled && s.disabled]}
    >
      <Text style={[s.text, variant === 'ghost' ? s.textGhost : s.textOn]}>{label}</Text>
    </TouchableOpacity>
  )
}
const s = StyleSheet.create({
  btn: { height: 52, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primary: { backgroundColor: Colors.primary },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  danger: { backgroundColor: Colors.danger },
  disabled: { opacity: 0.5 },
  text: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold' },
  textOn: { color: Colors.white }, textGhost: { color: Colors.text2 },
})
```

### `AccessibleInput.tsx`
```tsx
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { Colors, BorderRadius, FontSize, Spacing } from '@/constants/theme'

interface Props extends TextInputProps { label: string; hint?: string; error?: string }

export default function AccessibleInput({ label, hint, error, ...props }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={hint}
        aria-invalid={!!error}            {/* RN 0.71+ : aria-* ; PAS de prop accessibilityInvalid */}
        placeholderTextColor={Colors.text3}  {/* text3 > text4 pour le contraste */}
        style={[s.input, error && s.inputError, props.style]}
      />
      {error
        ? <Text style={s.error} accessibilityRole="alert">⚠ {error}</Text>
        : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}
const s = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: Colors.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: Colors.text },
  inputError: { borderColor: Colors.danger },
  hint: { fontSize: 11, color: Colors.text3, fontFamily: 'Outfit_400Regular' },
  error: { fontSize: 11, color: Colors.danger, fontFamily: 'Outfit_700Bold' },
})
```

> Note RN : `accessibilityInvalid` **n'existe pas** — utiliser `aria-invalid` (RN ≥ 0.71) ou
> `accessibilityState`. Corrigé ci-dessus par rapport à la proposition initiale.

---

## 🔬 Méthodologie & limites

- **Métriques** : `grep`/regex sur `app/**` + `src/**` (lignes, `accessibility*`, `onPress`, `TextInput/Switch`,
  `'#hex'`, `Colors.`, `ActivityIndicator/RefreshControl/isLoading`, `StyleSheet.create`, `i('`).
- **Scoring/écran** : `access = min(100, access/max(1,inputs+press)·200)` · `token = Colors/(Colors+hex)·100` ·
  `load = 100|20` · `i18n = i()/(i()+texte_codé)·100` · `(100|50 si StyleSheet)` · `penalty = max(0,(lines-400)/50)` ·
  `score = access·0.30 + token·0.25 + load·0.20 + i18n·0.15 + ss·0.10 − penalty`. Global = moyenne pondérée par lignes.
- **Limites** : (1) `load_score` pénalise à 20 les écrans qui **n'ont pas besoin** de chargement async (settings, layouts) → leur score réel est meilleur ; (2) `i18n_score` est tiré vers le bas par les fichiers `_layout` sans texte ; (3) les `rgba()` hardcodés ne sont pas comptés comme « hex », donc `token_score` est légèrement optimiste. Les scores sont des **indicateurs de priorisation**.
