import { useMemo, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { salesApi } from '@/services/api'
import type { SaleRecord } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { sendWhatsAppTicket } from '@/services/whatsappTicket'
import ErrorState from '@/components/ui/ErrorState'
import { Spacing, BorderRadius, FontSize, Shadow, withAlpha, ThemeColors } from '@/constants/theme'

type Period = 'today' | '7d' | '30d'
const PERIODS: { key: Period; days: number; fr: string; en: string; es: string; it: string }[] = [
  { key: 'today', days: 1,  fr: "Aujourd'hui", en: 'Today',   es: 'Hoy',     it: 'Oggi'     },
  { key: '7d',    days: 7,  fr: '7 jours',     en: '7 days',  es: '7 días',  it: '7 giorni' },
  { key: '30d',   days: 30, fr: '30 jours',    en: '30 days', es: '30 días', it: '30 giorni'},
]
const PAY_ICON: Record<string, string> = { cash: '💵', wave: '🌊', orange: '🟠', card: '💳' }

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(+d)) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i, lang } = useI18n()
  const { fmt, currency } = useFmt()
  const { tenant } = useAuthStore()
  const [period, setPeriod] = useState<Period>('7d')
  const [sel, setSel] = useState<SaleRecord | null>(null)

  const { data: sales = [], isLoading, isError, refetch, isRefetching } = useQuery<SaleRecord[]>({
    queryKey: ['sales', 'history'],
    queryFn: () => salesApi.list({ limit: 500 }),
    staleTime: 2 * 60 * 1000,
  })

  const periodDays = PERIODS.find(p => p.key === period)!.days
  const since = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (periodDays - 1)); return d
  }, [periodDays])

  const filtered = useMemo(
    () => sales.filter(s => { const t = new Date(s.createdAt); return !isNaN(+t) && t >= since }),
    [sales, since],
  )
  const ca = filtered.reduce((sum, s) => sum + (s.total ?? 0), 0)
  const tx = filtered.length
  const avg = tx > 0 ? ca / tx : 0

  const resendWhatsApp = async (sale: SaleRecord) => {
    const items = (sale.items ?? []).map(it => ({
      productId: it.productId,
      name: it.product?.name ?? '—',
      price: it.unitPrice ?? 0,
      quantity: it.qty ?? 0,
      emoji: it.product?.emoji ?? '📦',
      stockQty: 0,
    }))
    const ok = await sendWhatsAppTicket({
      items, total: sale.total ?? 0, paymentMode: sale.paymentMode,
      saleId: sale.id, shopName: tenant?.name ?? 'HabaShop', currency, lang, fmt, vatRate: tenant?.vatRate,
    })
    if (!ok) {
      Alert.alert(i('WhatsApp indisponible', 'WhatsApp unavailable', 'WhatsApp no disponible', 'WhatsApp non disponibile'), '')
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.headerBtn} onPress={() => router.back()} hitSlop={8}
          accessibilityRole="button" accessibilityLabel={i('Retour', 'Back', 'Volver', 'Indietro')}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{i('Historique', 'History', 'Historial', 'Storico')}</Text>
          <Text style={s.subtitle}>{tx} {i('ventes', 'sales', 'ventas', 'vendite')}</Text>
        </View>
      </View>

      {/* Sélecteur période */}
      <View style={s.periods}>
        {PERIODS.map(p => {
          const on = period === p.key
          return (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[s.chip, on && s.chipOn]}
              accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={i(p.fr, p.en, p.es, p.it)}>
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{i(p.fr, p.en, p.es, p.it)}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statBox}><Text style={[s.statVal, { color: C.accent }]}>{fmt(ca)}</Text><Text style={s.statLabel}>{i('CA total', 'Revenue', 'CA total', 'Ricavi')}</Text></View>
        <View style={s.statBox}><Text style={[s.statVal, { color: C.primary3 }]}>{String(tx)}</Text><Text style={s.statLabel}>{i('Ventes', 'Sales', 'Ventas', 'Vendite')}</Text></View>
        <View style={s.statBox}><Text style={[s.statVal, { color: C.accent3 }]}>{fmt(avg)}</Text><Text style={s.statLabel}>{i('Panier moyen', 'Avg basket', 'Cesta media', 'Carrello medio')}</Text></View>
      </View>

      {/* Liste */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, paddingBottom: insets.bottom + Spacing.xxxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} colors={[C.primary]} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 48 }}>🧾</Text>
              <Text style={s.emptyTitle}>{i('Aucune vente', 'No sales', 'Sin ventas', 'Nessuna vendita')}</Text>
              <Text style={s.emptyTxt}>{i('Les ventes encaissées apparaîtront ici.', 'Recorded sales will appear here.', 'Las ventas registradas aparecerán aquí.', 'Le vendite registrate appariranno qui.')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => setSel(item)}
              accessibilityRole="button"
              accessibilityLabel={`${fmt(item.total ?? 0)}, ${fmtDateTime(item.createdAt)}`}>
              <Text style={{ fontSize: 26 }}>{PAY_ICON[item.paymentMode] ?? '💳'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTotal}>{fmt(item.total ?? 0)}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {fmtDateTime(item.createdAt)} · {item.items?.length ?? 0} {i('articles', 'items', 'artículos', 'articoli')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.text3} />
            </Pressable>
          )}
        />
      )}

      {/* Modal détail */}
      <Modal visible={!!sel} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSel(null)}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{i('Détail de la vente', 'Sale detail', 'Detalle de venta', 'Dettaglio vendita')}</Text>
            <Pressable onPress={() => setSel(null)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>
          {sel && (
            <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>{fmtDateTime(sel.createdAt)}</Text>
                <Text style={s.ref}>#{sel.id.slice(-6).toUpperCase()}</Text>
              </View>

              <View style={s.card}>
                {(sel.items ?? []).map(it => (
                  <View key={it.id} style={s.itemRow}>
                    <Text style={{ fontSize: 20 }}>{it.product?.emoji ?? '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={1}>{it.product?.name ?? '—'}</Text>
                      <Text style={s.itemSub}>{it.qty} × {fmt(it.unitPrice ?? 0)}</Text>
                    </View>
                    <Text style={s.itemTotal}>{fmt(it.total ?? 0)}</Text>
                  </View>
                ))}
              </View>

              <View style={s.card}>
                {(sel.discountAmount ?? 0) > 0 && (
                  <View style={s.recapRow}>
                    <Text style={s.recapLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')}</Text>
                    <Text style={[s.recapVal, { color: C.accent2 }]}>− {fmt(sel.discountAmount ?? 0)}</Text>
                  </View>
                )}
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>{i('Paiement', 'Payment', 'Pago', 'Pagamento')}</Text>
                  <Text style={s.recapVal}>{PAY_ICON[sel.paymentMode] ?? '💳'} {sel.paymentMode}</Text>
                </View>
                <View style={[s.recapRow, s.recapTotal]}>
                  <Text style={s.recapTotalLabel}>Total</Text>
                  <Text style={s.recapTotalVal}>{fmt(sel.total ?? 0)}</Text>
                </View>
              </View>

              <Pressable style={s.waBtn} onPress={() => resendWhatsApp(sel)}
                accessibilityRole="button" accessibilityLabel={i('Renvoyer le ticket WhatsApp', 'Resend WhatsApp receipt', 'Reenviar recibo WhatsApp', 'Rinvia ricevuta WhatsApp')}>
                <Text style={s.waBtnTxt}>💬 {i('Ticket WhatsApp', 'WhatsApp receipt', 'Recibo WhatsApp', 'Ricevuta WhatsApp')}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text2, marginTop: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', maxWidth: 260 },

  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerBtn: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  subtitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 1 },

  periods: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  chipTxtOn: { color: C.white },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  statBox: { flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, paddingVertical: Spacing.md, alignItems: 'center', gap: 2, ...Shadow.sm },
  statVal: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, ...Shadow.sm },
  rowTotal: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.accent },
  rowSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },

  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  ref: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.text3 },
  card: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  itemName: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.text },
  itemSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },
  itemTotal: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.text },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: Spacing.sm, marginTop: 2 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.primary3 },
  waBtn: { backgroundColor: withAlpha(C.accent2, 0.12), borderWidth: 1, borderColor: withAlpha(C.accent2, 0.3), borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center' },
  waBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.accent2 },
})
