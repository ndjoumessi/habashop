import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Plus, Bell, Wifi, WifiOff, ShoppingCart, Package, User, Receipt, Users, Truck, X, ChevronDown, Zap, Clock, Crown } from 'lucide-react'
import { useAppStore, t, getTrialInfo } from '@/stores/appStore'
import { useAuthStore, canAccess } from '@/stores/authStore'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import CurrencyBadge from '@/components/ui/CurrencyBadge'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import toast from 'react-hot-toast'
import { alertsApi, tenantApi } from '@/lib/api'
import { useNotificationStore, type LiveNotif } from '@/stores/notificationStore'

// ── Multilingual page titles ─────────────────────────────────────────────────

const PAGE_TITLES: Record<string, Record<string, string>> = {
  fr: {
    '/app/dashboard':     'Tableau de bord',
    '/app/pos':           'Point de vente',
    '/app/stock':         'Stock & Produits',
    '/app/orders':        'Commandes',
    '/app/suppliers':     'Fournisseurs',
    '/app/customers':     'Clients',
    '/app/reports':       'Rapports',
    '/app/hr':            'Employés',
    '/app/planning':      'Planning',
    '/app/payroll':       'Paie',
    '/app/expenses':      'Dépenses',
    '/app/forecasts':     'Prévisions',
    '/app/users':         'Utilisateurs',
    '/app/activity':      "Journal d'activités",
    '/app/notifications': 'Notifications',
    '/app/settings':      'Paramètres',
    '/app/marketing':     'Marketing',
    '/app/ai':            'IA Assistant',
    '/app/goals':         'Objectifs & KPIs',
    '/app/api-docs':      'Documentation API',
  },
  en: {
    '/app/dashboard':     'Dashboard',
    '/app/pos':           'Point of Sale',
    '/app/stock':         'Stock & Products',
    '/app/orders':        'Orders',
    '/app/suppliers':     'Suppliers',
    '/app/customers':     'Customers',
    '/app/reports':       'Reports',
    '/app/hr':            'Employees',
    '/app/planning':      'Planning',
    '/app/payroll':       'Payroll',
    '/app/expenses':      'Expenses',
    '/app/forecasts':     'Forecasts',
    '/app/users':         'Users',
    '/app/activity':      'Activity Log',
    '/app/notifications': 'Notifications',
    '/app/settings':      'Settings',
    '/app/marketing':     'Marketing',
    '/app/ai':            'AI Assistant',
    '/app/goals':         'Goals & KPIs',
    '/app/api-docs':      'API Docs',
  },
  es: {
    '/app/dashboard':     'Panel',
    '/app/pos':           'Punto de Venta',
    '/app/stock':         'Stock & Productos',
    '/app/orders':        'Pedidos',
    '/app/suppliers':     'Proveedores',
    '/app/customers':     'Clientes',
    '/app/reports':       'Informes',
    '/app/hr':            'Empleados',
    '/app/planning':      'Planificación',
    '/app/payroll':       'Nómina',
    '/app/expenses':      'Gastos',
    '/app/forecasts':     'Previsiones',
    '/app/users':         'Usuarios',
    '/app/activity':      'Registro actividad',
    '/app/notifications': 'Notificaciones',
    '/app/settings':      'Configuración',
    '/app/marketing':     'Marketing',
    '/app/ai':            'Asistente IA',
    '/app/goals':         'Objetivos & KPIs',
    '/app/api-docs':      'Docs API',
  },
  it: {
    '/app/dashboard':     'Dashboard',
    '/app/pos':           'Punto Vendita',
    '/app/stock':         'Stock & Prodotti',
    '/app/orders':        'Ordini',
    '/app/suppliers':     'Fornitori',
    '/app/customers':     'Clienti',
    '/app/reports':       'Report',
    '/app/hr':            'Dipendenti',
    '/app/planning':      'Pianificazione',
    '/app/payroll':       'Stipendi',
    '/app/expenses':      'Spese',
    '/app/forecasts':     'Previsioni',
    '/app/users':         'Utenti',
    '/app/activity':      'Registro attività',
    '/app/notifications': 'Notifiche',
    '/app/settings':      'Impostazioni',
    '/app/marketing':     'Marketing',
    '/app/ai':            'Assistente IA',
    '/app/goals':         'Obiettivi & KPI',
    '/app/api-docs':      'Docs API',
  },
}

