import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { ExternalLink, RotateCw, Globe, Zap, Settings2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ResendMonitor from '@/components/integrations/ResendMonitor'

type PingState = 'checking' | 'ok' | 'slow' | 'error'

interface Integration {
  id: string; name: string; desc: string
  color: string; status: 'connected' | 'disconnected'
  endpoint: string; lastCall: string; calls: number; docs: string
  uptime: string
  pingUrl: string
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
    uptime:'99.9%', pingUrl:'https://api.anthropic.com',
    features:['Analyses IA temps réel', 'Recommandations personnalisées', 'Chat assistant intégré'],
    IconSvg: IconAnthropicSvg,
  },
  {
    id:'twilio', name:'Twilio WhatsApp',
    desc:'Envoi de tickets et marketing WhatsApp',
    color:'#25D366', status:'connected',
    endpoint:'api.twilio.com', lastCall:'Il y a 15 min', calls:342,
    docs:'https://twilio.com/docs',
    uptime:'99.9%', pingUrl:'https://api.twilio.com',
    features:['Tickets de caisse par WhatsApp', 'Campagnes marketing', 'Notifications clients'],
    IconSvg: IconTwilioSvg,
  },
  {
    id:'resend', name:'Resend',
    desc:'Emails transactionnels — bienvenue, rappels, rapports',
    color:'#6C47FF', status:'connected',
    endpoint:'api.resend.com', lastCall:'Il y a 1h', calls:156,
    docs:'https://resend.com/docs',
    uptime:'99.8%', pingUrl:'https://api.resend.com',
    features:['Email de bienvenue à l\'inscription', 'Rappels d\'essai J-7 / J-3', 'Rapport hebdomadaire automatique'],
    IconSvg: IconResendSvg,
  },
  {
    id:'googlemaps', name:'Google Maps',
    desc:'Autocomplete adresses et carte clients',
    color:'#4285F4', status:'connected',
    endpoint:'maps.googleapis.com', lastCall:'Il y a 5 min', calls:2103,
    docs:'https://developers.google.com/maps',
    uptime:'99.9%', pingUrl:'https://maps.googleapis.com',
    features:['Autocomplete d\'adresses', 'Géocodage des clients', 'Carte interactive'],
    IconSvg: IconGoogleMapsSvg,
  },
  {
    id:'railway', name:'Railway',
    desc:'Hébergement backend PostgreSQL + Node.js',
    color:'#8E2DFF', status:'connected',
    endpoint:'habashop-production.up.railway.app', lastCall:'Continu', calls:999999,
    docs:'https://railway.app',
    uptime:'99.9%', pingUrl:'https://habashop-production.up.railway.app',
    features:['PostgreSQL managé', 'Backend Node.js', 'Déploiement continu'],
    IconSvg: IconRailwaySvg,
  },
  {
    id:'vercel', name:'Vercel',
    desc:'Déploiement frontend React + CDN global',
    color:'#E0E0E0', status:'connected',
    endpoint:'habashop.vercel.app', lastCall:'Continu', calls:999999,
    docs:'https://vercel.com',
    uptime:'99.99%', pingUrl:'https://habashop.vercel.app',
    features:['CDN global', 'Déploiements preview', 'HTTPS automatique'],
    IconSvg: IconVercelSvg,
  },
  {
    id:'prisma', name:'Prisma ORM',
    desc:'Accès base de données PostgreSQL',
    color:'#5A67D8', status:'connected',
    endpoint:'yamanote.proxy.rlwy.net', lastCall:'Continu', calls:8942,
    docs:'https://prisma.io',
    uptime:'99.9%', pingUrl:'https://habashop-production.up.railway.app',
    features:['ORM type-safe', 'Migrations versionnées', 'Requêtes optimisées'],
    IconSvg: IconPrismaSvg,
  },
]

