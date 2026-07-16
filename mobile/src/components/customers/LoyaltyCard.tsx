import { useMemo } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { customersApi } from '@/services/api'
import type { Customer, LoyaltyResponse } from '@/types'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { loyaltyConfig, tierForPoints, nextTierFor, progressToNext, discountForTierDisplay, type LoyaltyTier } from '@/lib/loyalty'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'

// Couleurs/emoji par palier (miroir du web LoyaltyCard).
const TIER_META: Record<LoyaltyTier, { color: string; icon: string }> = {
  Bronze: { color: '#CD7F32', icon: '🥉' },
  Silver: { color: '#A8A9AD', icon: '🥈' },
  Gold:   { color: '#FFD700', icon: '🥇' },
}
const TIER_EMOJI: Record<LoyaltyTier, string> = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' }

/**
 * Carte fidélité honnête (miroir web). Affiche le solde + palier CANONIQUE (lu via
 * GET /api/customers/:id/loyalty), la progression vers le prochain seuil, et la règle
 * RÉELLE — taux et seuils CONFIGURABLES par tenant (remises « à venir », AUCUNE promesse).
 * Lecture seule : aucune logique fidélité côté mobile (dérivation de palier = affichage).
 */
export default function LoyaltyCard({ customer }: { customer: Customer }) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const { fmt } = useFmt()
  const { tenant } = useAuthStore()

  const { data, isLoading } = useQuery<LoyaltyResponse>({
    queryKey: ['loyalty', customer.id],
    queryFn: () => customersApi.loyalty(customer.id),
    staleTime: 60 * 1000,
  })

  // Config fidélité du tenant : la réponse /loyalty (la plus fraîche, a servi à calculer
  // `tier`) prime ; sinon le tenant en store ; sinon les défauts v1 (1000/2000/5000).
  const cfg = loyaltyConfig({
    pointsPerAmount: data?.pointsPerAmount ?? tenant?.pointsPerAmount,
    bronzeThreshold: data?.bronzeThreshold ?? tenant?.bronzeThreshold,
    silverThreshold: data?.silverThreshold ?? tenant?.silverThreshold,
  })

  // Solde : réponse backend si dispo, sinon le loyaltyPoints déjà chargé (fallback offline).
  const points = data?.points ?? customer.loyaltyPoints ?? 0
  // Palier : canonique backend si présent, sinon dérivé du solde avec les seuils du tenant.
  const tier = (data?.tier as LoyaltyTier) ?? tierForPoints(points, cfg.bronzeThreshold, cfg.silverThreshold)
  // Remise v2 du palier actuel (0 = non configurée → « à venir »).
  const discountPct = discountForTierDisplay(
    tier,
    data?.bronzeDiscount ?? tenant?.bronzeDiscount ?? 0,
    data?.silverDiscount ?? tenant?.silverDiscount ?? 0,
    data?.goldDiscount   ?? tenant?.goldDiscount   ?? 0,
  )
  const meta = TIER_META[tier] ?? TIER_META.Bronze
  const next = nextTierFor(tier, cfg.bronzeThreshold, cfg.silverThreshold)
  const progress = next ? progressToNext(points, next.threshold) : 100
  const history = data?.history ?? []
  // Libellés des seuils pour « Comment ça marche » (Silver = bronzeThreshold, Gold = silverThreshold).
  const silverPts = cfg.bronzeThreshold.toLocaleString()
  const goldPts = cfg.silverThreshold.toLocaleString()

  return (
    <View style={s.wrap}>
      <Text style={s.cardLabel}>🎁 {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}</Text>

      {/* Solde + palier */}
      <View style={[s.card, { borderColor: withAlpha(meta.color, 0.35) }]}>
        {isLoading ? (
          <View style={s.loadingRow}><ActivityIndicator color={meta.color} /></View>
        ) : (
          <>
            <View style={s.ptsRow}>
              <Text style={[s.ptsVal, { color: meta.color }]}>{points.toLocaleString()}</Text>
              <Text style={s.ptsUnit}>pts</Text>
              <View style={[s.tierBadge, { backgroundColor: withAlpha(meta.color, 0.12), borderColor: withAlpha(meta.color, 0.3) }]}>
                <Text style={[s.tierTxt, { color: meta.color }]}>{meta.icon} {tier}</Text>
              </View>
            </View>

            {next ? (
              <>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${progress}%`, backgroundColor: meta.color }]} />
                </View>
                <Text style={s.progressTxt}>
                  {(next.threshold - points).toLocaleString()} {i('pts pour passer', 'pts to reach', 'pts para alcanzar', 'pts per raggiungere')} {next.nextTier} {TIER_EMOJI[next.nextTier]}
                </Text>
              </>
            ) : (
              <Text style={[s.maxTxt, { color: meta.color }]}>🎉 {i('Niveau maximum atteint !', 'Maximum level reached!', '¡Nivel máximo alcanzado!', 'Livello massimo raggiunto!')}</Text>
            )}
          </>
        )}
      </View>

      {/* Comment ça marche — règle RÉELLE, sans promesse de remise */}
      <View style={s.infoCard}>
        <Text style={s.infoHead}>{i('Comment ça marche', 'How it works', 'Cómo funciona', 'Come funziona')}</Text>
        <Text style={s.infoLine}>⭐ {i(`1 point par tranche de ${fmt(cfg.pointsPerAmount)} dépensé`, `1 point per ${fmt(cfg.pointsPerAmount)} spent`, `1 punto por cada ${fmt(cfg.pointsPerAmount)} gastado`, `1 punto ogni ${fmt(cfg.pointsPerAmount)} speso`)}</Text>
        <Text style={s.infoLine}>🏅 {i(
          `Paliers : Bronze · Silver (${silverPts} pts) · Gold (${goldPts} pts)`,
          `Tiers: Bronze · Silver (${silverPts} pts) · Gold (${goldPts} pts)`,
          `Niveles: Bronze · Silver (${silverPts} pts) · Gold (${goldPts} pts)`,
          `Livelli: Bronze · Silver (${silverPts} pts) · Gold (${goldPts} pts)`,
        )}</Text>
        {discountPct > 0
          ? <Text style={[s.infoLine, { color: C.accent2 }]}>🎁 {i(
              `Remise ${discountPct} % sur vos achats`,
              `${discountPct}% discount on your purchases`,
              `Descuento del ${discountPct}% en sus compras`,
              `Sconto del ${discountPct}% sugli acquisti`,
            )}</Text>
          : <Text style={s.infoSoon}>🎁 {i('Récompenses & remises : à venir', 'Rewards & discounts: coming soon', 'Recompensas y descuentos: próximamente', 'Premi e sconti: in arrivo')}</Text>
        }
      </View>

      {/* Historique des points (gains / retraits) */}
      {history.length > 0 && (
        <View style={s.infoCard}>
          <Text style={s.infoHead}>{i('Historique des points', 'Points history', 'Historial de puntos', 'Cronologia punti')}</Text>
          {history.slice(0, 6).map((h, idx) => {
            const earn = (h.points ?? 0) >= 0
            return (
              <View key={h.id ?? idx} style={s.histRow}>
                <Text style={s.histLabel} numberOfLines={1}>
                  {earn ? i('Vente', 'Sale', 'Venta', 'Vendita') : i('Remboursement', 'Refund', 'Reembolso', 'Rimborso')}
                  {h.createdAt ? ` · ${fmtDay(h.createdAt)}` : ''}
                </Text>
                <Text style={[s.histPts, { color: earn ? C.accent2 : C.danger }]}>{earn ? '+' : ''}{h.points} pts</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { gap: Spacing.sm },
  cardLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: C.card, borderRadius: BorderRadius.lg, borderWidth: 2, padding: Spacing.md, gap: Spacing.sm },
  loadingRow: { height: 40, alignItems: 'center', justifyContent: 'center' },
  ptsRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, flexWrap: 'wrap' },
  ptsVal: { fontSize: FontSize.xxxl, fontFamily: 'JetBrainsMono_700Bold' },
  ptsUnit: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  tierBadge: { marginLeft: Spacing.xs, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  tierTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_800ExtraBold' },

  barTrack: { height: 8, backgroundColor: C.bg3, borderRadius: BorderRadius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: BorderRadius.full },
  progressTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3 },
  maxTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold' },

  infoCard: { backgroundColor: C.bg3, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.xs },
  infoHead: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoLine: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text2, lineHeight: 20 },
  infoSoon: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, fontStyle: 'italic', lineHeight: 20 },

  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  histLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  histPts: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold' },
})
