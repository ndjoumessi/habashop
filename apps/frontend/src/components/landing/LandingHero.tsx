import { Sparkles, Star, Zap, Play, Check, TrendingUp, ShoppingBag } from 'lucide-react'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
}

// Refonte split (Linear/Stripe) : colonne texte à gauche, carte aperçu produit à droite.
// 100 % en tokens CSS (var(--…)) → reste lisible en thème Clair comme en Sombre.
export default function LandingHero({ lp, i, navigate }: Props) {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      padding: '120px clamp(16px,4vw,64px) 80px',
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg,var(--bg) 0%,var(--bg2) 55%,var(--bg) 100%)',
    }}>
      {/* Grille décor (masquée en fondu radial) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(color-mix(in srgb,var(--p) 6%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--p) 6%,transparent) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%,black 30%,transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%,black 30%,transparent 100%)',
      }}/>
      {/* Halos */}
      <div style={{ position: 'absolute', top: '4%', left: '2%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--p) 16%,transparent),transparent 70%)', filter: 'blur(64px)', pointerEvents: 'none', animation: 'lp-float 6s ease-in-out infinite' }}/>
      <div style={{ position: 'absolute', bottom: '8%', right: '4%', width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--acc2) 12%,transparent),transparent 70%)', filter: 'blur(56px)', pointerEvents: 'none', animation: 'lp-float 8s ease-in-out infinite reverse' }}/>
      <div style={{ position: 'absolute', top: '30%', right: '38%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--acc) 12%,transparent),transparent 70%)', filter: 'blur(44px)', pointerEvents: 'none' }}/>

      {/* Grille split */}
      <div className="lp-hero-grid" style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 1180, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1.02fr .98fr', gap: 'clamp(32px,5vw,64px)', alignItems: 'center',
      }}>
        {/* ── Colonne gauche : texte ── */}
        <div className="lp-hero-left" style={{ textAlign: 'left' }}>
          {/* Badge */}
          <div className="lp-inline-group" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', background: 'color-mix(in srgb,var(--p) 12%,transparent)',
            border: '1px solid color-mix(in srgb,var(--p2) 35%,transparent)', borderRadius: 999,
            marginBottom: 26, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc)', animation: 'lp-pulse 2s infinite', display: 'inline-block' }}/>
            <Sparkles size={12} strokeWidth={2.4} color="var(--acc)"/>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--p3)' }}>{lp.badge}</span>
          </div>

          {/* H1 — un seul titre fort, mot d'accent en --p2 */}
          <h1 style={{
            fontSize: 'clamp(34px,5vw,58px)', fontWeight: 900, color: 'var(--text)',
            letterSpacing: 'clamp(-1.6px,-.12vw,-.4px)', lineHeight: 1.08,
            marginBottom: 18, overflowWrap: 'break-word',
          }}>
            {i('Gérez votre commerce, en toute ', 'Run your business with total ', 'Gestione su comercio con total ', 'Gestisci la tua attività in tutta ')}
            <span style={{ color: 'var(--p2)' }}>{i('clarté', 'clarity', 'claridad', 'chiarezza')}</span>.
          </h1>

          {/* Sous-titre — plus léger */}
          <p style={{
            fontSize: 'clamp(15px,1.5vw,19px)', fontWeight: 500, color: 'var(--text2)',
            lineHeight: 1.65, maxWidth: 520, marginBottom: 32,
          }}>
            {i(
              'Caisse, stock, clients, RH et Mobile Money — une seule plateforme, même hors-ligne.',
              'POS, stock, customers, HR and Mobile Money — one platform, even offline.',
              'TPV, stock, clientes, RR. HH. y Mobile Money — una sola plataforma, incluso sin conexión.',
              'Cassa, magazzino, clienti, HR e Mobile Money — una sola piattaforma, anche offline.',
            )}
          </p>

          {/* CTAs */}
          <div className="lp-inline-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>
            <button type="button" onClick={() => navigate('/signup')}
              style={{
                padding: '14px 30px', borderRadius: 14, background: 'var(--grad-p)',
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: 'var(--sh-p2)',
                transition: 'transform .2s, box-shadow .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 36px rgba(108,71,255,.5)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--sh-p2)' }}
            >
              <Zap size={16} strokeWidth={2.6}/>{lp.cta1}
            </button>
            <button type="button" onClick={() => navigate('/login')}
              style={{
                padding: '14px 26px', borderRadius: 14, background: 'var(--card)',
                border: '1px solid var(--border2)', color: 'var(--text)',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                transition: 'background .2s, border-color .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--card2)'; el.style.borderColor = 'var(--border3)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--card)'; el.style.borderColor = 'var(--border2)' }}
            >
              <Play size={14} strokeWidth={2.6}/>{lp.cta2}
            </button>
          </div>

          {/* Réassurance */}
          <div className="lp-inline-group" style={{
            display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.6vw,16px)',
            flexWrap: 'wrap', marginBottom: 30, fontSize: 13, fontWeight: 600, color: 'var(--text3)',
          }}>
            {[
              i('Sans carte', 'No card', 'Sin tarjeta', 'Nessuna carta'),
              i('14 jours d\'essai', '14-day trial', '14 días de prueba', '14 giorni di prova'),
              i('Wave & Orange Money', 'Wave & Orange Money', 'Wave y Orange Money', 'Wave e Orange Money'),
            ].map((txt, idx) => (
              <div key={txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(10px,1.6vw,16px)' }}>
                {idx > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text4)' }}/>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} strokeWidth={3} color="var(--acc2)"/>{txt}
                </span>
              </div>
            ))}
          </div>

          {/* Bandeau stats (avec note) */}
          <div className="lp-inline-group" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,3vw,32px)', flexWrap: 'wrap' }}>
            {[
              { v: '500+',  l: i('Boutiques', 'Shops', 'Tiendas', 'Negozi') },
              { v: '12',    l: i('Pays', 'Countries', 'Países', 'Paesi') },
              { v: '99,9%', l: i('Disponibilité', 'Uptime', 'Disponibilidad', 'Disponibilità') },
            ].map((s, idx) => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,3vw,32px)' }}>
                {idx > 0 && <div style={{ width: 1, height: 34, background: 'var(--border2)' }}/>}
                <div>
                  <div style={{ fontSize: 'clamp(22px,2.6vw,28px)', fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)', letterSpacing: '-1px', lineHeight: 1.1 }}>{s.v}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginTop: 3 }}>{s.l}</div>
                </div>
              </div>
            ))}
            <div style={{ width: 1, height: 34, background: 'var(--border2)' }}/>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} fill="var(--acc)" color="var(--acc)"/>)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginTop: 5 }}>
                <strong style={{ color: 'var(--text2)' }}>4,9/5</strong>{' · '}{lp.proof_stores}
              </div>
            </div>
          </div>
        </div>

        {/* ── Colonne droite : carte aperçu produit ── */}
        <div className="lp-hero-right">
          <div style={{
            borderRadius: 22, padding: 'clamp(18px,2vw,26px)',
            background: 'var(--grad-card)',
            border: '1px solid var(--border3)',
            boxShadow: '0 40px 90px -24px color-mix(in srgb,var(--p) 45%,transparent)',
          }}>
            {/* Barre de fenêtre */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)' }}/>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--acc)' }}/>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--acc2)' }}/>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--acc2)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc2)', animation: 'lp-pulse 2s infinite', display: 'inline-block' }}/>
                {i('En direct', 'Live', 'En vivo', 'In diretta')}
              </span>
            </div>

            {/* CA du jour */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
              {i('Chiffre d\'affaires du jour', 'Today\'s revenue', 'Ingresos de hoy', 'Fatturato di oggi')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)', letterSpacing: '-1px', lineHeight: 1 }}>1 240 000</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>FCFA</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--acc2)', background: 'color-mix(in srgb,var(--acc2) 14%,transparent)', border: '1px solid color-mix(in srgb,var(--acc2) 28%,transparent)', borderRadius: 99, padding: '2px 8px' }}>
                <TrendingUp size={12} strokeWidth={2.6}/> +18%
              </span>
            </div>

            {/* Mini KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { Icon: ShoppingBag, v: '42', l: i('Ventes', 'Sales', 'Ventas', 'Vendite'), c: 'var(--acc3)' },
                { Icon: TrendingUp,  v: '29 500', l: i('Panier moyen', 'Avg. basket', 'Cesta media', 'Scontrino medio'), c: 'var(--p2)' },
              ].map(k => (
                <div key={k.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card3)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'color-mix(in srgb,var(--p) 12%,transparent)', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <k.Icon size={15} strokeWidth={2.4}/>
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1.1 }}>{k.v}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{k.l}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Barre d'objectif — 68 % */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>{i('Objectif du jour', 'Daily goal', 'Objetivo del día', 'Obiettivo del giorno')}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>68%</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '68%', borderRadius: 99, background: 'var(--grad-p)', boxShadow: '0 0 12px color-mix(in srgb,var(--p) 50%,transparent)' }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive : < 900px → colonne unique, carte sous le texte, contenu centré */}
      <style>{`
        @media (max-width: 900px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
          .lp-hero-left { text-align: center !important; }
          .lp-hero-left .lp-inline-group { justify-content: center !important; }
          .lp-hero-right { max-width: 440px; margin: 0 auto; width: 100%; }
        }
      `}</style>
    </section>
  )
}
