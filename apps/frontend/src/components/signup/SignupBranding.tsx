import { ShoppingCart, Check, Shield, MessageSquare, Globe } from 'lucide-react'
import { D, FONT } from './signupShared'
import type { ST } from './signupShared'

interface Props {
  tx: ST
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
}

export default function SignupBranding({ tx, i, navigate }: Props) {
  return (
      <div className="su-left" style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg,#0F0A2E 0%,#0A0A0F 60%,#0A0A0F 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '56px 48px',
      }}>
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(124,58,237,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,.07) 1px,transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
        }}/>
        {/* Violet glow top-left */}
        <div className="public-glow-violet" style={{ position: 'absolute', top: '-10%', left: '-10%', width: 480, height: 480, pointerEvents: 'none' }}/>
        {/* Gold orb bottom */}
        <div style={{ position: 'absolute', bottom: '12%', right: '12%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(234,179,8,.12),transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', animation: 'su-float 9s ease-in-out infinite reverse' }}/>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 400 }}>
          {/* Logo */}
          <button type="button" onClick={() => navigate('/')}
            aria-label={i('Accueil HabaShop', 'HabaShop home', 'Inicio HabaShop', 'Home HabaShop')}
            style={{
              width: 64, height: 64, borderRadius: 20,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', color: '#fff', cursor: 'pointer', border: 'none',
              boxShadow: '0 16px 48px rgba(124,58,237,.5)',
              transition: 'transform .2s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
          >
            <ShoppingCart size={30} strokeWidth={2.4}/>
          </button>

          <h1 style={{ fontSize: 30, fontWeight: 900, color: D.text, letterSpacing: '-1px', marginBottom: 10, lineHeight: 1.1 }}>
            {tx.brand_title.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="gold-text">HabaShop</span>
          </h1>
          <p style={{ fontSize: 'var(--fs-body)', color: D.text2, lineHeight: 1.7, marginBottom: 28 }}>
            {tx.brand_sub}
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 30 }}>
            {[
              { value: '500+', label: tx.stat_shops },
              { value: '12',   label: tx.stat_countries },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, marginBottom: 6 }} className="gold-text">{s.value}</div>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: D.text2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 30 }}>
            {[
              { Icon: Check,         label: tx.adv_free      },
              { Icon: Shield,        label: tx.adv_secure    },
              { Icon: MessageSquare, label: tx.adv_whatsapp  },
              { Icon: Globe,         label: tx.adv_countries },
            ].map(a => (
              <div key={a.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left',
              }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(124,58,237,.16)',
                  border: `1px solid ${D.border2}`,
                  color: D.p3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <a.Icon size={15} strokeWidth={2.4}/>
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: D.text }}>{a.label}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{
            textAlign: 'left',
            padding: '18px 20px',
            background: 'var(--grad-card)',
            border: '1px solid var(--public-border-gold)',
            borderRadius: 16,
          }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 10, color: D.gold }}>
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} style={{ fontSize: 'var(--fs-body)', lineHeight: 1 }}>★</span>
              ))}
            </div>
            <p style={{ fontSize: 13.5, color: D.text, lineHeight: 1.6, marginBottom: 14, fontStyle: 'italic' }}>
              “{tx.testimonial}”
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{
                width: 38, height: 38, borderRadius: '50%',
                background: `linear-gradient(135deg,${D.p},${D.p2})`,
                color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>AK</span>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: D.text }}>Aminata Koné</div>
                <div style={{ fontSize: 11.5, color: D.text2 }}>Superette Dakar</div>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
