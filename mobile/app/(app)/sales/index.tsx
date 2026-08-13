import { useMemo, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { salesApi, apiErrorMessage, apiErrorStatus } from '@/services/api'
import type { SaleRecord } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, useFmt, useTheme, plural } from '@/stores/appStore'
import { sendWhatsAppTicket, type TicketOptions } from '@/services/whatsappTicket'
import { printReceipt } from '@/services/printReceipt'
import { canRefundRole, isRefunded } from '@/lib/refund'
import ErrorState from '@/components/ui/ErrorState'
import ScreenHeader from '@/components/ui/ScreenHeader'
import Chip from '@/components/ui/Chip'
import RefundSheet from '@/components/pos/RefundSheet'
import InvoiceButton from '@/components/sales/InvoiceButton'
import { Spacing, BorderRadius, FontSize, Shadow, withAlpha, ThemeColors } from '@/constants/theme'
import ProductThumb from '@/components/ui/ProductThumb'

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
  const { tenant, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<Period>('7d')
  const [sel, setSel] = useState<SaleRecord | null>(null)
  const [refundTarget, setRefundTarget] = useState<SaleRecord | null>(null)

  // Remboursement réservé manager/admin → action MASQUÉE pour les autres (caissier…).
  const mayRefund = canRefundRole(user?.role)

  const { data: sales = [], isLoading, isError, refetch, isRefetching } = useQuery<SaleRecord[]>({
    queryKey: ['sales', 'history'],
    queryFn: () => salesApi.list({ limit: 500 }),
    staleTime: 2 * 60 * 1000,
  })

  const refundMutation = useMutation({
    mutationFn: ({ id, reason, restock }: { id: string; reason: string; restock: boolean }) =>
      salesApi.refund(id, { reason, restock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      // Dashboard/Rapports dépendent aussi des ventes (CA exclut les remboursées).
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setRefundTarget(null)
      setSel(null)
      Alert.alert(i('Vente remboursée', 'Sale refunded', 'Venta reembolsada', 'Vendita rimborsata'), '')
    },
    onError: (err) => {
      const status = apiErrorStatus(err)
      if (status === 409) {
        // Déjà remboursée (idempotence) → on rafraîchit et on ferme.
        queryClient.invalidateQueries({ queryKey: ['sales'] })
        setRefundTarget(null)
        setSel(null)
        Alert.alert(i('Déjà remboursée', 'Already refunded', 'Ya reembolsada', 'Già rimborsata'),
          i('Cette vente a déjà été remboursée.', 'This sale has already been refunded.', 'Esta venta ya ha sido reembolsada.', 'Questa vendita è già stata rimborsata.'))
        return
      }
      if (status === 403) {
        // Garde-fou défensif (l'UI masque déjà l'action aux non-managers).
        Alert.alert(i('Action non autorisée', 'Not allowed', 'Acción no permitida', 'Azione non consentita'),
          i('Seuls un manager ou un administrateur peuvent rembourser une vente.', 'Only a manager or an administrator can refund a sale.', 'Solo un gerente o un administrador puede reembolsar una venta.', 'Solo un manager o un amministratore può rimborsare una vendita.'))
        return
      }
      Alert.alert(i('Échec du remboursement', 'Refund failed', 'Error de reembolso', 'Rimborso fallito'),
        apiErrorMessage(err) ?? '')
    },
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

  // Construit les données de reçu (partagées par WhatsApp et l'impression PDF).
  const saleTicket = (sale: SaleRecord): TicketOptions => ({
    items: (sale.items ?? []).map(it => ({
      productId: it.productId,
      name: it.product?.name ?? '—',
      price: it.unitPrice ?? 0,
      quantity: it.qty ?? 0,
      emoji: it.product?.emoji ?? '📦',
      image: it.product?.image ?? null,
      stockQty: 0,
    })),
    total: sale.total ?? 0, paymentMode: sale.paymentMode,
    saleId: sale.id, shopName: tenant?.name ?? 'HabaShop', currency, lang, fmt, vatRate: tenant?.vatRate,
    // Reçu mixte : ventilation lue depuis la vente (champs backend).
    ...(sale.paymentMode === 'mixed' ? {
      split: {
        cashAmount: sale.cashAmount ?? 0,
        mobileMoneyAmount: sale.mobileMoneyAmount ?? 0,
        cardAmount: sale.cardAmount ?? 0,
      },
    } : {}),
  })

  const resendWhatsApp = async (sale: SaleRecord) => {
    const ok = await sendWhatsAppTicket(saleTicket(sale))
    if (!ok) {
      Alert.alert(i('WhatsApp indisponible', 'WhatsApp unavailable', 'WhatsApp no disponible', 'WhatsApp non disponibile'), '')
    }
  }

  const printSale = (sale: SaleRecord) => { printReceipt(saleTicket(sale)) }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader
        title={i('Historique', 'History', 'Historial', 'Storico')}
        subtitle={`${tx} ${plural(tx, i('vente', 'sale', 'venta', 'vendita'), i('ventes', 'sales', 'ventas', 'vendite'))}`}
        onBack={() => router.back()}
      />

      {/* Sélecteur période */}
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

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statBox}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.statVal, { color: C.accent }]}>{fmt(ca)}</Text><Text style={s.statLabel}>{i('CA total', 'Revenue', 'CA total', 'Ricavi')}</Text></View>
        <View style={s.statBox}><Text style={[s.statVal, { color: C.primary3 }]}>{String(tx)}</Text><Text style={s.statLabel}>{i('Ventes', 'Sales', 'Ventas', 'Vendite')}</Text></View>
        <View style={s.statBox}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.statVal, { color: C.accent3 }]}>{fmt(avg)}</Text><Text style={s.statLabel}>{i('Panier moyen', 'Avg basket', 'Cesta media', 'Carrello medio')}</Text></View>
      </View>

      {/* Liste */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FlatList
          removeClippedSubviews={false}
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
          renderItem={({ item }) => {
            const refunded = isRefunded(item)
            return (
            <Pressable style={s.row} onPress={() => setSel(item)}
              accessibilityRole="button"
              accessibilityLabel={`${fmt(item.total ?? 0)}, ${fmtDateTime(item.createdAt)}${refunded ? `, ${i('remboursée', 'refunded', 'reembolsada', 'rimborsata')}` : ''}`}>
              <Text style={{ fontSize: 26 }}>{PAY_ICON[item.paymentMode] ?? '💳'}</Text>
              <View style={{ flex: 1 }}>
                <View style={s.rowTotalLine}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.rowTotal, refunded && s.totalRefunded]}>{fmt(item.total ?? 0)}</Text>
                  {refunded && (
                    <View style={s.badge}>
                      <Text style={s.badgeTxt}>{i('Remboursé', 'Refunded', 'Reembolsado', 'Rimborsato')}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.rowSub} numberOfLines={1}>
                  {fmtDateTime(item.createdAt)} · {item.items?.length ?? 0} {plural(item.items?.length ?? 0, i('article', 'item', 'artículo', 'articolo'), i('articles', 'items', 'artículos', 'articoli'))}
                </Text>
              </View>
              {/* Action inline (parité web : bouton « Rembourser » directement dans la
                  ligne, visible manager/admin sur vente non remboursée). */}
              {mayRefund && !refunded && (
                <Pressable style={s.rowRefundBtn} onPress={() => setRefundTarget(item)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={i('Rembourser la vente', 'Refund sale', 'Reembolsar venta', 'Rimborsa vendita')}>
                  <Ionicons name="refresh" size={14} color={C.danger} />
                  <Text style={s.rowRefundTxt}>{i('Rembourser', 'Refund', 'Reembolsar', 'Rimborsa')}</Text>
                </Pressable>
              )}
              <Ionicons name="chevron-forward" size={16} color={C.text3} />
            </Pressable>
            )
          }}
        />
      )}

      {/* Modal détail */}
      {!!sel && (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSel(null)}>
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
                    <ProductThumb p={it.product ?? {}} size={26} fontSize={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={1}>{it.product?.name ?? '—'}</Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.itemSub}>{it.qty} × {fmt(it.unitPrice ?? 0)}</Text>
                    </View>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.itemTotal}>{fmt(it.total ?? 0)}</Text>
                  </View>
                ))}
              </View>

              <View style={s.card}>
                {(sel.discountAmount ?? 0) > 0 && (
                  <View style={s.recapRow}>
                    <Text style={s.recapLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.recapVal, { color: C.accent2 }]}>− {fmt(sel.discountAmount ?? 0)}</Text>
                  </View>
                )}
                {(sel.loyaltyDiscount ?? 0) > 0 && (
                  <View style={s.recapRow}>
                    <Text style={s.recapLabel}>⭐ {i('Remise fidélité', 'Loyalty discount', 'Desc. fidelidad', 'Sconto fedeltà')}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.recapVal, { color: C.accent2 }]}>− {fmt(sel.loyaltyDiscount ?? 0)}</Text>
                  </View>
                )}
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>{i('Paiement', 'Payment', 'Pago', 'Pagamento')}</Text>
                  <Text style={s.recapVal}>{PAY_ICON[sel.paymentMode] ?? '💳'} {sel.paymentMode}</Text>
                </View>
                <View style={[s.recapRow, s.recapTotal]}>
                  <Text style={s.recapTotalLabel}>Total</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.recapTotalVal, isRefunded(sel) && s.totalRefunded]}>{fmt(sel.total ?? 0)}</Text>
                </View>
              </View>

              {/* Bandeau « remboursée » OU action « Rembourser » (manager/admin, vente active) */}
              {isRefunded(sel) ? (
                <View style={s.refundedBanner}>
                  <Ionicons name="refresh-circle" size={18} color={C.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.refundedTitle}>{i('Vente remboursée', 'Sale refunded', 'Venta reembolsada', 'Vendita rimborsata')}</Text>
                    {!!sel.refundReason && <Text style={s.refundedReason}>{i('Motif', 'Reason', 'Motivo', 'Motivo')} : {sel.refundReason}</Text>}
                    <Text style={s.refundedReason}>
                      {sel.restocked
                        ? i('Articles remis en stock', 'Items returned to stock', 'Artículos devueltos al stock', 'Articoli rimessi in stock')
                        : i('Articles non remis en stock', 'Items not returned to stock', 'Artículos no devueltos al stock', 'Articoli non rimessi in stock')}
                    </Text>
                  </View>
                </View>
              ) : mayRefund ? (
                <Pressable style={s.refundBtn} onPress={() => setRefundTarget(sel)}
                  accessibilityRole="button" accessibilityLabel={i('Rembourser la vente', 'Refund sale', 'Reembolsar venta', 'Rimborsa vendita')}>
                  <Text style={s.refundBtnTxt}>↩️ {i('Rembourser la vente', 'Refund sale', 'Reembolsar venta', 'Rimborsa vendita')}</Text>
                </Pressable>
              ) : null}

              {/* Facture PDF — tous rôles ; télécharge + partage système */}
              <InvoiceButton saleId={sel.id} />

              <Pressable style={s.waBtn} onPress={() => resendWhatsApp(sel)}
                accessibilityRole="button" accessibilityLabel={i('Renvoyer le ticket WhatsApp', 'Resend WhatsApp receipt', 'Reenviar recibo WhatsApp', 'Rinvia ricevuta WhatsApp')}>
                <Text style={s.waBtnTxt}>💬 {i('Ticket WhatsApp', 'WhatsApp receipt', 'Recibo WhatsApp', 'Ricevuta WhatsApp')}</Text>
              </Pressable>
              <Pressable style={s.printBtn} onPress={() => printSale(sel)}
                accessibilityRole="button" accessibilityLabel={i('Imprimer le reçu', 'Print receipt', 'Imprimir recibo', 'Stampa ricevuta')}>
                <Text style={s.printBtnTxt}>🖨️ {i('Imprimer le reçu', 'Print receipt', 'Imprimir recibo', 'Stampa ricevuta')}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </Modal>
      )}

      {/* Feuille de remboursement — montée À LA DEMANDE (anti-crash Fabric) */}
      {!!refundTarget && (
        <RefundSheet
          sale={refundTarget}
          saving={refundMutation.isPending}
          onClose={() => { if (!refundMutation.isPending) setRefundTarget(null) }}
          onConfirm={(reason, restock) => refundMutation.mutate({ id: refundTarget.id, reason, restock })}
        />
      )}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text2, marginTop: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3, textAlign: 'center', maxWidth: 260 },


  periods: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  statBox: { flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, paddingVertical: Spacing.md, alignItems: 'center', gap: 2, ...Shadow.sm },
  statVal: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold' },
  statLabel: { fontSize: FontSize.xs, fontFamily: 'Geist_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, ...Shadow.sm },
  rowTotalLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowTotal: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.accent },
  rowSub: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text3, marginTop: 2 },
  totalRefunded: { textDecorationLine: 'line-through', color: C.text3 },
  rowRefundBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: withAlpha(C.danger, 0.1), borderWidth: 1, borderColor: withAlpha(C.danger, 0.25) },
  rowRefundTxt: { fontSize: FontSize.xs, fontFamily: 'Geist_800ExtraBold', color: C.danger },
  badge: { backgroundColor: withAlpha(C.danger, 0.12), borderWidth: 1, borderColor: withAlpha(C.danger, 0.3), borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeTxt: { fontSize: FontSize.xs, fontFamily: 'Geist_700Bold', color: C.danger },

  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { fontSize: FontSize.xl, fontFamily: 'Geist_800ExtraBold', color: C.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLabel: { fontSize: FontSize.sm, fontFamily: 'Geist_600SemiBold', color: C.text2 },
  ref: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.text3 },
  card: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  itemName: { fontSize: FontSize.sm, fontFamily: 'Geist_700Bold', color: C.text },
  itemSub: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text3, marginTop: 2 },
  itemTotal: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.text },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Geist_600SemiBold', color: C.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: Spacing.sm, marginTop: 2 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.primary3 },
  refundBtn: { backgroundColor: withAlpha(C.danger, 0.1), borderWidth: 1, borderColor: withAlpha(C.danger, 0.25), borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center' },
  refundBtnTxt: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.danger },
  refundedBanner: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: withAlpha(C.danger, 0.1), borderWidth: 1, borderColor: withAlpha(C.danger, 0.25), borderRadius: BorderRadius.md, padding: Spacing.md },
  refundedTitle: { fontSize: FontSize.sm, fontFamily: 'Geist_800ExtraBold', color: C.danger },
  refundedReason: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text2, marginTop: 2, lineHeight: 16 },
  waBtn: { backgroundColor: withAlpha(C.accent2, 0.12), borderWidth: 1, borderColor: withAlpha(C.accent2, 0.3), borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center' },
  waBtnTxt: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.accent2 },
  printBtn: { backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3), borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  printBtnTxt: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.primary },
})
