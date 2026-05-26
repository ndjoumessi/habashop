import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import type { Lang, Currency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import toast from 'react-hot-toast'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import {
  ShoppingCart, Store, User, Mail, Lock, Eye, EyeOff,
  Check, AlertCircle, ArrowRight, ArrowLeft, Loader2,
  Shield, MessageSquare, Globe, Coins, Search,
} from 'lucide-react'

type ST = {
  brand_title: string; brand_sub: string
  step1_label: string; step2_label: string
  step1_head: string; step1_sub: string
  step2_head: string; step2_sub: string
  shopName: string; ownerName: string; email: string; phone: string
  phone_hint: string; country: string; currency: string
  password: string; confirm: string
  shop_ph: string; owner_ph: string; email_ph: string
  password_ph: string; confirm_ph: string
  next_btn: string; next_disabled: string
  back: string; submit: string; loading: string
  terms_pre: string; terms_a: string; terms_and: string; terms_b: string
  pwd_weak: string; pwd_fair: string; pwd_good: string; pwd_excellent: string
  pwd_match: string; pwd_nomatch: string
  login_q: string; login_link: string; secure: string
  search_country: string; no_country: string
  errRequired: string; errPassword: string; errPasswordLen: string; errTerms: string
  adv_free: string; adv_secure: string; adv_whatsapp: string; adv_countries: string
}

const TX: Record<Lang, ST> = {
  fr: {
    brand_title: 'Rejoignez HabaShop',
    brand_sub: 'Créez votre boutique en ligne en 2 minutes et commencez à gérer votre commerce.',
    step1_label: 'Infos boutique', step2_label: 'Sécurité',
    step1_head: 'Votre boutique', step1_sub: 'Étape 1/2 — Informations générales',
    step2_head: 'Sécurisez votre compte', step2_sub: 'Étape 2/2 — Créez votre mot de passe',
    shopName: 'Nom de la boutique', ownerName: 'Votre nom complet',
    email: 'Adresse email', phone: 'Téléphone WhatsApp',
    phone_hint: 'Utilisé pour recevoir les tickets WhatsApp',
    country: 'Pays', currency: 'Devise',
    password: 'Mot de passe', confirm: 'Confirmer le mot de passe',
    shop_ph: 'Ex: Boutique Aminata', owner_ph: 'Ex: Aminata Koné',
    email_ph: 'vous@exemple.com',
    password_ph: '8 caractères minimum', confirm_ph: 'Répétez le mot de passe',
    next_btn: 'Continuer', next_disabled: 'Remplissez tous les champs',
    back: 'Retour', submit: 'Créer mon compte HabaShop', loading: 'Création du compte…',
    terms_pre: "J'accepte les ", terms_a: 'Conditions Générales',
    terms_and: ' et la ', terms_b: 'Politique de confidentialité',
    pwd_weak: 'Faible', pwd_fair: 'Moyen', pwd_good: 'Bon', pwd_excellent: 'Excellent',
    pwd_match: 'Les mots de passe correspondent', pwd_nomatch: 'Les mots de passe ne correspondent pas',
    login_q: 'Déjà un compte ?', login_link: 'Se connecter',
    secure: 'Inscription sécurisée SSL/TLS',
    search_country: 'Rechercher un pays…', no_country: 'Aucun pays trouvé',
    errRequired: 'Veuillez remplir tous les champs obligatoires',
    errPassword: 'Les mots de passe ne correspondent pas',
    errPasswordLen: 'Le mot de passe doit contenir au moins 8 caractères',
    errTerms: 'Vous devez accepter les CGU',
    adv_free: '14 jours gratuits sans carte bancaire',
    adv_secure: 'Données sécurisées SSL/TLS',
    adv_whatsapp: 'Support WhatsApp inclus',
    adv_countries: '150+ pays, 6 devises supportées',
  },
  en: {
    brand_title: 'Join HabaShop',
    brand_sub: 'Create your online store in 2 minutes and start managing your business.',
    step1_label: 'Shop info', step2_label: 'Security',
    step1_head: 'Your shop', step1_sub: 'Step 1/2 — General information',
    step2_head: 'Secure your account', step2_sub: 'Step 2/2 — Create your password',
    shopName: 'Shop name', ownerName: 'Your full name',
    email: 'Email address', phone: 'WhatsApp phone',
    phone_hint: 'Used to receive WhatsApp receipts',
    country: 'Country', currency: 'Currency',
    password: 'Password', confirm: 'Confirm password',
    shop_ph: 'Ex: Aminata Store', owner_ph: 'Ex: Aminata Koné',
    email_ph: 'you@example.com',
    password_ph: '8 characters minimum', confirm_ph: 'Repeat the password',
    next_btn: 'Continue', next_disabled: 'Fill in all fields',
    back: 'Back', submit: 'Create my HabaShop account', loading: 'Creating account…',
    terms_pre: 'I accept the ', terms_a: 'Terms of Service',
    terms_and: ' and the ', terms_b: 'Privacy Policy',
    pwd_weak: 'Weak', pwd_fair: 'Fair', pwd_good: 'Good', pwd_excellent: 'Excellent',
    pwd_match: 'Passwords match', pwd_nomatch: 'Passwords do not match',
    login_q: 'Already have an account?', login_link: 'Sign in',
    secure: 'Secure SSL/TLS signup',
    search_country: 'Search a country…', no_country: 'No country found',
    errRequired: 'Please fill in all required fields',
    errPassword: 'Passwords do not match',
    errPasswordLen: 'Password must be at least 8 characters',
    errTerms: 'You must accept the terms',
    adv_free: '14 days free, no credit card',
    adv_secure: 'Secure SSL/TLS data',
    adv_whatsapp: 'WhatsApp support included',
    adv_countries: '150+ countries, 6 currencies',
  },
  es: {
    brand_title: 'Únete a HabaShop',
    brand_sub: 'Crea tu tienda online en 2 minutos y empieza a gestionar tu negocio.',
    step1_label: 'Info tienda', step2_label: 'Seguridad',
    step1_head: 'Tu tienda', step1_sub: 'Paso 1/2 — Información general',
    step2_head: 'Asegura tu cuenta', step2_sub: 'Paso 2/2 — Crea tu contraseña',
    shopName: 'Nombre de la tienda', ownerName: 'Tu nombre completo',
    email: 'Dirección email', phone: 'Teléfono WhatsApp',
    phone_hint: 'Usado para recibir tickets por WhatsApp',
    country: 'País', currency: 'Divisa',
    password: 'Contraseña', confirm: 'Confirmar contraseña',
    shop_ph: 'Ej: Tienda Aminata', owner_ph: 'Ej: Aminata Koné',
    email_ph: 'tu@ejemplo.com',
    password_ph: '8 caracteres mínimo', confirm_ph: 'Repite la contraseña',
    next_btn: 'Continuar', next_disabled: 'Rellena todos los campos',
    back: 'Atrás', submit: 'Crear mi cuenta HabaShop', loading: 'Creando cuenta…',
    terms_pre: 'Acepto los ', terms_a: 'Términos y Condiciones',
    terms_and: ' y la ', terms_b: 'Política de Privacidad',
    pwd_weak: 'Débil', pwd_fair: 'Regular', pwd_good: 'Buena', pwd_excellent: 'Excelente',
    pwd_match: 'Las contraseñas coinciden', pwd_nomatch: 'Las contraseñas no coinciden',
    login_q: '¿Ya tienes cuenta?', login_link: 'Iniciar sesión',
    secure: 'Registro seguro SSL/TLS',
    search_country: 'Buscar un país…', no_country: 'Ningún país encontrado',
    errRequired: 'Por favor completa todos los campos obligatorios',
    errPassword: 'Las contraseñas no coinciden',
    errPasswordLen: 'La contraseña debe tener al menos 8 caracteres',
    errTerms: 'Debes aceptar los términos',
    adv_free: '14 días gratis sin tarjeta',
    adv_secure: 'Datos seguros SSL/TLS',
    adv_whatsapp: 'Soporte WhatsApp incluido',
    adv_countries: '150+ países, 6 divisas',
  },
  it: {
    brand_title: 'Unisciti a HabaShop',
    brand_sub: 'Crea il tuo negozio online in 2 minuti e inizia a gestire la tua attività.',
    step1_label: 'Info negozio', step2_label: 'Sicurezza',
    step1_head: 'Il tuo negozio', step1_sub: 'Passo 1/2 — Informazioni generali',
    step2_head: 'Proteggi il tuo account', step2_sub: 'Passo 2/2 — Crea la tua password',
    shopName: 'Nome del negozio', ownerName: 'Il tuo nome completo',
    email: 'Indirizzo email', phone: 'Telefono WhatsApp',
    phone_hint: 'Usato per ricevere gli scontrini WhatsApp',
    country: 'Paese', currency: 'Valuta',
    password: 'Password', confirm: 'Conferma password',
    shop_ph: 'Es: Negozio Aminata', owner_ph: 'Es: Aminata Koné',
    email_ph: 'tu@esempio.com',
    password_ph: '8 caratteri minimo', confirm_ph: 'Ripeti la password',
    next_btn: 'Continua', next_disabled: 'Compila tutti i campi',
    back: 'Indietro', submit: 'Crea il mio account HabaShop', loading: 'Creazione account…',
    terms_pre: 'Accetto i ', terms_a: 'Termini di Servizio',
    terms_and: ' e la ', terms_b: 'Privacy Policy',
    pwd_weak: 'Debole', pwd_fair: 'Discreto', pwd_good: 'Buono', pwd_excellent: 'Eccellente',
    pwd_match: 'Le password corrispondono', pwd_nomatch: 'Le password non corrispondono',
    login_q: 'Hai già un account?', login_link: 'Accedi',
    secure: 'Registrazione sicura SSL/TLS',
    search_country: 'Cerca un paese…', no_country: 'Nessun paese trovato',
    errRequired: 'Compila tutti i campi obbligatori',
    errPassword: 'Le password non corrispondono',
    errPasswordLen: 'La password deve contenere almeno 8 caratteri',
    errTerms: 'Devi accettare i termini',
    adv_free: '14 giorni gratis senza carta',
    adv_secure: 'Dati sicuri SSL/TLS',
    adv_whatsapp: 'Supporto WhatsApp incluso',
    adv_countries: '150+ paesi, 6 valute',
  },
}

const COUNTRIES = [
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
  { code: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', flag: '🇨🇭', name: 'Suisse' },
  { code: 'ES', flag: '🇪🇸', name: 'España' },
  { code: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Deutschland' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'US', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'OTHER', flag: '🌍', name: 'Autre' },
]

const D = {
  bg:      '#07070F',
  bg2:     '#0D0D1C',
  bg3:     '#111128',
  bg4:     '#161636',
  p:       '#6C47FF',
  p2:      '#8B6FFF',
  p3:      '#A991FF',
  text:    '#F0F0FF',
  text2:   'rgba(240,240,255,.66)',
  text3:   'rgba(240,240,255,.42)',
  text4:   'rgba(240,240,255,.22)',
  border:  'rgba(255,255,255,.08)',
  border2: 'rgba(255,255,255,.15)',
  acc:     '#00D084',
  acc2:    '#00B8FF',
  acc3:    '#FF9500',
  warn:    '#FBBF24',
  danger:  '#FF3B5C',
}

const FONT = "'Outfit', system-ui, -apple-system, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

function getStrength(pwd: string): number {
  if (pwd.length < 4) return 0
  let s = 0
  if (pwd.length >= 8)             s++
  if (/[A-Z]/.test(pwd))           s++
  if (/[0-9]/.test(pwd))           s++
  if (/[^A-Za-z0-9]/.test(pwd))    s++
  return s
}

export default function SignupPage() {
  const navigate = useNavigate()
  const { lang } = useAppStore()
  const { register } = useAuthStore()
  const { i } = useI18n()
  const tx = TX[lang] ?? TX.fr

  const [form, setForm] = useState({
    shopName:   '',
    ownerName:  '',
    email:      '',
    phone:      '+221',
    password:   '',
    confirmPwd: '',
    currency:   'XOF' as Currency,
    country:    'SN',
    acceptTerms: false,
  })
  const [step,        setStep]        = useState<1 | 2>(1)
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  // Country dropdown
  const [showCountry, setShowCountry] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setShowCountry(false); setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  )
  const selectedCountry = COUNTRIES.find(c => c.code === form.country) ?? COUNTRIES[0]

  // Phone digit count (after country code)
  const phoneDigits = form.phone.replace(/^\+?\d{1,4}/, '').replace(/\D/g, '').length

  const step1Valid =
    form.shopName.trim().length  >= 2 &&
    form.ownerName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    phoneDigits >= 6

  const step2Valid =
    form.password.length >= 8 &&
    form.password === form.confirmPwd &&
    form.acceptTerms

  const strength = getStrength(form.password)
  const strengthColors = ['', D.danger, D.warn, D.acc2, D.acc]
  const strengthLabel = ['', tx.pwd_weak, tx.pwd_fair, tx.pwd_good, tx.pwd_excellent][strength]

  const handleSubmit = async () => {
    setError('')
    if (!step2Valid) {
      if (form.password.length < 8)            setError(tx.errPasswordLen)
      else if (form.password !== form.confirmPwd) setError(tx.errPassword)
      else if (!form.acceptTerms)              setError(tx.errTerms)
      return
    }
    setLoading(true)
    try {
      await register({
        name:     form.ownerName,
        email:    form.email,
        password: form.password,
        shopName: form.shopName,
        currency: form.currency,
        country:  form.country,
      })
      toast.success(i('Bienvenue sur HabaShop', 'Welcome to HabaShop', 'Bienvenido a HabaShop', 'Benvenuto su HabaShop'))
      navigate('/onboarding')
    } catch (err: any) {
      setError(err?.message || tx.errRequired)
    } finally {
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: D.bg4,
    border: `1.5px solid ${D.border2}`,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: FONT,
    color: D.text,
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    boxSizing: 'border-box',
  }

  const focusOn = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = D.p2
    e.target.style.boxShadow = '0 0 0 3px rgba(124,111,240,.15)'
  }
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = D.border2
    e.target.style.boxShadow = 'none'
  }

  const Label = ({ icon: Icon, children }: { icon: React.ComponentType<any>; children: React.ReactNode }) => (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 10, fontWeight: 800, color: D.text3,
      textTransform: 'uppercase', letterSpacing: '.6px',
      marginBottom: 6,
    }}>
      <Icon size={11} strokeWidth={2.4}/>{children}
    </label>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: D.bg, fontFamily: FONT }} className="su-grid">

      {/* ════ LEFT: Branding ════ */}
      <div className="su-left" style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg,${D.bg} 0%,${D.bg2} 50%,#0A0718 100%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(108,71,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(108,71,255,.07) 1px,transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
        }}/>
        {/* Orbs */}
        <div style={{ position: 'absolute', top: '12%', left: '20%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,71,255,.2),transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', animation: 'su-float 7s ease-in-out infinite' }}/>
        <div style={{ position: 'absolute', bottom: '18%', right: '15%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,208,132,.14),transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none', animation: 'su-float 9s ease-in-out infinite reverse' }}/>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>
          {/* Logo */}
          <button type="button" onClick={() => navigate('/')}
            aria-label={i('Accueil HabaShop', 'HabaShop home', 'Inicio HabaShop', 'Home HabaShop')}
            style={{
              width: 72, height: 72, borderRadius: 22,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 22px', color: '#fff', cursor: 'pointer', border: 'none',
              boxShadow: '0 16px 48px rgba(108,71,255,.5)',
              transition: 'transform .2s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
          >
            <ShoppingCart size={32} strokeWidth={2.4}/>
          </button>

          <h1 style={{ fontSize: 30, fontWeight: 900, color: D.text, letterSpacing: '-1px', marginBottom: 12, lineHeight: 1.1 }}>
            {tx.brand_title.split(' ').slice(0, -1).join(' ')}{' '}
            <span style={{ background: `linear-gradient(135deg,${D.p2},${D.p3})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HabaShop
            </span>
          </h1>
          <p style={{ fontSize: 14, color: D.text2, lineHeight: 1.7, marginBottom: 32 }}>
            {tx.brand_sub}
          </p>

          {/* Progress steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            {[1, 2].map(s => {
              const active = step >= s
              const done = step > s
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: active ? `linear-gradient(135deg,${D.p},${D.p2})` : 'rgba(255,255,255,.06)',
                    border: `2px solid ${active ? 'transparent' : D.border2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900,
                    color: active ? '#fff' : D.text4, transition: 'all .3s',
                    boxShadow: step === s ? '0 4px 14px rgba(108,71,255,.45)' : 'none',
                  }}>
                    {done ? <Check size={15} strokeWidth={3}/> : s}
                  </div>
                  {s < 2 && (
                    <div style={{
                      width: 42, height: 2, borderRadius: 99,
                      background: step > s ? D.p : 'rgba(255,255,255,.1)',
                      transition: 'background .3s',
                    }}/>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 32 }}>
            {[
              { n: 1, label: tx.step1_label },
              { n: 2, label: tx.step2_label },
            ].map(s => (
              <div key={s.n} style={{
                fontSize: 11, fontWeight: 700,
                color: step >= s.n ? D.p3 : D.text4,
                transition: 'color .3s',
              }}>{s.label}</div>
            ))}
          </div>

          {/* Advantages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { Icon: Check,         label: tx.adv_free,      color: D.acc  },
              { Icon: Shield,        label: tx.adv_secure,    color: D.acc2 },
              { Icon: MessageSquare, label: tx.adv_whatsapp,  color: '#25D366' },
              { Icon: Globe,         label: tx.adv_countries, color: D.acc3 },
            ].map(a => (
              <div key={a.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                background: 'rgba(255,255,255,.04)',
                border: `1px solid ${D.border}`,
                borderRadius: 10, textAlign: 'left',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: `${a.color}1F`, color: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <a.Icon size={12} strokeWidth={2.4}/>
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: D.text2 }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════ RIGHT: Form ════ */}
      <div className="su-right" style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px clamp(20px,4vw,56px)',
        background: D.bg2,
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 900, color: D.text,
              letterSpacing: '-.5px', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10,
                background: `${D.p}22`, color: D.p3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step === 1 ? <Store size={18} strokeWidth={2.4}/> : <Lock size={18} strokeWidth={2.4}/>}
              </span>
              {step === 1 ? tx.step1_head : tx.step2_head}
            </h2>
            <p style={{ fontSize: 13, color: D.text3, paddingLeft: 44 }}>
              {step === 1 ? tx.step1_sub : tx.step2_sub}
            </p>
          </div>

          {/* ════ STEP 1 ════ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Shop name */}
              <div>
                <Label icon={Store}>{tx.shopName} *</Label>
                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder={tx.shop_ph}
                    value={form.shopName}
                    onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={inputBase}/>
                  {form.shopName.trim().length >= 2 && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: D.acc, display: 'flex' }}>
                      <Check size={14} strokeWidth={3}/>
                    </span>
                  )}
                </div>
              </div>

              {/* Owner name */}
              <div>
                <Label icon={User}>{tx.ownerName} *</Label>
                <input type="text" placeholder={tx.owner_ph}
                  value={form.ownerName}
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                  onFocus={focusOn} onBlur={focusOff}
                  style={inputBase}/>
              </div>

              {/* Email */}
              <div>
                <Label icon={Mail}>{tx.email} *</Label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type="email" placeholder={tx.email_ph}
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{ ...inputBase, paddingLeft: 38 }}/>
                </div>
              </div>

              {/* Phone (PhoneInputWithCountry) */}
              <div>
                <Label icon={MessageSquare}>{tx.phone} *</Label>
                <PhoneInputWithCountry
                  value={form.phone}
                  onChange={phone => setForm(f => ({ ...f, phone }))}
                  placeholder="77 000 00 00"
                  lang={lang}
                />
                <div style={{ marginTop: 5, fontSize: 10.5, color: D.text3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MessageSquare size={11} color="#25D366"/>{tx.phone_hint}
                </div>
              </div>

              {/* Country + Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Country */}
                <div>
                  <Label icon={Globe}>{tx.country}</Label>
                  <div ref={countryRef} style={{ position: 'relative' }}>
                    <button type="button"
                      onClick={() => setShowCountry(!showCountry)}
                      style={{
                        width: '100%', padding: '11px 14px',
                        background: D.bg4,
                        border: `1.5px solid ${showCountry ? D.p2 : D.border2}`,
                        borderRadius: 10, cursor: 'pointer',
                        fontFamily: FONT, fontSize: 13,
                        color: D.text, textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        transition: 'border-color .15s', boxSizing: 'border-box',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ fontSize: 16 }}>{selectedCountry.flag}</span>
                        <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCountry.name}</span>
                      </div>
                      <span style={{ fontSize: 9, color: D.text3, transform: showCountry ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block', flexShrink: 0 }}>▼</span>
                    </button>

                    {showCountry && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 999,
                        background: D.bg2, border: `1px solid ${D.border2}`,
                        borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.6)', overflow: 'hidden',
                      }}>
                        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${D.border}` }}>
                          <div style={{ position: 'relative' }}>
                            <Search size={13} color={D.text3} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}/>
                            <input autoFocus type="text" aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={tx.search_country}
                              value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                              style={{
                                width: '100%', padding: '7px 10px 7px 30px',
                                background: D.bg4, border: `1px solid ${D.border}`,
                                borderRadius: 8, fontSize: 12,
                                color: D.text, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
                              }}/>
                          </div>
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                          {filteredCountries.length === 0 ? (
                            <div style={{ padding: 18, textAlign: 'center', color: D.text3, fontSize: 12 }}>
                              {tx.no_country}
                            </div>
                          ) : filteredCountries.map(c => (
                            <button key={c.code} type="button"
                              onMouseDown={() => {
                                setForm(f => ({ ...f, country: c.code }))
                                setShowCountry(false); setCountrySearch('')
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '9px 14px',
                                background: form.country === c.code ? 'rgba(108,71,255,.12)' : 'transparent',
                                border: 'none', borderBottom: `1px solid ${D.border}`,
                                cursor: 'pointer', fontFamily: FONT,
                                fontSize: 12, textAlign: 'left',
                                color: form.country === c.code ? D.p3 : D.text,
                              }}
                              onMouseEnter={e => { if (form.country !== c.code) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                              onMouseLeave={e => { if (form.country !== c.code) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                              <span style={{ fontSize: 16 }}>{c.flag}</span>
                              <span style={{ flex: 1, fontWeight: form.country === c.code ? 700 : 500 }}>{c.name}</span>
                              {form.country === c.code && <Check size={13} color={D.p3} strokeWidth={3}/>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <Label icon={Coins}>{tx.currency}</Label>
                  <select value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{ ...inputBase, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A991FF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
                    }}>
                    <option value="XOF">XOF — {i('F CFA Ouest', 'West CFA Franc', 'Franco CFA Oeste', 'Franco CFA Ovest')}</option>
                    <option value="XAF">XAF — {i('F CFA Centre', 'Central CFA Franc', 'Franco CFA Central', 'Franco CFA Centrale')}</option>
                    <option value="EUR">EUR — {i('Euro', 'Euro', 'Euro', 'Euro')}</option>
                    <option value="USD">USD — {i('Dollar US', 'US Dollar', 'Dólar estadounidense', 'Dollaro USA')}</option>
                    <option value="CAD">CAD — {i('Dollar CA', 'Canadian Dollar', 'Dólar canadiense', 'Dollaro canadese')}</option>
                    <option value="GBP">GBP — {i('Livre Sterling', 'Pound Sterling', 'Libra esterlina', 'Sterlina')}</option>
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.25)', color: D.danger, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Next */}
              <button type="button" disabled={!step1Valid}
                onClick={() => { setError(''); setStep(2) }}
                style={{
                  width: '100%', padding: '14px', marginTop: 4,
                  background: step1Valid ? `linear-gradient(135deg,${D.p},${D.p2})` : 'rgba(255,255,255,.05)',
                  border: step1Valid ? 'none' : `1px solid ${D.border}`,
                  borderRadius: 12,
                  color: step1Valid ? '#fff' : D.text4,
                  fontSize: 14, fontWeight: 800,
                  cursor: step1Valid ? 'pointer' : 'not-allowed',
                  fontFamily: FONT,
                  boxShadow: step1Valid ? '0 6px 20px rgba(108,71,255,.4)' : 'none',
                  transition: 'all .2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (step1Valid) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {step1Valid ? <>{tx.next_btn}<ArrowRight size={15}/></> : tx.next_disabled}
              </button>
            </div>
          )}

          {/* ════ STEP 2 ════ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Recap */}
              <div style={{
                padding: '12px 14px',
                background: 'rgba(0,208,132,.07)',
                border: '1px solid rgba(0,208,132,.2)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,208,132,.18)', color: D.acc, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={14} strokeWidth={3}/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: D.acc, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.shopName}
                  </div>
                  <div style={{ fontSize: 11, color: D.text3, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.email} · {form.phone}
                  </div>
                </div>
                <button type="button" onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 11, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
                  {tx.back}
                </button>
              </div>

              {/* Password */}
              <div>
                <Label icon={Lock}>{tx.password} *</Label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type={showPwd ? 'text' : 'password'} placeholder={tx.password_ph}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{ ...inputBase, paddingLeft: 38, paddingRight: 44 }}/>
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    aria-label={i('Afficher/masquer le mot de passe', 'Toggle password', 'Mostrar/ocultar contraseña', 'Mostra/nascondi password')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.text3, display: 'flex', padding: 4 }}>
                    {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4].map(lvl => (
                        <div key={lvl} style={{
                          flex: 1, height: 4, borderRadius: 99,
                          background: strength >= lvl ? strengthColors[strength] : 'rgba(255,255,255,.08)',
                          transition: 'all .3s',
                        }}/>
                      ))}
                    </div>
                    <span style={{ fontSize: 10.5, color: strength > 0 ? strengthColors[strength] : D.text3, fontWeight: 700 }}>
                      {strengthLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <Label icon={Lock}>{tx.confirm} *</Label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type={showConfirm ? 'text' : 'password'} placeholder={tx.confirm_ph}
                    value={form.confirmPwd}
                    onChange={e => setForm(f => ({ ...f, confirmPwd: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{
                      ...inputBase, paddingLeft: 38, paddingRight: 44,
                      borderColor: form.confirmPwd.length > 0
                        ? (form.password === form.confirmPwd ? 'rgba(0,208,132,.45)' : 'rgba(255,59,92,.45)')
                        : D.border2,
                    }}/>
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={i('Afficher/masquer la confirmation', 'Toggle confirm', 'Mostrar/ocultar confirmación', 'Mostra/nascondi conferma')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.text3, display: 'flex', padding: 4 }}>
                    {showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {form.confirmPwd.length > 0 && (
                  <div style={{ fontSize: 10.5, marginTop: 5, fontWeight: 700, color: form.password === form.confirmPwd ? D.acc : D.danger, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {form.password === form.confirmPwd
                      ? <><Check size={11} strokeWidth={3}/>{tx.pwd_match}</>
                      : <><AlertCircle size={11}/>{tx.pwd_nomatch}</>}
                  </div>
                )}
              </div>

              {/* Terms */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px',
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${form.acceptTerms ? 'rgba(0,208,132,.3)' : D.border}`,
                borderRadius: 12, cursor: 'pointer',
                transition: 'all .15s',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: form.acceptTerms ? D.acc : 'rgba(255,255,255,.06)',
                  border: `2px solid ${form.acceptTerms ? D.acc : D.border2}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1, transition: 'all .2s',
                }}>
                  {form.acceptTerms && <Check size={12} strokeWidth={3} color="#fff"/>}
                </div>
                <input type="checkbox" checked={form.acceptTerms}
                  onChange={e => setForm(f => ({ ...f, acceptTerms: e.target.checked }))}
                  style={{ display: 'none' }}/>
                <span style={{ fontSize: 12, color: D.text2, lineHeight: 1.5 }}>
                  {tx.terms_pre}
                  <a href="#" style={{ color: D.p3, textDecoration: 'underline' }}>{tx.terms_a}</a>
                  {tx.terms_and}
                  <a href="#" style={{ color: D.p3, textDecoration: 'underline' }}>{tx.terms_b}</a>
                </span>
              </label>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.25)', color: D.danger, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Submit */}
              <button type="button" disabled={!step2Valid || loading}
                onClick={handleSubmit}
                style={{
                  width: '100%', padding: '14px', marginTop: 4,
                  background: step2Valid && !loading ? `linear-gradient(135deg,${D.p},${D.p2})` : 'rgba(255,255,255,.05)',
                  border: 'none', borderRadius: 12,
                  color: step2Valid && !loading ? '#fff' : D.text4,
                  fontSize: 14, fontWeight: 800,
                  cursor: step2Valid && !loading ? 'pointer' : 'not-allowed',
                  fontFamily: FONT,
                  boxShadow: step2Valid && !loading ? '0 6px 20px rgba(108,71,255,.4)' : 'none',
                  transition: 'all .2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (step2Valid && !loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {loading
                  ? <><Loader2 size={15} className="su-spin"/>{tx.loading}</>
                  : <>{tx.submit}<ArrowRight size={15}/></>}
              </button>

              <button type="button" onClick={() => setStep(1)}
                style={{
                  width: '100%', padding: '10px',
                  background: 'transparent', border: 'none',
                  color: D.text3, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <ArrowLeft size={14}/>{tx.back}
              </button>
            </div>
          )}

          {/* Footer link */}
          <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: D.text3 }}>
            {step === 1 ? (
              <>
                {tx.login_q}{' '}
                <button type="button" onClick={() => navigate('/login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.p3, fontSize: 13, fontWeight: 700, fontFamily: FONT, textDecoration: 'underline' }}>
                  {tx.login_link}
                </button>
              </>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: D.text4 }}>
                <Shield size={11}/>{tx.secure}
              </span>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes su-float {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-18px) }
        }
        @keyframes su-spin { to { transform: rotate(360deg) } }
        .su-spin { animation: su-spin 1s linear infinite; }
        @media (max-width: 880px) {
          .su-grid { grid-template-columns: 1fr !important; }
          .su-left { display: none !important; }
          .su-right { min-height: 100vh; padding: 32px 20px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important }
        }
      `}</style>
    </div>
  )
}
