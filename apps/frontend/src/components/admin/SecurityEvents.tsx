import { useEffect, useState } from 'react'
import { ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'

interface SecurityEvent {
  id: string
  userId: string
  userEmailSnapshot: string
  userNameSnapshot: string
  action: string
  description: string
  ip?: string | null
  severity: string
  createdAt: string
}

// Libellés d'actions — valeur serveur = clé (motif `xxxLabel` du repo).
const ACTION_LABELS: Record<string, Record<string, string>> = {
  PASSWORD_CHANGE: { fr: 'Mot de passe modifié', en: 'Password changed', es: 'Contraseña modificada', it: 'Password modificata' },
}
function actionLabel(action: string, lang: string): string {
  return ACTION_LABELS[action]?.[lang] ?? action
}

/**
 * Événements de sécurité d'échelle UTILISATEUR (hors boutique) — supervision plateforme.
 *
 * ⚠️ Trois états DISTINCTS, jamais confondus (règle « états vides explicites » de la
 * console) : chargement · erreur · vide réel. Une liste vide affichée sur erreur
 * affirmerait qu'il ne s'est rien passé — c'est exactement le mensonge que cette
 * surface existe pour supprimer.
 */
export default function SecurityEvents() {
  const { i, lang } = useI18n()
  const [events, setEvents] = useState<SecurityEvent[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true); setFailed(false)
    try {
      setEvents(await adminApi.securityEvents(100))
    } catch {
      setEvents(null); setFailed(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={15} />
          {i('Événements de sécurité', 'Security events', 'Eventos de seguridad', 'Eventi di sicurezza')}
        </span>
        <button
          className="icon-btn"
          onClick={load}
          disabled={loading}
          aria-label={i('Rafraîchir', 'Refresh', 'Actualizar', 'Aggiorna')}
          style={{ cursor: loading ? 'default' : 'pointer' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <p style={{ color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
            {i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}
          </p>
        ) : failed ? (
          // ── ÉCHEC : dit qu'on ne sait pas. Ne JAMAIS rendre une liste vide ici. ──
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 'var(--r-md)', background: 'color-mix(in srgb, var(--warn) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 'var(--fs-sm)' }}>
              <div style={{ fontWeight: 'var(--fw-semibold)' }}>
                {i('Lecture impossible', 'Cannot read', 'Lectura imposible', 'Lettura impossibile')}
              </div>
              <div style={{ color: 'var(--text3)', marginTop: 2 }}>
                {i(
                  'Les événements n’ont pas pu être chargés — cet écran ne dit PAS qu’il n’y en a aucun.',
                  'Events could not be loaded — this screen does NOT say there are none.',
                  'No se pudieron cargar los eventos — esta pantalla NO dice que no haya ninguno.',
                  'Impossibile caricare gli eventi — questa schermata NON dice che non ce ne sono.',
                )}
              </div>
            </div>
          </div>
        ) : (events?.length ?? 0) === 0 ? (
          // ── VIDE RÉEL : état de succès nommé, la section ne disparaît jamais. ──
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-sm)', color: 'var(--text3)' }}>
            <ShieldCheck size={16} style={{ color: 'var(--acc2)', flexShrink: 0 }} />
            {i(
              'Aucun événement de sécurité enregistré.',
              'No security events recorded.',
              'Ningún evento de seguridad registrado.',
              'Nessun evento di sicurezza registrato.',
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events!.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>{actionLabel(e.action, lang)}</div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.userNameSnapshot} · {e.userEmailSnapshot}
                  </div>
                </div>
                <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {new Date(e.createdAt).toLocaleString(lang)}
                  {e.ip ? <div style={{ fontFamily: 'var(--font-mono)' }}>{e.ip}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
