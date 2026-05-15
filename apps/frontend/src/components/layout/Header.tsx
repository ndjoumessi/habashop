import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useConfig, t } from '@/stores/appStore'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import CurrencyBadge from '@/components/ui/CurrencyBadge'
import toast from 'react-hot-toast'

const TITLE_KEYS: Record<string, string> = {
  '/app/dashboard':     'nav_dashboard',
  '/app/pos':           'nav_pos',
  '/app/stock':         'nav_stock',
  '/app/orders':        'nav_orders',
  '/app/suppliers':     'nav_suppliers',
  '/app/customers':     'nav_customers',
  '/app/reports':       'nav_reports',
  '/app/hr':            'nav_hr',
  '/app/planning':      'nav_planning',
  '/app/payroll':       'nav_payroll',
  '/app/expenses':      'nav_expenses',
  '/app/forecasts':     'nav_forecasts',
  '/app/users':         'nav_users',
  '/app/activity':      'nav_activity',
  '/app/notifications': 'nav_notifications',
  '/app/settings':      'nav_settings',
}

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

const RECENT_NOTIFS = [
  { id:1, type:'danger',  title:'Rupture stock critique',       message:'Riz parfumé 5kg — Stock: 12',   time:'il y a 5 min',  read:false },
  { id:2, type:'danger',  title:'Rupture stock critique',       message:'Savon OMO 500g — Stock: 5',     time:'il y a 12 min', read:false },
  { id:3, type:'warning', title:'Tentative connexion suspecte', message:'3 tentatives IP: 41.82.100.24', time:'il y a 1h',     read:false },
  { id:4, type:'success', title:'Objectif journalier dépassé',  message:'CA: 842 000 FCFA — +5,25 %',   time:'il y a 2h',     read:false },
  { id:5, type:'info',    title:'Bulletins de paie générés',    message:'6 bulletins Mai 2026 prêts',    time:'il y a 3h',     read:true  },
]

const TYPE_COLORS: Record<string, string> = {
  danger:'var(--danger)', warning:'var(--acc)', success:'var(--acc2)', info:'var(--p2)',
}
const TYPE_ICONS: Record<string, string> = {
  danger:'🚨', warning:'⚠️', success:'✅', info:'ℹ️',
}
const TYPE_RGB: Record<string, string> = {
  danger:'232,64,74', warning:'240,165,0', success:'14,196,126', info:'91,78,232',
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { lang } = useConfig()
  void lang

  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showNotifs,  setShowNotifs]  = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const notifsRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false)
      }
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const titleKey = TITLE_KEYS[location.pathname]
  const title    = titleKey ? t(titleKey) : 'HabaShop'

  const menuItems  = NEW_MENU_ITEMS[location.pathname] ?? DEFAULT_ITEMS
  const unreadCount = RECENT_NOTIFS.filter(n => !n.read).length

  return (
    <div className="topbar">
      <div className="page-title">{title}</div>

      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input type="text" placeholder="Rechercher produit, client…" />
      </div>

      <LanguageSwitcher />
      <CurrencyBadge />

      {/* ── Bouton + Nouveau ── */}
      <div ref={newMenuRef} style={{ position:'relative' }}>
        <button className="topbar-btn" onClick={() => { setShowNewMenu(v => !v); setShowNotifs(false) }}>
          ＋ {t('btn_new')}
        </button>

        {showNewMenu && (
          <div style={{
            position:'absolute', top:'calc(100% + 8px)', right:0,
            background:'var(--card)',
            border:'1px solid var(--border2)',
            borderRadius:14,
            boxShadow:'0 20px 60px rgba(0,0,0,.4)',
            padding:6,
            minWidth:210,
            zIndex:200,
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
                  display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:15, flexShrink:0,
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
          onClick={() => { setShowNotifs(v => !v); setShowNewMenu(false) }}
          style={{
            background:'var(--bg3)',
            border:'1px solid var(--border)',
            borderRadius:8, padding:'7px 9px',
            cursor:'pointer', position:'relative',
            fontSize:15, lineHeight:1,
            display:'flex', alignItems:'center',
            justifyContent:'center',
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
            {/* Header dropdown */}
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

            {/* Liste notifications */}
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
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = notif.read ? 'transparent' : `rgba(${rgb},.05)`}
                  >
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background:`rgba(${rgb},.15)`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                    }}>
                      {TYPE_ICONS[notif.type] ?? 'ℹ️'}
                    </div>
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

            {/* Footer */}
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
