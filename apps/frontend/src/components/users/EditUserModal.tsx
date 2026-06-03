import { useConfig, t } from '@/stores/appStore'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import { X, Mail } from 'lucide-react'
import { ROLE_CONFIG, PERMISSIONS, moduleLabel, buildRoleLabels } from './usersShared'
import type { Role, User } from './usersShared'

interface EditForm { name: string; email: string; role: Role; active: boolean; twoFA: boolean }

interface Props {
  editUser: User
  editForm: EditForm
  setEditForm: (fn: (f: EditForm) => EditForm) => void
  onClose: () => void
  onSave: () => void
}

export default function EditUserModal({ editUser, editForm, setEditForm, onClose, onSave }: Props) {
  const { lang } = useConfig()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const ROLE_LABELS = buildRoleLabels()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:480 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold" style={{ color:'var(--text)' }}>{lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'} — {editUser.name}</h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{lang === 'en' ? 'Update user information' : lang === 'es' ? 'Actualizar la información del usuario' : lang === 'it' ? 'Aggiorna le informazioni dell\'utente' : "Modifier les informations de l'utilisateur"}</p>
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
          </ResponsiveGrid>

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
          <button className="btn btn-ghost" onClick={onClose}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
          <button className="btn btn-primary flex-1 justify-center" onClick={onSave}>
            {lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : lang === 'it' ? 'Salva' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
