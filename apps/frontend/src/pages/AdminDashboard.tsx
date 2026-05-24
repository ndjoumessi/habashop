import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import toast from 'react-hot-toast'
import {
  Shield, Store, Users, CreditCard, Wallet, Package, TrendingUp,
  Search, X, Plus, ArrowLeft, ChevronRight, Layers, BarChart3,
  LayoutDashboard, Inbox, Check,
} from 'lucide-react'

type Tenant = {
  id: string; name: string; plan: string; currency: string; country: string
  vatRate?: number; createdAt: string
  _count?: { users: number; products: number; sales: number }
}

// Monthly value per plan, in XOF (display converts via fmt)
const PLAN_PRICE: Record<string, number> = {
  free: 0, trial: 0, starter: 9900, pro: 24900, business: 24900, enterprise: 49900,
}
const PLAN_COLOR: Record<string, string> = {
  free: 'var(--text3)', trial: 'var(--warn)', starter: 'var(--acc2)',
  pro: 'var(--p2)', business: 'var(--p2)', enterprise: 'var(--p)',
}
const planKey = (p?: string) => (p || 'free').toLowerCase()
const planPrice = (p?: string) => PLAN_PRICE[planKey(p)] ?? 0
const planColor = (p?: string) => PLAN_COLOR[planKey(p)] ?? 'var(--text3)'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const lang = useAppStore(s => s.lang)
  const fmt = useFormatAmount()
  const i = (fr: string, en: string, es: string, it: string) => (lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it)

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'plan' | 'users' | 'products' | 'sales' | 'createdAt'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [showNewTenant, setShowNewTenant] = useState(false)
  const [newTenantForm, setNewTenantForm] = useState({ name: '', currency: 'XOF', country: 'SN', plan: 'starter', adminEmail: '', adminPassword: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'requests'>('overview')
  const [planRequests, setPlanRequests] = useState<any[]>([])

  useEffect(() => {
    Promise.all([adminApi.tenants(), adminApi.stats(), adminApi.planRequests().catch(() => [])])
      .then(([t, s, r]) => { setTenants(t); setStats(s); setPlanRequests(r) })
      .catch(() => toast.error(i('Accès refusé — SUPER_ADMIN requis', 'Access denied — SUPER_ADMIN required', 'Acceso denegado — SUPER_ADMIN requerido', 'Accesso negato — SUPER_ADMIN richiesto')))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = planRequests.length

  const handleApprove = async (id: string) => {
    if (!window.confirm(i('Approuver cette demande et activer le plan ?', 'Approve this request and activate the plan?', '¿Aprobar esta solicitud y activar el plan?', 'Approvare questa richiesta e attivare il piano?'))) return
    try {
      await adminApi.reviewPlanRequest(id, { action: 'approve', adminNotes: 'Paiement validé' })
      toast.success(i('✅ Plan activé !', '✅ Plan activated!', '✅ ¡Plan activado!', '✅ Piano attivato!'))
      setPlanRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { toast.error(e?.message ?? 'Erreur') }
  }

  const handleReject = async (id: string) => {
    const reason = window.prompt(i('Raison du rejet (optionnel) :', 'Rejection reason (optional):', 'Razón del rechazo (opcional):', 'Motivo del rifiuto (opzionale):'))
    if (reason === null) return
    try {
      await adminApi.reviewPlanRequest(id, { action: 'reject', adminNotes: reason || 'Demande rejetée' })
      toast.success(i('Demande rejetée', 'Request rejected', 'Solicitud rechazada', 'Richiesta rifiutata'))
      setPlanRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { toast.error(e?.message ?? 'Erreur') }
  }

  const mrr = useMemo(() => tenants.reduce((s, t) => s + planPrice(t.plan), 0), [tenants])

  const planDist = useMemo(() => {
    const m: Record<string, number> = {}
    tenants.forEach(t => { const p = planKey(t.plan); m[p] = (m[p] || 0) + 1 })
    return Object.entries(m).map(([plan, count]) => ({ plan, count })).sort((a, b) => b.count - a.count)
  }, [tenants])

  const months = useMemo(() => {
    const now = new Date()
    const buckets = Array.from({ length: 6 }, (_, idx) => {
      const k = 5 - idx
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(lang, { month: 'short' }), count: 0 }
    })
    tenants.forEach(t => {
      const d = new Date(t.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const b = buckets.find(x => x.key === key)
      if (b) b.count++
    })
    return buckets
  }, [tenants, lang])
  const maxMonth = Math.max(1, ...months.map(m => m.count))

  const view = useMemo(() => {
    let arr = tenants
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter(t => [t.name, t.country, t.plan].some(v => String(v || '').toLowerCase().includes(q)))
    const val = (t: Tenant): string | number => {
      switch (sortKey) {
        case 'name': return String(t.name || '').toLowerCase()
        case 'plan': return String(t.plan || '').toLowerCase()
        case 'users': return t._count?.users ?? 0
        case 'products': return t._count?.products ?? 0
        case 'sales': return t._count?.sales ?? 0
        case 'createdAt': return new Date(t.createdAt).getTime()
      }
    }
    return [...arr].sort((a, b) => {
      const x = val(a), y = val(b)
      if (x < y) return sortDir === 'asc' ? -1 : 1
      if (x > y) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [tenants, query, sortKey, sortDir])

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(k === 'name' || k === 'plan' ? 'asc' : 'desc') }
  }
  const sortArrow = (k: typeof sortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  const PlanBadge = ({ plan }: { plan: string }) => (
    <span style={{ background: 'color-mix(in srgb,' + planColor(plan) + ' 14%, transparent)', color: planColor(plan), borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{plan}</span>
  )

  const kpis = stats ? [
    { label: i('BOUTIQUES', 'SHOPS', 'TIENDAS', 'NEGOZI'), value: stats.totalTenants, color: 'var(--p2)', icon: <Store size={18} /> },
    { label: i('UTILISATEURS', 'USERS', 'USUARIOS', 'UTENTI'), value: stats.totalUsers, color: 'var(--acc2)', icon: <Users size={18} /> },
    { label: i('TRANSACTIONS', 'TRANSACTIONS', 'TRANSACCIONES', 'TRANSAZIONI'), value: stats.totalSales, color: 'var(--acc)', icon: <CreditCard size={18} /> },
    { label: i('CA TOTAL', 'TOTAL REVENUE', 'INGRESOS', 'RICAVI'), value: fmt(stats.totalRevenue ?? 0), color: 'var(--p2)', icon: <Wallet size={18} /> },
    { label: i('PRODUITS', 'PRODUCTS', 'PRODUCTOS', 'PRODOTTI'), value: stats.totalProducts, color: 'var(--acc2)', icon: <Package size={18} /> },
    { label: i('MRR ESTIMÉ', 'EST. MRR', 'MRR EST.', 'MRR STIM.'), value: fmt(mrr), color: 'var(--p)', icon: <TrendingUp size={18} /> },
  ] : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--p),var(--p2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Shield size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>HabaShop Admin</h1>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{i('Console de gestion multi-boutiques', 'Multi-shop management console', 'Consola de gestión multi-tienda', 'Console di gestione multi-negozio')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mini-btn" onClick={() => navigate('/app/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
          <button className="topbar-btn" onClick={() => setShowNewTenant(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> {i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>{i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          { id: 'overview', icon: <LayoutDashboard size={14} />, label: i("Vue d'ensemble", 'Overview', 'Resumen', 'Panoramica'), urgent: false },
          { id: 'tenants', icon: <Store size={14} />, label: i('Boutiques', 'Shops', 'Tiendas', 'Negozi'), urgent: false },
          { id: 'requests', icon: <Inbox size={14} />, label: `${i('Demandes', 'Requests', 'Solicitudes', 'Richieste')}${pendingCount > 0 ? ` (${pendingCount})` : ''}`, urgent: pendingCount > 0 },
        ] as const).map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)} style={{
            padding: '8px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6,
            background: activeTab === tab.id ? (tab.urgent ? 'rgba(255,59,92,.15)' : 'rgba(108,71,255,.15)') : 'rgba(255,255,255,.04)',
            border: `1px solid ${activeTab === tab.id ? (tab.urgent ? 'rgba(255,59,92,.3)' : 'rgba(108,71,255,.3)') : 'rgba(255,255,255,.08)'}`,
            cursor: 'pointer', color: activeTab === tab.id ? (tab.urgent ? 'var(--danger)' : 'var(--p3)') : 'var(--text3)',
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', transition: 'all .15s',
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      {/* KPIs */}
      {activeTab === 'overview' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <span className="kpi-label">{k.label}</span>
                <span style={{ color: k.color, display: 'flex' }}>{k.icon}</span>
              </div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Plan distribution + Growth */}
      {activeTab === 'overview' && tenants.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-head"><span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={15} /> {i('Répartition des plans', 'Plan distribution', 'Distribución de planes', 'Distribuzione piani')}</span></div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {planDist.map(({ plan, count }) => {
                const pct = Math.round((count / tenants.length) * 100)
                return (
                  <div key={plan}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 700, textTransform: 'capitalize' }}>{plan} <span style={{ color: 'var(--text3)', fontWeight: 500 }}>· {fmt(planPrice(plan))}/{i('mois', 'mo', 'mes', 'mese')}</span></span>
                      <span style={{ color: 'var(--text3)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: planColor(plan), borderRadius: 99, transition: 'width .4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={15} /> {i('Nouvelles boutiques (6 mois)', 'New shops (6 months)', 'Nuevas tiendas (6 meses)', 'Nuovi negozi (6 mesi)')}</span></div>
            <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 10, height: 160 }}>
              {months.map(m => (
                <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{m.count}</span>
                  <div title={`${m.label}: ${m.count}`} style={{ width: '70%', height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count ? 6 : 2, background: m.count ? 'linear-gradient(180deg,var(--p2),var(--p))' : 'var(--bg)', borderRadius: '6px 6px 0 0', transition: 'height .5s' }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'capitalize' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tenants table */}
      {activeTab === 'tenants' && tenants.length > 0 && (
        <div className="panel">
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Store size={15} /> {i('Boutiques', 'Shops', 'Tiendas', 'Negozi')} ({view.length})</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input className="input" style={{ paddingLeft: 32, width: 220, height: 34 }} placeholder={i('Rechercher…', 'Search…', 'Buscar…', 'Cerca…')} value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>{i('Boutique', 'Shop', 'Tienda', 'Negozio')}{sortArrow('name')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('plan')}>{i('Plan', 'Plan', 'Plan', 'Piano')}{sortArrow('plan')}</th>
                  <th>{i('Devise', 'Currency', 'Divisa', 'Valuta')}</th>
                  <th>{i('Pays', 'Country', 'País', 'Paese')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('users')}>{i('Users', 'Users', 'Usuarios', 'Utenti')}{sortArrow('users')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('products')}>{i('Produits', 'Products', 'Productos', 'Prodotti')}{sortArrow('products')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('sales')}>{i('Ventes', 'Sales', 'Ventas', 'Vendite')}{sortArrow('sales')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('createdAt')}>{i('Créée le', 'Created', 'Creada', 'Creato')}{sortArrow('createdAt')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {view.map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(t)}>
                    <td className="td-bold">{t.name}</td>
                    <td><PlanBadge plan={planKey(t.plan)} /></td>
                    <td>{t.currency}</td>
                    <td>{t.country}</td>
                    <td className="td-mono">{t._count?.users ?? 0}</td>
                    <td className="td-mono">{t._count?.products ?? 0}</td>
                    <td className="td-mono">{t._count?.sales ?? 0}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(t.createdAt).toLocaleDateString(lang)}</td>
                    <td><ChevronRight size={16} style={{ color: 'var(--text3)' }} /></td>
                  </tr>
                ))}
                {view.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{i('Aucun résultat', 'No results', 'Sin resultados', 'Nessun risultato')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan requests */}
      {activeTab === 'requests' && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={15} /> {i('Demandes de plans en attente', 'Pending plan requests', 'Solicitudes de planes pendientes', 'Richieste piani in attesa')}
              {pendingCount > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,59,92,.15)', color: 'var(--danger)', fontWeight: 700 }}>{pendingCount}</span>}
            </span>
          </div>
          {planRequests.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 13 }}>{i('Aucune demande en attente', 'No pending requests', 'Sin solicitudes pendientes', 'Nessuna richiesta in attesa')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {planRequests.map(req => (
                <div key={req.id} style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,rgba(255,255,255,.04))', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{req.tenant?.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{req.tenant?.email ?? '—'} · {req.tenant?.country ?? ''}</div>
                    <div style={{ marginTop: 5, fontSize: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(108,71,255,.12)', color: 'var(--p3)', fontWeight: 700, fontSize: 10, textTransform: 'capitalize' }}>⚡ {req.plan} · {req.period}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(255,184,0,.1)', color: 'var(--warn)', fontWeight: 700, fontSize: 10 }}>💳 {req.paymentMethod}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,.06)', color: 'var(--text2)', fontWeight: 700, fontSize: 10, fontFamily: 'var(--mono)' }}>{fmt(req.amount)}</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 140, fontSize: 11, color: 'var(--text3)' }}>
                    {req.paymentRef && <div style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', marginBottom: 3 }}>Réf: {req.paymentRef}</div>}
                    <div>{new Date(req.createdAt).toLocaleDateString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    {req.notes && <div style={{ marginTop: 3, fontStyle: 'italic', color: 'var(--text4)', fontSize: 10 }}>"{req.notes}"</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => handleApprove(req.id)} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,208,132,.12)', border: '1px solid rgba(0,208,132,.25)', cursor: 'pointer', color: 'var(--acc2)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={13} /> {i('Approuver', 'Approve', 'Aprobar', 'Approva')}</button>
                    <button onClick={() => handleReject(req.id)} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,59,92,.08)', border: '1px solid rgba(255,59,92,.2)', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}><X size={13} /> {i('Rejeter', 'Reject', 'Rechazar', 'Rifiuta')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px,100vw)', background: 'var(--card,#fff)', borderLeft: '1px solid var(--border,rgba(0,0,0,.08))', boxShadow: '-20px 0 60px rgba(0,0,0,.3)', padding: 24, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0 }}>{selected.name}</h3>
                <div style={{ marginTop: 6 }}><PlanBadge plan={planKey(selected.plan)} /></div>
              </div>
              <button className="mini-btn" onClick={() => setSelected(null)}><X size={14} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { l: i('Utilisateurs', 'Users', 'Usuarios', 'Utenti'), v: selected._count?.users ?? 0 },
                { l: i('Produits', 'Products', 'Productos', 'Prodotti'), v: selected._count?.products ?? 0 },
                { l: i('Ventes', 'Sales', 'Ventas', 'Vendite'), v: selected._count?.sales ?? 0 },
                { l: i('Valeur/mois', 'Value/mo', 'Valor/mes', 'Valore/mese'), v: fmt(planPrice(selected.plan)) },
              ].map(s => (
                <div key={s.l} className="kpi-card" style={{ padding: 12 }}>
                  <div className="kpi-label">{s.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {[
                ['ID', selected.id],
                [i('Devise', 'Currency', 'Divisa', 'Valuta'), selected.currency],
                [i('Pays', 'Country', 'País', 'Paese'), selected.country],
                [i('TVA', 'VAT', 'IVA', 'IVA'), `${selected.vatRate ?? 0}%`],
                [i('Créée le', 'Created', 'Creada', 'Creato'), new Date(selected.createdAt).toLocaleString(lang)],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border,rgba(0,0,0,.06))', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text3)' }}>{l}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: l === 'ID' ? 'monospace' : undefined, fontSize: l === 'ID' ? 11 : 13 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New tenant modal */}
      {showNewTenant && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowNewTenant(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><Store size={16} /> {i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</h3>
              <button className="mini-btn" onClick={() => setShowNewTenant(false)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>{i('Nom de la boutique *', 'Shop name *', 'Nombre de la tienda *', 'Nome del negozio *')}</label>
                <input className="input" placeholder="Ex: Superette Kouassi" value={newTenantForm.name} onChange={e => setNewTenantForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Plan</label>
                  <select className="input" value={newTenantForm.plan} onChange={e => setNewTenantForm(f => ({ ...f, plan: e.target.value }))}>
                    <option value="starter">Starter — {fmt(9900)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                    <option value="pro">Pro — {fmt(24900)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                    <option value="enterprise">Enterprise — {fmt(49900)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{i('Devise', 'Currency', 'Divisa', 'Valuta')}</label>
                  <select className="input" value={newTenantForm.currency} onChange={e => setNewTenantForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="XAF">FCFA (XAF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar US (USD)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>{i('Email administrateur', 'Admin email', 'Email admin', 'Email admin')}</label>
                <input className="input" type="email" placeholder="admin@boutique.com" value={newTenantForm.adminEmail} onChange={e => setNewTenantForm(f => ({ ...f, adminEmail: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{i('Mot de passe admin', 'Admin password', 'Contraseña admin', 'Password admin')}</label>
                <input className="input" type="password" placeholder={i('Min. 8 caractères', 'Min. 8 chars', 'Mín. 8 caracteres', 'Min. 8 caratteri')} value={newTenantForm.adminPassword} onChange={e => setNewTenantForm(f => ({ ...f, adminPassword: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="topbar-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={async () => {
                if (!newTenantForm.name) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
                try {
                  const created = await adminApi.createTenant(newTenantForm)
                  setTenants(prev => [created, ...prev])
                  setShowNewTenant(false)
                  toast.success(i(`✅ Boutique "${newTenantForm.name}" créée !`, `✅ Shop "${newTenantForm.name}" created!`, `✅ ¡Tienda "${newTenantForm.name}" creada!`, `✅ Negozio "${newTenantForm.name}" creato!`))
                  setNewTenantForm({ name: '', currency: 'XOF', country: 'SN', plan: 'starter', adminEmail: '', adminPassword: '' })
                } catch {
                  toast.error(i('Erreur création boutique', 'Error creating shop', 'Error al crear tienda', 'Errore creazione negozio'))
                }
              }}>{i('Créer la boutique', 'Create shop', 'Crear tienda', 'Crea negozio')}</button>
              <button className="mini-btn" style={{ padding: '10px 16px' }} onClick={() => setShowNewTenant(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }
