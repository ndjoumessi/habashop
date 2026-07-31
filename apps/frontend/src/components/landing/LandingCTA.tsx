import { Check, Zap } from 'lucide-react'
import { D, FONT } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
}

export default function LandingCTA({ lp, i, navigate }: Props) {

  return (
    <>
      <section style={{
        padding: '100px clamp(16px,4vw,80px)',
        background: `linear-gradient(160deg,${D.bg},${D.bg2})`,
        position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 540, height: 540, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(108,71,255,.18),transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, color: D.text, letterSpacing: '-1.5px', marginBottom: 14, lineHeight: 1.1 }}>
            {lp.cta_title}
          </h2>
          <p style={{ fontSize: 'var(--fs-md)', color: D.text2, marginBottom: 32, maxWidth: 460, margin: '0 auto 32px' }}>
            {lp.cta_sub}
          </p>
          <button type="button" onClick={() => navigate('/signup')}
            style={{
              padding: '17px 38px', borderRadius: 14,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              border: 'none', color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 800,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: '0 12px 40px rgba(108,71,255,.5)',
              transition: 'all .2s',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 16px 50px rgba(108,71,255,.65)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 12px 40px rgba(108,71,255,.5)' }}
          >
            <Zap size={18} strokeWidth={2.6}/>{lp.cta_btn}
          </button>
          <div style={{ marginTop: 18, fontSize: 'var(--fs-label)', color: D.text3, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={12} color={D.acc}/>{i('14 jours gratuits', '14 days free', '14 días gratis', '14 giorni gratis')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={12} color={D.acc}/>{i('Sans carte bancaire', 'No credit card', 'Sin tarjeta bancaria', 'Senza carta di credito')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={12} color={D.acc}/>{i('Annulation facile', 'Easy cancellation', 'Cancelación fácil', 'Cancellazione facile')}</span>
          </div>
        </div>
      </section>
    </>
  )
}
