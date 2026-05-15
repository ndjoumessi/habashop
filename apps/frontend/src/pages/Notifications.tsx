import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { Bell } from 'lucide-react'
import toast from 'react-hot-toast'

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

type NotifType = 'danger' | 'warning' | 'success' | 'info'
type TabType   = 'all' | 'unread' | 'danger'

interface Notification {
  id: number; type: NotifType; module: string; title: string
  message: string; read: boolean; time: string; action: string | null
}

const NOTIFS_INIT: Notification[] = [
  { id:1,  type:'danger',  module:'STOCK',    title:'Rupture stock critique',         message:'Riz parfumé 5kg — Stock: 12 / Seuil: 20. Commander immédiatement pour éviter une rupture.',         read:false, time:'il y a 5 min',  action:'Voir le stock'  },
  { id:2,  type:'danger',  module:'STOCK',    title:'Rupture stock critique',         message:'Savon OMO 500g — Stock: 5 / Seuil: 10. Risque de rupture totale avant ce soir.',                    read:false, time:'il y a 12 min', action:'Commander'      },
  { id:3,  type:'danger',  module:'AUTH',     title:'Tentative connexion suspecte',   message:'3 tentatives échouées depuis IP 41.82.100.24. Le compte a été temporairement bloqué.',              read:false, time:'il y a 1h',     action:'Voir activité'  },
  { id:4,  type:'success', module:'POS',      title:'Objectif journalier dépassé',    message:'CA du jour: 842 000 FCFA — Objectif 800 000 FCFA dépassé de 5,25 % ! Félicitations.',               read:false, time:'il y a 2h',     action:'Voir rapports'  },
  { id:5,  type:'info',    module:'PAIE',     title:'Bulletins de paie générés',      message:'6 bulletins Mai 2026 prêts. Total net: 2 060 000 FCFA. En attente de validation et paiement.',      read:true,  time:'il y a 3h',     action:'Voir la paie'   },
  { id:6,  type:'info',    module:'RH',       title:'Congé approuvé',                 message:'Congé annuel de Fatoumata Ndiaye approuvé du 12/05 au 23/05. Planning automatiquement mis à jour.', read:true,  time:'il y a 4h',     action:'Voir planning'  },
  { id:7,  type:'warning', module:'STOCK',    title:'Stock faible',                   message:'Huile palme 1L — Stock: 18 / Seuil: 25. Penser à commander avant la fin de semaine.',               read:true,  time:'hier 18:30',    action:'Commander'      },
  { id:8,  type:'info',    module:'COMMANDES',title:'Commande reçue',                 message:'CMD-2026-088 SENRIZ confirmée. 200 sacs riz + 500 farines reçus et enregistrés en stock.',          read:true,  time:'hier 14:15',    action:'Voir commandes' },
  { id:9,  type:'success', module:'CLIENTS',  title:'Nouveau client enregistré',      message:'Mamadou Diallo (Grossiste) ajouté au CRM. Premier achat: 450 000 FCFA. Programme fidélité activé.',read:true,  time:'hier 11:00',    action:'Voir clients'   },
  { id:10, type:'info',    module:'SYSTÈME',  title:'Sauvegarde automatique réussie', message:'Backup quotidien effectué avec succès. 847 MB archivés. Prochain backup: demain 03:00.',           read:true,  time:'hier 03:00',    action:null             },
]

const TYPE_CONFIG: Record<NotifType, { color: string; bg: string; border: string }> = {
  danger:  { color:'var(--danger)', bg:'rgba(232,64,74,.1)',  border:'rgba(232,64,74,.25)'  },
  warning: { color:'var(--acc)',    bg:'rgba(240,165,0,.1)',  border:'rgba(240,165,0,.25)'  },
  success: { color:'var(--acc2)',   bg:'rgba(14,196,126,.1)', border:'rgba(14,196,126,.25)' },
  info:    { color:'var(--p2)',     bg:'rgba(91,78,232,.1)',  border:'rgba(91,78,232,.25)'  },
}