// Descriptions des services i18n (par id d'intégration)
const INTEGRATION_DESC_T: Record<string, Record<string, string>> = {
  anthropic:  { fr:'Assistant IA et analyses intelligentes',             en:'AI assistant and smart analytics',                es:'Asistente IA y análisis inteligentes',               it:'Assistente IA e analisi intelligenti' },
  twilio:     { fr:'Envoi de tickets et marketing WhatsApp',             en:'WhatsApp receipts and marketing',                 es:'Tickets y marketing por WhatsApp',                   it:'Ticket e marketing WhatsApp' },
  resend:     { fr:'Emails transactionnels — bienvenue, rappels, rapports', en:'Transactional emails — welcome, reminders, reports', es:'Emails transaccionales — bienvenida, recordatorios, informes', it:'Email transazionali — benvenuto, promemoria, report' },
  googlemaps: { fr:'Autocomplete adresses et carte clients',             en:'Address autocomplete and customer map',           es:'Autocompletado de direcciones y mapa clientes',      it:'Completamento indirizzi e mappa clienti' },
  railway:    { fr:'Hébergement backend PostgreSQL + Node.js',           en:'Backend hosting PostgreSQL + Node.js',            es:'Alojamiento backend PostgreSQL + Node.js',           it:'Hosting backend PostgreSQL + Node.js' },
  vercel:     { fr:'Déploiement frontend React + CDN global',            en:'Frontend deployment React + global CDN',          es:'Despliegue frontend React + CDN global',             it:'Deploy frontend React + CDN globale' },
  prisma:     { fr:'Accès base de données PostgreSQL',                   en:'PostgreSQL database access',                      es:'Acceso base de datos PostgreSQL',                    it:'Accesso database PostgreSQL' },
}
const integrationDesc = (itg: Integration, lang: string) =>
  INTEGRATION_DESC_T[itg.id]?.[lang] ?? itg.desc

// Bordure + glow d'une card selon le statut de ping :
//   ok (<500ms) vert · slow (≥500ms) orange · error (injoignable) rouge · sinon neutre
function statusVisual(status: PingState | undefined): { border: string; glow: string } {
  switch (status) {
    case 'ok':    return { border: '#10B981', glow: 'rgba(16,185,129,.15)' }
    case 'slow':  return { border: '#F59E0B', glow: 'rgba(245,158,11,.15)' }
    case 'error': return { border: '#EF4444', glow: 'rgba(239,68,68,.15)' }
    default:      return { border: 'var(--border)', glow: 'transparent' }
  }
}

