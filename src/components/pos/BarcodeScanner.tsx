import { useState, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
} from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'

interface BarcodeScannerProps {
  visible: boolean
  onScan:  (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({
  visible, onScan, onClose,
}: BarcodeScannerProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const lastScan = useRef<string>('')
  const lastScanTime = useRef<number>(0)
  // Taille réelle de la vue caméra (px) — pour situer `bounds` dans la frame.
  const camSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  // ── Region Of Interest logicielle ──
  // expo-camera n'expose PAS de `regionOfInterest` natif, mais chaque scan
  // renvoie `bounds` (origine + taille du code dans la frame). On rejette donc
  // toute lecture dont le centre tombe HORS du viseur central → évite de
  // capturer un code voisin (emballage adjacent, produit à côté).
  const withinROI = (bounds?: BarcodeScanningResult['bounds']): boolean => {
    const { w, h } = camSize.current
    if (!w || !h) return true                                  // pas encore mesuré → ne bloque pas
    if (!bounds || (!bounds.size.width && !bounds.size.height)) return true // bounds absentes (certains Android) → ne bloque pas
    const cx = bounds.origin.x + bounds.size.width / 2
    const cy = bounds.origin.y + bounds.size.height / 2
    return (
      cx >= ROI.x * w && cx <= (ROI.x + ROI.width) * w &&
      cy >= ROI.y * h && cy <= (ROI.y + ROI.height) * h
    )
  }

  const handleBarcode = ({ data, bounds }: BarcodeScanningResult) => {
    // Cooldown 1.5 s : ignore les frames partielles/transitoires que ML Kit
    // décode mal juste après un scan accepté (lectures fantômes).
    const now = Date.now()
    if (scanned || now - lastScanTime.current < SCAN_COOLDOWN_MS || data === lastScan.current) return
    if (!withinROI(bounds)) return // code hors du viseur central → ignoré
    lastScan.current = data
    lastScanTime.current = now
    setScanned(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onScan(data)
    setTimeout(() => { setScanned(false); lastScan.current = '' }, 2000)
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
          <Text style={s.title}>{i('Scanner', 'Scan', 'Escanear', 'Scansiona')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <CameraView
          style={s.camera}
          facing="back"
          barcodeScannerSettings={{
            // Restreint aux codes produits réels (EAN/Code128). Retiré : qr,
            // code39, upc_a/upc_e — leurs lectures parasites (codes prix, QR
            // d'emballage) polluaient la détection de l'EAN-13 principal.
            barcodeTypes: ['ean13', 'ean8', 'code128'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        >
          <View
            style={s.overlay}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout
              camSize.current = { w: width, h: height }
            }}
          >
            {/* Viseur centré (même fractions que ROI → guide visuel = zone réellement scannée) */}
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
                ? i('Produit trouvé !', 'Product found!', '¡Producto encontrado!', 'Prodotto trovato!')
                : i('Alignez le code ici', 'Align the barcode here', 'Alinee el código aquí', 'Allinea il codice qui')}
            </Text>
          </View>
        </CameraView>
      </View>
    </Modal>
  )
}

const SCAN_COOLDOWN_MS = 1500
// Viseur central, en fractions de la frame caméra. Sert À LA FOIS au rendu du
// rectangle (left/top/width/height en %) ET au filtre ROI logiciel (withinROI).
const ROI = { x: 0.1, y: 0.35, width: 0.8, height: 0.3 }
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
  closeBtnText: { color: C.white, fontSize: 16, fontFamily: 'Outfit_700Bold' },
  title: { color: C.white, fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: withAlpha(C.black, 0.25) },
  // Viseur : rectangle centré aux mêmes fractions que ROI (cf. const ROI).
  viewfinder: {
    position: 'absolute',
    left: pct(ROI.x), top: pct(ROI.y),
    width: pct(ROI.width), height: pct(ROI.height),
    borderWidth: 2, borderColor: withAlpha(C.primary, 0.5), borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  viewfinderLabel: {
    position: 'absolute', top: pct(ROI.y - 0.07), left: 0, right: 0,
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
  scanSuccessText: { color: C.white, fontSize: 28, fontFamily: 'Outfit_900Black' },
  permContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  permIcon: { fontSize: 60, marginBottom: Spacing.xl },
  permTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text, marginBottom: Spacing.md, textAlign: 'center' },
  permDesc: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', marginBottom: Spacing.xxl, lineHeight: 22 },
  permBtn: { backgroundColor: C.primary, paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  permBtnText: { color: C.white, fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold' },
  permClose: { paddingVertical: Spacing.md },
  permCloseText: { color: C.text3, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular' },
})
