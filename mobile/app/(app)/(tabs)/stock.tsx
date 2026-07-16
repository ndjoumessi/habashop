import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, Pressable, RefreshControl,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsApi, apiErrorMessage } from '@/services/api'
import type { Product } from '@/types'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import {
  ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha,
} from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'
import OfflineBanner from '@/components/ui/OfflineBanner'
import ScreenHeader from '@/components/ui/ScreenHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import AccessibleButton from '@/components/ui/AccessibleButton'

type Filter = 'all' | 'low' | 'out'

// Statut de stock d'un produit
function statusOf(p: Product): 'ok' | 'low' | 'out' {
  const q = p.stockQty ?? 0
  if (q <= 0) return 'out'
  if (q <= (p.stockMin ?? 0)) return 'low'
  return 'ok'
}

// ── Ligne produit ────────────────────────────────
function ProductRow({
  product, fmt, statusLabel, onPress, C,
}: {
  product: Product
  fmt: (n: number) => string
  statusLabel: (s: 'ok' | 'low' | 'out') => string
  onPress: () => void
  C: ThemeColors
}) {
  const s = useMemo(() => makeStyles(C), [C])
  const STATUS_COLOR = { ok: C.accent2, low: C.warn, out: C.danger }
  const st = statusOf(product)
  const color = STATUS_COLOR[st]
  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name?.trim() ?? ''}, ${product.stockQty ?? 0}, ${statusLabel(st)}`}>
      <Text style={{ fontSize: 28 }}>{product.emoji ?? '📦'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>{product.name?.trim()}</Text>
        <Text style={s.rowCat} numberOfLines={1}>{product.category ?? '—'} · {fmt(product.sellPrice ?? 0)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={[s.rowQty, { color }]}>{product.stockQty ?? 0}</Text>
        <View style={[s.statusBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
          <Text style={[s.statusTxt, { color }]}>{statusLabel(st)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Écran Stock ──────────────────────────────────
export default function StockScreen() {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const { i } = useI18n()
  const { fmt } = useFmt()
  const qc = useQueryClient()

  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<Filter>('all')
  const [editP, setEditP]     = useState<any | null>(null)
  const [newQty, setNewQty]   = useState(0)

  const STATUS_COLOR = { ok: C.accent2, low: C.warn, out: C.danger }

  const statusLabel = (st: 'ok' | 'low' | 'out') =>
    st === 'out' ? i('Rupture', 'Out of stock', 'Agotado', 'Esaurito')
    : st === 'low' ? i('Stock bas', 'Low stock', 'Stock bajo', 'Scorte basse')
    : i('En stock', 'In stock', 'En stock', 'In stock')

  const { data: products = [], isLoading, isError, refetch, isRefetching } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const active  = useMemo(() => (products ?? []).filter((p) => p.isActive !== false), [products])
  const outCnt  = useMemo(() => active.filter((p) => statusOf(p) === 'out').length, [active])
  const lowCnt  = useMemo(() => active.filter((p) => statusOf(p) === 'low').length, [active])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return active.filter((p) => {
      const st = statusOf(p)
      if (filter === 'low' && st !== 'low') return false
      if (filter === 'out' && st !== 'out') return false
      return !q || p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.barcode?.includes(q)
    })
  }, [active, filter, search])

  // ── Mutation maj stock ──
  const updateMut = useMutation({
    mutationFn: (vars: { id: string; stockQty: number }) =>
      productsApi.update(vars.id, { stockQty: vars.stockQty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })  // partagé avec la Caisse (POS)
      qc.invalidateQueries({ queryKey: ['dashboard'] }) // alertes stock du dashboard
      setEditP(null)
      Alert.alert(i('✅ Stock mis à jour', '✅ Stock updated', '✅ Stock actualizado', '✅ Stock aggiornato'), '')
    },
    onError: (e: unknown) => {
      Alert.alert(
        i('Erreur', 'Error', 'Error', 'Errore'),
        apiErrorMessage(e) ?? i('Échec de la mise à jour', 'Update failed', 'Error al actualizar', 'Aggiornamento fallito'),
      )
    },
  })

  const openEdit = (p: Product) => { setEditP(p); setNewQty(p.stockQty ?? 0) }

  const StatBox = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={s.statBox}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <ScreenHeader
        icon="cube"
        title="Stock"
        subtitle={`${active.length} ${i('produits actifs', 'active products', 'productos activos', 'prodotti attivi')}`}
        right={
          <Pressable style={s.headerBtn} onPress={() => refetch()} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Actualiser', 'Refresh', 'Actualizar', 'Aggiorna')}>
            <Ionicons name="refresh" size={20} color={C.text2} />
          </Pressable>
        }
      />

      {/* Bandeau hors-ligne — le stock affiché vient du cache (peut être périmé). */}
      <OfflineBanner context="cache" />

      {/* ── Stats ── */}
      <View style={s.statsRow}>
        <StatBox label={i('Actifs', 'Active', 'Activos', 'Attivi')} value={active.length} color={C.text} />
        <StatBox label={i('Stock bas', 'Low', 'Bajo', 'Basse')} value={lowCnt} color={C.warn} />
        <StatBox label={i('Rupture', 'Out', 'Agotado', 'Esaurito')} value={outCnt} color={C.danger} />
      </View>

      {/* ── Alertes rapides ── */}
      {(outCnt > 0 || lowCnt > 0) && (
        <View style={s.alertChips}>
          {outCnt > 0 && (
            <Pressable
              style={[s.alertChip, { backgroundColor: withAlpha(C.danger, 0.1), borderColor: withAlpha(C.danger, 0.25) }]}
              onPress={() => setFilter(filter === 'out' ? 'all' : 'out')}
              accessibilityRole="button"
              accessibilityLabel={`${outCnt} ${i('en rupture', 'out of stock', 'agotados', 'esauriti')}`}
            >
              <Text style={[s.alertChipTxt, { color: C.danger }]}>
                🔴 {outCnt} {i('rupture', 'out of stock', 'agotado', 'esaurito')}{outCnt > 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
          {lowCnt > 0 && (
            <Pressable
              style={[s.alertChip, { backgroundColor: withAlpha(C.warn, 0.1), borderColor: withAlpha(C.warn, 0.25) }]}
              onPress={() => setFilter(filter === 'low' ? 'all' : 'low')}
              accessibilityRole="button"
              accessibilityLabel={`${lowCnt} ${i('en stock bas', 'low stock', 'stock bajo', 'scorte basse')}`}
            >
              <Text style={[s.alertChipTxt, { color: C.warn }]}>
                🟠 {lowCnt} {i('stock bas', 'low stock', 'stock bajo', 'scorte basse')}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Recherche ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={C.text3} />
        <TextInput
          style={s.searchInput}
          placeholder={i('Rechercher…', 'Search…', 'Buscar…', 'Cerca…')}
          placeholderTextColor={C.text3}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel={i('Rechercher un produit', 'Search a product', 'Buscar un producto', 'Cerca un prodotto')}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Effacer la recherche', 'Clear search', 'Borrar búsqueda', 'Cancella ricerca')}>
            <Ionicons name="close-circle" size={18} color={C.text3} />
          </Pressable>
        )}
      </View>

      {/* ── Filtres ── */}
      <View style={s.tabsWrap}>
        <SegmentedControl
          value={filter}
          onChange={(k) => setFilter(k as Filter)}
          segments={[
            { key: 'all', label: i('Tous', 'All', 'Todos', 'Tutti'), count: active.length },
            { key: 'low', label: i('Stock bas', 'Low', 'Bajo', 'Basse'), count: lowCnt },
            { key: 'out', label: i('Rupture', 'Out', 'Agotado', 'Esaurito'), count: outCnt },
          ]}
        />
      </View>

      {/* ── Liste ── */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FlatList
          removeClippedSubviews={false}
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, paddingBottom: insets.bottom + Spacing.xxxl }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} colors={[C.primary]} />
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 48 }}>📦</Text>
              <Text style={s.emptyTitle}>{i('Aucun produit', 'No products', 'Sin productos', 'Nessun prodotto')}</Text>
              <Text style={s.emptyTxt}>{i('Ajoutez vos produits depuis le web ou ajustez vos filtres.', 'Add products from the web or adjust your filters.', 'Agregue productos desde la web o ajuste sus filtros.', 'Aggiungi prodotti dal web o modifica i filtri.')}</Text>
            </View>
          }
          renderItem={({ item }: { item: Product }) => (
            <ProductRow product={item} fmt={fmt} statusLabel={statusLabel} onPress={() => openEdit(item)} C={C} />
          )}
        />
      )}

      {/* ── Modal édition ── */}
      {!!editP && (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditP(null)}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{i('Modifier le stock', 'Edit stock', 'Editar stock', 'Modifica stock')}</Text>
            <Pressable onPress={() => setEditP(null)} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>

          {editP && (
            <View style={{ padding: Spacing.lg, gap: Spacing.lg }}>
              {/* Produit */}
              <View style={s.prodHead}>
                <Text style={{ fontSize: 44 }}>{editP.emoji ?? '📦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.prodName}>{editP.name?.trim()}</Text>
                  <Text style={s.prodCat}>{editP.category ?? '—'}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={s.editStats}>
                <View style={s.editStat}>
                  <Text style={s.editStatLabel}>{i('Stock actuel', 'Current', 'Actual', 'Attuale')}</Text>
                  <Text style={[s.editStatVal, { color: STATUS_COLOR[statusOf(editP)] }]}>{editP.stockQty ?? 0}</Text>
                </View>
                <View style={s.editStat}>
                  <Text style={s.editStatLabel}>{i('Stock mini', 'Min', 'Mínimo', 'Minimo')}</Text>
                  <Text style={s.editStatVal}>{editP.stockMin ?? 0}</Text>
                </View>
                <View style={s.editStat}>
                  <Text style={s.editStatLabel}>{i('Prix vente', 'Price', 'Precio', 'Prezzo')}</Text>
                  <Text style={[s.editStatVal, { fontSize: FontSize.md, color: C.accent }]}>{fmt(editP.sellPrice ?? 0)}</Text>
                </View>
              </View>

              {/* Nouvelle quantité */}
              <View>
                <Text style={s.editStatLabel}>{i('Nouvelle quantité', 'New quantity', 'Nueva cantidad', 'Nuova quantità')}</Text>
                <View style={s.qtyEditor}>
                  <Pressable style={s.qtyEditBtn} onPress={() => setNewQty(q => Math.max(0, q - 1))}
                    accessibilityRole="button"
                    accessibilityLabel={i('Diminuer la quantité', 'Decrease quantity', 'Disminuir cantidad', 'Diminuisci quantità')}>
                    <Ionicons name="remove" size={22} color={C.text} />
                  </Pressable>
                  <TextInput
                    style={s.qtyEditInput}
                    keyboardType="numeric"
                    value={String(newQty)}
                    onChangeText={t => setNewQty(Number(t.replace(/[^0-9]/g, '')) || 0)}
                    accessibilityLabel={i('Nouvelle quantité', 'New quantity', 'Nueva cantidad', 'Nuova quantità')}
                  />
                  <Pressable style={s.qtyEditBtn} onPress={() => setNewQty(q => q + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={i('Augmenter la quantité', 'Increase quantity', 'Aumentar cantidad', 'Aumenta quantità')}>
                    <Ionicons name="add" size={22} color={C.text} />
                  </Pressable>
                </View>
              </View>

              {/* Enregistrer */}
              <AccessibleButton
                label={i('Enregistrer', 'Save', 'Guardar', 'Salva')}
                hint={i('Enregistrer le stock', 'Save stock', 'Guardar stock', 'Salva stock')}
                onPress={() => updateMut.mutate({ id: editP.id, stockQty: newQty })}
                loading={updateMut.isPending}
                disabled={newQty === (editP.stockQty ?? 0)}
              />
            </View>
          )}
        </View>
      </Modal>
      )}
    </View>
  )
}

// ── Styles ───────────────────────────────────────
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text2, marginTop: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3, textAlign: 'center', maxWidth: 260 },

  headerBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  statBox: {
    flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1,
    borderColor: C.border, paddingVertical: Spacing.md, alignItems: 'center', gap: 2, ...Shadow.sm,
  },
  statVal: { fontSize: FontSize.xxl, fontFamily: 'JetBrainsMono_700Bold' },
  statLabel: { fontSize: FontSize.xs, fontFamily: 'Geist_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4 },

  alertChips: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
  alertChip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full, borderWidth: 1 },
  alertChipTxt: { fontSize: FontSize.xs, fontFamily: 'Geist_700Bold' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.xl, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, height: 44,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'Geist_400Regular', color: C.text },

  tabsWrap: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border,
    padding: Spacing.md, ...Shadow.sm,
  },
  rowName: { fontSize: FontSize.sm, fontFamily: 'Geist_700Bold', color: C.text },
  rowCat: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text3, marginTop: 2 },
  rowQty: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1 },
  statusTxt: { fontSize: FontSize.xs, fontFamily: 'Geist_700Bold' },

  // Sheet édition
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sheetTitle: { fontSize: FontSize.xl, fontFamily: 'Geist_800ExtraBold', color: C.text },
  prodHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  prodName: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text },
  prodCat: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3, marginTop: 2 },

  editStats: { flexDirection: 'row', gap: Spacing.sm },
  editStat: {
    flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
    padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  editStatLabel: { fontSize: FontSize.xs, fontFamily: 'Geist_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4 },
  editStatVal: { fontSize: FontSize.xl, fontFamily: 'JetBrainsMono_700Bold', color: C.text },

  qtyEditor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  qtyEditBtn: {
    width: 52, height: 52, borderRadius: BorderRadius.md, backgroundColor: C.bg4,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyEditInput: {
    flex: 1, height: 52, backgroundColor: C.bg3, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.border, textAlign: 'center',
    fontSize: FontSize.xxl, fontFamily: 'JetBrainsMono_700Bold', color: C.text,
  },
})
