import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: '🛒', title: 'Caisse (POS)', desc: 'Encaissement rapide, catalogue filtrable, multi-modes de paiement, ticket imprimé ou WhatsApp, mode offline.' },
  { icon: '📦', title: 'Stock & Inventaire', desc: 'Alertes rupture en temps réel, CRUD produits, bon de commande automatique depuis la fiche produit.' },
  { icon: '📊', title: 'Rapports & Analyses', desc: 'KPIs par période, CA, marges, top produits, répartition paiements. Exports CSV et PDF en un clic.' },
  { icon: '👥', title: 'CRM Clients', desc: 'Fiches clients, types (gros/semi-gros/fidèle), programme de fidélité et historique d\'achats complet.' },
  { icon: '🧑‍💼', title: 'RH & Planning', desc: 'Fiches employés, planning hebdomadaire drag & drop, gestion des congés et suivi des présences.' },
  { icon: '🔐', title: 'Sécurité & RBAC', desc: 'Rôles et permissions granulaires, authentification 2FA TOTP, journal d\'audit immuable, multi-tenant.' },
]

const TESTIMONIALS = [
  { name: 'Mamadou Diallo', role: 'Grossiste · Dakar', avatar: 'MD', color: '#6C3FD6', quote: 'Depuis HabaShop, j\'ai une visibilité totale sur mon stock. Les alertes de rupture m\'ont sauvé plusieurs fois. Je recommande à tout commerçant africain.', stars: 5 },
  { name: 'Fatou Koné', role: 'Épicerie · Abidjan', avatar: 'FK', color: '#F59E0B', quote: 'La caisse est ultra-rapide et fonctionne même quand internet coupe. Mes caissières ont été formées en 30 minutes. Parfait pour notre commerce.', stars: 5 },
  { name: 'Ibrahim Touré', role: 'Demi-grossiste · Bamako', avatar: 'IT', color: '#10B981', quote: 'Les rapports de vente m\'aident à prendre de meilleures décisions d\'achat. L\'interface est claire et les données sont toujours à jour.', stars: 5 },
]

const PRICING = [
  {
    name: 'Starter', price: '15 000', period: '/mois', sub: 'Pour les petits commerces',
    pop: false,
    features: [
      { ok: true,  text: 'Caisse POS (1 caisse)' },
      { ok: true,  text: 'Gestion stock (500 produits)' },
      { ok: true,  text: 'Rapports de base' },
      { ok: true,  text: 'Support par email' },
      { ok: false, text: 'Multi-utilisateurs' },
      { ok: false, text: 'Module RH & Planning' },
    ],
    btn: 'light', btnText: 'Commencer gratuitement',
  },
  {
    name: 'Business', price: '35 000', period: '/mois', sub: 'Pour les commerces en croissance',
    pop: true, tag: '⭐ Le plus populaire',
    features: [
      { ok: true, text: 'Caisse POS (3 caisses)' },
      { ok: true, text: 'Stock illimité' },
      { ok: true, text: 'CRM Clients complet' },
      { ok: true, text: 'RH, Planning, Paie' },
      { ok: true, text: '5 utilisateurs inclus' },
      { ok: true, text: 'Support prioritaire' },
    ],
    btn: 'white', btnText: 'Essayer 14 jours',
  },
  {
    name: 'Enterprise', price: 'Sur devis', period: '', sub: 'Pour les réseaux de boutiques',
    pop: false,
    features: [
      { ok: true, text: 'Caisses illimitées' },
      { ok: true, text: 'Multi-boutiques' },
      { ok: true, text: 'Utilisateurs illimités' },
      { ok: true, text: 'API dédiée' },
      { ok: true, text: 'Onboarding sur site' },
      { ok: true, text: 'SLA garanti 99.9 %' },
    ],
    btn: 'outline', btnText: 'Nous contacter',
  },
]

