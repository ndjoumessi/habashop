import { useEffect, useMemo, useState, useCallback } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n, useTheme, useFmt } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'
import { getFailedSales, dismissFailedSale, type FailedSale } from '@/services/failedSales'

/**
 * Bandeau des ventes ENCAISSÉES mais JAMAIS ENREGISTRÉES.
 *
 * ⚠️ Ce n'est PAS un toast : un toast disparaît, or l'argent est dans le tiroir. Le
 * bandeau reste tant qu'un humain n'a pas soldé chaque ligne. C'est ce qui remplace
 * l'ancien `logger.error` — invisible en release, donc équivalent à une perte muette.
 *
 * Il ne réenregistre RIEN : il montre le montant encaissé et le motif du serveur pour
 * permettre une RESSAISIE. Recréer la vente automatiquement serait une invention
 * comptable (le serveur a refusé pour une raison qui n'a pas disparu).
 */
const i4 = (lang: string, fr: string, en: string, es: string, it: string) =>
  ({ fr, en, es, it }[lang as 'fr'] ?? fr)

export default function FailedSalesBanner({ refreshKey }: { refreshKey?: number }) {
  const { C } = useTheme()
  const { i, lang } = useI18n()
  const { fmt } = useFmt()
  const insets = useSafeAreaInsets()
  const s = useMemo(() => makeStyles(C), [C])
  const [list, setList] = useState<FailedSale[]>([])
  const [open, setOpen] = useState(false)

  const reload = useCallback(async () => { setList(await getFailedSales()) }, [])
  useEffect(() => { reload() }, [reload, refreshKey])

  if (list.length === 0) return null

  const total = list.reduce((sum, e) => sum + (e.total || 0), 0)

  const solder = async (id: string) => {
    await dismissFailedSale(id)
    const next = await getFailedSales()
    setList(next)
    if (next.length === 0) setOpen(false)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[s.wrap, { top: insets.top + Spacing.sm }]}
        accessibilityRole="button"
        accessibilityLabel={i4(lang,
          `${list.length} vente(s) encaissée(s) non enregistrée(s), toucher pour voir`,
          `${list.length} collected sale(s) not recorded, tap to view`,
          `${list.length} venta(s) cobrada(s) sin registrar, toca para ver`,
          `${list.length} vendita/e incassata/e non registrata/e, tocca per vedere`)}
      >
        <View style={s.banner}>
          <Ionicons name="alert-circle" size={18} color={C.white} />
          <Text style={s.txt} numberOfLines={2}>
            {list.length} {i('vente non enregistrée', 'sale not recorded', 'venta sin registrar', 'vendita non registrata')}
            {list.length > 1 ? 's' : ''} · {fmt(total)} — {i('à ressaisir', 'to re-enter', 'volver a introducir', 'da reinserire')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={C.white} />
        </View>
      </Pressable>

      {/* Modale on-demand (anti-crash Fabric : jamais montée en permanence). */}
      {open && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.sheetHead}>
                <Text style={s.sheetTitle}>
                  {i('Ventes non enregistrées', 'Unrecorded sales', 'Ventas sin registrar', 'Vendite non registrate')}
                </Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button"
                  accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
                  <Ionicons name="close" size={22} color={C.text2} />
                </Pressable>
              </View>

              <Text style={s.help}>
                {i(
                  "Ces montants ont été encaissés mais le serveur n'a pas pu enregistrer la vente. Ressaisissez-les, puis marquez-les comme traités.",
                  'These amounts were collected but the server could not record the sale. Re-enter them, then mark as handled.',
                  'Estos importes se cobraron pero el servidor no pudo registrar la venta. Vuelva a introducirlos y márquelos como tratados.',
                  'Questi importi sono stati incassati ma il server non ha potuto registrare la vendita. Reinseriscili, poi segnali come trattati.',
                )}
              </Text>

              <ScrollView style={s.scroll}>
                {list.map(e => (
                  <View key={e.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.amount}>{fmt(e.total)}</Text>
                      <Text style={s.reason} numberOfLines={2}>
                        {e.message ?? (e.reason === 'exhausted'
                          ? i('Réseau indisponible', 'Network unavailable', 'Red no disponible', 'Rete non disponibile')
                          : i('Refusée par le serveur', 'Rejected by server', 'Rechazada por el servidor', 'Rifiutata dal server'))}
                      </Text>
                      <Text style={s.meta}>{new Date(e.failedAt).toLocaleString()}</Text>
                    </View>
                    <Pressable onPress={() => solder(e.id)} style={s.done} accessibilityRole="button"
                      accessibilityLabel={i('Marquer comme traité', 'Mark as handled', 'Marcar como tratado', 'Segna come trattato')}>
                      <Ionicons name="checkmark" size={16} color={C.white} />
                      <Text style={s.doneTxt}>{i('Traité', 'Handled', 'Tratado', 'Trattato')}</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 1000 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg, backgroundColor: C.danger, ...Shadow.md,
  },
  txt: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.white },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md, maxHeight: '80%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  sheetTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_700Bold', color: C.text },
  help: { fontSize: FontSize.sm, color: C.text2, marginBottom: Spacing.md, lineHeight: 20 },
  scroll: { maxHeight: 340 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  amount: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold', color: C.text },
  reason: { fontSize: FontSize.sm, color: C.text2, marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: C.text3, marginTop: 2 },
  done: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: C.accent2,
  },
  doneTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.white },
})
