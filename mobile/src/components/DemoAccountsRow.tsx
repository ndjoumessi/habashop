import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize } from '@/constants/theme'
import { demoModeEnabled, DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demoAccounts'

/**
 * RANGÉE DE RACCOURCIS DÉMO — et LA garde, en un seul endroit.
 *
 * ─── POURQUOI UN COMPOSANT ───────────────────────────────────────────────────
 * Le bloc vivait en JSX dans `app/(auth)/login.tsx`, donc impossible à exercer
 * sans monter tout l'écran (routeur, stores, api, biométrie). Résultat : le seul
 * verrou possible lisait le TEXTE SOURCE de l'écran — ce qui prouve la source,
 * jamais le rendu, et reste vert si le bloc devient inatteignable ou l'inverse.
 *
 * ⚠️ LA GARDE EST ICI, PAS CHEZ L'APPELANT. `login.tsx` rend ce composant sans
 * condition ; c'est lui qui rend `null`. Un seul endroit où le drapeau décide,
 * donc un seul endroit à tester — et rien à oublier de recopier le jour où un
 * autre écran voudrait le même raccourci.
 *
 * ⚠️ CE N'EST PAS LA SÉCURITÉ, et il ne faut pas le lire comme tel : le mot de
 * passe démo est PUBLIC (dépôt public, README), et ce sont les tenants `isDemo`
 * qui bornent le coût côté SERVEUR. Ceci empêche seulement qu'un commerçant réel
 * voie des boutons de connexion démo — ce que le build store faisait.
 *
 * ⚠️ ET LE DRAPEAU NE RETIRE RIEN DE L'ARTEFACT : MESURÉ le 2026-08-09, deux
 * `expo export` (drapeau absent puis `1`) rendent deux `.hbc` qui DIFFÈRENT bien
 * (6 397 924 / 6 397 922 octets — la substitution atteint l'artefact) mais où
 * `demo1234` et les libellés sont présents DANS LES DEUX. Metro n'élimine pas la branche morte comme
 * Rollup côté web. Ce composant masque à l'exécution, il n'allège pas le bundle.
 */
export default function DemoAccountsRow({ onPick }: { onPick: (email: string, password: string) => void }) {
  const { i } = useI18n()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])

  // ⚠️ APRÈS les hooks — les appeler conditionnellement violerait les règles de React.
  if (!demoModeEnabled()) return null

  return (
    <View style={s.demoWrap}>
      <Text style={s.demoLabel}>
        {i('Comptes démo :', 'Demo accounts:', 'Cuentas demo:', 'Account demo:')}
      </Text>
      <View style={s.demoRow}>
        {DEMO_ACCOUNTS.map(acc => (
          <TouchableOpacity
            key={acc.email}
            style={s.demoChip}
            onPress={() => onPick(acc.email, DEMO_PASSWORD)}
            accessibilityRole="button"
            accessibilityLabel={i(
              `Préremplir le compte démo ${acc.label}`,
              `Prefill ${acc.label} demo account`,
              `Rellenar la cuenta demo ${acc.label}`,
              `Precompila l'account demo ${acc.label}`,
            )}>
            <Text style={s.demoChipTxt}>{acc.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  demoWrap: { alignItems: 'center', gap: Spacing.sm },
  demoLabel: {
    fontSize: FontSize.xs, fontFamily: 'Geist_400Regular',
    color: C.text3,
  },
  demoRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: Spacing.xs,
  },
  demoChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
  },
  demoChipTxt: {
    fontSize: FontSize.xs, fontFamily: 'Geist_700Bold',
    color: C.primary3,
  },
})
