import { useState, useMemo } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV } from '@/utils/export'

type Severity = 'success' | 'info' | 'warning' | 'danger'

interface ActivityEntry {
  id: number; module: string; action: string; user: string
  avatar: string; color: string; description: string
  ip: string; date: string; time: string; severity: Severity
}

const ACTIVITY_LOG: ActivityEntry[] = [
  { id:1,  module:'POS',          action:'VENTE',        user:'Marie Bakayoko',  avatar:'MB', color:'#6C3FD6', description:'Vente #V2041 encaissée — 45 000 FCFA — Caisse 1',                   ip:'192.168.1.14', date:'2026-05-14', time:'14:32', severity:'success' },
  { id:2,  module:'STOCK',        action:'ALERTE',       user:'Système',         avatar:'SY', color:'#EF4444', description:'Rupture critique — Riz parfumé 5kg (stock:12, seuil:20)',            ip:'système',      date:'2026-05-14', time:'14:18', severity:'danger'  },
  { id:3,  module:'AUTH',         action:'CONNEXION',    user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Connexion réussie depuis 192.168.1.10 — Chrome/macOS',              ip:'192.168.1.10', date:'2026-05-14', time:'14:02', severity:'info'    },
  { id:4,  module:'POS',          action:'VENTE',        user:'Seydou Koné',     avatar:'SK', color:'#EF4444', description:'Vente #V2040 encaissée — 128 000 FCFA — Caisse 2',                  ip:'192.168.1.15', date:'2026-05-14', time:'13:47', severity:'success' },
  { id:5,  module:'STOCK',        action:'RÉCEPTION',    user:'Kofi Diallo',     avatar:'KD', color:'#F59E0B', description:'Réception SONACO — 50 unités Huile palme 1L enregistrées',         ip:'192.168.1.12', date:'2026-05-14', time:'13:20', severity:'success' },
  { id:6,  module:'RH',           action:'CONGÉ',        user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Congé approuvé — Fatoumata Ndiaye (12/05 au 23/05/2026)',          ip:'192.168.1.10', date:'2026-05-14', time:'11:35', severity:'info'    },
  { id:7,  module:'UTILISATEURS', action:'INVITATION',   user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Invitation envoyée — nouveau.employe@shop.com (rôle: Caissier)',   ip:'192.168.1.10', date:'2026-05-14', time:'10:58', severity:'info'    },
  { id:8,  module:'AUTH',         action:'ÉCHEC',        user:'Inconnu',         avatar:'??', color:'#6B7280', description:'3 tentatives échouées consécutives — IP suspecte: 41.82.100.24',   ip:'41.82.100.24', date:'2026-05-14', time:'10:22', severity:'danger'  },
  { id:9,  module:'COMMANDES',    action:'CRÉATION',     user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Bon de commande CMD-2026-090 créé — SENRIZ — 336 000 FCFA',       ip:'192.168.1.10', date:'2026-05-14', time:'09:45', severity:'info'    },
  { id:10, module:'PARAMÈTRES',   action:'MODIFICATION', user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Devise modifiée XOF → EUR — Paramètres généraux',                 ip:'192.168.1.10', date:'2026-05-14', time:'09:12', severity:'info'    },
  { id:11, module:'POS',          action:'VENTE',        user:'Marie Bakayoko',  avatar:'MB', color:'#6C3FD6', description:'Vente #V2039 encaissée — 67 500 FCFA — Caisse 1',                  ip:'192.168.1.14', date:'2026-05-13', time:'18:55', severity:'success' },
  { id:12, module:'STOCK',        action:'ALERTE',       user:'Système',         avatar:'SY', color:'#EF4444', description:'Stock faible — Savon OMO 500g (stock:5, seuil:10)',               ip:'système',      date:'2026-05-13', time:'17:30', severity:'warning' },
  { id:13, module:'PAIE',         action:'GÉNÉRATION',   user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Paie Mai 2026 générée — 6 bulletins — 2 060 000 FCFA total',     ip:'192.168.1.10', date:'2026-05-13', time:'16:00', severity:'success' },
  { id:14, module:'AUTH',         action:'DÉCONNEXION',  user:'Kofi Diallo',     avatar:'KD', color:'#F59E0B', description:'Déconnexion volontaire — durée session: 6h 32min',                ip:'192.168.1.12', date:'2026-05-13', time:'15:45', severity:'info'    },
  { id:15, module:'CLIENTS',      action:'CRÉATION',     user:'Marie Bakayoko',  avatar:'MB', color:'#6C3FD6', description:'Nouveau client — Mamadou Diallo (Grossiste) — Premier achat',    ip:'192.168.1.14', date:'2026-05-13', time:'14:20', severity:'success' },
  { id:16, module:'STOCK',        action:'MODIFICATION', user:'Kofi Diallo',     avatar:'KD', color:'#F59E0B', description:'Prix modifié — Riz parfumé 5kg: 4 200 → 4 500 FCFA (+7,1 %)',   ip:'192.168.1.12', date:'2026-05-13', time:'11:10', severity:'warning' },
  { id:17, module:'COMMANDES',    action:'RÉCEPTION',    user:'Kofi Diallo',     avatar:'KD', color:'#F59E0B', description:'CMD-2026-088 reçue — SENRIZ — 200 sacs riz + 500 farines',       ip:'192.168.1.12', date:'2026-05-12', time:'09:30', severity:'success' },
  { id:18, module:'PAIE',         action:'PAIEMENT',     user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'Virement effectué — Marie Bakayoko — 338 000 FCFA net',          ip:'192.168.1.10', date:'2026-05-12', time:'08:45', severity:'success' },
  { id:19, module:'AUTH',         action:'2FA',          user:'Nelson Djoumessi',avatar:'ND', color:'#3B82F6', description:'2FA activé — Authentification TOTP configurée avec succès',      ip:'192.168.1.10', date:'2026-05-11', time:'16:20', severity:'info'    },
  { id:20, module:'CLIENTS',      action:'MODIFICATION', user:'Seydou Koné',     avatar:'SK', color:'#EF4444', description:'Fidélité mise à jour — Aminata Traoré: 850 → 1 200 points',     ip:'192.168.1.15', date:'2026-05-11', time:'14:05', severity:'info'    },
]

const MODULE_CONFIG = {
  POS:          { color:'#818CF8', bg:'rgba(99,102,241,.15)',   label:'POS'          },
  STOCK:        { color:'#F59E0B', bg:'rgba(245,158,11,.15)',   label:'Stock'        },
  AUTH:         { color:'#EF4444', bg:'rgba(239,68,68,.15)',    label:'Auth'         },
  RH:           { color:'#A78BFA', bg:'rgba(139,92,246,.15)',   label:'RH'           },
  COMMANDES:    { color:'#2DD4BF', bg:'rgba(20,184,166,.15)',   label:'Commandes'    },
  UTILISATEURS: { color:'#60A5FA', bg:'rgba(59,130,246,.15)',   label:'Utilisateurs' },
  PARAMÈTRES:   { color:'#94A3B8', bg:'rgba(148,163,184,.15)', label:'Paramètres'   },
  PAIE:         { color:'#34D399', bg:'rgba(16,185,129,.15)',   label:'Paie'         },
  CLIENTS:      { color:'#F472B6', bg:'rgba(244,114,182,.15)', label:'Clients'      },
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  success: { color:'var(--acc2)',   bg:'rgba(14,196,126,.1)', label:'Succès'      },
  info:    { color:'var(--p2)',     bg:'rgba(91,78,232,.1)',  label:'Info'        },
  warning: { color:'var(--acc)',    bg:'rgba(240,165,0,.1)',  label:'Alerte'      },
  danger:  { color:'var(--danger)', bg:'rgba(232,64,74,.1)', label:'Danger'      },
}

const SEV_ICON: Record<Severity, string> = {
  success:'✅', info:'ℹ️', warning:'⚠️', danger:'🚨',
}

const ITEMS_PER_PAGE = 8

export default function Activity() {
  const { lang } = useAppStore()
  void lang
  const fmt = useFormatAmount()
  void fmt

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

  function resetPage() { setCurrentPage(1) }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label:'Total événements', value:ACTIVITY_LOG.length, color:'var(--p2)'    },
          { label:"Aujourd'hui",      value:todayCount,          color:'var(--acc2)'  },
          { label:'Alertes sécurité', value:dangerCount,         color:'var(--danger)'},
          { label:'Modules actifs',   value:activeModules,       color:'var(--acc)'   },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:26 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel principal */}
      <div className="panel" style={{ padding:0, overflow:'hidden', marginBottom:0 }}>

        {/* Header */}
        <div className="panel-h" style={{ padding:'16px 20px', marginBottom:0 }}>
          <span className="panel-t">📋 Journal d'activité</span>
          <button className="topbar-btn" onClick={() => {
            exportCSV('habashop_activite',
              ['Horodatage','Module','Action','Utilisateur','Description','IP','Sévérité'],
              filtered.map(log => [log.date + ' ' + log.time, log.module, log.action, log.user, log.description, log.ip, log.severity])
            )
            toast.success('📊 Export activités téléchargé !')
          }}>
            <Download size={14} /> Exporter CSV
          </button>
        </div>

        {/* Filtres */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <Search size={14} style={{
              position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
              color:'var(--text3)', pointerEvents:'none',
            }} />
            <input className="input" style={{ paddingLeft:34, fontSize:13 }}
              placeholder="Rechercher utilisateur, action, description..."
              value={search} onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); resetPage() }}>
            <option value="">Tous les modules</option>
            {Object.keys(MODULE_CONFIG).map(m => <option key={m}>{m}</option>)}
          </select>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); resetPage() }}>
            <option value="">Toutes sévérités</option>
            <option value="success">Succès</option>
            <option value="info">Info</option>
            <option value="warning">Avertissement</option>
            <option value="danger">Danger</option>
          </select>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={dateFilter} onChange={e => { setDateFilter(e.target.value); resetPage() }}>
            <option value="all">Toutes dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
          </select>
          <button className="mini-btn" onClick={() => {
            setSearch(''); setModuleFilter(''); setSeverityFilter(''); setDateFilter('all'); setCurrentPage(1)
          }}>🗑 Effacer</button>
        </div>

        {/* Tableau */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width:140 }}>Horodatage</th>
                <th style={{ width:110 }}>Module</th>
                <th style={{ width:130 }}>Action</th>
                <th style={{ width:160 }}>Utilisateur</th>
                <th>Description</th>
                <th style={{ width:120 }}>IP</th>
                <th style={{ width:110 }}>Sévérité</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(log => {
                const mod       = MODULE_CONFIG[log.module as keyof typeof MODULE_CONFIG]
                const sev       = SEVERITY_CONFIG[log.severity]
                const isDanger  = log.severity === 'danger'
                const isWarning = log.severity === 'warning'
                return (
                  <tr key={log.id} style={{
                    borderBottom:'1px solid var(--border)',
                    background: isDanger  ? 'rgba(232,64,74,.04)'
                              : isWarning ? 'rgba(240,165,0,.04)'
                              : 'transparent',
                    borderLeft: isDanger  ? '3px solid var(--danger)'
                              : isWarning ? '3px solid var(--acc)'
                              : '3px solid transparent',
                  }}
                    onMouseEnter={e => {
                      if (!isDanger && !isWarning)
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'
                    }}
                    onMouseLeave={e => {
                      if (!isDanger && !isWarning)
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {/* Horodatage */}
                    <td>
                      <div style={{ fontFamily:'var(--mono)', fontSize:11.5 }}>
                        <div style={{ color:'var(--text)', fontWeight:600 }}>{log.time}</div>
                        <div style={{ color:'var(--text3)', fontSize:10 }}>{log.date}</div>
                      </div>
                    </td>

                    {/* Module */}
                    <td>
                      <span style={{
                        background:mod?.bg, color:mod?.color,
                        borderRadius:20, padding:'3px 10px',
                        fontSize:11, fontWeight:700, whiteSpace:'nowrap',
                      }}>{mod?.label || log.module}</span>
                    </td>

                    {/* Action */}
                    <td>
                      <span style={{
                        fontSize:11, fontWeight:700, color:'var(--text2)',
                        letterSpacing:'.3px', textTransform:'uppercase',
                      }}>{log.action}</span>
                    </td>

                    {/* Utilisateur */}
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{
                          width:28, height:28, borderRadius:'50%',
                          background:log.color, flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:10, fontWeight:800, color:'#fff',
                        }}>{log.avatar}</div>
                        <span style={{
                          fontSize:12, fontWeight:600, color:'var(--text)',
                          whiteSpace:'nowrap', overflow:'hidden',
                          textOverflow:'ellipsis', maxWidth:100,
                        }}>{log.user}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td>
                      <span style={{
                        fontSize:12, color:'var(--text2)',
                        display:'block', overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:360,
                      }} title={log.description}>{log.description}</span>
                    </td>

                    {/* IP */}
                    <td>
                      <span style={{
                        fontFamily:'var(--mono)', fontSize:11,
                        color:     log.ip === 'système'     ? 'var(--text3)'
                                 : log.ip.startsWith('41.') ? 'var(--danger)'
                                 : 'var(--text3)',
                        fontWeight: log.ip.startsWith('41.') ? 700 : 400,
                      }}>{log.ip}</span>
                    </td>

                    {/* Sévérité */}
                    <td>
                      <span style={{
                        background:sev.bg, color:sev.color,
                        borderRadius:20, padding:'3px 10px',
                        fontSize:10, fontWeight:700,
                        display:'inline-flex', alignItems:'center', gap:4,
                        whiteSpace:'nowrap',
                      }}>
                        {SEV_ICON[log.severity]} {sev.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign:'center', padding:'50px', color:'var(--text3)', fontSize:14 }}>
                    Aucun événement trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 20px',
          borderTop:'1px solid var(--border)',
          background:'var(--bg3)',
        }}>
          <span style={{ fontSize:12, color:'var(--text3)' }}>
            {filtered.length} événement{filtered.length > 1 ? 's' : ''} · Page {currentPage} sur {totalPages}
          </span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ opacity: currentPage === 1 ? .4 : 1 }}
            >← Précédent</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={{
                width:32, height:32, borderRadius:8, border:'none', cursor:'pointer',
                fontFamily:'var(--font)', fontSize:12, fontWeight:700,
                background: currentPage === page ? 'var(--p)' : 'var(--bg4)',
                color:      currentPage === page ? '#fff'     : 'var(--text2)',
              }}>{page}</button>
            ))}
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ opacity: currentPage === totalPages ? .4 : 1 }}
            >Suivant →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
