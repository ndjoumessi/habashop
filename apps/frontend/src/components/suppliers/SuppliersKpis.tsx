import { t } from '@/stores/appStore'
import { Factory, CheckCircle, Truck, Star } from 'lucide-react'
import { ratingValue, ratingCaption, type RatingSummary } from '@/lib/ratingSummary'

interface Props {
  total: number
  actifs: number
  // `null` = commandes pas (encore) connues → « — ». Un 0 affirmerait « aucune commande
  // en cours », ce qui était faux en permanence tant que ce KPI comptait sur un tableau vide (#214).
  enCours: number | null
  /**
   * ⚠️ Le RÉSUMÉ, pas une chaîne pré-formatée : la moyenne ne se rend jamais sans son
   * effectif évalué (cf. `lib/ratingSummary`). Le composant recevait `avgRating: string`,
   * ce qui rendait le dénominateur structurellement impossible à afficher.
   */
  ratingSummary: RatingSummary
  lang: string
}

export default function SuppliersKpis({ total, actifs, enCours, ratingSummary, lang }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: t('suppliers_total'),           value: total.toString(),   color: 'var(--p2)',   hex: '#6C47FF', icon: <Factory       size={18} /> },
        { label: t('suppliers_active'),          value: actifs.toString(),  color: 'var(--acc2)', hex: '#00D084', icon: <CheckCircle   size={18} /> },
        { label: t('suppliers_pending_orders'),  value: enCours === null ? '—' : enCours.toString(), color: 'var(--acc)',  hex: '#FF9500', icon: <Truck         size={18} /> },
        // ⚠️ `sub` = l'effectif ÉVALUÉ. Sans lui, « 4,2/5 » se lit comme portant sur tous
        // les fournisseurs, alors qu'il ne porte que sur ceux qui ont une note.
        { label: t('suppliers_avg_rating'),      value: ratingValue(ratingSummary), color: 'var(--acc)',  hex: '#FF9500', icon: <Star          size={18} />, sub: ratingCaption(ratingSummary, lang, 'fournisseurs') },
      ].map((k: { label: string; value: string; color: string; hex: string; icon: React.ReactNode; sub?: string }) => (
        <div key={k.label} className="kpi-card" style={{
          background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
          border: `1px solid ${k.hex}28`,
          position: 'relative', overflow: 'hidden',
          transition: 'transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s',
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 12px 36px ${k.hex}22` }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' }}>
          <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
          <div className="kpi-icon-w" style={{ color: k.color, background: `${k.hex}20` }}>{k.icon}</div>
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          {k.sub && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginTop: 4 }}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}
