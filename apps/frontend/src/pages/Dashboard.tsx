import { useAppStore, formatCurrency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'

const WEEK_BARS = [
  { label: 'Lun', h: '55%', val: '520K' },
  { label: 'Mar', h: '72%', val: '680K' },
  { label: 'Mer', h: '45%', val: '430K' },
  { label: 'Jeu', h: '83%', val: '790K' },
  { label: 'Ven', h: '97%', val: '920K' },
  { label: 'Sam', h: '100%', val: '1.1M' },
  { label: 'Auj', h: '88%', val: '842K', highlight: true },
]

export default function Dashboard() {
  const { currency } = useAppStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="page active" id="page-dashboard">
      {/* Actions rapides */}
      <div className="qa-grid">
        <div className="qa-card" onClick={() => navigate('/pos')}>
          <div className="qa-icon">🛒</div>
          <div className="qa-label">Point de vente</div>
        </div>
        <div className="qa-card">
          <div className="qa-icon">📥</div>
          <div className="qa-label">Réception stock</div>
        </div>
        <div className="qa-card">
          <div className="qa-icon">➕</div>
          <div className="qa-label">Ajouter produit</div>
        </div>
        <div className="qa-card">
          <div className="qa-icon">📤</div>
          <div className="qa-label">Exporter rapport</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">💳</div>
          <div className="kpi-label">Ventes du jour</div>
          <div className="kpi-value">{formatCurrency(842000, currency)}</div>
          <div className="kpi-sub"><span className="up">▲ 12%</span> vs hier</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">📦</div>
          <div className="kpi-label">Articles en stock</div>
          <div className="kpi-value">3 248</div>
          <div className="kpi-sub"><span className="dn">▼ 8</span> alertes rupture</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">🧑‍💼</div>
          <div className="kpi-label">Employés actifs</div>
          <div className="kpi-value">18/21</div>
          <div className="kpi-sub" style={{ color: 'var(--text2)' }}>3 absents aujourd'hui</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">🏆</div>
          <div className="kpi-label">CA mensuel</div>
          <div className="kpi-value">{formatCurrency(2650000, currency)}</div>
          <div className="kpi-sub"><span className="up">▲ 7%</span> vs mois dernier</div>
        </div>
      </div>

      {/* Graphique + Alertes */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-h">
            <div className="panel-t">📈 Ventes — 7 derniers jours</div>
          </div>
          <div className="bar-chart" style={{ height: 130 }}>
            {WEEK_BARS.map(b => (
              <div key={b.label} className="bar-group">
                <div
                  className="bar"
                  data-val={b.val}
                  style={{
                    height: b.h,
                    background: b.highlight
                      ? 'linear-gradient(to top,var(--acc),#FCD34D)'
                      : undefined
                  }}
                />
                <div className="bar-label">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <div className="panel-t">🔴 Alertes Rupture</div>
          </div>
          <div className="scroll-x">
            <table style={{ minWidth: 360 }}>
              <thead>
                <tr><th>Produit</th><th>Reste</th><th>Seuil</th><th>Statut</th></tr>
              </thead>
              <tbody>
                <tr><td className="td-bold">Riz parfumé 5kg</td><td>12</td><td>20</td><td><span className="pill red">Rupture</span></td></tr>
                <tr><td className="td-bold">Huile palme 1L</td><td>18</td><td>25</td><td><span className="pill amber">Bas</span></td></tr>
                <tr><td className="td-bold">Sucre 50kg</td><td>5</td><td>10</td><td><span className="pill red">Rupture</span></td></tr>
                <tr><td className="td-bold">Farine blé 25kg</td><td>22</td><td>30</td><td><span className="pill amber">Bas</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activité + Top produits */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-h">
            <div className="panel-t">⚡ Activité récente</div>
          </div>
          <div className="act-list">
            <div className="act-item"><div className="act-ic sale">💳</div><div><div className="act-t">Vente #2041 — {formatCurrency(45000, currency)}</div><div className="act-time">Il y a 3 min · Caisse 1</div></div></div>
            <div className="act-item"><div className="act-ic stock">📦</div><div><div className="act-t">Réception stock — Fournisseur Diallo</div><div className="act-time">Il y a 18 min</div></div></div>
            <div className="act-item"><div className="act-ic hr">🧑‍💼</div><div><div className="act-t">Pointage — Marie K. (Arrivée)</div><div className="act-time">Il y a 35 min</div></div></div>
            <div className="act-item"><div className="act-ic alert">⚠️</div><div><div className="act-t">Alerte rupture — Sucre 50kg</div><div className="act-time">Il y a 1h · Automatique</div></div></div>
            <div className="act-item"><div className="act-ic sale">💳</div><div><div className="act-t">Vente #2040 — {formatCurrency(128000, currency)}</div><div className="act-time">Il y a 1h 12min · Caisse 2</div></div></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <div className="panel-t">🏆 Top produits du mois</div>
          </div>
          <div className="scroll-x">
            <table style={{ minWidth: 340 }}>
              <thead>
                <tr><th style={{ width: 32 }}>#</th><th>Produit</th><th>Qté</th><th>CA</th></tr>
              </thead>
              <tbody>
                <tr><td>🥇</td><td className="td-bold">Riz parfumé 5kg</td><td>842</td><td style={{ color: 'var(--acc)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{formatCurrency(2100000, currency)}</td></tr>
                <tr><td>🥈</td><td className="td-bold">Huile palme 1L</td><td>612</td><td style={{ color: 'var(--acc)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{formatCurrency(1500000, currency)}</td></tr>
                <tr><td>🥉</td><td className="td-bold">Farine blé 25kg</td><td>430</td><td style={{ color: 'var(--acc)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{formatCurrency(980000, currency)}</td></tr>
                <tr><td>4</td><td className="td-bold">Sucre 50kg</td><td>318</td><td style={{ color: 'var(--acc)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{formatCurrency(720000, currency)}</td></tr>
                <tr><td>5</td><td className="td-bold">Savon 500g</td><td>290</td><td style={{ color: 'var(--acc)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{formatCurrency(580000, currency)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
