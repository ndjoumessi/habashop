import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Pressable, Switch, Alert,
} from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, useI18n, useFmt, useTheme, type Lang, type ThemeMode } from '@/stores/appStore'
import { sendLocalNotification } from '@/services/notifications'
import { useProfilePhoto } from '@/hooks/useProfilePhoto'
import Avatar from '@/components/ui/Avatar'
import { isBiometricAvailable, isBiometricEnabled, disableBiometric, type BiometricType } from '@/services/biometric'
import { isWidgetEnabled, setWidgetEnabled, refreshWidget, dismissWidget } from '@/services/widgetNotification'
import { registerWidgetRefresh, unregisterWidgetRefresh } from '@/tasks/backgroundRefresh'
import {
  Spacing, BorderRadius, FontSize, Shadow, withAlpha, ThemeColors,
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  )
}

export default function SettingsScreen() {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const { user, tenant, logout, isLoading } = useAuthStore()
  const { i, lang } = useI18n()
  const { fmt, currency } = useFmt()
  const setLang = useAppStore(st => st.setLang)
  const setCurrency = useAppStore(st => st.setCurrency)
  const setCurrencyManuallySet = useAppStore(st => st.setCurrencyManuallySet)
  const theme = useAppStore(st => st.theme)
  const setTheme = useAppStore(st => st.setTheme)
  const setKioskMode = useAppStore(st => st.setKioskMode)
  const qc = useQueryClient()
  const { photoUri, loading: photoLoading, pickPhoto, takePhoto, removePhoto } = useProfilePhoto()

  const [notifStock, setNotifStock] = useState(true)
  const [notifSales, setNotifSales] = useState(true)
  const [notifTrial, setNotifTrial] = useState(true)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricType, setBiometricType] = useState<BiometricType>('fingerprint')
  const [widgetEnabled, setWidget] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { available, type, enrolled } = await isBiometricAvailable()
      setBiometricAvailable(available && enrolled)
      setBiometricEnabled(await isBiometricEnabled())
      setBiometricType(type)
      setWidget(await isWidgetEnabled())
    }
    load()
  }, [])

  const status = tenant?.status ?? 'active'
  const statusColor = status === 'suspended' ? C.danger : status === 'trial' ? C.warn : C.accent2

  const THEMES: { key: ThemeMode; icon: string; label: string }[] = [
    { key: 'dark',   icon: '🌙', label: i('Sombre', 'Dark', 'Oscuro', 'Scuro') },
    { key: 'light',  icon: '☀️', label: i('Clair', 'Light', 'Claro', 'Chiaro') },
    { key: 'system', icon: '📱', label: i('Système', 'System', 'Sistema', 'Sistema') },
  ]

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
          {(isLoading || !user || !tenant) ? (
            // Skeleton pendant l'hydratation user/tenant (évite le flash « U / — / STARTER »)
            <View style={s.profileCard}>
              <View style={s.skelAvatar} />
              <View style={{ flex: 1, gap: Spacing.sm }}>
                <View style={[s.skelBar, { width: '55%' }]} />
                <View style={[s.skelBar, { width: '80%' }]} />
                <View style={[s.skelBar, { width: '45%' }]} />
              </View>
            </View>
          ) : (
            <View style={s.profileCard}>
              <Avatar
                name={user.name}
                photoUri={photoUri}
                size={64}
                loading={photoLoading}
                showEdit
                onPress={() => Alert.alert(
                  i('Photo de profil', 'Profile photo', 'Foto de perfil', 'Foto profilo'),
                  '',
                  [
                    { text: i('Galerie', 'Gallery', 'Galería', 'Galleria'), onPress: pickPhoto },
                    { text: i('Caméra', 'Camera', 'Cámara', 'Fotocamera'), onPress: takePhoto },
                    ...(photoUri ? [{ text: i('Supprimer', 'Remove', 'Eliminar', 'Rimuovi'), style: 'destructive' as const, onPress: removePhoto }] : []),
                    { text: i('Annuler', 'Cancel', 'Cancelar', 'Annulla'), style: 'cancel' as const },
                  ],
                )}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.profileName} numberOfLines={1}>{user.name}</Text>
                <Text style={s.profileEmail} numberOfLines={1}>{user.email}</Text>
                <View style={s.badgeRow}>
                  <View style={[s.badge, { backgroundColor: withAlpha(C.primary, 0.15), borderColor: withAlpha(C.primary, 0.3) }]}>
                    <Text style={[s.badgeTxt, { color: C.primary3 }]}>{tenant.plan.toUpperCase()}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: `${statusColor}1a`, borderColor: `${statusColor}40` }]}>
                    <Text style={[s.badgeTxt, { color: statusColor }]}>{status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* B) Langue */}
        <Section title={i('Langue', 'Language', 'Idioma', 'Lingua')}>
          <View style={s.grid2}>
            {LANGS.map(l => {
              const on = lang === l.code
              return (
                <Pressable key={l.code} style={[s.gridItem, on && s.gridItemOn]} onPress={() => handleSetLang(l.code)}
                  accessibilityRole="button" accessibilityState={{ selected: on }}
                  accessibilityLabel={`${i('Langue', 'Language', 'Idioma', 'Lingua')} ${l.label}`}>
                  <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                  <Text style={[s.gridLabel, on && s.gridLabelOn]}>{l.label}</Text>
                  {on && <Ionicons name="checkmark-circle" size={16} color={C.primary} style={s.gridCheck} />}
                </Pressable>
              )
            })}
          </View>
        </Section>

        {/* B2) Apparence — thème clair / sombre / système */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{i('Apparence', 'Appearance', 'Apariencia', 'Aspetto')}</Text>
          <View style={s.themeGrid}>
            {THEMES.map(t => {
              const on = theme === t.key
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    s.themeBtn,
                    { borderColor: on ? C.primary : C.border },
                    on && { backgroundColor: withAlpha(C.primary, 0.1) },
                  ]}
                  onPress={() => setTheme(t.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                  <Text style={[s.themeLabel, { color: on ? C.primary3 : C.text3 }]}>{t.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* C) Devise */}
        <Section title={i('Devise', 'Currency', 'Divisa', 'Valuta')}>
          {CURRENCIES.map((c, idx) => {
            const on = currency === c.code
            return (
              <Pressable
                key={c.code}
                style={[s.listRow, idx < CURRENCIES.length - 1 && s.listRowBorder, on && s.listRowOn]}
                onPress={() => { setCurrency(c.code); setCurrencyManuallySet(true) }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.code} ${i(c.fr, c.en, c.es, c.it)}`}
              >
                <Text style={[s.curCode, on && { color: C.primary3 }]}>{c.code}</Text>
                <Text style={s.curName} numberOfLines={1}>{i(c.fr, c.en, c.es, c.it)}</Text>
                {on && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
              </Pressable>
            )
          })}
          {currency !== 'XOF' && currency !== 'XAF' && (
            <View style={s.rateInfo}>
              <Text style={s.rateText}>💱 1 000 FCFA = {fmt(1000)}</Text>
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

        {/* C2) Caisse — mode kiosque */}
        <Section title={i('Caisse', 'Register', 'Caja', 'Cassa')}>
          <TouchableOpacity
            style={s.kioskBtn}
            accessibilityRole="button"
            accessibilityLabel={i('Mode kiosque caissier', 'Cashier kiosk mode', 'Modo kiosco cajero', 'Modalità kiosk cassiere')}
            onPress={() => Alert.alert(
              i('Mode kiosque', 'Kiosk mode', 'Modo kiosco', 'Modalità kiosk'),
              i(
                'Affichage caissier plein écran (grille + panier permanent). Code PIN pour quitter : 1234',
                'Full-screen cashier display (grid + permanent cart). PIN to exit: 1234',
                'Pantalla de cajero a pantalla completa (cuadrícula + carrito). PIN para salir: 1234',
                'Display cassiere a schermo intero (griglia + carrello). PIN per uscire: 1234',
              ),
              [
                { text: i('Annuler', 'Cancel', 'Cancelar', 'Annulla'), style: 'cancel' },
                {
                  text: i('Activer', 'Enable', 'Activar', 'Attiva'),
                  onPress: () => { setKioskMode(true); router.push('/(app)/kiosk') },
                },
              ],
            )}
          >
            <Text style={s.kioskBtnText}>
              🖥️ {i('Mode kiosque caissier', 'Cashier kiosk mode', 'Modo kiosco cajero', 'Modalità kiosk cassiere')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={C.text3} />
          </TouchableOpacity>
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
                trackColor={{ false: C.bg4, true: C.primary }}
                thumbColor={C.white}
                accessibilityRole="switch"
                accessibilityLabel={row.label}
              />
            </View>
          ))}
          <View style={[s.toggleRow, s.listRowBorderTop]}>
            <Text style={s.toggleLabel}>
              {i('Widget CA du jour', 'Daily revenue widget', 'Widget CA diario', 'Widget CA giornaliero')}
            </Text>
            <Switch
              value={widgetEnabled}
              accessibilityRole="switch"
              accessibilityLabel={i('Widget CA du jour', 'Daily revenue widget', 'Widget CA diario', 'Widget CA giornaliero')}
              onValueChange={async (val) => {
                setWidget(val)
                await setWidgetEnabled(val)
                if (val) {
                  await registerWidgetRefresh()
                  await refreshWidget(fmt, lang)
                } else {
                  await unregisterWidgetRefresh()
                  await dismissWidget()
                }
              }}
              trackColor={{ false: C.bg4, true: C.primary }}
              thumbColor={C.white}
            />
          </View>
          <TouchableOpacity
            style={s.testNotifBtn}
            accessibilityRole="button"
            accessibilityLabel={i('Tester les notifications', 'Test notifications', 'Probar notificaciones', 'Testa notifiche')}
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
          {biometricAvailable && (
            <View style={[s.toggleRow, s.listRowBorder]}>
              <Text style={s.toggleLabel}>
                {biometricType === 'face' ? 'Face ID' : i('Empreinte digitale', 'Fingerprint', 'Huella dactilar', 'Impronta digitale')}
              </Text>
              <Switch
                value={biometricEnabled}
                accessibilityRole="switch"
                accessibilityLabel={biometricType === 'face' ? 'Face ID' : i('Empreinte digitale', 'Fingerprint', 'Huella dactilar', 'Impronta digitale')}
                onValueChange={async (val) => {
                  if (!val) {
                    await disableBiometric()
                    setBiometricEnabled(false)
                  } else {
                    Alert.alert(
                      i('Reconnectez-vous', 'Please log in again', 'Vuelva a iniciar sesión', 'Acceda di nuovo'),
                      i('Déconnectez-vous puis reconnectez-vous pour activer la biométrie.', 'Log out and log back in to enable biometrics.', 'Cierre sesión y vuelva a iniciar para activar la biometría.', 'Disconnettersi e riaccedere per attivare la biometria.'),
                    )
                  }
                }}
                trackColor={{ false: C.bg4, true: C.primary }}
                thumbColor={C.white}
              />
            </View>
          )}
          <TouchableOpacity
            style={s.actionRow}
            accessibilityRole="button"
            accessibilityLabel={i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}
            onPress={() => Alert.alert(
              i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password'),
              i('Changez votre mot de passe sur habashop.vercel.app', 'Change your password on habashop.vercel.app', 'Cambie su contraseña en habashop.vercel.app', 'Cambia la password su habashop.vercel.app'),
            )}
          >
            <Ionicons name="key-outline" size={18} color={C.text2} />
            <Text style={s.actionTxt}>{i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.text3} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionRow, s.listRowBorderTop]}
            accessibilityRole="button"
            accessibilityLabel={i('Données & confidentialité', 'Data & privacy', 'Datos y privacidad', 'Dati e privacy')}
            onPress={() => Alert.alert(
              i('Données & confidentialité', 'Data & privacy', 'Datos y privacidad', 'Dati e privacy'),
              i('Vos données sont chiffrées et hébergées en Europe (RGPD). Export et suppression disponibles sur le web.', 'Your data is encrypted and hosted in Europe (GDPR). Export and deletion available on the web.', 'Sus datos están cifrados y alojados en Europa (RGPD). Exportación y eliminación en la web.', 'I tuoi dati sono crittografati e ospitati in Europa (GDPR). Esportazione ed eliminazione sul web.'),
            )}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={C.text2} />
            <Text style={s.actionTxt}>{i('Données & confidentialité', 'Data & privacy', 'Datos y privacidad', 'Dati e privacy')}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.text3} />
          </TouchableOpacity>
        </Section>

        {/* G) Application */}
        <Section title={i('Application', 'Application', 'Aplicación', 'Applicazione')}>
          <View style={s.infoRow}>
            <Text style={s.infoKey}>Version</Text>
            <Text style={s.infoVal}>1.2.0</Text>
          </View>
          <View style={[s.infoRow, s.listRowBorderTop]}>
            <Text style={s.infoKey}>Backend</Text>
            <Text style={s.infoVal} numberOfLines={1}>habashop-production.up.railway.app</Text>
          </View>
          <TouchableOpacity
            style={[s.actionRow, s.listRowBorderTop]}
            accessibilityRole="button"
            accessibilityLabel={i('Vider le cache', 'Clear cache', 'Vaciar caché', 'Svuota cache')}
            onPress={() => { qc.clear(); Alert.alert(i('✅ Cache vidé', '✅ Cache cleared', '✅ Caché vaciado', '✅ Cache svuotata'), '') }}
          >
            <Ionicons name="trash-bin-outline" size={18} color={C.text2} />
            <Text style={s.actionTxt}>{i('Vider le cache', 'Clear cache', 'Vaciar caché', 'Svuota cache')}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.text3} />
          </TouchableOpacity>
        </Section>

        {/* H) Déconnexion */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel={i('Se déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}
            onPress={() => Alert.alert(
              i('Déconnexion', 'Logout', 'Cerrar sesión', 'Disconnetti'),
              i('Voulez-vous vraiment vous déconnecter ?', 'Do you really want to log out?', '¿Seguro que desea cerrar sesión?', 'Vuoi davvero disconnetterti?'),
              [
                { text: i('Annuler', 'Cancel', 'Cancelar', 'Annulla'), style: 'cancel' },
                { text: i('Déconnexion', 'Logout', 'Cerrar sesión', 'Disconnetti'), style: 'destructive', onPress: () => logout() },
              ],
            )}
          >
            <Ionicons name="log-out-outline" size={20} color={C.danger} />
            <Text style={s.logoutTxt}>{i('Se déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}</Text>
          </TouchableOpacity>
        </View>

        {/* I) Compte — suppression (RGPD / Google Play) */}
        <Section title={i('Compte', 'Account', 'Cuenta', 'Account')}>
          <TouchableOpacity
            style={s.deleteAccountRow}
            accessibilityRole="button"
            accessibilityLabel={i('Supprimer mon compte', 'Delete my account', 'Eliminar mi cuenta', 'Elimina il mio account')}
            onPress={() => router.push('/(app)/delete-account')}
          >
            <Ionicons name="trash-outline" size={20} color={C.danger} />
            <Text style={s.deleteAccountTxt}>{i('Supprimer mon compte', 'Delete my account', 'Eliminar mi cuenta', 'Elimina il mio account')}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.danger} />
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  screenTitle: { fontSize: FontSize.xxl, fontFamily: 'Outfit_900Black', color: C.text, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },

  section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm },
  card: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden', ...Shadow.sm },

  // Profil
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border,
    padding: Spacing.lg, ...Shadow.sm,
  },
  avatar: {
    width: 60, height: 60, borderRadius: BorderRadius.lg,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored(C.primary),
  },
  avatarTxt: { fontSize: FontSize.xl, fontFamily: 'Outfit_900Black', color: C.white },
  profileName: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  profileEmail: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontFamily: 'Outfit_800ExtraBold', letterSpacing: 0.5 },

  // Langue grid 2x2
  grid2: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.sm, gap: Spacing.sm },
  gridItem: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: C.bg3, borderWidth: 1.5, borderColor: C.border, position: 'relative',
  },
  gridItemOn: { backgroundColor: withAlpha(C.primary, 0.12), borderColor: C.primary },
  gridLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  gridLabelOn: { color: C.primary3 },
  gridCheck: { position: 'absolute', top: 4, right: 4 },

  // Apparence (thème)
  themeGrid: { flexDirection: 'row', gap: Spacing.sm },
  themeBtn: {
    flex: 1, alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
    backgroundColor: C.card,
  },
  themeLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold' },

  // Caisse / kiosque
  kioskBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  kioskBtnText: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },

  // Devise / listes
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  listRowOn: { backgroundColor: withAlpha(C.primary, 0.08) },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  listRowBorderTop: { borderTopWidth: 1, borderTopColor: C.border },
  curCode: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.text, width: 44 },
  curName: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text2 },
  rateInfo: {
    margin: Spacing.md,
    padding: 10,
    backgroundColor: withAlpha(C.primary, 0.08),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: withAlpha(C.primary, 0.2),
  },
  rateText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: C.primary3, textAlign: 'center' },
  rateSubText: { fontSize: 10, fontFamily: 'Outfit_400Regular', color: C.text4, textAlign: 'center', marginTop: 3 },

  // Boutique info
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, gap: Spacing.md },
  infoKey: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  infoVal: { flex: 1, textAlign: 'right', fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },

  // Toggles
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 48 },
  toggleLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },
  testNotifBtn: { margin: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3), alignItems: 'center' },
  testNotifText: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.primary3 },

  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  actionTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },

  // Suppression de compte (ligne d'alerte)
  deleteAccountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  deleteAccountTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.danger },

  // Skeleton header (pendant l'hydratation user/tenant)
  skelAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bg3 },
  skelBar: { height: 14, borderRadius: BorderRadius.sm, backgroundColor: C.bg3 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: withAlpha(C.danger, 0.1), borderWidth: 1, borderColor: withAlpha(C.danger, 0.25),
  },
  logoutTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.danger },
})
