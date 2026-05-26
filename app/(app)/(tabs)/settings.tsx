import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Pressable, Switch, Alert,
} from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, useI18n, useFmt, type Lang } from '@/stores/appStore'
import { sendLocalNotification } from '@/services/notifications'
import {
  Colors, Spacing, BorderRadius, FontSize, Shadow,
} from '@/constants/theme'

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
]

const CURRENCIES = [
  { code: 'XOF', fr: 'Franc CFA (Afrique de l\'Ouest)', en: 'CFA Franc (West Africa)', es: 'Franco CFA (África Occidental)', it: 'Franco CFA (Africa Occ.)' },
  { code: 'XAF', fr: 'Franc CFA (Afrique Centrale)', en: 'CFA Franc (Central Africa)', es: 'Franco CFA (África Central)', it: 'Franco CFA (Africa Centr.)' },
  { code: 'EUR', fr: 'Euro', en: 'Euro', es: 'Euro', it: 'Euro' },
  { code: 'USD', fr: 'Dollar US', en: 'US Dollar', es: 'Dólar US', it: 'Dollaro USA' },
  { code: 'GBP', fr: 'Livre Sterling', en: 'Pound Sterling', es: 'Libra Esterlina', it: 'Sterlina' },
  { code: 'CAD', fr: 'Dollar Canadien', en: 'Canadian Dollar', es: 'Dólar Canadiense', it: 'Dollaro Canadese' },
]

