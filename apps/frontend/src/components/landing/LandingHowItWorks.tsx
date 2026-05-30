import { D, MONO } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
}

export default function LandingHowItWorks({ lp }: Props) {
  const steps = [
    { num: '1', title: lp.step1_title, desc: lp.step1_desc },
    { num: '2', title: lp.step2_title, desc: lp.step2_desc },
    { num: '3', title: lp.step3_title, desc: lp.step3_desc },
    { num: '4', title: lp.step4_title, desc: lp.step4_desc },
  ]
  return (
    <>
      <section style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.how_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 0', lineHeight: 1.2 }}>
            {lp.how_title}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24, maxWidth: 1060, margin: '0 auto' }}>
          {steps.map(s => (
            <div key={s.num} style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                background: `linear-gradient(135deg,${D.p},${D.p2})`,
                color: '#fff', fontSize: 22, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO,
                boxShadow: '0 8px 24px rgba(108,71,255,.35)',
              }}>{s.num}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: D.text, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: D.text2, lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
