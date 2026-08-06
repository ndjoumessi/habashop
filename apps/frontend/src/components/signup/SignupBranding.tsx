import { Check, Clock, CreditCard } from 'lucide-react'
import LogoMark from '@/components/ui/LogoMark'
import type { ST } from './signupShared'

interface Props {
  tx: ST
  navigate: (to: string) => void
}

/**
 * Panneau gauche de /signup — RÉÉCRIT le 2026-08-06.
 *
 * ⚠️ L'ancien panneau était intégralement bâti sur des affirmations fausses : « 500+ »
 * boutiques actives, « 12 » pays, « 150+ pays, 6 devises », « Données sécurisées SSL/TLS »,
 * « Support WhatsApp inclus », et un QUATRIÈME témoignage fabriqué — « Aminata Koné ·
 * Superette Dakar », cinq étoiles et citation. Les retirer ne laissait rien : ce n'est
 * donc pas un rustinage mais un contenu à écrire.
 *
 * Ce qu'une personne en train de taper ses coordonnées veut savoir, et qui est ici :
 *   1. ce qui se passe dans les deux minutes qui suivent ;
 *   2. ce que contiennent les 14 jours ;
 *   3. comment on paie ensuite.
 *
 * ⚠️ La mention « le paiement en ligne n'est pas actif » N'EST PAS ici mais dans la
 * colonne du formulaire : ce panneau est `display:none` sous 880 px, donc l'y placer
 * l'aurait fait disparaître sur mobile — c'est-à-dire là où la majorité des commerçants
 * ouvrent la page.
 *
 * ⚠️ UN SEUL ACCENT. Le panneau opposait « HabaShop » en or et « Votre boutique » en or
 * sur un fond violet : deux accents concurrents, le défaut déjà corrigé sur la grille
 * tarifaire. Tout est en `var(--p…)`, comme la vitrine et la page de connexion.
 *
 * ⚠️ « Support WhatsApp inclus » est retiré, pas reformulé : mesuré le 2026-08-06, il
 * n'existe AUCUN canal WhatsApp entrant. `services/whatsappSend.ts` est SORTANT (reçus,
 * alertes de stock). Le seul support réel est support@habashop.com.
 */
export default function SignupBranding({ tx, navigate }: Props) {
  const step = (Icon: typeof Clock, title: string, body: string) => (
    <li key={title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: 'color-mix(in srgb,var(--p) 15%,transparent)',
        border: '1px solid color-mix(in srgb,var(--p2) 32%,transparent)',
        color: 'var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text2)', lineHeight: 1.55 }}>{body}</span>
      </span>
    </li>
  )

  return (
    <aside className="su-left" style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 'clamp(32px,4vw,56px)',
      background: 'linear-gradient(158deg,var(--bg) 0%,var(--bg2) 58%,var(--bg) 100%)',
      borderRight: '1px solid var(--border)',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(color-mix(in srgb,var(--p) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--p) 7%,transparent) 1px,transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse 85% 75% at 40% 45%,black 25%,transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 40% 45%,black 25%,transparent 100%)',
      }}/>
      <div aria-hidden="true" style={{ position: 'absolute', top: '-6%', left: '-4%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--p) 20%,transparent),transparent 70%)', filter: 'blur(56px)', pointerEvents: 'none' }}/>

      {/* Colonne bornée, alignée à gauche — même construction que la page de connexion,
          pour que les deux portes d'entrée publiques se répondent au lieu de diverger. */}
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, marginRight: 'auto',
        display: 'flex', flexDirection: 'column', gap: 26,
      }}>
        <button type="button" onClick={() => navigate('/')}
          aria-label="HabaShop"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 11, width: 'fit-content',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', display: 'flex', flexShrink: 0, boxShadow: 'var(--sh-p, 0 8px 26px rgba(108,71,255,.35))' }}>
            <LogoMark />
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--text)' }}>HabaShop</span>
        </button>

        <div>
          <h1 style={{
            fontSize: 'clamp(24px,2.5vw,31px)', lineHeight: 1.16, letterSpacing: '-.028em',
            fontWeight: 700, color: 'var(--text)', margin: 0, maxWidth: '17ch',
          }}>
            {tx.brand_title}
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', margin: '10px 0 0', maxWidth: '42ch' }}>
            {tx.brand_sub}
          </p>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step(Clock, tx.after_title, tx.after_body)}
          {step(Check, tx.trial_title, tx.trial_body)}
          {step(CreditCard, tx.pay_title, tx.pay_body)}
        </ul>

      </div>
    </aside>
  )
}
