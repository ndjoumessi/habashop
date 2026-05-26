import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import toast from 'react-hot-toast'
import { Crown, Briefcase, ShoppingCart, Calculator, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export default function LoginPage() {
  const navigate              = useNavigate()
  const { login, clearError } = useAuthStore()
  const { i }                 = useI18n()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError(i('Email et mot de passe requis','Email and password required','Correo y contraseña requeridos','Email e password obbligatori'))
      return
    }
    setLoading(true)
    setError('')
    clearError()
    try {
      await login(email, password)
      toast.success(i('Connexion réussie !','Login successful!','¡Inicio de sesión exitoso!','Accesso riuscito!'))
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(err?.message || i('Email ou mot de passe incorrect','Incorrect email or password','Correo o contraseña incorrectos','Email o password non corretti'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-grid" style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg)',
      fontFamily: 'var(--font)',
    }}>

      {/* ── Côté gauche : Branding ── */}
      <div className="login-brand" style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg,#07070F 0%,#0D0D28 50%,#0A0718 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        {/* Grid déco */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(108,71,255,.06) 1px,transparent 1px),
            linear-gradient(90deg,rgba(108,71,255,.06) 1px,transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
        }}/>
        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '15%', left: '20%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(108,71,255,.18),transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', bottom: '20%', right: '15%',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(0,208,132,.12),transparent 70%)',
          filter: 'blur(30px)', pointerEvents: 'none',
        }}/>

        {/* Contenu branding */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>

          {/* Logo */}
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 32, fontWeight: 900, color: '#fff',
            boxShadow: '0 16px 48px rgba(108,71,255,.45)',
          }}>🛒</div>

          <h1 style={{
            fontSize: 36, fontWeight: 900, color: 'var(--text)',
            letterSpacing: '-1px', marginBottom: 10, lineHeight: 1.1,
          }}>
            Haba<span style={{
              background: 'linear-gradient(135deg,#6C47FF,#A991FF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Shop</span>
          </h1>

          <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 40 }}>
            {i(
              'La solution de gestion commerciale pensée pour les commerces africains',
              'The business management solution designed for African businesses',
              'La solución de gestión comercial pensada para los comercios africanos',
              'La soluzione di gestione commerciale pensata per le attività africane',
            )}
          </p>

          {[
            { icon: '🛒', text: i('Point de vente tactile','Touch point of sale','Punto de venta táctil','Punto vendita touch') },
            { icon: '📦', text: i('Gestion stock en temps réel','Real-time inventory management','Gestión de inventario en tiempo real','Gestione magazzino in tempo reale') },
            { icon: '👥', text: i('CRM clients & fidélité','Customer CRM & loyalty','CRM de clientes y fidelización','CRM clienti e fedeltà') },
            { icon: '📊', text: i('Rapports & prévisions IA','AI reports & forecasts','Informes y previsiones con IA','Report e previsioni IA') },
            { icon: '💱', text: i('Multi-devises & Multi-langues','Multi-currency & multi-language','Multidivisa y multiidioma','Multivaluta e multilingua') },
          ].map(f => (
            <div key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 12, marginBottom: 8, textAlign: 'left',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{f.text}</span>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--acc2)', flexShrink: 0 }}>✓</span>
            </div>
          ))}

          <div style={{
            marginTop: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            fontSize: 12, color: 'var(--text3)',
          }}>
            <span>🌍</span>
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
        padding: '48px 56px',
        background: 'var(--bg2,var(--bg))',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          <div style={{ marginBottom: 36 }}>
            <h2 style={{
              fontSize: 26, fontWeight: 900, color: 'var(--text)',
              letterSpacing: '-.5px', marginBottom: 8,
            }}>
              {i('Bon retour','Welcome back','Bienvenido de nuevo','Bentornato')} 👋
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
              {i('Connectez-vous à votre espace HabaShop','Sign in to your HabaShop workspace','Inicia sesión en tu espacio HabaShop','Accedi al tuo spazio HabaShop')}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div>
              <label htmlFor="login-email" style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: '.6px', marginBottom: 7,
              }}>
                {i('Adresse email','Email address','Correo electrónico','Indirizzo email')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 16, color: 'var(--text3)', pointerEvents: 'none',
                }}>📧</span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder={i('vous@exemple.com','you@example.com','tu@ejemplo.com','tu@esempio.com')}
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  style={{
                    width: '100%', background: 'var(--bg4,var(--bg3))',
                    border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '12px 14px 12px 44px',
                    color: 'var(--text)', fontSize: 14,
                    fontFamily: 'var(--font)', outline: 'none',
                    transition: 'all .15s', minHeight: 48, boxSizing: 'border-box',
                  }}
                  onFocus={e => { if (!error) e.target.style.borderColor = 'var(--p2)'; e.target.style.boxShadow = '0 0 0 3px rgba(108,71,255,.15)' }}
                  onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="login-password" style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: '.6px', marginBottom: 7,
              }}>
                {i('Mot de passe','Password','Contraseña','Password')}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 16, color: 'var(--text3)', pointerEvents: 'none',
                }}>🔒</span>
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required
                  style={{
                    width: '100%', background: 'var(--bg4,var(--bg3))',
                    border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '12px 48px 12px 44px',
                    color: 'var(--text)', fontSize: 14,
                    fontFamily: 'var(--font)', outline: 'none',
                    transition: 'all .15s', minHeight: 48, boxSizing: 'border-box',
                    letterSpacing: showPwd ? 'normal' : '2px',
                  }}
                  onFocus={e => { if (!error) e.target.style.borderColor = 'var(--p2)'; e.target.style.boxShadow = '0 0 0 3px rgba(108,71,255,.15)' }}
                  onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? i('Cacher le mot de passe','Hide password','Ocultar contraseña','Nascondi password') : i('Afficher le mot de passe','Show password','Mostrar contraseña','Mostra password')}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, color: 'var(--text3)', padding: '4px', borderRadius: 6,
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text3)'}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
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
                <span>⚠️</span>{error}
              </div>
            )}

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? 'rgba(108,71,255,.4)' : 'linear-gradient(135deg,#6C47FF,#8B6FFF)',
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'var(--font)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                minHeight: 52,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(108,71,255,.4)',
                transition: 'all .2s', marginTop: 4,
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
              ) : <>🚀 {i('Se connecter','Sign in','Iniciar sesión','Accedi')}</>}
            </button>

            {/* Séparateur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
              <span style={{ fontSize: 11, color: 'var(--text4,var(--text3))', fontWeight: 600 }}>{i('ACCÈS DÉMO','DEMO ACCESS','ACCESO DEMO','ACCESSO DEMO')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
            </div>

            {/* Boutons démo (5 rôles) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
              {([
                { label: i('Admin','Admin','Administrador','Amministratore'),     email: 'admin@habashop.com',      Icon: Crown,        color: 'rgba(108,71,255,.15)', border: 'rgba(108,71,255,.3)',  text: 'var(--p3)'  },
                { label: i('Manager','Manager','Gerente','Manager'),   email: 'manager@habashop.com',    Icon: Briefcase,    color: 'rgba(0,208,132,.12)',  border: 'rgba(0,208,132,.28)', text: 'var(--acc2)' },
                { label: i('Caissier','Cashier','Cajero','Cassiere'),  email: 'cashier@habashop.com',    Icon: ShoppingCart, color: 'rgba(0,184,255,.1)',   border: 'rgba(0,184,255,.25)', text: 'var(--acc3,var(--acc2))' },
                { label: i('Comptable','Accountant','Contable','Contabile'), email: 'accountant@habashop.com', Icon: Calculator,   color: 'rgba(255,149,0,.12)',  border: 'rgba(255,149,0,.28)', text: 'var(--acc)' },
                { label: i('RH','HR','RR. HH.','Risorse Umane'),        email: 'hr@habashop.com',         Icon: Users,        color: 'rgba(244,114,182,.12)',border: 'rgba(244,114,182,.28)', text: '#F472B6' },
              ] as { label: string; email: string; Icon: LucideIcon; color: string; border: string; text: string }[]).map(demo => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword('demo1234'); setError('') }}
                  style={{
                    padding: '9px',
                    background: demo.color,
                    border: `1px solid ${demo.border}`,
                    borderRadius: 10, cursor: 'pointer',
                    color: demo.text, fontSize: 12, fontWeight: 700,
                    fontFamily: 'var(--font)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'opacity .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                >
                  <demo.Icon size={13} strokeWidth={2.4} />
                  {demo.label}
                </button>
              ))}
            </div>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: 28, textAlign: 'center',
            fontSize: 11, color: 'var(--text4,var(--text3))', lineHeight: 1.7,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span>🔒</span><span>{i('Connexion sécurisée SSL/TLS','Secure SSL/TLS connection','Conexión segura SSL/TLS','Connessione sicura SSL/TLS')}</span>
            </div>
            <div style={{ marginTop: 4 }}>HabaShop v2.0 · © 2026 {i('Tous droits réservés','All rights reserved','Todos los derechos reservados','Tutti i diritti riservati')}</div>
          </div>
        </div>
      </div>

      <style>{`
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
