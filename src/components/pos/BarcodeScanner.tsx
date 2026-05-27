import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useI18n } from '@/stores/appStore'
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme'

interface BarcodeScannerProps {
  visible: boolean
  onScan:  (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({
  visible, onScan, onClose,
}: BarcodeScannerProps) {
  const { i } = useI18n()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const lastScan = useRef<string>('')

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned || data === lastScan.current) return // évite les doubles scans
    lastScan.current = data
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
            barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        >
          <View style={s.overlay}>
            <View style={s.overlayTop} />
            <View style={s.overlayMiddle}>
              <View style={s.overlaySide} />
              <View style={s.scanZone}>
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
              <View style={s.overlaySide} />
            </View>
            <View style={s.overlayBottom}>
              <Text style={s.hint}>
                {scanned
                  ? i('Produit trouvé !', 'Product found!', '¡Producto encontrado!', 'Prodotto trovato!')
                  : i(
                      'Pointez la caméra vers le code-barres',
                      'Point the camera at the barcode',
                      'Apunte la cámara al código de barras',
                      'Punta la fotocamera sul codice a barre',
                    )}
              </Text>
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  )
}

const SCAN_SIZE = 260
const CORNER_SIZE = 24
const CORNER_WIDTH = 3

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.md,
    backgroundColor: '#000',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Outfit_700Bold' },
  title: { color: '#fff', fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold' },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: SCAN_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanZone: { width: SCAN_SIZE, height: SCAN_SIZE, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: Spacing.xl },
  hint: {
    color: '#fff', fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular',
    textAlign: 'center', paddingHorizontal: Spacing.xl,
  },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.primary, borderWidth: CORNER_WIDTH },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: { position: 'absolute', width: SCAN_SIZE - 20, height: 2, backgroundColor: Colors.primary, opacity: 0.8 },
  scanSuccess: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.accent2,
    alignItems: 'center', justifyContent: 'center',
  },
  scanSuccessText: { color: '#fff', fontSize: 28, fontFamily: 'Outfit_900Black' },
  permContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  permIcon: { fontSize: 60, marginBottom: Spacing.xl },
  permTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: Colors.text, marginBottom: Spacing.md, textAlign: 'center' },
  permDesc: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: Colors.text3, textAlign: 'center', marginBottom: Spacing.xxl, lineHeight: 22 },
  permBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  permBtnText: { color: '#fff', fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold' },
  permClose: { paddingVertical: Spacing.md },
  permCloseText: { color: Colors.text3, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular' },
})
