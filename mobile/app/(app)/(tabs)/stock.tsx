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
import { useProductPhoto } from '@/hooks/useProductPhoto'
import type { Product, ProductUpdate } from '@/types'
import { useI18n, useFmt, useTheme, plural } from '@/stores/appStore'
import { normalizeBarcode, isValidBarcode, barcodeMatches } from '@/lib/barcode'
import {
  ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha,
} from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'
import OfflineBanner from '@/components/ui/OfflineBanner'
import ScreenHeader from '@/components/ui/ScreenHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import AccessibleButton from '@/components/ui/AccessibleButton'
import BarcodeScanner from '@/components/pos/BarcodeScanner'
import ProductThumb from '@/components/ui/ProductThumb'

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
      <ProductThumb p={product} size={36} fontSize={28} />
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
  const [newBarcode, setNewBarcode] = useState('')
  const [scannerVisible, setScannerVisible] = useState(false)

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
      // Nom + SKU (imprimé/affiché) + catégorie + code-barres (règle canonique).
      return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || barcodeMatches(p.barcode, search)
    })
  }, [active, filter, search])

  // ── Mutation maj produit (stock + éventuellement code-barres) ──
  const updateMut = useMutation({
    mutationFn: (vars: { id: string; data: ProductUpdate }) =>
      productsApi.update(vars.id, vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })  // partagé avec la Caisse (POS)
      qc.invalidateQueries({ queryKey: ['dashboard'] }) // alertes stock du dashboard
      setEditP(null)
      Alert.alert(i('✅ Enregistré', '✅ Saved', '✅ Guardado', '✅ Salvato'), '')
    },
    onError: (e: unknown) => {
      // Le backend renvoie 400 (code-barres invalide) ou 409 (déjà utilisé — message nomme le produit).
      Alert.alert(
        i('Erreur', 'Error', 'Error', 'Errore'),
        apiErrorMessage(e) ?? i('Échec de la mise à jour', 'Update failed', 'Error al actualizar', 'Aggiornamento fallito'),
      )
    },
  })

  const openEdit = (p: Product) => { setEditP(p); setNewQty(p.stockQty ?? 0); setNewBarcode(p.barcode ?? '') }

  // ── Photo produit ─────────────────────────────────────────────────────────
  // ⚠️ Route SÉPARÉE d'`update` : la photo n'est PAS enregistrée par la mutation
  // de stock. Elle part dès le choix du fichier, et l'écran se met à jour seul.
  const photo = useProductPhoto()
  const majPhoto = async (source: 'camera' | 'gallery') => {
    if (!editP) return
    const r = await photo.envoyer(editP.id, source)
    // ⚠️ Les QUATRE issues sont distinguées. Une annulation ne dit RIEN : c'est une
    // décision de l'utilisateur, pas une panne — l'alerter serait du bruit.
    if (r.etat === 'annule') return
    if (r.etat === 'permission') {
      Alert.alert(
        i('Autorisation refusée', 'Permission denied', 'Permiso denegado', 'Autorizzazione negata'),
        r.source === 'camera'
          ? i("Autorisez l'appareil photo dans les réglages du téléphone.", 'Allow camera access in your phone settings.', 'Permita la cámara en los ajustes del teléfono.', 'Consenta la fotocamera nelle impostazioni del telefono.')
          : i('Autorisez l\'accès aux photos dans les réglages du téléphone.', 'Allow photo access in your phone settings.', 'Permita el acceso a las fotos en los ajustes.', "Consenta l'accesso alle foto nelle impostazioni."),
      )
      return
    }
    if (r.etat === 'echec') {
      Alert.alert(i('Erreur', 'Error', 'Error', 'Errore'), r.message)
      return
    }
    setEditP({ ...editP, image: r.url })
    qc.invalidateQueries({ queryKey: ['products'] })
  }
  const retirerPhoto = async () => {
    if (!editP) return
    const r = await photo.retirer(editP.id)
    if (r.etat === 'echec') { Alert.alert(i('Erreur', 'Error', 'Error', 'Errore'), r.message); return }
    setEditP({ ...editP, image: null })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  // Code-barres : canonicalisation partagée (UPC-A→EAN-13) + validation EAN-13/EAN-8.
  const canonicalBarcode = normalizeBarcode(newBarcode)
  const barcodeInvalid = !!canonicalBarcode && !isValidBarcode(canonicalBarcode)
  const qtyChanged = editP ? newQty !== (editP.stockQty ?? 0) : false
  const barcodeChanged = editP ? canonicalBarcode !== (editP.barcode ?? '') : false
  const saveEdit = () => {
    if (!editP) return
    const data: ProductUpdate = {
      ...(qtyChanged ? { stockQty: newQty } : {}),
      ...(barcodeChanged ? { barcode: canonicalBarcode } : {}),
    }
    updateMut.mutate({ id: editP.id, data })
  }

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
        subtitle={`${active.length} ${plural(active.length, i('produit actif', 'active product', 'producto activo', 'prodotto attivo'), i('produits actifs', 'active products', 'productos activos', 'prodotti attivi'))}`}
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
                <ProductThumb p={editP} size={56} fontSize={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.prodName}>{editP.name?.trim()}</Text>
                  <Text style={s.prodCat}>{editP.category ?? '—'}</Text>
                </View>
              </View>

              {/* ── PHOTO ── La vignette ci-dessus SERT d'aperçu : pas de second rendu.
                   ⚠️ Deux boutons EN LIGNE plutôt qu'une feuille de choix : une seconde
                   <Modal> par-dessus celle-ci ferait crasher Fabric en release sur
                   Android d'entrée de gamme (`addViewAt`, cf. mobile/CLAUDE.md §8). */}
              <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => void majPhoto('camera')}
                  disabled={photo.busy}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
                           borderRadius: 10, borderWidth: 1, borderColor: C.border, opacity: photo.busy ? 0.5 : 1 }}>
                  <Ionicons name="camera-outline" size={16} color={C.text} />
                  <Text style={{ color: C.text, fontSize: 13 }}>
                    {editP.image ? i('Reprendre', 'Retake', 'Repetir', 'Riprendi') : i('Photo', 'Photo', 'Foto', 'Foto')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void majPhoto('gallery')}
                  disabled={photo.busy}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
                           borderRadius: 10, borderWidth: 1, borderColor: C.border, opacity: photo.busy ? 0.5 : 1 }}>
                  <Ionicons name="images-outline" size={16} color={C.text} />
                  <Text style={{ color: C.text, fontSize: 13 }}>{i('Galerie', 'Gallery', 'Galería', 'Galleria')}</Text>
                </Pressable>

                {!!editP.image && (
                  <Pressable
                    onPress={() => void retirerPhoto()}
                    disabled={photo.busy}
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
                             borderRadius: 10, borderWidth: 1, borderColor: C.border, opacity: photo.busy ? 0.5 : 1 }}>
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                    <Text style={{ color: C.danger, fontSize: 13 }}>{i('Retirer', 'Remove', 'Quitar', 'Rimuovi')}</Text>
                  </Pressable>
                )}
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

              {/* Code-barres — compléter un code manquant, produit en main (scan = principal) */}
              <View>
                <Text style={s.editStatLabel}>{i('Code-barres', 'Barcode', 'Código de barras', 'Codice a barre')}</Text>
                <View style={s.barcodeRow}>
                  <TextInput
                    style={[s.barcodeInput, barcodeInvalid && { borderColor: C.danger }]}
                    value={newBarcode}
                    onChangeText={setNewBarcode}
                    placeholder={i('EAN-13 / EAN-8 / UPC-A…', 'EAN-13 / EAN-8 / UPC-A…', 'EAN-13 / EAN-8 / UPC-A…', 'EAN-13 / EAN-8 / UPC-A…')}
                    placeholderTextColor={C.text3}
                    keyboardType="numeric"
                    autoCapitalize="none"
                    accessibilityLabel={i('Code-barres', 'Barcode', 'Código de barras', 'Codice a barre')}
                  />
                  <Pressable style={s.scanBtn} onPress={() => setScannerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={i('Scanner le code-barres', 'Scan barcode', 'Escanear código de barras', 'Scansiona codice a barre')}>
                    <Ionicons name="barcode-outline" size={20} color="#fff" />
                    <Text style={s.scanBtnTxt}>{i('Scanner', 'Scan', 'Escanear', 'Scansiona')}</Text>
                  </Pressable>
                </View>
                {barcodeInvalid ? (
                  <Text style={[s.barcodeHint, { color: C.danger }]}>
                    {i('Code-barres invalide (EAN-13, EAN-8 ou UPC-A attendu)', 'Invalid barcode (EAN-13, EAN-8 or UPC-A expected)', 'Código inválido (se espera EAN-13, EAN-8 o UPC-A)', 'Codice non valido (atteso EAN-13, EAN-8 o UPC-A)')}
                  </Text>
                ) : !editP.barcode ? (
                  <Text style={s.barcodeHint}>
                    {i("Scannez l'emballage pour compléter le code manquant", 'Scan the packaging to complete the missing code', 'Escanee el envase para completar el código faltante', 'Scansiona la confezione per completare il codice mancante')}
                  </Text>
                ) : null}
              </View>

              {/* Enregistrer */}
              <AccessibleButton
                label={i('Enregistrer', 'Save', 'Guardar', 'Salva')}
                hint={i('Enregistrer les modifications', 'Save changes', 'Guardar cambios', 'Salva modifiche')}
                onPress={saveEdit}
                loading={updateMut.isPending}
                disabled={(!qtyChanged && !barcodeChanged) || barcodeInvalid}
              />
            </View>
          )}
        </View>
      </Modal>
      )}

      {/* ── Scanner code-barres (compléter un code produit) ── */}
      <BarcodeScanner
        visible={scannerVisible}
        mode="product"
        onScan={(code) => { setNewBarcode(code); setScannerVisible(false) }}
        onClose={() => setScannerVisible(false)}
      />
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

  // Code-barres
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  barcodeInput: {
    flex: 1, height: 48, backgroundColor: C.bg3, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md,
    fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.text,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 48,
    paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, backgroundColor: C.primary,
  },
  scanBtnTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_700Bold', color: '#fff' },
  barcodeHint: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text3, marginTop: 6 },
})
