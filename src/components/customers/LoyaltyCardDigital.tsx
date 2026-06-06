import { useMemo, useState, useEffect } from 'react'
import {
  View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import QRCode from 'qrcode'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { customersApi } from '@/services/api'
import type { LoyaltyCardData } from '@/types'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'
import { logger } from '@/lib/logger'
import type { LoyaltyTier } from '@/lib/loyalty'

const TIER_COLOR: Record<string, string> = {
  Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#FFD700',
}
const TIER_ICON: Record<string, string> = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' }

interface Props { customerId: string; onClose: () => void }

/**
 * Carte fidélité numérique — 100% OTA-safe (qrcode pur JS pour le QR, expo-print pour
 * le partage PDF). Montée ON-DEMAND (anti-crash Fabric).
 */
export default function LoyaltyCardDigital({ customerId, onClose }: Props) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const { fmt } = useFmt()
  const [qrUri, setQrUri] = useState<string>('')
  const [sharing, setSharing] = useState(false)

  const { data, isLoading } = useQuery<LoyaltyCardData>({
    queryKey: ['loyalty-card', customerId],
    queryFn: () => customersApi.loyaltyCard(customerId),
    staleTime: 60 * 1000,
  })

  const tier = (data?.tier ?? 'Bronze') as LoyaltyTier
  const color = TIER_COLOR[tier] ?? TIER_COLOR.Bronze
  const icon  = TIER_ICON[tier]  ?? '🥉'
  const qrValue = `HABA-${customerId.slice(0, 8).toUpperCase()}`

  // QR code : pur JS via qrcode (data URL PNG) — pas de module natif, OTA-safe.
  useEffect(() => {
    QRCode.toDataURL(qrValue, { width: 80, margin: 1, color: { dark: color, light: '#00000000' } })
      .then(setQrUri)
      .catch(() => {})
  }, [qrValue, color])

  const nextThreshold = tier === 'Bronze' ? (data?.bronzeThreshold ?? 2000)
    : tier === 'Silver' ? (data?.silverThreshold ?? 5000) : null
  const progress = nextThreshold && data
    ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100

  // Partage : génère un PDF via expo-print (déjà installé) puis expo-sharing.
  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    try {
      const html = buildCardHtml(data, qrUri, fmt, i)
      await Print.printAsync({ html })
    } catch (e: any) {
      // Annulation print = normale (utilisateur a fermé) → on ne logue qu'en erreur vraie.
      if (!String(e?.message).toLowerCase().includes('cancel')) {
        logger.warn('LoyaltyCardDigital share failed:', e)
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <View style={s.head}>
            <Text style={s.headTitle}>🎴 {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text3} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={s.loadingBox}><ActivityIndicator color={C.primary} /></View>
          ) : !data ? (
            <Text style={s.errorTxt}>⚠ {i('Erreur de chargement', 'Load error', 'Error de carga', 'Errore')}</Text>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {/* Carte */}
              <View style={[s.card, { borderColor: withAlpha(color, 0.4) }]}>
                <Text style={s.watermark}>{icon}</Text>

                {/* Ligne 1 : nom + QR */}
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{data.customerName}</Text>
                    <Text style={[s.cardId, { color }]}>{qrValue}</Text>
                  </View>
                  {qrUri ? (
                    <Image source={{ uri: qrUri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                  ) : <View style={{ width: 64, height: 64, backgroundColor: withAlpha(color, 0.1), borderRadius: 8 }} />}
                </View>

                {/* Points + palier */}
                <View style={s.ptsRow}>
                  <Text style={[s.ptsVal, { color }]}>{data.points.toLocaleString()}</Text>
                  <Text style={s.ptsUnit}>pts</Text>
                  <View style={[s.tierBadge, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.35) }]}>
                    <Text style={[s.tierTxt, { color }]}>{icon} {tier}</Text>
                  </View>
                </View>

                {/* Barre de progression */}
                {data.nextTier ? (
                  <View style={{ gap: 4 }}>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${progress}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={s.progressTxt}>{data.pointsToNext.toLocaleString()} pts → {data.nextTier}</Text>
                  </View>
                ) : (
                  <Text style={[s.maxTxt, { color }]}>🎉 {i('Niveau maximum !', 'Max level!', '¡Nivel máximo!', 'Livello massimo!')}</Text>
                )}

                <Text style={s.shopName}>{data.shopName} · habashop</Text>
              </View>

              {/* Action : imprimer / partager */}
              <Pressable
                style={[s.shareBtn, sharing && s.shareBtnBusy]}
                onPress={handleShare} disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel={i('Imprimer / Partager', 'Print / Share', 'Imprimir / Compartir', 'Stampa / Condividi')}>
                {sharing
                  ? <ActivityIndicator color={C.primary} />
                  : <><Ionicons name="print-outline" size={18} color={C.primary} />
                    <Text style={s.shareBtnTxt}>{i('Imprimer / Partager', 'Print / Share', 'Imprimir / Compartir', 'Stampa / Condividi')}</Text></>
                }
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

function buildCardHtml(
  data: LoyaltyCardData,
  qrUri: string,
  fmt: (n: number) => string,
  i: (fr: string, en: string, es: string, it: string) => string,
): string {
  const color = TIER_COLOR[data.tier] ?? '#CD7F32'
  const icon  = TIER_ICON[data.tier]  ?? '🥉'
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
  const nextThreshold = data.tier === 'Bronze' ? data.bronzeThreshold : data.tier === 'Silver' ? data.silverThreshold : null
  const progress = nextThreshold ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:-apple-system,sans-serif;background:#111;margin:0;padding:20px;display:flex;align-items:center;justify-content:center}
    .card{width:340px;min-height:200px;background:linear-gradient(135deg,#1a1a2e,#0d0d1a);border:2px solid ${color}44;border-radius:18px;padding:20px;position:relative;overflow:hidden;color:#fff}
    .wm{position:absolute;top:-10px;right:-10px;font-size:90px;opacity:0.07}
    .row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
    .name{font-size:18px;font-weight:900;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .id{font-size:10px;font-family:monospace;color:${color};margin-top:2px}
    .pts-row{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
    .pts{font-size:34px;font-weight:900;color:${color};font-family:monospace;letter-spacing:-1px}
    .badge{font-size:12px;font-weight:700;padding:2px 10px;background:${color}22;border:1px solid ${color}44;border-radius:20px;color:${color}}
    .bar-track{height:6px;background:#ffffff18;border-radius:99px;overflow:hidden;margin-bottom:4px}
    .bar-fill{height:100%;background:${color};border-radius:99px;width:${progress}%}
    .progress{font-size:10px;color:#fff7}
    .shop{font-size:10px;color:#fff5;text-transform:uppercase;letter-spacing:1px;margin-top:8px}
  </style></head><body>
  <div class="card">
    <div class="wm">${icon}</div>
    <div class="row">
      <div><div class="name">${esc(data.customerName)}</div><div class="id">HABA-${data.customerId.slice(0, 8).toUpperCase()}</div></div>
      ${qrUri ? `<img src="${qrUri}" width="64" height="64" style="border-radius:8px" alt="QR"/>` : ''}
    </div>
    <div class="pts-row">
      <span class="pts">${data.points.toLocaleString()}</span>
      <span style="font-size:13px;color:#fff9">pts</span>
      <span class="badge">${icon} ${esc(data.tier)}</span>
    </div>
    ${data.nextTier ? `<div class="bar-track"><div class="bar-fill"></div></div><div class="progress">${data.pointsToNext.toLocaleString()} pts → ${data.nextTier}</div>` : ''}
    <div class="shop">${esc(data.shopName)} · habashop</div>
  </div>
  </body></html>`
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha('#000000', 0.6), justifyContent: 'center', padding: Spacing.lg },
  box: { backgroundColor: C.bg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  loadingBox: { height: 100, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: BorderRadius.xl, borderWidth: 2, padding: Spacing.md, gap: Spacing.sm, overflow: 'hidden' },
  watermark: { position: 'absolute', top: -8, right: -8, fontSize: 80, opacity: 0.07 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardName: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text, maxWidth: 200 },
  cardId: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  ptsRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, flexWrap: 'wrap' },
  ptsVal: { fontSize: FontSize.xxxl, fontFamily: 'JetBrainsMono_700Bold' },
  ptsUnit: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  tierBadge: { marginLeft: Spacing.xs, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  tierTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_800ExtraBold' },
  barTrack: { height: 7, backgroundColor: C.bg3, borderRadius: BorderRadius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: BorderRadius.full },
  progressTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3 },
  maxTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold' },
  shopName: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, textTransform: 'uppercase', letterSpacing: 1 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50, backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3), borderRadius: BorderRadius.md },
  shareBtnBusy: { opacity: 0.6 },
  shareBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.primary },
})
