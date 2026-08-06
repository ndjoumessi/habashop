import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import toast from 'react-hot-toast'
import { Check, Shield, AlertTriangle } from 'lucide-react'
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
      <SignupBranding tx={tx} navigate={navigate} />

      {/* ════ RIGHT: Form ════ */}
      <div className="su-right" style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px clamp(20px,4vw,56px)',
        background: 'var(--public-bg2)',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* ⚠️ La mention du paiement non actif est AU-DESSUS du formulaire et rendue à
              TOUTES les largeurs. Elle a d'abord été placée dans le panneau gauche — qui
              est `display:none` sous 880 px : elle aurait disparu précisément sur mobile,
              là où la majorité des commerçants ouvrent la page. Un visiteur arrivé par un
              lien direct vers /signup ne voit jamais la page tarifs ; il l'apprendrait
              sinon au 15ᵉ jour, après avoir saisi son stock et ses clients. */}
          <div role="note" style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
            padding: '11px 14px', borderRadius: 10,
            background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
          }}>
            <AlertTriangle size={15} strokeWidth={2.3} color="var(--acc3)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text2)' }}>
              {i(
                "L'essai de 14 jours est complet et sans carte. Le paiement en ligne n'est pas encore actif : pour continuer ensuite, le règlement se convient directement avec notre équipe.",
                'The 14-day trial is complete and needs no card. Online payment is not live yet: to continue afterwards, the payment is agreed directly with our team.',
                'La prueba de 14 días es completa y sin tarjeta. El pago en línea aún no está activo: para continuar después, el pago se acuerda directamente con nuestro equipo.',
                "La prova di 14 giorni è completa e senza carta. Il pagamento online non è ancora attivo: per continuare dopo, il pagamento si concorda direttamente con il nostro team.",
              )}
            </p>
          </div>

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
                    fontSize: 'var(--fs-sm)', fontWeight: 900,
                    color: active ? '#fff' : D.text4, transition: 'all .3s',
                    boxShadow: step === s ? '0 4px 14px rgba(124,58,237,.45)' : 'none',
                    flexShrink: 0,
                  }}>
                    {done ? <Check size={15} strokeWidth={3}/> : s}
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: active ? 'var(--p3)' : 'var(--text3)', transition: 'color .3s', whiteSpace: 'nowrap' }}>
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
            {/* ⚠️ UN SEUL ACCENT : `gold-text` opposait un titre ORANGE au violet du
                panneau et du bouton — deux accents concurrents, exactement le défaut
                corrigé sur la grille tarifaire. Le titre est neutre, l'accent reste au
                violet (progression d'étape, CTA). */}
            <h2 style={{
              fontSize: 27, fontWeight: 800, color: 'var(--text)',
              letterSpacing: '-.025em', marginBottom: 6, lineHeight: 1.12,
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

          {/* La mention sur le paiement non actif vit dans le panneau gauche
              (SignupBranding) : elle y est visible AVANT la soumission, et sur mobile le
              panneau se replie au-dessus du formulaire — donc elle reste lue en premier. */}
          {/* Footer link */}
          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 'var(--fs-sm)', color: D.text3 }}>
            {step === 1 ? (
              <>
                {tx.login_q}{' '}
                <button type="button" onClick={() => navigate('/login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.p3, fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: FONT, textDecoration: 'underline' }}>
                  {tx.login_link}
                </button>
              </>
            ) : (
              /* ⚠️ « Inscription sécurisée SSL/TLS » retirée : tout site en a un, ça ne
                 rassure personne et ça occupait une ligne. Même motif que les badges
                 SSL/TLS déjà retirés de la page de connexion. */
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: D.text4 }}>
                <Shield size={11}/>{i('Vos données restent les vôtres', 'Your data stays yours', 'Tus datos siguen siendo tuyos', 'I tuoi dati restano tuoi')}
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
