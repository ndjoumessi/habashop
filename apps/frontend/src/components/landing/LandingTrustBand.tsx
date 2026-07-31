import { D } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
}

export default function LandingTrustBand({ lp, i }: Props) {
  const trustCountries = [
    { flag: '🇸🇳', name: i('Sénégal', 'Senegal', 'Senegal', 'Senegal') },
    { flag: '🇨🇮', name: i("Côte d'Ivoire", "Côte d'Ivoire", 'Costa de Marfil', "Costa d'Avorio") },
    { flag: '🇨🇲', name: i('Cameroun', 'Cameroon', 'Camerún', 'Camerun') },
    { flag: '🇲🇱', name: i('Mali', 'Mali', 'Malí', 'Mali') },
    { flag: '🇧🇫', name: i('Burkina Faso', 'Burkina Faso', 'Burkina Faso', 'Burkina Faso') },
    { flag: '🇨🇩', name: i('RD Congo', 'DR Congo', 'RD Congo', 'RD Congo') },
    { flag: '🇬🇭', name: i('Ghana', 'Ghana', 'Ghana', 'Ghana') },
    { flag: '🇳🇬', name: i('Nigeria', 'Nigeria', 'Nigeria', 'Nigeria') },
  ]
  return (
    <>
      <section style={{
        padding: '28px clamp(16px,4vw,80px)',
        borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}`,
        background: 'rgba(255,255,255,.02)',
      }}>
        <div style={{ textAlign: 'center', fontSize: 'var(--fs-caption)', fontWeight: 800, letterSpacing: '.8px', color: D.text2, textTransform: 'uppercase', marginBottom: 18 }}>
          {lp.trust_title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,3vw,40px)', flexWrap: 'wrap' }}>
          {trustCountries.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: .85, transition: 'opacity .15s', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '.85'}
            >
              <span style={{ fontSize: 'var(--fs-2xl)' }}>{c.flag}</span>
              <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: D.text2 }}>{c.name}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