const NOTIF_ICON: Record<NotifType, string> = {
  danger:'🚨', warning:'⚠️', success:'✅', info:'ℹ️',
}

const PREF_ROWS = [
  { key:'stock',     label:'Alertes de stock',         desc:'Ruptures et stocks faibles'    },
  { key:'ventes',    label:'Récap ventes',             desc:'Résumé journalier des ventes'  },
  { key:'auth',      label:'Sécurité & connexions',    desc:'Tentatives suspectes'          },
  { key:'paie',      label:'Bulletins de paie',        desc:'Génération et validation'      },
  { key:'commandes', label:'Commandes fournisseurs',   desc:'Réceptions et retards'         },
]

export default function Notifications() {
  const { lang } = useAppStore()
  void lang
  const fmt = useFormatAmount()
  void fmt
  const navigate = useNavigate()

  const [notifs,     setNotifs]     = useState<Notification[]>(NOTIFS_INIT)
  const [activeTab,  setActiveTab]  = useState<TabType>('all')
  const [prefs,      setPrefs]      = useState({
    email_stock:true,  email_ventes:true,  email_auth:true,  email_paie:false, email_commandes:true,
    sms_stock:true,    sms_ventes:false,   sms_auth:true,    sms_paie:false,   sms_commandes:false,
    push_stock:true,   push_ventes:true,   push_auth:true,   push_paie:true,   push_commandes:true,
  })

  const unreadCount = notifs.filter(n => !n.read).length
  const dangerCount = notifs.filter(n => n.type === 'danger').length

  const filtered = notifs.filter(n =>
    activeTab === 'unread' ? !n.read :
    activeTab === 'danger' ? n.type === 'danger' : true
  )

  const markRead    = (id: number) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read:true } : n))
  const markAllRead = () => { setNotifs(prev => prev.map(n => ({ ...n, read:true }))); toast.success('Toutes les notifications marquées comme lues') }
  const deleteRead  = () => { setNotifs(prev => prev.filter(n => !n.read)); toast.success('Notifications lues supprimées') }
  const deleteNotif = (id: number) => setNotifs(prev => prev.filter(n => n.id !== id))

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label:'Total',      value:notifs.length, color:'var(--text)'   },
          { label:'Non lues',   value:unreadCount,   color:'var(--danger)' },
          { label:'Critiques',  value:dangerCount,   color:'var(--danger)' },
          { label:'Ce jour',    value:4,             color:'var(--acc2)'   },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:28 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets + actions */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:10, padding:4 }}>
          {([
            { id:'all',    label:`Toutes (${notifs.length})`    },
            { id:'unread', label:`Non lues (${unreadCount})`    },
            { id:'danger', label:`Critiques (${dangerCount})`   },
          ] as { id:TabType; label:string }[]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding:'7px 16px', borderRadius:8, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, var(--p), var(--p2))' : 'transparent',
              color:     activeTab === tab.id ? '#fff' : 'var(--text2)',
              border:'none',
              boxShadow: activeTab === tab.id ? '0 4px 14px rgba(91,78,232,.3)' : 'none',
            }}>{tab.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="mini-btn" onClick={markAllRead}>✅ Tout marquer lu</button>
          <button className="mini-btn" style={{ color:'var(--danger)' }} onClick={deleteRead}>
            🗑 Supprimer les lues
          </button>
        </div>
      </div>

      {/* Liste notifications */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(notif => {
          const cfg = TYPE_CONFIG[notif.type]
          return (
            <div key={notif.id} style={{
              display:'flex', gap:16, padding:'18px 20px',
              background:  notif.read ? 'var(--card)' : cfg.bg,
              border:     `1px solid ${notif.read ? 'var(--border)' : cfg.border}`,
              borderLeft: `4px solid ${notif.read ? 'var(--border)' : cfg.color}`,
              borderRadius:14,
              opacity: notif.read ? .8 : 1,
              transition:'all .2s', position:'relative',
            }}>
              {/* Indicateur non lu */}
              {!notif.read && (
                <div style={{
                  position:'absolute', top:14, right:14,
                  width:8, height:8, borderRadius:'50%',
                  background:'var(--danger)',
                  boxShadow:'0 0 8px var(--danger)',
                }} />
              )}

              {/* Icône type */}
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                background:cfg.bg, border:`1px solid ${cfg.border}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
              }}>{NOTIF_ICON[notif.type]}</div>

              {/* Contenu */}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                  <div>
                    <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{notif.title}</span>
                    <span style={{
                      marginLeft:10, fontSize:10, fontWeight:700,
                      background:'var(--bg3)', color:'var(--text3)',
                      borderRadius:20, padding:'2px 8px',
                    }}>{notif.module}</span>
                  </div>
                  <span style={{ fontSize:11, color:'var(--text3)', whiteSpace:'nowrap', marginLeft:12 }}>
                    {notif.time}
                  </span>
                </div>
                <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.65, marginBottom:12 }}>
                  {notif.message}
                </p>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {notif.action && (
                    <button style={{
                      background:cfg.bg, border:`1px solid ${cfg.border}`,
                      borderRadius:8, padding:'5px 14px',
                      fontSize:12, fontWeight:700, color:cfg.color,
                      cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                    }} onClick={() => {
                      const route = NOTIF_ROUTES[notif.module] ?? '/app/dashboard'
                      navigate(route)
                      toast(`→ Redirection vers ${notif.module}`)
                    }}>
                      → {notif.action}
                    </button>
                  )}
                  {!notif.read && (
                    <button className="mini-btn" onClick={() => markRead(notif.id)}>
                      ✓ Marquer comme lu
                    </button>
                  )}
                  <button className="mini-btn"
                    style={{ color:'var(--danger)', marginLeft:'auto' }}
                    onClick={() => deleteNotif(notif.id)}>
                    🗑
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text3)' }}>
            <Bell size={40} style={{ margin:'0 auto 12px', display:'block', opacity:.3 }} />
            <div style={{ fontSize:14, fontWeight:600 }}>Aucune notification</div>
          </div>
        )}
      </div>

      {/* Section préférences */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-h">
          <span className="panel-t">⚙️ Préférences de notifications</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ minWidth:600 }}>
            <thead>
              <tr>
                <th style={{ width:220 }}>Type de notification</th>
                <th style={{ textAlign:'center' }}>📧 Email</th>
                <th style={{ textAlign:'center' }}>💬 SMS</th>
                <th style={{ textAlign:'center' }}>🔔 Push</th>
              </tr>
            </thead>
            <tbody>
              {PREF_ROWS.map(row => (
                <tr key={row.key} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'14px 9px' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{row.label}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{row.desc}</div>
                  </td>
                  {(['email','sms','push'] as const).map(canal => {
                    const key = `${canal}_${row.key}` as keyof typeof prefs
                    const isOn = prefs[key]
                    return (
                      <td key={canal} style={{ textAlign:'center', padding:'14px 9px' }}>
                        <button onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))} style={{
                          width:48, height:26, borderRadius:99,
                          background: isOn ? 'var(--p2)' : 'var(--bg4)',
                          border:'none', cursor:'pointer',
                          position:'relative', transition:'background .2s',
                        }}>
                          <div style={{
                            position:'absolute', top:3,
                            left: isOn ? 25 : 3,
                            width:20, height:20, borderRadius:'50%',
                            background:'#fff', transition:'left .2s',
                            boxShadow:'0 2px 4px rgba(0,0,0,.2)',
                          }} />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button className="topbar-btn" onClick={() => toast.success('✅ Préférences sauvegardées !')}>
            💾 Sauvegarder les préférences
          </button>
        </div>
      </div>
    </div>
  )
}
