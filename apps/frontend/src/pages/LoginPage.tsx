import { useState, useRef, lazy, Suspense } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore, landingFor } from '@/stores/authStore'
import LogoMark from '@/components/ui/LogoMark'
import { useI18n } from '@/hooks/useI18n'
import { copyrightYear } from '@/lib/publicYear'
import { LANDING_TRANSLATIONS } from '@/components/landing/landingShared'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Store, WifiOff, RefreshCw } from 'lucide-react'

/**
 * Page de connexion — refonte 2026-07 (formulaire héros, 100 % tokens CSS),
 * resserrée 2026-08.
 *
 * Trois corrections de fond appliquées avec la refonte de juillet :
 *  • le raccourci « connexion par rôle » ne s'affiche plus qu'en démo (VITE_DEMO_MODE) ;
 *  • « Déployé dans 150+ pays » retiré (revendication fausse : une poignée de boutiques) ;
 *  • badges SSL/TLS retirés (page + pied) — le chiffrement est un acquis, pas un argument.
 *
 * Août 2026 — l'aperçu hors-ligne du volet gauche était le meilleur actif de la page et il
 * flottait en bas d'un vide : les deux volets sont désormais à 50/50, le contenu de gauche
 * est centré dans une colonne bornée, le lien « Retour à l'accueil » est aligné sur le logo
 * (il flottait seul en haut au centre du volet droit), et le CTA garde un fond d'accent
 * même désactivé — il avait l'air en panne, pas en attente.
 *
 * ⚠️ DEUX AFFIRMATIONS CORRIGÉES ICI, mesurées le 2026-08-06 :
 *  • l'aperçu annonçait « Hors-ligne — vente enregistrée » sans dire OÙ. La file d'attente
 *    hors-ligne vit dans `mobile/src/services/offlineQueue.ts` ; le POS **web** avorte la
 *    vente hors réseau (`pages/POS.tsx` : « il n'y a pas de persistance locale des
 *    ventes ») et sa propre bannière annonce des fonctionnalités indisponibles. L'aperçu
 *    est donc explicitement légendé « application mobile » ;
 *  • la liste de capacités annonçait « Wave · Orange Money · MTN MoMo · PayDunya —
 *    encaissement intégré ». Wave et Orange Money en direct n'ont AUCUNE clé sur Railway
 *    (`WAVE_API_KEY`, `ORANGE_CLIENT_ID` absentes) et ne sont appelés depuis aucun écran ;
 *    le POS route « Orange » vers Campay. Seuls les providers réellement câblés sont
 *    nommés, avec leur statut.
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
  const { i, lang }           = useI18n()

  /**
   * ⚠️ RÉSERVE SUR LE PAIEMENT — DÉRIVÉE, PAS RECOPIÉE.
   * Cette page citait « MTN MoMo · Orange Money · PayDunya — encaissement intégré à la
   * caisse » sans la réserve que la vitrine porte depuis le 2026-08-06. Or aucun de ces
   * canaux n'encaisse : Wave et Orange n'ont aucune clé, MTN/Campay/PayDunya tournent en
   * bac à sable. La chaîne vient du pilier de la vitrine, pour qu'elle ne puisse pas
   * diverger — c'est le motif des corps de refus Campay/MTN, alignés le même jour.
   */
  const paymentStatus = LANDING_TRANSLATIONS[lang].pillar1_status

  const emailRef = useRef<HTMLInputElement>(null)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [demoRole, setDemoRole] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [error,    setError]    = useState('')

  const busy    = loading || !!demoRole

  /**
   * ⚠️ Le CTA n'est plus désactivé par la VALIDATION — seulement pendant l'envoi.
   * Il l'était (`disabled={!canSubmit}`) et affichait un fond atténué : un contrôle sans
   * contraste, qui gronde avant toute erreur, ne dit pas CE QUI manque, et n'affiche
   * aucune infobulle au toucher — donc sur mobile il n'explique rien. Au clic à vide, on
   * NOMME les champs manquants et on donne le focus au premier.
   * C'est le même correctif que /signup ; la méta-règle `landingClaims.test.ts` l'a
   * trouvé ici alors que je ne l'y avais pas cherché.
   */
  const missing = [
    ...(email.trim() ? [] : [i('adresse e-mail','email address','correo electrónico','indirizzo email')]),
    ...(password ? [] : [i('mot de passe','password','contraseña','password')]),
  ]

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
    if (!email.trim() || !password) {
      setError(`${i('Il manque encore :','Still missing:','Todavía falta:','Manca ancora:')} ${missing.join(', ')}`)
      ;(email.trim() ? document.getElementById('login-password') : emailRef.current)?.focus()
      return
    }
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
      minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg)', fontFamily: 'var(--font)',
    }}>

      {/* ── Volet gauche : preuve de valeur (masqué < 900px) ── */}
      <aside className="login-brand" style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(158deg,var(--bg) 0%,var(--bg2) 58%,var(--bg) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        // Le contenu se colle à la marge INTÉRIEURE (côté séparation), pas au bord de
        // l'écran — motif de `SignupBranding`. MESURÉ sur /login à 2560 px : 1 204 px de
        // vide entre la colonne et le formulaire, contre 56 px à gauche.
        alignItems: 'flex-end',
        padding: 'clamp(28px,3vw,48px) clamp(32px,4vw,72px)',
        // ⚠️ Séparation LISIBLE : --bg et --bg2 sont deux gris sombres presque identiques ;
        // un filet --border ne se voyait pas. Même correction que sur /signup.
        borderRight: '1px solid var(--border2)',
        boxShadow: '10px 0 40px -12px rgba(0,0,0,.6)',
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

        {/* Colonne bornée, poussée vers la CÉSURE par `alignItems:'flex-end'` de l'aside.
            Elle était collée au bord gauche (`marginRight:'auto'`) : le lecteur devait
            traverser 1 204 px de vide pour aller du texte au formulaire. */}
        <div style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
          display: 'flex', flexDirection: 'column', gap: 26,
        }}>

        <Link to="/" className="login-back-link" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content',
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text3)',
          textDecoration: 'none', transition: 'color .15s',
        }}>
          <ArrowLeft size={15} strokeWidth={2.4} />
          {i('Retour à l\'accueil','Back to home','Volver al inicio','Torna alla home')}
        </Link>

        <Link to="/" aria-label="HabaShop" style={{
          display: 'inline-flex', alignItems: 'center', gap: 11,
          textDecoration: 'none', width: 'fit-content',
        }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', display: 'flex', flexShrink: 0, boxShadow: 'var(--sh-p, 0 8px 26px rgba(108,71,255,.35))' }}>
            <LogoMark />
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--text)' }}>HabaShop</span>
        </Link>

        <div>
          <h1 style={{
            fontSize: 'clamp(25px,2.6vw,33px)', lineHeight: 1.16, letterSpacing: '-.028em',
            fontWeight: 700, color: 'var(--text)', margin: 0, maxWidth: '15ch',
          }}>
            {i('La caisse qui continue quand le ','The till that keeps going when the ','La caja que sigue cuando la ','La cassa che continua quando la ')}
            <span style={{ color: 'var(--p3)' }}>
              {i('réseau s\'arrête','network stops','red se cae','rete si ferma')}
            </span>.
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', margin: '10px 0 0', maxWidth: '42ch' }}>
            {i(
              'Ventes, stock et encaissement. Le mode hors-ligne vit dans l\'application mobile, qui n\'est pas encore publiée — aujourd\'hui HabaShop s\'utilise depuis le navigateur.',
              'Sales, stock and payments. Offline mode lives in the mobile app, which is not published yet — today HabaShop runs in the browser.',
              'Ventas, stock y cobro. El modo sin conexión vive en la aplicación móvil, que aún no está publicada — hoy HabaShop se usa desde el navegador.',
              'Vendite, magazzino e incassi. La modalità offline vive nell\'app mobile, non ancora pubblicata — oggi HabaShop si usa dal browser.',
            )}
          </p>
        </div>

        {/* Aperçu produit — panier POS fidèle, purement décoratif pour un lecteur d'écran.
            ⚠️ La légende « application mobile » est load-bearing : cf. l'en-tête du fichier. */}
        <div
          role="img"
          aria-label={i(
            'Aperçu de l’application mobile : une vente encaissée hors-ligne, trois ventes en attente de synchronisation',
            'Mobile app preview: a sale taken offline, three sales waiting to sync',
            'Vista previa de la app móvil: una venta cobrada sin conexión, tres ventas pendientes de sincronizar',
            'Anteprima dell’app mobile: una vendita incassata offline, tre vendite in attesa di sincronizzazione',
          )}
          style={{
            border: '1px solid var(--border2)', borderRadius: 15, background: 'var(--card)',
            overflow: 'hidden', boxShadow: 'var(--sh-md, 0 20px 50px rgba(0,0,0,.3))',
          }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', flexWrap: 'wrap',
            background: 'var(--c-orange-bg)', borderBottom: '1px solid var(--c-orange-border)',
            fontSize: 11, fontWeight: 700, color: 'var(--acc3)',
          }}>
            <WifiOff size={12} strokeWidth={2.4} />
            <span>{i('Mode hors-ligne','Offline mode','Modo sin conexión','Modalità offline')}</span>
            <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: .6 }}/>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <RefreshCw size={11} strokeWidth={2.4} />
              {i('3 ventes en attente de synchro','3 sales waiting to sync','3 ventas pendientes de sincronizar','3 vendite in attesa di sincronizzazione')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
            <Store size={14} strokeWidth={2} color="var(--text3)" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>Dakar Central</span>
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
                  <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>{l.n}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)' }}>{l.q}</span>
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>{l.a}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700 }}>
                {i('Total à payer','Total due','Total a pagar','Totale da pagare')}
              </span>
              <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--acc)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
                14 350<small style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text3)', marginLeft: 4 }}>F CFA</small>
              </span>
            </div>
            {/* ⚠️ Wave a été RETIRÉ de ces pastilles : aucun écran ne l'appelle et sa clé
                n'existe pas. Les trois restants sont ceux que `POS.tsx` sait réellement
                déclencher (MTN direct, Orange via Campay, PayDunya). */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: i('Espèces','Cash','Efectivo','Contanti'), on: true },
                { label: 'MTN MoMo', on: false },
                { label: 'Orange Money', on: false },
                { label: 'PayDunya', on: false },
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

        {/* ⚠️ La maquette montre l'app MOBILE, qui n'est pas publiée. Sans cette légende,
            l'aperçu se lit comme une capture de ce qu'on obtient en s'inscrivant. */}
        <p style={{ margin: '-14px 0 0', fontSize: 11.5, color: 'var(--text3)' }}>
          {i(
            'Aperçu de l’application mobile — Android, publication en préparation.',
            'Preview of the mobile app — Android, release in preparation.',
            'Vista previa de la aplicación móvil — Android, publicación en preparación.',
            'Anteprima dell’app mobile — Android, pubblicazione in preparazione.',
          )}
        </p>

        {/* Capacités FACTUELLES — chaque ligne pointe un fichier du dépôt. */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { b: 'MTN MoMo · Orange Money · PayDunya', t: i('encaissement intégré à la caisse','payments wired into the till','cobro integrado en la caja','incassi integrati in cassa'), status: paymentStatus },
            { b: 'XOF · XAF · EUR · USD · CAD · GBP',  t: i('français, anglais, espagnol, italien','French, English, Spanish, Italian','francés, inglés, español, italiano','francese, inglese, spagnolo, italiano') },
          ].map(c => (
            <li key={c.b} style={{ fontSize: 12.5, color: 'var(--text2)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc2)', flexShrink: 0, marginTop: 6 }}/>
              <span>
                <b style={{ color: 'var(--text)', fontWeight: 600 }}>{c.b}</b> — {c.t}
                {/* ⚠️ La réserve n'est PAS recopiée : c'est la chaîne du pilier de la vitrine.
                    Une réserve écrite deux fois diverge — motif des corps de refus Campay/MTN. */}
                {c.status && (
                  <span style={{ display: 'block', marginTop: 3, color: 'var(--warn)', fontSize: 11.5, lineHeight: 1.45 }}>
                    {c.status}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        </div>
      </aside>

      {/* ── Volet droit : le formulaire est le héros ── */}
      <main style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: 'clamp(26px,3vw,40px) clamp(20px,4vw,48px)',
        background: 'var(--bg2)',
      }}>
        {/* Retour à l'accueil : côté formulaire, il n'existe QUE sous 900 px — au-dessus,
            le volet gauche le porte, aligné sur le logo. En doubler l'affichage remettrait
            le lien flottant qu'on retire. */}
        <Link to="/" className="login-back-link login-back-mobile" style={{
          display: 'none', alignItems: 'center', gap: 7, width: 'fit-content',
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text3)',
          textDecoration: 'none', marginBottom: 18,
          transition: 'color .15s',
        }}>
          <ArrowLeft size={15} strokeWidth={2.4} />
          {i('Retour à l\'accueil','Back to home','Volver al inicio','Torna alla home')}
        </Link>

        <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
          {/* Logo repris en mobile, où le volet gauche est masqué */}
          <Link to="/" className="login-mobile-logo" aria-label="HabaShop" style={{
            display: 'none', alignItems: 'center', gap: 10, marginBottom: 20, textDecoration: 'none', width: 'fit-content',
          }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', display: 'flex' }}><LogoMark /></span>
            <span style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em' }}>HabaShop</span>
          </Link>

          <h2 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-.025em', color: 'var(--text)', margin: '0 0 6px' }}>
            {i('Bon retour','Welcome back','Bienvenido de nuevo','Bentornato')}
          </h2>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text2)', margin: '0 0 26px' }}>
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
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
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
                  fontSize: 'var(--fs-sm)', lineHeight: 1.45,
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
              disabled={busy}
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
            HabaShop v{__APP_VERSION__} · © {copyrightYear()} {i('Tous droits réservés','All rights reserved','Todos los derechos reservados','Tutti i diritti riservati')}
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
        /* Désactivé ≠ en panne. L'ancien état (fond --card3 gris + bordure) donnait un
           bouton qui avait l'air CASSÉ plutôt qu'en attente de saisie : on garde le fond
           d'accent, atténué, pour qu'il reste identifiable comme l'action principale.
           L'attribut disabled lui-même est conservé, login.anchor.test.tsx le verrouille.
           (Pas de guillemets obliques ici : ce bloc est un template literal JS.) */
        .login-cta:disabled {
          cursor: not-allowed;
          background: var(--grad-p); color: #fff;
          opacity: .48;
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
          body .login-back-mobile { display: inline-flex !important; }
        }
        @media (max-width: 380px) {
          .login-demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
