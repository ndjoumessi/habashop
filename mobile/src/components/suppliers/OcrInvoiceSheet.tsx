import { useMemo, useState, useEffect } from 'react'
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Share,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n, useTheme } from '@/stores/appStore'
import { useSupplierOcr } from '@/hooks/useSupplierOcr'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import { logger } from '@/lib/logger'

interface Props { onClose: () => void }

// Forme éditable : qty/unitPrice en chaînes (saisie TextInput), reconverties à la
// volée pour le récap partagé. Les montants sont dans la devise de la facture
// (inconnue côté app) → affichés bruts, JAMAIS via fmt() (qui suppose une base XOF).
interface EditableItem { name: string; qty: string; unitPrice: string }
interface EditableInvoice {
  supplierName: string
  invoiceDate: string
  items: EditableItem[]
  total: string
  notes: string
}

/**
 * Outil autonome « Scanner une facture » — 100 % lecture seule (AUCUNE écriture
 * backend). Photo/galerie → OCR → champs éditables → Partager (récap texte).
 * Monté ON-DEMAND (anti-crash Fabric, cf. CLAUDE.md).
 */
export default function OcrInvoiceSheet({ onClose }: Props) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const insets = useSafeAreaInsets()
  const { isLoading, error, result, scan, reset } = useSupplierOcr()

  const [form, setForm] = useState<EditableInvoice | null>(null)

  // Réhydrate le formulaire éditable à chaque nouveau résultat OCR.
  useEffect(() => {
    if (!result) { setForm(null); return }
    setForm({
      supplierName: result.supplierName ?? '',
      invoiceDate: result.invoiceDate ?? '',
      items: (result.items ?? []).map(it => ({
        name: it.name ?? '',
        qty: it.qty != null ? String(it.qty) : '',
        unitPrice: it.unitPrice != null ? String(it.unitPrice) : '',
      })),
      total: result.total != null ? String(result.total) : '',
      notes: result.notes ?? '',
    })
  }, [result])

  const setItem = (idx: number, patch: Partial<EditableItem>) =>
    setForm(f => f && { ...f, items: f.items.map((it, k) => (k === idx ? { ...it, ...patch } : it)) })
  const removeItem = (idx: number) =>
    setForm(f => f && { ...f, items: f.items.filter((_, k) => k !== idx) })

  const handleShare = async () => {
    if (!form) return
    const lines = [
      form.supplierName && `🧾 ${form.supplierName}`,
      form.invoiceDate && `📅 ${form.invoiceDate}`,
      '',
      ...form.items.map(it => `• ${it.name} ×${it.qty || '1'} @ ${it.unitPrice || '?'}`),
      '',
      form.total && `${i('Total', 'Total', 'Total', 'Totale')}: ${form.total}`,
      form.notes && `${i('Notes', 'Notes', 'Notas', 'Note')}: ${form.notes}`,
    ].filter(Boolean).join('\n')
    try {
      await Share.share({ message: lines })
    } catch (e) {
      logger.warn('OcrInvoiceSheet share failed:', e)
    }
  }

  // ── Contenu selon l'état ──
  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={s.loadingTxt}>{i('Analyse en cours…', 'Analysing…', 'Analizando…', 'Analisi in corso…')}</Text>
          <Text style={s.loadingSub}>{i('Lecture de la facture par IA', 'AI reading the invoice', 'Lectura de la factura por IA', 'Lettura della fattura tramite IA')}</Text>
        </View>
      )
    }

    if (error) {
      const msg = error === 'permission_denied'
        ? i('Autorisation refusée. Activez l\'accès caméra/photos dans les réglages du téléphone.',
            'Permission denied. Enable camera/photos access in your phone settings.',
            'Permiso denegado. Active el acceso a cámara/fotos en los ajustes del teléfono.',
            'Autorizzazione negata. Abilita l\'accesso a fotocamera/foto nelle impostazioni del telefono.')
        : error
      return (
        <View style={s.center}>
          <Text style={{ fontSize: 44 }}>⚠️</Text>
          <Text style={s.errorTxt}>{msg}</Text>
          <Pressable style={s.retryBtn} onPress={reset} accessibilityRole="button"
            accessibilityLabel={i('Réessayer', 'Retry', 'Reintentar', 'Riprova')}>
            <Ionicons name="refresh" size={16} color={C.white} />
            <Text style={s.retryTxt}>{i('Réessayer', 'Retry', 'Reintentar', 'Riprova')}</Text>
          </Pressable>
        </View>
      )
    }

    if (form) {
      return (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.xxxl }}
          keyboardShouldPersistTaps="handled">
          {result?.error === 'parse_error' && (
            <View style={s.warnBanner}>
              <Text style={s.warnTxt}>
                {i('Analyse incomplète — vérifiez et corrigez les articles.',
                   'Incomplete analysis — review and fix the items.',
                   'Análisis incompleto — revise y corrija los artículos.',
                   'Analisi incompleta — controlla e correggi gli articoli.')}
              </Text>
            </View>
          )}

          {/* Fournisseur + date */}
          <View style={s.field}>
            <Text style={s.label}>{i('Fournisseur', 'Supplier', 'Proveedor', 'Fornitore')}</Text>
            <TextInput style={s.input} value={form.supplierName}
              onChangeText={v => setForm(f => f && { ...f, supplierName: v })}
              placeholder="—" placeholderTextColor={C.text3} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>{i('Date', 'Date', 'Fecha', 'Data')}</Text>
            <TextInput style={s.input} value={form.invoiceDate}
              onChangeText={v => setForm(f => f && { ...f, invoiceDate: v })}
              placeholder="YYYY-MM-DD" placeholderTextColor={C.text3} />
          </View>

          {/* Articles */}
          <Text style={s.sectionLabel}>{i('Articles', 'Items', 'Artículos', 'Articoli')} ({form.items.length})</Text>
          {form.items.map((it, idx) => (
            <View key={idx} style={s.itemCard}>
              <View style={s.itemTopRow}>
                <TextInput style={[s.input, { flex: 1 }]} value={it.name}
                  onChangeText={v => setItem(idx, { name: v })}
                  placeholder={i('Nom de l\'article', 'Item name', 'Nombre del artículo', 'Nome articolo')} placeholderTextColor={C.text3} />
                <Pressable onPress={() => removeItem(idx)} hitSlop={8} style={s.removeBtn}
                  accessibilityRole="button" accessibilityLabel={i('Retirer', 'Remove', 'Quitar', 'Rimuovi')}>
                  <Ionicons name="close-circle" size={22} color={C.danger} />
                </Pressable>
              </View>
              <View style={s.itemBotRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.miniLabel}>{i('Qté', 'Qty', 'Cant.', 'Qtà')}</Text>
                  <TextInput style={s.input} value={it.qty} keyboardType="numeric"
                    onChangeText={v => setItem(idx, { qty: v })} placeholder="1" placeholderTextColor={C.text3} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Text style={s.miniLabel}>{i('Prix unitaire', 'Unit price', 'Precio unit.', 'Prezzo unit.')}</Text>
                  <TextInput style={s.input} value={it.unitPrice} keyboardType="numeric"
                    onChangeText={v => setItem(idx, { unitPrice: v })} placeholder="0" placeholderTextColor={C.text3} />
                </View>
              </View>
            </View>
          ))}

          {/* Total + notes */}
          <View style={s.field}>
            <Text style={s.label}>{i('Total', 'Total', 'Total', 'Totale')}</Text>
            <TextInput style={s.input} value={form.total} keyboardType="numeric"
              onChangeText={v => setForm(f => f && { ...f, total: v })}
              placeholder="0" placeholderTextColor={C.text3} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>{i('Notes', 'Notes', 'Notas', 'Note')}</Text>
            <TextInput style={[s.input, s.inputMulti]} value={form.notes}
              onChangeText={v => setForm(f => f && { ...f, notes: v })} multiline
              placeholder="—" placeholderTextColor={C.text3} />
          </View>

          {/* Actions */}
          <View style={s.actionsRow}>
            <Pressable style={[s.btn, s.btnGhost]} onPress={reset} accessibilityRole="button"
              accessibilityLabel={i('Recommencer', 'Start over', 'Reiniciar', 'Ricomincia')}>
              <Ionicons name="refresh" size={16} color={C.primary3} />
              <Text style={s.btnGhostTxt}>{i('Recommencer', 'Start over', 'Reiniciar', 'Ricomincia')}</Text>
            </Pressable>
            <Pressable style={[s.btn, s.btnPrimary]} onPress={handleShare} accessibilityRole="button"
              accessibilityLabel={i('Partager', 'Share', 'Compartir', 'Condividi')}>
              <Ionicons name="share-outline" size={16} color={C.white} />
              <Text style={s.btnPrimaryTxt}>{i('Partager', 'Share', 'Compartir', 'Condividi')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )
    }

    // État initial : choix de la source.
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48 }}>🧾</Text>
        <Text style={s.introTxt}>
          {i('Photographiez ou importez une facture fournisseur — l\'IA en extrait les articles.',
             'Take a photo or import a supplier invoice — AI extracts the items.',
             'Tome una foto o importe una factura de proveedor — la IA extrae los artículos.',
             'Scatta o importa una fattura fornitore — l\'IA ne estrae gli articoli.')}
        </Text>
        <Pressable style={[s.btn, s.btnPrimary, s.btnFull]} onPress={() => scan('camera')}
          accessibilityRole="button" accessibilityLabel={i('Prendre en photo', 'Take a photo', 'Tomar foto', 'Scatta foto')}>
          <Ionicons name="camera" size={18} color={C.white} />
          <Text style={s.btnPrimaryTxt}>📷 {i('Prendre en photo', 'Take a photo', 'Tomar foto', 'Scatta foto')}</Text>
        </Pressable>
        <Pressable style={[s.btn, s.btnGhost, s.btnFull]} onPress={() => scan('gallery')}
          accessibilityRole="button" accessibilityLabel={i('Choisir depuis la galerie', 'Choose from gallery', 'Elegir de la galería', 'Scegli dalla galleria')}>
          <Ionicons name="images-outline" size={18} color={C.primary3} />
          <Text style={s.btnGhostTxt}>🖼️ {i('Choisir depuis la galerie', 'Choose from gallery', 'Elegir de la galería', 'Scegli dalla galleria')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheet}>
        <View style={s.head}>
          <Text style={s.headTitle}>📄 {i('Scanner une facture', 'Scan an invoice', 'Escanear factura', 'Scansiona fattura')}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
            <Ionicons name="close" size={24} color={C.text} />
          </Pressable>
        </View>
        {renderBody()}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  sheet: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  headTitle: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  introTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text2, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  loadingTxt: { fontSize: FontSize.md, fontFamily: 'Geist_700Bold', color: C.text, marginTop: Spacing.sm },
  loadingSub: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3 },
  errorTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_600SemiBold', color: C.text2, textAlign: 'center', maxWidth: 300, lineHeight: 20 },

  warnBanner: { backgroundColor: withAlpha(C.warn, 0.12), borderWidth: 1, borderColor: withAlpha(C.warn, 0.3), borderRadius: BorderRadius.md, padding: Spacing.md },
  warnTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_600SemiBold', color: C.warn, lineHeight: 19 },

  field: { gap: Spacing.xs },
  label: { fontSize: FontSize.xs, fontFamily: 'Geist_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontSize: FontSize.sm, fontFamily: 'Geist_800ExtraBold', color: C.text, marginTop: Spacing.sm },
  miniLabel: { fontSize: FontSize.xs, fontFamily: 'Geist_600SemiBold', color: C.text3, marginBottom: 2 },
  input: { backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, fontFamily: 'Geist_400Regular', color: C.text },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },

  itemCard: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemBotRow: { flexDirection: 'row', gap: Spacing.sm },
  removeBtn: { padding: 2 },

  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 50, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg },
  btnFull: { alignSelf: 'stretch' },
  btnPrimary: { flex: 1, backgroundColor: C.primary, ...Shadow.sm },
  btnPrimaryTxt: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.white },
  btnGhost: { flex: 1, backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3) },
  btnGhostTxt: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.primary3 },

  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 46, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: C.primary, marginTop: Spacing.sm },
  retryTxt: { fontSize: FontSize.sm, fontFamily: 'Geist_800ExtraBold', color: C.white },
})
