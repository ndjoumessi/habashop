import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate              = useNavigate()
  const { login, clearError } = useAuthStore()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Email et mot de passe requis')
      return
    }
    setLoading(true)
    setError('')
    clearError()
    try {
      await login(email, password)
      toast.success('Connexion réussie !')
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Email ou mot de passe incorrect')
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
            La solution de gestion commerciale
            pensée pour les commerces africains
          </p>

          {[
            { icon: '🛒', text: 'Point de vente tactile' },
            { icon: '📦', text: 'Gestion stock en temps réel' },
            { icon: '👥', text: 'CRM clients & fidélité' },
            { icon: '📊', text: 'Rapports & prévisions IA' },
            { icon: '💱', text: 'Multi-devises & Multi-langues' },
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
            <span>Déployé dans 150+ pays</span>
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
              Bon retour 👋
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
              Connectez-vous à votre espace HabaShop
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
                Adresse email
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
                  placeholder="vous@exemple.com"
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
                Mot de passe
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
                  aria-label={showPwd ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
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
                  Connexion en cours…
                </>
              ) : <>🚀 Se connecter</>}
            </button>

            {/* Séparateur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
              <span style={{ fontSize: 11, color: 'var(--text4,var(--text3))', fontWeight: 600 }}>ACCÈS DÉMO</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
            </div>

            {/* Boutons démo */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Admin',    email: 'admin@habashop.com',   pwd: 'demo1234', icon: '👑', color: 'rgba(108,71,255,.15)', border: 'rgba(108,71,255,.3)',  text: 'var(--p3)'  },
                { label: 'Caissier', email: 'cashier@habashop.com', pwd: 'demo1234', icon: '🛒', color: 'rgba(0,184,255,.1)',   border: 'rgba(0,184,255,.25)', text: 'var(--acc3,var(--acc2))' },
              ].map(demo => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword(demo.pwd); setError('') }}
                  style={{
                    flex: 1, padding: '9px',
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
                  {demo.icon} {demo.label}
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
              <span>🔒</span><span>Connexion sécurisée SSL/TLS</span>
            </div>
            <div style={{ marginTop: 4 }}>HabaShop v2.0 · © 2026 Tous droits réservés</div>
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
