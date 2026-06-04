import { TrendingUp, BarChart3 } from 'lucide-react'
import { type Customer, TYPE_CFG, typeLabel } from '@/components/customers/customersShared'

interface CustomersStatsProps {
  customers: Customer[]
  fmt: (n: number) => string
  lang: string
  i: (...a: string[]) => string
  setViewCustomer: (c: any) => void
}

export default function CustomersStats({ customers, fmt, lang, i, setViewCustomer }: CustomersStatsProps) {
  return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={16} style={{ color: 'var(--p2)' }} />
                <span className="panel-title">{i('Répartition par type', 'Distribution by type', 'Distribución por tipo', 'Distribuzione per tipo')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(['Grossiste', 'Semi-gros', 'Fidèle', 'Détail'] as const).map(type => {
                const count = customers.filter(c => c.type === type).length
                const ca = customers.filter(c => c.type === type).reduce((s, c) => s + (c.totalCA ?? 0), 0)
                const pct = customers.length > 0 ? Math.round(count / customers.length * 100) : 0
                const { color } = TYPE_CFG[type]
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{typeLabel(type, lang)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <span style={{ color: 'var(--text3)' }}>{count} {count > 1 ? i('clients', 'customers', 'clientes', 'clienti') : i('client', 'customer', 'cliente', 'cliente')}</span>
                        <span style={{ color, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)' }}>{fmt(ca)}</span>
                        <span style={{ color: 'var(--text2)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: `linear-gradient(90deg,${color},${color}99)`,
                        borderRadius: 99, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
                        boxShadow: `0 0 8px ${color}55`,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} style={{ color: 'var(--acc)' }} />
                <span className="panel-title">{i('Top 5 clients', 'Top 5 customers', 'Top 5 clientes', 'Top 5 clienti')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...customers]
                .sort((a, b) => (b.totalCA ?? 0) - (a.totalCA ?? 0))
                .slice(0, 5)
                .map((c, i) => {
                  const cfg = TYPE_CFG[c.type]
                  const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  const medalColors = ['linear-gradient(135deg,#F59E0B,#FCD34D)', 'linear-gradient(135deg,#9CA3AF,#D1D5DB)', 'linear-gradient(135deg,#D97706,#B45309)']
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
                      background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12,
                      cursor: 'pointer', transition: 'border-color .15s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = cfg.color}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                      onClick={() => setViewCustomer(c)}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: i < 3 ? medalColors[i] : 'var(--bg4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 900, color: i < 3 ? '#fff' : 'var(--text3)',
                      }}>
                        {i < 3 ? (i + 1) : i + 1}
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{typeLabel(c.type, lang)} · {c.loyaltyPoints} pts</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 'var(--fw-bold)', color: cfg.color, fontFamily: 'var(--mono)', flexShrink: 0 }}>
                        {fmt(c.totalCA ?? 0)}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
  )
}
