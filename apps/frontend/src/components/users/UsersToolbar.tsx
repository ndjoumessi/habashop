import { useConfig } from '@/stores/appStore'
import { Search, Plus } from 'lucide-react'
import { ROLE_CONFIG, buildRoleLabels } from './usersShared'
import type { Role } from './usersShared'

interface Props {
  search: string
  setSearch: (v: string) => void
  roleFilter: Role | ''
  setRoleFilter: (v: Role | '') => void
  isAdmin: boolean
  onInvite: () => void
}

export default function UsersToolbar({ search, setSearch, roleFilter, setRoleFilter, isAdmin, onInvite }: Props) {
  const { lang } = useConfig()
  const ROLE_LABELS = buildRoleLabels()

  return (
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
        <button className="btn btn-primary btn-sm gap-1.5" onClick={onInvite}>
          <Plus size={13} /> {lang === 'en' ? 'Invite user' : lang === 'es' ? 'Invitar a un usuario' : lang === 'it' ? 'Invita un utente' : 'Inviter un utilisateur'}
        </button>
      )}
    </div>
  )
}
