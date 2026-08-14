import { useState, useEffect } from 'react'
import { useFormatAmount } from '@/stores/appStore'
import { useAuthStore, getLandingForRole } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import { consolidatedApi } from '@/lib/api'
import { Store, Layers, AlertTriangle, Check, Loader2 } from 'lucide-react'

interface Row { id: string; name: string; currency: string; caToday: number; transactionsToday: number; stockAlerts: number }

/**
 * Section "Vue globale" du dashboard (multi-boutiques). Affichée seulement si
 * l'user a > 1 boutique. CA en XOF base → fmt() convertit à l'affichage.
 * Clic sur une ligne = bascule vers cette boutique (rechargement complet).
 */
export default function ConsolidatedShops() {
  const fmt = useFormatAmount()
  const { i } = useI18n()
  const { tenants, activeTenantId, switchTenant, user } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState({ ca: 0, tx: 0 })
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (tenants.length <= 1) { setLoading(false); return }
    consolidatedApi.get()
      .then(d => {
        setRows(d.tenants)
        setTotals({ ca: d.totalCaToday, tx: d.totalTransactions })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenants.length])

  if (tenants.length <= 1) return null

  const goShop = async (id: string) => {
    if (id === activeTenantId) return
    setPending(id)
    try {
      await switchTenant(id)
      window.location.assign(getLandingForRole(user?.role))
    } catch { setPending(null) }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(108,71,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p2)' }}>
          <Layers size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{i('Vue globale', 'Global view', 'Vista global', 'Vista globale')}</div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>{i('Toutes vos boutiques — aujourd’hui', 'All your shops — today', 'Todas tus tiendas — hoy', 'Tutti i tuoi negozi — oggi')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontWeight: 'var(--fw-semibold)' }}>{i('CA consolidé', 'Total revenue', 'Ingresos totales', 'Ricavi totali')}</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--p2)', fontFamily: 'var(--mono)' }}>{loading ? '…' : fmt(totals.ca)}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
          <Loader2 size={18} style={{ animation: 'spin .6s linear infinite' }} />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                <th style={{ padding: '10px 20px', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{i('Boutique', 'Shop', 'Tienda', 'Negozio')}</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'right' }}>{i('CA jour', 'Revenue', 'Ingresos', 'Ricavi')}</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'right' }}>{i('Ventes', 'Sales', 'Ventas', 'Vendite')}</th>
                <th style={{ padding: '10px 20px', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'right' }}>{i('Alertes', 'Alerts', 'Alertas', 'Avvisi')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isActive = r.id === activeTenantId
                const isPending = pending === r.id
                return (
                  <tr
                    key={r.id}
                    onClick={() => goShop(r.id)}
                    style={{ borderTop: '1px solid var(--border)', cursor: isActive ? 'default' : 'pointer', background: isActive ? 'var(--bg3)' : 'transparent', transition: 'background .1s' }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Store size={14} style={{ color: isActive ? 'var(--p2)' : 'var(--text3)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{r.name}</span>
                        {isActive && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', color: 'var(--p2)' }}><Check size={11} /> {i('active', 'active', 'activa', 'attiva')}</span>}
                        {isPending && <Loader2 size={12} style={{ color: 'var(--p2)', animation: 'spin .6s linear infinite' }} />}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{fmt(r.caToday)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{r.transactionsToday}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      {r.stockAlerts > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: 'var(--warn)' }}>
                          <AlertTriangle size={12} /> {r.stockAlerts}
                        </span>
                      ) : <span style={{ color: 'var(--text4)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
