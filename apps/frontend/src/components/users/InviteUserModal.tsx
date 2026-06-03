import { useConfig, t } from '@/stores/appStore'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import { X, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { ROLE_CONFIG, PERMISSIONS, moduleLabel, buildRoleLabels } from './usersShared'
import type { Role } from './usersShared'

interface InviteForm { name: string; email: string; role: Role; password: string; confirm: string }

interface Props {
  form: InviteForm
  setForm: (fn: (f: InviteForm) => InviteForm) => void
  showPwd: boolean
  setShowPwd: (v: boolean) => void
  onClose: () => void
  onInvite: () => void
}

export default function InviteUserModal({ form, setForm, showPwd, setShowPwd, onClose, onInvite }: Props) {
  const { lang } = useConfig()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const ROLE_LABELS = buildRoleLabels()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold" style={{ color:'var(--text)' }}>{lang === 'en' ? 'Invite a user' : lang === 'es' ? 'Invitar a un usuario' : lang === 'it' ? 'Invita un utente' : 'Inviter un utilisateur'}</h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{lang === 'en' ? 'A welcome email will be sent' : lang === 'es' ? 'Se enviará un email de bienvenida' : lang === 'it' ? 'Verrà inviata un\'email di benvenuto' : 'Un email de bienvenue sera envoyé'}</p>
          </div>
          <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={14} />} onClick={onClose} variant="surface" />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Ligne 1 : Nom complet + Rôle */}
          <ResponsiveGrid min={160} gap={12}>
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
          </ResponsiveGrid>

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
          <ResponsiveGrid min={160} gap={12}>
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
          </ResponsiveGrid>

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
          <button className="btn btn-primary flex-1 justify-center" onClick={onInvite}>
            {lang === 'en' ? 'Send invitation' : lang === 'es' ? 'Enviar la invitación' : lang === 'it' ? 'Invia l\'invito' : "Envoyer l'invitation"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
        </div>
      </div>
    </div>
  )
}