const STEPS = [
  { num: '1', title: 'Créez votre boutique', desc: 'Inscription en 2 minutes. Configurez votre espace, ajoutez vos produits et votre équipe.' },
  { num: '2', title: 'Formez votre équipe', desc: 'Interface intuitive. Vos caissiers maîtrisent la caisse en moins d\'une heure.' },
  { num: '3', title: 'Encaissez & gérez', desc: 'POS rapide, gestion du stock en temps réel, alertes automatiques, rapports instantanés.' },
  { num: '4', title: 'Analysez & croissez', desc: 'Tableaux de bord, exports, tendances produits. Prenez de meilleures décisions chaque jour.' },
]

const FAQS = [
  { q: 'HabaShop fonctionne-t-il sans internet ?', a: 'Oui ! La caisse POS fonctionne en mode offline grâce à la technologie PWA. Les ventes sont stockées localement et synchronisées automatiquement au retour de la connexion.' },
  { q: 'Combien de temps prend l\'installation ?', a: 'Aucune installation requise ! HabaShop est un logiciel web (SaaS). Vous vous connectez depuis n\'importe quel navigateur. La configuration initiale prend moins de 30 minutes.' },
  { q: 'Mes données sont-elles sécurisées ?', a: 'Absolument. Vos données sont chiffrées, hébergées en Europe et sauvegardées quotidiennement. L\'authentification 2FA protège tous les accès. Conformité RGPD.' },
  { q: 'Puis-je gérer plusieurs boutiques ?', a: 'Oui, avec le plan Enterprise vous pouvez gérer un réseau de boutiques depuis un tableau de bord centralisé. Chaque boutique a ses propres données isolées.' },
  { q: 'Quelle devise est supportée ?', a: 'HabaShop supporte le Franc CFA (XOF), l\'Euro (EUR), le Dollar US (USD) et le Dollar canadien (CAD). La TVA est configurable par boutique.' },
]

