import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useFormatAmount, t } from '@/stores/appStore'
import {
  Bell, AlertOctagon, AlertTriangle, CheckCircle2, Info,
  Check, Trash2, Settings, Mail, MessageCircle, Save,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

const TYPE_CONFIG: Record<NotifType, { color: string; bg: string; border: string }> = {
  danger:  { color:'var(--danger)', bg:'rgba(232,64,74,.1)',  border:'rgba(232,64,74,.25)'  },
  warning: { color:'var(--acc)',    bg:'rgba(240,165,0,.1)',  border:'rgba(240,165,0,.25)'  },
  success: { color:'var(--acc2)',   bg:'rgba(14,196,126,.1)', border:'rgba(14,196,126,.25)' },
  info:    { color:'var(--p2)',     bg:'rgba(91,78,232,.1)',  border:'rgba(91,78,232,.25)'  },
}

const NOTIF_ICON: Record<NotifType, LucideIcon> = {
  danger:  AlertOctagon,
  warning: AlertTriangle,
  success: CheckCircle2,
  info:    Info,
}

export default function Notifications() {
  const { lang } = useAppStore()
  const fmt = useFormatAmount()
  void fmt
  const navigate = useNavigate()

  const [notifs,     setNotifs]     = useState<Notification[]>([])
  const [activeTab,  setActiveTab]  = useState<TabType>('all')
  const [prefs,      setPrefs]      = useState({
    email_stock:true,  email_ventes:true,  email_auth:true,  email_paie:false, email_commandes:true,
    sms_stock:true,    sms_ventes:false,   sms_auth:true,    sms_paie:false,   sms_commandes:false,
    push_stock:true,   push_ventes:true,   push_auth:true,   push_paie:true,   push_commandes:true,
  })

  const unreadCount = notifs.filter(n => !n.read).length
  const dangerCount = notifs.filter(n => n.type === 'danger').length

  const prefRows = [
    { key:'stock',     label:t('notif_stock_alert'), desc:lang === 'en' ? 'Stockouts and low stock' : lang === 'es' ? 'Roturas y stock bajo' : lang === 'it' ? 'Esaurimenti e scorte basse' : 'Ruptures et stocks faibles' },
    { key:'ventes',    label:t('notif_sales_recap'),  desc:lang === 'en' ? 'Daily sales summary' : lang === 'es' ? 'Resumen diario de ventas' : lang === 'it' ? 'Riepilogo giornaliero vendite' : 'Résumé journalier des ventes' },
    { key:'auth',      label:t('notif_security'),     desc:lang === 'en' ? 'Suspicious attempts' : lang === 'es' ? 'Intentos sospechosos' : lang === 'it' ? 'Tentativi sospetti' : 'Tentatives suspectes' },
    { key:'paie',      label:t('notif_payroll'),      desc:lang === 'en' ? 'Generation and approval' : lang === 'es' ? 'Generación y validación' : lang === 'it' ? 'Generazione e convalida' : 'Génération et validation' },
    { key:'commandes', label:t('notif_orders'),       desc:lang === 'en' ? 'Receipts and delays' : lang === 'es' ? 'Recepciones y retrasos' : lang === 'it' ? 'Ricezioni e ritardi' : 'Réceptions et retards' },
  ]

  const filtered = notifs.filter(n =>
    activeTab === 'unread' ? !n.read :
    activeTab === 'danger' ? n.type === 'danger' : true
  )

  const markRead    = (id: number) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read:true } : n))
  const markAllRead = () => { setNotifs(prev => prev.map(n => ({ ...n, read:true }))); toast.success(lang === 'en' ? 'All notifications marked as read' : lang === 'es' ? 'Todas las notificaciones marcadas como leídas' : lang === 'it' ? 'Tutte le notifiche segnate come lette' : 'Toutes les notifications marquées comme lues') }
  const deleteRead  = () => { setNotifs(prev => prev.filter(n => !n.read)); toast.success(lang === 'en' ? 'Read notifications deleted' : lang === 'es' ? 'Notificaciones leídas eliminadas' : lang === 'it' ? 'Notifiche lette eliminate' : 'Notifications lues supprimées') }
  const deleteNotif = (id: number) => setNotifs(prev => prev.filter(n => n.id !== id))

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label:t('common_total'),    value:notifs.length, color:'var(--text)'   },
          { label:t('notif_unread'),   value:unreadCount,   color:'var(--danger)' },
          { label:t('notif_critical'), value:dangerCount,   color:'var(--danger)' },
          { label:t('activity_today'), value:4,             color:'var(--acc2)'   },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:28 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets + actions */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:10, padding:4, flexWrap:'wrap' }}>
          {([
            { id:'all',    label:`${t('notif_all')} (${notifs.length})`      },
            { id:'unread', label:`${t('notif_unread')} (${unreadCount})`     },
            { id:'danger', label:`${t('notif_critical')} (${dangerCount})`   },
          ] as { id:TabType; label:string }[]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding:'7px 16px', borderRadius:8, fontSize:'var(--fs-sm)', fontWeight:'var(--fw-regular)',
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
          <button className="mini-btn" onClick={markAllRead} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <Check size={13} strokeWidth={2.4} /> {t('notif_mark_all_read')}
          </button>
          <button className="mini-btn" style={{ color:'var(--danger)', display:'inline-flex', alignItems:'center', gap:6 }} onClick={deleteRead}>
            <Trash2 size={13} strokeWidth={2.4} /> {t('notif_delete_read')}
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
              {(() => {
                const TypeIcon = NOTIF_ICON[notif.type]
                return (
                  <div style={{
                    width:44, height:44, borderRadius:12, flexShrink:0,
                    background:cfg.bg, border:`1px solid ${cfg.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center', color:cfg.color,
                  }}>
                    <TypeIcon size={20} strokeWidth={2.2} />
                  </div>
                )
              })()}

              {/* Contenu */}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                  <div>
                    <span style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-bold)', color:'var(--text)' }}>{notif.title}</span>
                    <span style={{
                      marginLeft:10, fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)',
                      background:'var(--bg3)', color:'var(--text3)',
                      borderRadius:20, padding:'2px 8px',
                    }}>{notif.module}</span>
                  </div>
                  <span style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', whiteSpace:'nowrap', marginLeft:12 }}>
                    {notif.time}
                  </span>
                </div>
                <p style={{ fontSize:'var(--fs-sm)', color:'var(--text2)', lineHeight:1.65, marginBottom:12 }}>
                  {notif.message}
                </p>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {notif.action && (
                    <button style={{
                      background:cfg.bg, border:`1px solid ${cfg.border}`,
                      borderRadius:8, padding:'5px 14px',
                      fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', color:cfg.color,
                      cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                    }} onClick={() => {
                      const route = NOTIF_ROUTES[notif.module] ?? '/app/dashboard'
                      navigate(route)
                      toast(`→ ${lang === 'en' ? 'Redirecting to' : lang === 'es' ? 'Redirigiendo a' : lang === 'it' ? 'Reindirizzamento a' : 'Redirection vers'} ${notif.module}`)
                    }}>
                      → {notif.action}
                    </button>
                  )}
                  {!notif.read && (
                    <button className="mini-btn" onClick={() => markRead(notif.id)}
                      style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      <Check size={12} strokeWidth={2.6} /> {lang === 'en' ? 'Mark as read' : lang === 'es' ? 'Marcar como leída' : lang === 'it' ? 'Segna come letta' : 'Marquer comme lu'}
                    </button>
                  )}
                  <button className="mini-btn"
                    aria-label={lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                    style={{ color:'var(--danger)', marginLeft:'auto', display:'inline-flex', alignItems:'center', padding:'5px 8px' }}
                    onClick={() => deleteNotif(notif.id)}>
                    <Trash2 size={13} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text3)' }}>
            <Bell size={40} style={{ margin:'0 auto 12px', display:'block', opacity:.3 }} />
            <div style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-regular)' }}>{lang === 'en' ? 'No notifications' : lang === 'es' ? 'Sin notificaciones' : lang === 'it' ? 'Nessuna notifica' : 'Aucune notification'}</div>
          </div>
        )}
      </div>

      {/* Section préférences */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-h">
          <span className="panel-t" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <Settings size={15} /> {lang === 'en' ? 'Notification preferences' : lang === 'es' ? 'Preferencias de notificaciones' : lang === 'it' ? 'Preferenze di notifica' : 'Préférences de notifications'}
          </span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ minWidth:600 }}>
            <thead>
              <tr>
                <th style={{ width:220 }}>{lang === 'en' ? 'Notification type' : lang === 'es' ? 'Tipo de notificación' : lang === 'it' ? 'Tipo di notifica' : 'Type de notification'}</th>
                <th style={{ textAlign:'center' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                    <Mail size={13} /> Email
                  </span>
                </th>
                <th style={{ textAlign:'center' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                    <MessageCircle size={13} /> SMS
                  </span>
                </th>
                <th style={{ textAlign:'center' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                    <Bell size={13} /> Push
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {prefRows.map(row => (
                <tr key={row.key} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'14px 9px' }}>
                    <div style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-regular)', color:'var(--text)' }}>{row.label}</div>
                    <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', marginTop:2 }}>{row.desc}</div>
                  </td>
                  {(['email','sms','push'] as const).map(canal => {
                    const key = `${canal}_${row.key}` as keyof typeof prefs
                    const isOn = prefs[key]
                    return (
                      <td key={canal} style={{ textAlign:'center', padding:'14px 9px' }}>
                        <button className="switch-hit" type="button" role="switch" aria-checked={isOn}
                          aria-label={`${row.label} — ${canal}`}
                          onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))} style={{
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
          <button className="topbar-btn" onClick={() => toast.success(lang === 'en' ? 'Preferences saved' : lang === 'es' ? 'Preferencias guardadas' : lang === 'it' ? 'Preferenze salvate' : 'Préférences sauvegardées')}
            style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <Save size={14} /> {lang === 'en' ? 'Save preferences' : lang === 'es' ? 'Guardar preferencias' : lang === 'it' ? 'Salva preferenze' : 'Sauvegarder les préférences'}
          </button>
        </div>
      </div>
    </div>
  )
}
