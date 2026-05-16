import { useState } from 'react'
import { useConfig, t } from '@/stores/appStore'
import { Search, Plus, Shield, X, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR'

interface User {
  id: string; name: string; email: string; role: Role
  active: boolean; twoFA: boolean; lastLogin: string; createdAt: string
}

const ROLE_CONFIG: Record<Role, { label: string; cls: string; desc: string }> = {
  ADMIN:      { label: 'Administrateur', cls: 'badge-red',    desc: 'Accès total à tous les modules' },
  MANAGER:    { label: 'Gérant',         cls: 'badge-violet', desc: 'Tous modules sauf utilisateurs' },
  CASHIER:    { label: 'Caissier',       cls: 'badge-teal',   desc: 'POS uniquement' },
  ACCOUNTANT: { label: 'Comptable',      cls: 'badge-amber',  desc: 'Ventes, dépenses, rapports' },
  HR:         { label: 'RH',             cls: 'badge-blue',   desc: 'RH, planning, paie' },
}

const USERS_INIT: User[] = [
  { id:'1', name:'Nelson Djoumessi', email:'admin@habashop.com',    role:'ADMIN',      active:true,  twoFA:true,  lastLogin:'Aujourd\'hui 14:02', createdAt:'2026-01-01' },
  { id:'2', name:'Marie Koné',        email:'marie@habashop.com',    role:'MANAGER',    active:true,  twoFA:true,  lastLogin:'Aujourd\'hui 09:15', createdAt:'2026-01-15' },
  { id:'3', name:'Oumar Diallo',      email:'oumar@habashop.com',    role:'CASHIER',    active:true,  twoFA:false, lastLogin:'Hier 18:45',         createdAt:'2026-02-01' },
  { id:'4', name:'Fatou Ndiaye',      email:'fatou@habashop.com',    role:'CASHIER',    active:true,  twoFA:false, lastLogin:'Aujourd\'hui 11:30', createdAt:'2026-02-10' },
  { id:'5', name:'Ibrahima Sow',      email:'ibrahima@habashop.com', role:'ACCOUNTANT', active:true,  twoFA:true,  lastLogin:'Il y a 2 jours',     createdAt:'2026-03-01' },
  { id:'6', name:'Aminata Traoré',    email:'aminata@habashop.com',  role:'HR',         active:false, twoFA:false, lastLogin:'Il y a 1 semaine',   createdAt:'2026-03-15' },
]

const PERMISSIONS: Record<Role, string[]> = {
  ADMIN:      ['Dashboard','POS','Stock','Commandes','Fournisseurs','Clients','Rapports','RH','Planning','Paie','Dépenses','Prévisions','Utilisateurs','Activité','Paramètres'],
  MANAGER:    ['Dashboard','POS','Stock','Commandes','Fournisseurs','Clients','Rapports','RH','Planning','Dépenses','Prévisions'],
  CASHIER:    ['POS','Stock (lecture)'],
  ACCOUNTANT: ['Dashboard','Rapports','Dépenses','Commandes (lecture)'],
  HR:         ['RH','Planning','Paie'],
}

export default function Users() {
  const { lang } = useConfig()
  void lang
  const [users, setUsers] = useState<User[]>(USERS_INIT)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [showPerms, setShowPerms] = useState<Role | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'CASHIER' as Role, password: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [editUser,      setEditUser]      = useState<User | null>(null)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editUserForm,  setEditUserForm]  = useState({ name: '', email: '', role: 'CASHIER' as Role, active: true, twoFA: false })

  const filtered = users.filter(u =>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  )

  const toggleActive = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))
    const u = users.find(u => u.id === id)
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
      id: String(Date.now()), name: form.name, email: form.email, role: form.role,
      active: true, twoFA: false, lastLogin: 'Jamais', createdAt: new Date().toISOString().split('T')[0]
    }
    setUsers(prev => [...prev, newUser])
    setShowModal(false)
    setForm({ name: '', email: '', role: 'CASHIER', password: '', confirm: '' })
    toast.success(`✅ ${form.name} invité(e) — email envoyé`)
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
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('users_total'),    value: stats.total,   color: 'var(--p2)',     icon: '👥' },
          { label: t('users_active'),   value: stats.active,  color: 'var(--acc2)',   icon: '✅' },
          { label: t('users_2fa_enabled'), value: stats.with2FA, color: 'var(--p3)',   icon: '🔐' },
          { label: t('users_admins'),   value: stats.admins,  color: 'var(--danger)', icon: '🛡️' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Matrice des rôles */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">🛡️ Matrice des rôles & permissions</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPerms(showPerms ? null : 'ADMIN')}>
            {showPerms ? 'Masquer' : 'Voir détails'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_CONFIG) as Role[]).map(role => {
            const cfg = ROLE_CONFIG[role]
            return (
              <div key={role}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  background: showPerms === role ? 'rgba(99,102,241,0.1)' : 'var(--bg3)',
                  border: `1px solid ${showPerms === role ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                  minWidth: 180,
                }}
                onClick={() => setShowPerms(showPerms === role ? null : role)}
              >
                <Shield size={16} style={{ color: 'var(--p2)', flexShrink: 0 }} />
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>{ROLE_LABELS[role]}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>{cfg.desc}</div>
                </div>
                <span className={`badge ${cfg.cls} ml-auto`}>{users.filter(u => u.role === role).length}</span>
              </div>
            )
          })}
        </div>
        {showPerms && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--bg3)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>
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

      {/* Table utilisateurs */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">👥 Gestion des utilisateurs</span>
          <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Inviter un utilisateur
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Nom, email…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
            <option value="">Tous les rôles</option>
            {(Object.keys(ROLE_CONFIG) as Role[]).map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('col_name')}</th><th>{t('col_role')}</th><th>{t('col_last_login')}</th>
                <th>{t('col_2fa')}</th><th>{t('col_status')}</th><th>{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const cfg = ROLE_CONFIG[u.role]
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar w-8 h-8 text-xs flex-shrink-0">{u.name.charAt(0)}</div>
                        <div>
                          <div className="td-bold text-sm">{u.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text3)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${cfg.cls}`}>{cfg.label}</span></td>
                    <td className="text-xs" style={{ color: 'var(--text2)' }}>{u.lastLogin}</td>
                    <td>
                      <button
                        className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: u.twoFA ? 'rgba(20,184,166,0.12)' : 'var(--bg3)',
                          color: u.twoFA ? 'var(--p3)' : 'var(--text3)',
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit'
                        }}
                        onClick={() => toggle2FA(u.id)}
                      >
                        {u.twoFA ? `🔐 ${t('status_active')}` : `🔓 ${t('status_inactive')}`}
                      </button>
                    </td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-green' : 'badge-gray'}`}>
                        {u.active ? t('status_active') : t('status_inactive')}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn btn-sm btn-ghost" onClick={() => {
                          setEditUser(u)
                          setEditUserForm({ name:u.name, email:u.email, role:u.role, active:u.active, twoFA:u.twoFA })
                          setShowEditUserModal(true)
                        }}>✏️</button>
                        <button
                          className="btn btn-sm"
                          style={{
                            background: u.active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                            color: u.active ? 'var(--danger)' : 'var(--acc2)',
                            border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px',
                            fontSize: 11, fontFamily: 'inherit'
                          }}
                          onClick={() => toggleActive(u.id)}
                        >
                          {u.active ? '🚫 Désactiver' : '✅ Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal modifier utilisateur */}
      {showEditUserModal && editUser && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditUserModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>✏️ Modifier — {editUser.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Modifier les informations de l'utilisateur</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditUserModal(false)}><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Nom complet</label>
                  <input className="input text-sm" value={editUserForm.name}
                    onChange={e => setEditUserForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Rôle</label>
                  <select className="input text-sm" value={editUserForm.role}
                    onChange={e => setEditUserForm(f => ({...f, role:e.target.value as Role}))}>
                    {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
                  <input className="input text-sm pl-8" type="email" value={editUserForm.email}
                    onChange={e => setEditUserForm(f => ({...f, email:e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Statut</label>
                  <select className="input text-sm" value={editUserForm.active ? 'active' : 'inactive'}
                    onChange={e => setEditUserForm(f => ({...f, active:e.target.value==='active'}))}>
                    <option value="active">Actif</option><option value="inactive">Inactif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>2FA</label>
                  <select className="input text-sm" value={editUserForm.twoFA ? 'enabled' : 'disabled'}
                    onChange={e => setEditUserForm(f => ({...f, twoFA:e.target.value==='enabled'}))}>
                    <option value="enabled">Activé</option><option value="disabled">Désactivé</option>
                  </select>
                </div>
              </div>
              {editUserForm.role && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--p2)' }}>
                    🛡️ Accès — {ROLE_CONFIG[editUserForm.role].label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSIONS[editUserForm.role].map(p => (
                      <span key={p} className="badge badge-teal" style={{ fontSize: 10 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => setShowEditUserModal(false)}>Annuler</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={() => {
                if (!editUserForm.name || !editUserForm.email) { toast.error('Nom et email requis'); return }
                setUsers(prev => prev.map(u =>
                  u.id === editUser.id ? { ...u, ...editUserForm } : u
                ))
                setShowEditUserModal(false)
                toast.success(`✅ ${editUserForm.name} mis à jour`)
              }}>✅ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal invitation */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>✉️ Inviter un utilisateur</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Un email de bienvenue sera envoyé</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Nom complet</label>
                  <input className="input text-sm" placeholder="Prénom Nom" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Rôle</label>
                  <select className="input text-sm" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                    {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Email</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
                  <input className="input text-sm pl-8" type="email" placeholder="email@example.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Mot de passe</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
                    <input className="input text-sm pl-8 pr-8" type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
                      onClick={() => setShowPwd(!showPwd)}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Confirmer</label>
                  <input className="input text-sm" type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••" value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
                </div>
              </div>

              {/* Aperçu permissions */}
              {form.role && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--p2)' }}>
                    🛡️ Accès — {ROLE_CONFIG[form.role].label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSIONS[form.role].map(p => (
                      <span key={p} className="badge badge-teal" style={{ fontSize: 10 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={invite}>
                ✉️ Envoyer l'invitation
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
