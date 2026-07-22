import { useState, useRef, lazy, Suspense } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore, landingFor } from '@/stores/authStore'
import LogoMark from '@/components/ui/LogoMark'
import { useI18n } from '@/hooks/useI18n'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Store, WifiOff } from 'lucide-react'

/**
 * Page de connexion — refonte 2026-07 (formulaire héros, 100 % tokens CSS).
 *
 * Trois corrections de fond appliquées avec la refonte :
 *  • le raccourci « connexion par rôle » ne s'affiche plus qu'en démo (VITE_DEMO_MODE) ;
 *  • « Déployé dans 150+ pays » retiré (revendication fausse : une poignée de boutiques) ;
 *  • badges SSL/TLS retirés (page + pied) — le chiffrement est un acquis, pas un argument.
 *
 * Le volet gauche ne liste plus de fonctionnalités génériques : une accroche, un aperçu
 * produit fidèle, et des capacités factuelles (moyens de paiement réellement intégrés,
 * devises, langues). Plus de dégradé violet en dur → tokens `var(--…)`, donc lisible en
 * thème Clair comme en Sombre.
 */

// Replié au build : en production la valeur est absente → `false` → le module démo
// (et le mot de passe qu'il contient) sort du bundle livré.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1'
// ⚠️ Le `import()` doit vivre DANS la branche : un `lazy(() => import(…))` inconditionnel
// laisse Rollup émettre le chunk même quand le rendu est gaté, et le mot de passe démo
// reste livré en prod. Replié à `null` au build, l'import disparaît (cf. verify:demo-flag).
const DemoRoleLogin = DEMO_MODE ? lazy(() => import('@/components/login/DemoRoleLogin')) : null

