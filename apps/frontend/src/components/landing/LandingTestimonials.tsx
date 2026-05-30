import { Star } from 'lucide-react'
import { D } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
}

export default function LandingTestimonials({ lp }: Props) {
  const testimonials = [
    { name: lp.test1_name, role: lp.test1_role, avatar: 'MD', color: '#6C47FF', fg: '#fff', quote: lp.test1_quote },
    { name: lp.test2_name, role: lp.test2_role, avatar: 'FK', color: '#FF9500', fg: '#1A1A2E', quote: lp.test2_quote },
    { name: lp.test3_name, role: lp.test3_role, avatar: 'IT', color: '#00D084', fg: '#1A1A2E', quote: lp.test3_quote },
  ]
  return (
    <>
      <section style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.testimonials_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 0', lineHeight: 1.2 }}>
            {lp.testimonials_title}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16, maxWidth: 1060, margin: '0 auto' }}>
          {testimonials.map(t => (
            <div key={t.name} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 20, padding: 26,
              transition: 'all .2s', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.borderColor = `${t.color}33`; el.style.boxShadow = `0 16px 40px ${t.color}15` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = D.border; el.style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
                {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={D.acc3} color={D.acc3}/>)}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: D.text, marginBottom: 18, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: t.fg, flexShrink: 0, boxShadow: `0 4px 14px ${t.color}55` }}>
                  {t.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: D.text }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: D.text3 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
