import { useState, useMemo, useEffect } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { useAppStore, t } from '@/stores/appStore'
import {
  Search, Download, X,
  ShoppingCart, Package, PackageCheck, PackageX, Lock, UserCog, ClipboardList,
  Users, UserPlus, UserMinus, UserX, Settings, Wallet, Heart,
  CheckCircle, Info, AlertTriangle, AlertOctagon,
  Shield, ToggleLeft, LogIn, LogOut, Truck, Trash2, Activity as ActivityIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV } from '@/utils/export'
import { auditApi } from '@/lib/api'
import type { LucideIcon } from 'lucide-react'

const MODULE_NORMALIZE: Record<string, string> = {
  orders: 'COMMANDES', customers: 'CLIENTS', products: 'STOCK', suppliers: 'COMMANDES',
  billing: 'PARAMÈTRES', employees: 'RH', auth: 'AUTH', tenant: 'PARAMÈTRES', sales: 'VENTES',
  // Codes backend en majuscules (audit logs créés directement avec ces noms)
  USERS: 'UTILISATEURS', PRODUCTS: 'STOCK', CUSTOMERS: 'CLIENTS', SUPPLIERS: 'COMMANDES',
  SALES: 'VENTES', EMPLOYEES: 'RH', TENANT: 'PARAMÈTRES', AUTH: 'AUTH',
}

// Labels lisibles d'actions techniques en 4 langues
const ACTION_LABELS: Record<string, [string, string, string, string]> = {
  INVITE_USER:        ['Utilisateur invité',     'User invited',          'Usuario invitado',         'Utente invitato'],
  DELETE_USER:        ['Utilisateur supprimé',   'User deleted',          'Usuario eliminado',        'Utente eliminato'],
  UPDATE_USER:        ['Utilisateur modifié',    'User updated',          'Usuario actualizado',      'Utente aggiornato'],
  TOGGLE_USER_ACTIVE: ['Statut compte modifié',  'Account status changed','Estado de cuenta cambiado','Stato account modificato'],
  TOGGLE_USER_2FA:    ['2FA modifié',            '2FA changed',           '2FA cambiado',             '2FA modificato'],
  CREATE_PRODUCT:     ['Produit créé',           'Product created',       'Producto creado',          'Prodotto creato'],
  UPDATE_PRODUCT:     ['Produit modifié',        'Product updated',       'Producto actualizado',     'Prodotto aggiornato'],
  DELETE_PRODUCT:     ['Produit supprimé',       'Product deleted',       'Producto eliminado',       'Prodotto eliminato'],
  CREATE_CUSTOMER:    ['Client créé',            'Customer created',      'Cliente creado',           'Cliente creato'],
  DELETE_CUSTOMER:    ['Client supprimé',        'Customer deleted',      'Cliente eliminado',        'Cliente eliminato'],
  CREATE_SUPPLIER:    ['Fournisseur créé',       'Supplier created',      'Proveedor creado',         'Fornitore creato'],
  DELETE_SUPPLIER:    ['Fournisseur supprimé',   'Supplier deleted',      'Proveedor eliminado',      'Fornitore eliminato'],
  CREATE_SALE:        ['Vente enregistrée',      'Sale recorded',         'Venta registrada',         'Vendita registrata'],
  CREATE_EMPLOYEE:    ['Employé créé',           'Employee created',      'Empleado creado',          'Dipendente creato'],
  DELETE_EMPLOYEE:    ['Employé supprimé',       'Employee deleted',      'Empleado eliminado',       'Dipendente eliminato'],
  LOGIN:              ['Connexion',              'Login',                 'Inicio de sesión',         'Accesso'],
  LOGOUT:             ['Déconnexion',            'Logout',                'Cierre de sesión',         'Disconnessione'],
  UPDATE_TENANT:      ['Boutique mise à jour',   'Shop updated',          'Tienda actualizada',      'Negozio aggiornato'],
  CHANGE_PASSWORD:    ['Mot de passe changé',    'Password changed',      'Contraseña cambiada',      'Password cambiata'],
  RESTORE_PRODUCT:    ['Produit restauré',       'Product restored',      'Producto restaurado',      'Prodotto ripristinato'],
  RESTORE_SUPPLIER:   ['Fournisseur restauré',   'Supplier restored',     'Proveedor restaurado',     'Fornitore ripristinato'],
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  INVITE_USER:        UserPlus,
  DELETE_USER:        UserMinus,
  UPDATE_USER:        UserCog,
  TOGGLE_USER_ACTIVE: ToggleLeft,
  TOGGLE_USER_2FA:    Shield,
  CREATE_PRODUCT:     Package,
  UPDATE_PRODUCT:     PackageCheck,
  DELETE_PRODUCT:     PackageX,
  CREATE_CUSTOMER:    Users,
  DELETE_CUSTOMER:    UserX,
  CREATE_SUPPLIER:    Truck,
  DELETE_SUPPLIER:    Trash2,
  CREATE_SALE:        ShoppingCart,
  CREATE_EMPLOYEE:    UserPlus,
  DELETE_EMPLOYEE:    UserMinus,
  LOGIN:              LogIn,
  LOGOUT:             LogOut,
  UPDATE_TENANT:      Settings,
  CHANGE_PASSWORD:    Lock,
  RESTORE_PRODUCT:    Package,
  RESTORE_SUPPLIER:   Truck,
}

