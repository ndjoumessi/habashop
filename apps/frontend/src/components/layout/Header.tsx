import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAppStore, t } from '@/stores/appStore'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import CurrencyBadge from '@/components/ui/CurrencyBadge'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import toast from 'react-hot-toast'
import { alertsApi } from '@/lib/api'

// ── Titres multilingues ────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
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
}

const PAGE_TITLES_EN: Record<string, string> = {
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
}

const PAGE_TITLES_ES: Record<string, string> = {
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
}

const PAGE_TITLES_IT: Record<string, string> = {
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
}

const TITLES_MAP = { fr: PAGE_TITLES, en: PAGE_TITLES_EN, es: PAGE_TITLES_ES, it: PAGE_TITLES_IT }


// ── Notifications récentes ─────────────────────────────────────────────────────

const RECENT_NOTIFS = [
  { id:1, type:'danger',  module:'STOCK', title:'Rupture stock critique',       message:'Riz parfumé 5kg — Stock: 12',   time:'il y a 5 min',  read:false },
  { id:2, type:'danger',  module:'STOCK', title:'Rupture stock critique',       message:'Savon OMO 500g — Stock: 5',     time:'il y a 12 min', read:false },
  { id:3, type:'warning', module:'AUTH',  title:'Tentative connexion suspecte', message:'3 tentatives IP: 41.82.100.24', time:'il y a 1h',     read:false },
  { id:4, type:'success', module:'POS',   title:'Objectif journalier dépassé',  message:'CA: 842 000 FCFA — +5,25 %',   time:'il y a 2h',     read:false },
  { id:5, type:'info',    module:'PAIE',  title:'Bulletins de paie générés',    message:'6 bulletins Mai 2026 prêts',    time:'il y a 3h',     read:true  },
]

const NOTIF_ROUTES: Record<string, string> = {
  'STOCK':      '/app/stock',
  'AUTH':       '/app/activity',
  'POS':        '/app/reports',
  'PAIE':       '/app/payroll',
  'RH':         '/app/hr',
  'COMMANDES':  '/app/orders',
  'CLIENTS':    '/app/customers',
  'SYSTÈME':    '/app/settings',
  'PARAMÈTRES': '/app/settings',
}

const TYPE_COLORS: Record<string, string> = {
  danger:'var(--danger)', warning:'var(--acc)', success:'var(--acc2)', info:'var(--p2)',
}
const TYPE_ICONS: Record<string, string> = {
  danger:'🚨', warning:'⚠️', success:'✅', info:'ℹ️',
}
const TYPE_RGB: Record<string, string> = {
  danger:'232,64,74', warning:'240,165,0', success:'14,196,126', info:'91,78,232',
}

// ── Index de recherche global ──────────────────────────────────────────────────

