import { useState, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
} from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'
import { normalizeBarcode } from '@/lib/barcode'

interface BarcodeScannerProps {
  visible: boolean
  onScan:  (barcode: string) => void
  onClose: () => void
  // 'product' (défaut) = code-barres EAN/Code128 ; 'customer' = QR de carte fidélité.
  mode?: 'product' | 'customer'
}

export default function BarcodeScanner({
  visible, onScan, onClose, mode = 'product',
}: BarcodeScannerProps) {
  const isCustomer = mode === 'customer'
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const lastScanTime = useRef<number>(0)
  // Dernière valeur lue, en attente de confirmation par une 2ᵉ lecture identique.
  const lastCandidate = useRef<string | null>(null)

  // ── Filtre de stabilité ──
  // Ce device Android renvoie des lectures qui changent à chaque frame (bounds
  // peu fiables, codes voisins captés au hasard). On n'accepte donc un code que
  // s'il est lu DEUX fois d'affilée à l'identique : un parasite aléatoire ne se
  // répète pas, seul le code réellement visé revient stable.
  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    // Cooldown 1.5 s après une lecture acceptée (anti double-scan).
    const now = Date.now()
    if (scanned || now - lastScanTime.current < SCAN_COOLDOWN_MS) return

    // Produit = code numérique → normalizeBarcode (espaces / zéros de tête).
    // Client = QR alphanumérique (HABA-…) → simple trim (ne PAS retirer les zéros de tête).
    const norm = isCustomer ? data.trim() : normalizeBarcode(data)
    if (norm === '') return
    if (norm !== lastCandidate.current) {
      lastCandidate.current = norm // 1ʳᵉ lecture (ou différente) → mémorise, attend confirmation
      return
    }
    // 2ᵉ lecture identique consécutive → accepté
    lastCandidate.current = null
    lastScanTime.current = now
    setScanned(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onScan(norm)
    setTimeout(() => { setScanned(false) }, 2000)
  }

  if (!visible) return null

  // Permission caméra non accordée
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.permContainer}>
          <Text style={s.permIcon}>📷</Text>
          <Text style={s.permTitle}>
            {i('Caméra requise', 'Camera required', 'Cámara requerida', 'Fotocamera richiesta')}
          </Text>
          <Text style={s.permDesc}>
            {i(
              'Autorisez l\'accès à la caméra pour scanner les codes-barres.',
              'Allow camera access to scan barcodes.',
              'Permita el acceso a la cámara para escanear códigos de barras.',
              'Consenti l\'accesso alla fotocamera per scansionare i codici a barre.',
            )}
          </Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel={i('Autoriser la caméra', 'Allow camera', 'Permitir cámara', 'Consenti fotocamera')}>
            <Text style={s.permBtnText}>{i('Autoriser', 'Allow', 'Permitir', 'Consenti')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.permClose} onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}>
            <Text style={s.permCloseText}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={i('Fermer le scanner', 'Close scanner', 'Cerrar escáner', 'Chiudi scanner')}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>{isCustomer
            ? i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')
            : i('Scanner', 'Scan', 'Escanear', 'Scansiona')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <CameraView
          style={s.camera}
          facing="back"
          barcodeScannerSettings={{
            // Mode client = QR de carte fidélité uniquement. Mode produit = codes
            // réels (EAN/Code128) ; retiré qr/code39/upc — leurs lectures parasites
            // (codes prix, QR d'emballage) polluaient la détection de l'EAN-13.
            barcodeTypes: isCustomer ? ['qr'] : ['ean13', 'ean8', 'code128'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        >
          <View style={s.overlay}>
            {/* Viseur visuel : guide l'utilisateur à centrer le code dans le cadre. */}
            <View style={s.viewfinder} pointerEvents="none">
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
              {!scanned && <View style={s.scanLine} />}
              {scanned && (
                <View style={s.scanSuccess}>
                  <Text style={s.scanSuccessText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={s.viewfinderLabel} pointerEvents="none">
              {scanned
                ? (isCustomer
                    ? i('Carte trouvée !', 'Card found!', '¡Tarjeta encontrada!', 'Carta trovata!')
                    : i('Produit trouvé !', 'Product found!', '¡Producto encontrado!', 'Prodotto trovato!'))
                : (isCustomer
                    ? i('Scannez la carte fidélité', 'Scan the loyalty card', 'Escanee la tarjeta de fidelidad', 'Scansiona la carta fedeltà')
                    : i('Alignez le code ici', 'Align the barcode here', 'Alinee el código aquí', 'Allinea il codice qui'))}
            </Text>
          </View>
        </CameraView>
      </View>
    </Modal>
  )
}

const SCAN_COOLDOWN_MS = 1500
// Fractions de la frame caméra pour positionner le viseur visuel (guide UX).
const VIEWFINDER = { x: 0.1, y: 0.35, width: 0.8, height: 0.3 }
// Fraction → pourcentage typé `${number}%` (DimensionValue de react-native).
const pct = (n: number) => `${n * 100}%` as `${number}%`
const CORNER_SIZE = 24
const CORNER_WIDTH = 3

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.md,
    backgroundColor: C.black,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: withAlpha(C.white, 0.15), alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: C.white, fontSize: FontSize.lg, fontFamily: 'Outfit_700Bold' },
  title: { color: C.white, fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: withAlpha(C.black, 0.25) },
  // Viseur : rectangle centré (cf. const VIEWFINDER).
  viewfinder: {
    position: 'absolute',
    left: pct(VIEWFINDER.x), top: pct(VIEWFINDER.y),
    width: pct(VIEWFINDER.width), height: pct(VIEWFINDER.height),
    borderWidth: 2, borderColor: withAlpha(C.primary, 0.5), borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  viewfinderLabel: {
    position: 'absolute', top: pct(VIEWFINDER.y - 0.07), left: 0, right: 0,
    color: C.white, fontSize: FontSize.md, fontFamily: 'Outfit_700Bold',
    textAlign: 'center', paddingHorizontal: Spacing.xl,
  },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: C.primary, borderWidth: CORNER_WIDTH },
  cornerTL: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: { position: 'absolute', width: '90%', height: 2, backgroundColor: C.primary, opacity: 0.8 },
  scanSuccess: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: C.accent2,
    alignItems: 'center', justifyContent: 'center',
  },
  scanSuccessText: { color: C.white, fontSize: 28, fontFamily: 'Outfit_800ExtraBold' },
  permContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  permIcon: { fontSize: 60, marginBottom: Spacing.xl },
  permTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text, marginBottom: Spacing.md, textAlign: 'center' },
  permDesc: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', marginBottom: Spacing.xxl, lineHeight: 22 },
  permBtn: { backgroundColor: C.primary, paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  permBtnText: { color: C.white, fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold' },
  permClose: { paddingVertical: Spacing.md },
  permCloseText: { color: C.text3, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular' },
})
