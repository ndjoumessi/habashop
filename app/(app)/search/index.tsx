import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { productsApi, customersApi } from '@/services/api'
import type { Product, Customer } from '@/types'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { Spacing, BorderRadius, FontSize, withAlpha, ThemeColors } from '@/constants/theme'
import Chip from '@/components/ui/Chip'

type ResultType = 'product' | 'customer'
interface SearchResult {
  id: string
  type: ResultType
  title: string
  subtitle: string
  emoji: string
  data: Product | Customer
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const { fmt } = useFmt()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['search-products'],
    queryFn: () => productsApi.list(),
    staleTime: 10 * 60 * 1000,
  })
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['search-customers'],
    queryFn: () => customersApi.list(),
    staleTime: 10 * 60 * 1000,
  })

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const ql = q.toLowerCase()
    const found: SearchResult[] = []
    for (const p of products) {
      if (p.name?.toLowerCase().includes(ql) || p.barcode?.includes(q) || p.category?.toLowerCase().includes(ql)) {
        found.push({
          id: p.id, type: 'product', title: p.name,
          subtitle: `${fmt(p.sellPrice ?? 0)} · ${p.stockQty ?? 0} ${i('en stock', 'in stock', 'en stock', 'in stock')}`,
          emoji: p.emoji ?? '📦', data: p,
        })
      }
    }
    for (const c of customers) {
      if (c.name?.toLowerCase().includes(ql) || c.phone?.includes(q) || c.email?.toLowerCase().includes(ql)) {
        found.push({
          id: c.id, type: 'customer', title: c.name,
          subtitle: c.phone ?? c.email ?? c.type ?? '', emoji: '👤', data: c,
        })
      }
    }
    setResults(found.slice(0, 20))
    setSearching(false)
  }, [products, customers, fmt, i])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'product') router.push('/(app)/pos')
    else router.push('/(app)/(tabs)/customers')
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel={i('Retour', 'Back', 'Volver', 'Indietro')}
        >
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder={i('Produits, clients…', 'Products, customers…', 'Productos, clientes…', 'Prodotti, clienti…')}
            placeholderTextColor={C.text3}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            accessibilityLabel={i('Recherche globale', 'Global search', 'Búsqueda global', 'Ricerca globale')}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={i('Effacer', 'Clear', 'Borrar', 'Cancella')}
            >
              <Text style={s.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searching ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : results.length === 0 && query.length > 0 ? (
        <View style={s.emptyWrap}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={s.emptyText}>{i('Aucun résultat', 'No results', 'Sin resultados', 'Nessun risultato')}</Text>
          <Text style={s.emptySubtext}>&quot;{query}&quot;</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={s.hintWrap}>
          <Text style={s.hintText}>
            {i('Recherchez des produits ou clients', 'Search products or customers', 'Busque productos o clientes', 'Cerca prodotti o clienti')}
          </Text>
          <View style={s.suggestionsRow}>
            {['Riz', 'Sucre', 'Savon'].map(term => (
              <Chip key={term} label={term} selected={false} onPress={() => setQuery(term)} />
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={false}
          data={results}
          keyExtractor={r => `${r.type}-${r.id}`}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.resultRow}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} — ${item.subtitle}`}
            >
              <View style={s.resultEmoji}>
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.resultTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.resultSub} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              <View style={[s.typeBadge, item.type === 'product' ? s.typeBadgeProduct : s.typeBadgeCustomer]}>
                <Text style={[s.typeBadgeText, item.type === 'product' ? s.typeBadgeTextProduct : s.typeBadgeTextCustomer]}>
                  {item.type === 'product'
                    ? i('Produit', 'Product', 'Producto', 'Prodotto')
                    : i('Client', 'Customer', 'Cliente', 'Cliente')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.xl,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
  },
  backIcon: { fontSize: FontSize.xl, color: C.text2, fontFamily: 'Outfit_700Bold' },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: C.bg3, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: Spacing.md, height: 44,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text },
  clearIcon: { fontSize: FontSize.md, color: C.text3, padding: 4 },
  list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  resultEmoji: {
    width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: C.text },
  resultSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  typeBadgeProduct: { backgroundColor: withAlpha(C.accent3, 0.1) },
  typeBadgeCustomer: { backgroundColor: withAlpha(C.accent2, 0.1) },
  typeBadgeText: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.4 },
  typeBadgeTextProduct: { color: C.accent3 },
  typeBadgeTextCustomer: { color: C.accent2 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: { fontSize: FontSize.lg, fontFamily: 'Outfit_700Bold', color: C.text },
  emptySubtext: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  hintWrap: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.lg },
  hintText: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center' },
  suggestionsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  suggestionChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
  },
  suggestionText: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
})