function actionLabel(action: string, lang: string): string {
  const labels = ACTION_LABELS[action]
  if (!labels) {
    // Fallback : SNAKE_CASE → Title Case (e.g. "CREATE_FOO" → "Create Foo")
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
  const idx = lang === 'en' ? 1 : lang === 'es' ? 2 : lang === 'it' ? 3 : 0
  return labels[idx]
}

// Extrait une info utile (nom, email, id) du JSON stocké dans la description backend.
// Évite d'afficher le code action en double (ex: "DELETE_USER" comme description).
function parseDescription(raw: unknown, action: string): string {
  const s = typeof raw === 'string' ? raw : ''
  if (!s || s === action) return ''
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s)
      const v = obj.name || obj.email || obj.ref || obj.id || ''
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  return s
}

type Severity = 'success' | 'info' | 'warning' | 'danger'

interface ActivityEntry {
  id: number; module: string; action: string; user: string
  avatar: string; color: string; description: string
  rawDescription: string; createdAt: string
  ip: string; date: string; time: string; severity: Severity
}

const MODULE_CONFIG: Record<string, { color: string; bg: string; label: string; Icon: LucideIcon }> = {
  VENTES:       { color:'#818CF8', bg:'rgba(99,102,241,.15)',   label:'Ventes',       Icon: ShoppingCart },
  STOCK:        { color:'#F59E0B', bg:'rgba(245,158,11,.15)',   label:'Stock',        Icon: Package      },
  AUTH:         { color:'#EF4444', bg:'rgba(239,68,68,.15)',    label:'Auth',         Icon: Lock         },
  RH:           { color:'#A78BFA', bg:'rgba(139,92,246,.15)',   label:'RH',           Icon: UserCog      },
  COMMANDES:    { color:'#2DD4BF', bg:'rgba(20,184,166,.15)',   label:'Commandes',    Icon: ClipboardList },
  UTILISATEURS: { color:'#60A5FA', bg:'rgba(59,130,246,.15)',   label:'Utilisateurs', Icon: Users        },
  PARAMÈTRES:   { color:'#94A3B8', bg:'rgba(148,163,184,.15)', label:'Paramètres',   Icon: Settings     },
  PAIE:         { color:'#34D399', bg:'rgba(16,185,129,.15)',   label:'Paie',         Icon: Wallet       },
  CLIENTS:      { color:'#F472B6', bg:'rgba(244,114,182,.15)', label:'Clients',      Icon: Heart        },
}

/** Libellé de catégorie localisé. VENTES traduit (fr/en/es/it) ; les autres gardent
   leur label (codes/abréviations type RH/Auth/Stock, ou déjà clairs). Utilisé par le
   badge ET le filtre → cohérence, et plus aucun « SALES »/clé brute affichée. */
function moduleLabel(key: string, lang: string): string {
  if (key === 'VENTES') return lang === 'en' ? 'Sales' : lang === 'es' ? 'Ventas' : lang === 'it' ? 'Vendite' : 'Ventes'
  return MODULE_CONFIG[key]?.label ?? key
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; Icon: LucideIcon; label: string }> = {
  success: { color:'var(--acc2)',    bg:'rgba(14,196,126,.1)',  Icon: CheckCircle,   label:'Succès'  },
  info:    { color:'var(--p2)',      bg:'rgba(91,78,232,.1)',   Icon: Info,          label:'Info'    },
  warning: { color:'var(--acc)',     bg:'rgba(240,165,0,.1)',   Icon: AlertTriangle, label:'Alerte'  },
  danger:  { color:'var(--danger)',  bg:'rgba(232,64,74,.1)',   Icon: AlertOctagon,  label:'Danger'  },
}

