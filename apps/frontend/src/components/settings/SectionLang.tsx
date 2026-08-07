import { useConfig, useFormatAmount, ACCENT_PAIRS, THEMES, THEME_OPTIONS, resolveTheme, type Currency, type Lang } from '@/stores/appStore'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { useAuthStore } from '@/stores/authStore'
import { type L4, makeI, pick, panel, Head } from '@/components/settings/settingsShared'
import { tenantApi } from '@/lib/api'
import { saved } from '@/lib/saved'
import { Check, Lock, Globe, Coins, Palette } from 'lucide-react'

// Noms humains des couleurs d'accent (a11y : aria-label lisible, pas le hex) — keyed sur ACCENT_PAIRS.
const ACCENT_NAMES: Record<string, Record<L4, string>> = {
  '#5B4EE8': { fr: 'Violet', en: 'Violet', es: 'Violeta', it: 'Viola' },
  '#3B82F6': { fr: 'Bleu', en: 'Blue', es: 'Azul', it: 'Blu' },
  '#10B981': { fr: 'Vert', en: 'Green', es: 'Verde', it: 'Verde' },
  '#F59E0B': { fr: 'Orange', en: 'Orange', es: 'Naranja', it: 'Arancione' },
  '#EF4444': { fr: 'Rouge', en: 'Red', es: 'Rojo', it: 'Rosso' },
  '#EC4899': { fr: 'Rose', en: 'Pink', es: 'Rosa', it: 'Rosa' },
}

