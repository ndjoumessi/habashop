import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, type Currency, type Lang } from '@/stores/appStore'

const STEPS = [
  { id: 1, icon: '👋', label: 'Bienvenue' },
  { id: 2, icon: '🏪', label: 'Boutique' },
  { id: 3, icon: '🌍', label: 'Paramètres' },
  { id: 4, icon: '✅', label: 'Prêt !' },
]

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'XOF', label: 'Franc CFA (UEMOA)', symbol: 'FCFA' },
  { value: 'XAF', label: 'Franc CFA (CEMAC)', symbol: 'FCFA' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'USD', label: 'Dollar US', symbol: '$' },
  { value: 'CAD', label: 'Dollar canadien', symbol: 'CA$' },
]

const LANGS: { value: Lang; label: string; flag: string }[] = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { updateConfig, setLang, setCurrency } = useAppStore()
  const [step, setStep] = useState(1)
  const [shopName, setShopName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [selectedLang, setSelectedLang] = useState<Lang>('fr')
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('XOF')

  function finish() {
    updateConfig({
      shopName: shopName || 'Ma Boutique',
      shopAddress,
      lang: selectedLang,
      currency: selectedCurrency,
    })
    setLang(selectedLang)
    setCurrency(selectedCurrency)
    navigate('/app/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 800, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(108,71,255,.15) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20,
            background: 'linear-gradient(135deg, var(--p), var(--p2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, fontWeight: 900, color: '#fff',
            margin: '0 auto 14px',
            boxShadow: 'var(--sh-p)',
          }}>H</div>
          <div style={{
            fontSize: 26, fontWeight: 900,
            background: 'linear-gradient(135deg, var(--p2), var(--p3))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>HabaShop</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Configuration initiale</div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: step > s.id ? 'var(--acc2)' : step === s.id ? 'var(--p)' : 'var(--bg3)',
                  border: `2px solid ${step >= s.id ? 'transparent' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800,
                  color: step >= s.id ? '#fff' : 'var(--text3)',
                  transition: 'all .3s',
                  boxShadow: step === s.id ? 'var(--sh-p)' : 'none',
                }}>
                  {step > s.id ? '✓' : s.icon}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.4px',
                  color: step === s.id ? 'var(--text)' : 'var(--text3)',
                  textTransform: 'uppercase',
                }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 56, height: 2, marginBottom: 22,
                  background: step > s.id ? 'var(--acc2)' : 'var(--border)',
                  transition: 'background .3s',
                  margin: '0 6px 22px',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '32px 36px',
          marginBottom: 16,
          boxShadow: 'var(--sh-md)',
        }}>
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '0 0 12px' }}>
                Bienvenue sur HabaShop !
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, margin: '0 0 24px' }}>
                La solution complète pour gérer votre commerce en Afrique et partout dans le monde.
                Caisse, stock, RH, comptabilité — tout en un.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { icon: '💰', text: 'Point de vente intuitif' },
                  { icon: '📦', text: 'Gestion de stock' },
                  { icon: '👥', text: 'Module RH & paie' },
                  { icon: '📊', text: 'Rapports & analytics' },
                ].map(f => (
                  <div key={f.text} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 12, padding: '12px 14px',
                  }}>
                    <span style={{ fontSize: 22 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>
                🏪 Votre boutique
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 22px' }}>
                Ces informations apparaîtront sur vos tickets et documents.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                    display: 'block', marginBottom: 7,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                  }}>Nom de la boutique *</label>
                  <input
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Ex: SuperMarché Central"
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                    display: 'block', marginBottom: 7,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                  }}>Adresse</label>
                  <input
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Rue, ville, pays"
                    value={shopAddress}
                    onChange={e => setShopAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>
                🌍 Langue & devise
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 22px' }}>
                Personnalisez l'interface selon votre région.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                    display: 'block', marginBottom: 8,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                  }}>Langue</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {LANGS.map(l => (
                      <button key={l.value} onClick={() => setSelectedLang(l.value)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 10,
                        border: `2px solid ${selectedLang === l.value ? 'var(--p)' : 'var(--border)'}`,
                        background: selectedLang === l.value ? 'rgba(108,71,255,.1)' : 'var(--bg3)',
                        color: 'var(--text)', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'all .15s',
                      }}>
                        <span style={{ fontSize: 20 }}>{l.flag}</span>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                    display: 'block', marginBottom: 8,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                  }}>Devise principale</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {CURRENCIES.map(c => (
                      <button key={c.value} onClick={() => setSelectedCurrency(c.value)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10,
                        border: `2px solid ${selectedCurrency === c.value ? 'var(--p)' : 'var(--border)'}`,
                        background: selectedCurrency === c.value ? 'rgba(108,71,255,.1)' : 'var(--bg3)',
                        color: 'var(--text)', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'all .15s',
                      }}>
                        <span>{c.label}</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--p2)', fontSize: 12 }}>
                          {c.symbol}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '0 0 12px' }}>
                Tout est prêt !
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, margin: '0 0 24px' }}>
                Votre boutique{' '}
                <strong style={{ color: 'var(--p2)' }}>{shopName || 'HabaShop'}</strong>{' '}
                est configurée. Vous pouvez maintenant commencer à utiliser toutes les fonctionnalités.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Boutique', value: shopName || '—' },
                  { label: 'Langue',   value: LANGS.find(l => l.value === selectedLang)?.label ?? selectedLang },
                  { label: 'Devise',   value: CURRENCIES.find(c => c.value === selectedCurrency)?.label ?? selectedCurrency },
                ].map(row => (
                  <div key={row.label} style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          {step > 1 ? (
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={() => setStep(s => s - 1)}
            >← Retour</button>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          {step < 4 ? (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => setStep(s => s + 1)}
            >Suivant →</button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={finish}
            >🚀 Accéder à HabaShop</button>
          )}
        </div>
      </div>
    </div>
  )
}
