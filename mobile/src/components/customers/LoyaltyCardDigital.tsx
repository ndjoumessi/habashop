import { useMemo, useState } from 'react'
import {
  View, Text, Modal, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import QRCode from 'qrcode'
import * as Print from 'expo-print'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { customersApi } from '@/services/api'
import type { LoyaltyCardData, LoyaltyResponse } from '@/types'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'
import { logger } from '@/lib/logger'
import { discountForTierDisplay, type LoyaltyTier } from '@/lib/loyalty'

// Design carte = web (zone haute sombre par palier / zone basse fond thème).
// Bronze = specs web ; Silver/Gold déclinés sur le même schéma dark/mid/accent.
const TIER_CFG: Record<string, { dark: string; mid: string; accent: string; icon: string }> = {
  Bronze: { dark: '#1C1007', mid: '#3D2010', accent: '#F5A623', icon: '🥉' },
  Silver: { dark: '#121216', mid: '#2B2B33', accent: '#C8CAD3', icon: '🥈' },
  Gold:   { dark: '#1A1402', mid: '#3D3200', accent: '#FFD700', icon: '🥇' },
}

// Noms de palier traduits (miroir web TIER_NAMES) — fr/en/es/it. Le backend renvoie
// toujours l'enum brut 'Bronze'/'Silver'/'Gold' → on traduit à l'affichage seulement.
const TIER_NAMES: Record<string, [string, string, string, string]> = {
  Bronze: ['Bronze', 'Bronze', 'Bronce', 'Bronzo'],
  Silver: ['Argent', 'Silver', 'Plata', 'Argento'],
  Gold:   ['Or', 'Gold', 'Oro', 'Oro'],
}
const tierName = (t: string, i: (fr: string, en: string, es: string, it: string) => string): string => {
  const n = TIER_NAMES[t]
  return n ? i(n[0], n[1], n[2], n[3]) : t
}

// Largeur visée du QR dans le cadre blanc 64×64 ; le reste sert de zone de silence.
const QR_AREA = 54

interface Props { customerId: string; onClose: () => void }

/**
 * QR en JS PUR (OTA-safe) : `QRCode.create()` (PAS `toDataURL`, qui exige
 * `document.createElement('canvas')` → inexistant sous Hermes ⇒ rejette ⇒ QR vide).
 * On dérive la matrice de modules et on la rend en grille de <View>.
 */
function qrMatrix(value: string): boolean[][] | null {
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const size = qr.modules.size
    const data = qr.modules.data
    const rows: boolean[][] = []
    for (let r = 0; r < size; r++) {
      const row: boolean[] = []
      for (let c = 0; c < size; c++) row.push(!!data[r * size + c])
      rows.push(row)
    }
    return rows
  } catch (e) {
    logger.warn('qrMatrix failed:', e)
    return null
  }
}

