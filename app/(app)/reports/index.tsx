import { useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Pressable, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as Haptics from 'expo-haptics'
import { salesApi, analyticsApi, apiErrorMessage } from '@/services/api'
import type { SaleRecord, DashboardTopProduct } from '@/types'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { Spacing, BorderRadius, FontSize, Shadow, ThemeColors } from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'
import ScreenHeader from '@/components/ui/ScreenHeader'
import Chip from '@/components/ui/Chip'
import AccessibleButton from '@/components/ui/AccessibleButton'

type Period = 'today' | '7d' | '30d' | '90d'
const PERIODS: { key: Period; days: number; fr: string; en: string; es: string; it: string }[] = [
  { key: 'today', days: 1,  fr: "Aujourd'hui", en: 'Today',   es: 'Hoy',     it: 'Oggi'     },
  { key: '7d',    days: 7,  fr: '7 jours',     en: '7 days',  es: '7 días',  it: '7 giorni' },
  { key: '30d',   days: 30, fr: '30 jours',    en: '30 days', es: '30 días', it: '30 giorni'},
  { key: '90d',   days: 90, fr: '90 jours',    en: '90 days', es: '90 días', it: '90 giorni'},
]

// Abréviations jours manuelles (Hermes/Android ignore les options de toLocaleDateString)
const WEEKDAYS: Record<string, string[]> = {
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  it: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i, lang } = useI18n()
  const { fmt } = useFmt()
  const [period, setPeriod] = useState<Period>('7d')

  const { data: sales = [], isLoading, isError, refetch, isRefetching } = useQuery<SaleRecord[]>({
    queryKey: ['sales', 'reports'],
    queryFn: () => salesApi.list({ limit: 500 }),
    staleTime: 2 * 60 * 1000,
  })
  const { data: dash } = useQuery({
    queryKey: ['dashboard'], queryFn: analyticsApi.dashboard, staleTime: 5 * 60 * 1000,
  })
  const topProds: DashboardTopProduct[] = dash?.topProducts ?? []

  const periodDays = PERIODS.find(p => p.key === period)!.days
  const since = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (periodDays - 1)); return d
  }, [periodDays])

  const filtered = useMemo(
    () => sales.filter(s => { const t = new Date(s.createdAt); return !isNaN(+t) && t >= since }),
    [sales, since],
  )

  // KPIs
  const ca  = filtered.reduce((sum, s) => sum + (s.total ?? 0), 0)
  const tx  = filtered.length
  const avg = tx > 0 ? ca / tx : 0

  // CA par jour (max 7 barres)
  const byDay = useMemo(() => {
    const days = Math.min(periodDays, 7)
    const arr: { label: string; value: number }[] = []
    const wd = WEEKDAYS[lang] ?? WEEKDAYS.fr
    for (let k = days - 1; k >= 0; k--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k)
      const next = new Date(d); next.setDate(d.getDate() + 1)
      const v = filtered
        .filter(s => { const t = new Date(s.createdAt); return t >= d && t < next })
        .reduce((sum, s) => sum + (s.total ?? 0), 0)
      arr.push({ label: wd[d.getDay()], value: v })
    }
    return arr
  }, [filtered, periodDays, lang])
  const maxDay  = Math.max(1, ...byDay.map(d => d.value))
  const bestDay = byDay.reduce((b, d) => (d.value > b.value ? d : b), { label: '—', value: 0 })

  // Répartition paiements
  const payAgg = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of filtered) {
      const k = s.paymentMode ?? 'cash'
      m[k] = (m[k] ?? 0) + (s.total ?? 0)
    }
    return m
  }, [filtered])
  const payTotal = Object.values(payAgg).reduce((a, b) => a + b, 0) || 1

  const payLabel = (mode: string) =>
    mode === 'cash'   ? '💵 ' + i('Espèces', 'Cash', 'Efectivo', 'Contanti') :
    mode === 'wave'   ? '🌊 Wave' :
    mode === 'orange' ? '🟠 Orange Money' :
    mode === 'card'   ? '💳 ' + i('Carte', 'Card', 'Tarjeta', 'Carta') :
    mode

  const maxTop = Math.max(1, ...topProds.map((p) => p.ca ?? 0))

  // Export CSV
  const exportCsv = async () => {
    try {
      if (filtered.length === 0) {
        Alert.alert(i('Aucune vente', 'No sales', 'Sin ventas', 'Nessuna vendita'), '')
        return
      }
      const rows = [
        ['id', 'date', 'total_XOF', 'paymentMode', 'nb_articles'],
        ...filtered.map(s => [
          s.id,
          new Date(s.createdAt).toISOString(),
          String(s.total ?? 0),
          s.paymentMode ?? '',
          String(s.items?.length ?? 0),
        ]),
      ]
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

      const file = new File(Paths.cache, `rapport-ventes-${Date.now()}.csv`)
      file.create()
      file.write(csv)

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(i('Partage indisponible', 'Sharing unavailable', 'Compartir no disponible', 'Condivisione non disponibile'), '')
        return
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: i('Exporter les ventes', 'Export sales', 'Exportar ventas', 'Esporta vendite'),
        UTI: 'public.comma-separated-values-text',
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (e: unknown) {
      Alert.alert(i('Erreur export', 'Export error', 'Error exportación', 'Errore esportazione'), apiErrorMessage(e) ?? String(e))
    }
  }

  const periodLabel = (() => { const p = PERIODS.find(x => x.key === period)!; return i(p.fr, p.en, p.es, p.it) })()

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader
        title={i('Rapports', 'Reports', 'Informes', 'Rapporti')}
        subtitle={periodLabel}
        onBack={() => router.back()}
        right={
          <Pressable style={s.headerBtn} onPress={exportCsv} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Exporter CSV', 'Export CSV', 'Exportar CSV', 'Esporta CSV')}>
            <Ionicons name="download-outline" size={20} color={C.text} />
          </Pressable>
        }
      />

      {/* Sélecteur période */}
      {/* View flex (pas ScrollView) : le ScrollView horizontal Android clippait la descendante
          du « j » (« jours » → « iours ») même avec lineHeight ; flexWrap gère le débordement. */}
      <View style={s.periods}>
        {PERIODS.map(p => (
          <Chip
            key={p.key}
            label={i(p.fr, p.en, p.es, p.it)}
            selected={period === p.key}
            onPress={() => setPeriod(p.key)}
          />
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} colors={[C.primary]} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
        >
          {/* KPIs */}
          <View style={s.kpiGrid}>
            <View style={[s.kpiCard, { borderColor: `${C.accent}30` }]}>
              <Text style={s.kpiLabel}>{i('CA période', 'Period revenue', 'Ingresos período', 'Ricavi periodo')}</Text>
              <Text style={[s.kpiValue, { color: C.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmt(ca)}</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: `${C.primary}30` }]}>
              <Text style={s.kpiLabel}>{i('Transactions', 'Transactions', 'Transacciones', 'Transazioni')}</Text>
              <Text style={[s.kpiValue, { color: C.primary3 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{String(tx)}</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: `${C.accent}30` }]}>
              <Text style={s.kpiLabel}>{i('Panier moyen', 'Avg. basket', 'Cesta media', 'Carrello medio')}</Text>
              <Text style={[s.kpiValue, { color: C.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmt(avg)}</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: `${C.accent2}30` }]}>
              <Text style={s.kpiLabel}>{i('Meilleure journée', 'Best day', 'Mejor día', 'Giorno migliore')}</Text>
              <Text style={[s.kpiValue, { color: C.accent2 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmt(bestDay.value)}</Text>
              <Text style={s.kpiSub}>{bestDay.label}</Text>
            </View>
          </View>

          {/* Graphique ventes */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{i('Ventes par jour', 'Sales per day', 'Ventas por día', 'Vendite al giorno')}</Text>
            <View style={s.chartCard}>
              <View style={s.chart}>
                {byDay.map((d, idx) => (
                  <View key={idx} style={s.barCol}>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { height: `${Math.max(2, (d.value / maxDay) * 100)}%` }]} />
                    </View>
                    <Text style={s.barLabel} numberOfLines={1}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Top produits */}
          {topProds.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🏆 {i('Top produits', 'Top products', 'Mejores productos', 'Prodotti top')}</Text>
              <View style={s.card}>
                {topProds.slice(0, 5).map((p, idx: number) => (
                  <View key={idx} style={s.topRow}>
                    <Text style={s.topRank}>{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.topName} numberOfLines={1}>{p.name}</Text>
                      <View style={s.progTrack}>
                        <View style={[s.progFill, { width: `${Math.max(4, ((p.ca ?? 0) / maxTop) * 100)}%` }]} />
                      </View>
                    </View>
                    <Text style={s.topCa}>{fmt(p.ca ?? 0)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Répartition paiements */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{i('Répartition paiements', 'Payment breakdown', 'Desglose de pagos', 'Ripartizione pagamenti')}</Text>
            <View style={s.card}>
              {Object.keys(payAgg).length === 0 ? (
                <Text style={s.emptyTxt}>{i('Aucune donnée', 'No data', 'Sin datos', 'Nessun dato')}</Text>
              ) : (
                Object.entries(payAgg)
                  .sort((a, b) => b[1] - a[1])
                  .map(([mode, amount]) => {
                    const pct = Math.round((amount / payTotal) * 100)
                    return (
                      <View key={mode} style={s.payRow}>
                        <Text style={s.payLabel} numberOfLines={1}>{payLabel(mode)}</Text>
                        <View style={s.payBarTrack}>
                          <View style={[s.payBarFill, { width: `${Math.max(3, pct)}%` }]} />
                        </View>
                        <Text style={s.payPct}>{pct}%</Text>
                      </View>
                    )
                  })
              )}
            </View>
          </View>

          {/* Export */}
          <View style={s.section}>
            <AccessibleButton
              label={i('Exporter CSV', 'Export CSV', 'Exportar CSV', 'Esporta CSV')}
              icon="download-outline"
              onPress={exportCsv}
              hint={i('Exporter les ventes en CSV', 'Export sales to CSV', 'Exportar ventas a CSV', 'Esporta vendite in CSV')}
            />
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  errTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', padding: Spacing.lg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  subtitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 1 },

  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  chipTxtOn: { color: C.white },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  kpiCard: {
    width: '47%', backgroundColor: C.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, padding: Spacing.md, gap: 2, ...Shadow.sm,
  },
  kpiLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
  kpiValue: { fontSize: FontSize.xxxl, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: -0.5 },
  kpiSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },

  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.md,
  },
  card: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md },

  chartCard: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: 130 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '70%', flex: 1, backgroundColor: C.bg4, borderRadius: BorderRadius.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: C.primary, borderRadius: BorderRadius.sm },
  barLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  topRank: { fontSize: 18, width: 26 },
  topName: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },
  topCa: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.accent },
  progTrack: { height: 5, backgroundColor: C.bg4, borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  payLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text, width: 110 },
  payBarTrack: { flex: 1, height: 8, backgroundColor: C.bg4, borderRadius: 4, overflow: 'hidden' },
  payBarFill: { height: '100%', backgroundColor: C.primary, borderRadius: 4 },
  payPct: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_700Bold', color: C.text2, width: 38, textAlign: 'right' },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: C.primary, borderRadius: BorderRadius.md, height: 50, ...Shadow.colored(C.primary),
  },
  exportTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
})
