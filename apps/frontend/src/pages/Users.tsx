import { useState, useEffect } from 'react'
import { useConfig, t } from '@/stores/appStore'
import { tenantApi } from '@/lib/api'
import {
  Search, Plus, Shield, X, Mail, Lock, Eye, EyeOff,
  Crown, Target, ShoppingCart, Archive, Calculator, UserCog,
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
    name: u.name ?? u.email?.split('@')[0] ?? 'Utilisateur',
    email: u.email ?? '',
    role,
    active: u.active ?? u.isActive ?? true,
    twoFA: u.twoFA ?? false,
    lastLogin: u.lastLogin ?? '—',
    createdAt: (u.createdAt ?? '').split('T')[0] ?? '',
  }
}

function initials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

function isOnlineNow(u: User) {
  return u.active && (u.lastLogin.includes("Aujourd") || u.lastLogin.includes(" min"))
}

export default function Users() {
  const { lang } = useConfig()
  void lang
  const [users, setUsers]           = useState<User[]>([])
  const [search, setSearch]         = useState('')

  useEffect(() => {
    tenantApi.users()
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

  const toggleActive = (id: string) => {
    const u = users.find(u => u.id === id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))
    toast.success(`Compte ${u?.active ? 'désactivé' : 'activé'}`)
  }

  const toggle2FA = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, twoFA: !u.twoFA } : u))
    toast.success('2FA mis à jour')
  }

  const invite = () => {
    if (!form.name || !form.email) { toast.error('Remplissez tous les champs'); return }
    if (form.password !== form.confirm) { toast.error('Mots de passe différents'); return }
    const newUser: User = {
      id: String(Date.now()), name:form.name, email:form.email, role:form.role,
      active:true, twoFA:false, lastLogin:'Jamais', createdAt: new Date().toISOString().split('T')[0],
    }
    setUsers(prev => [...prev, newUser])
    setShowModal(false)
    setForm({ name:'', email:'', role:'CASHIER', password:'', confirm:'' })
    toast.success(`${form.name} invité(e)`)
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
                  <div className="text-xs" style={{ color:'var(--text3)' }}>{cfg.desc}</div>
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
                <span key={p} className="badge badge-teal">{p}</span>
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
              <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowModal(true)}>
          <Plus size={13} /> {lang === 'en' ? 'Invite user' : lang === 'es' ? 'Invitar a un usuario' : lang === 'it' ? 'Invita un utente' : 'Inviter un utilisateur'}
        </button>
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

                  {/* 2FA badge */}
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
                    title="Toggle 2FA"
                    aria-label="Toggle 2FA"
                  >
                    2FA
                  </button>
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
                      {online ? (lang === 'en' ? 'Online' : lang === 'es' ? 'En línea' : lang === 'it' ? 'Online' : 'En ligne') : user.lastLogin}
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
                      {user.createdAt}
                    </div>
                  </div>
                </div>

                {/* Actions */}
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
                </div>
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Nom complet</label>
                  <input aria-label="Nom complet" className="input text-sm" value={editForm.name} onChange={e => setEditForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Rôle</label>
                  <select aria-label="Rôle" className="input text-sm" value={editForm.role} onChange={e => setEditForm(f => ({...f, role:e.target.value as Role}))}>
                    {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text3)' }} />
                  <input aria-label="Email" className="input text-sm pl-8" type="email" value={editForm.email} onChange={e => setEditForm(f => ({...f, email:e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Statut</label>
                  <select aria-label="Statut" className="input text-sm" value={editForm.active ? 'active' : 'inactive'} onChange={e => setEditForm(f => ({...f, active:e.target.value==='active'}))}>
                    <option value="active">Actif</option><option value="inactive">Inactif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>2FA</label>
                  <select aria-label="2FA" className="input text-sm" value={editForm.twoFA ? 'enabled' : 'disabled'} onChange={e => setEditForm(f => ({...f, twoFA:e.target.value==='enabled'}))}>
                    <option value="enabled">Activé</option><option value="disabled">Désactivé</option>
                  </select>
                </div>
              </div>
              {editForm.role && (
                <div className="p-3 rounded-xl" style={{ background:`${ROLE_CONFIG[editForm.role].color}10`, border:`1px solid ${ROLE_CONFIG[editForm.role].color}25` }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color:ROLE_CONFIG[editForm.role].color }}>
                    {t('users_permissions')} — {ROLE_LABELS[editForm.role]}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSIONS[editForm.role].map(p => <span key={p} className="badge badge-teal" style={{ fontSize:10 }}>{p}</span>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={() => {
                if (!editForm.name || !editForm.email) { toast.error('Nom et email requis'); return }
                setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editForm } : u))
                setShowEditModal(false)
                toast.success(`${editForm.name} mis à jour`)
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Nom complet</label>
                  <input aria-label="Nom complet" className="input text-sm" placeholder="Prénom Nom" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Rôle</label>
                  <select aria-label="Rôle" className="input text-sm" value={form.role} onChange={e => setForm(f => ({...f, role:e.target.value as Role}))}>
                    {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text3)' }} />
                  <input aria-label="Email" className="input text-sm pl-8" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Mot de passe</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text3)' }} />
                    <input className="input text-sm pl-8 pr-8" type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({...f, password:e.target.value}))} />
                    <button className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }} onClick={() => setShowPwd(!showPwd)} aria-label="Toggle password visibility">
                      {showPwd ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Confirmer</label>
                  <input aria-label="Confirmer" className="input text-sm" type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.confirm} onChange={e => setForm(f => ({...f, confirm:e.target.value}))} />
                </div>
              </div>
              {form.role && (
                <div className="p-3 rounded-xl" style={{ background:`${ROLE_CONFIG[form.role].color}10`, border:`1px solid ${ROLE_CONFIG[form.role].color}25` }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color:ROLE_CONFIG[form.role].color }}>
                    {t('users_permissions')} — {ROLE_LABELS[form.role]}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSIONS[form.role].map(p => <span key={p} className="badge badge-teal" style={{ fontSize:10 }}>{p}</span>)}
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
