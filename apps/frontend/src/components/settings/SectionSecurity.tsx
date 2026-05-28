import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { authApi } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import { Lock, Unlock, Key, ShieldCheck, AlertTriangle } from 'lucide-react'
import { makeI, panel, Head } from '@/components/settings/settingsShared'

export default function SectionSecurity() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const navigate = useNavigate()
  const locked = cfg.settingsLocked

  const [pwForm, setPwForm]       = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError]     = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async () => {
    setPwError('')
    if (!pwForm.current) { setPwError(i('Mot de passe actuel requis', 'Current password required', 'Contraseña actual requerida', 'Password attuale richiesto')); return }
    if (pwForm.next.length < 8) { setPwError(i('Minimum 8 caractères', 'Minimum 8 characters', 'Mínimo 8 caracteres', 'Minimo 8 caratteri')); return }
    if (pwForm.next !== pwForm.confirm) { setPwError(i('Les mots de passe ne correspondent pas', 'Passwords do not match', 'Las contraseñas no coinciden', 'Le password non corrispondono')); return }
    setPwLoading(true)
    try {
      await authApi.changePassword(pwForm.current, pwForm.next)
      setPwForm({ current: '', next: '', confirm: '' })
      toast.success(i('Mot de passe modifié ✅', 'Password changed ✅', 'Contraseña cambiada ✅', 'Password cambiato ✅'))
    } catch (err: any) {
      setPwError(err?.message ?? i('Erreur lors du changement', 'Error changing password', 'Error al cambiar', 'Errore nel cambio'))
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title: i('Se déconnecter ?', 'Sign out?', '¿Cerrar sesión?', 'Disconnettersi?'),
      message: i(
        'Votre session sera fermée. Vous devrez vous reconnecter.',
        'Your session will be closed. You will need to sign in again.',
        'Tu sesión se cerrará. Deberás iniciar sesión de nuevo.',
        'La sessione verrà chiusa. Dovrai accedere di nuovo.'
      ),
      danger: false,
    })
    if (!ok) return
    localStorage.removeItem('habashop_token')
    cfg.clearTenant?.()
    navigate('/login')
  }

  const token = localStorage.getItem('habashop_token')
  const tokenInfo = token && token.split('.').length === 3 ? (() => {
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      const exp = new Date(p.exp * 1000)
      return {
        role: p.role,
        exp: exp.toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
        daysLeft: Math.ceil((exp.getTime() - Date.now()) / 86400000),
      }
    } catch { return null }
  })() : null

  // État JWT : expiré (< 0) / expire aujourd'hui (= 0) / actif
  const jwtStatus: { color: string; label: string; suggest: string | null } | null = tokenInfo
    ? tokenInfo.daysLeft < 0
      ? {
          color: 'var(--danger)',
          label: i('⚠️ Token expiré', '⚠️ Token expired', '⚠️ Token expirado', '⚠️ Token scaduto'),
          suggest: i('Veuillez vous reconnecter', 'Please sign in again', 'Por favor vuelva a iniciar sesión', 'Effettua nuovamente l\'accesso'),
        }
      : tokenInfo.daysLeft === 0
      ? {
          color: 'var(--warn)',
          label: i("Expire aujourd'hui", 'Expires today', 'Expira hoy', 'Scade oggi'),
          suggest: null,
        }
      : {
          color: tokenInfo.daysLeft > 3 ? 'var(--acc2)' : 'var(--warn)',
          label: `● ${i('Actif', 'Active', 'Activo', 'Attivo')} (${tokenInfo.daysLeft}j)`,
          suggest: null,
        }
    : null

  // Card "block" : wrapper visuel uniforme
  const blockStyle: React.CSSProperties = {
    padding: 16,
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head emoji="🔒" tint="rgba(255,59,92,.04)" title={i('Sécurité & Accès', 'Security & Access', 'Seguridad & Acceso', 'Sicurezza & Accesso')} />
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Lock toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 16,
          background: 'var(--bg3)',
          border: `1px solid ${locked ? 'var(--warn)' : 'var(--border)'}`,
          borderRadius: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: locked ? 'rgba(245,158,11,.12)' : 'rgba(0,208,132,.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {locked
              ? <Lock size={20} color="var(--warn)" />
              : <Unlock size={20} color="var(--acc2)" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: locked ? 'var(--warn)' : 'var(--acc2)' }}>
              {locked ? i('Paramètres verrouillés', 'Settings locked', 'Ajustes bloqueados', 'Impostazioni bloccate') : i('Paramètres déverrouillés', 'Settings unlocked', 'Ajustes desbloqueados', 'Impostazioni sbloccate')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {i('Verrouille langue & devise dans le header', 'Locks language & currency in the header', 'Bloquea idioma y divisa en el encabezado', 'Blocca lingua e valuta nell\'header')}
            </div>
          </div>
          <button type="button"
            onClick={() => locked ? cfg.unlockSettings() : cfg.lockSettings()}
            style={{
              padding: '8px 16px', borderRadius: 10,
              background: locked ? 'rgba(245,158,11,.12)' : 'rgba(0,208,132,.10)',
              border: `1px solid ${locked ? 'var(--warn)' : 'var(--acc2)'}`,
              cursor: 'pointer', fontFamily: 'var(--font)',
              color: locked ? 'var(--warn)' : 'var(--acc2)',
              fontSize: 12, fontWeight: 700, transition: 'all .15s',
            }}>
            {locked ? i('Déverrouiller', 'Unlock', 'Desbloquear', 'Sblocca') : i('Verrouiller', 'Lock', 'Bloquear', 'Blocca')}
          </button>
        </div>

        {/* JWT session */}
        {tokenInfo && jwtStatus && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 16,
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: 'rgba(108,71,255,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Key size={20} color="var(--p)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                JWT · {i('Rôle', 'Role', 'Rol', 'Ruolo')}: {tokenInfo.role}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{i('Expire le', 'Expires on', 'Expira el', 'Scade il')} {tokenInfo.exp}</span>
                <span>·</span>
                <span style={{ color: jwtStatus.color, fontWeight: 600 }}>{jwtStatus.label}</span>
              </div>
              {jwtStatus.suggest && (
                <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4, fontStyle: 'italic' }}>
                  {jwtStatus.suggest}
                </div>
              )}
            </div>
            <button type="button" className="btn btn-ghost"
              style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}
              onClick={handleLogout}>
              {i('Déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}
            </button>
          </div>
        )}

        {/* Change password */}
        <div style={blockStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: 'rgba(255,184,0,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldCheck size={20} color="var(--warn)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {i('Au moins 8 caractères', 'At least 8 characters', 'Al menos 8 caracteres', 'Almeno 8 caratteri')}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input className="input" type="password" autoComplete="current-password"
              aria-label={i('Mot de passe actuel', 'Current password', 'Contraseña actual', 'Password attuale')}
              placeholder={i('Mot de passe actuel', 'Current password', 'Contraseña actual', 'Password attuale')}
              value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
            <input className="input" type="password" autoComplete="new-password"
              aria-label={i('Nouveau mot de passe', 'New password', 'Nueva contraseña', 'Nuova password')}
              placeholder={i('Nouveau mot de passe', 'New password', 'Nueva contraseña', 'Nuova password')}
              value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
            <input className="input" type="password" autoComplete="new-password"
              aria-label={i('Confirmer le mot de passe', 'Confirm password', 'Confirmar contraseña', 'Conferma password')}
              placeholder={i('Confirmer le nouveau mot de passe', 'Confirm new password', 'Confirmar nueva contraseña', 'Conferma nuova password')}
              value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          {pwError && (
            <div style={{ fontSize: 11, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} /> {pwError}
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={pwLoading}
            onClick={handleChangePassword}
            style={{
              alignSelf: 'flex-start', padding: '8px 16px', fontSize: 12,
              cursor: pwLoading ? 'not-allowed' : 'pointer', opacity: pwLoading ? .6 : 1,
            }}>
            {pwLoading ? i('Modification…', 'Changing…', 'Cambiando…', 'Modifica…') : i('Modifier le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}
          </button>
        </div>
      </div>
    </div>
  )
}
