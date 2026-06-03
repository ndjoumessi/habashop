import { logger } from '@/lib/logger'
import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Pressable, Alert, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, useTheme } from '@/stores/appStore'
import { Spacing, BorderRadius, FontSize, withAlpha, ThemeColors } from '@/constants/theme'
import { accountApi, apiErrorStatus } from '@/services/api'
import type { TenantUser } from '@/types'
import { purgeLocalAccountData } from '@/services/accountCleanup'
import AccessibleButton from '@/components/ui/AccessibleButton'

type Scope = 'tenant' | 'user'

export default function DeleteAccountScreen() {
  const { i } = useI18n()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const { user, logout } = useAuthStore()
  const queryClient = useQueryClient()

  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [scope, setScope] = useState<Scope | null>(null)
  const [scopeLoading, setScopeLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Anticipation du scope (indicatif ; le backend tranche pour de vrai) ──
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const role = user?.role
      if (role === 'SUPER_ADMIN') { if (mounted) { setScope('tenant'); setScopeLoading(false) } ; return }
      if (role !== 'ADMIN')       { if (mounted) { setScope('user');   setScopeLoading(false) } ; return }
      // ADMIN → besoin du nombre d'autres ADMIN actifs du tenant
      try {
        const users = await accountApi.tenantUsers()
        const others = (Array.isArray(users) ? users : []).filter(
          (u: TenantUser) => u?.role === 'ADMIN' && !u?.deletedAt && u?.id !== user?.id,
        ).length
        if (mounted) setScope(others === 0 ? 'tenant' : 'user')
      } catch (e) {
        // Fallback PRUDENT décidé : on sous-vend (scope user = "la boutique survit").
        logger.warn('[delete-account] GET /api/tenant/users a échoué, fallback scope=user', e)
        if (mounted) setScope('user')
      } finally {
        if (mounted) setScopeLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.role, user?.id])

  const isTenantScope = scope === 'tenant'
  const isAdminLeaving = scope === 'user' && user?.role === 'ADMIN'

  const title = isTenantScope
    ? i('Supprimer la boutique', 'Delete the shop', 'Eliminar la tienda', 'Elimina il negozio')
    : isAdminLeaving
      ? i('Quitter la boutique', 'Leave the shop', 'Abandonar la tienda', 'Lascia il negozio')
      : i('Supprimer mon compte', 'Delete my account', 'Eliminar mi cuenta', 'Elimina il mio account')

  const warning = isTenantScope
    ? i(
        'Vous allez supprimer la boutique et toutes ses données : produits, ventes, employés, clients. Cette action est irréversible.',
        'You are about to delete the shop and all its data: products, sales, employees, customers. This action is irreversible.',
        'Vas a eliminar la tienda y todos sus datos: productos, ventas, empleados, clientes. Esta acción es irreversible.',
        'Stai per eliminare il negozio e tutti i suoi dati: prodotti, vendite, dipendenti, clienti. Questa azione è irreversibile.',
      )
    : isAdminLeaving
      ? i(
          'Vous allez quitter la boutique. Vos données personnelles seront effacées. La boutique et les autres administrateurs ne sont pas affectés.',
          'You are about to leave the shop. Your personal data will be erased. The shop and other administrators are not affected.',
          'Vas a abandonar la tienda. Tus datos personales serán borrados. La tienda y los demás administradores no se ven afectados.',
          'Stai per lasciare il negozio. I tuoi dati personali saranno cancellati. Il negozio e gli altri amministratori non sono interessati.',
        )
      : i(
          'Vous allez supprimer votre compte. Vos données personnelles seront effacées.',
          'You are about to delete your account. Your personal data will be erased.',
          'Vas a eliminar tu cuenta. Tus datos personales serán borrados.',
          'Stai per eliminare il tuo account. I tuoi dati personali saranno cancellati.',
        )

  const erased = [
    i('Nom, email, téléphone', 'Name, email, phone', 'Nombre, email, teléfono', 'Nome, email, telefono'),
    i('Photo de profil', 'Profile photo', 'Foto de perfil', 'Foto profilo'),
    i('Mot de passe', 'Password', 'Contraseña', 'Password'),
  ]
  const kept = [
    i("Historique des ventes (anonymisé)", 'Sales history (anonymized)', 'Historial de ventas (anonimizado)', 'Storico vendite (anonimizzato)'),
    i('Données comptables (obligations légales)', 'Accounting data (legal obligations)', 'Datos contables (obligaciones legales)', 'Dati contabili (obblighi legali)'),
  ]

  const confirmOk = confirmText.trim() === 'SUPPRIMER'
  const canSubmit = confirmOk && password.length > 0 && !submitting && !scopeLoading

  async function afterSuccess() {
    await purgeLocalAccountData()
    queryClient.clear()
    Alert.alert(
      i('Compte supprimé', 'Account deleted', 'Cuenta eliminada', 'Account eliminato'),
      i('Votre compte a été supprimé.', 'Your account has been deleted.', 'Tu cuenta ha sido eliminada.', 'Il tuo account è stato eliminato.'),
      [{ text: 'OK', onPress: () => { logout() } }], // logout → guard (app)/_layout redirige vers login
    )
  }

  async function doDelete() {
    setSubmitting(true)
    try {
      await accountApi.deleteMe({ confirmation: 'SUPPRIMER', password })
      await afterSuccess()
    } catch (e: unknown) {
      const status = apiErrorStatus(e)
      if (status === 410) { await afterSuccess(); return } // déjà supprimé = succès silencieux
      setSubmitting(false)
      if (status === 401) {
        Alert.alert(i('Mot de passe incorrect', 'Incorrect password', 'Contraseña incorrecta', 'Password errata'))
      } else if (status === 400) {
        Alert.alert(i('Confirmation invalide', 'Invalid confirmation', 'Confirmación inválida', 'Conferma non valida'))
      } else if (status === 429) {
        Alert.alert(i('Trop de tentatives. Réessayez plus tard.', 'Too many attempts. Try again later.', 'Demasiados intentos. Inténtalo más tarde.', 'Troppi tentativi. Riprova più tardi.'))
      } else {
        Alert.alert(i('Une erreur est survenue. Réessayez.', 'An error occurred. Try again.', 'Se produjo un error. Inténtalo de nuevo.', 'Si è verificato un errore. Riprova.'))
      }
    }
  }

  function confirmThenDelete() {
    Alert.alert(
      i('Action irréversible', 'Irreversible action', 'Acción irreversible', 'Azione irreversibile'),
      i('Cette action est irréversible. Continuer ?', 'This action is irreversible. Continue?', 'Esta acción es irreversible. ¿Continuar?', 'Questa azione è irreversibile. Continuare?'),
      [
        { text: i('Annuler', 'Cancel', 'Cancelar', 'Annulla'), style: 'cancel' },
        { text: i('Oui, supprimer', 'Yes, delete', 'Sí, eliminar', 'Sì, elimina'), style: 'destructive', onPress: doDelete },
      ],
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.headerBtn} onPress={() => router.back()} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={i('Retour', 'Back', 'Atrás', 'Indietro')}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.warnBox}>
          <Ionicons name="warning" size={22} color={C.danger} />
          {scopeLoading ? (
            <View style={s.scopeLoading}>
              <ActivityIndicator color={C.danger} />
              <Text style={s.warnTxt}>{i('Vérification…', 'Checking…', 'Verificando…', 'Verifica…')}</Text>
            </View>
          ) : (
            <Text style={s.warnTxt}>{warning}</Text>
          )}
        </View>

        <Text style={s.listTitle}>{i('Sera effacé', 'Will be erased', 'Se borrará', 'Sarà cancellato')}</Text>
        {erased.map((t, idx) => (
          <View key={`e${idx}`} style={s.bullet}>
            <Ionicons name="close-circle" size={16} color={C.danger} />
            <Text style={s.bulletTxt}>{t}</Text>
          </View>
        ))}
        <Text style={s.listTitle}>{i('Sera conservé', 'Will be kept', 'Se conservará', 'Sarà conservato')}</Text>
        {kept.map((t, idx) => (
          <View key={`k${idx}`} style={s.bullet}>
            <Ionicons name="shield-checkmark" size={16} color={C.text3} />
            <Text style={s.bulletTxt}>{t}</Text>
          </View>
        ))}

        <Text style={s.fieldLabel}>{i('Mot de passe', 'Password', 'Contraseña', 'Password')}</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor={C.text3}
          accessibilityLabel={i('Mot de passe', 'Password', 'Contraseña', 'Password')}
        />

        <Text style={s.fieldLabel}>
          {i('Tapez SUPPRIMER pour confirmer', 'Type SUPPRIMER to confirm', 'Escribe SUPPRIMER para confirmar', 'Digita SUPPRIMER per confermare')}
        </Text>
        <TextInput
          style={[s.input, confirmText.length > 0 && !confirmOk && s.inputErr]}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="SUPPRIMER"
          placeholderTextColor={C.text3}
          accessibilityLabel={i('Texte de confirmation', 'Confirmation text', 'Texto de confirmación', 'Testo di conferma')}
        />

        <AccessibleButton
          label={i('Supprimer définitivement', 'Delete permanently', 'Eliminar definitivamente', 'Elimina definitivamente')}
          variant="danger"
          onPress={confirmThenDelete}
          loading={submitting}
          disabled={!canSubmit}
          style={{ marginTop: Spacing.xxl }}
        />
      </ScrollView>
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerBtn: { width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: C.bg3, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  body: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  warnBox: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: withAlpha(C.danger, 0.1), borderColor: withAlpha(C.danger, 0.3), borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  scopeLoading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  warnTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text, lineHeight: 20 },
  listTitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.md },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bulletTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text2, flex: 1 },
  fieldLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  input: { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text },
  inputErr: { borderColor: C.danger },
  deleteBtn: { backgroundColor: C.danger, borderRadius: BorderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xxl },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
})
