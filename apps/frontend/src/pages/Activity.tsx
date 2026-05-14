import { useState, useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Download, X } from 'lucide-react'
import toast from 'react-hot-toast'

type Severity = 'info' | 'success' | 'warning' | 'danger'

interface ActivityEntry {
  id: number; module: string; action: string; user: string
  description: string; ip: string; createdAt: string; severity: Severity
}

const ACTIVITY_LOG: ActivityEntry[] = [
  { id:1,  module:'POS',          action:'VENTE',       user:'Marie Bakayoko',   description:'Vente #V2041 — 45 000 FCFA encaissés',                          ip:'192.168.1.14', createdAt:'2026-05-14 14:32', severity:'info'    },
  { id:2,  module:'STOCK',        action:'ALERTE',      user:'Système',           description:'Alerte rupture — Riz parfumé 5kg (stock: 12, seuil: 20)',      ip:'système',      createdAt:'2026-05-14 14:18', severity:'warning' },
  { id:3,  module:'AUTH',         action:'CONNEXION',   user:'Nelson Djoumessi', description:'Connexion réussie depuis 192.168.1.10',                          ip:'192.168.1.10', createdAt:'2026-05-14 14:02', severity:'info'    },
  { id:4,  module:'POS',          action:'VENTE',       user:'Seydou Koné',      description:'Vente #V2040 — 128 000 FCFA encaissés',                         ip:'192.168.1.15', createdAt:'2026-05-14 13:47', severity:'info'    },
  { id:5,  module:'STOCK',        action:'RECEPTION',   user:'Kofi Diallo',      description:'Réception stock — Fournisseur SONACO — 50 unités Huile palme',  ip:'192.168.1.12', createdAt:'2026-05-14 13:20', severity:'success' },
  { id:6,  module:'RH',           action:'CONGE',       user:'Nelson Djoumessi', description:'Congé approuvé — Fatoumata Ndiaye (12/05 au 23/05)',            ip:'192.168.1.10', createdAt:'2026-05-14 11:35', severity:'info'    },
  { id:7,  module:'UTILISATEURS', action:'INVITATION',  user:'Nelson Djoumessi', description:'Invitation envoyée à nouveau.employe@shop.com (rôle: Caissier)', ip:'192.168.1.10', createdAt:'2026-05-14 10:58', severity:'info'    },
  { id:8,  module:'AUTH',         action:'ECHEC',       user:'Inconnu',           description:'Tentative connexion échouée (3/5) — IP: 41.82.100.24',         ip:'41.82.100.24', createdAt:'2026-05-14 10:22', severity:'danger'  },
  { id:9,  module:'COMMANDES',    action:'CREATION',    user:'Nelson Djoumessi', description:'Bon de commande CMD-2026-090 créé — SENRIZ — 336 000 FCFA',     ip:'192.168.1.10', createdAt:'2026-05-14 09:45', severity:'info'    },
  { id:10, module:'PARAMETRES',   action:'MODIF',       user:'Nelson Djoumessi', description:'Paramètres modifiés — Devise changée: XOF → EUR',               ip:'192.168.1.10', createdAt:'2026-05-14 09:12', severity:'info'    },
  { id:11, module:'POS',          action:'VENTE',       user:'Marie Bakayoko',   description:'Vente #V2039 — 67 500 FCFA encaissés',                          ip:'192.168.1.14', createdAt:'2026-05-13 18:55', severity:'info'    },
  { id:12, module:'STOCK',        action:'ALERTE',      user:'Système',           description:'Alerte rupture — Savon OMO 500g (stock: 5, seuil: 10)',        ip:'système',      createdAt:'2026-05-13 17:30', severity:'warning' },
  { id:13, module:'PAIE',         action:'GENERATION',  user:'Nelson Djoumessi', description:'Paie Mai 2026 générée — 6 bulletins — 2 060 000 FCFA',          ip:'192.168.1.10', createdAt:'2026-05-13 16:00', severity:'success' },
  { id:14, module:'AUTH',         action:'DECONNEXION', user:'Kofi Diallo',      description:'Déconnexion — session de 6h32min',                               ip:'192.168.1.12', createdAt:'2026-05-13 15:45', severity:'info'    },
  { id:15, module:'CLIENTS',      action:'CREATION',    user:'Marie Bakayoko',   description:'Nouveau client ajouté — Mamadou Diallo (Grossiste)',             ip:'192.168.1.14', createdAt:'2026-05-13 14:20', severity:'success' },
]

