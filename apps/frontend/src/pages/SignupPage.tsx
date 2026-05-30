import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import toast from 'react-hot-toast'
import { Check, Shield } from 'lucide-react'
import { TX, FONT, D } from '@/components/signup/signupShared'
import SignupBranding from '@/components/signup/SignupBranding'
import SignupStep1 from '@/components/signup/SignupStep1'
import SignupStep2 from '@/components/signup/SignupStep2'

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
  // La devise est auto-déduite du pays tant que l'utilisateur n'y a pas touché manuellement.
  const [currencyTouched, setCurrencyTouched] = useState(false)

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

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--public-bg)', fontFamily: FONT }} className="public-scope su-grid">

      {/* ════ LEFT: Branding ════ */}
      <SignupBranding tx={tx} i={i} navigate={navigate} />

      {/* ════ RIGHT: Form ════ */}
      <div className="su-right" style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px clamp(20px,4vw,56px)',
        background: 'var(--public-bg2)',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Steps indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22 }}>
            {[1, 2].map(s => {
              const active = step >= s
              const done = step > s
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: s < 2 ? 1 : 'none' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: active ? `linear-gradient(135deg,${D.p},${D.p2})` : 'rgba(255,255,255,.05)',
                    border: `2px solid ${active ? 'transparent' : D.border2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900,
                    color: active ? '#fff' : D.text4, transition: 'all .3s',
                    boxShadow: step === s ? '0 4px 14px rgba(124,58,237,.45)' : 'none',
                    flexShrink: 0,
                  }}>
                    {done ? <Check size={15} strokeWidth={3}/> : s}
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? D.p3 : D.text4, transition: 'color .3s' }}>
                    {s === 1 ? tx.step1_label : tx.step2_label}
                  </span>
                  {s < 2 && (
                    <div style={{
                      flex: 1, height: 2, borderRadius: 99, marginLeft: 4,
                      background: step > s ? 'var(--grad-hero)' : 'rgba(255,255,255,.08)',
                      transition: 'background .3s',
                    }}/>
                  )}
                </div>
              )
            })}
          </div>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h2 className="gold-text" style={{
              fontSize: 30, fontWeight: 900,
              letterSpacing: '-.8px', marginBottom: 6, lineHeight: 1.1,
            }}>
              {step === 1 ? tx.step1_head : tx.step2_head}
            </h2>
            <p style={{ fontSize: 13.5, color: D.text2 }}>
              {step === 1 ? tx.step1_sub : tx.step2_sub}
            </p>
          </div>

          {step === 1 && (
            <SignupStep1
              tx={tx} i={i} lang={lang}
              form={form} setForm={setForm}
              currencyTouched={currencyTouched} setCurrencyTouched={setCurrencyTouched}
              step1Valid={step1Valid} error={error}
              onNext={() => { setError(''); setStep(2) }}
            />
          )}

          {step === 2 && (
            <SignupStep2
              tx={tx} i={i}
              form={form} setForm={setForm}
              showPwd={showPwd} setShowPwd={setShowPwd}
              showConfirm={showConfirm} setShowConfirm={setShowConfirm}
              step2Valid={step2Valid} loading={loading} error={error}
              onSubmit={handleSubmit} onBack={() => setStep(1)}
            />
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
