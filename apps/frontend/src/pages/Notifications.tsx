import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import toast from 'react-hot-toast'

type NotifType = 'danger' | 'warning' | 'success' | 'info'

interface Notification {
  id: number; type: NotifType; module: string; title: string
  message: string; read: boolean; createdAt: string; action: string | null
}

const NOTIFICATIONS_INIT: Notification[] = [
  { id:1,  type:'danger',  module:'STOCK',     title:'Rupture de stock critique',        message:'Riz parfumé 5kg — Stock: 12 (seuil: 20). Commander immédiatement.',            read:false, createdAt:'il y a 5 min',  action:'Voir le stock'  },
  { id:2,  type:'danger',  module:'STOCK',     title:'Rupture de stock critique',        message:"Savon OMO 500g — Stock: 5 (seuil: 10). Risque de rupture aujourd'hui.",       read:false, createdAt:'il y a 12 min', action:'Voir le stock'  },
  { id:3,  type:'warning', module:'AUTH',      title:'Tentative de connexion suspecte',  message:'3 tentatives échouées depuis IP 41.82.100.24. Compte temporairement bloqué.',  read:false, createdAt:'il y a 1h',     action:'Voir activité'  },
  { id:4,  type:'success', module:'POS',       title:'Objectif journalier atteint',      message:'CA du jour: 842 000 FCFA — Objectif 800 000 FCFA dépassé de 5,25 % !',         read:false, createdAt:'il y a 2h',     action:'Voir rapports'  },
  { id:5,  type:'info',    module:'PAIE',      title:'Bulletins de paie générés',        message:'6 bulletins Mai 2026 générés. Total net: 2 060 000 FCFA. En attente.',          read:true,  createdAt:'il y a 3h',     action:'Voir paie'      },
  { id:6,  type:'info',    module:'RH',        title:'Congé approuvé',                   message:'Congé de Fatoumata Ndiaye approuvé du 12/05 au 23/05. Planning mis à jour.',    read:true,  createdAt:'il y a 4h',     action:'Voir planning'  },
  { id:7,  type:'warning', module:'STOCK',     title:'Stock faible',                     message:'Huile palme 1L — Stock: 18 (seuil: 25). À commander cette semaine.',            read:true,  createdAt:'hier 18:30',    action:'Commander'      },
  { id:8,  type:'info',    module:'COMMANDES', title:'Commande reçue',                   message:'CMD-2026-088 SENRIZ — Réception confirmée. 200 sacs riz + 500 farines.',        read:true,  createdAt:'hier 14:15',    action:'Voir commandes' },
  { id:9,  type:'success', module:'CLIENTS',   title:'Nouveau client enregistré',        message:'Mamadou Diallo (Grossiste) ajouté. Premier achat: 450 000 FCFA.',               read:true,  createdAt:'hier 11:00',    action:'Voir clients'   },
  { id:10, type:'info',    module:'SYSTEME',   title:'Sauvegarde automatique effectuée', message:'Backup quotidien réalisé avec succès. 847 MB archivés.',                        read:true,  createdAt:'hier 03:00',    action:null             },
]

const ICONS: Record<NotifType, JSX.Element> = {
  danger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
}

const TYPE_CFG: Record<NotifType, { bg: string; border: string; color: string }> = {
  danger:  { bg:'rgba(232,64,74,.12)',  border:'rgba(232,64,74,.25)',  color:'var(--danger)' },
  warning: { bg:'rgba(240,165,0,.12)',  border:'rgba(240,165,0,.25)',  color:'var(--acc)'    },
  success: { bg:'rgba(14,196,126,.12)', border:'rgba(14,196,126,.25)', color:'var(--acc2)'   },
  info:    { bg:'rgba(91,78,232,.12)',  border:'rgba(91,78,232,.25)',  color:'var(--p2)'     },
}

interface PrefState {
  emailStock: boolean; emailSales: boolean; emailLogin: boolean; emailPayroll: boolean; emailOrders: boolean
  smsStock:   boolean; smsSales:   boolean; smsLogin:   boolean; smsPayroll:   boolean; smsOrders:   boolean
  pushStock:  boolean; pushSales:  boolean; pushLogin:  boolean; pushPayroll:  boolean; pushOrders:  boolean
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      width:40, height:22, borderRadius:11, cursor:'pointer',
      background: on ? 'var(--p2)' : 'var(--bg4)',
      position:'relative', transition:'background .2s', flexShrink:0,
    }}>
      <div style={{
        position:'absolute', top:2, left: on ? 20 : 2, width:18, height:18,
        borderRadius:'50%', background:'#fff', transition:'left .2s',
        boxShadow:'0 1px 4px rgba(0,0,0,.3)',
      }} />
    </div>
  )
}

type TabFilter = 'all' | 'unread' | 'critical'

