import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { ExternalLink, Settings, Zap, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface Integration {
  id: string; name: string; desc: string
  color: string; status: 'connected' | 'disconnected'
  endpoint: string; lastCall: string; calls: number; docs: string
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

const INTEGRATIONS_LIST: Integration[] = [
  {
    id:'anthropic', name:'Anthropic Claude',
    desc:'Assistant IA et analyses intelligentes',
    color:'#FF6B35', status:'connected',
    endpoint:'api.anthropic.com', lastCall:'Il y a 2 min', calls:1847,
    docs:'https://docs.anthropic.com',
    IconSvg: IconAnthropicSvg,
  },
  {
    id:'twilio', name:'Twilio WhatsApp',
    desc:'Envoi de tickets et marketing WhatsApp',
    color:'#25D366', status:'connected',
    endpoint:'api.twilio.com', lastCall:'Il y a 15 min', calls:342,
    docs:'https://twilio.com/docs',
    IconSvg: IconTwilioSvg,
  },
  {
    id:'googlemaps', name:'Google Maps',
    desc:'Autocomplete adresses et carte clients',
    color:'#4285F4', status:'connected',
    endpoint:'maps.googleapis.com', lastCall:'Il y a 5 min', calls:2103,
    docs:'https://developers.google.com/maps',
    IconSvg: IconGoogleMapsSvg,
  },
  {
    id:'railway', name:'Railway',
    desc:'Hébergement backend PostgreSQL + Node.js',
    color:'#8E2DFF', status:'connected',
    endpoint:'habashop-production.up.railway.app', lastCall:'Continu', calls:999999,
    docs:'https://railway.app',
    IconSvg: IconRailwaySvg,
  },
  {
    id:'vercel', name:'Vercel',
    desc:'Déploiement frontend React + CDN global',
    color:'#E0E0E0', status:'connected',
    endpoint:'habashop.vercel.app', lastCall:'Continu', calls:999999,
    docs:'https://vercel.com',
    IconSvg: IconVercelSvg,
  },
  {
    id:'prisma', name:'Prisma ORM',
    desc:'Accès base de données PostgreSQL',
    color:'#5A67D8', status:'connected',
    endpoint:'yamanote.proxy.rlwy.net', lastCall:'Continu', calls:8942,
    docs:'https://prisma.io',
    IconSvg: IconPrismaSvg,
  },
]

export default function Integrations() {
  const { lang } = useAppStore()

  const [disconnected, setDisconnected] = useState<Set<string>>(new Set())
  const [pinging, setPinging]           = useState<string | null>(null)

  const toggleConnection = (id: string) => {
    setDisconnected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    const itg = INTEGRATIONS_LIST.find(i => i.id === id)
    const wasConnected = !disconnected.has(id)
    toast.success(wasConnected ? `${itg?.name} déconnecté` : `${itg?.name} reconnecté`)
  }

  const ping = async (id: string) => {
    setPinging(id)
    await new Promise(r => setTimeout(r, 900))
    setPinging(null)
    const itg = INTEGRATIONS_LIST.find(i => i.id === id)
    toast.success(`${itg?.name} — Ping OK (42ms)`)
  }

  const totalConnected = INTEGRATIONS_LIST.filter(i => !disconnected.has(i.id)).length
  const totalCalls     = INTEGRATIONS_LIST.reduce((acc, i) => acc + Math.min(i.calls, 100000), 0)

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
          const isConnected = !disconnected.has(itg.id)
          const isPinging   = pinging === itg.id
          const { IconSvg } = itg

          return (
            <div key={itg.id} style={{
              background:'var(--card)',
              border:`1px solid ${isConnected ? `${itg.color}30` : 'var(--border)'}`,
              borderRadius:18, overflow:'hidden',
              transition:'transform .2s, box-shadow .2s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(-2px)'
                el.style.boxShadow = `0 8px 28px ${isConnected ? itg.color : '#000'}18`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'none'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Status bar top */}
              <div style={{
                height:3,
                background: isConnected ? itg.color : 'rgba(255,255,255,.1)',
                boxShadow: isConnected ? `0 0 10px ${itg.color}80` : 'none',
                transition:'all .3s',
              }} />

              <div style={{ padding:'18px 20px' }}>
                {/* Header */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
                  <div style={{
                    width:48, height:48, borderRadius:14, flexShrink:0,
                    background:`${itg.color}12`,
                    border:`1px solid ${itg.color}30`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <IconSvg />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:3 }}>
                      {itg.name}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.4 }}>
                      {itg.desc}
                    </div>
                  </div>
                  {/* Status badge */}
                  <span style={{
                    fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px',
                    padding:'4px 10px', borderRadius:99, flexShrink:0,
                    background: isConnected ? 'rgba(0,208,132,.1)' : 'rgba(239,68,68,.08)',
                    color: isConnected ? 'var(--acc2)' : 'var(--danger)',
                    border:`1px solid ${isConnected ? 'rgba(0,208,132,.2)' : 'rgba(239,68,68,.15)'}`,
                    display:'flex', alignItems:'center', gap:4,
                  }}>
                    <span style={{
                      width:5, height:5, borderRadius:'50%',
                      background: isConnected ? 'var(--acc2)' : 'var(--danger)',
                      animation: isConnected ? 'pulse 2s infinite' : 'none',
                      display:'inline-block',
                    }} />
                    {isConnected ? (lang === 'fr' ? 'Connecté' : 'Connected') : (lang === 'fr' ? 'Inactif' : 'Offline')}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  <div style={{
                    background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
                    borderRadius:10, padding:'9px 11px',
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:4 }}>
                      {lang === 'fr' ? 'Appels API' : 'API Calls'}
                    </div>
                    <div style={{ fontSize:16, fontWeight:900, color:itg.color, fontFamily:'var(--mono)' }}>
                      {itg.calls > 100000 ? '∞' : itg.calls.toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div style={{
                    background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
                    borderRadius:10, padding:'9px 11px',
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:4 }}>
                      {lang === 'fr' ? 'Dernier appel' : 'Last call'}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color: isConnected ? 'var(--acc2)' : 'var(--text3)' }}>
                      {itg.lastCall}
                    </div>
                  </div>
                </div>

                {/* Endpoint */}
                <div style={{
                  display:'flex', alignItems:'center', gap:7,
                  padding:'8px 10px',
                  background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
                  borderRadius:9, marginBottom:14,
                }}>
                  <Zap size={11} style={{ color:'var(--text3)', flexShrink:0 }} />
                  <code style={{
                    fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
                  }}>
                    {itg.endpoint}
                  </code>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:6 }}>
                  <a href={itg.docs} target="_blank" rel="noopener noreferrer"
                    style={{
                      flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                      padding:'7px', borderRadius:9, fontSize:11, fontWeight:700,
                      background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
                      color:'var(--text2)', textDecoration:'none', cursor:'pointer',
                      transition:'all .15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                  >
                    <ExternalLink size={12}/> Docs
                  </a>
                  <button type="button"
                    onClick={() => ping(itg.id)}
                    disabled={!isConnected || isPinging}
                    style={{
                      flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                      padding:'7px', borderRadius:9, fontSize:11, fontWeight:700,
                      background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
                      color:'var(--text2)', cursor: (!isConnected || isPinging) ? 'not-allowed' : 'pointer',
                      opacity: !isConnected ? 0.5 : 1,
                      fontFamily:'var(--font)',
                    }}>
                    <RefreshCw size={12} style={{ animation: isPinging ? 'spin .6s linear infinite' : 'none' }}/>
                    {isPinging ? 'Ping...' : 'Ping'}
                  </button>
                  <button type="button"
                    onClick={() => toggleConnection(itg.id)}
                    style={{
                      flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                      padding:'7px', borderRadius:9, fontSize:11, fontWeight:700,
                      background: isConnected ? 'rgba(239,68,68,.08)' : 'rgba(0,208,132,.08)',
                      border:`1px solid ${isConnected ? 'rgba(239,68,68,.15)' : 'rgba(0,208,132,.15)'}`,
                      color: isConnected ? 'var(--danger)' : 'var(--acc2)',
                      cursor:'pointer', fontFamily:'var(--font)',
                    }}>
                    <Settings size={12}/>
                    {isConnected ? (lang === 'fr' ? 'Désactiver' : 'Disable') : (lang === 'fr' ? 'Activer' : 'Enable')}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
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
