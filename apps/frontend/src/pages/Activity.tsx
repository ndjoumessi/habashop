import { useState, useMemo } from 'react'
import { useAppStore, t } from '@/stores/appStore'
import {
  Search, Download, X,
  ShoppingCart, Package, Lock, UserCog, ClipboardList,
  Users, Settings, Wallet, Heart,
  CheckCircle, Info, AlertTriangle, AlertOctagon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV } from '@/utils/export'
import type { LucideIcon } from 'lucide-react'

type Severity = 'success' | 'info' | 'warning' | 'danger'

interface ActivityEntry {
  id: number; module: string; action: string; user: string
  avatar: string; color: string; description: string
  ip: string; date: string; time: string; severity: Severity
}

const ACTIVITY_LOG: ActivityEntry[] = [
  { id:1,  module:'POS',          action:'VENTE',        user:'Marie Bakayoko',   avatar:'MB', color:'#6C3FD6', description:'Vente #V2041 encaissée — 45 000 FCFA — Caisse 1',                  ip:'192.168.1.14', date:'2026-05-14', time:'14:32', severity:'success' },
  { id:2,  module:'STOCK',        action:'ALERTE',       user:'Système',          avatar:'SY', color:'#EF4444', description:'Rupture critique — Riz parfumé 5kg (stock:12, seuil:20)',           ip:'système',      date:'2026-05-14', time:'14:18', severity:'danger'  },
  { id:3,  module:'AUTH',         action:'CONNEXION',    user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Connexion réussie depuis 192.168.1.10 — Chrome/macOS',             ip:'192.168.1.10', date:'2026-05-14', time:'14:02', severity:'info'    },
  { id:4,  module:'POS',          action:'VENTE',        user:'Seydou Koné',      avatar:'SK', color:'#EF4444', description:'Vente #V2040 encaissée — 128 000 FCFA — Caisse 2',                 ip:'192.168.1.15', date:'2026-05-14', time:'13:47', severity:'success' },
  { id:5,  module:'STOCK',        action:'RÉCEPTION',    user:'Kofi Diallo',      avatar:'KD', color:'#F59E0B', description:'Réception SONACO — 50 unités Huile palme 1L enregistrées',        ip:'192.168.1.12', date:'2026-05-14', time:'13:20', severity:'success' },
  { id:6,  module:'RH',           action:'CONGÉ',        user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Congé approuvé — Fatoumata Ndiaye (12/05 au 23/05/2026)',         ip:'192.168.1.10', date:'2026-05-14', time:'11:35', severity:'info'    },
  { id:7,  module:'UTILISATEURS', action:'INVITATION',   user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Invitation envoyée — nouveau.employe@shop.com (rôle: Caissier)',  ip:'192.168.1.10', date:'2026-05-14', time:'10:58', severity:'info'    },
  { id:8,  module:'AUTH',         action:'ÉCHEC AUTH',   user:'Inconnu',          avatar:'??', color:'#6B7280', description:'3 tentatives échouées consécutives — IP suspecte: 41.82.100.24',  ip:'41.82.100.24', date:'2026-05-14', time:'10:22', severity:'danger'  },
  { id:9,  module:'COMMANDES',    action:'CRÉATION',     user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Bon de commande CMD-2026-090 créé — SENRIZ — 336 000 FCFA',      ip:'192.168.1.10', date:'2026-05-14', time:'09:45', severity:'info'    },
  { id:10, module:'PARAMÈTRES',   action:'MODIFICATION', user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Devise modifiée XOF → EUR — Paramètres généraux',                ip:'192.168.1.10', date:'2026-05-14', time:'09:12', severity:'info'    },
  { id:11, module:'POS',          action:'VENTE',        user:'Marie Bakayoko',   avatar:'MB', color:'#6C3FD6', description:'Vente #V2039 encaissée — 67 500 FCFA — Caisse 1',                 ip:'192.168.1.14', date:'2026-05-13', time:'18:55', severity:'success' },
  { id:12, module:'STOCK',        action:'ALERTE',       user:'Système',          avatar:'SY', color:'#EF4444', description:'Stock faible — Savon OMO 500g (stock:5, seuil:10)',              ip:'système',      date:'2026-05-13', time:'17:30', severity:'warning' },
  { id:13, module:'PAIE',         action:'GÉNÉRATION',   user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Paie Mai 2026 générée — 6 bulletins — 2 060 000 FCFA total',    ip:'192.168.1.10', date:'2026-05-13', time:'16:00', severity:'success' },
  { id:14, module:'AUTH',         action:'DÉCONNEXION',  user:'Kofi Diallo',      avatar:'KD', color:'#F59E0B', description:'Déconnexion volontaire — durée session: 6h 32min',               ip:'192.168.1.12', date:'2026-05-13', time:'15:45', severity:'info'    },
  { id:15, module:'CLIENTS',      action:'CRÉATION',     user:'Marie Bakayoko',   avatar:'MB', color:'#6C3FD6', description:'Nouveau client — Mamadou Diallo (Grossiste) — Premier achat',   ip:'192.168.1.14', date:'2026-05-13', time:'14:20', severity:'success' },
  { id:16, module:'STOCK',        action:'MODIFICATION', user:'Kofi Diallo',      avatar:'KD', color:'#F59E0B', description:'Prix modifié — Riz parfumé 5kg: 4 200 → 4 500 FCFA (+7,1 %)',  ip:'192.168.1.12', date:'2026-05-13', time:'11:10', severity:'warning' },
  { id:17, module:'COMMANDES',    action:'RÉCEPTION',    user:'Kofi Diallo',      avatar:'KD', color:'#F59E0B', description:'CMD-2026-088 reçue — SENRIZ — 200 sacs riz + 500 farines',      ip:'192.168.1.12', date:'2026-05-12', time:'09:30', severity:'success' },
  { id:18, module:'PAIE',         action:'PAIEMENT',     user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'Virement effectué — Marie Bakayoko — 338 000 FCFA net',         ip:'192.168.1.10', date:'2026-05-12', time:'08:45', severity:'success' },
  { id:19, module:'AUTH',         action:'2FA',          user:'Nelson Djoumessi', avatar:'ND', color:'#3B82F6', description:'2FA activé — Authentification TOTP configurée avec succès',     ip:'192.168.1.10', date:'2026-05-11', time:'16:20', severity:'info'    },
  { id:20, module:'CLIENTS',      action:'MODIFICATION', user:'Seydou Koné',      avatar:'SK', color:'#EF4444', description:'Fidélité mise à jour — Aminata Traoré: 850 → 1 200 points',    ip:'192.168.1.15', date:'2026-05-11', time:'14:05', severity:'info'    },
]

const MODULE_CONFIG: Record<string, { color: string; bg: string; label: string; Icon: LucideIcon }> = {
  POS:          { color:'#818CF8', bg:'rgba(99,102,241,.15)',   label:'POS',          Icon: ShoppingCart },
  STOCK:        { color:'#F59E0B', bg:'rgba(245,158,11,.15)',   label:'Stock',        Icon: Package      },
  AUTH:         { color:'#EF4444', bg:'rgba(239,68,68,.15)',    label:'Auth',         Icon: Lock         },
  RH:           { color:'#A78BFA', bg:'rgba(139,92,246,.15)',   label:'RH',           Icon: UserCog      },
  COMMANDES:    { color:'#2DD4BF', bg:'rgba(20,184,166,.15)',   label:'Commandes',    Icon: ClipboardList },
  UTILISATEURS: { color:'#60A5FA', bg:'rgba(59,130,246,.15)',   label:'Utilisateurs', Icon: Users        },
  PARAMÈTRES:   { color:'#94A3B8', bg:'rgba(148,163,184,.15)', label:'Paramètres',   Icon: Settings     },
  PAIE:         { color:'#34D399', bg:'rgba(16,185,129,.15)',   label:'Paie',         Icon: Wallet       },
  CLIENTS:      { color:'#F472B6', bg:'rgba(244,114,182,.15)', label:'Clients',      Icon: Heart        },
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; Icon: LucideIcon; label: string }> = {
  success: { color:'var(--acc2)',    bg:'rgba(14,196,126,.1)',  Icon: CheckCircle,   label:'Succès'  },
  info:    { color:'var(--p2)',      bg:'rgba(91,78,232,.1)',   Icon: Info,          label:'Info'    },
  warning: { color:'var(--acc)',     bg:'rgba(240,165,0,.1)',   Icon: AlertTriangle, label:'Alerte'  },
  danger:  { color:'var(--danger)',  bg:'rgba(232,64,74,.1)',   Icon: AlertOctagon,  label:'Danger'  },
}

const ITEMS_PER_PAGE = 8

export default function Activity() {
  const { lang } = useAppStore()

  const [search,         setSearch]         = useState('')
  const [moduleFilter,   setModuleFilter]   = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateFilter,     setDateFilter]     = useState('all')
  const [currentPage,    setCurrentPage]    = useState(1)

  const filtered = useMemo(() => ACTIVITY_LOG.filter(log => {
    const matchSearch   = !search || log.description.toLowerCase().includes(search.toLowerCase()) || log.user.toLowerCase().includes(search.toLowerCase())
    const matchModule   = !moduleFilter || log.module === moduleFilter
    const matchSeverity = !severityFilter || log.severity === severityFilter
    const matchDate     = dateFilter === 'today' ? log.date === '2026-05-14' : true
    return matchSearch && matchModule && matchSeverity && matchDate
  }), [search, moduleFilter, severityFilter, dateFilter])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const todayCount    = ACTIVITY_LOG.filter(l => l.date === '2026-05-14').length
  const dangerCount   = ACTIVITY_LOG.filter(l => l.severity === 'danger').length
  const activeModules = new Set(ACTIVITY_LOG.map(l => l.module)).size
  const hasFilters    = !!(search || moduleFilter || severityFilter || dateFilter !== 'all')

  const resetPage = () => setCurrentPage(1)

  return (
    <div className="space-y-5 animate-in">

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fr' ? "Journal d'activité" : lang === 'en' ? 'Activity Log' : lang === 'es' ? 'Registro de actividad' : 'Registro attività'}
          </h1>
          <p className="page-subtitle">
            {lang === 'fr' ? 'Traçabilité complète de toutes les actions' : lang === 'en' ? 'Complete audit trail' : lang === 'es' ? 'Trazabilidad completa' : 'Tracciabilità completa'}
          </p>
        </div>
        <button className="topbar-btn" onClick={() => {
          exportCSV('habashop_activite',
            ['Horodatage','Module','Action','Utilisateur','Description','IP','Sévérité'],
            filtered.map(log => [`${log.date} ${log.time}`, log.module, log.action, log.user, log.description, log.ip, log.severity])
          )
          toast.success(lang === 'fr' ? 'Export téléchargé !' : 'Export downloaded!')
        }}>
          <Download size={14} /> {lang === 'fr' ? 'Exporter CSV' : 'Export CSV'}
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { label: t('activity_total'),    value: ACTIVITY_LOG.length, color:'var(--p2)'     },
          { label: t('activity_today'),    value: todayCount,           color:'var(--acc2)'   },
          { label: t('activity_security'), value: dangerCount,          color:'var(--danger)' },
          { label: t('activity_modules'),  value: activeModules,        color:'var(--acc)'    },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Panel ── */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Filtres */}
        <div style={{ padding:'14px 20px', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
            <input className="input" style={{ paddingLeft:34, fontSize:13 }}
              aria-label="Rechercher" placeholder={lang === 'fr' ? 'Rechercher utilisateur, action, description...' : 'Search user, action, description...'}
              value={search} onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); resetPage() }}>
            <option value="">{t('activity_filter_module')}</option>
            {Object.keys(MODULE_CONFIG).map(m => <option key={m}>{m}</option>)}
          </select>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); resetPage() }}>
            <option value="">{t('activity_all')}</option>
            {(['success','info','warning','danger'] as Severity[]).map(s => (
              <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
            ))}
          </select>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={dateFilter} onChange={e => { setDateFilter(e.target.value); resetPage() }}>
            <option value="all">{lang === 'fr' ? 'Toutes dates' : 'All dates'}</option>
            <option value="today">{lang === 'fr' ? "Aujourd'hui" : 'Today'}</option>
          </select>
          {hasFilters && (
            <button className="mini-btn" style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}
              onClick={() => { setSearch(''); setModuleFilter(''); setSeverityFilter(''); setDateFilter('all'); setCurrentPage(1) }}>
              <X size={12} /> {lang === 'fr' ? 'Effacer' : 'Clear'}
            </button>
          )}
        </div>

        {/* ── Timeline ── */}
        <div style={{ padding:'8px 20px 20px', borderTop:'1px solid var(--border)', minHeight:200 }}>
          {paginated.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text3)', fontSize:14 }}>
              {lang === 'fr' ? 'Aucun événement trouvé' : 'No events found'}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', position:'relative', paddingTop:12 }}>
              {/* Ligne verticale gradient */}
              <div style={{
                position:'absolute', left:19, top:24, bottom:8, width:2,
                background:'linear-gradient(180deg,var(--p),var(--p2),var(--acc2))',
                opacity:.13, borderRadius:99,
              }} />

              {paginated.map(log => {
                const mod     = MODULE_CONFIG[log.module]
                const sev     = SEVERITY_CONFIG[log.severity]
                const ModIcon = mod?.Icon ?? Settings
                const SevIcon = sev.Icon
                const isDanger  = log.severity === 'danger'
                const isWarning = log.severity === 'warning'

                return (
                  <div key={log.id} style={{ display:'flex', gap:14, marginBottom:12, position:'relative' }}>
                    {/* Icône module */}
                    <div style={{ width:40, flexShrink:0, paddingTop:2 }}>
                      <div style={{
                        width:40, height:40, borderRadius:12,
                        background: mod ? `${mod.color}15` : 'rgba(255,255,255,.04)',
                        border:`2px solid ${mod ? `${mod.color}40` : 'rgba(255,255,255,.08)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color: mod?.color ?? 'var(--text3)',
                        position:'relative', zIndex:1,
                        boxShadow: mod ? `0 4px 12px ${mod.color}15` : 'none',
                      }}>
                        <ModIcon size={16} />
                      </div>
                    </div>

                    {/* Carte */}
                    <div
                      style={{
                        flex:1, background:'var(--card)',
                        border:`1px solid ${isDanger ? 'rgba(239,68,68,.2)' : isWarning ? 'rgba(245,158,11,.18)' : 'var(--border)'}`,
                        borderLeft:`3px solid ${isDanger ? 'var(--danger)' : isWarning ? 'var(--acc)' : (mod?.color ?? 'transparent')}`,
                        borderRadius:14, padding:'11px 14px',
                        transition:'transform .18s, box-shadow .18s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.transform = 'translateX(3px)'
                        el.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.transform = 'none'
                        el.style.boxShadow = 'none'
                      }}
                    >
                      {/* Ligne 1 : avatar + user + badges + heure */}
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5, flexWrap:'wrap' }}>
                        <div style={{
                          width:22, height:22, borderRadius:6,
                          background:log.color, flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:8, fontWeight:900, color:'#fff',
                        }}>
                          {log.avatar}
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--text2)' }}>{log.user}</span>
                        {mod && (
                          <span style={{
                            fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.4px',
                            padding:'2px 7px', borderRadius:99,
                            background:mod.bg, color:mod.color,
                            border:`1px solid ${mod.color}33`,
                          }}>
                            {mod.label}
                          </span>
                        )}
                        <span style={{
                          fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.4px',
                          padding:'2px 7px', borderRadius:99,
                          display:'inline-flex', alignItems:'center', gap:3,
                          background:sev.bg, color:sev.color,
                        }}>
                          <SevIcon size={8} /> {sev.label}
                        </span>
                        <span style={{
                          marginLeft:'auto', fontSize:10, color:'var(--text3)',
                          whiteSpace:'nowrap', fontFamily:'var(--mono)',
                        }}>
                          {log.time} · {log.date}
                        </span>
                      </div>

                      {/* Action */}
                      <div style={{
                        fontSize:11, fontWeight:800, color:'var(--text)', marginBottom:3,
                        textTransform:'uppercase', letterSpacing:'.3px',
                      }}>
                        {log.action}
                      </div>

                      {/* Description */}
                      <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>
                        {log.description}
                      </div>

                      {/* IP */}
                      <div style={{ marginTop:7 }}>
                        <span style={{
                          fontSize:10, fontFamily:'var(--mono)',
                          padding:'2px 8px', borderRadius:6,
                          background:'rgba(255,255,255,.04)',
                          border:'1px solid rgba(255,255,255,.06)',
                          color: log.ip.startsWith('41.') ? 'var(--danger)' : 'var(--text3)',
                          fontWeight: log.ip.startsWith('41.') ? 700 : 400,
                        }}>
                          {log.ip === 'système' ? 'système' : `IP: ${log.ip}`}
                        </span>
                        {log.ip.startsWith('41.') && (
                          <span style={{
                            marginLeft:6, fontSize:9, fontWeight:800,
                            color:'var(--danger)', background:'rgba(239,68,68,.12)',
                            padding:'2px 7px', borderRadius:99,
                          }}>
                            IP SUSPECTE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 20px', borderTop:'1px solid var(--border)', background:'var(--bg3)',
        }}>
          <span style={{ fontSize:12, color:'var(--text3)' }}>
            {filtered.length} événement{filtered.length !== 1 ? 's' : ''} · Page {currentPage}/{totalPages}
          </span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
              ← {lang === 'fr' ? 'Préc.' : 'Prev'}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={{
                width:30, height:30, borderRadius:8, border:'none', cursor:'pointer',
                fontFamily:'var(--font)', fontSize:12, fontWeight:700,
                background: currentPage === page ? 'var(--p)' : 'var(--bg4)',
                color:      currentPage === page ? '#fff'     : 'var(--text2)',
              }}>{page}</button>
            ))}
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
              {lang === 'fr' ? 'Suiv.' : 'Next'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
