import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore, landingFor } from '@/stores/authStore'
import LogoMark from '@/components/ui/LogoMark'
import { useI18n } from '@/hooks/useI18n'
import toast from 'react-hot-toast'
import { ShoppingCart, Users, Package, BarChart3, Coins, ShieldCheck, Globe, Mail, Lock, Eye, EyeOff, Rocket, AlertCircle, ArrowLeft, Crown, Briefcase, Calculator } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Comptes de démonstration par rôle (mapping restauré depuis l'historique pré-redesign).
// Un clic → connexion directe au compte correspondant (mdp démo commun).
const DEMO_PASSWORD = 'demo1234'
const DEMO_ROLES: { key: string; email: string; Icon: LucideIcon; tint: string; testid: string }[] = [
  { key: 'admin',      email: 'admin@habashop.com',      Icon: Crown,        tint: 'var(--p3)',     testid: 'demo-admin' },
  { key: 'manager',    email: 'manager@habashop.com',    Icon: Briefcase,    tint: 'var(--acc2)',   testid: 'demo-manager' },
  { key: 'cashier',    email: 'cashier@habashop.com',    Icon: ShoppingCart, tint: 'var(--acc3)',   testid: 'demo-cashier' },
  { key: 'accountant', email: 'accountant@habashop.com', Icon: Calculator,   tint: 'var(--acc)',    testid: 'demo-accountant' },
  { key: 'hr',         email: 'hr@habashop.com',         Icon: Users,        tint: 'var(--danger)', testid: 'demo-hr' },
]

export default function LoginPage() {
  const navigate              = useNavigate()
  const { login, clearError } = useAuthStore()
  const { i }                 = useI18n()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [demoRole, setDemoRole] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [error,    setError]    = useState('')

  // Cœur de connexion partagé entre le formulaire et le bouton « Explorer la démo ».
  const doLogin = async (mail: string, pwd: string) => {
    setError('')
    clearError()
    await login(mail, pwd)
    const { tenants, activeTenantId, user } = useAuthStore.getState()
    // Aucune boutique → compte sans accès (ne devrait pas arriver après backfill).
    if (tenants.length === 0) {
      setError(i('Aucune boutique associée à ce compte','No shop linked to this account','Ninguna tienda asociada a esta cuenta','Nessun negozio associato a questo account'))
      return
    }
    // Opérateur SaaS (isPlatformAdmin) → console plateforme directement, jamais le sélecteur
    // ni l'app commerçant (critère EN PARALLÈLE du rôle, cf. landingFor).
    if (user?.isPlatformAdmin === true) {
      toast.success(i('Connexion réussie !','Login successful!','¡Inicio de sesión exitoso!','Accesso riuscito!'))
      navigate('/admin')
      return
    }
    // Plusieurs boutiques sans sélection → écran de choix avant d'entrer.
    if (tenants.length > 1 && !activeTenantId) {
      navigate('/select-shop')
      return
    }
    toast.success(i('Connexion réussie !','Login successful!','¡Inicio de sesión exitoso!','Accesso riuscito!'))
    navigate(landingFor(user))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError(i('Email et mot de passe requis','Email and password required','Correo y contraseña requeridos','Email e password obbligatori'))
      return
    }
    setLoading(true)
    try {
      await doLogin(email, password)
    } catch (err: any) {
      setError(err?.message || i('Email ou mot de passe incorrect','Incorrect email or password','Correo o contraseña incorrectos','Email o password non corretti'))
    } finally {
      setLoading(false)
    }
  }

  // Connexion instantanée par rôle : remplit les identifiants du compte démo puis connecte.
  const handleDemoRole = async (key: string, mail: string) => {
    if (demoRole || loading) return
    setEmail(mail)
    setPassword(DEMO_PASSWORD)
    setDemoRole(key)
    try {
      await doLogin(mail, DEMO_PASSWORD)
    } catch (err: any) {
      setError(err?.message || i('Connexion démo indisponible','Demo login unavailable','Acceso demo no disponible','Accesso demo non disponibile'))
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
    ), { icon: '🔑', duration: 5000 })
  }

  return (
    <div className="login-grid public-scope" style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'var(--public-bg)',
      fontFamily: 'var(--font)',
    }}>

      {/* ── Côté gauche : Branding ── */}
      <div className="login-brand" style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg,#0F0A2E 0%,#0F0F1A 50%,#0A0A0F 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        {/* Grid déco */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(124,58,237,.07) 1px,transparent 1px),
            linear-gradient(90deg,rgba(124,58,237,.07) 1px,transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
        }}/>
        {/* Glow orbs */}
        <div className="public-glow-violet" style={{
          top: '12%', left: '20%',
          width: 320, height: 320, borderRadius: '50%',
        }}/>
        <div style={{
          position: 'absolute', bottom: '18%', right: '15%',
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(234,179,8,.12),transparent 70%)',
          filter: 'blur(36px)', pointerEvents: 'none',
        }}/>

        {/* Contenu branding */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>

          {/* Logo (cliquable → accueil) */}
          <Link to="/" aria-label={i('Retour à l\'accueil','Back to home','Volver al inicio','Torna alla home')} style={{
            width: 72, height: 72, borderRadius: 22,
            overflow: 'hidden', display: 'flex',
            margin: '0 auto 24px',
            boxShadow: '0 16px 48px rgba(124,58,237,.5)',
          }}>
            <LogoMark />
          </Link>

          <h1 style={{
            fontSize: 36, fontWeight: 900, color: 'var(--public-text)',
            letterSpacing: '-1px', marginBottom: 10, lineHeight: 1.1,
          }}>
            Haba<span style={{
              background: 'linear-gradient(135deg,var(--public-primary),var(--public-primary-2))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Shop</span>
          </h1>

          <p style={{ fontSize: 16, color: 'var(--public-text-2)', lineHeight: 1.7, marginBottom: 40 }}>
            {i(
              'La solution de gestion commerciale pensée pour les commerces africains',
              'The business management solution designed for African businesses',
              'La solución de gestión comercial pensada para los comercios africanos',
              'La soluzione di gestione commerciale pensata per le attività africane',
            )}
          </p>

          {[
            { Icon: ShoppingCart, text: i('Point de vente tactile','Touch point of sale','Punto de venta táctil','Punto vendita touch') },
            { Icon: Package,      text: i('Gestion stock en temps réel','Real-time inventory management','Gestión de inventario en tiempo real','Gestione magazzino in tempo reale') },
            { Icon: Users,        text: i('CRM clients & fidélité','Customer CRM & loyalty','CRM de clientes y fidelización','CRM clienti e fedeltà') },
            { Icon: BarChart3,    text: i('Rapports & prévisions IA','AI reports & forecasts','Informes y previsiones con IA','Report e previsioni IA') },
            { Icon: Coins,        text: i('Multi-devises & Multi-langues','Multi-currency & multi-language','Multidivisa y multiidioma','Multivaluta e multilingua') },
          ].map(f => (
            <div key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--public-border)',
              borderRadius: 12, marginBottom: 8, textAlign: 'left',
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: 'rgba(124,58,237,.15)', color: 'var(--public-primary-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <f.Icon size={16} strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--public-text)' }}>{f.text}</span>
              <span style={{
                marginLeft: 'auto', flexShrink: 0,
                color: 'var(--public-gold)', display: 'flex', alignItems: 'center',
              }}>
                <ShieldCheck size={15} strokeWidth={2.4} />
              </span>
            </div>
          ))}

          <div style={{
            marginTop: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            fontSize: 12, color: 'var(--public-text-3)',
          }}>
            <Globe size={14} strokeWidth={2.2} />
            <span>{i('Déployé dans 150+ pays','Deployed in 150+ countries','Implementado en más de 150 países','Disponibile in oltre 150 paesi')}</span>
            <span>·</span>
            <span>🇫🇷 🇬🇧 🇪🇸 🇮🇹</span>
          </div>
        </div>
      </div>

      {/* ── Côté droit : Formulaire ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px', position: 'relative',
        background: 'var(--public-bg2)',
      }}>
        {/* Retour à l'accueil — corrige le cul-de-sac : plus de page login sans issue. */}
        <div style={{ width: '100%', maxWidth: 380, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" className="login-back-link" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 13, fontWeight: 600, color: 'var(--public-text-2)',
            textDecoration: 'none', padding: '6px 10px 6px 4px', borderRadius: 8,
            transition: 'color .15s',
          }}>
            <ArrowLeft size={15} strokeWidth={2.4} />
            {i('Retour à l\'accueil','Back to home','Volver al inicio','Torna alla home')}
          </Link>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: 'var(--public-gold)',
            background: 'rgba(255,176,32,.1)', border: '1px solid rgba(255,176,32,.22)',
            borderRadius: 99, padding: '4px 9px',
          }}>
            <ShieldCheck size={12} strokeWidth={2.4} /> SSL/TLS
          </span>
        </div>
        <div style={{
          width: '100%', maxWidth: 380,
          border: '1px solid var(--border3)', borderRadius: 20,
          padding: '36px 32px', background: 'rgba(255,255,255,.02)',
        }}>

          <div style={{ marginBottom: 36 }}>
            <h2 style={{
              fontSize: 32, fontWeight: 900, color: 'var(--public-text)',
              letterSpacing: '-.5px', marginBottom: 8, lineHeight: 1.1,
            }}>
              {i('Bon retour','Welcome back','Bienvenido de nuevo','Bentornato')} 👋
            </h2>
            <p style={{ fontSize: 14, color: 'var(--public-text-2)', lineHeight: 1.6 }}>
              {i('Connectez-vous à votre espace HabaShop','Sign in to your HabaShop workspace','Inicia sesión en tu espacio HabaShop','Accedi al tuo spazio HabaShop')}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div>
              <label htmlFor="login-email" style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: 'var(--public-text-3)', textTransform: 'uppercase',
                letterSpacing: '.6px', marginBottom: 7,
              }}>
                {i('Adresse email','Email address','Correo electrónico','Indirizzo email')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--public-text-3)', pointerEvents: 'none',
                  display: 'flex', alignItems: 'center',
                }}><Mail size={16} strokeWidth={2.2} /></span>
                <input
                  id="login-email"
                  data-testid="login-email"
                  className="public-input"
                  type="email"
                  autoComplete="email"
                  placeholder={i('vous@exemple.com','you@example.com','tu@ejemplo.com','tu@esempio.com')}
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  style={{
                    width: '100%',
                    border: error ? '1px solid var(--danger)' : undefined,
                    padding: '12px 14px 12px 44px',
                    fontSize: 14, fontFamily: 'var(--font)',
                    minHeight: 48, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="login-password" style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: 'var(--public-text-3)', textTransform: 'uppercase',
                letterSpacing: '.6px', marginBottom: 7,
              }}>
                {i('Mot de passe','Password','Contraseña','Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--public-text-3)', pointerEvents: 'none',
                  display: 'flex', alignItems: 'center',
                }}><Lock size={16} strokeWidth={2.2} /></span>
                <input
                  id="login-password"
                  data-testid="login-password"
                  className="public-input"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required
                  style={{
                    width: '100%',
                    border: error ? '1px solid var(--danger)' : undefined,
                    padding: '12px 48px 12px 44px',
                    fontSize: 14, fontFamily: 'var(--font)',
                    minHeight: 48, boxSizing: 'border-box',
                    letterSpacing: showPwd ? 'normal' : '2px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? i('Cacher le mot de passe','Hide password','Ocultar contraseña','Nascondi password') : i('Afficher le mot de passe','Show password','Mostrar contraseña','Mostra password')}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--public-text-3)', padding: '4px', borderRadius: 6,
                    display: 'flex', alignItems: 'center',
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--public-text)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--public-text-3)'}
                >
                  {showPwd ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
                </button>
              </div>
            </div>

            {/* Rester connecté · Mot de passe oublié */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -2 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--public-text-2)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--public-primary)', cursor: 'pointer' }}
                />
                {i('Rester connecté','Stay signed in','Mantener sesión','Resta connesso')}
              </label>
              <button
                type="button"
                onClick={handleForgot}
                style={{ background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--public-primary-2)', fontFamily: 'var(--font)' }}
              >
                {i('Mot de passe oublié ?','Forgot password?','¿Olvidaste tu contraseña?','Password dimenticata?')}
              </button>
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(255,59,92,.08)',
                border: '1px solid rgba(255,59,92,.2)',
                borderRadius: 10, color: 'var(--danger)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'slideUp .2s ease',
              }}>
                <AlertCircle size={16} strokeWidth={2.4} style={{ flexShrink: 0 }} />{error}
              </div>
            )}

            {/* Bouton connexion */}
            <button
              type="submit"
              data-testid="login-submit"
              className="public-btn-primary"
              disabled={loading || !!demoRole}
              style={{
                width: '100%', padding: '14px',
                fontSize: 15, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'var(--font)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                minHeight: 52, marginTop: 4,
              }}>
              {loading ? (
                <>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff',
                    animation: 'spin 1s linear infinite',
                    display: 'inline-block', flexShrink: 0,
                  }}/>
                  {i('Connexion en cours…','Signing in…','Iniciando sesión…','Accesso in corso…')}
                </>
              ) : <><Rocket size={17} strokeWidth={2.4} /> {i('Se connecter','Sign in','Iniciar sesión','Accedi')}</>}
            </button>

            {/* Séparateur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--public-border)' }}/>
              <span style={{ fontSize: 11, color: 'var(--public-text-3)', fontWeight: 600 }}>{i('OU','OR','O','O')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--public-border)' }}/>
            </div>

            {/* Connexion instantanée par rôle — grille de puces compactes (un clic = connexion) */}
            {(() => {
              const meta: Record<string, { label: string; sub: string }> = {
                admin:      { label: i('Admin','Admin','Administrador','Amministratore'),      sub: i('Accès total','Full access','Acceso total','Accesso totale') },
                manager:    { label: i('Manager','Manager','Gerente','Manager'),               sub: i('Gestion','Management','Gestión','Gestione') },
                cashier:    { label: i('Caissier','Cashier','Cajero','Cassiere'),              sub: i('POS','POS','TPV','Cassa') },
                accountant: { label: i('Comptable','Accountant','Contable','Contabile'),       sub: i('Finances','Finance','Finanzas','Finanze') },
                hr:         { label: i('RH','HR','RR. HH.','Risorse Umane'),                   sub: i('Employés & paie','Staff & payroll','Personal y nóminas','Personale e buste paga') },
              }
              return (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px', textAlign: 'center', marginBottom: 10 }}>
                    {i('Connexion instantanée par rôle','Instant login by role','Acceso instantáneo por rol','Accesso istantaneo per ruolo')}
                  </div>
                  <div className="login-demo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {DEMO_ROLES.map(r => {
                      const m = meta[r.key]
                      const busy = demoRole === r.key
                      return (
                        <button
                          key={r.key}
                          type="button"
                          data-testid={r.testid}
                          onClick={() => handleDemoRole(r.key, r.email)}
                          disabled={loading || !!demoRole}
                          aria-label={`${i('Connexion démo','Demo login','Acceso demo','Accesso demo')} — ${m.label}`}
                          style={{
                            gridColumn: r.key === 'hr' ? '1 / -1' : 'auto',
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', textAlign: 'left',
                            background: 'var(--card2)', border: '1px solid var(--border)',
                            borderRadius: 10, fontFamily: 'var(--font)',
                            cursor: (loading || demoRole) ? 'wait' : 'pointer',
                            opacity: demoRole && !busy ? 0.5 : 1,
                            transition: 'background .15s, border-color .15s, opacity .15s',
                          }}
                          onMouseEnter={e => { if (!demoRole && !loading) { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--card3)'; el.style.borderColor = 'var(--border2)' } }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--card2)'; el.style.borderColor = 'var(--border)' }}
                        >
                          <span style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: `color-mix(in srgb, ${r.tint} 16%, transparent)`, color: r.tint,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {busy
                              ? <span style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid color-mix(in srgb, currentColor 30%, transparent)', borderTopColor: 'currentColor', animation: 'spin 1s linear infinite', display: 'inline-block' }}/>
                              : <r.Icon size={16} strokeWidth={2.3} />}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{m.label}</span>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sub}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </form>

          {/* Footer */}
          <div style={{
            marginTop: 28, textAlign: 'center',
            fontSize: 11, color: 'var(--public-text-3)', lineHeight: 1.7,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ShieldCheck size={13} strokeWidth={2.2} /><span>{i('Connexion sécurisée SSL/TLS','Secure SSL/TLS connection','Conexión segura SSL/TLS','Connessione sicura SSL/TLS')}</span>
            </div>
            <div style={{ marginTop: 4 }}>HabaShop v2.0 · © 2026 {i('Tous droits réservés','All rights reserved','Todos los derechos reservados','Tutti i diritti riservati')}</div>
          </div>
        </div>
      </div>

      <style>{`
        .login-back-link:hover { color: var(--public-text) !important; }
        @media (max-width: 380px) {
          .login-demo-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          body .login-grid { grid-template-columns: 1fr !important; }
          body .login-brand { display: none !important; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
