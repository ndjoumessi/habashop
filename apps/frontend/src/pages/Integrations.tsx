import { useAppStore } from '@/stores/appStore'
import { ExternalLink, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Integration {
  id: string; name: string; desc: string
  color: string; status: 'connected' | 'disconnected'
  endpoint: string; lastCall: string; calls: number; docs: string
  features: string[]
  IconSvg: () => JSX.Element
}

const IconAnthropicSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#FF6B35">
    <path d="M17.4 2H14l-5 14h3l1-3h5l1 3h3L17.4 2zm-4.8 8.5L14 6l1.4 4.5h-2.8z"/>
  </svg>
)

const IconTwilioSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#25D366">
    <circle cx="12" cy="12" r="10" opacity=".2"/>
    <circle cx="8.5" cy="8.5" r="2.5"/>
    <circle cx="15.5" cy="8.5" r="2.5"/>
    <circle cx="8.5" cy="15.5" r="2.5"/>
    <circle cx="15.5" cy="15.5" r="2.5"/>
  </svg>
)

const IconGoogleMapsSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/>
  </svg>
)

const IconRailwaySvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#8E2DFF">
    <path d="M3 6h18v2H3V6zm2 4h14v2H5v-2zm3 4h8v2H8v-2zm2 4h4v2h-4v-2z"/>
  </svg>
)

const IconVercelSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#FFFFFF">
    <path d="M12 2L2 19.5h20L12 2z"/>
  </svg>
)

const IconPrismaSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#5A67D8">
    <path d="M3 19.5L8 2l13 15.5-18 2z" opacity=".7"/>
    <path d="M8 2l13 15.5-5 2L8 2z"/>
  </svg>
)

const IconResendSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#6C47FF">
    <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm8 7L4.5 7.2v.9L12 13l7.5-4.9v-.9L12 12z"/>
  </svg>
)

const INTEGRATIONS_LIST: Integration[] = [
  {
    id:'anthropic', name:'Anthropic Claude',
    desc:'Assistant IA et analyses intelligentes',
    color:'#FF6B35', status:'connected',
    endpoint:'api.anthropic.com', lastCall:'Il y a 2 min', calls:1847,
    docs:'https://docs.anthropic.com',
    features:['Analyses IA temps réel', 'Recommandations personnalisées', 'Chat assistant intégré'],
    IconSvg: IconAnthropicSvg,
  },
  {
    id:'twilio', name:'Twilio WhatsApp',
    desc:'Envoi de tickets et marketing WhatsApp',
    color:'#25D366', status:'connected',
    endpoint:'api.twilio.com', lastCall:'Il y a 15 min', calls:342,
    docs:'https://twilio.com/docs',
    features:['Tickets de caisse par WhatsApp', 'Campagnes marketing', 'Notifications clients'],
    IconSvg: IconTwilioSvg,
  },
  {
    id:'resend', name:'Resend',
    desc:'Emails transactionnels — bienvenue, rappels, rapports',
    color:'#6C47FF', status:'connected',
    endpoint:'api.resend.com', lastCall:'Il y a 1h', calls:156,
    docs:'https://resend.com/docs',
    features:['Email de bienvenue à l\'inscription', 'Rappels d\'essai J-7 / J-3', 'Rapport hebdomadaire automatique'],
    IconSvg: IconResendSvg,
  },
  {
    id:'googlemaps', name:'Google Maps',
    desc:'Autocomplete adresses et carte clients',
    color:'#4285F4', status:'connected',
    endpoint:'maps.googleapis.com', lastCall:'Il y a 5 min', calls:2103,
    docs:'https://developers.google.com/maps',
    features:['Autocomplete d\'adresses', 'Géocodage des clients', 'Carte interactive'],
    IconSvg: IconGoogleMapsSvg,
  },
  {
    id:'railway', name:'Railway',
    desc:'Hébergement backend PostgreSQL + Node.js',
    color:'#8E2DFF', status:'connected',
    endpoint:'habashop-production.up.railway.app', lastCall:'Continu', calls:999999,
    docs:'https://railway.app',
    features:['PostgreSQL managé', 'Backend Node.js', 'Déploiement continu'],
    IconSvg: IconRailwaySvg,
  },
  {
    id:'vercel', name:'Vercel',
    desc:'Déploiement frontend React + CDN global',
    color:'#E0E0E0', status:'connected',
    endpoint:'habashop.vercel.app', lastCall:'Continu', calls:999999,
    docs:'https://vercel.com',
    features:['CDN global', 'Déploiements preview', 'HTTPS automatique'],
    IconSvg: IconVercelSvg,
  },
  {
    id:'prisma', name:'Prisma ORM',
    desc:'Accès base de données PostgreSQL',
    color:'#5A67D8', status:'connected',
    endpoint:'yamanote.proxy.rlwy.net', lastCall:'Continu', calls:8942,
    docs:'https://prisma.io',
    features:['ORM type-safe', 'Migrations versionnées', 'Requêtes optimisées'],
    IconSvg: IconPrismaSvg,
  },
]

