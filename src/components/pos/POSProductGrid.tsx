import { useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CartItem } from '@/stores/posStore'
import type { Product } from '@/types'
import { useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'

// ── Carte produit ────────────────────────────────
function ProductCard({
  product, qtyInCart, fmt, onPress,
}: {
  product: Product; qtyInCart: number
  fmt: (n: number) => string
  onPress: () => void
}) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const out = (product.stockQty ?? 0) <= 0
  return (
    <TouchableOpacity
      style={[s.prodCard, out && s.prodCardOut]}
      activeOpacity={0.7}
      disabled={out}
      onPress={onPress}
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
      <Text style={s.prodEmoji}>{product.emoji ?? '📦'}</Text>
      <Text style={s.prodName} numberOfLines={2}>{product.name?.trim()}</Text>
      <Text style={s.prodPrice}>{fmt(product.sellPrice ?? 0)}</Text>
    </TouchableOpacity>
  )
}

interface POSProductGridProps {
  filtered:  Product[]
  cart:      CartItem[]
  onAdd:     (product: Product) => void
  fmt:       (n: number) => string
  i:         (fr: string, en: string, es: string, it: string) => string
  isLoading: boolean
  isError:   boolean
  onRetry:   () => void
}

export default function POSProductGrid({
  filtered, cart, onAdd, fmt, i, isLoading, isError, onRetry,
}: POSProductGridProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const qtyOf = (id: string) => cart.find(c => c.productId === id)?.quantity ?? 0

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
  }
  if (isError) {
    return <ErrorState onRetry={onRetry} />
  }
  return (
    <FlatList
      removeClippedSubviews={false}
      data={filtered}
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
      renderItem={({ item }: { item: Product }) => (
        <ProductCard
          product={item}
          qtyInCart={qtyOf(item.id)}
          fmt={fmt}
          onPress={() => onAdd(item)}
        />
      )}
    />
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text2, marginTop: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', maxWidth: 260 },
  prodCard: {
    flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: C.border, padding: Spacing.sm,
    alignItems: 'center', gap: 4, minHeight: 110, justifyContent: 'center',
    position: 'relative', ...Shadow.sm,
  },
  prodCardOut: { opacity: 0.45 },
  prodEmoji: { fontSize: 30 },
  prodName: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text, textAlign: 'center' },
  prodPrice: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.accent },
  prodBadge: {
    position: 'absolute', top: 5, right: 5, minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  prodBadgeTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_800ExtraBold', color: C.white },
  prodOutBadge: {
    position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
})