function mapAuditLog(l: any, idx: number): ActivityEntry {
  const rawModule = l.module ?? ''
  const mod = (MODULE_NORMALIZE[rawModule] ?? String(rawModule || 'PARAMÈTRES')).toUpperCase()
  const cfg = MODULE_CONFIG[mod] ?? MODULE_CONFIG['PARAMÈTRES']
  const name = l.user?.name ?? 'Système'
  const d = new Date(l.createdAt)
  const sev: Severity = (['success', 'info', 'warning', 'danger'].includes(l.severity) ? l.severity : 'info') as Severity
  const rawDescription = typeof l.description === 'string' ? l.description : ''
  return {
    id: idx + 1,
    module: mod,
    action: l.action ?? '',
    user: name,
    avatar: name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(),
    color: cfg.color,
    rawDescription,
    createdAt: isNaN(d.getTime()) ? '' : d.toISOString(),
    description: rawDescription, // conservé pour la recherche, mais le rendu utilise parseDescription
    ip: l.ip ?? '—',
    date: isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
    time: isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5),
    severity: sev,
  }
}

const TODAY_ISO = new Date().toISOString().slice(0, 10)

const ITEMS_PER_PAGE = 8

export default function Activity() {
  const { lang } = useAppStore()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])

  const [search,         setSearch]         = useState('')
  const [moduleFilter,   setModuleFilter]   = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateFilter,     setDateFilter]     = useState('all')
  const [currentPage,    setCurrentPage]    = useState(1)
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    auditApi.list()
      .then((data: any[]) => setActivityLog((data ?? []).map(mapAuditLog)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => activityLog.filter(log => {
    const q = search.toLowerCase()
    const haystack = `${log.user} ${actionLabel(log.action, lang)} ${parseDescription(log.rawDescription, log.action)} ${log.action} ${log.module}`.toLowerCase()
    const matchSearch   = !q || haystack.includes(q)
    const matchModule   = !moduleFilter || log.module === moduleFilter
    const matchSeverity = !severityFilter || log.severity === severityFilter
    const matchDate     = dateFilter === 'today' ? log.date === TODAY_ISO : true
    return matchSearch && matchModule && matchSeverity && matchDate
  }), [activityLog, search, moduleFilter, severityFilter, dateFilter, lang])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const todayCount    = activityLog.filter(l => l.date === TODAY_ISO).length
  const dangerCount   = activityLog.filter(l => l.severity === 'danger').length
  const activeModules = new Set(activityLog.map(l => l.module)).size
  const hasFilters    = !!(search || moduleFilter || severityFilter || dateFilter !== 'all')

  const resetPage = () => setCurrentPage(1)

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <Skeleton height={56} count={5} />
    </div>
  )

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
          toast.success(lang === 'en' ? 'Export downloaded!' : lang === 'es' ? '¡Exportación descargada!' : lang === 'it' ? 'Esportazione scaricata!' : 'Export téléchargé !')
        }}>
          <Download size={14} /> {lang === 'en' ? 'Export CSV' : lang === 'es' ? 'Exportar CSV' : lang === 'it' ? 'Esporta CSV' : 'Exporter CSV'}
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { label: t('activity_total'),    value: activityLog.length, color:'var(--p2)'     },
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
              aria-label="Rechercher" placeholder={lang === 'en' ? 'Search user, action, description...' : lang === 'es' ? 'Buscar usuario, acción, descripción...' : lang === 'it' ? 'Cerca utente, azione, descrizione...' : 'Rechercher utilisateur, action, description...'}
              value={search} onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); resetPage() }}>
            <option value="">{t('activity_filter_module')}</option>
            {Object.keys(MODULE_CONFIG).map(m => <option key={m} value={m}>{moduleLabel(m, lang)}</option>)}
          </select>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); resetPage() }}>
            <option value="">{i('Toutes', 'All', 'Todas', 'Tutte')}</option>
            <option value="success">{i('Succès', 'Success', 'Éxito', 'Successo')}</option>
            <option value="info">Info</option>
            <option value="warning">{i('Alerte', 'Warning', 'Alerta', 'Avviso')}</option>
            <option value="danger">{i('Danger', 'Danger', 'Peligro', 'Pericolo')}</option>
          </select>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={dateFilter} onChange={e => { setDateFilter(e.target.value); resetPage() }}>
            <option value="all">{lang === 'en' ? 'All dates' : lang === 'es' ? 'Todas las fechas' : lang === 'it' ? 'Tutte le date' : 'Toutes dates'}</option>
            <option value="today">{lang === 'en' ? 'Today' : lang === 'es' ? 'Hoy' : lang === 'it' ? 'Oggi' : "Aujourd'hui"}</option>
          </select>
          {hasFilters && (
            <button className="mini-btn" style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}
              onClick={() => { setSearch(''); setModuleFilter(''); setSeverityFilter(''); setDateFilter('all'); setCurrentPage(1) }}>
              <X size={12} /> {lang === 'en' ? 'Clear' : lang === 'es' ? 'Borrar' : lang === 'it' ? 'Cancella' : 'Effacer'}
            </button>
          )}
        </div>

        {/* ── Timeline ── */}
        <div style={{ padding:'8px 20px 20px', borderTop:'1px solid var(--border)', minHeight:200 }}>
          {paginated.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text3)', fontSize:14 }}>
              {lang === 'en' ? 'No events found' : lang === 'es' ? 'Sin eventos encontrados' : lang === 'it' ? 'Nessun evento trovato' : 'Aucun événement trouvé'}
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
                const mod         = MODULE_CONFIG[log.module]
                const sev         = SEVERITY_CONFIG[log.severity]
                const moduleColor = mod?.color ?? 'var(--text3)'
                const ActionIcon  = ACTION_ICONS[log.action] ?? mod?.Icon ?? ActivityIcon
                const labelHuman  = actionLabel(log.action, lang)
                const detail      = parseDescription(log.rawDescription, log.action)
                const localeStr   = lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
                const dt          = log.createdAt ? new Date(log.createdAt) : null
                const timeStr     = dt ? dt.toLocaleTimeString(localeStr, { hour: '2-digit', minute: '2-digit' }) : log.time
                const dateStr     = dt ? dt.toLocaleDateString(localeStr, { day: 'numeric', month: 'short' }) : log.date
                const sevLabel    = log.severity === 'success' ? i('Succès', 'Success', 'Éxito', 'Successo')
                                  : log.severity === 'warning' ? i('Alerte', 'Warning', 'Alerta', 'Avviso')
                                  : log.severity === 'danger'  ? i('Danger', 'Danger', 'Peligro', 'Pericolo')
                                  : 'Info'

                return (
                  <div key={log.id}
                    style={{
                      display:'flex', alignItems:'flex-start', gap:14,
                      padding:'14px 18px',
                      background:'var(--card)',
                      border:'1px solid var(--border)',
                      borderLeft:`3px solid ${sev.color}`,
                      borderRadius:12,
                      marginBottom:8,
                      transition:'transform .15s, box-shadow .15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateX(3px)'
                      el.style.boxShadow = '0 4px 16px rgba(0,0,0,.10)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'none'
                      el.style.boxShadow = 'none'
                    }}>
                    {/* Icône d'action dans cercle coloré module */}
                    <div style={{
                      width:38, height:38, borderRadius:'50%', flexShrink:0,
                      background: `${moduleColor}18`,
                      border:`1px solid ${moduleColor}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <ActionIcon size={16} color={moduleColor} />
                    </div>

                    {/* Contenu */}
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Ligne 1 : action lisible + badge sévérité */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'var(--fw-semibold)', fontSize:14, color:'var(--text)' }}>
                          {labelHuman}
                        </span>
                        <span style={{
                          fontSize:11, fontWeight:'var(--fw-semibold)', padding:'2px 7px', borderRadius:99,
                          background: sev.bg, color: sev.color,
                          textTransform:'uppercase', letterSpacing:'.4px',
                        }}>
                          {sevLabel}
                        </span>
                      </div>

                      {/* Ligne 2 : auteur · module */}
                      <div style={{ fontSize:12, color:'var(--text2)', marginBottom: detail ? 4 : 0 }}>
                        <span style={{ fontWeight:600 }}>{log.user}</span>
                        <span style={{ opacity: 0.5 }}> · </span>
                        <span>{moduleLabel(log.module, lang)}</span>
                      </div>

                      {/* Ligne 3 : détail parsé (nom, email…) si dispo */}
                      {detail && (
                        <div style={{
                          fontSize:12, color:'var(--text3)', fontStyle:'italic',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        }}>
                          {detail}
                        </div>
                      )}
                    </div>

                    {/* Date à droite */}
                    <div style={{
                      fontSize:11, color:'var(--text3)',
                      flexShrink:0, textAlign:'right',
                      display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2,
                    }}>
                      <span style={{ fontFamily:'var(--mono)' }}>{timeStr}</span>
                      <span>{dateStr}</span>
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
              ← {lang === 'en' ? 'Prev' : lang === 'es' ? 'Ant.' : lang === 'it' ? 'Prec.' : 'Préc.'}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={{
                width:30, height:30, borderRadius:8, border:'none', cursor:'pointer',
                fontFamily:'var(--font)', fontSize:12, fontWeight:'var(--fw-semibold)',
                background: currentPage === page ? 'var(--p)' : 'var(--bg4)',
                color:      currentPage === page ? '#fff'     : 'var(--text2)',
              }}>{page}</button>
            ))}
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
              {lang === 'en' ? 'Next' : lang === 'es' ? 'Sig.' : lang === 'it' ? 'Succ.' : 'Suiv.'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
