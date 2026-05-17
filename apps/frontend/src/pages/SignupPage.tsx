import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import type { Lang, Currency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import PhoneInput from '@/components/ui/PhoneInput'
import toast from 'react-hot-toast'

const BUSINESS_TYPES: Record<Lang, string[]> = {
  fr: ['Commerce de détail', 'Grossiste / Semi-grossiste', 'Restauration & Alimentation', 'Supérette / Épicerie', 'Mode & Textile', 'Pharmacie & Santé', 'Électronique & Informatique', 'Autre'],
  en: ['Retail store', 'Wholesale / Semi-wholesale', 'Food & Restaurant', 'Grocery / Superette', 'Fashion & Textile', 'Pharmacy & Health', 'Electronics & IT', 'Other'],
  es: ['Tienda minorista', 'Mayorista / Semi-mayorista', 'Restauración & Alimentación', 'Supermercado / Tienda', 'Moda & Textil', 'Farmacia & Salud', 'Electrónica & IT', 'Otro'],
  it: ['Negozio al dettaglio', 'Ingrosso / Semi-ingrosso', 'Ristorazione & Alimentari', 'Supermercato / Alimentari', 'Moda & Tessile', 'Farmacia & Salute', 'Elettronica & IT', 'Altro'],
}

type ST = {
  title: string; subtitle: string; firstname: string; lastname: string
  shopName: string; email: string; phone: string; password: string
  confirm: string; businessType: string; country: string; currency: string
  terms: string; submit: string; loading: string; login: string; loginLink: string
  backHome: string; strengthWeak: string; strengthFair: string; strengthGood: string; strengthStrong: string
  errRequired: string; errPassword: string; errPasswordLen: string; errTerms: string
  searchCountry: string; noCountry: string
}

const SIGNUP_TEXTS: Record<Lang, ST> = {
  fr: {
    title: 'Créer votre compte', subtitle: '14 jours gratuits — sans carte bancaire',
    firstname: 'Prénom *', lastname: 'Nom *', shopName: 'Nom de la boutique *',
    email: 'Email professionnel *', phone: 'Téléphone', password: 'Mot de passe *',
    confirm: 'Confirmer le mot de passe *', businessType: 'Type de commerce',
    country: 'Pays', currency: 'Devise principale',
    terms: "J'accepte les CGU et la politique de confidentialité",
    submit: '🚀 Créer mon compte gratuitement', loading: 'Création en cours…',
    login: 'Déjà un compte ?', loginLink: 'Se connecter', backHome: "← Retour à l'accueil",
    strengthWeak: 'Faible', strengthFair: 'Moyen', strengthGood: 'Bon', strengthStrong: 'Fort',
    errRequired: 'Veuillez remplir tous les champs obligatoires',
    errPassword: 'Les mots de passe ne correspondent pas',
    errPasswordLen: 'Le mot de passe doit contenir au moins 8 caractères',
    errTerms: 'Vous devez accepter les CGU',
    searchCountry: 'Rechercher un pays...', noCountry: 'Aucun pays trouvé',
  },
  en: {
    title: 'Create your account', subtitle: '14 days free — no credit card required',
    firstname: 'First name *', lastname: 'Last name *', shopName: 'Shop name *',
    email: 'Professional email *', phone: 'Phone number', password: 'Password *',
    confirm: 'Confirm password *', businessType: 'Business type',
    country: 'Country', currency: 'Main currency',
    terms: 'I agree to the Terms of Service and Privacy Policy',
    submit: '🚀 Create my free account', loading: 'Creating account…',
    login: 'Already have an account?', loginLink: 'Sign in', backHome: '← Back to home',
    strengthWeak: 'Weak', strengthFair: 'Fair', strengthGood: 'Good', strengthStrong: 'Strong',
    errRequired: 'Please fill in all required fields',
    errPassword: 'Passwords do not match',
    errPasswordLen: 'Password must be at least 8 characters',
    errTerms: 'You must accept the terms',
    searchCountry: 'Search a country...', noCountry: 'No country found',
  },
  es: {
    title: 'Crear tu cuenta', subtitle: '14 días gratis — sin tarjeta de crédito',
    firstname: 'Nombre *', lastname: 'Apellido *', shopName: 'Nombre de la tienda *',
    email: 'Email profesional *', phone: 'Teléfono', password: 'Contraseña *',
    confirm: 'Confirmar contraseña *', businessType: 'Tipo de negocio',
    country: 'País', currency: 'Divisa principal',
    terms: 'Acepto los Términos de Servicio y la Política de Privacidad',
    submit: '🚀 Crear mi cuenta gratis', loading: 'Creando cuenta…',
    login: '¿Ya tienes una cuenta?', loginLink: 'Iniciar sesión', backHome: '← Volver al inicio',
    strengthWeak: 'Débil', strengthFair: 'Regular', strengthGood: 'Buena', strengthStrong: 'Fuerte',
    errRequired: 'Por favor complete todos los campos obligatorios',
    errPassword: 'Las contraseñas no coinciden',
    errPasswordLen: 'La contraseña debe tener al menos 8 caracteres',
    errTerms: 'Debes aceptar los términos',
    searchCountry: 'Buscar un país...', noCountry: 'Ningún país encontrado',
  },
  it: {
    title: 'Crea il tuo account', subtitle: '14 giorni gratuiti — nessuna carta richiesta',
    firstname: 'Nome *', lastname: 'Cognome *', shopName: 'Nome del negozio *',
    email: 'Email professionale *', phone: 'Telefono', password: 'Password *',
    confirm: 'Conferma password *', businessType: 'Tipo di attività',
    country: 'Paese', currency: 'Valuta principale',
    terms: 'Accetto i Termini di Servizio e la Politica sulla Privacy',
    submit: '🚀 Crea il mio account gratuitamente', loading: 'Creazione in corso…',
    login: 'Hai già un account?', loginLink: 'Accedi', backHome: '← Torna alla home',
    strengthWeak: 'Debole', strengthFair: 'Discreto', strengthGood: 'Buono', strengthStrong: 'Forte',
    errRequired: 'Compila tutti i campi obbligatori',
    errPassword: 'Le password non corrispondono',
    errPasswordLen: 'La password deve contenere almeno 8 caratteri',
    errTerms: 'Devi accettare i termini',
    searchCountry: 'Cerca un paese...', noCountry: 'Nessun paese trovato',
  },
}

const COUNTRIES = [
  { code: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'SN', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CI', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'ML', flag: '🇲🇱', name: 'Mali' },
  { code: 'BF', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'CM', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'CG', flag: '🇨🇬', name: 'Congo' },
  { code: 'CD', flag: '🇨🇩', name: 'RD Congo' },
  { code: 'GA', flag: '🇬🇦', name: 'Gabon' },
  { code: 'NE', flag: '🇳🇪', name: 'Niger' },
  { code: 'TG', flag: '🇹🇬', name: 'Togo' },
  { code: 'BJ', flag: '🇧🇯', name: 'Bénin' },
  { code: 'GN', flag: '🇬🇳', name: 'Guinée' },
  { code: 'GH', flag: '🇬🇭', name: 'Ghana' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'MA', flag: '🇲🇦', name: 'Maroc' },
  { code: 'DZ', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', flag: '🇨🇭', name: 'Suisse' },
  { code: 'ES', flag: '🇪🇸', name: 'España' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Deutschland' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: 'LU', flag: '🇱🇺', name: 'Luxembourg' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'US', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'OTHER', flag: '🌍', name: 'Autre' },
]

function getPasswordStrength(pwd: string): number {
  if (pwd.length < 4) return 0
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return score
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid var(--border)', borderRadius: 10,
  fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
  transition: 'border-color .15s', boxSizing: 'border-box',
  background: 'var(--bg3)', color: 'var(--text)',
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
      {children}
    </label>
  )
}

export default function SignupPage() {
  const navigate = useNavigate()
  const { lang } = useAppStore()
  const { register } = useAuthStore()
  const tx = SIGNUP_TEXTS[lang] ?? SIGNUP_TEXTS.fr
  const types = BUSINESS_TYPES[lang] ?? BUSINESS_TYPES.fr

  const [form, setForm] = useState({
    firstname: '', lastname: '', shopName: '', email: '', phone: '',
    password: '', confirm: '', businessType: types[0],
    country: 'SN', currency: 'XOF' as Currency, acceptTerms: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Country dropdown
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  )
  const selectedCountry = COUNTRIES.find(c => c.code === form.country) ?? COUNTRIES[0]

  const strength = getPasswordStrength(form.password)
  const strengthLabels = [tx.strengthWeak, tx.strengthFair, tx.strengthGood, tx.strengthStrong]
  const strengthColors = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981']

  const handleSubmit = async () => {
    setError('')
    if (!form.firstname || !form.lastname || !form.shopName || !form.email || !form.password || !form.confirm) {
      setError(tx.errRequired); return
    }
    if (form.password.length < 8) { setError(tx.errPasswordLen); return }
    if (form.password !== form.confirm) { setError(tx.errPassword); return }
    if (!form.acceptTerms) { setError(tx.errTerms); return }
    setLoading(true)
    try {
      await register({
        name: `${form.firstname} ${form.lastname}`,
        email: form.email,
        password: form.password,
        shopName: form.shopName,
        currency: form.currency,
        country: form.country,
      })
      toast.success('✅ Compte créé ! Bienvenue sur HabaShop')
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Navbar ── */}
      <div style={{
        width: '100%', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(12,11,20,.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxSizing: 'border-box',
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg,var(--p),var(--p2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#fff',
            boxShadow: '0 4px 14px rgba(91,78,232,.4)',
          }}>H</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
            Haba<span style={{ color: 'var(--p2)' }}>Shop</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 9, padding: '7px 14px',
            fontSize: 12, fontWeight: 600, color: 'var(--text2)',
            cursor: 'pointer', fontFamily: 'var(--font)',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg4)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)' }}
        >← {tx.backHome.replace('← ', '').replace('← ', '')}</button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px 80px' }}>
        <div style={{
          width: '100%', maxWidth: 560,
          background: 'var(--card)', borderRadius: 24, padding: '40px 44px',
          boxShadow: '0 20px 80px rgba(0,0,0,.28)', border: '1px solid var(--border)',
        }}>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg,var(--p),var(--p2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: '#fff',
              margin: '0 auto 14px', boxShadow: '0 8px 28px rgba(91,78,232,.38)',
            }}>H</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.5px' }}>{tx.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>{tx.subtitle}</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)', color: 'var(--danger)', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Prénom / Nom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <SLabel>{tx.firstname}</SLabel>
                <input style={inputStyle} placeholder="Prénom" value={form.firstname}
                  onChange={e => setForm(f => ({ ...f, firstname: e.target.value }))}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--p2)'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'} />
              </div>
              <div>
                <SLabel>{tx.lastname}</SLabel>
                <input style={inputStyle} placeholder="Nom" value={form.lastname}
                  onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--p2)'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'} />
              </div>
            </div>

            {/* Nom boutique */}
            <div>
              <SLabel>{tx.shopName}</SLabel>
              <input style={inputStyle} placeholder="Ex: Supermarché Central" value={form.shopName}
                onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--p2)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'} />
            </div>

            {/* Email */}
            <div>
              <SLabel>{tx.email}</SLabel>
              <input style={inputStyle} type="email" placeholder="vous@email.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--p2)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'} />
            </div>

            {/* Téléphone */}
            <div>
              <SLabel>{tx.phone}</SLabel>
              <PhoneInput value={form.phone} onChange={phone => setForm(f => ({ ...f, phone }))} placeholder="77 000 00 00" />
            </div>

            {/* Mot de passe */}
            <div>
              <SLabel>{tx.password}</SLabel>
              <input style={inputStyle} type="password" placeholder="Min. 8 caractères" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--p2)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'} />
              {form.password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < strength ? strengthColors[strength - 1] : 'var(--border)', transition: 'background .2s' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: strength > 0 ? strengthColors[strength - 1] : 'var(--text3)', fontWeight: 600 }}>
                    {strength > 0 ? strengthLabels[strength - 1] : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Confirmer */}
            <div>
              <SLabel>{tx.confirm}</SLabel>
              <input style={inputStyle} type="password" placeholder="Répétez le mot de passe" value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--p2)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'} />
            </div>

            {/* Type de commerce */}
            <div>
              <SLabel>{tx.businessType}</SLabel>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.businessType}
                onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Pays (dropdown personnalisé) + Devise */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Dropdown pays */}
              <div>
                <SLabel>{tx.country}</SLabel>
                <div ref={countryRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: 'var(--bg3)',
                      border: `1.5px solid ${showCountryDropdown ? 'var(--p2)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'var(--font)', fontSize: 14,
                      color: 'var(--text)', textAlign: 'left',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 10,
                      transition: 'border-color .15s', boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{selectedCountry.name}</span>
                    </div>
                    <span style={{
                      fontSize: 10, color: 'var(--text3)',
                      display: 'inline-block',
                      transform: showCountryDropdown ? 'rotate(180deg)' : 'none',
                      transition: 'transform .2s',
                    }}>▼</span>
                  </button>

                  {showCountryDropdown && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 999,
                      background: 'var(--card)', border: '1px solid var(--border2)',
                      borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.4)', overflow: 'hidden',
                    }}>
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ position: 'relative' }}>
                          <span style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 13, color: 'var(--text3)', pointerEvents: 'none',
                          }}>🔍</span>
                          <input
                            autoFocus
                            type="text"
                            placeholder={tx.searchCountry}
                            value={countrySearch}
                            onChange={e => setCountrySearch(e.target.value)}
                            style={{
                              width: '100%', padding: '8px 10px 8px 30px',
                              background: 'var(--bg3)', border: '1px solid var(--border)',
                              borderRadius: 8, fontSize: 12,
                              color: 'var(--text)', fontFamily: 'var(--font)',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filteredCountries.length === 0 ? (
                          <div style={{ padding: '18px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                            {tx.noCountry}
                          </div>
                        ) : filteredCountries.map(country => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, country: country.code }))
                              setShowCountryDropdown(false)
                              setCountrySearch('')
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              width: '100%', padding: '9px 14px',
                              background: form.country === country.code ? 'rgba(91,78,232,.1)' : 'transparent',
                              border: 'none', borderBottom: '1px solid var(--border)',
                              cursor: 'pointer', fontFamily: 'var(--font)',
                              fontSize: 13, textAlign: 'left', transition: 'background .1s',
                              color: form.country === country.code ? 'var(--p2)' : 'var(--text)',
                            }}
                            onMouseEnter={e => { if (form.country !== country.code) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                            onMouseLeave={e => { if (form.country !== country.code) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{country.flag}</span>
                            <span style={{ flex: 1, fontWeight: form.country === country.code ? 700 : 400 }}>{country.name}</span>
                            {form.country === country.code && <span style={{ color: 'var(--p2)', fontSize: 14 }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Devise */}
              <div>
                <SLabel>{tx.currency}</SLabel>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                  <option value="XOF">🌍 FCFA (XOF)</option>
                  <option value="XAF">🌍 FCFA (XAF)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="USD">🇺🇸 Dollar (USD)</option>
                  <option value="CAD">🇨🇦 CA Dollar (CAD)</option>
                </select>
              </div>
            </div>

            {/* CGU */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, background: 'rgba(91,78,232,.06)', border: '1px solid var(--border)' }}>
              <input type="checkbox" checked={form.acceptTerms}
                onChange={e => setForm(f => ({ ...f, acceptTerms: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--p)', width: 15, height: 15, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                {tx.terms}
              </span>
            </label>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', marginTop: 4,
                background: loading ? 'var(--bg4)' : 'linear-gradient(135deg,var(--p),var(--p2))',
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 800, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', transition: 'all .2s',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(91,78,232,.4)',
              }}
            >
              {loading ? tx.loading : tx.submit}
            </button>

            {/* Lien connexion */}
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', margin: 0 }}>
              {tx.login}{' '}
              <span onClick={() => navigate('/login')} style={{ color: 'var(--p2)', fontWeight: 700, cursor: 'pointer' }}>
                {tx.loginLink}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '16px', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
        © 2026 HabaShop · Logiciel SaaS pour commerces africains
      </div>
    </div>
  )
}
