import { useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analyticsApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { updateWidgetNotification, isWidgetEnabled } from '@/services/widgetNotification'
import Avatar from '@/components/ui/Avatar'
import { useProfilePhoto } from '@/hooks/useProfilePhoto'
import {
  ThemeColors, Spacing, BorderRadius,
  FontSize, Shadow, withAlpha,
} from '@/constants/theme'

// ── Composant KPI Card ───────────────────────────
function KpiCard({
  label, value, icon, color, sub
}: {
  label:  string
  value:  string
  icon:   string
  color:  string
  sub?:   string
}) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <View style={[s.kpiCard, { borderColor:`${color}30` }]}>
      <View style={[s.kpiIcon, { backgroundColor:`${color}18` }]}>
        <Text style={{ fontSize:20 }}>{icon}</Text>
      </View>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      {sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  )
}

// ── Composant Action rapide ──────────────────────
function QuickAction({
  icon, label, color, onPress
}: {
  icon:    string
  label:   string
  color:   string
  onPress: () => void
}) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <TouchableOpacity
      style={s.action}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[s.actionIcon,
        { backgroundColor:`${color}18` }]}>
        <Text style={{ fontSize:24 }}>{icon}</Text>
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Écran Dashboard ──────────────────────────────
export default function DashboardScreen() {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const { user, tenant } = useAuthStore()
  const { i, lang } = useI18n()
  const { fmt } = useFmt()
  const { isOnline } = useNetworkStatus()
  const { photoUri } = useProfilePhoto()

  // Charge les stats dashboard (API réelle : GET /api/dashboard/stats, réponse à plat)
  const {
    data, isLoading, isError, refetch, isRefetching
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  analyticsApi.dashboard,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  const d         = data ?? {}
  const topProds  = data?.topProducts  ?? []
  const alerts    = data?.stockAlerts  ?? []
  const firstName = user?.name?.split(' ')[0] ?? ''

  // Met à jour le widget (notification persistante) quand les stats arrivent, si activé.
  useEffect(() => {
    if (!data || isLoading) return
    isWidgetEnabled().then(en => {
      if (en) updateWidgetNotification(data.salesToday ?? 0, data.transactionsToday ?? 0, fmt, lang)
    }).catch(() => {})
  }, [data, isLoading, fmt, lang])

  // Heure du jour
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? i('Bonjour','Good morning','Buenos días','Buongiorno') :
    hour < 18 ? i('Bon après-midi','Good afternoon','Buenas tardes','Buon pomeriggio') :
                i('Bonsoir','Good evening','Buenas noches','Buonasera')

  return (
    <View style={[s.container, { paddingTop:insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ marginRight: Spacing.md }}>
            <Avatar
              name={user?.name ?? 'U'}
              photoUri={photoUri}
              size={40}
              onPress={() => router.push('/(app)/(tabs)/settings')}
            />
          </View>
          <View style={{ flex:1 }}>
            <Text style={s.greeting}>
              {greeting}, {firstName} 👋
            </Text>
            <Text style={s.shopName}>{tenant?.name}</Text>
            {!isOnline && (
              <View style={s.offlineBadge}>
                <Text style={s.offlineBadgeText}>
                  {i('Hors ligne', 'Offline', 'Sin conexión', 'Non in linea')}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity
              style={s.searchBtn}
              onPress={() => router.push('/(app)/search')}
              accessibilityRole="button"
              accessibilityLabel={i('Rechercher', 'Search', 'Buscar', 'Cerca')}
            >
              <Text style={{ fontSize: 18 }}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.notifBtn}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel={i('Notifications', 'Notifications', 'Notificaciones', 'Notifiche')}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={C.text2}
              />
              {(d.pendingOrders ?? 0) > 0 && (
                <View style={s.notifDot}/>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Banner essai ── */}
        {tenant?.status === 'trial' && (
          <TouchableOpacity
            style={s.trialBanner}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={i('Essai gratuit — passer au Pro', 'Free trial — upgrade to Pro', 'Prueba gratuita — pasar a Pro', 'Prova gratuita — passa a Pro')}
          >
            <Text style={s.trialText}>
              ⚡ {i(
                'Essai gratuit · Passez au Pro',
                'Free trial · Upgrade to Pro',
                'Prueba gratuita · Pase a Pro',
                'Prova gratuita · Passa a Pro'
              )}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={C.warn}
            />
          </TouchableOpacity>
        )}

        {/* ── KPIs ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {i('Aujourd\'hui','Today','Hoy','Oggi')}
          </Text>

          {isLoading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator
                color={C.primary}
                size="large"
              />
            </View>
          ) : isError ? (
            <TouchableOpacity
              style={s.errorWrap}
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel={i('Erreur — Appuyez pour réessayer', 'Error — Tap to retry', 'Error — Toca para reintentar', 'Errore — Tocca per riprovare')}
            >
              <Text style={s.errorText}>
                ⚠️ {i(
                  'Erreur — Appuyez pour réessayer',
                  'Error — Tap to retry',
                  'Error — Toca para reintentar',
                  'Errore — Tocca per riprovare'
                )}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={s.kpiGrid}>
              <KpiCard
                label={i('CA du jour','Today\'s revenue','CA hoy','Ricavi oggi')}
                value={fmt(d.salesToday ?? 0)}
                icon="💰"
                color={C.accent}
                sub={`${d.transactionsToday ?? 0} ${i('ventes','sales','ventas','vendite')}`}
              />
              <KpiCard
                label={i('Ce mois','This month','Este mes','Questo mese')}
                value={fmt(d.salesMonth ?? 0)}
                icon="📈"
                color={C.primary}
              />
              <KpiCard
                label={i('Produits','Products','Productos','Prodotti')}
                value={String(d.totalProducts ?? 0)}
                icon="📦"
                color={C.accent3}
                sub={alerts.length > 0
                  ? `⚠️ ${alerts.length} ${i('alertes','alerts','alertas','avvisi')}`
                  : i('✅ Stock OK','✅ Stock OK','✅ Stock OK','✅ Stock OK')}
              />
              <KpiCard
                label={i('Employés','Staff','Empleados','Dipendenti')}
                value={String(d.activeEmployees ?? 0)}
                icon="👥"
                color={C.accent2}
              />
            </View>
          )}
        </View>

        {/* ── Actions rapides ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {i('Actions rapides','Quick actions',
               'Acciones rápidas','Azioni rapide')}
          </Text>
          <View style={s.actionsGrid}>
            <QuickAction
              icon="🛒"
              label={i('Caisse','Register','Caja','Cassa')}
              color={C.primary}
              onPress={() => router.push('/(app)/pos')}
            />
            <QuickAction
              icon="📦"
              label="Stock"
              color={C.accent3}
              onPress={() => router.push('/(app)/(tabs)/stock')}
            />
            <QuickAction
              icon="👥"
              label={i('Clients','Customers','Clientes','Clienti')}
              color={C.accent2}
              onPress={() => router.push('/(app)/(tabs)/customers')}
            />
            <QuickAction
              icon="📊"
              label={i('Rapports','Reports','Informes','Rapporti')}
              color={C.accent}
              onPress={() => router.push('/(app)/reports')}
            />
            <QuickAction
              icon="📋"
              label={i('Historique','History','Historial','Storico')}
              color={C.primary3}
              onPress={() => router.push('/(app)/sales')}
            />
          </View>
        </View>

        {/* ── Alertes stock ── */}
        {alerts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              ⚠️ {i('Alertes stock','Stock alerts',
                    'Alertas stock','Avvisi stock')}
            </Text>
            <View style={s.alertsCard}>
              {alerts.slice(0,3).map((a, idx: number) => (
                <View
                  key={idx}
                  style={[
                    s.alertRow,
                    idx < alerts.slice(0,3).length - 1 && s.alertRowBorder
                  ]}
                >
                  <Text style={{ fontSize:18 }}>📦</Text>
                  <Text style={s.alertName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={s.alertQty}>
                    {a.stockQty} {idx === 0
                      ? i('restants','left','restantes','rimanenti')
                      : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Top produits ── */}
        {topProds.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              🏆 {i('Top produits','Top products',
                    'Mejores productos','Prodotti top')}
            </Text>
            <View style={s.topCard}>
              {topProds.slice(0,5).map((p, idx: number) => (
                <View
                  key={idx}
                  style={[
                    s.topRow,
                    idx < topProds.slice(0,5).length - 1
                      && s.topRowBorder
                  ]}
                >
                  <Text style={s.topRank}>
                    {['🥇','🥈','🥉','4️⃣','5️⃣'][idx]}
                  </Text>
                  <Text style={s.topName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={s.topCa}>{fmt(p.ca ?? 0)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + Spacing.xxxl }}/>
      </ScrollView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: {
    flex:1, backgroundColor:C.bg,
  },
  header: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:Spacing.xl,
    paddingTop:Spacing.lg, paddingBottom:Spacing.md,
  },
  greeting: {
    fontSize:FontSize.xl,
    fontFamily:'Outfit_800ExtraBold',
    color:C.text,
  },
  shopName: {
    fontSize:FontSize.sm,
    fontFamily:'Outfit_400Regular',
    color:C.text3, marginTop:2,
  },
  offlineBadge: {
    alignSelf:'flex-start', marginTop:6,
    backgroundColor:withAlpha(C.danger, 0.12),
    paddingHorizontal:Spacing.sm, paddingVertical:3,
    borderRadius:BorderRadius.full,
    borderWidth:1, borderColor:withAlpha(C.danger, 0.25),
  },
  offlineBadgeText: {
    fontSize:10, fontFamily:'Outfit_700Bold',
    color:C.danger, textTransform:'uppercase', letterSpacing:0.4,
  },
  notifBtn: {
    width:44, height:44,
    borderRadius:BorderRadius.md,
    backgroundColor:C.bg3,
    alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:C.border,
    position:'relative',
  },
  searchBtn: {
    width:44, height:44, borderRadius:BorderRadius.md,
    backgroundColor:C.bg3, alignItems:'center', justifyContent:'center',
    borderWidth:1, borderColor:C.border,
  },
  notifDot: {
    position:'absolute', top:6, right:6,
    width:8, height:8, borderRadius:4,
    backgroundColor:C.danger,
    borderWidth:2, borderColor:C.bg2,
  },
  trialBanner: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between',
    marginHorizontal:Spacing.xl,
    marginBottom:Spacing.md,
    backgroundColor:withAlpha(C.warn, 0.08),
    borderRadius:BorderRadius.lg,
    borderWidth:1,
    borderColor:withAlpha(C.warn, 0.2),
    padding:Spacing.md,
  },
  trialText: {
    fontSize:FontSize.sm,
    fontFamily:'Outfit_700Bold',
    color:C.warn,
  },
  section: {
    paddingHorizontal:Spacing.xl,
    marginBottom:Spacing.xl,
  },
  sectionTitle: {
    fontSize:FontSize.xs,
    fontFamily:'Outfit_700Bold',
    color:C.text3,
    textTransform:'uppercase',
    letterSpacing:0.6,
    marginBottom:Spacing.md,
  },
  loadingWrap: {
    height:160,
    alignItems:'center',
    justifyContent:'center',
  },
  errorWrap: {
    height:80,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:withAlpha(C.danger, 0.08),
    borderRadius:BorderRadius.lg,
    borderWidth:1,
    borderColor:withAlpha(C.danger, 0.2),
  },
  errorText: {
    fontSize:FontSize.sm,
    fontFamily:'Outfit_600SemiBold',
    color:C.danger,
  },
  kpiGrid: {
    flexDirection:'row',
    flexWrap:'wrap',
    gap:Spacing.md,
  },
  kpiCard: {
    width:'47%',
    backgroundColor:C.card,
    borderRadius:BorderRadius.lg,
    borderWidth:1,
    padding:Spacing.md,
    gap:Spacing.xs,
    ...Shadow.sm,
  },
  kpiIcon: {
    width:40, height:40,
    borderRadius:BorderRadius.md,
    alignItems:'center',
    justifyContent:'center',
    marginBottom:Spacing.xs,
  },
  kpiLabel: {
    fontSize:FontSize.xs,
    fontFamily:'Outfit_600SemiBold',
    color:C.text3,
  },
  kpiValue: {
    fontSize:FontSize.md,
    fontFamily:'JetBrainsMono_700Bold',
    letterSpacing:-0.5,
  },
  kpiSub: {
    fontSize:9,
    fontFamily:'Outfit_400Regular',
    color:C.text4,
    marginTop:2,
  },
  actionsGrid: {
    flexDirection:'row',
    justifyContent:'space-between',
  },
  action: {
    alignItems:'center',
    gap:Spacing.xs,
    flex:1,
  },
  actionIcon: {
    width:56, height:56,
    borderRadius:BorderRadius.xl,
    alignItems:'center',
    justifyContent:'center',
  },
  actionLabel: {
    fontSize:10,
    fontFamily:'Outfit_600SemiBold',
    color:C.text3,
    textAlign:'center',
  },
  alertsCard: {
    backgroundColor:C.card,
    borderRadius:BorderRadius.lg,
    borderWidth:1,
    borderColor:withAlpha(C.warn, 0.2),
    overflow:'hidden',
  },
  alertRow: {
    flexDirection:'row',
    alignItems:'center',
    gap:Spacing.md,
    padding:Spacing.md,
  },
  alertRowBorder: {
    borderBottomWidth:1,
    borderBottomColor:C.border,
  },
  alertName: {
    flex:1,
    fontSize:FontSize.sm,
    fontFamily:'Outfit_600SemiBold',
    color:C.text,
  },
  alertQty: {
    fontSize:FontSize.sm,
    fontFamily:'JetBrainsMono_700Bold',
    color:C.warn,
  },
  topCard: {
    backgroundColor:C.card,
    borderRadius:BorderRadius.lg,
    borderWidth:1,
    borderColor:C.border,
    overflow:'hidden',
  },
  topRow: {
    flexDirection:'row',
    alignItems:'center',
    gap:Spacing.md,
    padding:Spacing.md,
  },
  topRowBorder: {
    borderBottomWidth:1,
    borderBottomColor:C.border,
  },
  topRank: { fontSize:18, width:28 },
  topName: {
    flex:1,
    fontSize:FontSize.sm,
    fontFamily:'Outfit_600SemiBold',
    color:C.text,
  },
  topCa: {
    fontSize:FontSize.sm,
    fontFamily:'JetBrainsMono_700Bold',
    color:C.accent,
  },
})