function initials(name?: string) {
  return (name ?? '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  )
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const { user, tenant, logout } = useAuthStore()
  const { i, lang } = useI18n()
  const { fmt, currency } = useFmt()
  const setLang = useAppStore(s => s.setLang)
  const setCurrency = useAppStore(s => s.setCurrency)
  const qc = useQueryClient()

  const [notifStock, setNotifStock] = useState(true)
  const [notifSales, setNotifSales] = useState(true)
  const [notifTrial, setNotifTrial] = useState(true)

  const status = tenant?.status ?? 'active'
  const statusColor = status === 'suspended' ? Colors.danger : status === 'trial' ? Colors.warn : Colors.accent2

  // Change la langue + confirme (feedback immédiat dans la nouvelle langue)
  const handleSetLang = (code: Lang) => {
    setLang(code)
    Alert.alert(
      code === 'en' ? 'Language changed' : code === 'es' ? 'Idioma cambiado' : code === 'it' ? 'Lingua cambiata' : 'Langue changée',
      code === 'en' ? 'The app language is now English'
      : code === 'es' ? 'El idioma de la app es ahora español'
      : code === 'it' ? "La lingua dell'app è ora italiano"
      : "La langue de l'app est maintenant le français",
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}>
        <Text style={s.screenTitle}>⚙️ {i('Réglages', 'Settings', 'Ajustes', 'Impostazioni')}</Text>

        {/* A) Profil */}
        <View style={s.section}>
          <View style={s.profileCard}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initials(user?.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.profileName} numberOfLines={1}>{user?.name ?? '—'}</Text>
              <Text style={s.profileEmail} numberOfLines={1}>{user?.email}</Text>
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: 'rgba(108,71,255,0.15)', borderColor: 'rgba(108,71,255,0.3)' }]}>
                  <Text style={[s.badgeTxt, { color: Colors.primary3 }]}>{(tenant?.plan ?? 'starter').toUpperCase()}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: `${statusColor}1a`, borderColor: `${statusColor}40` }]}>
                  <Text style={[s.badgeTxt, { color: statusColor }]}>{status.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* B) Langue */}
        <Section title={i('Langue', 'Language', 'Idioma', 'Lingua')}>
          <View style={s.grid2}>
            {LANGS.map(l => {
              const on = lang === l.code
              return (
                <Pressable key={l.code} style={[s.gridItem, on && s.gridItemOn]} onPress={() => handleSetLang(l.code)}>
                  <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                  <Text style={[s.gridLabel, on && s.gridLabelOn]}>{l.label}</Text>
                  {on && <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={s.gridCheck} />}
                </Pressable>
              )
            })}
          </View>
        </Section>

        {/* C) Devise */}
        <Section title={i('Devise', 'Currency', 'Divisa', 'Valuta')}>
          {CURRENCIES.map((c, idx) => {
            const on = currency === c.code
            return (
              <Pressable
                key={c.code}
                style={[s.listRow, idx < CURRENCIES.length - 1 && s.listRowBorder, on && s.listRowOn]}
                onPress={() => setCurrency(c.code)}
              >
                <Text style={[s.curCode, on && { color: Colors.primary3 }]}>{c.code}</Text>
                <Text style={s.curName} numberOfLines={1}>{i(c.fr, c.en, c.es, c.it)}</Text>
                {on && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
              </Pressable>
            )
          })}
          {currency !== 'XOF' && currency !== 'XAF' && (
            <View style={s.rateInfo}>
              <Text style={s.rateText}>💱 1 000 F = {fmt(1000)}</Text>
              <Text style={s.rateSubText}>
                {i(
                  'Taux mis à jour toutes les 6h',
                  'Rate updated every 6h',
                  'Tasa actualizada cada 6h',
                  'Tasso aggiornato ogni 6h',
                )}
              </Text>
            </View>
          )}
        </Section>

        {/* D) Boutique */}
        <Section title={i('Boutique', 'Shop', 'Tienda', 'Negozio')}>
          {[
            { k: i('Nom', 'Name', 'Nombre', 'Nome'), v: tenant?.name ?? '—' },
            { k: i('Plan', 'Plan', 'Plan', 'Piano'), v: (tenant?.plan ?? '—').toUpperCase() },
            { k: i('Statut', 'Status', 'Estado', 'Stato'), v: status },
            { k: i('Devise', 'Currency', 'Divisa', 'Valuta'), v: currency },
            { k: i('Langue', 'Language', 'Idioma', 'Lingua'), v: lang.toUpperCase() },
          ].map((row, idx, arr) => (
            <View key={row.k} style={[s.infoRow, idx < arr.length - 1 && s.listRowBorder]}>
              <Text style={s.infoKey}>{row.k}</Text>
              <Text style={s.infoVal} numberOfLines={1}>{row.v}</Text>
            </View>
          ))}
        </Section>

        {/* E) Notifications */}
        <Section title={i('Notifications', 'Notifications', 'Notificaciones', 'Notifiche')}>
          {[
            { label: i('Alertes stock bas', 'Low stock alerts', 'Alertas stock bajo', 'Avvisi scorte basse'), val: notifStock, set: setNotifStock },
            { label: i('Nouvelles ventes', 'New sales', 'Nuevas ventas', 'Nuove vendite'), val: notifSales, set: setNotifSales },
            { label: i('Rappels d\'essai', 'Trial reminders', 'Recordatorios prueba', 'Promemoria prova'), val: notifTrial, set: setNotifTrial },
          ].map((row, idx, arr) => (
            <View key={row.label} style={[s.toggleRow, idx < arr.length - 1 && s.listRowBorder]}>
              <Text style={s.toggleLabel}>{row.label}</Text>
              <Switch
                value={row.val}
                onValueChange={row.set}
                trackColor={{ false: Colors.bg4, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
          <TouchableOpacity
            style={s.testNotifBtn}
            onPress={async () => {
              await sendLocalNotification({
                title: '🛍️ HabaShop',
                body: i(
                  'Test notification — tout fonctionne !',
                  'Test notification — everything works!',
                  'Notificación de prueba — ¡todo funciona!',
                  'Notifica di test — tutto funziona!',
                ),
              })
            }}
          >
            <Text style={s.testNotifText}>
              🔔 {i('Tester les notifications', 'Test notifications', 'Probar notificaciones', 'Testa notifiche')}
            </Text>
          </TouchableOpacity>
        </Section>

        {/* F) Sécurité */}
        <Section title={i('Sécurité', 'Security', 'Seguridad', 'Sicurezza')}>
          <TouchableOpacity
            style={s.actionRow}
            onPress={() => Alert.alert(
              i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password'),
              i('Changez votre mot de passe sur habashop.vercel.app', 'Change your password on habashop.vercel.app', 'Cambie su contraseña en habashop.vercel.app', 'Cambia la password su habashop.vercel.app'),
            )}
          >
            <Ionicons name="key-outline" size={18} color={Colors.text2} />
            <Text style={s.actionTxt}>{i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionRow, s.listRowBorderTop]}
            onPress={() => Alert.alert(
              i('Données & confidentialité', 'Data & privacy', 'Datos y privacidad', 'Dati e privacy'),
              i('Vos données sont chiffrées et hébergées en Europe (RGPD). Export et suppression disponibles sur le web.', 'Your data is encrypted and hosted in Europe (GDPR). Export and deletion available on the web.', 'Sus datos están cifrados y alojados en Europa (RGPD). Exportación y eliminación en la web.', 'I tuoi dati sono crittografati e ospitati in Europa (GDPR). Esportazione ed eliminazione sul web.'),
            )}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.text2} />
            <Text style={s.actionTxt}>{i('Données & confidentialité', 'Data & privacy', 'Datos y privacidad', 'Dati e privacy')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </TouchableOpacity>
        </Section>

        {/* G) Application */}
        <Section title={i('Application', 'Application', 'Aplicación', 'Applicazione')}>
          <View style={s.infoRow}>
            <Text style={s.infoKey}>Version</Text>
            <Text style={s.infoVal}>1.0.0</Text>
          </View>
          <View style={[s.infoRow, s.listRowBorderTop]}>
            <Text style={s.infoKey}>Backend</Text>
            <Text style={s.infoVal} numberOfLines={1}>habashop-production.up.railway.app</Text>
          </View>
          <TouchableOpacity
            style={[s.actionRow, s.listRowBorderTop]}
            onPress={() => { qc.clear(); Alert.alert(i('✅ Cache vidé', '✅ Cache cleared', '✅ Caché vaciado', '✅ Cache svuotata'), '') }}
          >
            <Ionicons name="trash-bin-outline" size={18} color={Colors.text2} />
            <Text style={s.actionTxt}>{i('Vider le cache', 'Clear cache', 'Vaciar caché', 'Svuota cache')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </TouchableOpacity>
        </Section>

        {/* H) Déconnexion */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.logoutBtn}
            onPress={() => Alert.alert(
              i('Déconnexion', 'Logout', 'Cerrar sesión', 'Disconnetti'),
              i('Voulez-vous vraiment vous déconnecter ?', 'Do you really want to log out?', '¿Seguro que desea cerrar sesión?', 'Vuoi davvero disconnetterti?'),
              [
                { text: i('Annuler', 'Cancel', 'Cancelar', 'Annulla'), style: 'cancel' },
                { text: i('Déconnexion', 'Logout', 'Cerrar sesión', 'Disconnetti'), style: 'destructive', onPress: () => logout() },
              ],
            )}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={s.logoutTxt}>{i('Se déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  screenTitle: { fontSize: FontSize.xxl, fontFamily: 'Outfit_900Black', color: Colors.text, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },

  section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: Colors.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.sm },

  // Profil
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, ...Shadow.sm,
  },
  avatar: {
    width: 60, height: 60, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored(Colors.primary),
  },
  avatarTxt: { fontSize: FontSize.xl, fontFamily: 'Outfit_900Black', color: Colors.white },
  profileName: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  profileEmail: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3, marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontFamily: 'Outfit_800ExtraBold', letterSpacing: 0.5 },

  // Langue grid 2x2
  grid2: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.sm, gap: Spacing.sm },
  gridItem: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg3, borderWidth: 1.5, borderColor: Colors.border, position: 'relative',
  },
  gridItemOn: { backgroundColor: 'rgba(108,71,255,0.12)', borderColor: Colors.primary },
  gridLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text2 },
  gridLabelOn: { color: Colors.primary3 },
  gridCheck: { position: 'absolute', top: 4, right: 4 },

  // Devise / listes
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  listRowOn: { backgroundColor: 'rgba(108,71,255,0.08)' },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  listRowBorderTop: { borderTopWidth: 1, borderTopColor: Colors.border },
  curCode: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text, width: 44 },
  curName: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text2 },
  rateInfo: {
    margin: Spacing.md,
    padding: 10,
    backgroundColor: 'rgba(108,71,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.2)',
  },
  rateText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: Colors.primary3, textAlign: 'center' },
  rateSubText: { fontSize: 10, fontFamily: 'Outfit_400Regular', color: Colors.text4, textAlign: 'center', marginTop: 3 },

  // Boutique info
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, gap: Spacing.md },
  infoKey: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3 },
  infoVal: { flex: 1, textAlign: 'right', fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },

  // Toggles
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 48 },
  toggleLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },
  testNotifBtn: { margin: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: 'rgba(108,71,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', alignItems: 'center' },
  testNotifText: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: Colors.primary3 },

  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  actionTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.25)',
  },
  logoutTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.danger },
})
