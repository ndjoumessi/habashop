import { Sparkles, Globe, Star, Zap, Play, Check, TrendingUp, ShoppingBag } from 'lucide-react'
import { D, FONT, MONO } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
}

export default function LandingHero({ lp, i, navigate }: Props) {

  return (
    <>
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '120px clamp(16px,4vw,80px) 80px',
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg,${D.bg} 0%,${D.bg2} 50%,#0A0718 100%)`,
      }}>
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(108,71,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(108,71,255,.06) 1px,transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Orbs */}
        <div style={{ position: 'absolute', top: '8%', left: '8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,71,255,.16),transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', animation: 'lp-float 6s ease-in-out infinite' }}/>
        <div style={{ position: 'absolute', bottom: '12%', right: '8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,208,132,.11),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'lp-float 8s ease-in-out infinite reverse' }}/>
        <div style={{ position: 'absolute', top: '38%', right: '30%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(234,179,8,.12),transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }}/>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 820, width: '100%' }}>
          {/* Badge — pattern Linear/Vercel : fond translucide + bordure violette subtile */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', background: 'rgba(124,58,237,.12)',
            border: '1px solid rgba(139,92,246,.35)', borderRadius: 999,
            marginBottom: 28, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span className="public-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: D.gold, animation: 'lp-pulse 2s infinite', display: 'inline-block' }}/>
            <Sparkles size={12} strokeWidth={2.4} color="#EAB308"/>
            <span style={{
              fontSize: 13, fontWeight: 500,
              background: 'linear-gradient(90deg,#A78BFA 0%,#EAB308 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: '#E2D9F3',
            }}>{lp.badge}</span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(22px,5.4vw,60px)', fontWeight: 900, color: D.text,
            letterSpacing: 'clamp(-2px,-.13vw,-.3px)', lineHeight: 1.12,
            marginBottom: 22, overflowWrap: 'break-word',
          }}>
            <span style={{ display: 'block' }}>{lp.h1a}</span>
            <span style={{
              display: 'block',
              background: `linear-gradient(135deg,${D.p2},${D.gold} 55%,${D.gold2})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{lp.h1b}</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(15px,1.8vw,18px)', color: D.text2,
            lineHeight: 1.75, maxWidth: 600, margin: '0 auto 36px',
          }}>{lp.hero_sub}</p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button type="button" onClick={() => navigate('/signup')}
              style={{
                padding: '15px 32px', borderRadius: 14,
                background: `linear-gradient(135deg,${D.p},${D.p2})`,
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', fontFamily: FONT,
                boxShadow: '0 8px 28px rgba(108,71,255,.5)', transition: 'all .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 36px rgba(108,71,255,.65)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 8px 28px rgba(108,71,255,.5)' }}
            >
              <Zap size={16} strokeWidth={2.6}/>{lp.cta1}
            </button>
            <button type="button" onClick={() => navigate('/login')}
              style={{
                padding: '15px 28px', borderRadius: 14,
                background: 'rgba(234,179,8,.08)',
                border: `1px solid ${D.gold}`, color: D.gold2,
                fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
                transition: 'all .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(234,179,8,.16)'; el.style.boxShadow = '0 8px 24px rgba(234,179,8,.3)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(234,179,8,.08)'; el.style.boxShadow = 'none' }}
            >
              <Play size={14} strokeWidth={2.6} color={D.gold2}/>{lp.cta2}
            </button>
          </div>

          {/* Réassurance — pattern Stripe/Vercel : lever les frictions juste sous les CTA */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(10px,2vw,18px)',
            flexWrap: 'wrap', marginBottom: 44, fontSize: 13, fontWeight: 600, color: D.text3,
          }}>
            {[
              i('Sans carte bancaire', 'No credit card', 'Sin tarjeta', 'Nessuna carta'),
              i('14 jours d\'essai', '14-day trial', '14 días de prueba', '14 giorni di prova'),
              i('Wave & Orange Money', 'Wave & Orange Money', 'Wave y Orange Money', 'Wave e Orange Money'),
            ].map((txt, idx) => (
              <div key={txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(10px,2vw,18px)' }}>
                {idx > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: D.text4 }}/>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} strokeWidth={3} color={D.acc}/>{txt}
                </span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(20px,5vw,44px)', flexWrap: 'wrap', marginBottom: 48 }}>
            {[
              { v: '500+',  l: i('Boutiques', 'Shops', 'Tiendas', 'Negozi') },
              { v: '12',    l: i('Pays', 'Countries', 'Países', 'Paesi') },
              { v: '99.9%', l: i('Disponibilité', 'Uptime', 'Disponibilidad', 'Disponibilità') },
            ].map((s, idx) => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px,5vw,44px)' }}>
                {idx > 0 && <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,.1)' }}/>}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(24px,3vw,30px)', fontWeight: 900, color: D.gold, fontFamily: MONO, letterSpacing: '-1px', lineHeight: 1.1 }}>{s.v}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: D.text2, marginTop: 4 }}>{s.l}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex' }}>
                {[
                  { bg: D.p,    fg: '#fff'    }, // violet : texte blanc (AA ok)
                  { bg: D.acc3, fg: '#1A1A2E' }, // orange : texte sombre (AA)
                  { bg: D.acc,  fg: '#1A1A2E' }, // vert   : texte sombre (AA)
                  { bg: D.acc2, fg: '#1A1A2E' }, // bleu   : texte sombre (AA)
                  { bg: D.acc4, fg: '#1A1A2E' }, // rouge  : texte sombre (AA)
                ].map((a, i) => (
                  <div key={i} style={{
                    width: 28, height: 28, borderRadius: '50%', background: a.bg,
                    border: `2px solid ${D.bg}`, marginLeft: i > 0 ? -8 : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color: a.fg,
                  }}>{['MB','KD','FN','SK','AT'][i]}</div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: D.text2 }}>
                <strong style={{ color: D.text }}>2 500+</strong>{' '}{lp.proof_stores}
              </span>
            </div>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: D.text4 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[1,2,3,4,5].map(i => <Star key={i} size={13} fill={D.acc3} color={D.acc3}/>)}
              <span style={{ fontSize: 13, color: D.text2, marginLeft: 4 }}>4.9/5</span>
            </div>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: D.text4 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: D.text2 }}>
              <Globe size={14} color={D.text3}/>{lp.proof_countries}
            </div>
          </div>

          {/* Aperçu produit — carte glow (mini-dashboard) : signature visuelle Linear/Stripe */}
          <div style={{
            marginTop: 56, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto',
            borderRadius: 20, padding: 'clamp(16px,3vw,24px)',
            background: `linear-gradient(160deg,${D.bg3},${D.bg4})`,
            border: `1px solid rgba(124,92,255,.28)`,
            boxShadow: '0 30px 80px -20px rgba(108,71,255,.4)',
            textAlign: 'left',
          }}>
            {/* Barre de fenêtre */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: D.acc4 }}/>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: D.gold }}/>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: D.acc }}/>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: D.acc }}>
                <span className="public-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: D.acc, display: 'inline-block' }}/>
                {i('En direct', 'Live', 'En vivo', 'In diretta')}
              </span>
            </div>

            {/* CA du jour */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: D.text3, marginBottom: 6 }}>
              {i('Chiffre d\'affaires du jour', 'Today\'s revenue', 'Ingresos de hoy', 'Fatturato di oggi')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(26px,5vw,36px)', fontWeight: 900, color: D.gold, fontFamily: MONO, letterSpacing: '-1px', lineHeight: 1 }}>1 240 000</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: D.text3 }}>FCFA</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: D.acc, background: 'rgba(34,199,122,.12)', border: '1px solid rgba(34,199,122,.25)', borderRadius: 99, padding: '2px 8px' }}>
                <TrendingUp size={12} strokeWidth={2.6}/> +18%
              </span>
            </div>

            {/* Mini KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { Icon: ShoppingBag, v: '42', l: i('Ventes', 'Sales', 'Ventas', 'Vendite'), c: D.acc2 },
                { Icon: TrendingUp,  v: '29 500', l: i('Panier moyen', 'Avg. basket', 'Cesta media', 'Scontrino medio'), c: D.p2 },
              ].map(k => (
                <div key={k.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.03)', border: `1px solid ${D.border}`, borderRadius: 12 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,92,255,.12)', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <k.Icon size={15} strokeWidth={2.4}/>
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: D.text, fontFamily: MONO, lineHeight: 1.1 }}>{k.v}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: D.text3 }}>{k.l}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Barre d'objectif */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: D.text3 }}>{i('Objectif du jour', 'Daily goal', 'Objetivo del día', 'Obiettivo del giorno')}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: D.text2, fontFamily: MONO }}>78%</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '78%', borderRadius: 99, background: `linear-gradient(90deg,${D.p},${D.p2})`, boxShadow: '0 0 12px rgba(108,71,255,.5)' }}/>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
