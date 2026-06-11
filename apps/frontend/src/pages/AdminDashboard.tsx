import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { confirm } from '@/lib/confirm'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import {
  Shield, Store, Users, CreditCard, Wallet, Package, TrendingUp,
  Search, X, Plus, ArrowLeft, ChevronRight, Layers, BarChart3,
  LayoutDashboard, Inbox, Check, RefreshCw, Mail, Calendar,
} from 'lucide-react'

const APP_VERSION = '2.6.0'

type Tenant = {
  id: string; name: string; plan: string; currency: string; country: string
  vatRate?: number; createdAt: string
  status?: string; isActive?: boolean; email?: string
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
const PAID_PLANS = ['pro', 'business', 'enterprise']
const planKey = (p?: string) => (p || 'free').toLowerCase()
const planPrice = (p?: string) => PLAN_PRICE[planKey(p)] ?? 0
const planColor = (p?: string) => PLAN_COLOR[planKey(p)] ?? 'var(--text3)'
// Teinte translucide dérivée d'une couleur (token CSS) — respecte les 7 thèmes.
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const darken = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, #000)`

export default function AdminDashboard() {
  const navigate = useNavigate()
  const lang = useAppStore(s => s.lang)
  const fmt = useFormatAmount()
  const { i } = useI18n()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'plan' | 'users' | 'products' | 'sales' | 'createdAt'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [showNewTenant, setShowNewTenant] = useState(false)
  const [newTenantForm, setNewTenantForm] = useState({ name: '', currency: 'XOF', country: 'SN', plan: 'starter', adminEmail: '', adminPassword: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'requests'>('overview')
  const [planRequests, setPlanRequests] = useState<any[]>([])

  const loadStats = async () => {
    setRefreshing(true)
    try {
      const [t, s, r] = await Promise.all([adminApi.tenants(), adminApi.stats(), adminApi.planRequests().catch(() => [])])
      setTenants(t); setStats(s); setPlanRequests(r)
    } catch {
      toast.error(i('Accès refusé — SUPER_ADMIN requis', 'Access denied — SUPER_ADMIN required', 'Acceso denegado — SUPER_ADMIN requerido', 'Accesso negato — SUPER_ADMIN richiesto'))
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { loadStats() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = planRequests.length

  const handleApprove = async (id: string) => {
    if (!(await confirm({ title: i('Approuver la demande', 'Approve request', 'Aprobar solicitud', 'Approva richiesta'), message: i('Approuver cette demande et activer le plan ?', 'Approve this request and activate the plan?', '¿Aprobar esta solicitud y activar el plan?', 'Approvare questa richiesta e attivare il piano?') }))) return
    try {
      await adminApi.reviewPlanRequest(id, { action: 'approve', adminNotes: i('Paiement validé', 'Payment validated', 'Pago validado', 'Pagamento convalidato') })
      toast.success(i('✅ Plan activé !', '✅ Plan activated!', '✅ ¡Plan activado!', '✅ Piano attivato!'))
      setPlanRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore')) }
  }

  const handleReject = async (id: string) => {
    const reason = window.prompt(i('Raison du rejet (optionnel) :', 'Rejection reason (optional):', 'Razón del rechazo (opcional):', 'Motivo del rifiuto (opzionale):'))
    if (reason === null) return
    try {
      await adminApi.reviewPlanRequest(id, { action: 'reject', adminNotes: reason || i('Demande rejetée', 'Request rejected', 'Solicitud rechazada', 'Richiesta rifiutata') })
      toast.success(i('Demande rejetée', 'Request rejected', 'Solicitud rechazada', 'Richiesta rifiutata'))
      setPlanRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore')) }
  }

  const mrr = useMemo(() => tenants.reduce((s, t) => s + planPrice(t.plan), 0), [tenants])
  const activePlans = useMemo(() => tenants.filter(t => PAID_PLANS.includes(planKey(t.plan))).length, [tenants])
  const activeShops = useMemo(() => tenants.filter(t => t.isActive !== false && t.status !== 'suspended').length, [tenants])

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

  const PlanBadge = ({ plan }: { plan: string }) => (
    <span style={{ background: mix(planColor(plan), 14), color: planColor(plan), borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'capitalize' }}>{plan}</span>
  )

  const statusCfg = (t: Tenant): { h: string; label: string } => {
    const st = t.status ?? (t.isActive === false ? 'suspended' : 'active')
    if (st === 'active') return { h: 'var(--acc2)', label: i('Actif', 'Active', 'Activo', 'Attivo') }
    if (st === 'trial') return { h: 'var(--warn)', label: i('Essai', 'Trial', 'Prueba', 'Prova') }
    if (st === 'suspended') return { h: 'var(--danger)', label: i('Suspendu', 'Suspended', 'Suspendido', 'Sospeso') }
    if (st === 'pending_payment') return { h: 'var(--acc)', label: i('Paiement', 'Payment', 'Pago', 'Pagamento') }
    return { h: 'var(--text3)', label: st }
  }

  // KPIs globaux (données réelles uniquement — pas de tendances fictives)
  const kpis = stats ? [
    { label: i('Boutiques actives', 'Active shops', 'Tiendas activas', 'Negozi attivi'), value: stats.totalTenants ?? 0, sub: `${activeShops} ${i('actives', 'active', 'activas', 'attivi')}`, color: 'var(--p)', icon: <Store size={18} /> },
    { label: i('Plans payants', 'Paid plans', 'Planes de pago', 'Piani a pagamento'), value: activePlans, sub: `${i('sur', 'of', 'de', 'su')} ${stats.totalTenants ?? 0}`, color: 'var(--acc2)', icon: <CreditCard size={18} /> },
    { label: i('Utilisateurs', 'Users', 'Usuarios', 'Utenti'), value: stats.totalUsers ?? 0, sub: i('comptes', 'accounts', 'cuentas', 'account'), color: 'var(--acc3)', icon: <Users size={18} /> },
    { label: i('Ventes totales', 'Total sales', 'Ventas totales', 'Vendite totali'), value: stats.totalSales ?? 0, sub: i('toutes boutiques', 'all shops', 'todas las tiendas', 'tutti i negozi'), color: 'var(--acc)', icon: <Package size={18} /> },
    { label: i('CA cumulé', 'Total GMV', 'GMV total', 'GMV totale'), value: fmt(stats.totalRevenue ?? 0), sub: i('XOF cumulé', 'XOF cumulative', 'XOF acumulado', 'XOF cumulativo'), color: 'var(--acc3)', icon: <Wallet size={18} />, isStr: true },
    { label: i('MRR estimé', 'Est. MRR', 'MRR est.', 'MRR stim.'), value: fmt(mrr), sub: i('abonnements', 'subscriptions', 'suscripciones', 'abbonamenti'), color: 'var(--p)', icon: <TrendingUp size={18} />, isStr: true },
  ] : []

  const TABS = [
    { id: 'overview' as const, label: i("Vue d'ensemble", 'Overview', 'Resumen', 'Panoramica'), icon: <LayoutDashboard size={15} />, count: null as number | null, alert: false },
    { id: 'tenants' as const, label: i('Boutiques', 'Shops', 'Tiendas', 'Negozi'), icon: <Store size={15} />, count: stats?.totalTenants ?? null, alert: false },
    { id: 'requests' as const, label: i('Demandes', 'Requests', 'Solicitudes', 'Richieste'), icon: <Inbox size={15} />, count: pendingCount || null, alert: pendingCount > 0 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      {/* ── Header enrichi ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--p),var(--p2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: 'var(--sh-p)' }}>
            <Shield size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-.5px' }}>HabaShop Admin</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.25)', color: 'var(--acc2)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc2)', boxShadow: '0 0 6px var(--acc2)' }} />
                {i('Système opérationnel', 'System operational', 'Sistema operativo', 'Sistema operativo')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>v{APP_VERSION}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton label={i('Actualiser les statistiques', 'Refresh stats', 'Actualizar estadísticas', 'Aggiorna statistiche')} icon={<RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />} onClick={loadStats} disabled={refreshing} variant="surface" />
          <div style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={13} /> {new Date().toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <button className="mini-btn" onClick={() => navigate('/app/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40 }}><ArrowLeft size={14} /> {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
          <button className="topbar-btn" onClick={() => setShowNewTenant(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> {i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</button>
        </div>
      </div>

      {/* ── KPIs globaux (toujours visibles) ── */}
      {stats && (
        <ResponsiveGrid min={200} gap={10} style={{ marginBottom: 24 }}>
          {kpis.map((k, idx) => (
            <div key={idx} style={{ background: 'var(--card)', border: `1px solid ${mix(k.color, 22)}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform .15s ease, box-shadow .15s ease' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,.2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.label}</span>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: mix(k.color, 12), display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-1px', lineHeight: 1 }}>
                {k.isStr ? k.value : (k.value as number).toLocaleString('fr-FR')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text4)', fontWeight: 600 }}>{k.sub}</div>
            </div>
          ))}
        </ResponsiveGrid>
      )}

      {/* ── Onglets premium ── */}
      <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20, overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: 'none', background: isActive ? 'var(--card)' : 'transparent', color: isActive ? 'var(--text)' : 'var(--text3)', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s ease', whiteSpace: 'nowrap', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,.15)' : 'none', minHeight: 40, flexShrink: 0 }}>
              <span style={{ color: isActive ? 'var(--p3)' : 'var(--text4)', display: 'flex', transition: 'color .15s' }}>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-bold)', padding: '0 5px',
                  background: tab.alert ? 'rgba(255,59,92,.15)' : isActive ? 'rgba(108,71,255,.15)' : 'var(--bg4)',
                  color: tab.alert ? 'var(--danger)' : isActive ? 'var(--p3)' : 'var(--text4)',
                  border: `1px solid ${tab.alert ? 'rgba(255,59,92,.3)' : isActive ? 'rgba(108,71,255,.2)' : 'var(--border)'}` }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Overview : graphiques ── */}
      {activeTab === 'overview' && (
        loading ? (
          <ResponsiveGrid min={300} gap={16}>
            <Skeleton height={220} /><Skeleton height={220} />
          </ResponsiveGrid>
        ) : tenants.length === 0 ? (
          <EmptyState icon="🏪" title={i('Aucune boutique', 'No shops', 'Sin tiendas', 'Nessun negozio')} message={i('Aucun tenant inscrit pour le moment.', 'No tenants registered yet.', 'Ningún inquilino registrado todavía.', 'Nessun tenant registrato.')} action={{ label: i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio'), onClick: () => setShowNewTenant(true) }} />
        ) : (
          <ResponsiveGrid min={300} gap={16}>
            <div className="panel">
              <div className="panel-head"><span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={15} /> {i('Répartition des plans', 'Plan distribution', 'Distribución de planes', 'Distribuzione piani')}</span></div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {planDist.map(({ plan, count }) => {
                  const pct = Math.round((count / tenants.length) * 100)
                  return (
                    <div key={plan}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: 'var(--text)', fontWeight: 'var(--fw-semibold)', textTransform: 'capitalize' }}>{plan} <span style={{ color: 'var(--text3)', fontWeight: 'var(--fw-regular)' }}>· {fmt(planPrice(plan))}/{i('mois', 'mo', 'mes', 'mese')}</span></span>
                        <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{count} ({pct}%)</span>
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
                    <span style={{ fontSize: 12, fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{m.count}</span>
                    <div title={`${m.label}: ${m.count}`} style={{ width: '70%', height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count ? 6 : 2, background: m.count ? 'linear-gradient(180deg,var(--p2),var(--p))' : 'var(--bg)', borderRadius: '6px 6px 0 0', transition: 'height .5s' }} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </ResponsiveGrid>
        )
      )}

      {/* ── Tenants : cartes ── */}
      {activeTab === 'tenants' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><Store size={15} /> {i('Boutiques', 'Shops', 'Tiendas', 'Negozi')} <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>({view.length})</span></span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="input" style={{ paddingLeft: 32, width: 200, height: 38 }} aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={i('Rechercher…', 'Search…', 'Buscar…', 'Cerca…')} value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <select aria-label={i('Trier par', 'Sort by', 'Ordenar por', 'Ordina per')} className="input" style={{ width: 'auto', height: 38 }} value={sortKey} onChange={e => setSortKey(e.target.value as any)}>
                <option value="createdAt">{i('Date', 'Date', 'Fecha', 'Data')}</option>
                <option value="name">{i('Nom', 'Name', 'Nombre', 'Nome')}</option>
                <option value="plan">Plan</option>
                <option value="sales">{i('Ventes', 'Sales', 'Ventas', 'Vendite')}</option>
                <option value="products">{i('Produits', 'Products', 'Productos', 'Prodotti')}</option>
                <option value="users">{i('Users', 'Users', 'Usuarios', 'Utenti')}</option>
              </select>
              <button className="mini-btn" aria-label={i('Inverser le tri', 'Toggle sort direction', 'Invertir orden', 'Inverti ordine')} title={sortDir === 'asc' ? 'A→Z' : 'Z→A'} onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))} style={{ width: 38, height: 38, justifyContent: 'center' }}>{sortDir === 'asc' ? '↑' : '↓'}</button>
            </div>
          </div>

          {loading ? (
            <ResponsiveGrid min={320} gap={12}>
              <Skeleton height={150} /><Skeleton height={150} /><Skeleton height={150} /><Skeleton height={150} />
            </ResponsiveGrid>
          ) : view.length === 0 ? (
            <EmptyState icon="🏪" title={query ? i('Aucun résultat', 'No results', 'Sin resultados', 'Nessun risultato') : i('Aucune boutique', 'No shops', 'Sin tiendas', 'Nessun negozio')} message={query ? i('Aucune boutique ne correspond à votre recherche.', 'No shop matches your search.', 'Ninguna tienda coincide con tu búsqueda.', 'Nessun negozio corrisponde alla ricerca.') : i('Aucun tenant inscrit pour le moment.', 'No tenants registered yet.', 'Ningún inquilino registrado todavía.', 'Nessun tenant registrato.')} />
          ) : (
            <ResponsiveGrid min={320} gap={12}>
              {view.map(t => {
                const pc = planColor(t.plan)
                const sc = statusCfg(t)
                const initials = (t.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                const open = () => setSelected(t)
                return (
                  <div key={t.id} role="button" tabIndex={0} aria-label={`${t.name} — ${planKey(t.plan)}`}
                    onClick={open}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all .15s ease' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,.2)'; el.style.borderColor = mix(pc, 50) }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderColor = 'var(--border)' }}>
                    <div style={{ height: 3, background: `linear-gradient(90deg,${pc},${mix(pc, 40)})` }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${pc},${darken(pc, 70)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 4px 10px ${mix(pc, 35)}` }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{t.name}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.4px', background: mix(pc, 12), color: pc, border: `1px solid ${mix(pc, 22)}` }}>{planKey(t.plan)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: mix(sc.h, 14), color: sc.h, border: `1px solid ${mix(sc.h, 28)}` }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: sc.h, boxShadow: sc.label === i('Actif', 'Active', 'Activo', 'Attivo') ? `0 0 5px ${sc.h}` : 'none' }} />
                              {sc.label}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text4)', flexShrink: 0 }} />
                      </div>

                      <div style={{ height: 1, background: 'var(--border)', margin: '0 0 10px' }} />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', borderRadius: 9, overflow: 'hidden', marginBottom: 10 }}>
                        {[
                          { lbl: i('Ventes', 'Sales', 'Ventas', 'Vendite'), val: String(t._count?.sales ?? 0), color: 'var(--acc)' },
                          { lbl: i('Produits', 'Products', 'Productos', 'Prodotti'), val: String(t._count?.products ?? 0), color: 'var(--p3)' },
                          { lbl: i('Users', 'Users', 'Usuarios', 'Utenti'), val: String(t._count?.users ?? 0), color: 'var(--acc2)' },
                        ].map((m, idx) => (
                          <div key={idx} style={{ background: 'var(--card)', padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: m.color, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.val}</div>
                            <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 1 }}>{m.lbl}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Mail size={10} style={{ color: 'var(--text4)', flexShrink: 0 }} />
                          {t.email || `${t.country} · ${t.currency}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                          {new Date(t.createdAt).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </ResponsiveGrid>
          )}
        </div>
      )}

      {/* ── Demandes de plan ── */}
      {activeTab === 'requests' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CreditCard size={15} /> {i('Demandes de plans en attente', 'Pending plan requests', 'Solicitudes de planes pendientes', 'Richieste piani in attesa')}
            {pendingCount > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,59,92,.15)', color: 'var(--danger)', fontWeight: 'var(--fw-semibold)' }}>{pendingCount}</span>}
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton height={92} count={3} /></div>
          ) : planRequests.length === 0 ? (
            <EmptyState icon="🎉" title={i('Aucune demande en attente', 'No pending requests', 'Sin solicitudes pendientes', 'Nessuna richiesta in attesa')} message={i('Toutes les demandes de plan ont été traitées.', 'All plan requests have been processed.', 'Todas las solicitudes han sido procesadas.', 'Tutte le richieste sono state elaborate.')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {planRequests.map(req => {
                const pm = req.paymentMethod === 'wave' ? { label: 'Wave', c: 'var(--brand-wave)' }
                  : req.paymentMethod === 'orange_money' ? { label: 'Orange Money', c: 'var(--brand-om)' }
                  : { label: req.paymentMethod ?? '—', c: 'var(--text3)' }
                return (
                  <div key={req.id} style={{ background: 'var(--card)', border: '1px solid rgba(255,149,0,.2)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'rgba(255,149,0,.1)', border: '1px solid rgba(255,149,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc)' }}>
                      <CreditCard size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 4 }}>{req.tenant?.name ?? '—'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: 'rgba(108,71,255,.1)', color: 'var(--p3)', border: '1px solid rgba(108,71,255,.2)', textTransform: 'capitalize' }}>{req.plan} · {req.period}</span>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: 'rgba(255,149,0,.1)', color: 'var(--acc)', border: '1px solid rgba(255,149,0,.2)', fontFamily: 'var(--mono)' }}>{fmt(req.amount ?? 0)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: mix(pm.c, 12), color: pm.c, border: `1px solid ${mix(pm.c, 25)}` }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: pm.c }} /> {pm.label}
                        </span>
                      </div>
                      {req.paymentRef && <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)', marginTop: 4 }}>{i('Réf', 'Ref', 'Ref', 'Rif')}: {req.paymentRef}</div>}
                      {req.notes && <div style={{ marginTop: 3, fontStyle: 'italic', color: 'var(--text4)', fontSize: 11 }}>"{req.notes}"</div>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      <button onClick={() => handleApprove(req.id)} aria-label={`${i('Approuver', 'Approve', 'Aprobar', 'Approva')} ${req.tenant?.name ?? req.id}`}
                        style={{ padding: '8px 16px', borderRadius: 9, background: 'linear-gradient(135deg,var(--acc2),#00875A)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 'var(--fw-semibold)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5, minHeight: 36 }}>
                        <Check size={13} /> {i('Approuver', 'Approve', 'Aprobar', 'Approva')}
                      </button>
                      <button onClick={() => handleReject(req.id)} aria-label={`${i('Rejeter', 'Reject', 'Rechazar', 'Rifiuta')} ${req.tenant?.name ?? req.id}`}
                        style={{ padding: '8px 14px', borderRadius: 9, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.2)', color: 'var(--danger)', fontSize: 12, fontWeight: 'var(--fw-semibold)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5, minHeight: 36 }}>
                        <X size={13} /> {i('Rejeter', 'Reject', 'Rechazar', 'Rifiuta')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px,100vw)', background: 'var(--card,#fff)', borderLeft: '1px solid var(--border,rgba(0,0,0,.08))', boxShadow: '-20px 0 60px rgba(0,0,0,.3)', padding: 24, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0 }}>{selected.name}</h3>
                <div style={{ marginTop: 6 }}><PlanBadge plan={planKey(selected.plan)} /></div>
              </div>
              <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={() => setSelected(null)}><X size={14} /></button>
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
                  <div style={{ fontSize: 18, fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{s.v}</div>
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowNewTenant(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><Store size={16} /> {i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</h3>
              <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={() => setShowNewTenant(false)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>{i('Nom de la boutique *', 'Shop name *', 'Nombre de la tienda *', 'Nome del negozio *')}</label>
                <input aria-label={i('Nom de la boutique *', 'Shop name *', 'Nombre de la tienda *', 'Nome del negozio *')} className="input" placeholder="Ex: Superette Kouassi" value={newTenantForm.name} onChange={e => setNewTenantForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Plan</label>
                  <select aria-label="Plan" className="input" value={newTenantForm.plan} onChange={e => setNewTenantForm(f => ({ ...f, plan: e.target.value }))}>
                    <option value="starter">Starter — {fmt(9900)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                    <option value="pro">Pro — {fmt(24900)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                    <option value="enterprise">Enterprise — {fmt(49900)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{i('Devise', 'Currency', 'Divisa', 'Valuta')}</label>
                  <select aria-label={i('Devise', 'Currency', 'Divisa', 'Valuta')} className="input" value={newTenantForm.currency} onChange={e => setNewTenantForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="XAF">FCFA (XAF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar US (USD)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>{i('Email administrateur', 'Admin email', 'Email admin', 'Email admin')}</label>
                <input aria-label={i('Email administrateur', 'Admin email', 'Email admin', 'Email admin')} className="input" type="email" placeholder="admin@boutique.com" value={newTenantForm.adminEmail} onChange={e => setNewTenantForm(f => ({ ...f, adminEmail: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{i('Mot de passe admin', 'Admin password', 'Contraseña admin', 'Password admin')}</label>
                <input aria-label={i('Mot de passe admin', 'Admin password', 'Contraseña admin', 'Password admin')} className="input" type="password" placeholder={i('Min. 8 caractères', 'Min. 8 chars', 'Mín. 8 caracteres', 'Min. 8 caratteri')} value={newTenantForm.adminPassword} onChange={e => setNewTenantForm(f => ({ ...f, adminPassword: e.target.value }))} />
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

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }
