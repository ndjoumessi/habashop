import { useState } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'

type Period = 'today' | '7days' | '30days' | '3months' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  today:    "Aujourd'hui",
  '7days':  '7 jours',
  '30days': '30 jours',
  '3months':'3 mois',
  year:     'Année',
}

const PERIOD_DATA: Record<Period, {
  ca: number; margin: number; transactions: number; avgCart: number
  caEvol: number; marginEvol: number; txEvol: number; cartEvol: number
}> = {
  today:    { ca: 485000,    margin: 142000,   transactions: 23,   avgCart: 21087, caEvol: 12.4,  marginEvol: 8.2,   txEvol: 15.0,  cartEvol: -2.1 },
  '7days':  { ca: 2840000,   margin: 854000,   transactions: 147,  avgCart: 19320, caEvol: 8.7,   marginEvol: 6.5,   txEvol: 5.2,   cartEvol: 3.3  },
  '30days': { ca: 12600000,  margin: 3780000,  transactions: 612,  avgCart: 20588, caEvol: 15.3,  marginEvol: 11.8,  txEvol: 9.4,   cartEvol: 5.4  },
  '3months':{ ca: 34200000,  margin: 10260000, transactions: 1820, avgCart: 18791, caEvol: 22.1,  marginEvol: 18.6,  txEvol: 14.2,  cartEvol: 6.9  },
  year:     { ca: 142000000, margin: 42600000, transactions: 7840, avgCart: 18112, caEvol: 31.5,  marginEvol: 27.2,  txEvol: 22.8,  cartEvol: 7.1  },
}

const CHART_DATA = [
  { day: 'Lun', val: 1840000, h: 55 },
  { day: 'Mar', val: 2150000, h: 65 },
  { day: 'Mer', val: 1620000, h: 49 },
  { day: 'Jeu', val: 2890000, h: 87 },
  { day: 'Ven', val: 3320000, h: 100 },
  { day: 'Sam', val: 2640000, h: 79 },
  { day: 'Dim', val: 1180000, h: 35 },
]

const PAYMENT_MODES = [
  { label: 'Espèces', pct: 62, color: 'var(--acc2)', amount: 7812000 },
  { label: 'Mobile',  pct: 28, color: 'var(--p2)',   amount: 3528000 },
  { label: 'Carte',   pct: 10, color: 'var(--acc)',  amount: 1260000 },
]

const TOP_PRODUCTS = [
  { rank: 1, name: '🌾 Riz parfumé 5kg',        ca: 1840000, qty: 408  },
  { rank: 2, name: '🫙 Huile palme 1L',           ca: 1530000, qty: 850  },
  { rank: 3, name: '🍚 Sucre 1kg',                ca: 1292500, qty: 1521 },
  { rank: 4, name: '🍅 Tomate concentrée 800g',   ca: 980000,  qty: 700  },
  { rank: 5, name: '🥛 Lait poudre 400g',         ca: 880000,  qty: 400  },
]

const RECENT_SALES = [
  { ref: 'VNT-2026-148', date: '2026-05-13 14:32', client: 'Marché Central Sandaga',   total: 520000, mode: 'Espèces', items: 6 },
  { ref: 'VNT-2026-147', date: '2026-05-13 11:15', client: 'Super Épicerie du Plateau', total: 215000, mode: 'Mobile',  items: 7 },
  { ref: 'VNT-2026-146', date: '2026-05-13 09:48', client: 'Client direct',             total: 32500,  mode: 'Espèces', items: 2 },
  { ref: 'VNT-2026-145', date: '2026-05-12 16:20', client: 'Boutique Awa Diallo',       total: 87000,  mode: 'Mobile',  items: 3 },
  { ref: 'VNT-2026-144', date: '2026-05-12 14:05', client: 'Client direct',             total: 18500,  mode: 'Espèces', items: 1 },
]

function Trend({ evol }: { evol: number }) {
  const up = evol >= 0
  return (
    <div className={up ? 'trend-up' : 'trend-down'}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{evol}%
    </div>
  )
}

export default function Reports() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const [period, setPeriod] = useState<Period>('30days')
  const data = PERIOD_DATA[period]

  return (
    <div className="space-y-5 animate-in">

      {/* Sélecteur période + exports */}
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button key={p}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: period === p ? 'var(--p)' : 'var(--card)',
              color: period === p ? '#fff' : 'var(--text2)',
              border: period === p ? 'none' : '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: period === p ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
            }}
            onClick={() => setPeriod(p)}
          >{PERIOD_LABELS[p]}</button>
        ))}
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📊 Export CSV en cours…')}>
          <Download size={13} /> {t('btn_export')} CSV
        </button>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('🖨️ Export PDF en cours…')}>
          <Download size={13} /> {t('btn_export')} PDF
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chiffre d'affaires", value: fmt(data.ca),       evol: data.caEvol,     color: 'var(--p2)',   icon: '💰' },
          { label: 'Marge brute',        value: fmt(data.margin),    evol: data.marginEvol, color: 'var(--acc2)', icon: '📈' },
          { label: 'Transactions',       value: data.transactions.toLocaleString('fr-FR'),evol: data.txEvol,     color: 'var(--acc)',  icon: '🧾' },
          { label: 'Panier moyen',       value: fmt(data.avgCart),   evol: data.cartEvol,   color: 'var(--p3)',   icon: '🛒' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub mt-1"><Trend evol={k.evol} /></div>
          </div>
        ))}
      </div>

      {/* Graphique CA + Modes paiement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar chart 7 jours */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 CA 7 derniers jours</span>
          </div>
          <div className="bar-chart" style={{ height: 140 }}>
            {CHART_DATA.map(d => (
              <div key={d.day} className="bar-group">
                <div className="bar" style={{ height: `${d.h}%` }}
                  data-val={fmt(d.val)} />
                <div className="bar-label">{d.day}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-center" style={{ color: 'var(--text3)' }}>
            Semaine du 7 au 13 mai 2026
          </div>
        </div>

        {/* Modes paiement */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">💳 Modes de paiement</span>
          </div>
          <div className="space-y-4">
            {PAYMENT_MODES.map(m => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                      {fmt(m.amount)}
                    </span>
                    <span className="text-xs font-black" style={{ color: m.color, fontFamily: 'var(--mono)', minWidth: 32 }}>{m.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top produits + Ventes récentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top 5 */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">🏆 Top 5 produits du mois</span>
          </div>
          <div className="space-y-1">
            {TOP_PRODUCTS.map(p => (
              <div key={p.rank} className="flex items-center gap-3 py-2"
                style={{ borderBottom: p.rank < 5 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: p.rank === 1 ? 'rgba(240,165,0,.2)' : p.rank === 2 ? 'rgba(136,134,168,.2)' : 'rgba(91,78,232,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: p.rank === 1 ? 'var(--acc)' : p.rank === 2 ? 'var(--text2)' : 'var(--p3)',
                }}>#{p.rank}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>{p.qty.toLocaleString('fr-FR')} unités vendues</div>
                </div>
                <div className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(p.ca)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ventes récentes */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">🧾 Ventes récentes</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Référence</th><th>Client</th><th>Mode</th><th>Montant</th></tr>
              </thead>
              <tbody>
                {RECENT_SALES.map(s => (
                  <tr key={s.ref}>
                    <td>
                      <div className="td-mono text-xs">{s.ref}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                        {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="text-xs td-bold">{s.client}</td>
                    <td>
                      <span className={`badge ${
                        s.mode === 'Espèces' ? 'badge-green' :
                        s.mode === 'Mobile'  ? 'badge-violet' : 'badge-blue'
                      }`}>{s.mode}</span>
                    </td>
                    <td className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