const MODULE_CFG: Record<string, { color: string; bg: string }> = {
  POS:          { color:'#818CF8', bg:'rgba(99,102,241,.15)'  },
  STOCK:        { color:'#F59E0B', bg:'rgba(245,158,11,.15)'  },
  AUTH:         { color:'#EF4444', bg:'rgba(239,68,68,.15)'   },
  RH:           { color:'#A78BFA', bg:'rgba(139,92,246,.15)'  },
  COMMANDES:    { color:'#2DD4BF', bg:'rgba(20,184,166,.15)'  },
  UTILISATEURS: { color:'#60A5FA', bg:'rgba(59,130,246,.15)'  },
  PARAMETRES:   { color:'#94A3B8', bg:'rgba(148,163,184,.15)' },
  PAIE:         { color:'#34D399', bg:'rgba(16,185,129,.15)'  },
  CLIENTS:      { color:'#F472B6', bg:'rgba(244,114,182,.15)' },
}

const SEVERITY_CFG: Record<Severity, { icon: string; color: string }> = {
  info:    { icon:'ℹ️',  color:'var(--text2)'  },
  success: { icon:'✅', color:'var(--acc2)'    },
  warning: { icon:'⚠️', color:'var(--acc)'     },
  danger:  { icon:'🚨', color:'var(--danger)'  },
}

type DateFilter = 'today' | '7j' | '30j' | 'all'
const PAGE_SIZE = 10

