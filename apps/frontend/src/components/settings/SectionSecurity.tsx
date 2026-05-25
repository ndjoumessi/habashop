import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { makeI, panel, Head } from '@/components/settings/settingsShared'

export default function SectionSecurity() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const navigate = useNavigate()
  const locked = cfg.settingsLocked

  const token = localStorage.getItem('habashop_token')
  const tokenInfo = token && token.split('.').length === 3 ? (() => {
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      const exp = new Date(p.exp * 1000)
      return { role: p.role, exp: exp.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }), daysLeft: Math.ceil((exp.getTime() - Date.now()) / 86400000) }
    } catch { return null }
  })() : null

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head emoji="🔒" tint="rgba(255,59,92,.04)" title={i('Sécurité & Accès', 'Security & Access', 'Seguridad & Acceso', 'Sicurezza & Accesso')} />
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Lock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: locked ? 'rgba(255,59,92,.08)' : 'rgba(0,208,132,.05)', border: `1px solid ${locked ? 'rgba(255,59,92,.2)' : 'rgba(0,208,132,.15)'}`, borderRadius: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: locked ? 'rgba(255,59,92,.15)' : 'rgba(0,208,132,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{locked ? '🔒' : '🔓'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: locked ? 'var(--danger)' : 'var(--acc2)' }}>{locked ? i('Paramètres verrouillés', 'Settings locked', 'Ajustes bloqueados', 'Impostazioni bloccate') : i('Paramètres déverrouillés', 'Settings unlocked', 'Ajustes desbloqueados', 'Impostazioni sbloccate')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Verrouille langue & devise dans le header', 'Locks language & currency in the header', 'Bloquea idioma y divisa en el encabezado', 'Blocca lingua e valuta nell\'header')}</div>
          </div>
          <button type="button" onClick={() => locked ? cfg.unlockSettings() : cfg.lockSettings()}
            style={{ padding: '8px 16px', borderRadius: 10, background: locked ? 'rgba(255,59,92,.15)' : 'rgba(0,208,132,.1)', border: `1px solid ${locked ? 'rgba(255,59,92,.3)' : 'rgba(0,208,132,.25)'}`, cursor: 'pointer', fontFamily: 'var(--font)', color: locked ? 'var(--danger)' : 'var(--acc2)', fontSize: 12, fontWeight: 700, transition: 'all .15s' }}>
            {locked ? i('Déverrouiller', 'Unlock', 'Desbloquear', 'Sblocca') : i('Verrouiller', 'Lock', 'Bloquear', 'Blocca')}
          </button>
        </div>

        {/* JWT session */}
        {tokenInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(108,71,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>JWT · {i('Rôle', 'Role', 'Rol', 'Ruolo')}: {tokenInfo.role}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{i('Expire le', 'Expires on', 'Expira el', 'Scade il')} {tokenInfo.exp}</span><span>·</span>
                <span style={{ color: tokenInfo.daysLeft > 3 ? 'var(--acc2)' : 'var(--danger)' }}>● {i('Actif', 'Active', 'Activo', 'Attivo')} ({tokenInfo.daysLeft}j)</span>
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}
              onClick={() => { localStorage.removeItem('habashop_token'); cfg.clearTenant?.(); navigate('/login') }}>
              {i('Déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}
            </button>
          </div>
        )}

        {/* Change password (stub) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,184,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Bientôt disponible', 'Coming soon', 'Próximamente', 'Prossimamente')}</div>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer' }} onClick={() => toast(i('Bientôt disponible', 'Coming soon', 'Próximamente', 'Prossimamente'))}>✏️ {i('Modifier', 'Change', 'Cambiar', 'Modifica')}</button>
        </div>
      </div>
    </div>
  )
}