export default function Integrations() {
  const { lang } = useAppStore()

  const configure = (itg: Integration) => {
    toast.success(lang === 'fr' ? `${itg.name} est géré automatiquement par HabaShop` : lang === 'es' ? `${itg.name} es gestionado automáticamente por HabaShop` : lang === 'it' ? `${itg.name} è gestito automaticamente da HabaShop` : `${itg.name} is managed automatically by HabaShop`)
  }

  const totalConnected = INTEGRATIONS_LIST.length
  const totalCalls     = INTEGRATIONS_LIST.reduce((acc, i) => acc + Math.min(i.calls, 100000), 0)

  const EMAIL_FLOWS = [
    { trigger: lang === 'fr' ? '🎉 Inscription' : '🎉 Signup',                   email: lang === 'fr' ? 'Email de bienvenue' : 'Welcome email',   delay: lang === 'fr' ? 'Immédiat' : 'Immediate' },
    { trigger: lang === 'fr' ? '⏰ J-7 avant expiration' : '⏰ D-7 before expiry', email: lang === 'fr' ? 'Rappel essai' : 'Trial reminder',         delay: 'Cron 1h' },
    { trigger: lang === 'fr' ? '🔴 J-3 avant expiration' : '🔴 D-3 before expiry', email: lang === 'fr' ? 'Rappel urgent' : 'Urgent reminder',       delay: 'Cron 1h' },
    { trigger: lang === 'fr' ? '🔒 Expiration' : '🔒 Expiry',                     email: lang === 'fr' ? 'Compte suspendu' : 'Account suspended',   delay: 'Cron 1h' },
    { trigger: lang === 'fr' ? '✅ Upgrade validé' : '✅ Upgrade approved',        email: lang === 'fr' ? 'Confirmation plan' : 'Plan confirmation', delay: lang === 'fr' ? 'Immédiat' : 'Immediate' },
    { trigger: lang === 'fr' ? '📊 Lundi 8h' : '📊 Monday 8am',                   email: lang === 'fr' ? 'Rapport hebdomadaire' : 'Weekly report',  delay: lang === 'fr' ? 'Cron hebdo' : 'Weekly cron' },
  ]

  return (
    <div className="space-y-5 animate-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fr' ? 'API & Intégrations' : lang === 'en' ? 'API & Integrations' : lang === 'es' ? 'Integraciones API' : 'Integrazioni API'}
          </h1>
          <p className="page-subtitle">
            {lang === 'fr' ? 'Services connectés et statuts en temps réel' : 'Connected services and real-time status'}
          </p>
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'8px 14px', borderRadius:12,
          background:'rgba(0,208,132,.08)', border:'1px solid rgba(0,208,132,.2)',
        }}>
          <div style={{
            width:8, height:8, borderRadius:'50%',
            background:'var(--acc2)',
            animation:'pulse 2s infinite',
          }} />
          <span style={{ fontSize:12, fontWeight:700, color:'var(--acc2)' }}>
            {totalConnected}/{INTEGRATIONS_LIST.length} {lang === 'fr' ? 'actives' : 'active'}
          </span>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { label:lang === 'fr' ? 'Intégrations' : 'Integrations', value:INTEGRATIONS_LIST.length, color:'var(--p2)'    },
          { label:lang === 'fr' ? 'Connectées'   : 'Connected',    value:totalConnected,            color:'var(--acc2)'  },
          { label:lang === 'fr' ? 'Appels API'   : 'API Calls',    value:`${(totalCalls/1000).toFixed(0)}K+`, color:'var(--acc)' },
          { label:lang === 'fr' ? 'Disponibilité': 'Uptime',       value:'99.9%',                   color:'var(--p3)'    },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Grid intégrations ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',
        gap:14,
      }}>
        {INTEGRATIONS_LIST.map(itg => {
          const isActive = itg.status === 'connected'
          const { IconSvg } = itg

          return (
            <div key={itg.id} style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:16, overflow:'hidden', transition:'all .18s ease',
              display:'flex', flexDirection:'column',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 12px 32px rgba(0,0,0,.4)'; el.style.borderColor = 'var(--border3)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderColor = 'var(--border)' }}
            >
              {/* Bande statut */}
              <div style={{ height:3, background: isActive ? 'linear-gradient(90deg,var(--acc2),#00B574)' : 'var(--border)' }} />

              <div style={{ padding:'20px', flex:1 }}>
                {/* Header */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
                  <div style={{
                    width:44, height:44, borderRadius:12, flexShrink:0,
                    background:'var(--bg3)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <IconSvg />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:5 }}>{itg.name}</div>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      padding:'3px 9px', borderRadius:99, fontSize:10, fontWeight:700,
                      background: isActive ? 'rgba(0,208,132,.12)' : 'rgba(136,136,168,.1)',
                      color: isActive ? 'var(--acc2)' : 'var(--text3)',
                      border: isActive ? '1px solid rgba(0,208,132,.25)' : '1px solid var(--border)',
                    }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background: isActive ? 'var(--acc2)' : 'var(--text4)', boxShadow: isActive ? '0 0 6px var(--acc2)' : 'none' }} />
                      {isActive
                        ? (lang === 'fr' ? 'Actif' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Active')
                        : (lang === 'fr' ? 'Inactif' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactive')}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, margin:'0 0 14px' }}>{itg.desc}</p>

                {/* Features */}
                {itg.features.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {itg.features.slice(0, 3).map((f, idx) => (
                      <div key={idx} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'var(--text3)' }}>
                        <Check size={12} strokeWidth={3} style={{ color:'var(--acc2)', flexShrink:0 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding:'12px 20px', borderTop:'1px solid var(--border)', background:'var(--bg3)',
                display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
              }}>
                <a href={itg.docs} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:11, color:'var(--text3)', textDecoration:'none', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}
                >
                  <ExternalLink size={11} /> Docs
                </a>
                <button type="button" onClick={() => configure(itg)}
                  aria-label={`${lang === 'fr' ? 'Configurer' : lang === 'es' ? 'Configurar' : lang === 'it' ? 'Configura' : 'Configure'} ${itg.name}`}
                  style={{
                    padding:'7px 14px', background:'rgba(108,71,255,.1)', border:'1px solid rgba(108,71,255,.2)',
                    borderRadius:8, fontSize:11, fontWeight:700, color:'var(--p3)', cursor:'pointer',
                    fontFamily:'var(--font)', minHeight:32, transition:'background .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,.1)' }}
                >
                  {lang === 'fr' ? 'Configurer' : lang === 'es' ? 'Configurar' : lang === 'it' ? 'Configura' : 'Configure'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Détail Resend — Emails transactionnels ── */}
      <div style={{
        background:'var(--card)', border:'1px solid rgba(108,71,255,.25)',
        borderRadius:18, overflow:'hidden',
      }}>
        <div style={{ height:3, background:'#6C47FF', boxShadow:'0 0 10px #6C47FF80' }} />
        <div style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <div style={{
              width:44, height:44, borderRadius:12, flexShrink:0,
              background:'rgba(108,71,255,.12)', border:'1px solid rgba(108,71,255,.3)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
            }}>📧</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                Resend — {lang === 'fr' ? 'Emails transactionnels' : 'Transactional emails'}
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.4 }}>
                {lang === 'fr'
                  ? 'Bienvenue, rappels d\'essai, confirmations d\'upgrade et rapports hebdomadaires.'
                  : 'Welcome, trial reminders, upgrade confirmations and weekly reports.'}
              </div>
            </div>
            <span style={{
              background:'rgba(0,208,132,.12)', border:'1px solid rgba(0,208,132,.25)',
              color:'var(--acc2)', borderRadius:20, padding:'3px 10px',
              fontSize:11, fontWeight:700, flexShrink:0,
            }}>
              ✅ {lang === 'fr' ? 'Actif — 6 emails configurés' : 'Active — 6 emails configured'}
            </span>
          </div>

          {/* Tableau des flows email */}
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg4)' }}>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>
                    {lang === 'fr' ? 'Déclencheur' : 'Trigger'}
                  </th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>
                    Email
                  </th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>
                    {lang === 'fr' ? 'Délai' : 'Timing'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {EMAIL_FLOWS.map((flow, i) => (
                  <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px', color:'var(--text2)' }}>{flow.trigger}</td>
                    <td style={{ padding:'8px 12px', color:'var(--text)', fontWeight:600 }}>{flow.email}</td>
                    <td style={{ padding:'8px 12px' }}>
                      <span style={{
                        background:'rgba(108,71,255,.1)', color:'var(--p3)',
                        borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600,
                      }}>{flow.delay}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stats Resend */}
          <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap' }}>
            {[
              { label: lang === 'fr' ? 'Emails/mois gratuits' : 'Free emails/month', value: '3 000' },
              { label: lang === 'fr' ? 'Taux de délivrabilité' : 'Delivery rate',     value: '99.8%' },
              { label: lang === 'fr' ? 'Domaine' : 'Domain',                          value: 'resend.dev' },
            ].map(stat => (
              <div key={stat.label} style={{
                flex:1, minWidth:140, background:'var(--bg3)',
                border:'1px solid var(--border)', borderRadius:10,
                padding:'10px 14px', textAlign:'center',
              }}>
                <div style={{ fontSize:16, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)' }}>{stat.value}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Légende ── */}
      <div style={{
        padding:'14px 18px', borderRadius:14,
        background:'rgba(108,71,255,.06)', border:'1px solid rgba(108,71,255,.15)',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      }}>
        <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.5 }}>
          <span style={{ color:'var(--p2)', fontWeight:700 }}>
            {lang === 'fr' ? 'Note :' : 'Note:'}
          </span>
          {' '}{lang === 'fr'
            ? 'Les intégrations marquées ∞ sont des services en cours d\'exécution permanente (backend, base de données, CDN).'
            : 'Integrations marked ∞ are continuously running services (backend, database, CDN).'}
        </div>
      </div>
    </div>
  )
}
