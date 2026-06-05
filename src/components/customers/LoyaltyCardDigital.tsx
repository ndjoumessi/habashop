import { useMemo, useRef, useState } from 'react'
import {
  View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { captureRef } from 'react-native-view-shot'
import { customersApi } from '@/services/api'
import type { LoyaltyCardData } from '@/types'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'
import { logger } from '@/lib/logger'
import type { LoyaltyTier } from '@/lib/loyalty'

const TIER_COLOR: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#A8A9AD',
  Gold:   '#FFD700',
}
const TIER_ICON: Record<string, string> = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' }

interface Props {
  customerId: string
  onClose: () => void
}

/**
 * Carte fidélité numérique — affiche le solde/palier/progression avec QR code encodant
 * l'ID client (HABA-XXXXXXXX). Partageable via expo-sharing (capture native via
 * react-native-view-shot). Monté ON-DEMAND (anti-crash Fabric).
 */
export default function LoyaltyCardDigital({ customerId, onClose }: Props) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const cardRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  const { data, isLoading } = useQuery<LoyaltyCardData>({
    queryKey: ['loyalty-card', customerId],
    queryFn: () => customersApi.loyaltyCard(customerId),
    staleTime: 60 * 1000,
  })

  const tier = (data?.tier ?? 'Bronze') as LoyaltyTier
  const color = TIER_COLOR[tier] ?? TIER_COLOR.Bronze
  const icon  = TIER_ICON[tier]  ?? '🥉'
  const nextThreshold = tier === 'Bronze' ? (data?.bronzeThreshold ?? 2000) : tier === 'Silver' ? (data?.silverThreshold ?? 5000) : null
  const progress = nextThreshold && data ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100
  const qrValue = `HABA-${customerId.slice(0, 8).toUpperCase()}`

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)
    try {
      // react-native-view-shot capture the card View as PNG.
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà') })
      }
    } catch (e) {
      logger.warn('LoyaltyCardDigital share failed:', e)
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
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text3} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={s.loadingBox}><ActivityIndicator color={C.primary} /></View>
          ) : !data ? (
            <Text style={s.errorTxt}>⚠ {i('Erreur de chargement', 'Load error', 'Error de carga', 'Errore')}</Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: Spacing.md }}>
              {/* ── Carte 340×200 ── */}
              <View ref={cardRef} style={[s.card, { borderColor: withAlpha(color, 0.4) }]}>
                {/* Watermark */}
                <Text style={s.watermark}>{icon}</Text>

                {/* Ligne 1 : nom + QR */}
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{data.customerName}</Text>
                    <Text style={[s.cardId, { color }]}>{qrValue}</Text>
                  </View>
                  <QRCode
                    value={qrValue}
                    size={64}
                    color={color}
                    backgroundColor="transparent"
                  />
                </View>

                {/* Ligne 2 : points + badge palier */}
                <View style={s.ptsRow}>
                  <Text style={[s.ptsVal, { color }]}>{data.points.toLocaleString()}</Text>
                  <Text style={s.ptsUnit}>pts</Text>
                  <View style={[s.tierBadge, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.35) }]}>
                    <Text style={[s.tierTxt, { color }]}>{icon} {tier}</Text>
                  </View>
                </View>

                {/* Barre de progression */}
                {data.nextTier && (
                  <View style={{ gap: 4 }}>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${progress}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={s.progressTxt}>{data.pointsToNext.toLocaleString()} pts → {data.nextTier}</Text>
                  </View>
                )}
                {!data.nextTier && (
                  <Text style={[s.maxTxt, { color }]}>🎉 {i('Niveau maximum !', 'Max level!', '¡Nivel máximo!', 'Livello massimo!')}</Text>
                )}

                {/* Boutique */}
                <Text style={s.shopName}>{data.shopName} · habashop</Text>
              </View>

              {/* Action : partager */}
              <Pressable
                style={[s.shareBtn, sharing && s.shareBtnBusy]}
                onPress={handleShare}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel={i('Partager la carte', 'Share card', 'Compartir tarjeta', 'Condividi carta')}
              >
                {sharing
                  ? <ActivityIndicator color={C.primary} />
                  : <><Ionicons name="share-social" size={18} color={C.primary} />
                    <Text style={s.shareBtnTxt}>{i('Partager la carte', 'Share card', 'Compartir tarjeta', 'Condividi carta')}</Text></>
                }
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha('#000000', 0.6), justifyContent: 'center', padding: Spacing.lg },
  box: { backgroundColor: C.bg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  loadingBox: { height: 100, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger, textAlign: 'center' },

  card: {
    backgroundColor: C.card, borderRadius: BorderRadius.xl, borderWidth: 2,
    padding: Spacing.md, gap: Spacing.sm, overflow: 'hidden',
  },
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
