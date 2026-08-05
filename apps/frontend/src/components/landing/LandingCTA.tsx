import { ArrowRight } from 'lucide-react'
import { D, FONT } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  navigate: (to: string) => void
}

export default function LandingCTA({ lp, navigate }: Props) {
  return (
    <section style={{
      padding: '84px clamp(16px,4vw,64px)',
      background: `linear-gradient(160deg,${D.bg},${D.bg2})`,
      position: 'relative', overflow: 'hidden', textAlign: 'center',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(108,71,255,.18),transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }}/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 'clamp(26px,3.6vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1.2px', margin: '0 0 12px', lineHeight: 1.12 }}>
          {lp.cta_title}
        </h2>
        <p style={{ fontSize: 'var(--fs-title)', color: D.text2, maxWidth: 480, margin: '0 auto 28px' }}>
          {lp.cta_sub}
        </p>
        <button type="button" onClick={() => navigate('/signup')}
          style={{
            padding: '16px 34px', borderRadius: 14,
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
          {lp.cta_btn}<ArrowRight size={17} strokeWidth={2.6}/>
        </button>
        <div style={{ marginTop: 16, fontSize: 'var(--fs-label)', color: D.text3 }}>
          {lp.cta_foot}
        </div>
      </div>
    </section>
  )
}
