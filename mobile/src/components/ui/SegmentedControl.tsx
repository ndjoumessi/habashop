import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'

export interface Segment {
  key:    string
  label:  string
  count?: number
}

interface SegmentedControlProps {
  segments: Segment[]
  value:    string
  onChange: (key: string) => void
}

// Contrôle segmenté (onglets à largeur égale) avec compteur optionnel.
// Unifie les filtres de statut (Stock : Tous / Stock bas / Rupture). Hauteur 44.
export default function SegmentedControl({ segments, value, onChange }: SegmentedControlProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <View style={s.row}>
      {segments.map(seg => {
        const on = value === seg.key
        return (
          <Pressable
            key={seg.key}
            style={[s.seg, on && s.segOn]}
            onPress={() => onChange(seg.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={seg.count != null ? `${seg.label}, ${seg.count}` : seg.label}
          >
            <Text style={[s.txt, on && s.txtOn]} numberOfLines={1}>{seg.label}</Text>
            {seg.count != null && (
              <View style={[s.badge, on && s.badgeOn]}>
                <Text style={[s.badgeTxt, on && s.badgeTxtOn]}>{seg.count}</Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  seg: {
    flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: BorderRadius.md, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
  },
  segOn: { backgroundColor: C.primary, borderColor: C.primary },
  txt: { fontSize: FontSize.xs, fontFamily: 'Geist_700Bold', color: C.text2 },
  txtOn: { color: C.white },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: C.bg4, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: withAlpha(C.white, 0.25) },
  badgeTxt: { fontSize: FontSize.xs, fontFamily: 'Geist_800ExtraBold', color: C.text3 },
  badgeTxtOn: { color: C.white },
})