// SVG inline pour le PDF (expo-print) — le webview rend le SVG sans dépendance native.
function qrSvg(cells: boolean[][] | null, dark: string): string {
  if (!cells) return ''
  const n = cells.length
  let rects = ''
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (cells[r][c]) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="56" height="56" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><g fill="${dark}">${rects}</g></svg>`
}

/**
 * Carte fidélité numérique — 100% OTA-safe (QR via `qrcode` pur JS rendu en <View>,
 * partage PDF via expo-print). Montée ON-DEMAND (anti-crash Fabric).
 */
export default function LoyaltyCardDigital({ customerId, onClose }: Props) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const [sharing, setSharing] = useState(false)

  const { data, isLoading } = useQuery<LoyaltyCardData>({
    queryKey: ['loyalty-card', customerId],
    queryFn: () => customersApi.loyaltyCard(customerId),
    staleTime: 60 * 1000,
  })
  // Historique + remises par palier (maquette 04 : paliers actuel/prochain + activité).
  // Endpoint distinct (/loyalty) — source la plus fraîche des remises tenant.
  const { data: loyalty } = useQuery<LoyaltyResponse>({
    queryKey: ['loyalty', customerId],
    queryFn: () => customersApi.loyalty(customerId),
    staleTime: 60 * 1000,
  })

  const tier = (data?.tier ?? 'Bronze') as LoyaltyTier
  const cfg = TIER_CFG[tier] ?? TIER_CFG.Bronze
  const qrValue = `HABA-CUST:${customerId}`

  // Remises par palier (affichage) — actuel + prochain, via config tenant (loyalty response).
  const tierPct = (t: string | null | undefined): number => t
    ? discountForTierDisplay(t as LoyaltyTier, loyalty?.bronzeDiscount ?? 0, loyalty?.silverDiscount ?? 0, loyalty?.goldDiscount ?? 0)
    : 0
  const currentPct = tierPct(tier)
  const nextPct = tierPct(data?.nextTier)
  const history = loyalty?.history ?? []

  // Matrice QR (pur JS, synchrone, OTA-safe) → grille <View> + SVG du PDF.
  const qrCells = useMemo(() => qrMatrix(qrValue), [qrValue])
  const module = qrCells ? Math.max(2, Math.floor(QR_AREA / qrCells.length)) : 2

  const nextThreshold = tier === 'Bronze' ? (data?.bronzeThreshold ?? 2000)
    : tier === 'Silver' ? (data?.silverThreshold ?? 5000) : null
  const progress = nextThreshold && data
    ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100

  // Partage : génère un PDF via expo-print (déjà installé).
  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    try {
      const html = buildCardHtml(data, qrSvg(qrCells, cfg.dark), i)
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
              {/* ── Carte hero (maquette 04) — teinte FIXE par palier (artefact : la carte
                  s'exporte en PDF, ses couleurs ne suivent donc PAS le thème). Dégradé
                  approximé par un aplat teinté (pas d'expo-linear-gradient → OTA-safe). ── */}
              <View style={[s.hero, { backgroundColor: cfg.mid, borderColor: withAlpha(cfg.accent, 0.35) }]}>
                <Text style={s.watermark}>{cfg.icon}</Text>

                <View style={s.heroTop}>
                  <Text style={s.heroLabel}>{i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}</Text>
                  <View style={[s.tierBadge, { backgroundColor: withAlpha(cfg.accent, 0.16), borderColor: withAlpha(cfg.accent, 0.4) }]}>
                    <Text style={[s.tierTxt, { color: cfg.accent }]}>{cfg.icon} {tierName(tier, i)}</Text>
                  </View>
                </View>

                <View style={s.heroMid}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{data.customerName}</Text>
                    <View style={s.ptsRow}>
                      <Text style={s.ptsVal}>{data.points.toLocaleString()}</Text>
                      <Text style={s.ptsUnit}>{i('points', 'points', 'puntos', 'punti')}</Text>
                    </View>
                  </View>
                  {/* QR dans un cadre blanc — grille de modules (pur JS, OTA-safe) */}
                  <View style={s.qrBox}>
                    {qrCells ? (
                      <View style={s.qrGrid}>
                        {qrCells.map((row, r) => (
                          <View key={r} style={s.qrRow}>
                            {row.map((dark, c) => (
                              <View key={c} style={{ width: module, height: module, backgroundColor: dark ? cfg.dark : '#FFFFFF' }} />
                            ))}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={s.qrFallback} numberOfLines={2}>{qrValue}</Text>
                    )}
                  </View>
                </View>

                {data.nextTier ? (
                  <View style={{ marginTop: Spacing.md, gap: 6 }}>
                    <View style={s.progRow}>
                      <Text style={s.progTxt}>{data.pointsToNext.toLocaleString()} {i("pts jusqu'à", 'pts to', 'pts hasta', 'pts fino a')} {tierName(data.nextTier, i)}</Text>
                      <Text style={s.progTxt}>{data.points.toLocaleString()} / {(nextThreshold ?? 0).toLocaleString()}</Text>
                    </View>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${progress}%` as any, backgroundColor: cfg.accent }]} />
                    </View>
                  </View>
                ) : (
                  <Text style={[s.maxTxt, { color: cfg.accent, marginTop: Spacing.md }]}>🎉 {i('Niveau maximum !', 'Max level!', '¡Nivel máximo!', 'Livello massimo!')}</Text>
                )}
              </View>

              {/* ── Paliers actuel / prochain (maquette 04) ── */}
              <View style={s.tierCardsRow}>
                <View style={s.tierCard}>
                  <Text style={s.tierCardLabel}>{i('Palier actuel', 'Current tier', 'Nivel actual', 'Livello attuale')}</Text>
                  <Text style={s.tierCardVal}>{tierName(tier, i)}{currentPct > 0 ? ` · ${currentPct}%` : ''}</Text>
                  <Text style={s.tierCardSub}>{currentPct > 0 ? i('de remise', 'discount', 'de descuento', 'di sconto') : i('sans remise', 'no discount', 'sin descuento', 'senza sconto')}</Text>
                </View>
                <View style={s.tierCard}>
                  <Text style={s.tierCardLabel}>{i('Prochain palier', 'Next tier', 'Próximo nivel', 'Prossimo livello')}</Text>
                  {data.nextTier ? (
                    <>
                      <Text style={[s.tierCardVal, { color: cfg.accent }]}>{tierName(data.nextTier, i)}{nextPct > 0 ? ` · ${nextPct}%` : ''}</Text>
                      <Text style={s.tierCardSub}>{i('à', 'at', 'a', 'a')} {(nextThreshold ?? 0).toLocaleString()} pts</Text>
                    </>
                  ) : (
                    <Text style={[s.tierCardVal, { color: cfg.accent }]}>{i('Maximum', 'Maximum', 'Máximo', 'Massimo')}</Text>
                  )}
                </View>
              </View>

              {/* ── Activité récente (maquette 04) — historique serveur (gains/retraits) ── */}
              {history.length > 0 && (
                <View>
                  <Text style={s.sectionLabel}>{i('ACTIVITÉ RÉCENTE', 'RECENT ACTIVITY', 'ACTIVIDAD RECIENTE', 'ATTIVITÀ RECENTE')}</Text>
                  <View style={s.histCard}>
                    {history.slice(0, 6).map((h, idx, arr) => {
                      const earn = (h.points ?? 0) >= 0
                      return (
                        <View key={h.id ?? idx} style={[s.histRow, idx < arr.length - 1 && s.histRowBorder]}>
                          <Text style={s.histLabel} numberOfLines={1}>
                            {earn ? i('Vente', 'Sale', 'Venta', 'Vendita') : i('Remboursement', 'Refund', 'Reembolso', 'Rimborso')}
                            {h.createdAt ? ` · ${fmtDay(h.createdAt)}` : ''}
                          </Text>
                          <Text style={[s.histPts, { color: earn ? C.accent2 : C.danger }]}>{earn ? '+' : ''}{h.points} pts</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* Action : partager (PDF via expo-print) */}
              <Pressable
                style={[s.shareBtn, sharing && s.shareBtnBusy]}
                onPress={handleShare} disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel={i('Partager', 'Share', 'Compartir', 'Condividi')}>
                {sharing
                  ? <ActivityIndicator color={C.primary} />
                  : <><Ionicons name="share-outline" size={18} color={C.primary} />
                    <Text style={s.shareBtnTxt}>{i('Partager', 'Share', 'Compartir', 'Condividi')}</Text></>
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
  qrSvgMarkup: string,
  i: (fr: string, en: string, es: string, it: string) => string,
): string {
  const cfg = TIER_CFG[data.tier] ?? TIER_CFG.Bronze
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
  const nextThreshold = data.tier === 'Bronze' ? data.bronzeThreshold : data.tier === 'Silver' ? data.silverThreshold : null
  const progress = nextThreshold ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:-apple-system,sans-serif;background:#f4f4f8;margin:0;padding:20px;display:flex;align-items:center;justify-content:center}
    .card{width:340px;border:2px solid ${cfg.accent}59;border-radius:18px;overflow:hidden;background:#fff}
    .top{background:${cfg.dark};padding:18px 20px;position:relative;overflow:hidden;color:#fff}
    .wm{position:absolute;top:-10px;right:-10px;font-size:110px;opacity:0.06;line-height:1}
    .row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
    .badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 10px;background:${cfg.mid};border:1px solid ${cfg.accent}66;border-radius:20px;color:${cfg.accent};margin-bottom:6px}
    .name{font-size:18px;font-weight:900;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .id{font-size:10px;font-family:monospace;color:${cfg.accent};margin-top:2px}
    .qr{width:64px;height:64px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center}
    .pts-row{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
    .pts{font-size:28px;font-weight:900;color:#fff;font-family:monospace;letter-spacing:-1px}
    .shop{font-size:10px;color:#fff8;text-transform:uppercase;letter-spacing:1px}
    .bottom{padding:14px 20px;background:#fff;color:#222}
    .bar-track{height:6px;background:#00000014;border-radius:99px;overflow:hidden;margin-bottom:4px}
    .bar-fill{height:100%;background:${cfg.accent};border-radius:99px;width:${progress}%}
    .progress{font-size:10px;color:#0008;margin-bottom:10px}
    .stats{display:flex}
    .stat{flex:1}
    .stat+.stat{border-left:1px solid #00000014;padding-left:14px}
    .stat-label{font-size:9px;color:#0007;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    .stat-value{font-size:14px;font-weight:800;color:#222}
  </style></head><body>
  <div class="card">
    <div class="top">
      <div class="wm">${cfg.icon}</div>
      <div class="row">
        <div>
          <div class="badge">${cfg.icon} ${esc(tierName(data.tier, i))}</div>
          <div class="name">${esc(data.customerName)}</div>
          <div class="id">HABA-${data.customerId.slice(0, 8).toUpperCase()}</div>
        </div>
        <div class="qr">${qrSvgMarkup}</div>
      </div>
      <div class="pts-row">
        <span class="pts">${data.points.toLocaleString()}</span>
        <span style="font-size:13px;color:#fff9">pts</span>
      </div>
      <div class="shop">${esc(data.shopName)} · habashop</div>
    </div>
    <div class="bottom">
      ${data.nextTier
        ? `<div class="bar-track"><div class="bar-fill"></div></div><div class="progress">${data.pointsToNext.toLocaleString()} pts → ${esc(tierName(data.nextTier, i))}</div>`
        : `<div class="progress" style="color:${cfg.accent};font-weight:700">🎉 ${i('Niveau maximum !', 'Max level!', '¡Nivel máximo!', 'Livello massimo!')}</div>`}
      <div class="stats">
        <div class="stat">
          <div class="stat-label">${i('Prochain palier', 'Next tier', 'Próximo nivel', 'Prossimo livello')}</div>
          <div class="stat-value">${data.nextTier ? esc(tierName(data.nextTier, i)) : i('Maximum', 'Maximum', 'Máximo', 'Massimo')}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${i('Points restants', 'Points to go', 'Puntos restantes', 'Punti mancanti')}</div>
          <div class="stat-value">${data.nextTier ? data.pointsToNext.toLocaleString() : '—'}</div>
        </div>
      </div>
    </div>
  </div>
  </body></html>`
}

// Date courte JJ/MM (activité récente) — Hermes-safe (pas de toLocaleDateString).
function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha('#000000', 0.6), justifyContent: 'center', padding: Spacing.lg },
  // Maquette 04 — carte hero (aplat teinté par palier) + paliers + activité
  hero: { borderRadius: 18, borderWidth: 1, padding: Spacing.lg, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  heroLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: withAlpha('#FFFFFF', 0.7) },
  heroMid: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.sm },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: withAlpha('#FFFFFF', 0.7) },
  tierCardsRow: { flexDirection: 'row', gap: Spacing.sm },
  tierCard: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 2 },
  tierCardLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3 },
  tierCardVal: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold', color: C.text, marginTop: 2 },
  tierCardSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3, letterSpacing: 0.5, marginBottom: Spacing.sm },
  histCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  histRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  histLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text, flex: 1, marginRight: Spacing.sm },
  histPts: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold' },
  box: { backgroundColor: C.bg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  loadingBox: { height: 100, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger, textAlign: 'center' },

  watermark: { position: 'absolute', top: -10, right: -10, fontSize: 96, opacity: 0.06, lineHeight: 100 },
  tierBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  tierTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_800ExtraBold' },
  cardName: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', maxWidth: 200 },
  qrBox: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  qrGrid: { flexDirection: 'column' },
  qrRow: { flexDirection: 'row' },
  qrFallback: { fontSize: 9, fontFamily: 'JetBrainsMono_400Regular', color: '#1C1007', textAlign: 'center', paddingHorizontal: 2 },
  ptsRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  ptsVal: { fontSize: FontSize.xxxl, fontFamily: 'JetBrainsMono_700Bold', color: '#FFFFFF' },
  ptsUnit: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: withAlpha('#FFFFFF', 0.6) },
  barTrack: { height: 7, backgroundColor: withAlpha('#000000', 0.35), borderRadius: BorderRadius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: BorderRadius.full },
  maxTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold' },

  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50, backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3), borderRadius: BorderRadius.md },
  shareBtnBusy: { opacity: 0.6 },
  shareBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.primary },
})
