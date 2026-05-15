import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAppStore, t } from '@/stores/appStore'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import CurrencyBadge from '@/components/ui/CurrencyBadge'
import toast from 'react-hot-toast'

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

// ── Menu + Nouveau ─────────────────────────────────────────────────────────────

const NEW_MENU_ITEMS: Record<string, { label: string; icon: string }[]> = {
  '/app/stock':     [
    { label:'Nouveau produit',     icon:'📦' },
    { label:'Réception stock',     icon:'📥' },
    { label:'Bon de commande',     icon:'📋' },
  ],
  '/app/orders':    [
    { label:'Nouvelle commande',   icon:'📦' },
    { label:'Bon de livraison',    icon:'🚚' },
  ],
  '/app/customers': [
    { label:'Nouveau client',      icon:'👤' },
    { label:'Nouveau devis',       icon:'📄' },
  ],
  '/app/suppliers': [
    { label:'Nouveau fournisseur', icon:'🏭' },
    { label:'Nouvelle commande',   icon:'📦' },
  ],
  '/app/hr':        [
    { label:'Nouvel employé',      icon:'👤' },
    { label:'Nouveau contrat',     icon:'📄' },
    { label:'Demande de congé',    icon:'🏖️' },
  ],
  '/app/expenses':  [
    { label:'Nouvelle dépense',    icon:'🧾' },
    { label:'Nouveau budget',      icon:'💰' },
  ],
  '/app/pos':       [
    { label:'Nouvelle vente',      icon:'🛒' },
    { label:'Nouveau client',      icon:'👤' },
  ],
}

const DEFAULT_ITEMS = [
  { label:'Nouvelle vente',   icon:'🛒' },
  { label:'Nouveau produit',  icon:'📦' },
  { label:'Nouveau client',   icon:'👤' },
  { label:'Nouvelle dépense', icon:'🧾' },
]

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

  const [showNewMenu,    setShowNewMenu]    = useState(false)
  const [showNotifs,     setShowNotifs]     = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [searchResults,  setSearchResults]  = useState<typeof SEARCH_INDEX>([])
  const [showResults,    setShowResults]    = useState(false)

  const newMenuRef = useRef<HTMLDivElement>(null)
  const notifsRef  = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLDivElement>(null)

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

  const menuItems   = NEW_MENU_ITEMS[location.pathname] ?? DEFAULT_ITEMS
  const unreadCount = RECENT_NOTIFS.filter(n => !n.read).length

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
    <div className="topbar">
      <div className="page-title">{title}</div>

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
            placeholder="Rechercher produit, client..."
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
            position:'absolute', top:'calc(100% + 8px)', right:0,
            background:'var(--card)',
            border:'1px solid var(--border2)',
            borderRadius:14,
            boxShadow:'0 20px 60px rgba(0,0,0,.4)',
            padding:6, minWidth:210, zIndex:200,
            animation:'fadeIn .15s ease',
          }}>
            {menuItems.map((item, i) => (
              <button key={i}
                onClick={() => { toast(`${item.icon} ${item.label}`); setShowNewMenu(false) }}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  width:'100%', padding:'9px 12px',
                  background:'none', border:'none',
                  borderRadius:9, cursor:'pointer',
                  fontSize:13, fontWeight:500,
                  color:'var(--text)', fontFamily:'var(--font)',
                  transition:'background .12s', textAlign:'left',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
              >
                <span style={{
                  width:30, height:30, borderRadius:8,
                  background:'rgba(91,78,232,.12)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:15, flexShrink:0,
                }}>{item.icon}</span>
                {item.label}
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

            <div style={{ maxHeight:320, overflowY:'auto' }}>
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
  )
}