export default function LoginPage() {
  const navigate              = useNavigate()
  const { login, clearError } = useAuthStore()
  const { i }                 = useI18n()

  const emailRef = useRef<HTMLInputElement>(null)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [demoRole, setDemoRole] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [error,    setError]    = useState('')

  const busy    = loading || !!demoRole
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  const doLogin = async (mail: string, pwd: string) => {
    setError('')
    clearError()
    await login(mail, pwd)
    const { tenants, activeTenantId, user } = useAuthStore.getState()
    if (tenants.length === 0) {
      setError(i('Aucune boutique associée à ce compte','No shop linked to this account','Ninguna tienda asociada a esta cuenta','Nessun negozio associato a questo account'))
      return
    }
    // Opérateur SaaS (isPlatformAdmin) → console plateforme, jamais le sélecteur
    // ni l'app commerçant (critère EN PARALLÈLE du rôle, cf. landingFor).
    if (user?.isPlatformAdmin === true) {
      toast.success(i('Connexion réussie','Signed in','Sesión iniciada','Accesso riuscito'))
      navigate('/admin')
      return
    }
    if (tenants.length > 1 && !activeTenantId) {
      navigate('/select-shop')
      return
    }
    toast.success(i('Connexion réussie','Signed in','Sesión iniciada','Accesso riuscito'))
    navigate(landingFor(user))
  }

  /** Échec de connexion : message inline + focus rendu au premier champ. */
  const fail = (err: any, fallback: string) => {
    setError(err?.message || fallback)
    emailRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      await doLogin(email, password)
    } catch (err: any) {
      fail(err, i('E-mail ou mot de passe incorrect. Vérifiez vos identifiants et réessayez.','Incorrect email or password. Check your credentials and try again.','Correo o contraseña incorrectos. Comprueba tus credenciales e inténtalo de nuevo.','Email o password non corretti. Controlla le credenziali e riprova.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDemoRole = async (key: string, mail: string, pwd: string) => {
    if (busy) return
    setEmail(mail)
    setPassword(pwd)
    setDemoRole(key)
    try {
      await doLogin(mail, pwd)
    } catch (err: any) {
      fail(err, i('Connexion démo indisponible','Demo login unavailable','Acceso demo no disponible','Accesso demo non disponibile'))
    } finally {
      setDemoRole(null)
    }
  }

  const handleForgot = () => {
    toast(i(
      'Contactez votre administrateur ou support@habashop.com pour réinitialiser votre mot de passe.',
      'Contact your administrator or support@habashop.com to reset your password.',
      'Contacta a tu administrador o support@habashop.com para restablecer tu contraseña.',
      'Contatta il tuo amministratore o support@habashop.com per reimpostare la password.',
    ), { duration: 5000 })
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 7,
  }
  const iconStyle: React.CSSProperties = {
    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text3)', pointerEvents: 'none', display: 'flex', alignItems: 'center',
  }

  return (
    <div className="login-grid" style={{
      minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr .95fr',
      background: 'var(--bg)', fontFamily: 'var(--font)',
    }}>

      {/* ── Volet gauche : preuve de valeur (masqué < 900px) ── */}
      <aside className="login-brand" style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(158deg,var(--bg) 0%,var(--bg2) 58%,var(--bg) 100%)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 30, padding: 'clamp(32px,4vw,56px)',
      }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(color-mix(in srgb,var(--p) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--p) 7%,transparent) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 85% 75% at 40% 45%,black 25%,transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 40% 45%,black 25%,transparent 100%)',
        }}/>
        <div aria-hidden="true" style={{ position: 'absolute', top: '-6%', left: '-4%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--p) 20%,transparent),transparent 70%)', filter: 'blur(56px)', pointerEvents: 'none' }}/>
        <div aria-hidden="true" style={{ position: 'absolute', bottom: '-4%', right: '2%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--acc) 13%,transparent),transparent 70%)', filter: 'blur(56px)', pointerEvents: 'none' }}/>

        <Link to="/" aria-label={i('Retour à l\'accueil','Back to home','Volver al inicio','Torna alla home')} style={{
          position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 11,
          textDecoration: 'none', width: 'fit-content',
        }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', display: 'flex', flexShrink: 0, boxShadow: 'var(--sh-p, 0 8px 26px rgba(108,71,255,.35))' }}>
            <LogoMark />
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--text)' }}>HabaShop</span>
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: 'clamp(25px,2.6vw,33px)', lineHeight: 1.16, letterSpacing: '-.028em',
            fontWeight: 700, color: 'var(--text)', margin: 0, maxWidth: '15ch',
          }}>
            {i('La caisse qui continue quand le ','The till that keeps going when the ','La caja que sigue cuando la ','La cassa che continua quando la ')}
            <span style={{ color: 'var(--p3)' }}>
              {i('réseau s\'arrête','network stops','red se cae','rete si ferma')}
            </span>.
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', margin: '10px 0 0', maxWidth: '40ch' }}>
            {i(
              'Ventes, stock et encaissement Mobile Money — la boutique ne s\'arrête pas parce que la connexion tombe.',
              'Sales, stock and Mobile Money payments — the shop doesn\'t stop because the connection does.',
              'Ventas, stock y cobro Mobile Money — la tienda no se detiene porque se caiga la conexión.',
              'Vendite, magazzino e incassi Mobile Money — il negozio non si ferma perché cade la connessione.',
            )}
          </p>
        </div>

        {/* Aperçu produit — panier POS fidèle, purement décoratif pour un lecteur d'écran */}
        <div
          role="img"
          aria-label={i('Aperçu du point de vente','Point of sale preview','Vista previa del punto de venta','Anteprima del punto vendita')}
          style={{
            position: 'relative', zIndex: 1, maxWidth: 400,
            border: '1px solid var(--border2)', borderRadius: 15, background: 'var(--card)',
            overflow: 'hidden', boxShadow: 'var(--sh-md, 0 20px 50px rgba(0,0,0,.3))',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
            <Store size={14} strokeWidth={2} color="var(--text3)" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>Dakar Central</span>
            <span style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
              color: 'var(--acc)', background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
            }}>
              <WifiOff size={11} strokeWidth={2.4} />
              {i('Hors-ligne — vente enregistrée','Offline — sale recorded','Sin conexión — venta registrada','Offline — vendita registrata')}
            </span>
          </div>
          <div style={{ padding: '12px 14px 14px' }}>
            {[
              { n: 'Riz local 25kg',      q: '1 × 11 000', a: '11 000' },
              { n: 'Café Touba 250g',     q: '2 × 1 300',  a: '2 600' },
              { n: 'Savon de Marseille',  q: '1 × 500',    a: '500' },
            ].map((l, idx) => (
              <div key={l.n} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px',
                padding: '7px 0', borderBottom: idx < 2 ? '1px dashed var(--border)' : 'none',
              }}>
                <span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{l.n}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)' }}>{l.q}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>{l.a}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700 }}>
                {i('Total à payer','Total due','Total a pagar','Totale da pagare')}
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--acc)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
                14 350<small style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginLeft: 4 }}>F CFA</small>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: i('Espèces','Cash','Efectivo','Contanti'), on: true },
                { label: 'Wave', on: false },
                { label: 'Orange Money', on: false },
                { label: 'MTN MoMo', on: false },
              ].map(p => (
                <span key={p.label} style={{
                  fontSize: 10.5, fontWeight: 600, padding: '5px 9px', borderRadius: 8, whiteSpace: 'nowrap',
                  border: `1px solid ${p.on ? 'color-mix(in srgb,var(--p) 55%,transparent)' : 'var(--border)'}`,
                  background: p.on ? 'color-mix(in srgb,var(--p) 14%,transparent)' : 'var(--card2)',
                  color: p.on ? 'var(--p3)' : 'var(--text2)',
                }}>{p.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Capacités FACTUELLES — vérifiables, aucune preuve sociale inventée */}
        <ul style={{ position: 'relative', zIndex: 1, listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { b: 'Wave · Orange Money · MTN MoMo · PayDunya', t: i('encaissement intégré','built-in payments','cobro integrado','incassi integrati') },
            { b: 'XOF · XAF · EUR · USD · CAD · GBP',        t: i('français, anglais, espagnol, italien','French, English, Spanish, Italian','francés, inglés, español, italiano','francese, inglese, spagnolo, italiano') },
          ].map(c => (
            <li key={c.b} style={{ fontSize: 12.5, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc2)', flexShrink: 0 }}/>
              <span><b style={{ color: 'var(--text)', fontWeight: 600 }}>{c.b}</b> — {c.t}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Volet droit : le formulaire est le héros ── */}
      <main style={{
        display: 'flex', flexDirection: 'column',
        padding: 'clamp(26px,3vw,40px) clamp(20px,4vw,48px)',
        background: 'var(--bg2)',
      }}>
        <Link to="/" className="login-back-link" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content',
          fontSize: 13, fontWeight: 600, color: 'var(--text3)',
          textDecoration: 'none', padding: '6px 10px 6px 4px', borderRadius: 8,
          transition: 'color .15s',
        }}>
          <ArrowLeft size={15} strokeWidth={2.4} />
          {i('Retour à l\'accueil','Back to home','Volver al inicio','Torna alla home')}
        </Link>

        <div style={{ width: '100%', maxWidth: 348, margin: 'auto' }}>
          {/* Logo repris en mobile, où le volet gauche est masqué */}
          <Link to="/" className="login-mobile-logo" aria-label="HabaShop" style={{
            display: 'none', alignItems: 'center', gap: 10, marginBottom: 20, textDecoration: 'none', width: 'fit-content',
          }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', display: 'flex' }}><LogoMark /></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em' }}>HabaShop</span>
          </Link>

          <h2 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-.025em', color: 'var(--text)', margin: '0 0 6px' }}>
            {i('Bon retour','Welcome back','Bienvenido de nuevo','Bentornato')}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 26px' }}>
            {i('Connectez-vous à votre espace HabaShop.','Sign in to your HabaShop workspace.','Inicia sesión en tu espacio HabaShop.','Accedi al tuo spazio HabaShop.')}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 15 }}>
              <label htmlFor="login-email" style={labelStyle}>
                {i('Adresse e-mail','Email address','Correo electrónico','Indirizzo email')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={iconStyle}><Mail size={16} strokeWidth={2.2} /></span>
                <input
                  id="login-email"
                  ref={emailRef}
                  data-testid="login-email"
                  className="login-input"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder={i('vous@exemple.com','you@example.com','tu@ejemplo.com','tu@esempio.com')}
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (error) setError('') }}
                  style={{ borderColor: error ? 'var(--danger)' : undefined }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 15 }}>
              <label htmlFor="login-password" style={labelStyle}>
                {i('Mot de passe','Password','Contraseña','Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={iconStyle}><Lock size={16} strokeWidth={2.2} /></span>
                <input
                  id="login-password"
                  data-testid="login-password"
                  className="login-input login-input-pwd"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                  style={{ borderColor: error ? 'var(--danger)' : undefined }}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd
                    ? i('Masquer le mot de passe','Hide password','Ocultar contraseña','Nascondi password')
                    : i('Afficher le mot de passe','Show password','Mostrar contraseña','Mostra password')}
                  aria-pressed={showPwd}
                >
                  {showPwd ? <EyeOff size={17} strokeWidth={2.2} /> : <Eye size={17} strokeWidth={2.2} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--p)', cursor: 'pointer' }}
                />
                {i('Rester connecté','Stay signed in','Mantener sesión','Resta connesso')}
              </label>
              <button type="button" onClick={handleForgot} className="login-link">
                {i('Mot de passe oublié ?','Forgot password?','¿Olvidaste tu contraseña?','Password dimenticata?')}
              </button>
            </div>

            {/* Erreur inline — annoncée, jamais une alerte bloquante */}
            <div aria-live="polite" role="status">
              {error && (
                <div id="login-error" className="login-error" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  padding: '10px 13px', borderRadius: 10, marginBottom: 15,
                  color: 'var(--danger)', background: 'var(--c-red-bg)',
                  border: '1px solid var(--c-red-border)',
                  fontSize: 13, lineHeight: 1.45,
                }}>
                  <AlertCircle size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              data-testid="login-submit"
              className="login-cta"
              disabled={!canSubmit}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="login-spin" style={{
                    width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                    border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', display: 'inline-block',
                  }}/>
                  {i('Connexion en cours…','Signing in…','Iniciando sesión…','Accesso in corso…')}
                </>
              ) : i('Se connecter','Sign in','Iniciar sesión','Accedi')}
            </button>
          </form>

          {DEMO_MODE && DemoRoleLogin && (
            <Suspense fallback={null}>
              <DemoRoleLogin i={i} busyRole={demoRole} disabled={busy} onPick={handleDemoRole} />
            </Suspense>
          )}

          <div style={{ marginTop: 26, textAlign: 'center', fontSize: 11.5, color: 'var(--text3)' }}>
            HabaShop v{__APP_VERSION__} · © 2026 {i('Tous droits réservés','All rights reserved','Todos los derechos reservados','Tutti i diritti riservati')}
          </div>
        </div>
      </main>

      <style>{`
        .login-back-link:hover { color: var(--text) !important; }

        .login-input {
          width: 100%; box-sizing: border-box;
          height: 46px; padding: 0 13px 0 40px;
          border-radius: 11px; border: 1px solid var(--border2);
          background: var(--card); color: var(--text);
          font-size: 14px; font-family: var(--font);
          transition: border-color .15s, box-shadow .15s;
        }
        .login-input-pwd { padding-right: 44px; }
        .login-input::placeholder { color: var(--text3); }
        .login-input:focus-visible,
        .login-input:focus {
          outline: none;
          border-color: var(--p2);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--p) 28%, transparent);
        }

        .login-eye {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; padding: 0;
          background: none; border: none; border-radius: 8px;
          color: var(--text3); cursor: pointer; transition: color .15s, background .15s;
        }
        .login-eye:hover { color: var(--text); background: var(--card2); }

        .login-link {
          background: none; border: none; padding: 2px 0; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--p3);
          font-family: var(--font); border-radius: 6px;
        }
        .login-link:hover { text-decoration: underline; }

        .login-cta {
          width: 100%; min-height: 48px; padding: 0 16px;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          border: none; border-radius: 12px;
          background: var(--grad-p); color: #fff;
          font-size: 14.5px; font-weight: 700; font-family: var(--font);
          cursor: pointer; transition: filter .15s, opacity .15s;
        }
        .login-cta:hover:not(:disabled) { filter: brightness(1.08); }
        .login-cta:disabled {
          cursor: not-allowed;
          background: var(--card3); color: var(--text3);
          border: 1px solid var(--border);
        }
        .login-cta[aria-busy="true"] { cursor: wait; }

        .login-demo-chip:hover:not(:disabled) { background: var(--card3) !important; border-color: var(--border2) !important; }

        @media (prefers-reduced-motion: no-preference) {
          .login-spin { animation: login-spin 1s linear infinite; }
        }
        @keyframes login-spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          body .login-grid { grid-template-columns: 1fr !important; }
          body .login-brand { display: none !important; }
          body .login-mobile-logo { display: inline-flex !important; }
        }
        @media (max-width: 380px) {
          .login-demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
