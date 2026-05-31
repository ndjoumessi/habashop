import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, useTheme } from '@/stores/appStore'
import { authApi, apiErrorMessage } from '@/services/api'
import type { User, Tenant } from '@/types'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'
import AccessibleButton from '@/components/ui/AccessibleButton'
import {
  isBiometricAvailable, isBiometricEnabled, authenticateWithBiometric,
  enableBiometric, getSavedCredentials, type BiometricType,
} from '@/services/biometric'

// Les 5 comptes démo seedés dans le backend (mot de passe commun « demo1234 »).
// Un tap préremplit email + mot de passe → connexion réelle au backend Railway.
const DEMO_PASSWORD = 'demo1234'
const DEMO_ACCOUNTS = [
  { label: 'Admin',      email: 'admin@habashop.com' },
  { label: 'Manager',    email: 'manager@habashop.com' },
  { label: 'Caissier',   email: 'cashier@habashop.com' },
  { label: 'Comptable',  email: 'accountant@habashop.com' },
  { label: 'RH',         email: 'hr@habashop.com' },
] as const

export default function LoginScreen() {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { setAuth } = useAuthStore()
  const { i } = useI18n()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPwd, setShowPwd]   = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled,   setBiometricEnabled]   = useState(false)
  const [biometricType,      setBiometricType]      = useState<BiometricType>('unknown')
  const [showEnableBiometric, setShowEnableBiometric] = useState(false)
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: User; tenant: Tenant; email: string; password: string } | null>(null)
  const [usePassword, setUsePassword] = useState(false) // bascule "utiliser le mot de passe" quand biométrie active
  const biometricTriggered = useRef(false)              // évite le double déclenchement (StrictMode / remount)

  // ── Connexion par biométrie (identifiants sauvegardés) ──
  const handleBiometricLogin = async () => {
    const icon = biometricType === 'face' ? '🔐' : '👆'
    const success = await authenticateWithBiometric(
      i(`${icon} Connexion HabaShop`, `${icon} HabaShop Login`, `${icon} Acceso HabaShop`, `${icon} Accesso HabaShop`),
      i('Annuler', 'Cancel', 'Cancelar', 'Annulla'),
    )
    if (!success) return
    const creds = await getSavedCredentials()
    if (!creds) { setBiometricEnabled(false); return }
    setLoading(true)
    try {
      const data = await authApi.login(creds.email, creds.password)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      await setAuth(data.token, data.user, data.tenant)
    } catch {
      Alert.alert(
        i('Connexion échouée', 'Login failed', 'Error de acceso', 'Accesso fallito'),
        i('Session expirée. Connectez-vous manuellement.', 'Session expired. Please login manually.', 'Sesión expirada. Inicie sesión manualmente.', 'Sessione scaduta. Acceda manualmente.'),
      )
      setBiometricEnabled(false)
      setLoading(false)
    }
  }

  // Vérifie la biométrie au montage + auto-déclenche si activée.
  useEffect(() => {
    const checkBiometric = async () => {
      const { available, type, enrolled } = await isBiometricAvailable()
      const enabled = await isBiometricEnabled()
      setBiometricAvailable(available && enrolled)
      setBiometricEnabled(enabled)
      setBiometricType(type)
      if (available && enrolled && enabled && !biometricTriggered.current) {
        biometricTriggered.current = true
        handleBiometricLogin()
      }
    }
    checkBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        i('Champs requis','Required','Requerido','Obbligatorio'),
        i('Remplissez tous les champs.',
          'Fill in all fields.',
          'Complete todos los campos.',
          'Compila tutti i campi.')
      ); return
    }
    setLoading(true)
    try {
      const em = email.trim().toLowerCase()
      const data = await authApi.login(em, password)
      // Propose la biométrie si dispo & pas encore activée. On diffère setAuth :
      // sinon la redirection post-login démonte l'écran avant d'afficher la modale.
      const { available, enrolled } = await isBiometricAvailable()
      const enabled = await isBiometricEnabled()
      if (available && enrolled && !enabled) {
        setPendingAuth({ token: data.token, user: data.user, tenant: data.tenant, email: em, password })
        setShowEnableBiometric(true)
        setLoading(false)
        return
      }
      await setAuth(data.token, data.user, data.tenant)
    } catch (err: unknown) {
      Alert.alert(
        i('Connexion échouée','Login failed','Error de acceso','Accesso fallito'),
        apiErrorMessage(err) ??
          i('Email ou mot de passe incorrect.',
            'Invalid email or password.',
            'Email o contraseña incorrectos.',
            'Email o password errati.')
      )
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.flex}
      behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoIcon}>
            <Text style={{fontSize:40}}>🛍️</Text>
          </View>
          <Text style={s.logoText}>HabaShop</Text>
          <Text style={s.logoSub}>
            {i('Gestion commerciale pour l\'Afrique',
               'Business management for Africa',
               'Gestión comercial para África',
               'Gestione commerciale per l\'Africa')}
          </Text>
        </View>

        {/* Carte */}
        <View style={s.card}>
          <Text style={s.title}>
            {i('Se connecter','Sign in','Iniciar sesión','Accedi')}
          </Text>

          {biometricAvailable && biometricEnabled && !usePassword ? (
            // ── Vue biométrique : AUCUN champ mot de passe affiché ──
            <>
              <TouchableOpacity
                style={s.biometricBtn}
                onPress={handleBiometricLogin}
                accessibilityRole="button"
                accessibilityLabel={i(
                  biometricType === 'face' ? 'Connexion par Face ID' : 'Connexion par empreinte',
                  biometricType === 'face' ? 'Sign in with Face ID' : 'Sign in with fingerprint',
                  biometricType === 'face' ? 'Acceder con Face ID' : 'Acceder con huella',
                  biometricType === 'face' ? 'Accedi con Face ID' : 'Accedi con impronta',
                )}
              >
                <Text style={s.biometricIcon}>{biometricType === 'face' ? '🔐' : '👆'}</Text>
                <Text style={s.biometricText}>
                  {i(
                    biometricType === 'face' ? 'Se connecter avec Face ID' : 'Se connecter avec l\'empreinte',
                    biometricType === 'face' ? 'Sign in with Face ID' : 'Sign in with fingerprint',
                    biometricType === 'face' ? 'Acceder con Face ID' : 'Acceder con huella dactilar',
                    biometricType === 'face' ? 'Accedi con Face ID' : 'Accedi con impronta digitale',
                  )}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.usePasswordLink}
                onPress={() => setUsePassword(true)}
                accessibilityRole="button"
                accessibilityLabel={i('Utiliser le mot de passe', 'Use password', 'Usar contraseña', 'Usa la password')}
              >
                <Text style={s.usePasswordTxt}>
                  {i('Utiliser le mot de passe', 'Use password', 'Usar contraseña', 'Usa la password')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // ── Formulaire email + mot de passe ──
            <>
              <View style={s.field}>
                <Text style={s.label}>Email</Text>
                <TextInput style={s.input}
                  placeholder="admin@habashop.com"
                  placeholderTextColor={C.text4}
                  value={email} onChangeText={setEmail}
                  autoCapitalize="none" keyboardType="email-address"
                  autoComplete="email" returnKeyType="next"
                  accessibilityLabel="Email"
                  accessibilityHint={i('Entrez votre adresse email','Enter your email address','Ingrese su email','Inserisci la tua email')}/>
              </View>

              <View style={s.field}>
                <Text style={s.label}>
                  {i('Mot de passe','Password','Contraseña','Password')}
                </Text>
                <View style={{position:'relative'}}>
                  <TextInput style={[s.input,{paddingRight:48}]}
                    placeholder="••••••••"
                    placeholderTextColor={C.text4}
                    value={password} onChangeText={setPassword}
                    secureTextEntry={!showPwd}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    accessibilityLabel={i('Mot de passe','Password','Contraseña','Password')}
                    accessibilityHint={i('Entrez votre mot de passe','Enter your password','Ingrese su contraseña','Inserisci la password')}/>
                  <TouchableOpacity
                    style={s.eyeBtn}
                    onPress={()=>setShowPwd(v=>!v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={showPwd
                      ? i('Masquer le mot de passe','Hide password','Ocultar contraseña','Nascondi password')
                      : i('Afficher le mot de passe','Show password','Mostrar contraseña','Mostra password')}>
                    <Text style={{fontSize:16}}>
                      {showPwd?'🙈':'👁️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <AccessibleButton
                label={i('Se connecter','Sign in','Iniciar sesión','Accedi')}
                onPress={handleLogin}
                loading={loading}
              />

              <View style={s.demoWrap}>
                <Text style={s.demoLabel}>
                  {i('Comptes démo :','Demo accounts:','Cuentas demo:','Account demo:')}
                </Text>
                <View style={s.demoRow}>
                  {DEMO_ACCOUNTS.map(acc => (
                    <TouchableOpacity
                      key={acc.email}
                      style={s.demoChip}
                      onPress={() => { setEmail(acc.email); setPassword(DEMO_PASSWORD) }}
                      accessibilityRole="button"
                      accessibilityLabel={i(
                        `Préremplir le compte démo ${acc.label}`,
                        `Prefill ${acc.label} demo account`,
                        `Rellenar la cuenta demo ${acc.label}`,
                        `Precompila l'account demo ${acc.label}`,
                      )}>
                      <Text style={s.demoChipTxt}>{acc.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={s.flags}>🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇬🇳 🇨🇲</Text>

        <Modal visible={showEnableBiometric} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEnableBiometric(false)}>
          <View style={s.biometricModal}>
            <Text style={s.biometricModalIcon}>{biometricType === 'face' ? '🔐' : '👆'}</Text>
            <Text style={s.biometricModalTitle}>
              {i(
                biometricType === 'face' ? 'Activer Face ID ?' : 'Activer l\'empreinte ?',
                biometricType === 'face' ? 'Enable Face ID?' : 'Enable fingerprint login?',
                biometricType === 'face' ? '¿Activar Face ID?' : '¿Activar huella dactilar?',
                biometricType === 'face' ? 'Attivare Face ID?' : 'Attivare l\'impronta digitale?',
              )}
            </Text>
            <Text style={s.biometricModalDesc}>
              {i(
                'Connectez-vous en un instant à chaque ouverture.',
                'Sign in instantly every time you open the app.',
                'Inicie sesión al instante cada vez que abra la app.',
                'Acceda istantaneamente ogni volta che apre l\'app.',
              )}
            </Text>
            <TouchableOpacity
              style={s.biometricModalBtn}
              accessibilityRole="button"
              accessibilityLabel={i('Activer', 'Enable', 'Activar', 'Attiva')}
              onPress={async () => {
                if (!pendingAuth) { setShowEnableBiometric(false); return }
                await enableBiometric(pendingAuth.email, pendingAuth.password)
                setShowEnableBiometric(false)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
                await setAuth(pendingAuth.token, pendingAuth.user, pendingAuth.tenant)
              }}
            >
              <Text style={s.biometricModalBtnText}>{i('Activer', 'Enable', 'Activar', 'Attiva')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.biometricModalSkip}
              accessibilityRole="button"
              accessibilityLabel={i('Pas maintenant', 'Not now', 'Ahora no', 'Non ora')}
              onPress={async () => {
                setShowEnableBiometric(false)
                if (pendingAuth) await setAuth(pendingAuth.token, pendingAuth.user, pendingAuth.tenant)
              }}
            >
              <Text style={s.biometricModalSkipText}>{i('Pas maintenant', 'Not now', 'Ahora no', 'Non ora')}</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  flex:{flex:1,backgroundColor:C.bg},
  container:{flexGrow:1,padding:Spacing.xl,
    justifyContent:'center',gap:Spacing.xl},
  logoWrap:{alignItems:'center',gap:Spacing.sm},
  logoIcon:{
    width:80,height:80,borderRadius:24,
    backgroundColor:C.primary,
    alignItems:'center',justifyContent:'center',
    ...Shadow.colored(C.primary),
  },
  logoText:{
    fontSize:FontSize.xxxl,fontFamily:'Outfit_900Black',
    color:C.text,
  },
  logoSub:{
    fontSize:FontSize.sm,fontFamily:'Outfit_400Regular',
    color:C.text3,textAlign:'center',
  },
  card:{
    backgroundColor:C.card,borderRadius:BorderRadius.xl,
    borderWidth:1,borderColor:C.border,
    padding:Spacing.xl,gap:Spacing.lg,...Shadow.md,
  },
  title:{
    fontSize:FontSize.xl,fontFamily:'Outfit_800ExtraBold',
    color:C.text,
  },
  field:{gap:Spacing.xs},
  label:{
    fontSize:FontSize.xs,fontFamily:'Outfit_700Bold',
    color:C.text3,textTransform:'uppercase',
    letterSpacing:0.5,
  },
  input:{
    backgroundColor:C.bg3,borderWidth:1,
    borderColor:C.border,borderRadius:BorderRadius.md,
    paddingHorizontal:Spacing.md,height:48,
    fontSize:FontSize.md,fontFamily:'Outfit_400Regular',
    color:C.text,
  },
  eyeBtn:{
    position:'absolute',right:Spacing.md,
    top:0,bottom:0,justifyContent:'center',
  },
  btn:{
    backgroundColor:C.primary,borderRadius:BorderRadius.md,
    height:52,alignItems:'center',justifyContent:'center',
    marginTop:Spacing.xs,...Shadow.colored(C.primary),
  },
  btnText:{
    fontSize:FontSize.md,fontFamily:'Outfit_800ExtraBold',
    color:C.white,letterSpacing:0.3,
  },
  demoWrap:{alignItems:'center',gap:Spacing.sm},
  demoLabel:{
    fontSize:FontSize.xs,fontFamily:'Outfit_400Regular',
    color:C.text3,
  },
  demoRow:{
    flexDirection:'row',flexWrap:'wrap',
    justifyContent:'center',gap:Spacing.xs,
  },
  demoChip:{
    paddingHorizontal:Spacing.md,paddingVertical:6,
    borderRadius:BorderRadius.full,
    backgroundColor:C.bg3,borderWidth:1,borderColor:C.border,
  },
  demoChipTxt:{
    fontSize:FontSize.xs,fontFamily:'Outfit_700Bold',
    color:C.primary3,
  },
  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg3,
  },
  biometricIcon: { fontSize: 22 },
  biometricText: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  usePasswordLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  usePasswordTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
  biometricModal: {
    flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xxxl, gap: Spacing.lg,
  },
  biometricModalIcon: { fontSize: 72 },
  biometricModalTitle: { fontSize: FontSize.xxl, fontFamily: 'Outfit_900Black', color: C.text, textAlign: 'center' },
  biometricModalDesc: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', lineHeight: 24 },
  biometricModalBtn: { width: '100%', backgroundColor: C.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center' },
  biometricModalBtnText: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
  biometricModalSkip: { paddingVertical: Spacing.md },
  biometricModalSkipText: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text3 },
  flags:{textAlign:'center',fontSize:20,letterSpacing:6},
})
