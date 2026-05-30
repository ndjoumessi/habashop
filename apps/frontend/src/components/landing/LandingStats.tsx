import { D, MONO } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
}

export default function LandingStats({ lp }: Props) {
  const stats = [
    { v: '16',    l: lp.stat1_l, c: D.p2   },
    { v: '100 %', l: lp.stat2_l, c: D.acc  },
    { v: '6',     l: lp.stat3_l, c: D.acc2 },
    { v: '15+',   l: lp.stat4_l, c: D.acc3 },
  ]
  return (
    <>
      <section style={{ padding: '72px clamp(16px,4vw,80px)', background: `linear-gradient(180deg,${D.bg},${D.bg2})` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {stats.map(s => (
            <div key={s.l} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 20,
              padding: '24px 22px', textAlign: 'center',
              transition: 'all .2s', position: 'relative', overflow: 'hidden', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.borderColor = `${s.c}33`; el.style.boxShadow = `0 16px 40px ${s.c}15` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = D.border; el.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${s.c}26,transparent 70%)`, pointerEvents: 'none' }}/>
              <div style={{ fontSize: 32, fontWeight: 900, color: s.c, fontFamily: MONO, letterSpacing: '-1px', marginBottom: 6, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 13, color: D.text2, fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