const SEARCH_INDEX = [
  { type:'Produit',     label:'Riz parfumé 5kg',       sub:'Stock: 120 · 4 500 FCFA',  path:'/app/stock',     emoji:'🌾' },
  { type:'Produit',     label:'Huile palme 1L',         sub:'Stock: 18 · 1 800 FCFA',   path:'/app/stock',     emoji:'🫙' },
  { type:'Produit',     label:'Sucre 1kg',              sub:'Stock: 245 · 850 FCFA',    path:'/app/stock',     emoji:'🍚' },
  { type:'Produit',     label:'Farine blé 1kg',         sub:'Stock: 89 · 650 FCFA',     path:'/app/stock',     emoji:'🌾' },
  { type:'Produit',     label:'Savon OMO 500g',         sub:'⚠️ Stock faible: 5',       path:'/app/stock',     emoji:'🧼' },
  { type:'Produit',     label:'Lait poudre 400g',       sub:'Stock: 67 · 2 200 FCFA',   path:'/app/stock',     emoji:'🥛' },
  { type:'Client',      label:'Mamadou Diallo',         sub:'Grossiste · Dakar',         path:'/app/customers', emoji:'👤' },
  { type:'Client',      label:'Fatou Ndiaye',           sub:'Fidèle · Saint-Louis',      path:'/app/customers', emoji:'👤' },
  { type:'Client',      label:'Ibrahim Koné',           sub:'Semi-gros · Thiès',         path:'/app/customers', emoji:'👤' },
  { type:'Fournisseur', label:'SONACO',                 sub:'Corps gras · ⭐⭐⭐⭐',      path:'/app/suppliers', emoji:'🏭' },
  { type:'Fournisseur', label:'SENRIZ',                 sub:'Céréales · ⭐⭐⭐⭐⭐',      path:'/app/suppliers', emoji:'🏭' },
  { type:'Fournisseur', label:'UNILEVER',               sub:'Hygiène · ⭐⭐⭐⭐',         path:'/app/suppliers', emoji:'🏭' },
  { type:'Employé',     label:'Marie Bakayoko',         sub:'Caissière · Ventes',        path:'/app/hr',        emoji:'👤' },
  { type:'Employé',     label:'Kofi Diallo',            sub:'Magasinier · Stock',        path:'/app/hr',        emoji:'👤' },
  { type:'Employé',     label:'Fatoumata Ndiaye',       sub:'Responsable · Direction',   path:'/app/hr',        emoji:'👤' },
  { type:'Page',        label:'Tableau de bord',        sub:'Vue générale KPIs',         path:'/app/dashboard', emoji:'🏠' },
  { type:'Page',        label:'Point de vente',         sub:'Caisse et encaissement',    path:'/app/pos',       emoji:'🛒' },
  { type:'Page',        label:'Gestion des stocks',     sub:'Inventaire et alertes',     path:'/app/stock',     emoji:'📦' },
  { type:'Page',        label:'Commandes fournisseurs', sub:'Suivi et réception',        path:'/app/orders',    emoji:'📋' },
  { type:'Page',        label:'Rapports et analyses',   sub:'KPIs et exports',           path:'/app/reports',   emoji:'📊' },
  { type:'Page',        label:'Ressources humaines',    sub:'Équipe et contrats',        path:'/app/hr',        emoji:'👥' },
  { type:'Page',        label:'Planning hebdomadaire',  sub:'Créneaux et congés',        path:'/app/planning',  emoji:'📅' },
  { type:'Page',        label:'Bulletins de paie',      sub:'Salaires et virements',     path:'/app/payroll',   emoji:'💰' },
  { type:'Page',        label:'Journal des dépenses',   sub:'Budget et catégories',      path:'/app/expenses',  emoji:'🧾' },
  { type:'Page',        label:'Prévisions',             sub:'Stock et trésorerie',       path:'/app/forecasts', emoji:'🔮' },
  { type:'Page',        label:'Paramètres',             sub:'Configuration boutique',    path:'/app/settings',  emoji:'⚙️' },
]

// ── Composant ──────────────────────────────────────────────────────────────────