// Affichage LECTURE SEULE d'un réglage géré par l'admin (langue ou devise active) + note.
function ReadOnlyValue({ flag, value, note }: { flag: string; value: string; note: string }) {
  return (
    <div style={{ padding: '16px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 26 }}>{flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{value}</div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Lock size={11} /> {note}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SectionLang() {
  const cfg = useConfig()
  const lang = cfg.lang
  const currency = cfg.currency
  const fmt = useFormatAmount()
  const i = makeI(lang)
  // Option C — lang & devise = settings tenant ADMIN-only. Les non-admin voient ces
  // réglages en LECTURE SEULE (le backend rejette aussi tout PATCH lang/currency 403).
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const managedNote = i("Géré par l'administrateur", 'Managed by administrator', 'Administrado por el administrador', "Gestito dall'amministratore")

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
        <Head icon={<Globe size={16} />} tint="rgba(0,184,255,.05)"
          title={i("Langue de l'interface", 'Interface language', 'Idioma de la interfaz', "Lingua dell'interfaccia")}
          sub={i('4 langues — réglage de la boutique', '4 languages — shop-wide setting', '4 idiomas — ajuste de la tienda', '4 lingue — impostazione del negozio')} />
        {isAdmin ? (
          <ResponsiveGrid min={160} gap={10} style={{ padding: '16px 22px' }}>
            {LANGS.map(l => {
              const active = lang === l.code
              return (
                <button key={l.code} type="button" aria-pressed={active} onClick={() => {
                  // Optimiste, mais RÉVERSIBLE : si le serveur refuse, on revient à la
                  // valeur d'avant plutôt que de laisser l'écran affirmer un réglage absent.
                  const precedent = lang
                  cfg.setLang(l.code as Lang)
                  void saved(tenantApi.update({ lang: l.code }), i('la langue', 'the language', 'el idioma', 'la lingua'))
                    .then(ok => { if (!ok) cfg.setLang(precedent as Lang) })
                }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 12,
                    background: active ? 'color-mix(in srgb, var(--p) 10%, transparent)' : 'var(--bg3)',
                    border: `1.5px solid ${active ? 'var(--p)' : 'var(--border)'}`,
                    boxShadow: active ? '0 0 0 3px color-mix(in srgb, var(--p) 20%, transparent)' : 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                    transition: 'all .15s',
                  }}>
                  <span style={{ fontSize: 28 }}>{l.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: active ? 'var(--p)' : 'var(--text)' }}>{l.native}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{l.name}</div>
                  </div>
                  {active && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--p)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={12} color="#fff" />
                    </div>
                  )}
                </button>
              )
            })}
          </ResponsiveGrid>
        ) : (
          <ReadOnlyValue
            flag={LANGS.find(l => l.code === lang)?.flag ?? '🌐'}
            value={LANGS.find(l => l.code === lang)?.native ?? lang}
            note={managedNote}
          />
        )}
      </div>

      {/* Currency */}
      <div style={panel}>
        <Head icon={<Coins size={16} />} tint="rgba(255,184,0,.03)"
          title={i('Devise de la boutique', 'Shop currency', 'Divisa de la tienda', 'Valuta del negozio')}
          sub={i('6 devises — réglage commun à toute la boutique, conversion automatique des montants', '6 currencies — shop-wide setting, automatic amount conversion', '6 divisas — ajuste común para toda la tienda, conversión automática', '6 valute — impostazione comune a tutto il negozio, conversione automatica')} />
        {!isAdmin ? (
          <ReadOnlyValue
            flag={CURRENCIES.find(c => c.code === currency)?.flag ?? '💱'}
            value={`${currency} — ${pick(lang, CURRENCIES.find(c => c.code === currency)?.name ?? { fr: currency, en: currency, es: currency, it: currency })}`}
            note={managedNote}
          />
        ) : (
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {CURRENCIES.map(c => {
            const active = currency === c.code
            return (
              <button key={c.code} type="button" aria-pressed={active} onClick={() => {
                // Option C : devise = setting TENANT (admin only ici). On met à jour le
                // store local pour un retour immédiat ET on pousse au tenant ; setTenant
                // restaurera cette devise pour tous les membres à chaque /me.
                // Idem, et ce cas est DEVENU atteignable : le garde de zone franc CFA
                // refuse désormais un couple pays/devise incohérent (400).
                const precedente = currency
                cfg.setCurrency(c.code)
                void saved(tenantApi.update({ currency: c.code }), i('la devise', 'the currency', 'la divisa', 'la valuta'))
                  .then(ok => { if (!ok) cfg.setCurrency(precedente) })
              }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  padding: '16px 10px', borderRadius: 12,
                  background: active ? 'rgba(255,184,0,.08)' : 'var(--bg3)',
                  border: `1.5px solid ${active ? 'var(--warn)' : 'var(--border)'}`,
                  boxShadow: active ? '0 0 0 3px rgba(255,184,0,.20)' : 'none',
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  transition: 'all .15s', position: 'relative',
                }}>
                {active && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--warn)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={11} color="#000" />
                  </div>
                )}
                <span style={{ fontSize: 26 }}>{c.flag}</span>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: active ? 'var(--warn)' : 'var(--text)', fontFamily: 'var(--mono)' }}>{c.code}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', textAlign: 'center', lineHeight: 1.3 }}>{pick(lang, c.name)}</div>
              </button>
            )
          })}
        </div>
        )}
        <div style={{ margin: '0 22px 20px', padding: 16, background: 'rgba(255,184,0,.03)', border: '1px solid rgba(255,184,0,.08)', borderRadius: 14 }}>
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--warn)', marginBottom: 12 }}>
            {i('APERÇU — Conversion temps réel', 'PREVIEW — Real-time conversion', 'VISTA PREVIA — Conversión en tiempo real', 'ANTEPRIMA — Conversione in tempo reale')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[100000, 500000, 1000000].map(xof => (
              <div key={xof} style={{ textAlign: 'center', padding: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginBottom: 4 }}>{xof.toLocaleString('fr-FR')} XOF</div>
                <div style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)', color: 'var(--warn)', fontFamily: 'var(--mono)' }}>{fmt(xof)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance (theme + accent) */}
      <div style={panel}>
        <Head icon={<Palette size={16} />} tint="rgba(108,71,255,.05)"
          title={i('Apparence', 'Appearance', 'Apariencia', 'Aspetto')}
          sub={i('Thème et couleur d\'accent', 'Theme and accent color', 'Tema y color de acento', 'Tema e colore d\'accento')} />
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10 }}>{i('Thème', 'Theme', 'Tema', 'Tema')}</div>
            <ResponsiveGrid min={118} gap={10}>
              {THEME_OPTIONS.map(({ key, emoji, label }) => {
                const active = cfg.theme === key
                // « Système » n'a pas de palette propre → aperçu = thème effectif (dark/light selon l'OS).
                const pv = THEMES[resolveTheme(key)].vars
                const tbg = pv['--bg']; const tp = pv['--p']; const tacc = pv['--acc2'] ?? pv['--p']; const ttext = pv['--text']
                return (
                  <button key={key} type="button" aria-pressed={active} onClick={() => cfg.updateConfig({ theme: key })}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', borderRadius: 14, background: active ? `${tp}18` : 'var(--bg3)', border: `2px solid ${active ? tp + '66' : 'var(--border)'}`, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s', position: 'relative' }}>
                    {active && <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: tp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Check size={11} /></div>}
                    <div style={{ width: 72, height: 46, borderRadius: 9, background: tbg, border: '1px solid var(--border)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: tp + '33', borderRight: `1px solid ${tp}22` }} />
                      <div style={{ position: 'absolute', left: 20, top: 6, right: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ height: 4, borderRadius: 99, background: tp, width: '60%' }} />
                        <div style={{ height: 3, borderRadius: 99, background: ttext + '44', width: '80%' }} />
                        <div style={{ marginTop: 2, height: 10, borderRadius: 4, background: tacc + '44' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--fs-md)', marginBottom: 1 }}>{emoji}</div>
                      <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: active ? 'var(--p3)' : 'var(--text2)' }}>{pick(lang, label)}</div>
                    </div>
                  </button>
                )
              })}
            </ResponsiveGrid>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {i('Couleur d\'accent', 'Accent color', 'Color de acento', 'Colore d\'accento')}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.keys(ACCENT_PAIRS).map(hex => (
                <button key={hex} type="button" onClick={() => cfg.updateConfig({ accentColor: hex })}
                  aria-pressed={cfg.accentColor === hex}
                  aria-label={pick(lang, ACCENT_NAMES[hex] ?? { fr: hex, en: hex, es: hex, it: hex })}
                  style={{ width: 36, height: 36, borderRadius: 10, background: hex, border: 'none', cursor: 'pointer', outline: cfg.accentColor === hex ? `3px solid ${hex}` : '3px solid transparent', outlineOffset: 2, boxShadow: cfg.accentColor === hex ? `0 0 0 2px rgba(255,255,255,.25)` : 'none', transition: 'all .15s', transform: cfg.accentColor === hex ? 'scale(1.12)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