const S = {
  lp: '#5B4EE8', lp2: '#7C6FF0', lp3: '#A78BFA',
  lbg: '#f8f7ff', lbg2: '#f0effe', lbg3: '#e8e5fd',
  ltext: '#0f0e1a', ltext2: '#6b6880', ltext3: '#9b98b0',
  lborder: 'rgba(91,78,232,.13)', lborder2: 'rgba(91,78,232,.25)',
  lcard: '#ffffff',
  lshadow: '0 8px 40px rgba(91,78,232,.12)',
  green: '#0EC47E', orange: '#F0A500',
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ background: S.lbg, color: S.ltext, fontFamily: "'Outfit', sans-serif", minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', padding: '0 48px', height: 68,
        background: 'rgba(248,247,255,.88)', backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${S.lborder}`,
        position: 'sticky', top: 0, zIndex: 100, gap: 14,
        boxShadow: `0 1px 0 ${S.lborder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 900, color: '#fff',
            boxShadow: '0 4px 18px rgba(91,78,232,.38)',
          }}>H</div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.5px', color: S.ltext }}>
            Haba<span style={{ color: S.lp }}>Shop</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['Fonctionnalités', 'Tarifs', 'FAQ'].map(l => (
            <a key={l} style={{
              color: S.ltext2, fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
              padding: '7px 14px', borderRadius: 9, transition: 'all .18s', cursor: 'pointer',
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = S.lbg2; (e.target as HTMLElement).style.color = S.ltext; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = S.ltext2; }}
            >{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {['FR','EN'].map(l => (
            <button key={l} style={{
              background: 'transparent', border: `1px solid ${S.lborder2}`,
              color: S.ltext2, borderRadius: 7, padding: '4px 10px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`,
            color: '#fff', borderRadius: 10, padding: '8px 22px', fontWeight: 700,
            boxShadow: '0 4px 18px rgba(91,78,232,.35)', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
            transition: 'all .2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 26px rgba(91,78,232,.45)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(91,78,232,.35)'; }}
        >Connexion →</button>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '100px 24px 80px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(180deg,${S.lbg2} 0%,${S.lbg} 60%)`,
      }}>
        <div style={{
          position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 900, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle,rgba(91,78,232,.12) 0%,transparent 70%)',
        }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#fff', border: `1px solid ${S.lborder2}`,
          borderRadius: 100, padding: '6px 16px 6px 10px',
          fontSize: 12, fontWeight: 600, color: S.lp, marginBottom: 28,
          boxShadow: '0 2px 12px rgba(91,78,232,.1)',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
          }}>🌍</div>
          Conçu pour l'Afrique francophone
        </div>

        <h1 style={{
          fontSize: 'clamp(36px,5.8vw,76px)', fontWeight: 900, lineHeight: 1.04,
          maxWidth: 900, marginBottom: 22, letterSpacing: '-3px', color: S.ltext,
        }}>
          Gérez votre commerce{' '}
          <span style={{
            background: `linear-gradient(135deg,${S.lp} 0%,${S.lp3} 50%,${S.orange} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>simplement et efficacement</span>
        </h1>

        <p style={{ color: S.ltext2, fontSize: 18, maxWidth: 580, lineHeight: 1.7, marginBottom: 40 }}>
          HabaShop centralise votre caisse, vos stocks, vos équipes et vos finances dans un seul outil — simple, rapide, et disponible même sans internet.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 72 }}>
          <button onClick={() => navigate('/login')} style={{
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`, color: '#fff', border: 'none',
            borderRadius: 13, padding: '15px 36px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 10px 32px rgba(91,78,232,.4)', transition: 'all .22s', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 48px rgba(91,78,232,.48)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(91,78,232,.4)'; }}
          >
            🚀 Démarrer gratuitement
          </button>
          <button onClick={() => navigate('/login')} style={{
            background: '#fff', color: S.ltext, border: `1.5px solid ${S.lborder2}`,
            borderRadius: 13, padding: '15px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            transition: 'all .22s', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            ▶ Voir la démo
          </button>
        </div>

        {/* Hero mock — aperçu dashboard */}
        <div style={{
          maxWidth: 960, width: '95%', margin: '0 auto',
          background: '#fff', border: `1px solid ${S.lborder}`,
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 60px 150px rgba(91,78,232,.22), 0 0 0 1px rgba(91,78,232,.08)',
          transform: 'perspective(1200px) rotateX(2deg)',
          transition: 'transform .4s ease', position: 'relative', zIndex: 1,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'perspective(1200px) rotateX(0deg)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'perspective(1200px) rotateX(2deg)'; }}
        >
          {/* Browser bar */}
          <div style={{ background: S.lbg2, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: `1px solid ${S.lborder}` }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
            <span style={{ color: S.ltext2, fontSize: 10.5, marginLeft: 8, fontFamily: 'SF Mono,monospace' }}>app.habashop.com/dashboard</span>
          </div>
          {/* App preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '168px 1fr', height: 240 }}>
            <div style={{ background: 'linear-gradient(180deg,#f4f2ff,#edeaff)', borderRight: `1px solid ${S.lborder}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {['🏠 Dashboard','🛒 POS','📦 Stock','🚚 Fournisseurs','👥 Clients','📊 Rapports'].map((item, i) => (
                <div key={item} style={{
                  padding: '7px 10px', borderRadius: 7, fontSize: 10.5,
                  color: i === 0 ? '#fff' : S.ltext2,
                  background: i === 0 ? S.lp : 'transparent',
                  fontWeight: i === 0 ? 700 : 400,
                  boxShadow: i === 0 ? '0 3px 10px rgba(91,78,232,.3)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>{item}</div>
              ))}
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { l: 'Ventes du jour', v: '842 000 F' },
                  { l: 'Articles stock', v: '3 248' },
                  { l: 'Employés actifs', v: '18/21' },
                  { l: 'CA mensuel', v: '2,65M F' },
                ].map(k => (
                  <div key={k.l} style={{ background: 'linear-gradient(135deg,#f8f7ff,#f0effe)', border: `1px solid ${S.lborder}`, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 8, color: S.ltext2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: .5 }}>{k.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.ltext }}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {[55,72,45,83,97,100,88].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0', minHeight: 4,
                    background: i === 6
                      ? 'linear-gradient(to top,#F0A500,#FCD34D)'
                      : `linear-gradient(to top,${S.lp},${S.lp3})`,
                    opacity: i === 6 ? 1 : 0.7,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        background: `linear-gradient(135deg,${S.lp},${S.lp2})`,
      }}>
        {[
          { v: '16', l: 'Modules intégrés' },
          { v: '100 %', l: 'Offline-ready' },
          { v: '4+', l: 'Devises supportées' },
          { v: '5+', l: 'Pays cibles' },
        ].map((s, i) => (
          <div key={s.l} style={{
            flex: 1, maxWidth: 220, padding: '40px 24px', textAlign: 'center',
            borderRight: i < 3 ? '1px solid rgba(255,255,255,.15)' : 'none',
          }}>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, color: '#fff', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>{s.v}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', fontWeight: 500 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section style={{ padding: '96px 24px', background: S.lbg }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{
            display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`,
            color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8,
          }}>FONCTIONNALITÉS</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>
            Tout ce dont vous avez besoin
          </h2>
          <p style={{ color: S.ltext2, fontSize: 16, maxWidth: 540, margin: '0 auto' }}>
            16 modules intégrés pour gérer chaque aspect de votre commerce
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 1060, margin: '0 auto' }}>
          {FEATURES.map(f => (
            <div key={f.title}
              style={{ background: '#fff', border: `1px solid ${S.lborder}`, borderRadius: 18, padding: 28, transition: 'all .25s', cursor: 'default', boxShadow: '0 2px 12px rgba(91,78,232,.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = S.lborder2; (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(91,78,232,.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.lborder; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(91,78,232,.05)'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,rgba(91,78,232,.12),rgba(124,111,240,.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16, border: `1px solid ${S.lborder2}` }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: S.ltext }}>{f.title}</div>
              <div style={{ color: S.ltext2, fontSize: 13.5, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '96px 24px', background: S.lbg2, borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>COMMENT ÇA MARCHE</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>Démarrez en 4 étapes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, maxWidth: 1060, margin: '0 auto' }}>
          {STEPS.map(s => (
            <div key={s.num} style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px', background: `linear-gradient(135deg,${S.lp},${S.lp2})`, color: '#fff', fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(91,78,232,.3)' }}>{s.num}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.ltext, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: S.ltext2, lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '96px 24px', background: '#fff', borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>TÉMOIGNAGES</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>Ils font confiance à HabaShop</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 1060, margin: '0 auto' }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: S.lbg, border: `1px solid ${S.lborder}`, borderRadius: 18, padding: 26 }}>
              <div style={{ color: S.orange, fontSize: 13, marginBottom: 12 }}>{'★'.repeat(t.stars)}</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: S.ltext, marginBottom: 16, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{t.avatar}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.ltext }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: S.ltext2 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding: '96px 24px', background: `linear-gradient(180deg,${S.lbg},${S.lbg2})`, borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>TARIFS</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>Des prix adaptés à l'Afrique</h2>
          <p style={{ color: S.ltext2, fontSize: 16 }}>14 jours d'essai gratuit — aucune carte requise</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 980, margin: '0 auto' }}>
          {PRICING.map(p => (
            <div key={p.name}
              style={{
                background: p.pop ? `linear-gradient(135deg,${S.lp},${S.lp2})` : '#fff',
                border: `1.5px solid ${p.pop ? 'transparent' : S.lborder}`,
                borderRadius: 22, padding: 32, transition: 'all .25s', position: 'relative',
                boxShadow: p.pop ? '0 20px 60px rgba(91,78,232,.38)' : '0 2px 16px rgba(91,78,232,.06)',
              }}
              onMouseEnter={e => { if (!p.pop) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 70px rgba(91,78,232,.14)'; } }}
              onMouseLeave={e => { if (!p.pop) { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(91,78,232,.06)'; } }}
            >
              {p.tag && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: S.lp, fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', border: `1.5px solid ${S.lborder2}`, boxShadow: '0 2px 8px rgba(91,78,232,.15)' }}>{p.tag}</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: p.pop ? 'rgba(255,255,255,.75)' : S.ltext2, marginBottom: 12 }}>{p.name}</div>
              <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -3, lineHeight: 1, color: p.pop ? '#fff' : S.ltext }}>
                {p.price}<span style={{ fontSize: 14, fontWeight: 500, opacity: .65, letterSpacing: 0 }}>{p.period} F CFA</span>
              </div>
              <div style={{ fontSize: 13, color: p.pop ? 'rgba(255,255,255,.65)' : S.ltext2, marginBottom: 24 }}>{p.sub}</div>
              <div style={{ height: 1, background: 'currentColor', opacity: .1, marginBottom: 20 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {p.features.map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: p.pop ? 'rgba(255,255,255,.9)' : (f.ok ? S.ltext : S.ltext3) }}>
                    <span style={{ fontSize: 14, color: p.pop ? '#fff' : (f.ok ? S.lp : S.ltext3) }}>{f.ok ? '✓' : '✗'}</span>
                    {f.text}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%', border: p.btn === 'outline' ? `1.5px solid ${S.lborder2}` : 'none',
                  borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                  background: p.btn === 'light' ? `linear-gradient(135deg,${S.lp},${S.lp2})` : p.btn === 'white' ? '#fff' : 'transparent',
                  color: p.btn === 'light' ? '#fff' : p.btn === 'white' ? S.lp : S.lp,
                  boxShadow: p.btn === 'light' ? '0 6px 20px rgba(91,78,232,.3)' : p.btn === 'white' ? '0 4px 16px rgba(0,0,0,.12)' : 'none',
                }}
              >{p.btnText}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '96px 24px', background: '#fff', borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>FAQ</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>Questions fréquentes</h2>
        </div>
        <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => (
            <details key={i} style={{ background: S.lbg, border: `1px solid ${S.lborder}`, borderRadius: 14, overflow: 'hidden' }}>
              <summary style={{ padding: '18px 22px', fontSize: 14.5, fontWeight: 700, color: S.ltext, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', listStyle: 'none' }}>
                {f.q} <span style={{ fontSize: 18, color: S.lp, flexShrink: 0 }}>+</span>
              </summary>
              <div style={{ padding: '0 22px 18px', fontSize: 14, color: S.ltext2, lineHeight: 1.75 }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: '100px 24px', textAlign: 'center',
        background: `linear-gradient(135deg,${S.lp},${S.lp2} 60%,${S.lp3})`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='1.5' fill='%23ffffff' fill-opacity='0.07'/%3E%3C/svg%3E\")" }} />
        <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 900, letterSpacing: -2, color: '#fff', marginBottom: 16, position: 'relative' }}>
          Prêt à moderniser votre commerce ?
        </h2>
        <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 17, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px', position: 'relative' }}>
          Rejoignez les commerçants d'Afrique qui font confiance à HabaShop
        </p>
        <button onClick={() => navigate('/login')} style={{
          background: '#fff', color: S.lp, border: 'none', borderRadius: 13,
          padding: '15px 40px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 12px 36px rgba(0,0,0,.2)', position: 'relative', fontFamily: 'inherit',
          transition: 'all .22s', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 50px rgba(0,0,0,.28)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 36px rgba(0,0,0,.2)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
        >
          🚀 Commencer maintenant — C'est gratuit
        </button>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 14, position: 'relative' }}>
          Aucune carte bancaire requise · 14 jours d'essai gratuit
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0f0e1a', color: 'rgba(255,255,255,.45)', padding: '36px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.7)', fontWeight: 700 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${S.lp},${S.lp2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>H</div>
          HabaShop
        </div>
        <span>© 2026 HabaShop · Logiciel SaaS pour commerces africains</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Confidentialité','CGU','Contact'].map(l => (
            <a key={l} style={{ color: 'rgba(255,255,255,.45)', textDecoration: 'none', cursor: 'pointer', transition: 'color .15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,.8)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,.45)'; }}
            >{l}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}