export default function Integrations() {
  const { lang } = useAppStore()

  const [showResendMonitor, setShowResendMonitor] = useState(false)
  const [pingStatus, setPingStatus]   = useState<Record<string, PingState>>({})
  const [pingLatency, setPingLatency] = useState<Record<string, number>>({})

  const pingIntegration = async (id: string, url: string): Promise<{ status: PingState; ms: number }> => {
    setPingStatus(s => ({ ...s, [id]: 'checking' }))
    const start = Date.now()
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) })
      const ms = Date.now() - start
      const status: PingState = ms < 500 ? 'ok' : 'slow' // joignable → ok/slow ; échec → error (catch)
      setPingLatency(p => ({ ...p, [id]: ms }))
      setPingStatus(s => ({ ...s, [id]: status }))
      return { status, ms }
    } catch {
      setPingLatency(p => ({ ...p, [id]: 0 }))
      setPingStatus(s => ({ ...s, [id]: 'error' }))
      return { status: 'error', ms: 0 }
    }
  }

  // Bouton "Tester la connexion" : ping live + toast résultat
  const testConnection = async (itg: Integration) => {
    const { status, ms } = await pingIntegration(itg.id, itg.pingUrl)
    if (status === 'error') {
      toast.error(lang === 'en' ? '✗ Connection failed — check your configuration' : lang === 'es' ? '✗ Conexión fallida — verifique su configuración' : lang === 'it' ? '✗ Connessione fallita — verifica la configurazione' : '✗ Connexion échouée — vérifiez votre configuration')
    } else {
      toast.success(lang === 'en' ? `✓ ${itg.name} — Connection OK (${ms}ms)` : lang === 'es' ? `✓ ${itg.name} — Conexión OK (${ms}ms)` : lang === 'it' ? `✓ ${itg.name} — Connessione OK (${ms}ms)` : `✓ ${itg.name} — Connexion OK (${ms}ms)`)
    }
  }

  useEffect(() => {
    INTEGRATIONS_LIST.forEach(itg => { pingIntegration(itg.id, itg.pingUrl) })
  }, [])

  function PingBadge({ id }: { id: string }) {
    const status  = pingStatus[id] ?? 'checking'
    const latency = pingLatency[id]
    const configs: Record<PingState, { color: string; bg: string; label: string; dot: string }> = {
      checking: { color: 'var(--text4)',  bg: 'var(--bg4)',          label: '...',         dot: 'var(--text4)' },
      ok:       { color: 'var(--acc2)',    bg: 'rgba(0,208,132,.1)',  label: `${latency}ms`, dot: 'var(--acc2)' },
      slow:     { color: 'var(--acc)',     bg: 'rgba(255,184,0,.1)',  label: `${latency}ms`, dot: 'var(--acc)' },
      error:    { color: 'var(--danger)',  bg: 'rgba(255,59,92,.1)',  label: lang === 'fr' ? 'Injoignable' : lang === 'es' ? 'Inaccesible' : lang === 'it' ? 'Irraggiungibile' : 'Unreachable', dot: 'var(--danger)' },
    }
    const c = configs[status]
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: c.bg, color: c.color }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, boxShadow: status === 'ok' ? `0 0 5px ${c.dot}` : 'none', animation: (status === 'checking' || status === 'ok') ? 'pulse 1.5s infinite' : 'none' }} />
        {status === 'checking' ? (lang === 'fr' ? 'Vérification...' : lang === 'es' ? 'Verificando...' : lang === 'it' ? 'Verifica...' : 'Checking...') : c.label}
      </span>
    )
  }

  const configure = (itg: Integration) => {
    toast.success(lang === 'fr' ? `${itg.name} est géré automatiquement par HabaShop` : lang === 'es' ? `${itg.name} es gestionado automáticamente por HabaShop` : lang === 'it' ? `${itg.name} è gestito automaticamente da HabaShop` : `${itg.name} is managed automatically by HabaShop`)
  }

  const pingedIds   = Object.keys(pingStatus)
  const okCount     = pingedIds.filter(id => pingStatus[id] === 'ok' || pingStatus[id] === 'slow').length
  const anyError    = pingedIds.some(id => pingStatus[id] === 'error')
  const allChecked  = pingedIds.length === INTEGRATIONS_LIST.length && pingedIds.every(id => pingStatus[id] !== 'checking')
  const allOk       = allChecked && !anyError

  const totalConnected = INTEGRATIONS_LIST.length
  const totalCalls     = INTEGRATIONS_LIST.reduce((acc, i) => acc + Math.min(i.calls, 100000), 0)

  const EMAIL_FLOWS = [
    { trigger: lang === 'en' ? '🎉 Signup' : lang === 'es' ? '🎉 Registro' : lang === 'it' ? '🎉 Iscrizione' : '🎉 Inscription',                   email: lang === 'en' ? 'Welcome email' : lang === 'es' ? 'Email de bienvenida' : lang === 'it' ? 'Email di benvenuto' : 'Email de bienvenue',   delay: lang === 'en' ? 'Immediate' : lang === 'es' ? 'Inmediato' : lang === 'it' ? 'Immediato' : 'Immédiat' },
    { trigger: lang === 'en' ? '⏰ D-7 before expiry' : lang === 'es' ? '⏰ D-7 antes de expirar' : lang === 'it' ? '⏰ G-7 prima della scadenza' : '⏰ J-7 avant expiration', email: lang === 'en' ? 'Trial reminder' : lang === 'es' ? 'Recordatorio de prueba' : lang === 'it' ? 'Promemoria prova' : 'Rappel essai',         delay: 'Cron 1h' },
    { trigger: lang === 'en' ? '🔴 D-3 before expiry' : lang === 'es' ? '🔴 D-3 antes de expirar' : lang === 'it' ? '🔴 G-3 prima della scadenza' : '🔴 J-3 avant expiration', email: lang === 'en' ? 'Urgent reminder' : lang === 'es' ? 'Recordatorio urgente' : lang === 'it' ? 'Promemoria urgente' : 'Rappel urgent',       delay: 'Cron 1h' },
    { trigger: lang === 'en' ? '🔒 Expiry' : lang === 'es' ? '🔒 Expiración' : lang === 'it' ? '🔒 Scadenza' : '🔒 Expiration',                     email: lang === 'en' ? 'Account suspended' : lang === 'es' ? 'Cuenta suspendida' : lang === 'it' ? 'Account sospeso' : 'Compte suspendu',   delay: 'Cron 1h' },
    { trigger: lang === 'en' ? '✅ Upgrade approved' : lang === 'es' ? '✅ Upgrade aprobado' : lang === 'it' ? '✅ Upgrade approvato' : '✅ Upgrade validé',        email: lang === 'en' ? 'Plan confirmation' : lang === 'es' ? 'Confirmación de plan' : lang === 'it' ? 'Conferma piano' : 'Confirmation plan', delay: lang === 'en' ? 'Immediate' : lang === 'es' ? 'Inmediato' : lang === 'it' ? 'Immediato' : 'Immédiat' },
    { trigger: lang === 'en' ? '📊 Monday 8am' : lang === 'es' ? '📊 Lunes 8h' : lang === 'it' ? '📊 Lunedì 8' : '📊 Lundi 8h',                   email: lang === 'en' ? 'Weekly report' : lang === 'es' ? 'Informe semanal' : lang === 'it' ? 'Report settimanale' : 'Rapport hebdomadaire',  delay: lang === 'en' ? 'Weekly cron' : lang === 'es' ? 'Cron semanal' : lang === 'it' ? 'Cron settimanale' : 'Cron hebdo' },
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
            {lang === 'en' ? 'Connected services and real-time status' : lang === 'es' ? 'Servicios conectados y estados en tiempo real' : lang === 'it' ? 'Servizi connessi e stati in tempo reale' : 'Services connectés et statuts en temps réel'}
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
            {totalConnected}/{INTEGRATIONS_LIST.length} {lang === 'en' ? 'active' : lang === 'es' ? 'activas' : lang === 'it' ? 'attive' : 'actives'}
          </span>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { label:lang === 'en' ? 'Integrations' : lang === 'es' ? 'Integraciones' : lang === 'it' ? 'Integrazioni' : 'Intégrations', value:INTEGRATIONS_LIST.length, color:'var(--text)'  },
          { label:lang === 'en' ? 'Connected' : lang === 'es' ? 'Conectadas' : lang === 'it' ? 'Connesse' : 'Connectées',    value:totalConnected,            color:'var(--acc)'   },
          { label:lang === 'en' ? 'API Calls' : lang === 'es' ? 'Llamadas API' : lang === 'it' ? 'Chiamate API' : 'Appels API',    value:`${(totalCalls/1000).toFixed(0)}K+`, color:'var(--acc2)' },
          { label:lang === 'en' ? 'Uptime' : lang === 'es' ? 'Disponibilidad' : lang === 'it' ? 'Disponibilità' : 'Disponibilité',       value:'99.9%',                   color:'var(--p)'     },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Barre de santé globale ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12,
        background: allOk ? 'rgba(0,208,132,.06)' : anyError ? 'rgba(255,59,92,.06)' : 'var(--bg3)',
        border: `1px solid ${allOk ? 'rgba(0,208,132,.2)' : anyError ? 'rgba(255,59,92,.2)' : 'var(--border)'}`,
      }}>
        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: allOk ? 'var(--acc2)' : anyError ? 'var(--danger)' : 'var(--acc)', boxShadow: allOk ? '0 0 8px var(--acc2)' : 'none' }} />
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
          {allOk
            ? (lang === 'fr' ? 'Tous les services opérationnels' : lang === 'es' ? 'Todos los servicios operativos' : lang === 'it' ? 'Tutti i servizi operativi' : 'All services operational')
            : anyError
            ? (lang === 'fr' ? 'Certains services sont injoignables' : lang === 'es' ? 'Algunos servicios no responden' : lang === 'it' ? 'Alcuni servizi non rispondono' : 'Some services are unreachable')
            : (lang === 'fr' ? 'Vérification en cours...' : lang === 'es' ? 'Verificando...' : lang === 'it' ? 'Verifica in corso...' : 'Checking...')}
        </span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
          {okCount}/{INTEGRATIONS_LIST.length} OK
        </span>
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
          const sv = statusVisual(pingStatus[itg.id])
          const glowHover = sv.glow.replace('.15)', '.30)')

          return (
            <div key={itg.id} style={{
              background:'var(--card)', border:`1px solid ${sv.border}`,
              borderRadius:20, overflow:'hidden', transition:'all .3s ease',
              display:'flex', flexDirection:'column',
              boxShadow:`0 0 20px ${sv.glow}`,
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 8px 32px ${glowHover}` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = `0 0 20px ${sv.glow}` }}
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
                    <PingBadge id={itg.id} />
                  </div>
                  <button type="button" onClick={() => pingIntegration(itg.id, itg.pingUrl)}
                    title={lang === 'fr' ? 'Tester la connexion' : lang === 'es' ? 'Probar conexión' : lang === 'it' ? 'Testa connessione' : 'Test connection'}
                    aria-label={`${lang === 'fr' ? 'Tester' : lang === 'es' ? 'Probar' : lang === 'it' ? 'Testa' : 'Test'} ${itg.name}`}
                    style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <RotateCw size={12} style={{ animation: pingStatus[itg.id] === 'checking' ? 'spin .8s linear infinite' : 'none' }} />
                  </button>
                </div>

                {/* Description */}
                <p style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, margin:'0 0 12px' }}>{integrationDesc(itg, lang)}</p>

                {/* Stats API */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:10 }}>
                  {[
                    { label: lang === 'en' ? 'Calls/mo' : lang === 'es' ? 'Llamadas/mes' : lang === 'it' ? 'Chiamate/mese' : 'Appels/mois', value: itg.calls > 100000 ? '∞' : itg.calls.toLocaleString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR') },
                    { label: 'Uptime', value: itg.uptime },
                    { label: lang === 'en' ? 'Latency' : lang === 'es' ? 'Latencia' : lang === 'it' ? 'Latenza' : 'Latence', value: pingLatency[itg.id] ? `${pingLatency[itg.id]}ms` : '—' },
                  ].map(stat => (
                    <div key={stat.label} style={{ background:'var(--bg3)', borderRadius:8, padding:'7px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', fontFamily:'var(--mono)' }}>{stat.value}</div>
                      <div style={{ fontSize:9, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.4px', marginTop:2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Endpoint */}
                <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', background:'var(--bg4)', borderRadius:7, border:'1px solid var(--border)', fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)' }}>
                  <Globe size={10} style={{ flexShrink:0 }} />
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{itg.endpoint}</span>
                </div>
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
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button type="button" onClick={() => testConnection(itg)}
                    disabled={pingStatus[itg.id] === 'checking'}
                    aria-label={`${lang === 'fr' ? 'Tester' : lang === 'es' ? 'Probar' : lang === 'it' ? 'Testa' : 'Test'} ${itg.name}`}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px',
                      background:'color-mix(in srgb, var(--p) 12%, transparent)', border:'1px solid var(--p)',
                      borderRadius:8, fontSize:11, fontWeight:700, color:'var(--p3)',
                      cursor: pingStatus[itg.id] === 'checking' ? 'wait' : 'pointer',
                      fontFamily:'var(--font)', minHeight:32, transition:'background .15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--p) 22%, transparent)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--p) 12%, transparent)' }}
                  >
                    {pingStatus[itg.id] === 'checking'
                      ? <Loader2 size={11} style={{ animation:'spin .8s linear infinite' }} />
                      : <Zap size={11} />}
                    {lang === 'fr' ? 'Tester' : lang === 'en' ? 'Test' : lang === 'es' ? 'Probar' : 'Testa'}
                  </button>
                  <button type="button" onClick={() => configure(itg)}
                    aria-label={`${lang === 'fr' ? 'Configurer' : lang === 'es' ? 'Configurar' : lang === 'it' ? 'Configura' : 'Configure'} ${itg.name}`}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px', background:'transparent',
                      border:'1px solid var(--border)', borderRadius:8, fontSize:11, fontWeight:700,
                      color:'var(--text3)', cursor:'pointer', fontFamily:'var(--font)', minHeight:32, transition:'all .15s',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.color = 'var(--text)'; el.style.borderColor = 'var(--border2)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.color = 'var(--text3)'; el.style.borderColor = 'var(--border)' }}
                  >
                    <Settings2 size={11} /> {lang === 'fr' ? 'Configurer' : lang === 'es' ? 'Configurar' : lang === 'it' ? 'Configura' : 'Configure'}
                  </button>
                </div>
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
                Resend — {lang === 'en' ? 'Transactional emails' : lang === 'es' ? 'Emails transaccionales' : lang === 'it' ? 'Email transazionali' : 'Emails transactionnels'}
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.4 }}>
                {lang === 'en' ? 'Welcome, trial reminders, upgrade confirmations and weekly reports.' : lang === 'es' ? 'Bienvenida, recordatorios de prueba, confirmaciones de upgrade e informes semanales.' : lang === 'it' ? 'Benvenuto, promemoria di prova, conferme di upgrade e report settimanali.' : 'Bienvenue, rappels d\'essai, confirmations d\'upgrade et rapports hebdomadaires.'}
              </div>
            </div>
            <span style={{
              background:'rgba(0,208,132,.12)', border:'1px solid rgba(0,208,132,.25)',
              color:'var(--acc2)', borderRadius:20, padding:'3px 10px',
              fontSize:11, fontWeight:700, flexShrink:0,
            }}>
              ✅ {lang === 'en' ? 'Active — 6 emails configured' : lang === 'es' ? 'Activo — 6 emails configurados' : lang === 'it' ? 'Attivo — 6 email configurate' : 'Actif — 6 emails configurés'}
            </span>
          </div>

          {/* Tableau des flows email */}
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg4)' }}>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>
                    {lang === 'en' ? 'Trigger' : lang === 'es' ? 'Disparador' : lang === 'it' ? 'Attivazione' : 'Déclencheur'}
                  </th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>
                    Email
                  </th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>
                    {lang === 'en' ? 'Timing' : lang === 'es' ? 'Plazo' : lang === 'it' ? 'Tempistica' : 'Délai'}
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
              { label: lang === 'en' ? 'Free emails/month' : lang === 'es' ? 'Emails/mes gratuitos' : lang === 'it' ? 'Email/mese gratuite' : 'Emails/mois gratuits', value: '3 000' },
              { label: lang === 'en' ? 'Delivery rate' : lang === 'es' ? 'Tasa de entrega' : lang === 'it' ? 'Tasso di recapito' : 'Taux de délivrabilité',     value: '99.8%' },
              { label: lang === 'en' ? 'Domain' : lang === 'es' ? 'Dominio' : lang === 'it' ? 'Dominio' : 'Domaine',                          value: 'resend.dev' },
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

          {/* ── Monitoring temps réel (accordéon, fermé par défaut) ── */}
          <div style={{ marginTop:12 }}>
            <button
              type="button"
              onClick={() => setShowResendMonitor(v => !v)}
              aria-expanded={showResendMonitor}
              aria-label={lang === 'en' ? 'Toggle real-time monitoring' : lang === 'es' ? 'Mostrar el monitoreo en tiempo real' : lang === 'it' ? 'Mostra il monitoraggio in tempo reale' : 'Afficher le monitoring temps réel'}
              style={{
                width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 12px',
                background: showResendMonitor ? 'rgba(108,71,255,.08)' : 'var(--bg3)',
                border:`1px solid ${showResendMonitor ? 'rgba(108,71,255,.2)' : 'var(--border)'}`,
                borderRadius:10, cursor:'pointer', fontFamily:'var(--font)',
                color:'var(--text2)', fontSize:12, fontWeight:700, transition:'all .15s ease',
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                {lang === 'en' ? 'Real-time monitoring' : lang === 'es' ? 'Monitoreo en tiempo real' : lang === 'it' ? 'Monitoraggio in tempo reale' : 'Monitoring temps réel'}
                <span style={{
                  padding:'1px 7px', borderRadius:99, fontSize:9, fontWeight:800,
                  background:'rgba(0,208,132,.1)', color:'var(--acc2)',
                  border:'1px solid rgba(0,208,132,.2)', textTransform:'uppercase', letterSpacing:'.3px',
                }}>live</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: showResendMonitor ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s ease' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showResendMonitor && (
              <div style={{ marginTop:8, padding:'14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
                <ResendMonitor lang={lang} />
              </div>
            )}
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
            {lang === 'en' ? 'Note:' : lang === 'es' ? 'Nota:' : lang === 'it' ? 'Nota:' : 'Note :'}
          </span>
          {' '}{lang === 'en' ? 'Integrations marked ∞ are continuously running services (backend, database, CDN).' : lang === 'es' ? 'Las integraciones marcadas con ∞ son servicios en ejecución permanente (backend, base de datos, CDN).' : lang === 'it' ? 'Le integrazioni contrassegnate con ∞ sono servizi in esecuzione permanente (backend, database, CDN).' : 'Les intégrations marquées ∞ sont des services en cours d\'exécution permanente (backend, base de données, CDN).'}
        </div>
      </div>
    </div>
  )
}
