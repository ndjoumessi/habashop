import { D } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
}

export default function LandingFAQ({ lp }: Props) {
  const faqs = [
    { q: lp.faq1_q, a: lp.faq1_a },
    { q: lp.faq2_q, a: lp.faq2_a },
    { q: lp.faq3_q, a: lp.faq3_a },
    { q: lp.faq4_q, a: lp.faq4_a },
    { q: lp.faq5_q, a: lp.faq5_a },
  ]
  return (
    <>
      <section id="section-faq" style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg2, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 'var(--fs-caption)', fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.faq_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 0', lineHeight: 1.2 }}>
            {lp.faq_title}
          </h2>
        </div>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faqs.map((f, i) => (
            <details key={i} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 14, overflow: 'hidden',
            }}>
              <summary style={{
                padding: '18px 22px', fontSize: 14.5, fontWeight: 700,
                color: D.text, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                userSelect: 'none', listStyle: 'none',
              }}>
                {f.q}
                <span style={{ fontSize: 'var(--fs-lg)', color: D.p3, flexShrink: 0, marginLeft: 12 }}>+</span>
              </summary>
              <div style={{ padding: '0 22px 18px', fontSize: 'var(--fs-body)', color: D.text2, lineHeight: 1.75 }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>
    </>
  )
}
