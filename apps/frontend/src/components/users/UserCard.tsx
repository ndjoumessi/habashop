import { useConfig } from '@/stores/appStore'
import { Archive, Trash2 } from 'lucide-react'
import { ROLE_CONFIG, AVATAR_COLORS, initials, isOnlineNow, buildRoleLabels } from './usersShared'
import type { User } from './usersShared'

interface Props {
  user: User
  isAdmin: boolean
  canToggle2FA: boolean
  onToggle2FA: () => void
  onToggleActive: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function UserCard({ user, isAdmin, canToggle2FA, onToggle2FA, onToggleActive, onEdit, onDelete }: Props) {
  const { lang } = useConfig()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const ROLE_LABELS = buildRoleLabels()

  const cfg      = ROLE_CONFIG[user.role]
  const RoleIcon = cfg.Icon
  const online   = isOnlineNow(user)
  const avatarColor = AVATAR_COLORS[user.role]

  return (
    <div style={{
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
          {canToggle2FA ? (
            <button
              type="button"
              onClick={onToggle2FA}
              style={{
                padding:'4px 8px', borderRadius:8, border:'none', cursor:'pointer',
                fontFamily:'var(--font)', fontSize:9, fontWeight:800,
                background: user.twoFA ? 'rgba(16,185,129,.12)' : 'var(--bg3)',
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
              background: user.twoFA ? 'rgba(16,185,129,.12)' : 'var(--bg3)',
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
            background:'var(--bg3)', border:'1px solid var(--border)',
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
            background:'var(--bg3)', border:'1px solid var(--border)',
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
              onClick={onEdit}>
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
              onClick={onToggleActive}>
              {user.active ? (lang === 'en' ? 'Disable' : lang === 'es' ? 'Desactivar' : lang === 'it' ? 'Disattiva' : 'Désactiver') : (lang === 'en' ? 'Enable' : lang === 'es' ? 'Activar' : lang === 'it' ? 'Attiva' : 'Activer')}
            </button>
            <button type="button"
              title={i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}
              aria-label={i('Supprimer', 'Delete', 'Eliminar', 'Elimina') + ' ' + user.name}
              onClick={onDelete}
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
}