export default function Header() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { lang }  = useAppStore()

  const isOnline = useOnlineStatus()
  const [showNewMenu,    setShowNewMenu]    = useState(false)
  const [showNotifs,     setShowNotifs]     = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [searchResults,  setSearchResults]  = useState<typeof SEARCH_INDEX>([])
  const [showResults,    setShowResults]    = useState(false)
  const [apiStatus,      setApiStatus]      = useState<'online'|'offline'|'checking'>('checking')
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([])
  const [swUpdate,       setSwUpdate]       = useState(false)

  // Items du menu Nouveau avec navigation + CustomEvents
  const NEW_ITEMS = [
    {
      icon:'🛒',
      label: lang === 'fr' ? 'Nouvelle vente' : 'New sale',
      action: () => navigate('/app/pos'),
    },
    {
      icon:'📦',
      label: lang === 'fr' ? 'Nouveau produit' : 'New product',
      action: () => {
        navigate('/app/stock')
        setTimeout(() => { window.dispatchEvent(new CustomEvent('habashop:new-product')) }, 300)
      },
    },
    {
      icon:'👤',
      label: lang === 'fr' ? 'Nouveau client' : 'New customer',
      action: () => {
        navigate('/app/customers')
        setTimeout(() => { window.dispatchEvent(new CustomEvent('habashop:new-customer')) }, 300)
      },
    },
    {
      icon:'🧾',
      label: lang === 'fr' ? 'Nouvelle dépense' : 'New expense',
      action: () => {
        navigate('/app/expenses')
        setTimeout(() => { window.dispatchEvent(new CustomEvent('habashop:new-expense')) }, 300)
      },
    },
    {
      icon:'👥',
      label: lang === 'fr' ? 'Nouvel employé' : 'New employee',
      action: () => {
        navigate('/app/hr')
        setTimeout(() => { window.dispatchEvent(new CustomEvent('habashop:new-employee')) }, 300)
      },
    },
    {
      icon:'🏭',
      label: lang === 'fr' ? 'Nouveau fournisseur' : 'New supplier',
      action: () => {
        navigate('/app/suppliers')
        setTimeout(() => { window.dispatchEvent(new CustomEvent('habashop:new-supplier')) }, 300)
      },
    },
  ]

  useEffect(() => {
    const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
    fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => setApiStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'))
  }, [])

  useEffect(() => {
    const fetchAlerts = () => {
      alertsApi.lowStock()
        .then(data => setLowStockAlerts(data ?? []))
        .catch(() => {})
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 60000)
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

  // Fermer tous les dropdowns au clic extérieur
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false)
      if (notifsRef.current  && !notifsRef.current.contains(e.target as Node))  setShowNotifs(false)
      if (searchRef.current  && !searchRef.current.contains(e.target as Node))  setShowResults(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Titre traduit selon la langue active
  const title = TITLES_MAP[lang as keyof typeof TITLES_MAP]?.[location.pathname]
    ?? PAGE_TITLES[location.pathname]
    ?? 'HabaShop'

  const unreadCount = Math.max(RECENT_NOTIFS.filter(n => !n.read).length, lowStockAlerts.length)

  // Recherche globale
  function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); setShowResults(false); return }
    const results = SEARCH_INDEX.filter(item =>
      item.label.toLowerCase().includes(q.toLowerCase()) ||
      item.sub.toLowerCase().includes(q.toLowerCase())   ||
      item.type.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8)
    setSearchResults(results)
    setShowResults(true)
  }

  function clearSearch() { setSearchQuery(''); setSearchResults([]); setShowResults(false) }

  // Grouper les résultats par type
  const groupedResults = searchResults.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  }, {} as Record<string, typeof SEARCH_INDEX>)

  // Surligner le terme dans un label
  function highlight(label: string) {
    const idx = label.toLowerCase().indexOf(searchQuery.toLowerCase())
    if (idx < 0) return <>{label}</>
    return (
      <>
        {label.slice(0, idx)}
        <span style={{ background:'rgba(91,78,232,.25)', color:'var(--p2)', borderRadius:3, padding:'0 2px' }}>
          {label.slice(idx, idx + searchQuery.length)}
        </span>
        {label.slice(idx + searchQuery.length)}
      </>
    )
  }

  return (
    <>
    {!isOnline && (
      <div style={{
        background: 'rgba(240,165,0,.12)',
        border: '1px solid rgba(240,165,0,.3)',
        borderLeft: 'none', borderRight: 'none',
        padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, fontWeight: 600, color: 'var(--acc)',
      }}>
        <span>📡</span>
        <span>{lang === 'fr' ? 'Mode hors-ligne — Les données seront synchronisées au retour de la connexion' : 'Offline mode — Data will sync when connection is restored'}</span>
      </div>
    )}
    <div className="topbar">
      <div className="page-title" style={{
        background: 'linear-gradient(135deg, var(--text) 40%, var(--p3))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>{title}</div>

      {/* ── Recherche globale ── */}
      <div ref={searchRef} style={{ position:'relative' }}>
        <div style={{ position:'relative' }}>
          <Search size={14} style={{
            position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            color:'var(--text3)', pointerEvents:'none',
          }} />
          <input
            className="input"
            style={{ paddingLeft:34, width:240, fontSize:13 }}
            placeholder={
              lang === 'fr' ? 'Rechercher produit, client...' :
              lang === 'en' ? 'Search product, client...' :
              lang === 'es' ? 'Buscar producto, cliente...' :
              'Cerca prodotto, cliente...'
            }
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => { if (searchQuery.length >= 2) setShowResults(true) }}
          />
          {searchQuery && (
            <button onClick={clearSearch} style={{
              position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', cursor:'pointer',
              color:'var(--text3)', fontSize:14, lineHeight:1,
            }}>✕</button>
          )}
        </div>

        {/* Résultats */}
        {showResults && searchResults.length > 0 && (
          <div style={{
            position:'absolute', top:'calc(100% + 8px)', left:0,
            background:'var(--card)',
            border:'1px solid var(--border2)',
            borderRadius:14,
            boxShadow:'0 20px 60px rgba(0,0,0,.5)',
            width:360, zIndex:300,
            overflow:'hidden',
            animation:'fadeIn .15s ease',
          }}>
            {Object.entries(groupedResults).map(([type, items]) => (
              <div key={type}>
                <div style={{
                  padding:'8px 14px 4px',
                  fontSize:10, fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'.8px',
                  color:'var(--text3)',
                  borderBottom:'1px solid var(--border)',
                }}>{type}s</div>
                {items.map((item, i) => (
                  <button key={i}
                    onClick={() => { navigate(item.path); clearSearch() }}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      width:'100%', padding:'10px 14px',
                      background:'none', border:'none',
                      borderBottom:'1px solid var(--border)',
                      cursor:'pointer', fontFamily:'var(--font)',
                      transition:'background .1s', textAlign:'left',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    <div style={{
                      width:34, height:34, borderRadius:9, flexShrink:0,
                      background:'rgba(91,78,232,.12)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                    }}>{item.emoji}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:13, fontWeight:600, color:'var(--text)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{highlight(item.label)}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{item.sub}</div>
                    </div>
                    <span style={{
                      fontSize:10, color:'var(--text3)',
                      background:'var(--bg3)', border:'1px solid var(--border)',
                      borderRadius:6, padding:'2px 7px',
                      whiteSpace:'nowrap', flexShrink:0,
                    }}>{item.type}</span>
                  </button>
                ))}
              </div>
            ))}
            <div style={{
              padding:'10px 14px', fontSize:11, color:'var(--text3)',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <span>⌨️</span>
              <span>{searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} pour « {searchQuery} »</span>
            </div>
          </div>
        )}

        {/* Aucun résultat */}
        {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div style={{
            position:'absolute', top:'calc(100% + 8px)', left:0,
            background:'var(--card)',
            border:'1px solid var(--border2)',
            borderRadius:14,
            boxShadow:'0 20px 60px rgba(0,0,0,.5)',
            width:320, zIndex:300, padding:'24px 20px',
            textAlign:'center',
          }}>
            <div style={{ fontSize:24, marginBottom:8 }}>🔍</div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:4 }}>Aucun résultat</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>Aucun résultat pour « {searchQuery} »</div>
          </div>
        )}
      </div>

      {/* ── Indicateur API ── */}
      <div title={apiStatus === 'online' ? 'API connectée' : apiStatus === 'offline' ? 'API hors ligne' : 'Connexion…'}
        style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', borderRadius:20,
          background: apiStatus === 'online' ? 'rgba(14,196,126,.12)' : apiStatus === 'offline' ? 'rgba(239,68,68,.12)' : 'rgba(240,165,0,.12)',
          border: `1px solid ${apiStatus === 'online' ? 'rgba(14,196,126,.3)' : apiStatus === 'offline' ? 'rgba(239,68,68,.3)' : 'rgba(240,165,0,.3)'}`,
          cursor:'default',
        }}>
        <span style={{ width:7, height:7, borderRadius:'50%',
          background: apiStatus === 'online' ? 'var(--acc2)' : apiStatus === 'offline' ? 'var(--danger)' : 'var(--acc)',
          display:'inline-block',
          boxShadow: apiStatus === 'online' ? '0 0 6px var(--acc2)' : undefined,
          animation: apiStatus === 'checking' ? 'pulse 1.4s ease-in-out infinite' : undefined,
        }} />
        <span style={{ fontSize:10, fontWeight:600, color: apiStatus === 'online' ? 'var(--acc2)' : apiStatus === 'offline' ? 'var(--danger)' : 'var(--acc)' }}>
          {apiStatus === 'online' ? 'Live' : apiStatus === 'offline' ? 'Hors ligne' : '…'}
        </span>
      </div>

      <LanguageSwitcher />
      <CurrencyBadge />

      {/* ── Bouton ＋ Nouveau ── */}
      <div ref={newMenuRef} style={{ position:'relative' }}>
        <button className="topbar-btn"
          onClick={() => { setShowNewMenu(v => !v); setShowNotifs(false); setShowResults(false) }}>
          ＋ {t('btn_new')}
        </button>

        {showNewMenu && (
          <div style={{
            position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:1000,
            background:'#0D0D1C',
            border:'1px solid rgba(255,255,255,.1)',
            borderRadius:18, padding:8,
            boxShadow:'0 16px 48px rgba(0,0,0,.7)',
            minWidth:220,
            animation:'slideDown .2s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <div style={{
              position:'absolute', top:0, left:'50%',
              transform:'translateX(-50%)',
              width:'60%', height:1,
              background:'linear-gradient(90deg,transparent,var(--p),transparent)',
            }}/>
            <div style={{
              padding:'6px 10px 8px',
              fontSize:9, fontWeight:800,
              textTransform:'uppercase', letterSpacing:'.8px',
              color:'var(--text3)',
            }}>
              {lang === 'fr' ? 'CRÉER RAPIDEMENT' : 'QUICK CREATE'}
            </div>
            {NEW_ITEMS.map((item, i) => (
              <button key={i} type="button"
                onClick={() => { item.action(); setShowNewMenu(false) }}
                style={{
                  display:'flex', alignItems:'center',
                  gap:12, width:'100%',
                  padding:'10px 12px', borderRadius:12,
                  background:'transparent',
                  border:'none', cursor:'pointer',
                  fontFamily:'var(--font)',
                  transition:'background .1s',
                  textAlign:'left',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{
                  width:36, height:36, borderRadius:10,
                  background:'rgba(108,71,255,.12)',
                  border:'1px solid rgba(108,71,255,.2)',
                  display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:18, flexShrink:0,
                }}>
                  {item.icon}
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bouton cloche ── */}
      <div ref={notifsRef} style={{ position:'relative' }}>
        <button
          onClick={() => { setShowNotifs(v => !v); setShowNewMenu(false); setShowResults(false) }}
          style={{
            background:'var(--bg3)',
            border:'1px solid var(--border)',
            borderRadius:8, padding:'7px 9px',
            cursor:'pointer', position:'relative',
            fontSize:15, lineHeight:1,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .15s',
          }}
        >
          🔔
          {unreadCount > 0 && (
            <div style={{
              position:'absolute', top:3, right:3,
              width:16, height:16, borderRadius:'50%',
              background:'var(--danger)',
              color:'#fff', fontSize:9, fontWeight:800,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px solid var(--bg2)',
              boxShadow:'0 0 8px rgba(232,64,74,.5)',
            }}>{unreadCount}</div>
          )}
        </button>

        {showNotifs && (
          <div style={{
            position:'absolute', top:'calc(100% + 8px)', right:0,
            background:'var(--card)',
            border:'1px solid var(--border2)',
            borderRadius:14,
            boxShadow:'0 20px 60px rgba(0,0,0,.4)',
            width:340, zIndex:200,
            animation:'fadeIn .15s ease',
            overflow:'hidden',
          }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 16px',
              borderBottom:'1px solid var(--border)',
              background:'linear-gradient(135deg, rgba(91,78,232,.1), rgba(124,111,240,.06))',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:14 }}>🔔</span>
                <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span style={{
                  background:'var(--danger)', color:'#fff',
                  borderRadius:20, padding:'2px 8px',
                  fontSize:11, fontWeight:800,
                }}>{unreadCount} non lues</span>
              )}
            </div>

            <div style={{ maxHeight:360, overflowY:'auto' }}>
              {/* Alertes stock temps réel */}
              {lowStockAlerts.slice(0,3).map((product) => (
                <div key={product.id} style={{
                  display:'flex', gap:12, padding:'10px 16px',
                  borderBottom:'1px solid var(--border)',
                  background:'rgba(232,64,74,.05)',
                  borderLeft:'3px solid var(--danger)',
                  cursor:'pointer',
                }}
                  onClick={() => { navigate('/app/stock'); setShowNotifs(false) }}
                >
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0,
                    background:'rgba(232,64,74,.15)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                  }}>⚠️</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
                      {lang === 'fr' ? 'Rupture stock'
                        : lang === 'en' ? 'Low stock alert'
                        : lang === 'es' ? 'Alerta stock'
                        : 'Allerta stock'} — {product.name}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang === 'fr'
                        ? `Stock: ${product.stockQty} / Seuil: ${product.stockMin}`
                        : `Stock: ${product.stockQty} / Min: ${product.stockMin}`}
                    </div>
                  </div>
                  <div style={{
                    width:8, height:8, borderRadius:'50%',
                    background:'var(--danger)', flexShrink:0, marginTop:6,
                    boxShadow:'0 0 6px var(--danger)',
                  }} />
                </div>
              ))}
              {RECENT_NOTIFS.map(notif => {
                const rgb = TYPE_RGB[notif.type] ?? '91,78,232'
                return (
                  <div key={notif.id} style={{
                    display:'flex', gap:12, padding:'12px 16px',
                    borderBottom:'1px solid var(--border)',
                    background: notif.read ? 'transparent' : `rgba(${rgb},.05)`,
                    borderLeft: notif.read
                      ? '3px solid transparent'
                      : `3px solid ${TYPE_COLORS[notif.type] ?? 'var(--p2)'}`,
                    cursor:'pointer', transition:'background .12s',
                  }}
                    onClick={() => {
                      const route = NOTIF_ROUTES[notif.module] ?? '/app/dashboard'
                      navigate(route)
                      setShowNotifs(false)
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = notif.read ? 'transparent' : `rgba(${rgb},.05)`}
                  >
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background:`rgba(${rgb},.15)`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                    }}>{TYPE_ICONS[notif.type] ?? 'ℹ️'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12.5, fontWeight: notif.read ? 500 : 700,
                        color:'var(--text)', marginBottom:3,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{notif.title}</div>
                      <div style={{ fontSize:11.5, color:'var(--text2)', marginBottom:4, lineHeight:1.4 }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>{notif.time}</div>
                    </div>
                    {!notif.read && (
                      <div style={{
                        width:8, height:8, borderRadius:'50%',
                        background:'var(--danger)', flexShrink:0,
                        marginTop:6, boxShadow:'0 0 6px var(--danger)',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
              <button
                onClick={() => { navigate('/app/notifications'); setShowNotifs(false) }}
                style={{
                  width:'100%',
                  background:'linear-gradient(135deg, var(--p), var(--p2))',
                  border:'none', borderRadius:9, padding:8,
                  fontSize:12, fontWeight:700, color:'#fff',
                  cursor:'pointer', fontFamily:'var(--font)',
                }}
              >Voir toutes les notifications →</button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Banner mise à jour SW ── */}
    {swUpdate && (
      <div style={{
        position:'fixed', bottom:20, right:20, zIndex:9999,
        background:'var(--p)',
        border:'1px solid var(--p2)',
        borderRadius:14, padding:'12px 18px',
        display:'flex', alignItems:'center', gap:12,
        boxShadow:'0 8px 24px rgba(108,71,255,.4)',
        animation:'slideUp .3s ease',
      }}>
        <span style={{ fontSize:14, color:'#fff' }}>
          🔄 {lang === 'fr' ? 'Mise à jour disponible' : 'Update available'}
        </span>
        <button
          onClick={() => window.location.reload()}
          style={{
            background:'#fff', color:'var(--p)',
            border:'none', borderRadius:8,
            padding:'5px 12px', fontWeight:800,
            cursor:'pointer', fontSize:12,
          }}>
          {lang === 'fr' ? 'Actualiser' : 'Refresh'}
        </button>
      </div>
    )}
    </>
  )
}
