import { useMemo, useState } from 'react'
import {
  View, Text, Modal, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { customersApi } from '@/services/api'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'
import type { Customer } from '@/types'

interface CustomerPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (customer: Customer | null) => void
  selectedId?: string | null
  // Optionnel : si fourni, affiche un bouton « Scanner la carte fidélité » (POS).
  onScanCard?: () => void
}

// Sélecteur de client pour le checkout POS — recherche locale par nom/téléphone,
// sélection optionnelle (option « Aucun client » pour délier). Charge GET /api/customers.
export default function CustomerPicker({ visible, onClose, onSelect, selectedId, onScanCard }: CustomerPickerProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const insets = useSafeAreaInsets()
  const [q, setQ] = useState('')

  const { data: customers = [], isLoading, isError, refetch } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: visible,
  })

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return customers
    return customers.filter(c =>
      c.name?.toLowerCase().includes(ql) || (c.phone ?? '').toLowerCase().includes(ql),
    )
  }, [customers, q])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.sheet, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={s.head}>
          <Text style={s.title}>{i('Choisir un client', 'Choose a customer', 'Elegir un cliente', 'Scegli un cliente')}</Text>
          <Pressable onPress={onClose} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={C.text3} />
          <TextInput
            style={s.searchInput}
            placeholder={i('Nom ou téléphone…', 'Name or phone…', 'Nombre o teléfono…', 'Nome o telefono…')}
            placeholderTextColor={C.text3}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            accessibilityLabel={i('Rechercher un client', 'Search a customer', 'Buscar un cliente', 'Cerca un cliente')}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i('Effacer', 'Clear', 'Borrar', 'Cancella')}>
              <Ionicons name="close-circle" size={18} color={C.text3} />
            </Pressable>
          )}
        </View>

        {/* Scanner la carte fidélité (QR client) — POS uniquement */}
        {onScanCard && (
          <Pressable style={s.scanRow} onPress={onScanCard}
            accessibilityRole="button"
            accessibilityLabel={i('Scanner la carte fidélité', 'Scan loyalty card', 'Escanear tarjeta de fidelidad', 'Scansiona carta fedeltà')}>
            <Ionicons name="qr-code-outline" size={18} color={C.primary3} />
            <Text style={s.scanTxt}>{i('Scanner la carte fidélité', 'Scan loyalty card', 'Escanear tarjeta de fidelidad', 'Scansiona carta fedeltà')}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.text3} />
          </Pressable>
        )}

        {/* Option : aucun client (délier) */}
        <Pressable style={s.noneRow} onPress={() => onSelect(null)}
          accessibilityRole="button"
          accessibilityLabel={i('Vente sans client', 'Sale without customer', 'Venta sin cliente', 'Vendita senza cliente')}>
          <Ionicons name="person-remove-outline" size={18} color={C.text3} />
          <Text style={s.noneTxt}>{i('Aucun client', 'No customer', 'Sin cliente', 'Nessun cliente')}</Text>
          {!selectedId && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
        </Pressable>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator color={C.primary} /></View>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <FlatList
            removeClippedSubviews={false}
            data={filtered}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, paddingBottom: insets.bottom + Spacing.xl }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={s.empty}>{i('Aucun client trouvé', 'No customer found', 'Ningún cliente', 'Nessun cliente trovato')}</Text>
            }
            renderItem={({ item }: { item: Customer }) => {
              const on = item.id === selectedId
              return (
                <Pressable
                  style={[s.row, on && s.rowOn]}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.name}${item.phone ? `, ${item.phone}` : ''}, ${item.loyaltyPoints ?? 0} ${i('points', 'points', 'puntos', 'punti')}`}
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{(item.name ?? '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.sub} numberOfLines={1}>
                      {item.phone || item.email || '—'}
                      {item.type ? ` · ${item.type}` : ''}
                    </Text>
                  </View>
                  <View style={s.ptsBox}>
                    <Text style={s.ptsVal}>{item.loyaltyPoints ?? 0}</Text>
                    <Text style={s.ptsLbl}>{i('pts', 'pts', 'pts', 'pti')}</Text>
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                </Pressable>
              )
            }}
          />
        )}
      </View>
    </Modal>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  sheet: { flex: 1, backgroundColor: C.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, paddingHorizontal: Spacing.md, height: 44,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text },
  scanRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    backgroundColor: withAlpha(C.primary, 0.08), borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: withAlpha(C.primary, 0.35),
  },
  scanTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.primary3 },
  noneRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
  },
  noneTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: C.text3, fontFamily: 'Outfit_400Regular', fontSize: FontSize.sm, paddingVertical: Spacing.xxxl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: C.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
    padding: Spacing.md,
  },
  rowOn: { borderColor: C.primary, backgroundColor: withAlpha(C.primary, 0.08) },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: withAlpha(C.primary, 0.15),
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.primary3 },
  name: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.text },
  sub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },
  ptsBox: { alignItems: 'center', minWidth: 38 },
  ptsVal: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.accent2 },
  ptsLbl: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
})
