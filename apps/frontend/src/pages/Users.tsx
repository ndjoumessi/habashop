import { useState, useEffect } from 'react'
import { useConfig, t } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { usersApi } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import {
  Search, Plus, Shield, X, Mail, Lock, Eye, EyeOff,
  Crown, Target, ShoppingCart, Archive, Calculator, UserCog, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { LucideIcon } from 'lucide-react'

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR'

interface User {
  id: string; name: string; email: string; role: Role
  active: boolean; twoFA: boolean; lastLogin: string; createdAt: string
}

const ROLE_CONFIG: Record<Role, { label: string; cls: string; desc: string; color: string; Icon: LucideIcon }> = {
  ADMIN:      { label:'Administrateur', cls:'badge-red',    desc:'Accès total à tous les modules', color:'#6C47FF', Icon: Crown      },
  MANAGER:    { label:'Gérant',         cls:'badge-violet', desc:'Tous modules sauf utilisateurs',  color:'#FF9500', Icon: Target     },
  CASHIER:    { label:'Caissier',       cls:'badge-teal',   desc:'POS uniquement',                  color:'#00D084', Icon: ShoppingCart },
  ACCOUNTANT: { label:'Comptable',      cls:'badge-amber',  desc:'Ventes, dépenses, rapports',     color:'#FFB800', Icon: Calculator },
  HR:         { label:'RH',             cls:'badge-blue',   desc:'RH, planning, paie',             color:'#00B8FF', Icon: UserCog   },
}

const PERMISSIONS: Record<Role, string[]> = {
  ADMIN:      ['Dashboard','POS','Stock','Commandes','Fournisseurs','Clients','Rapports','RH','Planning','Paie','Dépenses','Prévisions','Utilisateurs','Activité','Paramètres'],
  MANAGER:    ['Dashboard','POS','Stock','Commandes','Fournisseurs','Clients','Rapports','RH','Planning','Dépenses','Prévisions'],
  CASHIER:    ['POS','Stock (lecture)'],
  ACCOUNTANT: ['Dashboard','Rapports','Dépenses','Commandes (lecture)'],
  HR:         ['RH','Planning','Paie'],
}

// Libellés des modules i18n (par nom FR, comme la sidebar)
const MODULE_LABELS_T: Record<string, Record<string, string>> = {
  'Dashboard':    { fr:'Dashboard',    en:'Dashboard',  es:'Panel',          it:'Dashboard'     },
  'POS':          { fr:'POS',          en:'POS',        es:'POS',            it:'POS'           },
  'Stock':        { fr:'Stock',        en:'Stock',      es:'Stock',          it:'Stock'         },
  'Commandes':    { fr:'Commandes',    en:'Orders',     es:'Pedidos',        it:'Ordini'        },
  'Fournisseurs': { fr:'Fournisseurs', en:'Suppliers',  es:'Proveedores',    it:'Fornitori'     },
  'Clients':      { fr:'Clients',      en:'Customers',  es:'Clientes',       it:'Clienti'       },
  'Rapports':     { fr:'Rapports',     en:'Reports',    es:'Informes',       it:'Rapporti'      },
  'RH':           { fr:'RH',           en:'HR',         es:'RR.HH.',         it:'HR'            },
  'Planning':     { fr:'Planning',     en:'Schedule',   es:'Planificación',  it:'Pianificazione'},
  'Paie':         { fr:'Paie',         en:'Payroll',    es:'Nómina',         it:'Busta paga'    },
  'Dépenses':     { fr:'Dépenses',     en:'Expenses',   es:'Gastos',         it:'Spese'         },
  'Prévisions':   { fr:'Prévisions',   en:'Forecasts',  es:'Previsiones',    it:'Previsioni'    },
  'Utilisateurs': { fr:'Utilisateurs', en:'Users',      es:'Usuarios',       it:'Utenti'        },
  'Activité':     { fr:'Activité',     en:'Activity',   es:'Actividad',      it:'Attività'      },
  'Paramètres':   { fr:'Paramètres',   en:'Settings',   es:'Configuración',  it:'Impostazioni'  },
}
const READONLY_T: Record<string, string> = { fr:'lecture', en:'read-only', es:'lectura', it:'lettura' }
const moduleLabel = (mod: string, lang: string) => {
  const ro = mod.match(/^(.*?)\s*\(lecture\)$/)
  if (ro) return `${MODULE_LABELS_T[ro[1]]?.[lang] ?? ro[1]} (${READONLY_T[lang] ?? 'lecture'})`
  return MODULE_LABELS_T[mod]?.[lang] ?? mod
}

// Descriptions des rôles i18n
const ROLE_DESC_T: Record<Role, Record<string, string>> = {
  ADMIN:      { fr:'Accès total à tous les modules', en:'Full access to all modules',      es:'Acceso total a todos los módulos',   it:'Accesso totale a tutti i moduli' },
  MANAGER:    { fr:'Tous modules sauf utilisateurs', en:'All modules except users',         es:'Todos los módulos excepto usuarios', it:'Tutti i moduli tranne utenti' },
  CASHIER:    { fr:'POS uniquement',                 en:'POS only',                         es:'Solo POS',                           it:'Solo POS' },
  ACCOUNTANT: { fr:'Ventes, dépenses, rapports',     en:'Sales, expenses, reports',         es:'Ventas, gastos, informes',          it:'Vendite, spese, rapporti' },
  HR:         { fr:'RH, planning, paie',             en:'HR, schedule, payroll',            es:'RR.HH., planificación, nómina',      it:'HR, pianificazione, busta paga' },
}
const roleDesc = (role: Role, lang: string) => ROLE_DESC_T[role]?.[lang] ?? ROLE_CONFIG[role].desc

const AVATAR_COLORS: Record<Role, string> = {
  ADMIN:      '#6C47FF',
  MANAGER:    '#FF9500',
  CASHIER:    '#00D084',
  ACCOUNTANT: '#FFB800',
  HR:         '#00B8FF',
}

const VALID_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR']

function mapApiUser(u: any): User {
  const role = (VALID_ROLES.includes(u.role) ? u.role : 'CASHIER') as Role
  return {
    id: String(u.id),
    name: u.name ?? u.email?.split('@')[0] ?? '—',
    email: u.email ?? '',
    role,
    active: u.isActive ?? u.active ?? true,
    twoFA: u.twoFAEnabled ?? u.twoFA ?? false,
    lastLogin: u.lastLoginAt ?? u.lastLogin ?? '',  // ISO ou vide
    createdAt: u.createdAt ?? '',                    // ISO conservée pour formatage à l'affichage
  }
}

function initials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

// En ligne = actif ET dernière activité < 5 min
function isOnlineNow(u: User) {
  if (!u.active || !u.lastLogin) return false
  const ts = new Date(u.lastLogin).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < 5 * 60 * 1000
}

export default function Users() {
  const { lang } = useConfig()
  void lang
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const currentUser = useAuthStore(s => s.user)
  const currentRole = String(currentUser?.role ?? '').toUpperCase()
  const isAdmin = currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN'
  const canToggle2FA = (uid: string) => isAdmin || uid === currentUser?.id
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const [users, setUsers]           = useState<User[]>([])
  const [search, setSearch]         = useState('')

  useEffect(() => {
    usersApi.list()
      .then((data: any[]) => { if (Array.isArray(data)) setUsers(data.map(mapApiUser)) })
      .catch(() => {})
  }, [])

  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [showModal, setShowModal]   = useState(false)
  const [showPerms, setShowPerms]   = useState<Role | null>(null)
  const [form, setForm]             = useState({ name:'', email:'', role:'CASHIER' as Role, password:'', confirm:'' })
  const [showPwd, setShowPwd]       = useState(false)
  const [editUser, setEditUser]     = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm]     = useState({ name:'', email:'', role:'CASHIER' as Role, active:true, twoFA:false })

  const filtered = users.filter(u =>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  )

  const toggleActive = async (id: string) => {
    const u = users.find(x => x.id === id)
    if (!u) return
    const next = !u.active
    try {
      await usersApi.toggleActive(id, next)
      setUsers(prev => prev.map(x => x.id === id ? { ...x, active: next } : x))
      toast.success(next
        ? i('Compte activé', 'Account activated', 'Cuenta activada', 'Account attivato')
        : i('Compte désactivé', 'Account deactivated', 'Cuenta desactivada', 'Account disattivato')
      )
    } catch (e: any) {
      toast.error(`${i('Échec', 'Failed', 'Error', 'Errore')} : ${e?.message ?? ''}`)
    }
  }

  const toggle2FA = async (id: string) => {
    const u = users.find(x => x.id === id)
    if (!u) return
    const next = !u.twoFA
    try {
      await usersApi.toggle2FA(id, next)
      setUsers(prev => prev.map(x => x.id === id ? { ...x, twoFA: next } : x))
      toast.success(i('2FA mis à jour', '2FA updated', '2FA actualizado', '2FA aggiornato'))
    } catch (e: any) {
      toast.error(`${i('Échec', 'Failed', 'Error', 'Errore')} : ${e?.message ?? ''}`)
    }
  }

  const invite = async () => {
    if (!form.name || !form.email) {
      toast.error(i('Remplissez tous les champs', 'Fill in all fields', 'Complete todos los campos', 'Compila tutti i campi'))
      return
    }
    if (form.password !== form.confirm) {
      toast.error(i('Mots de passe différents', 'Passwords do not match', 'Las contraseñas no coinciden', 'Le password non corrispondono'))
      return
    }
    try {
      const created = await usersApi.invite({ name: form.name, email: form.email, role: form.role, password: form.password })
      setUsers(prev => [...prev, mapApiUser(created)])
      setShowModal(false)
      setForm({ name:'', email:'', role:'CASHIER', password:'', confirm:'' })
      toast.success(i(`${form.name} invité(e)`, `${form.name} invited`, `${form.name} invitado(a)`, `${form.name} invitato(a)`))
    } catch (e: any) {
      toast.error(`${i('Échec invitation', 'Invitation failed', 'Error de invitación', 'Invito fallito')} : ${e?.message ?? ''}`)
    }
  }

  const handleDelete = async (u: User) => {
    const ok = await confirm({
      title: i('Supprimer cet utilisateur ?', 'Delete this user?', '¿Eliminar este usuario?', 'Eliminare questo utente?'),
      message: i(
        `${u.name} (${u.email}) perdra l'accès immédiatement. Cette action peut être annulée par un administrateur.`,
        `${u.name} (${u.email}) will lose access immediately. This action can be reversed by an administrator.`,
        `${u.name} (${u.email}) perderá el acceso inmediatamente. Esta acción puede ser revertida por un administrador.`,
        `${u.name} (${u.email}) perderà l'accesso immediatamente. Questa azione può essere annullata da un amministratore.`,
      ),
      danger: true,
    })
    if (!ok) return
    try {
      await usersApi.delete(u.id)
      setUsers(prev => prev.filter(x => x.id !== u.id))
      toast.success(i('Utilisateur supprimé', 'User deleted', 'Usuario eliminado', 'Utente eliminato'))
    } catch (e: any) {
      toast.error(`${i('Échec suppression', 'Delete failed', 'Error al eliminar', 'Eliminazione fallita')} : ${e?.message ?? ''}`)
    }
  }

  const stats = {
    total:   users.length,
    active:  users.filter(u => u.active).length,
    with2FA: users.filter(u => u.twoFA).length,
    admins:  users.filter(u => u.role === 'ADMIN').length,
  }

  const ROLE_LABELS: Record<Role, string> = {
    ADMIN:      t('users_role_admin'),
    MANAGER:    t('users_role_manager'),
    CASHIER:    t('users_role_cashier'),
    ACCOUNTANT: t('users_role_accountant'),
    HR:         t('users_role_hr'),
  }

  return (
    <div className="space-y-5 animate-in">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:t('users_total'),       value:stats.total,   color:'var(--p2)'     },
          { label:t('users_active'),      value:stats.active,  color:'var(--acc2)'   },
          { label:t('users_2fa_enabled'), value:stats.with2FA, color:'var(--p3)'     },
          { label:t('users_admins'),      value:stats.admins,  color:'var(--danger)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Matrice des rôles ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Shield size={15} /> {lang === 'en' ? 'Roles & permissions matrix' : lang === 'es' ? 'Matriz de roles y permisos' : lang === 'it' ? 'Matrice ruoli e permessi' : 'Matrice des rôles & permissions'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPerms(showPerms ? null : 'ADMIN')}>
            {showPerms ? (lang === 'en' ? 'Hide' : lang === 'es' ? 'Ocultar' : lang === 'it' ? 'Nascondi' : 'Masquer') : (lang === 'en' ? 'View details' : lang === 'es' ? 'Ver detalles' : lang === 'it' ? 'Vedi dettagli' : 'Voir détails')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_CONFIG) as Role[]).map(role => {
            const cfg = ROLE_CONFIG[role]
            const RoleIcon = cfg.Icon
            return (
              <div key={role}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  background: showPerms === role ? `${cfg.color}12` : 'var(--bg3)',
                  border:`1px solid ${showPerms === role ? `${cfg.color}33` : 'var(--border)'}`,
                  minWidth:180,
                }}
                onClick={() => setShowPerms(showPerms === role ? null : role)}
              >
                <RoleIcon size={15} style={{ color:cfg.color, flexShrink:0 }} />
                <div>
                  <div className="text-xs font-bold" style={{ color:'var(--text)' }}>{ROLE_LABELS[role]}</div>
                  <div className="text-xs" style={{ color:'var(--text3)' }}>{roleDesc(role, lang)}</div>
                </div>
                <span className={`badge ${cfg.cls} ml-auto`}>{users.filter(u => u.role === role).length}</span>
              </div>
            )
          })}
        </div>
        {showPerms && (
          <div className="mt-4 p-4 rounded-xl" style={{ background:'var(--bg3)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color:'var(--text3)' }}>
              {t('users_permissions')} — {ROLE_LABELS[showPerms]}
            </p>
            <div className="flex flex-wrap gap-2">
              {PERMISSIONS[showPerms].map(p => (
                <span key={p} className="badge badge-teal">{moduleLabel(p, lang)}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Cards header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:10, flex:1, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
            <input className="input" style={{ paddingLeft:34, fontSize:13 }}
              placeholder={lang === 'en' ? 'Name, email...' : lang === 'es' ? 'Nombre, email...' : lang === 'it' ? 'Nome, email...' : 'Nom, email...'}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width:'auto', fontSize:13 }}
            value={roleFilter} onChange={e => setRoleFilter(e.target.value as Role | '')}>
            <option value="">{lang === 'en' ? 'All roles' : lang === 'es' ? 'Todos los roles' : lang === 'it' ? 'Tutti i ruoli' : 'Tous les rôles'}</option>
            {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowModal(true)}>
            <Plus size={13} /> {lang === 'en' ? 'Invite user' : lang === 'es' ? 'Invitar a un usuario' : lang === 'it' ? 'Invita un utente' : 'Inviter un utilisateur'}
          </button>
        )}
      </div>

      {/* ── Grid de cartes ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
        gap:14,
      }}>
        {filtered.map(user => {
          const cfg      = ROLE_CONFIG[user.role]
          const RoleIcon = cfg.Icon
          const online   = isOnlineNow(user)
          const avatarColor = AVATAR_COLORS[user.role]

          return (
            <div key={user.id} style={{
              background:'var(--card)',
              border:`1px solid ${online ? 'rgba(0,208,132,.18)' : 'var(--border)'}`,
              borderRadius:18, overflow:'hidden',
              transition:'transform .2s, box-shadow .2s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(-2px)'
                el.style.boxShadow = '0 8px 28px rgba(0,0,0,.18)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'none'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Bande colorée role */}
              <div style={{
                height:4,
                background:`linear-gradient(90deg, ${cfg.color}, ${cfg.color}66)`,
                boxShadow:`0 0 8px ${cfg.color}44`,
              }} />

              <div style={{ padding:'18px 20px' }}>
                {/* Header avatar */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{
                      width:48, height:48, borderRadius:14,
                      background:avatarColor,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, fontWeight:900, color:'#fff',
                      boxShadow:`0 6px 18px ${avatarColor}44`,
                    }}>
                      {initials(user.name)}
                    </div>
                    {/* Status dot */}
                    <div style={{
                      position:'absolute', bottom:-2, right:-2,
                      width:14, height:14, borderRadius:'50%',
                      background: online ? '#00D084' : '#55556A',
                      border:'2px solid var(--card)',
                      boxShadow: online ? '0 0 8px rgba(0,208,132,.6)' : 'none',
                    }} />
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontSize:13, fontWeight:800, color:'var(--text)',
                      marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {user.name}
                    </div>
                    <div style={{
                      fontSize:11, color:'var(--text3)', marginBottom:6,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {user.email}
                    </div>
                    <span style={{
                      fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px',
                      padding:'3px 9px', borderRadius:99,
                      background:`${cfg.color}15`, color:cfg.color,
                      border:`1px solid ${cfg.color}33`,
                      display:'inline-flex', alignItems:'center', gap:4,
                    }}>
                      <RoleIcon size={9}/> {ROLE_LABELS[user.role]}
                    </span>
                  </div>

                  {/* 2FA badge — bouton si admin OU self, sinon badge lecture seule */}
                  {canToggle2FA(user.id) ? (
                    <button
                      type="button"
                      onClick={() => toggle2FA(user.id)}
                      style={{
                        padding:'4px 8px', borderRadius:8, border:'none', cursor:'pointer',
                        fontFamily:'var(--font)', fontSize:9, fontWeight:800,
                        background: user.twoFA ? 'rgba(16,185,129,.12)' : 'rgba(255,255,255,.05)',
                        color: user.twoFA ? 'var(--acc2)' : 'var(--text3)',
                        flexShrink:0,
                      }}
                      title={i('Activer/désactiver 2FA', 'Toggle 2FA', 'Activar/desactivar 2FA', 'Attiva/disattiva 2FA')}
                      aria-label={i('Activer/désactiver 2FA', 'Toggle 2FA', 'Activar/desactivar 2FA', 'Attiva/disattiva 2FA')}
                    >
                      2FA
                    </button>
                  ) : (
                    <span style={{
                      padding:'4px 8px', borderRadius:8,
                      fontFamily:'var(--font)', fontSize:9, fontWeight:800,
                      background: user.twoFA ? 'rgba(16,185,129,.12)' : 'rgba(255,255,255,.05)',
                      color: user.twoFA ? 'var(--acc2)' : 'var(--text3)',
                      flexShrink:0,
                    }}>
                      2FA
                    </span>
                  )}
                </div>

                {/* Infos grid */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  <div style={{
                    background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
                    borderRadius:10, padding:'8px 10px',
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>
                      {lang === 'en' ? 'Last login' : lang === 'es' ? 'Último acceso' : lang === 'it' ? 'Ultimo accesso' : 'Connexion'}
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color: online ? 'var(--acc2)' : 'var(--text2)' }}>
                      {online
                        ? (lang === 'en' ? 'Online' : lang === 'es' ? 'En línea' : lang === 'it' ? 'Online' : 'En ligne')
                        : (user.lastLogin ? fmtDate(user.lastLogin) : i('Jamais', 'Never', 'Nunca', 'Mai'))}
                    </div>
                  </div>
                  <div style={{
                    background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
                    borderRadius:10, padding:'8px 10px',
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>
                      {lang === 'en' ? 'Member since' : lang === 'es' ? 'Miembro desde' : lang === 'it' ? 'Membro dal' : 'Membre depuis'}
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)' }}>
                      {fmtDate(user.createdAt) || '—'}
                    </div>
                  </div>
                </div>

                {/* Actions — admin only ; non-admins voient la carte en lecture seule */}
                {isAdmin && (
                  <div style={{ display:'flex', gap:6 }}>
                    <button type="button" className="btn btn-sm btn-ghost"
                      style={{ flex:1, justifyContent:'center', cursor:'pointer' }}
                      onClick={() => {
                        setEditUser(user)
                        setEditForm({ name:user.name, email:user.email, role:user.role, active:user.active, twoFA:user.twoFA })
                        setShowEditModal(true)
                      }}>
                      <Archive size={12}/> {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}
                    </button>
                    <button type="button"
                      style={{
                        flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                        padding:'6px', borderRadius:9, border:'none', cursor:'pointer',
                        fontFamily:'var(--font)', fontSize:11, fontWeight:700,
                        background: user.active ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
                        color: user.active ? 'var(--danger)' : 'var(--acc2)',
                      }}
                      onClick={() => toggleActive(user.id)}>
                      {user.active ? (lang === 'en' ? 'Disable' : lang === 'es' ? 'Desactivar' : lang === 'it' ? 'Disattiva' : 'Désactiver') : (lang === 'en' ? 'Enable' : lang === 'es' ? 'Activar' : lang === 'it' ? 'Attiva' : 'Activer')}
                    </button>
                    <button type="button"
                      title={i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}
                      aria-label={i('Supprimer', 'Delete', 'Eliminar', 'Elimina') + ' ' + user.name}
                      onClick={() => handleDelete(user)}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'center',
                        padding:'6px 10px', borderRadius:9, border:'none', cursor:'pointer',
                        background:'rgba(239,68,68,.08)', color:'var(--danger)',
                        transition:'background .15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.16)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{
            gridColumn:'1/-1', textAlign:'center', padding:'60px 0',
            color:'var(--text3)', fontSize:14,
          }}>
            {lang === 'en' ? 'No users found' : lang === 'es' ? 'Sin usuarios encontrados' : lang === 'it' ? 'Nessun utente trovato' : 'Aucun utilisateur trouvé'}
          </div>
        )}
      </div>

      {/* ── Modal modifier ── */}
      {showEditModal && editUser && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color:'var(--text)' }}>{lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'} — {editUser.name}</h3>
                <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{lang === 'en' ? 'Update user information' : lang === 'es' ? 'Actualizar la información del usuario' : lang === 'it' ? 'Aggiorna le informazioni dell\'utente' : "Modifier les informations de l'utilisateur"}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}><X size={14} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Ligne 1 : Nom complet + Rôle */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                    {i('Nom complet', 'Full name', 'Nombre completo', 'Nome completo')}
                  </label>
                  <input
                    aria-label={i('Nom complet', 'Full name', 'Nombre completo', 'Nome completo')}
                    className="input text-sm"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                    {i('Rôle', 'Role', 'Rol', 'Ruolo')}
                  </label>
                  <select
                    aria-label={i('Rôle', 'Role', 'Rol', 'Ruolo')}
                    className="input text-sm"
                    value={editForm.role}
                    onChange={e => setEditForm(f => ({...f, role:e.target.value as Role}))}>
                    {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ligne 2 : Email (icône Mail intégrée) */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                  Email
                </label>
                <div style={{ position:'relative' }}>
                  <Mail size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
                  <input
                    aria-label="Email"
                    className="input text-sm"
                    type="email"
                    style={{ paddingLeft:36, width:'100%' }}
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({...f, email:e.target.value}))} />
                </div>
              </div>

              {/* Séparateur */}
              <div style={{ height:1, background:'var(--border)' }} />

              {/* Toggles Statut + 2FA */}
              <div
                onClick={() => setEditForm(f => ({...f, active:!f.active}))}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 16px', background:'var(--bg3)', borderRadius:12,
                  cursor:'pointer', transition:'background .15s',
                }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>
                    {i('Compte actif', 'Active account', 'Cuenta activa', 'Account attivo')}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text2)' }}>
                    {i("L'utilisateur peut se connecter", 'The user can sign in', 'El usuario puede iniciar sesión', "L'utente può accedere")}
                  </div>
                </div>
                <div role="switch" aria-checked={editForm.active} aria-label={i('Compte actif', 'Active account', 'Cuenta activa', 'Account attivo')}
                  style={{
                    width:44, height:24, borderRadius:99,
                    background: editForm.active ? 'var(--p)' : 'var(--bg)',
                    border:'2px solid var(--border)',
                    position:'relative', cursor:'pointer', flexShrink:0,
                    transition:'background .2s',
                  }}>
                  <div style={{
                    position:'absolute', top:2, left: editForm.active ? 20 : 2,
                    width:16, height:16, borderRadius:'50%',
                    background: editForm.active ? '#fff' : 'var(--text3)',
                    transition:'left .2s',
                  }} />
                </div>
              </div>

              <div
                onClick={() => setEditForm(f => ({...f, twoFA:!f.twoFA}))}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 16px', background:'var(--bg3)', borderRadius:12,
                  cursor:'pointer', transition:'background .15s',
                }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>
                    {i('Authentification 2FA', 'Two-factor authentication', 'Autenticación 2FA', 'Autenticazione 2FA')}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text2)' }}>
                    {i('Sécurité renforcée à la connexion', 'Stronger sign-in security', 'Seguridad reforzada al iniciar sesión', 'Sicurezza rafforzata al login')}
                  </div>
                </div>
                <div role="switch" aria-checked={editForm.twoFA} aria-label="2FA"
                  style={{
                    width:44, height:24, borderRadius:99,
                    background: editForm.twoFA ? 'var(--p)' : 'var(--bg)',
                    border:'2px solid var(--border)',
                    position:'relative', cursor:'pointer', flexShrink:0,
                    transition:'background .2s',
                  }}>
                  <div style={{
                    position:'absolute', top:2, left: editForm.twoFA ? 20 : 2,
                    width:16, height:16, borderRadius:'50%',
                    background: editForm.twoFA ? '#fff' : 'var(--text3)',
                    transition:'left .2s',
                  }} />
                </div>
              </div>

              {/* Preview modules accessibles */}
              {editForm.role && (
                <div style={{
                  padding:12, borderRadius:12,
                  background:`${ROLE_CONFIG[editForm.role].color}10`,
                  border:`1px solid ${ROLE_CONFIG[editForm.role].color}25`,
                }}>
                  <p style={{ fontSize:11, fontWeight:700, marginBottom:6, color:ROLE_CONFIG[editForm.role].color }}>
                    {t('users_permissions')} — {ROLE_LABELS[editForm.role]}
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {PERMISSIONS[editForm.role].map(p => <span key={p} className="badge badge-teal" style={{ fontSize:10 }}>{moduleLabel(p, lang)}</span>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={async () => {
                if (!editForm.name || !editForm.email) {
                  toast.error(i('Nom et email requis', 'Name and email required', 'Nombre y email requeridos', 'Nome ed email richiesti'))
                  return
                }
                try {
                  const updated = await usersApi.update(editUser.id, { name: editForm.name, email: editForm.email, role: editForm.role })
                  setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...mapApiUser(updated) } : u))
                  // Toggles isActive / twoFA gérés séparément si l'utilisateur les a changés
                  if (editForm.active !== editUser.active) {
                    await usersApi.toggleActive(editUser.id, editForm.active)
                  }
                  if (editForm.twoFA !== editUser.twoFA) {
                    await usersApi.toggle2FA(editUser.id, editForm.twoFA)
                  }
                  setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, active: editForm.active, twoFA: editForm.twoFA } : u))
                  setShowEditModal(false)
                  toast.success(i(`${editForm.name} mis à jour`, `${editForm.name} updated`, `${editForm.name} actualizado`, `${editForm.name} aggiornato`))
                } catch (e: any) {
                  toast.error(`${i('Échec mise à jour', 'Update failed', 'Error al actualizar', 'Aggiornamento fallito')} : ${e?.message ?? ''}`)
                }
              }}>
                {lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : lang === 'it' ? 'Salva' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal invitation ── */}
      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color:'var(--text)' }}>{lang === 'en' ? 'Invite a user' : lang === 'es' ? 'Invitar a un usuario' : lang === 'it' ? 'Invita un utente' : 'Inviter un utilisateur'}</h3>
                <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{lang === 'en' ? 'A welcome email will be sent' : lang === 'es' ? 'Se enviará un email de bienvenida' : lang === 'it' ? 'Verrà inviata un\'email di benvenuto' : 'Un email de bienvenue sera envoyé'}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Ligne 1 : Nom complet + Rôle */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                    {i('Nom complet', 'Full name', 'Nombre completo', 'Nome completo')}
                  </label>
                  <input
                    aria-label={i('Nom complet', 'Full name', 'Nombre completo', 'Nome completo')}
                    className="input text-sm"
                    placeholder={i('Prénom Nom', 'First Last', 'Nombre Apellido', 'Nome Cognome')}
                    value={form.name}
                    onChange={e => setForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                    {i('Rôle', 'Role', 'Rol', 'Ruolo')}
                  </label>
                  <select
                    aria-label={i('Rôle', 'Role', 'Rol', 'Ruolo')}
                    className="input text-sm"
                    value={form.role}
                    onChange={e => setForm(f => ({...f, role:e.target.value as Role}))}>
                    {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ligne 2 : Email (pleine largeur, icône Mail intégrée) */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                  Email
                </label>
                <div style={{ position:'relative' }}>
                  <Mail size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
                  <input
                    aria-label="Email"
                    className="input text-sm"
                    type="email"
                    placeholder="email@example.com"
                    style={{ paddingLeft:36, width:'100%' }}
                    value={form.email}
                    onChange={e => setForm(f => ({...f, email:e.target.value}))} />
                </div>
              </div>

              {/* Ligne 3 : Mot de passe + Confirmer (icônes Lock/Eye intégrées) */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                    {i('Mot de passe', 'Password', 'Contraseña', 'Password')}
                  </label>
                  <div style={{ position:'relative' }}>
                    <Lock size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
                    <input
                      className="input text-sm"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{ paddingLeft:36, paddingRight:36, width:'100%' }}
                      value={form.password}
                      onChange={e => setForm(f => ({...f, password:e.target.value}))} />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      aria-label={i('Afficher/masquer le mot de passe', 'Toggle password visibility', 'Mostrar/ocultar contraseña', 'Mostra/nascondi password')}
                      style={{
                        position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'var(--text3)',
                        padding:4, display:'flex', alignItems:'center',
                      }}>
                      {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text2)', marginBottom:6 }}>
                    {i('Confirmer', 'Confirm', 'Confirmar', 'Conferma')}
                  </label>
                  <div style={{ position:'relative' }}>
                    <Lock size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
                    <input
                      aria-label={i('Confirmer', 'Confirm', 'Confirmar', 'Conferma')}
                      className="input text-sm"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{ paddingLeft:36, width:'100%' }}
                      value={form.confirm}
                      onChange={e => setForm(f => ({...f, confirm:e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Preview modules accessibles */}
              {form.role && (
                <div style={{
                  padding:12, borderRadius:12,
                  background:`${ROLE_CONFIG[form.role].color}10`,
                  border:`1px solid ${ROLE_CONFIG[form.role].color}25`,
                }}>
                  <p style={{ fontSize:11, fontWeight:700, marginBottom:6, color:ROLE_CONFIG[form.role].color }}>
                    {t('users_permissions')} — {ROLE_LABELS[form.role]}
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {PERMISSIONS[form.role].map(p => <span key={p} className="badge badge-teal" style={{ fontSize:10 }}>{moduleLabel(p, lang)}</span>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={invite}>
                {lang === 'en' ? 'Send invitation' : lang === 'es' ? 'Enviar la invitación' : lang === 'it' ? 'Invia l\'invito' : "Envoyer l'invitation"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
