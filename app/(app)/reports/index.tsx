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
import { salesApi, analyticsApi } from '@/services/api'
import { useI18n, useFmt } from '@/stores/appStore'
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'

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

interface Sale {
  id: string; total: number; paymentMode: string
  createdAt: string; items?: any[]
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets()
  const { i, lang } = useI18n()
  const { fmt } = useFmt()
  const [period, setPeriod] = useState<Period>('7d')

  const { data: sales = [], isLoading, isError, refetch, isRefetching } = useQuery<Sale[]>({
    queryKey: ['sales', 'reports'],
    queryFn: async () => {
      const r = await salesApi.list({ limit: 500 })
      return Array.isArray(r) ? r : (r?.data ?? r?.sales ?? [])
    },
    staleTime: 2 * 60 * 1000,
  })
  const { data: dash } = useQuery({
    queryKey: ['dashboard'], queryFn: analyticsApi.dashboard, staleTime: 5 * 60 * 1000,
  })
  const topProds: any[] = dash?.topProducts ?? []

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

  const maxTop = Math.max(1, ...topProds.map((p: any) => p.ca ?? 0))

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
    } catch (e: any) {
      Alert.alert(i('Erreur export', 'Export error', 'Error exportación', 'Errore esportazione'), String(e?.message ?? e))
    }
  }

  const periodLabel = (() => { const p = PERIODS.find(x => x.key === period)!; return i(p.fr, p.en, p.es, p.it) })()

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.headerBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{i('Rapports', 'Reports', 'Informes', 'Rapporti')}</Text>
          <Text style={s.subtitle}>{periodLabel}</Text>
        </View>
        <Pressable style={s.headerBtn} onPress={exportCsv} hitSlop={8}>
          <Ionicons name="download-outline" size={20} color={Colors.text} />
        </Pressable>
      </View>

      {/* Sélecteur période */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.periods}>
        {PERIODS.map(p => {
          const on = period === p.key
          return (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{i(p.fr, p.en, p.es, p.it)}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : isError ? (
        <Pressable style={s.center} onPress={() => refetch()}>
          <Text style={s.errTxt}>⚠️ {i('Erreur — toucher pour réessayer', 'Error — tap to retry', 'Error — toca para reintentar', 'Errore — tocca per riprovare')}</Text>
        </Pressable>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
        >
          {/* KPIs */}
          <View style={s.kpiGrid}>
            <View style={[s.kpiCard, { borderColor: `${Colors.accent}30` }]}>
              <Text style={s.kpiLabel}>{i('CA période', 'Period revenue', 'Ingresos período', 'Ricavi periodo')}</Text>
              <Text style={[s.kpiValue, { color: Colors.accent }]}>{fmt(ca)}</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: `${Colors.primary}30` }]}>
              <Text style={s.kpiLabel}>{i('Transactions', 'Transactions', 'Transacciones', 'Transazioni')}</Text>
              <Text style={[s.kpiValue, { color: Colors.primary3 }]}>{String(tx)}</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: `${Colors.accent3}30` }]}>
              <Text style={s.kpiLabel}>{i('Panier moyen', 'Avg. basket', 'Cesta media', 'Carrello medio')}</Text>
              <Text style={[s.kpiValue, { color: Colors.accent3 }]}>{fmt(avg)}</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: `${Colors.accent2}30` }]}>
              <Text style={s.kpiLabel}>{i('Meilleure journée', 'Best day', 'Mejor día', 'Giorno migliore')}</Text>
              <Text style={[s.kpiValue, { color: Colors.accent2 }]}>{fmt(bestDay.value)}</Text>
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
                {topProds.slice(0, 5).map((p: any, idx: number) => (
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
            <Pressable style={s.exportBtn} onPress={exportCsv}>
              <Ionicons name="download-outline" size={18} color={Colors.white} />
              <Text style={s.exportTxt}>{i('Exporter CSV', 'Export CSV', 'Exportar CSV', 'Esporta CSV')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  errTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.danger, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3, textAlign: 'center', padding: Spacing.lg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  subtitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: Colors.text3, marginTop: 1 },

  periods: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: Colors.text2 },
  chipTxtOn: { color: Colors.white },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  kpiCard: {
    width: '47%', backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, padding: Spacing.md, gap: 2, ...Shadow.sm,
  },
  kpiLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },
  kpiValue: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: -0.5 },
  kpiSub: { fontSize: 9, fontFamily: 'Outfit_400Regular', color: Colors.text4, marginTop: 2 },

  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: Colors.text3,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.md,
  },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.md },

  chartCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: 130 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '70%', flex: 1, backgroundColor: Colors.bg4, borderRadius: BorderRadius.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.sm },
  barLabel: { fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  topRank: { fontSize: 18, width: 26 },
  topName: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },
  topCa: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent },
  progTrack: { height: 5, backgroundColor: Colors.bg4, borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  payLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: Colors.text, width: 110 },
  payBarTrack: { flex: 1, height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: 'hidden' },
  payBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  payPct: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text2, width: 38, textAlign: 'right' },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, height: 50, ...Shadow.colored(Colors.primary),
  },
  exportTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
})
