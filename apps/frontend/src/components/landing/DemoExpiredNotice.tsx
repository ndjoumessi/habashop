import { FlaskConical } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

/**
 * Message d'accueil d'un visiteur dont la démonstration a expiré.
 *
 * ⚠️ POURQUOI CE COMPOSANT EXISTE. L'intercepteur 401 renvoie vers `/?demo=expiree` quand la
 * session courante était une démo. Ce paramètre n'était lu NULLE PART : comme la redirection
 * est un `window.location.href`, la page est entièrement rechargée et l'erreur levée juste
 * après est perdue avec le contexte JS. Le visiteur atterrissait sur la page marketing, son
 * travail disparu, sans une ligne d'explication.
 *
 * ⚠️ Le message DIT QUOI FAIRE. Un message qui constate sans orienter laisse le visiteur
 * exactement où il était.
 */
interface Props {
  /**
   * Chaîne de requête. ⚠️ PARAMÈTRE INJECTABLE, et pas `useSearchParams` : aucun composant
   * de la vitrine n'utilise de hook de routeur — ils reçoivent leurs actions en props, et
   * `landing.anchor.test.tsx` rend `<LandingPage />` SANS Router. Un hook ici faisait
   * échouer les sept tests d'ancrage de la vitrine.
   */
  recherche?: string
}

export default function DemoExpiredNotice({ recherche }: Props) {
  const { i } = useI18n()
  const params = new URLSearchParams(recherche ?? (typeof window === 'undefined' ? '' : window.location.search))

  // Valeur EXACTE seulement : un paramètre inattendu n'affiche rien.
  if (params.get('demo') !== 'expiree') return null

  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px clamp(16px,4vw,60px)', marginTop: 64,
      fontSize: 'var(--fs-sm)', fontWeight: 600,
      background: 'var(--c-amber-bg)', borderBottom: '1px solid var(--c-amber-border)',
      color: 'var(--text)',
    }}>
      <FlaskConical size={15} strokeWidth={2.3} aria-hidden="true" />
      <span>
        {i(
          'Votre démonstration a expiré — les démonstrations durent sept jours. Vous pouvez en ouvrir une nouvelle, ou créer votre boutique pour garder vos données.',
          'Your demo has expired — demos last seven days. You can open a new one, or create your shop to keep your data.',
          'Su demostración ha caducado: las demostraciones duran siete días. Puede abrir una nueva o crear su tienda para conservar sus datos.',
          'La tua dimostrazione è scaduta — le dimostrazioni durano sette giorni. Puoi aprirne una nuova, oppure creare il tuo negozio per conservare i dati.',
        )}
      </span>
    </div>
  )
}
