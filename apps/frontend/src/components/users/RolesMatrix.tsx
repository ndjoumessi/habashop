import { useState } from 'react'
import { useConfig, t } from '@/stores/appStore'
import { Shield } from 'lucide-react'
import { ROLE_CONFIG, PERMISSIONS, moduleLabel, roleDesc, buildRoleLabels } from './usersShared'
import type { Role } from './usersShared'

interface Props {
  users: { role: Role }[]
}

export default function RolesMatrix({ users }: Props) {
  const { lang } = useConfig()
  const [showPerms, setShowPerms] = useState<Role | null>(null)
  const ROLE_LABELS = buildRoleLabels()

  return (
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
  )
}
