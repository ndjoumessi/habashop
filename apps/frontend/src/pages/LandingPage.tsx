import { useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart3, ShoppingCart, Package, Users, Shield, Smartphone } from 'lucide-react'

const FEATURES = [
  { icon: <ShoppingCart size={22} />, title: 'Caisse (POS)',        desc: 'Encaissement rapide, multi-modes de paiement, ticket automatique, mode offline.',       color: 'var(--primary)' },
  { icon: <Package size={22} />,      title: 'Stock & Inventaire',  desc: 'Alertes rupture en temps réel, CRUD produits, bons de commande automatiques.',          color: 'var(--teal)'    },
  { icon: <BarChart3 size={22} />,    title: 'Rapports & KPIs',     desc: 'Chiffre d\'affaires, marges, top produits, exports CSV/PDF en un clic.',                 color: 'var(--amber)'   },
  { icon: <Users size={22} />,        title: 'CRM Clients',         desc: 'Fiches clients, programme de fidélité, historique des achats, relances automatiques.',   color: '#A78BFA'        },
  { icon: <Shield size={22} />,       title: 'RBAC & Sécurité',     desc: 'Rôles et permissions, authentification 2FA TOTP, journal d\'audit complet.',            color: 'var(--green)'   },
  { icon: <Smartphone size={22} />,   title: 'PWA Mobile',          desc: 'Fonctionne sur mobile comme une app native, caisse offline, sync automatique.',          color: '#F472B6'        },
]

const STATS = [
  { value: '16',    label: 'Modules métier'    },
  { value: '100%',  label: 'Offline-ready'     },
  { value: '4',     label: 'Devises supportées' },
  { value: '5+',    label: 'Pays cibles'        },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,12,20,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366F1, #14B8A6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: '#fff', fontSize: 18,
            boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
          }}>H</div>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>
            Haba<span style={{ color: 'var(--teal)' }}>Shop</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>v2.0 — Mai 2026</span>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'linear-gradient(135deg, #6366F1, #14B8A6)',
              border: 'none', borderRadius: 10, padding: '8px 20px',
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            Se connecter <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        padding: '100px 2rem 80px',
        textAlign: 'center',
        background: `
          radial-gradient(ellipse 70% 50% at 50% -10%, rgba(99,102,241,0.18), transparent 60%),
          radial-gradient(ellipse 50% 30% at 90% 0%, rgba(20,184,166,0.10), transparent 50%)
        `,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 99, padding: '6px 16px', marginBottom: 28,
          fontSize: 12, fontWeight: 700, color: 'var(--primary2)',
        }}>
          🌍 Conçu pour l'Afrique francophone
        </div>

        <h1 style={{
          fontSize: 'clamp(2.2rem, 6vw, 4rem)',
          fontWeight: 900, letterSpacing: '-2px',
          lineHeight: 1.1, marginBottom: 20,
          background: 'linear-gradient(135deg, #F1F5F9 30%, #818CF8 70%, #2DD4BF 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          La gestion commerciale<br />pensée pour votre commerce
        </h1>

        <p style={{ fontSize: 18, color: 'var(--text2)', maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.7 }}>
          HabaShop centralise votre caisse, vos stocks, vos équipes et vos finances dans un seul outil — simple, rapide, et disponible même sans internet.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'linear-gradient(135deg, #6366F1, #14B8A6)',
              border: 'none', borderRadius: 12, padding: '14px 32px',
              color: '#fff', fontWeight: 800, fontSize: 15,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 8px 28px rgba(99,102,241,0.40)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            Accéder à l'application <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'rgba(148,163,184,0.08)', border: '1px solid var(--border2)',
              borderRadius: 12, padding: '14px 32px',
              color: 'var(--text)', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✨ Démo gratuite
          </button>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: '0 2rem 80px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '32px 24px',
        }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 36, fontWeight: 900, letterSpacing: '-2px',
                fontFamily: 'JetBrains Mono, monospace',
                background: 'linear-gradient(135deg, #818CF8, #2DD4BF)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '0 2rem 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>
            Tout ce dont vous avez besoin
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 15 }}>16 modules intégrés pour gérer chaque aspect de votre commerce</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '24px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = f.color + '44'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, marginBottom: 16,
                background: f.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: f.color,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section style={{
        margin: '0 2rem 80px',
        maxWidth: 900,
        marginLeft: 'auto', marginRight: 'auto',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(20,184,166,0.10))',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 24, padding: '60px 40px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>
          Prêt à moderniser votre commerce ?
        </h2>
        <p style={{ color: 'var(--text2)', marginBottom: 32, fontSize: 15 }}>
          Rejoignez les commerçants d'Afrique qui font confiance à HabaShop
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'linear-gradient(135deg, #6366F1, #14B8A6)',
            border: 'none', borderRadius: 12, padding: '14px 40px',
            color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 8px 28px rgba(99,102,241,0.40)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          Commencer maintenant <ArrowRight size={16} />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 2rem',
        textAlign: 'center',
        color: 'var(--text3)', fontSize: 12,
      }}>
        © 2026 HabaShop · Logiciel de gestion commerciale SaaS · Afrique francophone
      </footer>

    </div>
  )
}