export default function Notifications() {
  const { lang } = useAppStore()
  void lang

  const [notifs, setNotifs] = useState<Notification[]>(NOTIFICATIONS_INIT)
  const [tab, setTab]       = useState<TabFilter>('all')
  const [prefs, setPrefs]   = useState<PrefState>({
    emailStock:true,  emailSales:true,  emailLogin:true,  emailPayroll:false, emailOrders:true,
    smsStock:true,    smsSales:false,   smsLogin:false,   smsPayroll:false,   smsOrders:false,
    pushStock:true,   pushSales:true,   pushLogin:true,   pushPayroll:true,   pushOrders:true,
  })

  const unreadCount   = notifs.filter(n => !n.read).length
  const criticalCount = notifs.filter(n => n.type === 'danger').length
  const todayCount    = notifs.filter(n => n.createdAt.startsWith('il y a')).length

  const displayed = notifs.filter(n => {
    if (tab === 'unread')   return !n.read
    if (tab === 'critical') return n.type === 'danger'
    return true
  })

  function markRead(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    toast.success('Toutes les notifications marquées comme lues')
  }

  function deleteRead() {
    setNotifs(prev => prev.filter(n => !n.read))
    toast.success('Notifications lues supprimées')
  }

  function togglePref(key: keyof PrefState) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  const prefRows: { label: string; keys: (keyof PrefState)[] }[] = [
    { label:'Alertes de stock',                keys:['emailStock','smsStock','pushStock']         },
    { label:'Récapitulatif ventes (quotidien)', keys:['emailSales','smsSales','pushSales']         },
    { label:'Tentatives de connexion suspectes',keys:['emailLogin','smsLogin','pushLogin']         },
    { label:'Bulletins de paie',               keys:['emailPayroll','smsPayroll','pushPayroll']   },
    { label:'Commandes reçues',                keys:['emailOrders','smsOrders','pushOrders']      },
  ]

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total notifications', value:`${notifs.length}`, color:'var(--p2)'    },
          { label:'Non lues',            value:`${unreadCount}`,   color:'var(--danger)'},
          { label:'Critiques',           value:`${criticalCount}`, color:'var(--acc)'   },
          { label:"Aujourd'hui",         value:`${todayCount}`,    color:'var(--acc2)'  },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:26 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + actions */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {([
            { id:'all',      label:`Toutes (${notifs.length})`    },
            { id:'unread',   label:`Non lues (${unreadCount})`    },
            { id:'critical', label:`Critiques (${criticalCount})` },
          ] as { id:TabFilter; label:string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'8px 14px', borderRadius:10, fontSize:13, fontWeight:700,
              fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
              background: tab === t.id ? 'var(--p)' : 'var(--card)',
              color:      tab === t.id ? '#fff'     : 'var(--text2)',
              border:     tab === t.id ? 'none'     : '1px solid var(--border)',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <button className="btn btn-ghost btn-sm" onClick={markAllRead}>✅ Tout marquer comme lu</button>
        <button className="btn btn-ghost btn-sm" onClick={deleteRead}>🗑 Supprimer les lues</button>
      </div>

      {/* Liste notifications */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {displayed.length === 0 && (
          <div className="panel" style={{ textAlign:'center', color:'var(--text3)', padding:'40px 0', marginBottom:0 }}>
            Aucune notification dans cette catégorie
          </div>
        )}
        {displayed.map(n => {
          const cfg = TYPE_CFG[n.type]
          return (
            <div key={n.id} style={{
              position:'relative',
              background:  !n.read ? cfg.bg   : 'var(--card)',
              border:      `1px solid ${!n.read ? cfg.border : 'var(--border)'}`,
              borderLeft:  !n.read ? `3px solid ${cfg.color}` : '1px solid var(--border)',
              borderRadius:14, padding:'16px 18px',
              opacity:  n.read ? 0.75 : 1,
              transition:'all .2s',
            }}>
              {!n.read && (
                <div style={{
                  position:'absolute', top:12, right:12,
                  width:8, height:8, borderRadius:'50%',
                  background:'var(--acc)', boxShadow:'0 0 6px var(--acc)',
                }} />
              )}
              <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{
                  width:40, height:40, borderRadius:12, flexShrink:0,
                  background:cfg.bg, border:`1px solid ${cfg.border}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:cfg.color,
                }}>{ICONS[n.type]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>{n.title}</span>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>{n.createdAt}</span>
                  </div>
                  <div style={{ marginBottom:6 }}>
                    <span style={{
                      display:'inline-block', padding:'1px 8px', borderRadius:20,
                      fontSize:10, fontWeight:700, background:cfg.bg, color:cfg.color,
                    }}>{n.module}</span>
                  </div>
                  <p style={{ fontSize:13, color:'var(--text2)', marginBottom:10, lineHeight:1.5 }}>
                    {n.message}
                  </p>
                  <div style={{ display:'flex', gap:8 }}>
                    {n.action && (
                      <button className="mini-btn" onClick={() => toast(`→ ${n.action}`)}>
                        → {n.action}
                      </button>
                    )}
                    {!n.read && (
                      <button className="mini-btn" onClick={() => markRead(n.id)}>
                        ✓ Marquer lu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Préférences */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">⚙️ Préférences de notifications</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{
                  textAlign:'left', padding:'8px 12px', fontSize:11, color:'var(--text3)',
                  fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px',
                  borderBottom:'1px solid var(--border)', minWidth:220,
                }}>Notification</th>
                {['Email', 'SMS', 'Push'].map(ch => (
                  <th key={ch} style={{
                    textAlign:'center', padding:'8px 24px', fontSize:11, color:'var(--text3)',
                    fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px',
                    borderBottom:'1px solid var(--border)',
                  }}>{ch}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prefRows.map(row => (
                <tr key={row.label} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'12px', fontSize:13, color:'var(--text)' }}>{row.label}</td>
                  {row.keys.map(key => (
                    <td key={key} style={{ textAlign:'center', padding:'12px' }}>
                      <div style={{ display:'flex', justifyContent:'center' }}>
                        <Toggle on={prefs[key]} onToggle={() => togglePref(key)} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
