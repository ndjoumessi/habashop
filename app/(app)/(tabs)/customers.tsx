import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList, ScrollView,
  TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Pressable, RefreshControl, Linking, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { customersApi } from '@/services/api'
import type { Customer } from '@/types'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import {
  ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha,
} from '@/constants/theme'
import ErrorState from '@/components/ui/ErrorState'
import ScreenHeader from '@/components/ui/ScreenHeader'
import LoyaltyCardDigital from '@/components/customers/LoyaltyCardDigital'

function initials(name?: string) {
  return (name ?? '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}
const telHref = (p?: string) => `tel:${(p ?? '').replace(/[^0-9+]/g, '')}`
const waHref  = (p?: string) => `whatsapp://send?phone=${(p ?? '').replace(/[^0-9]/g, '')}`

// ── Carte client ─────────────────────────────────
function CustomerCard({ c, fmt, onPress, C }: { c: Customer; fmt: (n: number) => string; onPress: () => void; C: ThemeColors }) {
  const s = useMemo(() => makeStyles(C), [C])
  const TYPE_COLOR: Record<string, string> = {
    'Grossiste': C.primary,
    'Semi-gros': C.accent3,
    'Fidèle':    C.accent2,
    'Détail':    C.accent,
  }
  const typeColor = (t?: string) => TYPE_COLOR[t ?? ''] ?? C.primary
  const color = typeColor(c.type)
  return (
    <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name?.trim() ?? ''}, ${c.type ?? ''}, ${fmt(c.totalRevenue ?? 0)}`}>
      <View style={[s.avatar, { backgroundColor: color }]}>
        <Text style={s.avatarTxt}>{initials(c.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{c.name?.trim()}</Text>
          <View style={[s.typeBadge, { backgroundColor: `${color}1a`, borderColor: `${color}40` }]}>
            <Text style={[s.typeTxt, { color }]}>{c.type ?? '—'}</Text>
          </View>
        </View>
        {!!c.phone && <Text style={s.phone} numberOfLines={1}>📞 {c.phone}</Text>}
        <View style={s.metaRow}>
          <Text style={s.metaCa}>{fmt(c.totalRevenue ?? 0)}</Text>
          {(c.loyaltyPoints ?? 0) > 0 && <Text style={s.metaPts}>⭐ {c.loyaltyPoints} pts</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.text3} />
    </TouchableOpacity>
  )
}

// ── Écran Clients ────────────────────────────────
export default function CustomersScreen() {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const { i } = useI18n()
  const { fmt } = useFmt()

  const TYPE_COLOR: Record<string, string> = {
    'Grossiste': C.primary,
    'Semi-gros': C.accent3,
    'Fidèle':    C.accent2,
    'Détail':    C.accent,
  }
  const typeColor = (t?: string) => TYPE_COLOR[t ?? ''] ?? C.primary

  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<any | null>(null)
  const [digitalCardId, setDigitalCardId] = useState<string | null>(null)
  const { tenant } = useAuthStore()

  const { data: customers = [], isLoading, isError, refetch, isRefetching } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn:  () => customersApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const grossistes = useMemo(() => customers.filter((c) => c.type === 'Grossiste').length, [customers])
  const fideles    = useMemo(() => customers.filter((c) => (c.loyaltyPoints ?? 0) > 0).length, [customers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q),
    )
  }, [customers, search])

  const openLink = (url: string, errMsg: string) => {
    Linking.openURL(url).catch(() => Alert.alert(i('Indisponible', 'Unavailable', 'No disponible', 'Non disponibile'), errMsg))
  }

  const Chip = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={s.chip}>
      <Text style={[s.chipVal, { color }]}>{value}</Text>
      <Text style={s.chipLabel}>{label}</Text>
    </View>
  )

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <ScreenHeader
        icon="people"
        title={i('Clients', 'Customers', 'Clientes', 'Clienti')}
        subtitle={`${customers.length} ${i('clients', 'customers', 'clientes', 'clienti')}`}
        right={
          <Pressable style={s.headerBtn} onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch('') }} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showSearch
              ? i('Fermer la recherche', 'Close search', 'Cerrar búsqueda', 'Chiudi ricerca')
              : i('Rechercher', 'Search', 'Buscar', 'Cerca')}>
            <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={C.text2} />
          </Pressable>
        }
      />

      {/* ── Recherche (toggle) ── */}
      {showSearch && (
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={C.text3} />
          <TextInput
            style={s.searchInput}
            placeholder={i('Nom, téléphone, email…', 'Name, phone, email…', 'Nombre, teléfono, email…', 'Nome, telefono, email…')}
            placeholderTextColor={C.text3}
            value={search}
            onChangeText={setSearch}
            autoFocus
            returnKeyType="search"
            accessibilityLabel={i('Rechercher un client', 'Search a customer', 'Buscar un cliente', 'Cerca un cliente')}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i('Effacer la recherche', 'Clear search', 'Borrar búsqueda', 'Cancella ricerca')}>
              <Ionicons name="close-circle" size={18} color={C.text3} />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Stats ── */}
      <View style={s.chipsRow}>
        <Chip label={i('Total', 'Total', 'Total', 'Totale')} value={customers.length} color={C.text} />
        <Chip label={i('Grossistes', 'Wholesale', 'Mayoristas', 'Grossisti')} value={grossistes} color={C.primary3} />
        <Chip label={i('Fidèles', 'Loyal', 'Fieles', 'Fedeli')} value={fideles} color={C.accent2} />
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
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, paddingBottom: insets.bottom + Spacing.xxxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} colors={[C.primary]} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 48 }}>👥</Text>
              <Text style={s.emptyTitle}>{i('Aucun client', 'No customers', 'Sin clientes', 'Nessun cliente')}</Text>
              <Text style={s.emptyTxt}>{i('Ajoutez vos clients depuis le web ou la caisse.', 'Add customers from the web or the register.', 'Agregue clientes desde la web o la caja.', 'Aggiungi clienti dal web o dalla cassa.')}</Text>
            </View>
          }
          renderItem={({ item }: { item: Customer }) => (
            <CustomerCard c={item} fmt={fmt} onPress={() => setSel(item)} C={C} />
          )}
        />
      )}

      {/* ── Modal détail ── */}
      {!!sel && (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSel(null)}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{i('Fiche client', 'Customer', 'Cliente', 'Scheda cliente')}</Text>
            <Pressable onPress={() => setSel(null)} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>

          {sel && (
            <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg }}>
              {/* Header */}
              <View style={s.detailHead}>
                <View style={[s.detailAvatar, { backgroundColor: typeColor(sel.type) }]}>
                  <Text style={s.detailAvatarTxt}>{initials(sel.name)}</Text>
                </View>
                <Text style={s.detailName}>{sel.name?.trim()}</Text>
                <View style={[s.typeBadge, { backgroundColor: `${typeColor(sel.type)}1a`, borderColor: `${typeColor(sel.type)}40` }]}>
                  <Text style={[s.typeTxt, { color: typeColor(sel.type) }]}>{sel.type ?? '—'}</Text>
                </View>
              </View>

              {/* KPIs */}
              <View style={s.kpis}>
                <View style={s.kpi}>
                  <Text style={[s.kpiVal, { color: C.accent }]}>{fmt(sel.totalRevenue ?? 0)}</Text>
                  <Text style={s.kpiLabel}>{i('CA total', 'Revenue', 'CA total', 'Ricavi')}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={[s.kpiVal, { color: C.warn }]}>{sel.loyaltyPoints ?? 0}</Text>
                  <Text style={s.kpiLabel}>{i('Points', 'Points', 'Puntos', 'Punti')}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={[s.kpiVal, { color: C.text2, fontSize: FontSize.md }]}>
                    {sel.createdAt ? new Date(sel.createdAt).getFullYear() : '—'}
                  </Text>
                  <Text style={s.kpiLabel}>{i('Client depuis', 'Since', 'Desde', 'Dal')}</Text>
                </View>
              </View>

              {/* Carte fidélité numérique partageable (si enableLoyalty) */}
              {tenant?.enableLoyalty && (
                <Pressable
                  style={s.digitalCardBtn}
                  onPress={() => setDigitalCardId(sel.id)}
                  accessibilityRole="button"
                  accessibilityLabel={i('Partager la carte fidélité', 'Share loyalty card', 'Compartir tarjeta', 'Condividi carta')}>
                  <Text style={s.digitalCardBtnTxt}>🎴 {i('Partager la carte', 'Share card', 'Compartir tarjeta', 'Condividi carta')}</Text>
                </Pressable>
              )}

              {/* Contact */}
              <View style={s.contactCard}>
                {!!sel.phone && (
                  <TouchableOpacity style={s.contactRow} onPress={() => openLink(telHref(sel.phone), i('Appel impossible', 'Cannot call', 'No se puede llamar', 'Impossibile chiamare'))}
                    accessibilityRole="button"
                    accessibilityLabel={`${i('Appeler', 'Call', 'Llamar', 'Chiama')} ${sel.phone}`}>
                    <Ionicons name="call-outline" size={18} color={C.accent2} />
                    <Text style={s.contactTxt}>{sel.phone}</Text>
                    <Ionicons name="chevron-forward" size={15} color={C.text3} />
                  </TouchableOpacity>
                )}
                {!!sel.email && (
                  <TouchableOpacity style={[s.contactRow, !!sel.phone && s.listRowBorderTop]} onPress={() => openLink(`mailto:${sel.email}`, i('Email impossible', 'Cannot email', 'No se puede enviar', 'Impossibile inviare'))}
                    accessibilityRole="button"
                    accessibilityLabel={`${i('Envoyer un email à', 'Email', 'Enviar email a', 'Invia email a')} ${sel.email}`}>
                    <Ionicons name="mail-outline" size={18} color={C.accent3} />
                    <Text style={s.contactTxt} numberOfLines={1}>{sel.email}</Text>
                    <Ionicons name="chevron-forward" size={15} color={C.text3} />
                  </TouchableOpacity>
                )}
                {!!sel.address && (
                  <View style={[s.contactRow, (!!sel.phone || !!sel.email) && s.listRowBorderTop]}>
                    <Ionicons name="location-outline" size={18} color={C.text3} />
                    <Text style={s.contactTxt} numberOfLines={2}>{sel.address}</Text>
                  </View>
                )}
                {!sel.phone && !sel.email && !sel.address && (
                  <Text style={s.noContact}>{i('Aucune coordonnée', 'No contact info', 'Sin datos de contacto', 'Nessun contatto')}</Text>
                )}
              </View>

              {/* Actions */}
              {!!sel.phone && (
                <View style={s.actions}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.accent2 }]} onPress={() => openLink(telHref(sel.phone), i('Appel impossible', 'Cannot call', 'No se puede llamar', 'Impossibile chiamare'))}
                    accessibilityRole="button"
                    accessibilityLabel={`${i('Appeler', 'Call', 'Llamar', 'Chiama')} ${sel.name?.trim() ?? ''}`}>
                    <Ionicons name="call" size={16} color={C.white} />
                    <Text style={s.actionTxt}>{i('Appeler', 'Call', 'Llamar', 'Chiama')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => openLink(waHref(sel.phone), i('WhatsApp non installé', 'WhatsApp not installed', 'WhatsApp no instalado', 'WhatsApp non installato'))}
                    accessibilityRole="button"
                    accessibilityLabel={`WhatsApp ${sel.name?.trim() ?? ''}`}>
                    <Ionicons name="logo-whatsapp" size={16} color={C.white} />
                    <Text style={s.actionTxt}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
      )}

      {/* Carte fidélité numérique — montée ON-DEMAND (anti-crash Fabric) */}
      {!!digitalCardId && (
        <LoyaltyCardDigital customerId={digitalCardId} onClose={() => setDigitalCardId(null)} />
      )}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text2, marginTop: Spacing.sm },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', maxWidth: 260 },

  headerBtn: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.xl, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, height: 44,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text },

  chipsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
  chip: { flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, paddingVertical: Spacing.md, alignItems: 'center', gap: 2, ...Shadow.sm },
  chipVal: { fontSize: FontSize.xl, fontFamily: 'JetBrainsMono_700Bold' },
  chipLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4 },

  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, ...Shadow.sm },
  avatar: { width: 46, height: 46, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flexShrink: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1 },
  typeTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold' },
  phone: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 3 },
  metaCa: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_700Bold', color: C.accent },
  metaPts: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.warn },

  // Sheet
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  detailHead: { alignItems: 'center', gap: Spacing.sm },
  detailAvatar: { width: 72, height: 72, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  detailAvatarTxt: { fontSize: FontSize.xxl, fontFamily: 'Outfit_800ExtraBold', color: C.white },
  detailName: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text, textAlign: 'center' },

  kpis: { flexDirection: 'row', gap: Spacing.sm },
  kpi: { flex: 1, backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, alignItems: 'center', gap: 4 },
  kpiVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold' },
  kpiLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  contactCard: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  listRowBorderTop: { borderTopWidth: 1, borderTopColor: C.border },
  contactTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },
  noContact: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', padding: Spacing.md },

  actions: { flexDirection: 'row', gap: Spacing.sm },
  digitalCardBtn: { backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3), borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center' },
  digitalCardBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.primary3 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 50, borderRadius: BorderRadius.md },
  actionTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
})
