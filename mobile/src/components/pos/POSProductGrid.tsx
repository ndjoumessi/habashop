import { memo, useCallback, useMemo, useRef } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { completerRangee, estCaseVide, type CaseVide } from '@/lib/grille'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { CartItem } from '@/stores/posStore'
import type { Product } from '@/types'
import { useTheme, type AmountParts } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'
import ProductThumb from '../../components/ui/ProductThumb'

// ── Carte produit ────────────────────────────────
// memo : un tap d'ajout au panier modifie `cart` → sans memo, TOUTES les cartes
// visibles re-rendent à chaque tap. Props stables (product/qty/fmt/onAdd) → seul
// le produit dont la quantité change re-rend. (useTheme re-rend de toute façon
// chaque carte au changement de thème — abonnement store interne.)
const ProductCard = memo(function ProductCard({
  product, qtyInCart, fmt, fmtParts, onAdd,
}: {
  product: Product; qtyInCart: number
  fmt: (n: number) => string
  fmtParts: (n: number) => AmountParts
  onAdd: (product: Product) => void
}) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const stock = product.stockQty ?? 0
  const out = stock <= 0
  // Stock bas (maquette 01) : bordure + point d'alerte quand stock ≤ seuil (mais > 0).
  const low = !out && (product.stockMin ?? 0) > 0 && stock <= (product.stockMin ?? 0)
  // Prix bi-ton : montant en or + devise atténuée (séparés), fidèle à la maquette.
  const price = fmtParts(product.sellPrice ?? 0)
  return (
    <TouchableOpacity
      style={[s.prodCard, low && s.prodCardLow, out && s.prodCardOut]}
      activeOpacity={0.7}
      disabled={out}
      onPress={() => onAdd(product)}
      accessibilityRole="button"
      accessibilityState={{ disabled: out }}
      accessibilityLabel={`${product.name?.trim() ?? ''}, ${fmt(product.sellPrice ?? 0)}`}
    >
      {qtyInCart > 0 && (
        <View style={s.prodBadge}>
          <Text style={s.prodBadgeTxt}>{qtyInCart}</Text>
        </View>
      )}
      {out && (
        <View style={s.prodOutBadge}>
          <Ionicons name="close" size={11} color={C.white} />
        </View>
      )}
      {low && <View style={s.prodLowDot} />}
      <ProductThumb p={product} size={40} fontSize={30} />
      <Text style={s.prodName} numberOfLines={2}>{product.name?.trim()}</Text>
      <Text style={s.prodPrice}>
        {price.prefix}{price.amount}
        {price.suffix ? <Text style={s.prodPriceCur}> {price.suffix}</Text> : null}
      </Text>
    </TouchableOpacity>
  )
})

interface POSProductGridProps {
  filtered:  Product[]
  cart:      CartItem[]
  onAdd:     (product: Product) => void
  fmt:       (n: number) => string
  fmtParts:  (n: number) => AmountParts
  i:         (fr: string, en: string, es: string, it: string) => string
  isLoading: boolean
  isError:   boolean
  onRetry:   () => void
}

export default function POSProductGrid({
  filtered, cart, onAdd, fmt, fmtParts, i, isLoading, isError, onRetry,
}: POSProductGridProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  // Quantités précalculées : évite un cart.find O(panier) PAR carte produit à chaque rendu.
  const qtyByProductId = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cart) if (!m.has(c.productId)) m.set(c.productId, c.quantity)
    return m
  }, [cart])
  // Identité stable pour la prop onAdd (le parent passe une closure recréée à chaque
  // rendu) — sans ça, React.memo sur ProductCard ne filtre rien. Comportement identique :
  // la ref pointe toujours la dernière closure.
  const onAddRef = useRef(onAdd)
  onAddRef.current = onAdd
  const handleAdd = useCallback((p: Product) => { onAddRef.current(p) }, [])

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
  }
  if (isError) {
    return <ErrorState onRetry={onRetry} />
  }
  return (
    <FlatList
      removeClippedSubviews={false}
      // ⚠️ Cases vides sur la dernière rangée : sans elles, `flex: 1` fait ÉTIRER
      // les tuiles restantes sur toute la largeur (mesuré le 2026-08-13 sur émulateur,
      // « Tomate concentrée 800g » en bannière). Jumeau natif du défaut `auto-fit` web.
      data={completerRangee(filtered, 3)}
      keyExtractor={(p) => p.id}
      numColumns={3}
      columnWrapperStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}
      contentContainerStyle={{ gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: cart.length > 0 ? 110 : Spacing.xl }}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>📦</Text>
          <Text style={s.emptyTitle}>{i('Aucun produit', 'No products', 'Sin productos', 'Nessun prodotto')}</Text>
          <Text style={s.emptyTxt}>{i('Aucun produit dans cette catégorie.', 'No product in this category.', 'Ningún producto en esta categoría.', 'Nessun prodotto in questa categoria.')}</Text>
        </View>
      }
      renderItem={({ item }: { item: Product | CaseVide }) => (
        estCaseVide(item) ? <View style={{ flex: 1 }} /> : (
        <ProductCard
          product={item}
          qtyInCart={qtyByProductId.get(item.id) ?? 0}
          fmt={fmt}
          fmtParts={fmtParts}
          onAdd={handleAdd}
        />
      ))}
    />
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text2, marginTop: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3, textAlign: 'center', maxWidth: 260 },
  prodCard: {
    flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: C.border, padding: Spacing.sm,
    alignItems: 'center', gap: 4, minHeight: 110, justifyContent: 'center',
    position: 'relative', ...Shadow.sm,
  },
  prodCardOut: { opacity: 0.45 },
  prodCardLow: { borderColor: withAlpha(C.warn, 0.35) },
  prodLowDot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: C.warn, zIndex: 2 },
  prodEmoji: { fontSize: 30 },
  prodName: { fontSize: FontSize.xs, fontFamily: 'Geist_600SemiBold', color: C.text, textAlign: 'center' },
  prodPrice: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.accent, textAlign: 'center' },
  prodPriceCur: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_700Bold', color: withAlpha(C.accent, 0.62) },
  prodBadge: {
    position: 'absolute', top: 5, right: 5, minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  prodBadgeTxt: { fontSize: FontSize.xs, fontFamily: 'Geist_800ExtraBold', color: C.white },
  prodOutBadge: {
    position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
})
