import { Star, Check, ArrowRight } from 'lucide-react'
import { convertAmount } from '@/stores/appStore'
import { D, FONT, MONO, scrollTo } from './landingShared'
import type { LandingT, Lang, Currency } from './landingShared'

interface Props {
  lp: LandingT
  navigate: (to: string) => void
  lang: Lang
  currency: Currency
}

export default function LandingPricing({ lp, navigate, lang, currency }: Props) {
  const formatPlanPrice = (amountXOF: number): string => {
    const converted = convertAmount(amountXOF, 'XOF', currency as Currency)
    const rounded = Math.round(converted)
    if (currency === 'XOF' || currency === 'XAF') return new Intl.NumberFormat('fr-FR').format(rounded) + ' FCFA'
    if (currency === 'EUR') return new Intl.NumberFormat('fr-FR').format(rounded) + ' €'
    if (currency === 'USD') return '$ ' + new Intl.NumberFormat('en-US').format(rounded)
    if (currency === 'CAD') return 'CA$ ' + new Intl.NumberFormat('en-US').format(rounded)
    if (currency === 'GBP') return '£' + new Intl.NumberFormat('en-GB').format(rounded)
    return rounded.toString()
  }

  const pricing = [
    {
      name: lp.starter_name, sub: lp.starter_sub, xof: 14400, pop: false, btn: 'light',
      btnText: lp.free_start, color: D.acc2,
      features: [
        { ok: true,  text: lp.feat_pos_1 },
        { ok: true,  text: lp.feat_stock_500 },
        { ok: true,  text: lp.feat_reports },
        { ok: true,  text: lp.feat_support },
        { ok: false, text: lp.feat_multiuser },
        { ok: false, text: lp.feat_hr },
      ],
    },
    {
      name: lp.business_name, sub: lp.business_sub, xof: 34750, pop: true, btn: 'white',
      btnText: lp.try_free, tag: lp.most_popular, color: D.p3,
      features: [
        { ok: true, text: lp.feat_pos_3 },
        { ok: true, text: lp.feat_stock_inf },
        { ok: true, text: lp.feat_crm },
        { ok: true, text: lp.feat_hr_full },
        { ok: true, text: lp.feat_5users },
        { ok: true, text: lp.feat_priority },
      ],
    },
    {
      name: lp.enterprise_name, sub: lp.enterprise_sub, xof: 0, pop: false, btn: 'outline',
      btnText: lp.contact_us, color: D.acc3,
      features: [
        { ok: true, text: lp.feat_pos_inf },
        { ok: true, text: lp.feat_multi_shop },
        { ok: true, text: lp.feat_users_inf },
        { ok: true, text: lp.feat_api },
        { ok: true, text: lp.feat_onboarding },
        { ok: true, text: lp.feat_sla },
      ],
    },
  ]
  return (
    <>
      <section id="section-pricing" style={{ padding: '88px clamp(16px,4vw,80px)', background: `linear-gradient(180deg,${D.bg2},${D.bg})`, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 'var(--fs-caption)', fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.pricing_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 8' }}>
            {lp.pricing_title}
          </h2>
          <p style={{ fontSize: 'var(--fs-title)', color: D.text2 }}>{lp.pricing_sub}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18, maxWidth: 1000, margin: '0 auto', alignItems: 'start' }}>
          {pricing.map(p => (
            <div key={p.name} style={{
              background: p.pop
                ? `linear-gradient(160deg,${D.p},${D.p2} 70%,${D.p3})`
                : `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1.5px solid ${p.pop ? D.gold : 'rgba(139,92,246,.25)'}`,
              borderRadius: 22, padding: '32px 28px',
              position: 'relative',
              transition: 'all .2s',
              transform: p.pop ? 'scale(1.03)' : 'none',
              boxShadow: p.pop
                ? '0 24px 60px rgba(108,71,255,.5),0 0 0 1px rgba(234,179,8,.4)'
                : '0 2px 12px rgba(0,0,0,.2)',
            }}
              onMouseEnter={e => { if (!p.pop) { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 20px 50px rgba(0,0,0,.5)' } }}
              onMouseLeave={e => { if (!p.pop) { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 2px 12px rgba(0,0,0,.2)' } }}
            >
              {p.tag && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg,${D.gold},${D.gold2})`, color: '#1A1A2E',
                  fontSize: 10, fontWeight: 900, padding: '5px 14px', borderRadius: 99,
                  textTransform: 'uppercase', letterSpacing: '.7px',
                  boxShadow: '0 6px 18px rgba(234,179,8,.45)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <Star size={11} fill="#1A1A2E" color="#1A1A2E"/>{p.tag}
                </div>
              )}

              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.2px', color: p.pop ? 'rgba(255,255,255,.75)' : D.text3, marginBottom: 6 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: p.pop ? 'rgba(255,255,255,.7)' : D.text2, marginBottom: 18 }}>
                {p.sub}
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: p.xof === 0 ? 26 : 40, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: p.xof === 0 ? (p.pop ? '#fff' : D.text) : (p.pop ? D.gold2 : D.gold) }}>
                  {p.xof === 0 ? lp.on_estimate : formatPlanPrice(p.xof)}
                </div>
                {p.xof !== 0 && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: p.pop ? 'rgba(255,255,255,.65)' : D.text3, marginTop: 4 }}>
                    {lp.per_month}
                  </div>
                )}
                {/* Équivalence EUR sous le prix FCFA (conversion approx. au taux fixe 1€=655,957 XOF) */}
                {p.xof !== 0 && (currency === 'XOF' || currency === 'XAF') && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: p.pop ? 'rgba(255,255,255,.5)' : D.text4, marginTop: 4, fontFamily: MONO }}>
                    ≈ {new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(convertAmount(p.xof, 'XOF', 'EUR'))} € {lp.per_month}
                  </div>
                )}
                {p.xof !== 0 && currency !== 'XOF' && currency !== 'XAF' && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: p.pop ? 'rgba(255,255,255,.5)' : D.text4, marginTop: 4, fontFamily: MONO }}>
                    ≈ {new Intl.NumberFormat('fr-FR').format(p.xof)} FCFA
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: p.pop ? 'rgba(255,255,255,.15)' : D.border, marginBottom: 20 }}/>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
                {p.features.map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-sm)' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: p.pop
                        ? (f.ok ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)')
                        : (f.ok ? 'rgba(0,208,132,.18)' : 'rgba(255,255,255,.05)'),
                      color: p.pop
                        ? (f.ok ? '#fff' : 'rgba(255,255,255,.35)')
                        : (f.ok ? D.acc : D.text4),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {f.ok ? <Check size={11} strokeWidth={3.2}/> : '−'}
                    </span>
                    <span style={{ color: p.pop ? (f.ok ? '#fff' : 'rgba(255,255,255,.5)') : (f.ok ? D.text : D.text4) }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              <button type="button"
                onClick={() => p.name === lp.enterprise_name ? scrollTo('section-faq') : navigate('/signup')}
                style={{
                  width: '100%', borderRadius: 13, padding: '13px 0',
                  fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer',
                  fontFamily: FONT, transition: 'all .2s',
                  background: p.btn === 'light' ? `linear-gradient(135deg,${D.p},${D.p2})`
                    : p.btn === 'white' ? '#fff'
                    : 'rgba(255,255,255,.04)',
                  color: p.btn === 'light' ? '#fff' : p.btn === 'white' ? D.p : D.text,
                  border: p.btn === 'outline' ? `1.5px solid ${D.border2}` : 'none',
                  boxShadow: p.btn === 'light' ? '0 6px 20px rgba(108,71,255,.35)'
                    : p.btn === 'white' ? '0 6px 20px rgba(0,0,0,.25)'
                    : 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {p.btnText}<ArrowRight size={14}/>
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
