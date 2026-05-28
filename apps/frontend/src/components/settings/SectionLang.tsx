import { useConfig, useFormatAmount, ACCENT_PAIRS, THEMES, type Currency, type Lang, type Theme } from '@/stores/appStore'
import { type L4, makeI, pick, panel, Head } from '@/components/settings/settingsShared'

export default function SectionLang() {
  const cfg = useConfig()
  const lang = cfg.lang
  const currency = cfg.currency
  const fmt = useFormatAmount()
  const i = makeI(lang)

  const LANGS = [
    { code: 'fr', flag: '🇫🇷', name: 'Français', native: 'Français' },
    { code: 'en', flag: '🇬🇧', name: 'English', native: 'English' },
    { code: 'es', flag: '🇪🇸', name: 'Spanish', native: 'Español' },
    { code: 'it', flag: '🇮🇹', name: 'Italian', native: 'Italiano' },
  ]
  const CURRENCIES: { code: Currency; flag: string; name: Record<L4, string> }[] = [
    { code: 'XOF', flag: '🇸🇳', name: { fr: 'Franc CFA Ouest', en: 'West African CFA', es: 'Franco CFA Oeste', it: 'Franco CFA Ovest' } },
    { code: 'XAF', flag: '🇨🇲', name: { fr: 'Franc CFA Centre', en: 'Central African CFA', es: 'Franco CFA Centro', it: 'Franco CFA Centro' } },
    { code: 'EUR', flag: '🇪🇺', name: { fr: 'Euro', en: 'Euro', es: 'Euro', it: 'Euro' } },
    { code: 'USD', flag: '🇺🇸', name: { fr: 'Dollar US', en: 'US Dollar', es: 'Dólar US', it: 'Dollaro US' } },
    { code: 'CAD', flag: '🇨🇦', name: { fr: 'Dollar CA', en: 'Canadian Dollar', es: 'Dólar CA', it: 'Dollaro CA' } },
    { code: 'GBP', flag: '🇬🇧', name: { fr: 'Livre Sterling', en: 'British Pound', es: 'Libra Esterlina', it: 'Sterlina' } },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp .3s ease both' }}>
      {/* Language */}
      <div style={panel}>
        <Head emoji="🌍" tint="rgba(0,184,255,.05)"
          title={i("Langue de l'interface", 'Interface language', 'Idioma de la interfaz', "Lingua dell'interfaccia")}
          sub={i('4 langues — changement immédiat', '4 languages — instant change', '4 idiomas — cambio inmediato', '4 lingue — cambio immediato')} />
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LANGS.map(l => {
            const active = lang === l.code
            return (
              <button key={l.code} type="button" onClick={() => cfg.setLang(l.code as Lang)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: active ? 'rgba(108,71,255,.12)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'rgba(108,71,255,.35)' : 'rgba(255,255,255,.07)'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .2s' }}>
                <span style={{ fontSize: 28 }}>{l.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--p3)' : 'var(--text)' }}>{l.native}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{l.name}</div>
                </div>
                {active && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--p2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 900 }}>✓</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Currency */}
      <div style={panel}>
        <Head emoji="💱" tint="var(--c-amber-bg)"
          title={i("Devise d'affichage", 'Display currency', 'Divisa de visualización', 'Valuta di visualizzazione')}
          sub={i('6 devises — conversion automatique des montants', '6 currencies — automatic conversion of amounts', '6 divisas — conversión automática de importes', '6 valute — conversione automatica degli importi')} />
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {CURRENCIES.map(c => {
            const active = currency === c.code
            return (
              <button key={c.code} type="button" onClick={() => cfg.setCurrency(c.code)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '16px 10px', borderRadius: 14, background: active ? 'var(--c-amber-bg)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'var(--c-amber-border)' : 'rgba(255,255,255,.07)'}`, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s', position: 'relative' }}>
                {active && <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 900 }}>✓</div>}
                <span style={{ fontSize: 26 }}>{c.flag}</span>
                <div style={{ fontSize: 14, fontWeight: 900, color: active ? 'var(--warn)' : 'var(--text)', fontFamily: 'var(--mono)' }}>{c.code}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.3 }}>{pick(lang, c.name)}</div>
              </button>
            )
          })}
        </div>
        <div style={{ margin: '0 22px 20px', padding: 16, background: 'var(--c-amber-bg)', border: '1px solid var(--c-amber-border)', borderRadius: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--warn)', marginBottom: 12 }}>
            {i('APERÇU — Conversion temps réel', 'PREVIEW — Real-time conversion', 'VISTA PREVIA — Conversión en tiempo real', 'ANTEPRIMA — Conversione in tempo reale')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[100000, 500000, 1000000].map(xof => (
              <div key={xof} style={{ textAlign: 'center', padding: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{xof.toLocaleString('fr-FR')} XOF</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--warn)', fontFamily: 'var(--mono)' }}>{fmt(xof)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance (theme + accent) */}
      <div style={panel}>
        <Head emoji="🎨" tint="rgba(108,71,255,.05)"
          title={i('Apparence', 'Appearance', 'Apariencia', 'Aspetto')}
          sub={i('Thème et couleur d\'accent', 'Theme and accent color', 'Tema y color de acento', 'Tema e colore d\'accento')} />
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10 }}>{i('Thème', 'Theme', 'Tema', 'Tema')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 10 }}>
              {(Object.entries(THEMES) as [Theme, typeof THEMES[Theme]][]).map(([key, th]) => {
                const active = cfg.theme === key
                const tbg = th.vars['--bg']; const tp = th.vars['--p']; const tacc = th.vars['--acc2']; const ttext = th.vars['--text']
                return (
                  <button key={key} type="button" onClick={() => cfg.updateConfig({ theme: key })}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', borderRadius: 14, background: active ? `${tp}18` : 'rgba(255,255,255,.03)', border: `2px solid ${active ? tp + '66' : 'rgba(255,255,255,.07)'}`, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s', position: 'relative' }}>
                    {active && <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: tp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900 }}>✓</div>}
                    <div style={{ width: 72, height: 46, borderRadius: 9, background: tbg, border: '1px solid rgba(255,255,255,.1)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: tp + '33', borderRight: `1px solid ${tp}22` }} />
                      <div style={{ position: 'absolute', left: 20, top: 6, right: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ height: 4, borderRadius: 99, background: tp, width: '60%' }} />
                        <div style={{ height: 3, borderRadius: 99, background: ttext + '44', width: '80%' }} />
                        <div style={{ marginTop: 2, height: 10, borderRadius: 4, background: tacc + '44' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, marginBottom: 1 }}>{th.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--p3)' : 'var(--text2)' }}>{pick(lang, th.label)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10 }}>{i('Couleur d\'accent', 'Accent color', 'Color de acento', 'Colore d\'accento')}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.keys(ACCENT_PAIRS).map(hex => (
                <button key={hex} type="button" onClick={() => cfg.updateConfig({ accentColor: hex })} aria-label={hex}
                  style={{ width: 36, height: 36, borderRadius: 10, background: hex, border: 'none', cursor: 'pointer', outline: cfg.accentColor === hex ? `3px solid ${hex}` : '3px solid transparent', outlineOffset: 2, boxShadow: cfg.accentColor === hex ? `0 0 0 2px rgba(255,255,255,.25)` : 'none', transition: 'all .15s', transform: cfg.accentColor === hex ? 'scale(1.12)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