export default function Activity() {
  const { lang } = useAppStore()
  void lang

  const [search, setSearch]                 = useState('')
  const [moduleFilter, setModuleFilter]     = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateFilter, setDateFilter]         = useState<DateFilter>('all')
  const [page, setPage]                     = useState(1)

  const allModules = Array.from(new Set(ACTIVITY_LOG.map(e => e.module)))

  const filtered = useMemo(() => ACTIVITY_LOG.filter(e => {
    if (search &&
        !e.description.toLowerCase().includes(search.toLowerCase()) &&
        !e.user.toLowerCase().includes(search.toLowerCase())) return false
    if (moduleFilter && e.module !== moduleFilter) return false
    if (severityFilter && e.severity !== severityFilter) return false
    if (dateFilter === 'today' && !e.createdAt.startsWith('2026-05-14')) return false
    if (dateFilter === '7j'    && e.createdAt < '2026-05-08')            return false
    if (dateFilter === '30j'   && e.createdAt < '2026-04-14')            return false
    return true
  }), [search, moduleFilter, severityFilter, dateFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const todayCount    = ACTIVITY_LOG.filter(e => e.createdAt.startsWith('2026-05-14')).length
  const alertCount    = ACTIVITY_LOG.filter(e => e.severity === 'danger').length
  const activeModules = new Set(ACTIVITY_LOG.map(e => e.module)).size
  const hasFilters    = !!(search || moduleFilter || severityFilter || dateFilter !== 'all')

  function clearFilters() {
    setSearch(''); setModuleFilter(''); setSeverityFilter(''); setDateFilter('all'); setPage(1)
  }

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total événements', value:'15',               color:'var(--p2)'    },
          { label:"Aujourd'hui",      value:`${todayCount}`,    color:'var(--acc2)'  },
          { label:'Alertes sécurité', value:`${alertCount}`,    color:'var(--danger)'},
          { label:'Modules actifs',   value:`${activeModules}`, color:'var(--acc)'   },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:26 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">📋 Journal d'activité</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📥 Export CSV…')}>
              <Download size={13} /> Exporter CSV
            </button>
            {hasFilters && (
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={clearFilters}>
                <X size={13} /> Effacer filtres
              </button>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display:'flex', gap:9, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <span style={{
              position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
              color:'var(--text3)', fontSize:13, pointerEvents:'none',
            }}>🔍</span>
            <input className="input" placeholder="Rechercher description, utilisateur…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ paddingLeft:32 }} />
          </div>
          <select className="input" value={moduleFilter}
            onChange={e => { setModuleFilter(e.target.value); setPage(1) }}
            style={{ width:'auto', minWidth:150 }}>
            <option value="">Tous modules</option>
            {allModules.map(m => <option key={m}>{m}</option>)}
          </select>
          <select className="input" value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value); setPage(1) }}
            style={{ width:'auto', minWidth:140 }}>
            <option value="">Toutes sévérités</option>
            <option value="info">Info</option>
            <option value="success">Succès</option>
            <option value="warning">Avertissement</option>
            <option value="danger">Danger</option>
          </select>
          <div style={{ display:'flex', gap:4 }}>
            {([
              { id:'today', label:"Aujourd'hui" },
              { id:'7j',    label:'7 jours'     },
              { id:'30j',   label:'30 jours'    },
              { id:'all',   label:'Tout'        },
            ] as { id:DateFilter; label:string }[]).map(d => (
              <button key={d.id} onClick={() => { setDateFilter(d.id); setPage(1) }} style={{
                padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
                background: dateFilter === d.id ? 'var(--p)' : 'var(--bg3)',
                color:      dateFilter === d.id ? '#fff'     : 'var(--text2)',
                border:     dateFilter === d.id ? 'none'     : '1px solid var(--border)',
              }}>{d.label}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Module</th>
                <th>Action</th>
                <th>Utilisateur</th>
                <th>Description</th>
                <th>IP</th>
                <th style={{ textAlign:'center' }}>Sévérité</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(e => {
                const mod = MODULE_CFG[e.module] ?? { color:'var(--text2)', bg:'rgba(136,134,168,.15)' }
                const sev = SEVERITY_CFG[e.severity]
                return (
                  <tr key={e.id} style={{
                    background: e.severity === 'danger'  ? 'rgba(232,64,74,.04)'
                              : e.severity === 'warning' ? 'rgba(240,165,0,.04)' : undefined,
                    borderLeft: e.severity === 'danger'  ? '3px solid var(--danger)'
                              : e.severity === 'warning' ? '3px solid var(--acc)' : undefined,
                  }}>
                    <td className="td-mono" style={{ fontSize:11, whiteSpace:'nowrap' }}>{e.createdAt}</td>
                    <td>
                      <span style={{
                        display:'inline-block', padding:'2px 9px', borderRadius:20,
                        fontSize:11, fontWeight:700, background:mod.bg, color:mod.color,
                      }}>{e.module}</span>
                    </td>
                    <td style={{ fontSize:11, fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap' }}>
                      {e.action}
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{
                          width:26, height:26, borderRadius:'50%', flexShrink:0,
                          background:'linear-gradient(135deg, var(--p), var(--p2))',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:9, fontWeight:800, color:'#fff',
                        }}>{initials(e.user)}</div>
                        <span style={{ fontSize:12 }}>{e.user}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth:280 }}>
                      <span style={{ fontSize:12, color:'var(--text2)' }} title={e.description}>
                        {e.description.length > 60 ? e.description.slice(0, 60) + '…' : e.description}
                      </span>
                    </td>
                    <td className="td-mono" style={{ fontSize:10, color:'var(--text3)' }}>{e.ip}</td>
                    <td style={{ textAlign:'center', fontSize:15 }}>
                      <span title={e.severity} style={{ color:sev.color }}>{sev.icon}</span>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign:'center', color:'var(--text3)', padding:'28px 0', fontSize:13 }}>
                    Aucun événement trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:16 }}>
            <button className="mini-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ opacity: page === 1 ? .4 : 1 }}>
              ← Précédent
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className="mini-btn" onClick={() => setPage(p)} style={{
                background:  page === p ? 'var(--p)' : undefined,
                color:       page === p ? '#fff'     : undefined,
                borderColor: page === p ? 'var(--p)' : undefined,
              }}>{p}</button>
            ))}
            <button className="mini-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{ opacity: page === totalPages ? .4 : 1 }}>
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
