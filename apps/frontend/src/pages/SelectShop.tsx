import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, getLandingForRole } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import { Store, ChevronRight, LogOut, Loader2 } from 'lucide-react'

const PLAN_COLORS: Record<string, string> = {
  starter: 'var(--text3)', pro: 'var(--p2)', enterprise: 'var(--public-gold, #EAB308)',
}

/**
 * Écran de sélection de boutique (multi-boutiques). Affiché après login quand
 * l'user a > 1 boutique et aucune n'est encore active. Le choix déclenche
 * switchTenant (nouveau JWT) puis un rechargement complet vers le dashboard.
 */
export default function SelectShop() {
  const navigate = useNavigate()
  const { i } = useI18n()
  const { tenants, switchTenant, logout, user } = useAuthStore()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  const choose = async (tenantId: string) => {
    setPending(tenantId)
    setError('')
    try {
      await switchTenant(tenantId)
      // Rechargement complet → refetch propre de tous les écrans (pas de TanStack Query).
      window.location.assign(getLandingForRole(user?.role))
    } catch {
      setError(i('Impossible de sélectionner cette boutique. Réessayez.', 'Could not select this shop. Try again.', 'No se pudo seleccionar esta tienda. Inténtalo de nuevo.', 'Impossibile selezionare questo negozio. Riprova.'))
      setPending(null)
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="public-scope" style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 0%, rgba(124,58,237,.16), transparent 55%), linear-gradient(135deg,#0F0A2E 0%,#0A0A0F 58%,#0F0F1A 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 20, boxShadow: '0 8px 24px rgba(124,58,237,.4)' }}>H</div>
        <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--public-text)', letterSpacing: '-.5px' }}>Haba<span className="gold-text">Shop</span></span>
      </div>

      <div style={{ width: '100%', maxWidth: 460 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--public-text)', textAlign: 'center', marginBottom: 6, letterSpacing: '-.3px' }}>
          {i('Choisissez une boutique', 'Choose a shop', 'Elige una tienda', 'Scegli un negozio')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: 24 }}>
          {i('Vous gérez plusieurs boutiques. Sélectionnez celle à ouvrir.', 'You manage several shops. Select the one to open.', 'Gestionas varias tiendas. Selecciona la que deseas abrir.', 'Gestisci più negozi. Seleziona quello da aprire.')}
        </p>

        {error && (
          <div role="alert" style={{ background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#FF3B5C', marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tenants.map(t => {
            const isPending = pending === t.id
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`shop-option-${t.id}`}
                disabled={!!pending}
                onClick={() => choose(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '16px 18px', borderRadius: 16,
                  background: 'linear-gradient(160deg,#0F0F1A,#0A0A0F)',
                  border: '1px solid var(--public-border)',
                  cursor: pending ? 'default' : 'pointer', opacity: pending && !isPending ? 0.5 : 1,
                  fontFamily: 'var(--font)', textAlign: 'left', transition: 'border-color .15s, transform .1s',
                }}
                onMouseEnter={e => { if (!pending) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,.5)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--public-border)' }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(124,58,237,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--public-primary-2, #8B5CF6)' }}>
                  <Store size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--public-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{t.currency}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: PLAN_COLORS[t.plan] ?? 'var(--text3)' }}>{t.plan}</span>
                    <span style={{ fontSize: 10, color: 'var(--text4)' }}>· {t.role}</span>
                  </div>
                </div>
                {isPending
                  ? <Loader2 size={18} style={{ color: 'var(--public-primary-2, #8B5CF6)', animation: 'spin .6s linear infinite', flexShrink: 0 }} />
                  : <ChevronRight size={18} style={{ color: 'var(--text4)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>

        <button type="button" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 22, padding: 10, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          <LogOut size={14} /> {i('Se déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}
        </button>
      </div>
    </div>
  )
}