const SEARCH_INDEX = [
  { type: 'Page', label: 'Tableau de bord',  sub: 'KPIs',         path: '/app/dashboard',  icon: Zap          },
  { type: 'Page', label: 'Point de vente',   sub: 'Caisse',       path: '/app/pos',        icon: ShoppingCart },
  { type: 'Page', label: 'Stock & Produits', sub: 'Inventaire',   path: '/app/stock',      icon: Package      },
  { type: 'Page', label: 'Clients',          sub: 'CRM',          path: '/app/customers',  icon: User         },
  { type: 'Page', label: 'Fournisseurs',     sub: 'Achats',       path: '/app/suppliers',  icon: Truck        },
  { type: 'Page', label: 'Commandes',        sub: 'Approvision.', path: '/app/orders',     icon: Receipt      },
  { type: 'Page', label: 'Rapports',         sub: 'Analyses',     path: '/app/reports',    icon: Zap          },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Header() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { lang }  = useAppStore()
  const isOnline  = useOnlineStatus()

  const [showNewMenu,   setShowNewMenu]   = useState(false)
  const [showNotifs,    setShowNotifs]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<typeof SEARCH_INDEX>([])
  const [showResults,   setShowResults]   = useState(false)
  const [apiStatus,     setApiStatus]     = useState<'online'|'offline'|'checking'>('checking')
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([])
  const [swUpdate,      setSwUpdate]      = useState(false)

  const role = useAuthStore(s => s.user?.role)
  const tenant    = useAppStore(s => s.tenant)
  const setTenant = useAppStore(s => s.setTenant)

  // Charge le tenant depuis l'API si absent du store (session déjà ouverte)
  useEffect(() => {
    if (tenant) return
    tenantApi.get().then(data => { if (data?.id) setTenant(data) }).catch(() => {})
  }, [tenant, setTenant])

  const ALL_NEW_ITEMS = [
    { slug: 'pos',       Icon: ShoppingCart, label: lang === 'en' ? 'New sale' : lang === 'es' ? 'Nueva venta' : lang === 'it' ? 'Nuova vendita' : 'Nouvelle vente', action: () => navigate('/app/pos') },
    { slug: 'stock',     Icon: Package,      label: lang === 'en' ? 'New product' : lang === 'es' ? 'Nuevo producto' : lang === 'it' ? 'Nuovo prodotto' : 'Nouveau produit',   action: () => { navigate('/app/stock');     setTimeout(() => window.dispatchEvent(new CustomEvent('habashop:new-product')),    300) } },
    { slug: 'customers', Icon: User,         label: lang === 'en' ? 'New customer' : lang === 'es' ? 'Nuevo cliente' : lang === 'it' ? 'Nuovo cliente' : 'Nouveau client',  action: () => { navigate('/app/customers'); setTimeout(() => window.dispatchEvent(new CustomEvent('habashop:new-customer')),  300) } },
    { slug: 'expenses',  Icon: Receipt,      label: lang === 'en' ? 'New expense' : lang === 'es' ? 'Nuevo gasto' : lang === 'it' ? 'Nuova spesa' : 'Nouvelle dépense',   action: () => { navigate('/app/expenses');  setTimeout(() => window.dispatchEvent(new CustomEvent('habashop:new-expense')),   300) } },
    { slug: 'hr',        Icon: Users,        label: lang === 'en' ? 'New employee' : lang === 'es' ? 'Nuevo empleado' : lang === 'it' ? 'Nuovo dipendente' : 'Nouvel employé',  action: () => { navigate('/app/hr');        setTimeout(() => window.dispatchEvent(new CustomEvent('habashop:new-employee')),  300) } },
    { slug: 'suppliers', Icon: Truck,        label: lang === 'en' ? 'New supplier' : lang === 'es' ? 'Nuevo proveedor' : lang === 'it' ? 'Nuovo fornitore' : 'Nouveau fournisseur', action: () => { navigate('/app/suppliers'); setTimeout(() => window.dispatchEvent(new CustomEvent('habashop:new-supplier')),  300) } },
  ]
  const NEW_ITEMS = ALL_NEW_ITEMS.filter(item => canAccess(role, item.slug))

  useEffect(() => {
    const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
    fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => setApiStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'))
  }, [])

  useEffect(() => {
    alertsApi.lowStock()
      .then(data => setLowStockAlerts(data ?? []))
      .catch(() => {})
    const interval = setInterval(() => {
      alertsApi.lowStock().then(data => setLowStockAlerts(data ?? [])).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const newMenuRef = useRef<HTMLDivElement>(null)
  const notifsRef  = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setSwUpdate(true)
    window.addEventListener('sw-update', handler)
    return () => window.removeEventListener('sw-update', handler)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false)
      if (notifsRef.current  && !notifsRef.current.contains(e.target as Node))  setShowNotifs(false)
      if (searchRef.current  && !searchRef.current.contains(e.target as Node))  setShowResults(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const title = PAGE_TITLES[lang as keyof typeof PAGE_TITLES]?.[location.pathname]
    ?? PAGE_TITLES.fr[location.pathname]
    ?? 'HabaShop'

  const liveNotifs     = useNotificationStore(s => s.notifications)
  const liveUnread     = useNotificationStore(s => s.unreadCount)
  const markNotifsRead = useNotificationStore(s => s.markAllRead)

  const unreadCount = liveUnread + lowStockAlerts.length

  const liveNotifView = (n: LiveNotif): { icon: JSX.Element; title: string; message: string; route: string } => {
    if (n.type === 'new_sale')     return { icon: <ShoppingCart size={13} />, title: lang === 'en' ? 'New sale' : lang === 'es' ? 'Nueva venta' : lang === 'it' ? 'Nuova vendita' : 'Nouvelle vente',     message: `${(n.data?.total ?? 0).toLocaleString('fr-FR')} FCFA · ${n.data?.paymentMode ?? ''}`, route: '/app/reports' }
    if (n.type === 'low_stock')    return { icon: <Package size={13} />,      title: lang === 'en' ? 'Low stock' : lang === 'es' ? 'Stock bajo' : lang === 'it' ? 'Stock basso' : 'Stock bas',        message: `${n.data?.products?.length ?? 0} ${lang === 'en' ? 'product(s)' : lang === 'es' ? 'producto(s)' : lang === 'it' ? 'prodotto/i' : 'produit(s)'}`,       route: '/app/stock' }
    if (n.type === 'new_order')    return { icon: <Receipt size={13} />,      title: lang === 'en' ? 'New order' : lang === 'es' ? 'Nuevo pedido' : lang === 'it' ? 'Nuovo ordine' : 'Nouvelle commande',  message: `${n.data?.ref ?? ''}`,                                                                  route: '/app/orders' }
    if (n.type === 'new_customer') return { icon: <User size={13} />,         title: lang === 'en' ? 'New customer' : lang === 'es' ? 'Nuevo cliente' : lang === 'it' ? 'Nuovo cliente' : 'Nouveau client',  message: `${n.data?.name ?? ''}`,                                                                 route: '/app/customers' }
    return { icon: <Bell size={13} />, title: n.type, message: '', route: '/app/dashboard' }
  }

  function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); setShowResults(false); return }
    const results = SEARCH_INDEX.filter(item =>
      item.label.toLowerCase().includes(q.toLowerCase()) ||
      item.sub.toLowerCase().includes(q.toLowerCase()) ||
      item.type.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 6)
    setSearchResults(results)
    setShowResults(true)
  }

  function clearSearch() { setSearchQuery(''); setSearchResults([]); setShowResults(false) }

  function highlight(label: string) {
    const idx = label.toLowerCase().indexOf(searchQuery.toLowerCase())
    if (idx < 0) return <>{label}</>
    return (
      <>
        {label.slice(0, idx)}
        <span style={{ background: 'rgba(108,71,255,.25)', color: 'var(--p3)', borderRadius: 3, padding: '0 2px' }}>
          {label.slice(idx, idx + searchQuery.length)}
        </span>
        {label.slice(idx + searchQuery.length)}
      </>
    )
  }

  return (
    <>
      {/* ── Offline banner ── */}
      {!isOnline && (
        <div style={{
          background: 'rgba(255,184,0,.10)', border: '1px solid rgba(255,184,0,.25)',
          borderLeft: 'none', borderRight: 'none', padding: '7px 20px',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--warn)',
        }}>
          <WifiOff size={13} />
          <span>{lang === 'en' ? 'Offline — Data will sync on reconnect' : lang === 'es' ? 'Sin conexión — Los datos se sincronizarán al reconectar' : lang === 'it' ? 'Offline — I dati si sincronizzeranno alla riconnessione' : 'Mode hors-ligne — Synchronisation au retour de connexion'}</span>
        </div>
      )}

      <div className="app-header">
        {/* Page title with gradient */}
        <div style={{
          fontSize: 17, fontWeight: 900, flex: 1, letterSpacing: '-.3px',
          background: 'linear-gradient(135deg,var(--text) 40%,var(--p3))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>

        {/* ── Global search ── */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text4)', pointerEvents: 'none',
            }} />
            <input
              type="search"
              className="input"
              style={{ paddingLeft: 32, width: 230, fontSize: 12, minHeight: 36 }}
              aria-label={lang === 'en' ? 'Global search' : lang === 'es' ? 'Búsqueda global' : lang === 'it' ? 'Ricerca globale' : 'Recherche globale'}
              aria-expanded={showResults}
              autoComplete="off"
              placeholder={
                lang === 'fr' ? 'Rechercher…'
                : lang === 'en' ? 'Search…'
                : lang === 'es' ? 'Buscar…'
                : 'Cerca…'
              }
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => { if (searchQuery.length >= 2) setShowResults(true) }}
            />
            {searchQuery && (
              <button onClick={clearSearch} aria-label="Clear search" style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)',
                display: 'flex', alignItems: 'center', padding: 2,
              }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Search results */}
          {showResults && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 14,
              boxShadow: 'var(--sh-xl)', width: 340, zIndex: 300, overflow: 'hidden',
              animation: 'fadeIn .15s ease',
            }}>
              {searchResults.map((item, i) => {
                const ItemIcon = item.icon
                return (
                  <button key={i}
                    onClick={() => { navigate(item.path); clearSearch() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', background: 'none', border: 'none',
                      borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', transition: 'background .1s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: 'rgba(108,71,255,.12)', border: '1px solid rgba(108,71,255,.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p3)',
                    }}>
                      <ItemIcon size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {highlight(item.label)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{item.sub}</div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>{item.type}</span>
                  </button>
                )
              })}
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text4)', borderTop: '1px solid var(--border)' }}>
                {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} pour « {searchQuery} »
              </div>
            </div>
          )}
        </div>

        {/* ── API / online status ── */}
        <div title={apiStatus === 'online'
            ? (lang === 'en' ? 'API connected' : lang === 'es' ? 'API conectada' : lang === 'it' ? 'API connessa' : 'API connectée')
            : apiStatus === 'offline'
              ? (lang === 'en' ? 'API offline' : lang === 'es' ? 'API sin conexión' : lang === 'it' ? 'API non in linea' : 'API hors ligne')
              : (lang === 'en' ? 'Checking…' : lang === 'es' ? 'Verificando…' : lang === 'it' ? 'Verifica…' : 'Vérification…')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 20,
            background: apiStatus === 'online' ? 'rgba(0,208,132,.1)' : apiStatus === 'offline' ? 'rgba(255,59,92,.1)' : 'rgba(255,184,0,.1)',
            border: `1px solid ${apiStatus === 'online' ? 'rgba(0,208,132,.25)' : apiStatus === 'offline' ? 'rgba(255,59,92,.25)' : 'rgba(255,184,0,.25)'}`,
            cursor: 'default', flexShrink: 0,
          }}>
          {apiStatus === 'online'
            ? <Wifi size={11} style={{ color: 'var(--acc2)' }} />
            : apiStatus === 'offline'
              ? <WifiOff size={11} style={{ color: 'var(--danger)' }} />
              : <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warn)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          }
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: apiStatus === 'online' ? 'var(--acc2)' : apiStatus === 'offline' ? 'var(--danger)' : 'var(--warn)',
          }}>
            {apiStatus === 'online'
              ? (lang === 'en' ? 'Online' : lang === 'es' ? 'En línea' : lang === 'it' ? 'Online' : 'En ligne')
              : apiStatus === 'offline'
                ? (lang === 'en' ? 'Offline' : lang === 'es' ? 'Sin conexión' : lang === 'it' ? 'Non in linea' : 'Hors ligne')
                : '…'}
          </span>
        </div>

        {/* ── Plan / trial badge ── */}
        {tenant && (() => {
          const trial = getTrialInfo(tenant)
          const planLabel = tenant.plan ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) : 'Free'
          const danger = trial.isTrial && trial.daysLeft <= 3
          const color  = danger ? 'var(--danger)' : trial.isTrial ? 'var(--warn)' : 'var(--p3)'
          const bg     = danger ? 'rgba(255,59,92,.10)' : trial.isTrial ? 'rgba(255,184,0,.10)' : 'rgba(108,71,255,.12)'
          const border = danger ? 'rgba(255,59,92,.25)' : trial.isTrial ? 'rgba(255,184,0,.25)' : 'rgba(108,71,255,.25)'
          return (
            <div
              title={trial.isTrial
                ? (lang === 'en' ? `Free trial — ${trial.daysLeft} day(s) left` : lang === 'es' ? `Prueba gratuita — ${trial.daysLeft} día(s) restante(s)` : lang === 'it' ? `Prova gratuita — ${trial.daysLeft} giorno/i rimanente/i` : `Essai gratuit — ${trial.daysLeft} jour(s) restant(s)`)
                : (lang === 'en' ? `${planLabel} plan` : lang === 'it' ? `Piano ${planLabel}` : `Plan ${planLabel}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                background: bg, border: `1px solid ${border}`, color, flexShrink: 0,
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', cursor: 'default',
              }}>
              {trial.isTrial
                ? <><Clock size={11} />{lang === 'en' ? `Trial · ${trial.daysLeft}d` : lang === 'es' ? `Prueba · ${trial.daysLeft}d` : lang === 'it' ? `Prova · ${trial.daysLeft}g` : `Essai · ${trial.daysLeft}j`}</>
                : <><Crown size={11} />{planLabel}</>}
            </div>
          )
        })()}

        <LanguageSwitcher />
        <CurrencyBadge />

        {/* ── + Nouveau button ── (hidden if role has zero quick-create actions) */}
        {NEW_ITEMS.length > 0 && (
        <div ref={newMenuRef} style={{ position: 'relative' }}>
          <button
            className="topbar-btn"
            onClick={() => { setShowNewMenu(v => !v); setShowNotifs(false); setShowResults(false) }}
            aria-expanded={showNewMenu}
          >
            <Plus size={14} />
            {t('btn_new')}
            <ChevronDown size={12} style={{ opacity: .7, transform: showNewMenu ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>

          {showNewMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000,
              background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 18,
              padding: 8, boxShadow: 'var(--sh-xl)', minWidth: 220,
              animation: 'slideDown .2s var(--spring)',
            }}>
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 1, background: 'linear-gradient(90deg,transparent,var(--p),transparent)' }} />
              <div style={{ padding: '6px 10px 8px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text4)' }}>
                {lang === 'en' ? 'QUICK CREATE' : lang === 'es' ? 'CREAR RÁPIDO' : lang === 'it' ? 'CREA RAPIDO' : 'CRÉER RAPIDEMENT'}
              </div>
              {NEW_ITEMS.map((item, i) => {
                const ItemIcon = item.Icon
                return (
                  <button key={i} type="button"
                    onClick={() => { item.action(); setShowNewMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '9px 12px', borderRadius: 12, background: 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', transition: 'background .1s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(108,71,255,.12)', border: '1px solid rgba(108,71,255,.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p3)',
                    }}>
                      <ItemIcon size={15} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* ── Notifications bell ── */}
        <div ref={notifsRef} style={{ position: 'relative' }}>
          <button
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={showNotifs}
            onClick={() => { setShowNotifs(v => { if (!v) markNotifsRead(); return !v }); setShowNewMenu(false); setShowResults(false) }}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '7px 9px', cursor: 'pointer', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg4)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
          >
            <Bell size={15} style={{ color: 'var(--text2)' }} />
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute', top: 3, right: 3, width: 16, height: 16,
                borderRadius: '50%', background: 'var(--danger)', color: '#fff',
                fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center',
                justifyContent: 'center', border: '2px solid var(--bg2)',
                boxShadow: '0 0 8px rgba(255,59,92,.5)',
              }}>{unreadCount}</div>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 16, boxShadow: 'var(--sh-xl)', width: 340,
              zIndex: 200, animation: 'fadeIn .15s ease', overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                background: 'linear-gradient(135deg,rgba(108,71,255,.08),rgba(139,111,255,.04))',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, background: 'rgba(108,71,255,.15)',
                    border: '1px solid rgba(108,71,255,.25)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--p3)',
                  }}>
                    <Bell size={14} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span style={{
                    background: 'var(--danger)', color: '#fff',
                    borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 800,
                  }}>{unreadCount} non lues</span>
                )}
              </div>

              {/* Notification list */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {/* Live WebSocket notifications */}
                {liveNotifs.map((n) => {
                  const v = liveNotifView(n)
                  return (
                    <button key={n.id} type="button"
                      aria-label={v.title}
                      onClick={() => { navigate(v.route); setShowNotifs(false) }}
                      style={{
                        display: 'flex', gap: 12, padding: '11px 16px', width: '100%',
                        background: 'rgba(108,71,255,.05)', border: 'none',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '3px solid var(--p2)', cursor: 'pointer',
                        fontFamily: 'var(--font)', textAlign: 'left',
                      }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(108,71,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p3)' }}>
                        {v.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{v.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{v.message}</div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text4)', flexShrink: 0, marginTop: 3 }}>
                        {new Date(n.ts).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  )
                })}

                {/* Real-time low stock */}
                {lowStockAlerts.slice(0, 3).map((product) => (
                  <button key={product.id} type="button"
                    aria-label={`Stock faible: ${product.name}`}
                    onClick={() => { navigate('/app/stock'); setShowNotifs(false) }}
                    style={{
                      display: 'flex', gap: 12, padding: '10px 16px', width: '100%',
                      background: 'rgba(255,59,92,.04)', border: 'none',
                      borderBottom: '1px solid var(--border)',
                      borderLeft: '3px solid var(--danger)', cursor: 'pointer',
                      fontFamily: 'var(--font)', textAlign: 'left',
                    }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(255,59,92,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                      <Package size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                        {lang === 'en' ? 'Low stock' : lang === 'es' ? 'Stock bajo' : lang === 'it' ? 'Stock basso' : 'Rupture stock'} — {product.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        Stock: {product.stockQty} / Seuil: {product.stockMin}
                      </div>
                    </div>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, marginTop: 5, boxShadow: '0 0 6px var(--danger)' }} />
                  </button>
                ))}

                {/* Empty state */}
                {liveNotifs.length === 0 && lowStockAlerts.length === 0 && (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)' }}>
                    <Bell size={24} style={{ opacity: .4, marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>{lang === 'en' ? 'No notifications' : lang === 'es' ? 'Sin notificaciones' : lang === 'it' ? 'Nessuna notifica' : 'Aucune notification'}</div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { navigate('/app/notifications'); setShowNotifs(false) }}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '9px', borderRadius: 10 }}
                >
                  {lang === 'en' ? 'View all notifications' : lang === 'es' ? 'Ver todas las notificaciones' : lang === 'it' ? 'Vedi tutte le notifiche' : 'Voir toutes les notifications'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SW update banner ── */}
      {swUpdate && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          background: 'var(--bg3)', border: '1px solid var(--p2)',
          borderRadius: 14, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: 'var(--sh-p)',
          animation: 'slideUp .3s ease',
        }}>
          <Zap size={15} style={{ color: 'var(--p3)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {lang === 'en' ? 'Update available' : lang === 'es' ? 'Actualización disponible' : lang === 'it' ? 'Aggiornamento disponibile' : 'Mise à jour disponible'}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, minHeight: 'auto' }}
          >
            {lang === 'en' ? 'Refresh' : lang === 'es' ? 'Actualizar' : lang === 'it' ? 'Aggiorna' : 'Actualiser'}
          </button>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}
            onClick={() => setSwUpdate(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', display: 'flex', alignItems: 'center', padding: 2 }}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </>
  )
}
