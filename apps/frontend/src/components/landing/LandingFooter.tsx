import { Shield } from 'lucide-react'
import LogoMark from '@/components/ui/LogoMark'
import { D } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
}

export default function LandingFooter({ lp }: Props) {

  return (
    <>
      <footer style={{
        padding: '40px clamp(16px,4vw,80px) 28px',
        borderTop: '1px solid transparent',
        borderImage: `linear-gradient(90deg,${D.p},transparent 50%,${D.p}) 1`,
        background: D.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              overflow: 'hidden', display: 'flex',
            }}>
              <LogoMark />
            </div>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: D.text }}>HabaShop</span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {lp.footer_links.map(link => (
              <a key={link} href="#" style={{
                fontSize: 'var(--fs-label)', color: D.text2, textDecoration: 'none',
                transition: 'color .15s', cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = D.text2}
              >{link}</a>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 'var(--fs-caption)', color: D.text4, paddingTop: 18, borderTop: `1px solid ${D.border}`, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}>
          {lp.footer}<Shield size={11}/>
        </div>
      </footer>

      <style>{`
        @keyframes lp-float {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-20px) }
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50%      { opacity: .5; transform: scale(.8) }
        }
        @media (max-width: 880px) {
          .lp-nav-desktop { display: none !important }
        }
        @media (max-width: 640px) {
          .lp-selectors { display: none !important }
        }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important }
        }
      `}</style>
    </>
  )
}
