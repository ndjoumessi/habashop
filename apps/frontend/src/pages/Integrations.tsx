import { useState, useEffect, useMemo } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import {
  ExternalLink, RotateCw, Globe, Zap, Settings2, X, KeyRound,
  // ⚠️ Icônes des déclencheurs d'e-mail : Lucide, jamais d'emoji (§ Conventions).
  Mail, UserPlus, Clock, AlertTriangle, Lock, CheckCircle2, BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Button from '@/components/ui/AppButton'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { useModalFocus } from '@/hooks/useModalFocus'
import { paymentStatsApi, paydunyaApi, integrationStatusApi, type ProviderStat, type IntegrationState, type MerchantIntegrationId } from '@/lib/api'
import toast from 'react-hot-toast'

type PingState = 'checking' | 'ok' | 'slow' | 'error'

export interface Integration {
  id: string; name: string; desc: string
  color: string
  /**
   * ⚠️ `declared`, PAS `status` — et le nom est le correctif.
   *
   * Ce champ est un LITTÉRAL du dépôt : il dit ce que l'équipe a câblé, jamais ce qui
   * fonctionne. Il s'appelait `status: 'connected'` et alimentait une bande verte, un
   * compteur « connectées » et une pastille de santé — trois affirmations sur le monde
   * tirées d'un fichier TypeScript. Un nom qui ment est plus coûteux qu'une valeur fausse :
   * il fait relire le code sans y voir le défaut.
   *
   * L'état RÉEL vient de `GET /api/integrations/status` (secrets posés côté serveur) et
   * de la sonde de joignabilité. Ne jamais rendre `declared` comme un état vérifié :
   * `OpsInfrastructure` l'affiche en gris, sous une légende qui dit ce que c'est.
   */
  declared: 'configured' | 'absent'
  endpoint: string; docs: string
  pingUrl: string
  features: string[]
  IconSvg: () => JSX.Element
  // Champs optionnels pour les intégrations paiement
  paymentStatus?: 'sandbox' | 'production' | 'unconfigured'
  countries?: string   // drapeaux + noms pays, affiché sous la description
  noPing?: boolean     // sauter le ping auto (pas d'endpoint public testable)
}

/**
 * Carte COMMERÇANT : la déclaration du dépôt + l'état MESURÉ côté serveur.
 * `status`/`paymentStatus` n'existent que sur cette forme dérivée — jamais dans le catalogue.
 */
export type MerchantCard = Integration & {
  status: 'connected' | 'disconnected'
  paymentStatus: 'sandbox' | 'production' | 'unconfigured'
}

// ── Répartition par PUBLIC (étape 1bis) ──────────────────────────────────────
// MERCHANT : ses moyens d'encaissement + canaux (paiements + notifications) — il doit
// pouvoir vérifier que Wave répond avant d'ouvrir sa caisse. OPS : l'infrastructure
// (base/hébergement/monitoring) — aucun intérêt commerçant, et ça publierait la stack
// à tous les clients. La console opérateur consomme OPS via `OpsInfrastructure`.
export const MERCHANT_CATS = new Set(['payments', 'notifications'])
export const OPS_CATS = new Set(['database', 'hosting', 'monitoring'])

// ── Catégories (regroupement des cartes) ─────────────────────────────────────
export const CATEGORIES: { key: string; label: Record<string, string> }[] = [
  { key: 'payments',      label: { fr: 'Paiements',           en: 'Payments',          es: 'Pagos',              it: 'Pagamenti' } },
  { key: 'notifications', label: { fr: 'Notifications',        en: 'Notifications',     es: 'Notificaciones',     it: 'Notifiche' } },
  { key: 'database',      label: { fr: 'Base de données',      en: 'Database',          es: 'Base de datos',      it: 'Database' } },
  { key: 'hosting',       label: { fr: 'Hébergement',          en: 'Hosting',           es: 'Alojamiento',        it: 'Hosting' } },
  { key: 'monitoring',    label: { fr: 'Monitoring & IA',      en: 'Monitoring & AI',   es: 'Monitoreo e IA',     it: 'Monitoraggio e IA' } },
]

export const CATEGORY_OF: Record<string, string> = {
  mtnmomo: 'payments', campay: 'payments', paydunya: 'payments',
  twilio: 'notifications', resend: 'notifications',
  prisma: 'database', redis: 'database',
  railway: 'hosting', vercel: 'hosting',
  sentry: 'monitoring', anthropic: 'monitoring', googlemaps: 'monitoring',
}

// Version d'API exposée (facteur de confiance, affichée dans le bandeau endpoint)
export const API_VERSION: Record<string, string> = {
  anthropic: 'Claude API', twilio: 'API 2010-04-01', resend: 'API v1',
  googlemaps: 'JS API v3', railway: 'Platform', vercel: 'Platform', prisma: 'Prisma 5',
  mtnmomo: 'MoMo API v1.0', campay: 'API v2', paydunya: 'API v1',
  sentry: 'SDK 8.x', redis: 'Redis 7',
}

// Méthodes de paiement supportées (pills) — cartes paiement uniquement
const METHODS: Record<string, string[]> = {
  mtnmomo: ['USSD Push', 'MTN MoMo'],
  campay:  ['Orange Money', 'Visa/MC', 'USSD Push'],
  paydunya:['Wave', 'Orange Money', 'Free Money', 'Visa/MC'],
}

// Détail factuel sous la description (infra)
export const CARD_DETAIL: Record<string, Record<string, string>> = {
  prisma: { fr: '22 modèles · migration 10/06/2026', en: '22 models · migration 2026-06-10', es: '22 modelos · migración 10/06/2026', it: '22 modelli · migrazione 10/06/2026' },
  redis:  { fr: 'Cache rapports comptables & sessions', en: 'Accounting reports & session cache', es: 'Caché de informes y sesiones', it: 'Cache report e sessioni' },
  sentry: { fr: 'Suivi des erreurs front + back', en: 'Front + back error tracking', es: 'Seguimiento de errores front + back', it: 'Tracciamento errori front + back' },
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

const IconMtnSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <circle cx="12" cy="12" r="11" fill="#FFCC00"/>
    <polyline points="4,17 4,7 12,14 20,7 20,17" fill="none" stroke="#000" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
)

const IconCampaySvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <circle cx="12" cy="12" r="11" fill="#FFF3EC"/>
    <path d="M17.5 8A7 7 0 1 0 17.5 16" stroke="#FF6B00" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
  </svg>
)

const IconPayDunyaSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <circle cx="12" cy="12" r="11" fill="#1B4DFF"/>
    <path d="M9 5v14h2v-6h3.5a4.5 4.5 0 0 0 0-9H9zm2 2h3.5a2.5 2.5 0 0 1 0 5H11V7z" fill="#fff"/>
  </svg>
)

const IconSentrySvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#8E5CD9">
    <path d="M12 2.5c.7 0 1.34.37 1.69.97l7.9 13.6c.36.62.36 1.38 0 2-.35.62-1 .99-1.71.99h-3.2a8.7 8.7 0 0 0-4.68-7.9l1.06-1.83a10.8 10.8 0 0 1 5.72 9.66l1.38.02-7.88-13.6L4.4 19.6h2.3a6.6 6.6 0 0 1 3.1-5.04l1.05 1.82A4.5 4.5 0 0 0 8.7 19.6c0 .19.27.4.6.4h2.3c.36 0 .6-.27.6-.5a6.5 6.5 0 0 0-2.5-5.13l2.6-4.5-.01-.01A1.95 1.95 0 0 1 12 2.5z"/>
  </svg>
)

const IconRedisSvg = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#DC382D">
    <path d="M12 4l8 3-8 3-8-3 8-3zm-8 6l8 3 8-3v3l-8 3-8-3v-3zm0 5l8 3 8-3v3l-8 3-8-3v-3z"/>
  </svg>
)

export const INTEGRATIONS_LIST: Integration[] = [
  {
    id:'anthropic', name:'Anthropic Claude',
    desc:'Assistant IA et analyses intelligentes',
    color:'#FF6B35', declared:'configured',
    endpoint:'api.anthropic.com',
    docs:'https://docs.anthropic.com', pingUrl:'https://api.anthropic.com',
    features:['Analyses IA temps réel', 'Recommandations personnalisées', 'Chat assistant intégré'],
    IconSvg: IconAnthropicSvg,
  },
  {
    id:'twilio', name:'Twilio WhatsApp',
    desc:'Envoi de tickets et marketing WhatsApp',
    color:'#25D366', declared:'configured',
    endpoint:'api.twilio.com',
    docs:'https://twilio.com/docs', pingUrl:'https://api.twilio.com',
    features:['Tickets de caisse par WhatsApp', 'Campagnes marketing', 'Notifications clients'],
    IconSvg: IconTwilioSvg,
  },
  {
    id:'resend', name:'Resend',
    desc:'Emails transactionnels — bienvenue, rappels, rapports',
    color:'#6C47FF', declared:'configured',
    endpoint:'api.resend.com',
    docs:'https://resend.com/docs', pingUrl:'https://api.resend.com',
    features:['Email de bienvenue à l\'inscription', 'Rappels d\'essai J-7 / J-3', 'Rapport hebdomadaire automatique'],
    IconSvg: IconResendSvg,
  },
  {
    id:'googlemaps', name:'Google Maps',
    desc:'Autocomplete adresses et carte clients',
    color:'#4285F4', declared:'configured',
    endpoint:'maps.googleapis.com',
    docs:'https://developers.google.com/maps', pingUrl:'https://maps.googleapis.com',
    features:['Autocomplete d\'adresses', 'Géocodage des clients', 'Carte interactive'],
    IconSvg: IconGoogleMapsSvg,
  },
  {
    id:'railway', name:'Railway',
    desc:'Hébergement backend PostgreSQL + Node.js',
    color:'#8E2DFF', declared:'configured',
    endpoint:'habashop-production.up.railway.app',
    docs:'https://railway.app', pingUrl:'https://habashop-production.up.railway.app',
    features:['PostgreSQL managé', 'Backend Node.js', 'Déploiement continu'],
    IconSvg: IconRailwaySvg,
  },
  {
    id:'vercel', name:'Vercel',
    desc:'Déploiement frontend React + CDN global',
    color:'#E0E0E0', declared:'configured',
    endpoint:'habashop.vercel.app',
    docs:'https://vercel.com', pingUrl:'https://habashop.vercel.app',
    features:['CDN global', 'Déploiements preview', 'HTTPS automatique'],
    IconSvg: IconVercelSvg,
  },
  {
    id:'prisma', name:'Prisma ORM',
    desc:'Accès base de données PostgreSQL',
    color:'#5A67D8', declared:'configured',
    endpoint:'yamanote.proxy.rlwy.net',
    docs:'https://prisma.io', pingUrl:'https://habashop-production.up.railway.app',
    features:['ORM type-safe', 'Migrations versionnées', 'Requêtes optimisées'],
    IconSvg: IconPrismaSvg,
  },
  {
    id:'redis', name:'Redis',
    desc:'Cache rapports comptables et sessions',
    color:'#DC382D', declared:'configured',
    endpoint:'redis.railway.internal',
    docs:'https://redis.io/docs', pingUrl:'',
    features:['Cache rapports', 'Sessions', 'Faible latence'],
    IconSvg: IconRedisSvg,
    noPing: true,
  },
  {
    id:'sentry', name:'Sentry',
    desc:'Suivi des erreurs front + back temps réel',
    color:'#8E5CD9', declared:'configured',
    endpoint:'haba-76.sentry.io',
    docs:'https://haba-76.sentry.io/projects/habashop-web/', pingUrl:'',
    features:['Erreurs front', 'Erreurs back', 'Source maps au build'],
    IconSvg: IconSentrySvg,
    noPing: true,
  },
  {
    id:'mtnmomo', name:'MTN MoMo',
    desc:'Paiement mobile USSD push — 40+ pays MTN',
    color:'#FFCC00', declared:'configured',
    endpoint:'sandbox.momodeveloper.mtn.com',
    docs:'https://momodeveloper.mtn.com', pingUrl:'',
    features:['USSD push', 'Polling statut', 'Cameroun · CIV · Bénin'],
    IconSvg: IconMtnSvg,
    paymentStatus: 'sandbox',
    countries: '🇨🇲 🇨🇮 🇧🇯 🇸🇳 🇬🇭',
    noPing: true,
  },
  {
    id:'campay', name:'Campay',
    desc:'Orange Money + Visa/Mastercard — Cameroun & Gabon',
    color:'#FF6B00', declared:'configured',
    endpoint:'demo.campay.net',
    docs:'https://docs.campay.net', pingUrl:'',
    features:['Orange Money USSD', 'Carte Visa/Mastercard', 'QR code hébergé'],
    IconSvg: IconCampaySvg,
    paymentStatus: 'sandbox',
    countries: '🇨🇲 🇬🇦',
    noPing: true,
  },
  {
    id:'paydunya', name:'PayDunya',
    desc:'Wave · Orange Money · Visa — Sénégal, CIV, Mali',
    color:'#1B4DFF', declared:'absent',
    endpoint:'app.paydunya.com',
    docs:'https://paydunya.com/docs', pingUrl:'',
    features:['Wave', 'Orange Money', 'Carte Visa/Mastercard'],
    IconSvg: IconPayDunyaSvg,
    paymentStatus: 'unconfigured',
    countries: '🇸🇳 🇨🇮 🇲🇱 🇧🇯 🇬🇼',
    noPing: true,
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
  mtnmomo:    { fr:'Paiement mobile USSD push — 40+ pays MTN',           en:'USSD push mobile payment — 40+ MTN countries',     es:'Pago móvil USSD push — 40+ países MTN',              it:'Pagamento mobile USSD push — 40+ paesi MTN' },
  campay:     { fr:'Orange Money + Visa/Mastercard — Cameroun & Gabon',  en:'Orange Money + Visa/Mastercard — Cameroon & Gabon', es:'Orange Money + Visa/Mastercard — Camerún y Gabón',   it:'Orange Money + Visa/Mastercard — Camerun e Gabon' },
  paydunya:   { fr:'Wave · Orange Money · Free Money · Visa — Sénégal, CIV, Mali', en:'Wave · Orange Money · Free Money · Visa — Senegal, Ivory Coast, Mali', es:'Wave · Orange Money · Free Money · Visa — Senegal, CIV, Malí', it:'Wave · Orange Money · Free Money · Visa — Senegal, CIV, Mali' },
  redis:      { fr:'Cache rapports comptables et sessions',             en:'Accounting reports and session cache',            es:'Caché de informes contables y sesiones',             it:'Cache report contabili e sessioni' },
  sentry:     { fr:'Suivi des erreurs front + back temps réel',         en:'Real-time front + back error tracking',           es:'Seguimiento de errores front + back en tiempo real', it:'Tracciamento errori front + back in tempo reale' },
}
const integrationDesc = (itg: Integration, lang: string) =>
  INTEGRATION_DESC_T[itg.id]?.[lang] ?? itg.desc

// Bordure + glow d'une card selon le statut de ping :
//   ok (<500ms) vert · slow (≥500ms) orange · error (injoignable) rouge · sinon neutre
function statusVisual(status: PingState | undefined): { border: string; glow: string } {
  switch (status) {
    case 'ok':    return { border: 'var(--acc2)',   glow: 'color-mix(in srgb, var(--acc2) 15%, transparent)' }
    case 'slow':  return { border: 'var(--warn)',   glow: 'color-mix(in srgb, var(--warn) 15%, transparent)' }
    case 'error': return { border: 'var(--danger)', glow: 'color-mix(in srgb, var(--danger) 15%, transparent)' }
    default:      return { border: 'var(--border)', glow: 'transparent' }
  }
}

export default function Integrations() {
  const { lang } = useAppStore()
  const fmt = useFormatAmount()

  const [pingStatus, setPingStatus]   = useState<Record<string, PingState>>({})
  const [pingLatency, setPingLatency] = useState<Record<string, number>>({})
  const [payDunyaOpen, setPayDunyaOpen] = useState(false)
  const [txStats, setTxStats] = useState<{ mtn: ProviderStat; campay: ProviderStat; paydunya: ProviderStat } | null>(null)
  /**
   * ⚠️ SOMME DÉFENSIVE — `txStats` peut être TRUTHY sans porter les clés attendues,
   * et `txStats.mtn.count` faisait alors planter l'écran ENTIER : page BLANCHE, pas
   * dégradation. Trouvé par le balayage des écrans complets du 2026-08-13, sur une
   * réponse de forme inattendue.
   * La forme est aujourd'hui garantie par `computePaymentStats` côté serveur — mais
   * une justesse qui dépend d'un invariant DISTANT et que rien n'enregistre disparaît
   * au premier changement de contrat, sans qu'aucune suite ne rougisse.
   * ⚠️ On rend « — », JAMAIS 0 ni une somme PARTIELLE : un total amputé d'un
   * prestataire est un chiffre faux, et un chiffre faux se retient.
   */
  const txCount: number | null = (() => {
    if (!txStats) return null
    const n = [txStats.mtn, txStats.campay].map(p => p?.count)
    return n.every(c => typeof c === 'number') ? (n as number[]).reduce((a, b) => a + b, 0) : null
  })()
  const [paydunyaCfg, setPaydunyaCfg] = useState<{ configured: boolean; mode: 'test' | 'live'; methods: string[] } | null>(null)
  const [states, setStates] = useState<Record<MerchantIntegrationId, IntegrationState> | null>(null)

  // Transactions paiement du jour (MTN MoMo + Campay) — données réelles backend.
  useEffect(() => {
    paymentStatsApi.today().then(setTxStats).catch(() => setTxStats(null))
  }, [])

  // Méthodes PayDunya réellement proposées (liste renvoyée par le backend).
  useEffect(() => {
    paydunyaApi.config().then(setPaydunyaCfg).catch(() => setPaydunyaCfg(null))
  }, [])

  /**
   * ÉTAT RÉEL des intégrations — dérivé de l'environnement serveur, jamais du dépôt.
   *
   * ⚠️ MESURÉ le 2026-08-06 : `INTEGRATIONS_LIST` portait `declared:'configured'` en LITTÉRAL
   * sur 11 des 12 entrées. Le commerçant lisait « connectées » en vert sur des prestataires
   * dont aucun secret n'est posé — la pastille de santé de la console Ops, un écran plus loin.
   * Seul PayDunya sondait vraiment. `/api/integrations/status` est désormais la source des CINQ.
   */
  useEffect(() => {
    integrationStatusApi.get().then(r => setStates(r.states)).catch(() => setStates(null))
  }, [])

  // Page COMMERÇANT : uniquement ses paiements + canaux. L'infrastructure (OPS) est
  // exclue ici et vit dans la console opérateur (cf. OpsInfrastructure). Ne publie pas la stack.
  //
  // ⚠️ Tant que la sonde n'a pas répondu, `status` reste `'disconnected'` et `paymentStatus`
  // `'unconfigured'` : on ne PRÉSUME pas connecté. Un défaut réseau doit rendre l'écran muet,
  // jamais optimiste — c'est ce qui distingue « je ne sais pas » de « tout va bien ».
  const displayList = useMemo(() => INTEGRATIONS_LIST
    .filter(itg => MERCHANT_CATS.has(CATEGORY_OF[itg.id]))
    .map(itg => {
      const st = states?.[itg.id as MerchantIntegrationId]
      return {
        ...itg,
        status: st === 'live' || st === 'sandbox' ? 'connected' as const : 'disconnected' as const,
        paymentStatus:
          st === 'live'    ? 'production' as const :
          st === 'sandbox' ? 'sandbox' as const :
                             'unconfigured' as const,
      }
    }), [states])

  // Heure courte locale d'un ISO (dernière transaction réussie). null → '—'.
  const shortTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'

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
      toast.error(lang === 'en' ? 'Connection failed — check your configuration' : lang === 'es' ? 'Conexión fallida — verifique su configuración' : lang === 'it' ? 'Connessione fallita — verifica la configurazione' : 'Connexion échouée — vérifiez votre configuration')
    } else {
      toast.success(lang === 'en' ? `${itg.name} — Connection OK (${ms}ms)` : lang === 'es' ? `${itg.name} — Conexión OK (${ms}ms)` : lang === 'it' ? `${itg.name} — Connessione OK (${ms}ms)` : `${itg.name} — Connexion OK (${ms}ms)`)
    }
  }

  /**
   * ⚠️ NE PLUS sonder Sentry ici. `checkSentryBackend()` écrivait `pingStatus.sentry`, or
   * `sentry` est en catégorie `monitoring` : il a été SORTI de la page commerçant lors de
   * l'extraction d'`OpsInfrastructure`, mais sa sonde était restée. Une clé de plus dans la
   * map que de cartes affichées, et les trois symptômes mesurés le 2026-08-06 tombent :
   *
   *   okCount comptait sentry              → « 3/2 OK », numérateur > dénominateur
   *   allChecked testait 3 === 2           → FAUX POUR TOUJOURS
   *   → « Joignables » figé sur « … », barre figée sur « Vérification en cours… »
   *
   * La sonde Sentry vit désormais avec la carte Sentry, dans `OpsInfrastructure`.
   */
  useEffect(() => {
    displayList.filter(itg => !itg.noPing).forEach(itg => { pingIntegration(itg.id, itg.pingUrl) })
  }, [])

  function PaymentStatusBadge({ status }: { status: 'sandbox' | 'production' | 'unconfigured' }) {
    const configs = {
      sandbox:      { bg:'rgba(255,184,0,.12)',   border:'rgba(255,184,0,.3)',   color:'var(--warn)',   dot:'var(--warn)',   label: lang === 'en' ? 'Sandbox' : lang === 'es' ? 'Sandbox' : lang === 'it' ? 'Sandbox' : 'Sandbox' },
      production:   { bg:'rgba(0,208,132,.1)',    border:'rgba(0,208,132,.25)',  color:'var(--acc2)',   dot:'var(--acc2)',   label: lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif' },
      unconfigured: { bg:'var(--bg4)',            border:'var(--border)',         color:'var(--text3)', dot:'var(--text4)', label: lang === 'en' ? 'Not configured' : lang === 'es' ? 'No configurado' : lang === 'it' ? 'Non configurato' : 'Non configuré' },
    }
    const c = configs[status]
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:99, fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', background:c.bg, border:`1px solid ${c.border}`, color:c.color }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:c.dot }} />
        {c.label}
      </span>
    )
  }

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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', background: c.bg, color: c.color }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, boxShadow: status === 'ok' ? `0 0 5px ${c.dot}` : 'none', animation: (status === 'checking' || status === 'ok') ? 'pulse 1.5s infinite' : 'none' }} />
        {status === 'checking' ? (lang === 'fr' ? 'Vérification...' : lang === 'es' ? 'Verificando...' : lang === 'it' ? 'Verifica...' : 'Checking...') : c.label}
      </span>
    )
  }

  const configure = (itg: Integration) => {
    toast.success(lang === 'fr' ? `${itg.name} est géré automatiquement par HabaShop` : lang === 'es' ? `${itg.name} es gestionado automáticamente por HabaShop` : lang === 'it' ? `${itg.name} è gestito automaticamente da HabaShop` : `${itg.name} is managed automatically by HabaShop`)
  }

  /**
   * ⚠️ Les compteurs se dérivent des cartes AFFICHÉES, jamais des clés de `pingStatus`.
   *
   * `Object.keys(pingStatus)` faisait entrer dans le calcul toute intégration qui avait
   * écrit dans la map — y compris une, `sentry`, que cette page n'affiche plus. Un
   * numérateur pouvait donc dépasser son dénominateur, et `allChecked` être faux pour
   * toujours. Partir de `pingableList` rend l'arithmétique vraie PAR CONSTRUCTION : le
   * prochain qui écrira une clé étrangère ne cassera plus l'écran.
   */
  const pingableList = displayList.filter(itg => !itg.noPing)
  const pingedIds    = pingableList.map(itg => itg.id).filter(id => pingStatus[id] !== undefined)
  const okCount      = pingedIds.filter(id => pingStatus[id] === 'ok' || pingStatus[id] === 'slow').length
  const anyError     = pingedIds.some(id => pingStatus[id] === 'error')
  const allChecked   = pingedIds.length === pingableList.length && pingedIds.every(id => pingStatus[id] !== 'checking')
  const allOk        = allChecked && !anyError

  // ⚠️ « configurées », pas « connectées » : `status` dérive désormais de l'environnement
  // serveur (secrets posés), pas d'une sonde. Le mot doit dire ce qu'il mesure.
  const totalConfigured = displayList.filter(itg => itg.status === 'connected').length

  /**
   * ⚠️ LE BAC À SABLE NE SE FOND PAS DANS « CONFIGURÉ » — mesuré en production le
   * 2026-08-15 : la pastille d'en-tête affichait « 5/5 configurées » en VERT alors que
   * les TROIS prestataires de paiement étaient en bac à sable. Aucun encaissement réel
   * n'était possible, et le haut de page disait le contraire du bas.
   *
   * Les cartes, elles, faisaient déjà la distinction (badge ambre « Sandbox »). C'est
   * l'AGRÉGAT qui l'écrasait — un total qui additionne deux états que le reste de l'écran
   * prend soin de séparer. `lib/integrationStatus.ts` le dit en toutes lettres :
   * « `sandbox` n'est PAS une nuance cosmétique de `live` ».
   *
   * Le vert exige donc l'absence de bac à sable. Biais de PRUDENCE : un seul prestataire
   * en simulation suffit à faire passer la pastille en ambre.
   */
  const enSandbox = displayList.filter(itg => itg.paymentStatus === 'sandbox').length

  /**
   * ⚠️ ICÔNES LUCIDE, PAS EMOJI — la colonne « Déclencheur » portait 🎉 ⏰ 🔴 🔒 ✅ 📊,
   * soit six emojis employés exactement comme des icônes, sur une page qui importe
   * déjà Lucide sept fois. Un emoji est rendu par la police système : sa taille, sa
   * couleur et son alignement échappent aux tokens, et il est LU À VOIX HAUTE par un
   * lecteur d'écran (« visage qui fait la fête, Inscription »).
   */
  const EMAIL_FLOWS: { Icon: LucideIcon; trigger: string; email: string; delay: string }[] = [
    { Icon: UserPlus,      trigger: lang === 'en' ? 'Signup' : lang === 'es' ? 'Registro' : lang === 'it' ? 'Iscrizione' : 'Inscription',                                    email: lang === 'en' ? 'Welcome email' : lang === 'es' ? 'Email de bienvenida' : lang === 'it' ? 'Email di benvenuto' : 'Email de bienvenue',   delay: lang === 'en' ? 'Immediate' : lang === 'es' ? 'Inmediato' : lang === 'it' ? 'Immediato' : 'Immédiat' },
    { Icon: Clock,         trigger: lang === 'en' ? 'D-7 before expiry' : lang === 'es' ? 'D-7 antes de expirar' : lang === 'it' ? 'G-7 prima della scadenza' : 'J-7 avant expiration', email: lang === 'en' ? 'Trial reminder' : lang === 'es' ? 'Recordatorio de prueba' : lang === 'it' ? 'Promemoria prova' : 'Rappel essai',         delay: 'Cron 1h' },
    { Icon: AlertTriangle, trigger: lang === 'en' ? 'D-3 before expiry' : lang === 'es' ? 'D-3 antes de expirar' : lang === 'it' ? 'G-3 prima della scadenza' : 'J-3 avant expiration', email: lang === 'en' ? 'Urgent reminder' : lang === 'es' ? 'Recordatorio urgente' : lang === 'it' ? 'Promemoria urgente' : 'Rappel urgent',       delay: 'Cron 1h' },
    { Icon: Lock,          trigger: lang === 'en' ? 'Expiry' : lang === 'es' ? 'Expiración' : lang === 'it' ? 'Scadenza' : 'Expiration',                                     email: lang === 'en' ? 'Account suspended' : lang === 'es' ? 'Cuenta suspendida' : lang === 'it' ? 'Account sospeso' : 'Compte suspendu',   delay: 'Cron 1h' },
    { Icon: CheckCircle2,  trigger: lang === 'en' ? 'Upgrade approved' : lang === 'es' ? 'Upgrade aprobado' : lang === 'it' ? 'Upgrade approvato' : 'Upgrade validé',        email: lang === 'en' ? 'Plan confirmation' : lang === 'es' ? 'Confirmación de plan' : lang === 'it' ? 'Conferma piano' : 'Confirmation plan', delay: lang === 'en' ? 'Immediate' : lang === 'es' ? 'Inmediato' : lang === 'it' ? 'Immediato' : 'Immédiat' },
    { Icon: BarChart3,     trigger: lang === 'en' ? 'Monday 8am' : lang === 'es' ? 'Lunes 8h' : lang === 'it' ? 'Lunedì 8' : 'Lundi 8h',                                     email: lang === 'en' ? 'Weekly report' : lang === 'es' ? 'Informe semanal' : lang === 'it' ? 'Report settimanale' : 'Rapport hebdomadaire',  delay: lang === 'en' ? 'Weekly cron' : lang === 'es' ? 'Cron semanal' : lang === 'it' ? 'Cron settimanale' : 'Cron hebdo' },
  ]

  const renderCard = (itg: MerchantCard) => {
    const isActive = itg.status === 'connected'
    const { IconSvg } = itg
    const sv = itg.noPing
      ? itg.paymentStatus === 'production' ? { border:'var(--acc2)',   glow:'color-mix(in srgb, var(--acc2) 15%, transparent)' }
      : itg.paymentStatus === 'sandbox'     ? { border:'var(--warn)',   glow:'color-mix(in srgb, var(--warn) 12%, transparent)' }
      :                                      { border:'var(--border)',  glow:'transparent' }
      : statusVisual(pingStatus[itg.id])
    const glowHover = sv.glow.replace('15%,', '30%,').replace('12%,', '25%,')
    // PayDunya : méthodes réelles renvoyées par le backend (/config) si dispo, sinon liste statique.
    const methods = itg.id === 'paydunya' && paydunyaCfg?.methods?.length ? paydunyaCfg.methods : METHODS[itg.id]
    const apiVer  = API_VERSION[itg.id]
    const detail  = CARD_DETAIL[itg.id]?.[lang] ?? CARD_DETAIL[itg.id]?.fr
    // Transactions du jour (cartes paiement MTN MoMo / Campay) — données réelles.
    const tx: ProviderStat | undefined = itg.id === 'mtnmomo' ? txStats?.mtn : itg.id === 'campay' ? txStats?.campay : itg.id === 'paydunya' ? txStats?.paydunya : undefined
    /**
     * ⚠️ UN TAUX A UN DÉNOMINATEUR — celui-ci valait UN.
     *
     * Cette cellule affichait « 0 % » d'erreurs dès qu'UN ping avait abouti, et « 100 % »
     * dès qu'un seul avait échoué. Un pourcentage se lit comme une SÉRIE : « sur la durée,
     * rien n'échoue ». Il n'y a pas de série — il y a une mesure, prise au montage de la
     * page. Même famille que `perf`/`rating` rendus sans leur effectif, et que le « 4,2/5 »
     * dont on ne sait pas s'il porte sur trois personnes ou sur toute l'équipe.
     *
     * On rend donc le VERDICT de la sonde : un fait sur une mesure, qui ne promet rien
     * au-delà d'elle. `null` = non mesuré, et l'absence se dit « — ».
     */
    const verdictSonde: 'repond' | 'injoignable' | null =
      itg.noPing                                                                   ? null
      : pingStatus[itg.id] === 'error'                                             ? 'injoignable'
      : pingStatus[itg.id] === 'ok' || pingStatus[itg.id] === 'slow'                ? 'repond'
      :                                                                              null

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
              <div style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-bold)', color:'var(--text)', marginBottom:5 }}>{itg.name}</div>
              {/* DEUX badges, DEUX questions distinctes — les fondre est ce qui rendait
                  l'écran trompeur : « Actif » disait la configuration, le ping dit la
                  joignabilité de l'hôte du tiers. Un hôte joignable ne prouve pas que NOTRE
                  compte est configuré, et une configuration posée ne prouve pas que l'hôte
                  répond. Le second n'apparaît que là où un ping existe. */}
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                {itg.paymentStatus && <PaymentStatusBadge status={itg.paymentStatus} />}
                {!itg.noPing && <PingBadge id={itg.id} />}
              </div>
            </div>
            {!itg.noPing && (
              <button type="button"
                onClick={() => pingIntegration(itg.id, itg.pingUrl)}
                title={lang === 'fr' ? 'Rafraîchir le statut' : lang === 'es' ? 'Actualizar el estado' : lang === 'it' ? 'Aggiorna lo stato' : 'Refresh status'}
                aria-label={`${lang === 'fr' ? 'Rafraîchir' : lang === 'es' ? 'Actualizar' : lang === 'it' ? 'Aggiorna' : 'Refresh'} ${itg.name}`}
                style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <RotateCw size={12} style={{ animation: pingStatus[itg.id] === 'checking' ? 'spin .8s linear infinite' : 'none' }} />
              </button>
            )}
          </div>

          {/* Description */}
          <p style={{ fontSize:'var(--fs-label)', color:'var(--text2)', lineHeight:1.6, margin:'0 0 8px' }}>{integrationDesc(itg, lang)}</p>

          {/* Détail factuel (infra) */}
          {detail && (
            <p style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', margin:'0 0 10px', fontFamily:'var(--mono)' }}>{detail}</p>
          )}

          {/* Pays (paiement) */}
          {itg.countries && (
            <p style={{ fontSize:'var(--fs-sm)', color:'var(--text3)', margin:'0 0 8px', lineHeight:1.4 }}>{itg.countries}</p>
          )}

          {/* Méthodes supportées (pills, cartes paiement) */}
          {methods && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
              {methods.map(m => (
                <span key={m} style={{
                  fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', padding:'2px 8px', borderRadius:99,
                  background:'var(--bg4)', border:'1px solid var(--border)', color:'var(--text2)',
                }}>{m}</span>
              ))}
            </div>
          )}

          {/* PayDunya en sandbox → call-to-action vers le dashboard pour activer la prod */}
          {itg.id === 'paydunya' && paydunyaCfg?.configured && paydunyaCfg.mode === 'test' && (
            <a href="https://paydunya.com/dashboard" target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--p3)', textDecoration:'none', marginBottom:12 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}>
              <ExternalLink size={11} /> {lang === 'en' ? 'Activate production' : lang === 'es' ? 'Activar producción' : lang === 'it' ? 'Attiva produzione' : 'Activer la production'}
            </a>
          )}

          {/* Transactions du jour (cartes paiement) — données réelles backend */}
          {tx && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 10px', marginBottom:10, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:9 }}>
              <div>
                <div style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-bold)', color:'var(--text)', fontFamily:'var(--mono)' }}>
                  {tx.count} tx{tx.count > 0 ? ` · ${fmt(tx.amountXof)}` : ''}
                </div>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--text4)', marginTop:1 }}>
                  {lang === 'en' ? 'Transactions today' : lang === 'es' ? 'Transacciones hoy' : lang === 'it' ? 'Transazioni oggi' : 'Transactions aujourd\'hui'}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', color: tx.lastAt ? 'var(--acc2)' : 'var(--text4)', fontFamily:'var(--mono)' }}>{shortTime(tx.lastAt)}</div>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--text4)', marginTop:1 }}>
                  {lang === 'en' ? 'Last success' : lang === 'es' ? 'Última exitosa' : lang === 'it' ? 'Ultima riuscita' : 'Dernière réussie'}
                </div>
              </div>
            </div>
          )}

          {/* Métriques mesurées en direct — latence + verdict du ping réel.
              Masqué pour les services sans endpoint public testable (paiements, cache) :
              on n'affiche aucune valeur qui ne soit pas mesurée. */}
          {!itg.noPing && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6, marginBottom:10 }}>
              {[
                { label: lang === 'en' ? 'Latency' : lang === 'es' ? 'Latencia' : lang === 'it' ? 'Latenza' : 'Latence', value: pingLatency[itg.id] ? `${pingLatency[itg.id]}ms` : '—', color: 'var(--text)' },
                {
                  label: lang === 'en' ? 'Last ping' : lang === 'es' ? 'Último ping' : lang === 'it' ? 'Ultimo ping' : 'Dernier ping',
                  value: verdictSonde === 'repond'
                    ? (lang === 'en' ? 'responds' : lang === 'es' ? 'responde' : lang === 'it' ? 'risponde' : 'répond')
                    : verdictSonde === 'injoignable'
                    ? (lang === 'en' ? 'unreachable' : lang === 'es' ? 'inaccesible' : lang === 'it' ? 'irraggiungibile' : 'injoignable')
                    : '—',
                  color: verdictSonde === 'repond' ? 'var(--acc2)' : verdictSonde === 'injoignable' ? 'var(--danger)' : 'var(--text4)',
                },
              ].map(stat => (
                <div key={stat.label} style={{ background:'var(--bg3)', borderRadius:8, padding:'7px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-bold)', color:stat.color, fontFamily:'var(--mono)' }}>{stat.value}</div>
                  <div style={{ fontSize:'var(--fs-caption)', color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.4px', marginTop:2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Endpoint + version API (libellés factuels) */}
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', background:'var(--bg4)', borderRadius:7, border:'1px solid var(--border)', fontSize:'var(--fs-caption)', fontFamily:'var(--mono)', color:'var(--text3)' }}>
            <Globe size={10} style={{ flexShrink:0 }} />
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{itg.endpoint}</span>
            {apiVer && (
              <span style={{ marginLeft:'auto', flexShrink:0, color:'var(--text4)', fontSize:'var(--fs-caption)' }}>{apiVer}</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:'12px 20px', borderTop:'1px solid var(--border)', background:'var(--bg3)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
        }}>
          <a href={itg.docs} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', textDecoration:'none', fontWeight:'var(--fw-regular)', display:'flex', alignItems:'center', gap:4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}
          >
            <ExternalLink size={11} /> Docs
          </a>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {!itg.noPing && (
              <Button
                variant="ghost"
                className="btn-sm"
                loading={pingStatus[itg.id] === 'checking'}
                leftIcon={<Zap size={11} />}
                onClick={() => testConnection(itg)}
                aria-label={`${lang === 'fr' ? 'Tester' : lang === 'es' ? 'Probar' : lang === 'it' ? 'Testa' : 'Test'} ${itg.name}`}
                style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--p3)', border: '1px solid var(--p)' }}
              >
                {lang === 'fr' ? 'Tester' : lang === 'en' ? 'Test' : lang === 'es' ? 'Probar' : 'Testa'}
              </Button>
            )}
            <button type="button"
              onClick={() => itg.id === 'paydunya' ? setPayDunyaOpen(true) : configure(itg)}
              aria-label={`${lang === 'fr' ? 'Configurer' : lang === 'es' ? 'Configurar' : lang === 'it' ? 'Configura' : 'Configure'} ${itg.name}`}
              style={{
                display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px',
                background: itg.paymentStatus === 'unconfigured' ? 'var(--p)' : 'transparent',
                border:`1px solid ${itg.paymentStatus === 'unconfigured' ? 'var(--p)' : 'var(--border)'}`, borderRadius:8, fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)',
                color: itg.paymentStatus === 'unconfigured' ? '#fff' : 'var(--text3)', cursor:'pointer', fontFamily:'var(--font)', minHeight:32, transition:'all .15s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; if (itg.paymentStatus !== 'unconfigured') { el.style.color = 'var(--text)'; el.style.borderColor = 'var(--border2)' } }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; if (itg.paymentStatus !== 'unconfigured') { el.style.color = 'var(--text3)'; el.style.borderColor = 'var(--border)' } }}
            >
              <Settings2 size={11} /> {lang === 'fr' ? 'Configurer' : lang === 'es' ? 'Configurar' : lang === 'it' ? 'Configura' : 'Configure'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function PayDunyaModal() {
    const ref = useModalFocus<HTMLDivElement>(true, { initialFocus: '[data-pd-first]' })
    // État éphémère uniquement — JAMAIS de persistance navigateur des secrets de
    // paiement (XSS/exfiltration). La sauvegarde réelle se fera côté serveur (chiffré
    // au repos) une fois l'intégration PayDunya branchée — Save est désactivé en attendant.
    const [form, setForm] = useState({ masterKey:'', privateKey:'', publicKey:'', token:'', mode:'test' })
    const [show, setShow] = useState(false)

    const FIELDS: { key: keyof typeof form; label: string; placeholder: string }[] = [
      { key:'masterKey',  label: lang === 'fr' ? 'Clé maître' : lang === 'en' ? 'Master key' : lang === 'es' ? 'Clave maestra' : 'Chiave master',     placeholder:'PAYDUNYA-MASTER-KEY' },
      { key:'privateKey', label: lang === 'fr' ? 'Clé privée' : lang === 'en' ? 'Private key' : lang === 'es' ? 'Clave privada' : 'Chiave privata',   placeholder:'live_private_…' },
      { key:'publicKey',  label: lang === 'fr' ? 'Clé publique' : lang === 'en' ? 'Public key' : lang === 'es' ? 'Clave pública' : 'Chiave pubblica', placeholder:'live_public_…' },
      { key:'token',      label:'Token',                                                                                                              placeholder:'PAYDUNYA-TOKEN' },
    ]

    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true"
        aria-label={lang === 'fr' ? 'Configurer PayDunya' : lang === 'en' ? 'Configure PayDunya' : lang === 'es' ? 'Configurar PayDunya' : 'Configura PayDunya'}
        onClick={e => e.target === e.currentTarget && setPayDunyaOpen(false)}
      >
        <div ref={ref} className="modal-box" style={{ maxWidth: 440 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
            <div style={{ width:40, height:40, borderRadius:11, flexShrink:0, background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <IconPayDunyaSvg />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h3 style={{ fontSize:'var(--fs-md)', fontWeight:'var(--fw-bold)', color:'var(--text)', margin:0 }}>PayDunya</h3>
              <p style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', margin:'2px 0 0' }}>
                {lang === 'fr' ? 'Clés API — Wave, Orange Money, Free Money, Visa' : lang === 'en' ? 'API keys — Wave, Orange Money, Free Money, Visa' : lang === 'es' ? 'Claves API — Wave, Orange Money, Free Money, Visa' : 'Chiavi API — Wave, Orange Money, Free Money, Visa'}
              </p>
            </div>
            <button type="button" onClick={() => setPayDunyaOpen(false)}
              aria-label={lang === 'fr' ? 'Fermer' : lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : 'Chiudi'}
              style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X size={15} />
            </button>
          </div>

          {/* Environnement */}
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {(['test','live'] as const).map(m => (
              <button key={m} type="button" onClick={() => setForm(f => ({ ...f, mode:m }))}
                style={{
                  flex:1, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'var(--font)',
                  fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)',
                  background: form.mode === m ? 'var(--p)' : 'var(--bg3)',
                  border:`1px solid ${form.mode === m ? 'var(--p)' : 'var(--border)'}`,
                  color: form.mode === m ? '#fff' : 'var(--text3)',
                }}>
                {m === 'test'
                  ? (lang === 'fr' ? 'Test (sandbox)' : lang === 'en' ? 'Test (sandbox)' : lang === 'es' ? 'Prueba (sandbox)' : 'Test (sandbox)')
                  : (lang === 'fr' ? 'Production' : lang === 'en' ? 'Live' : lang === 'es' ? 'Producción' : 'Produzione')}
              </button>
            ))}
          </div>

          {/* Champs clés */}
          <div style={{ display:'flex', flexDirection:'column', gap:11, marginBottom:16 }}>
            {FIELDS.map((fld, i) => (
              <label key={fld.key} style={{ display:'block' }}>
                <span style={{ display:'block', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--text2)', marginBottom:4 }}>{fld.label}</span>
                <div style={{ position:'relative' }}>
                  <KeyRound size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text4)', pointerEvents:'none' }} />
                  <input
                    data-pd-first={i === 0 ? '' : undefined}
                    type={show ? 'text' : 'password'}
                    value={form[fld.key]}
                    onChange={e => setForm(f => ({ ...f, [fld.key]: e.target.value }))}
                    placeholder={fld.placeholder}
                    autoComplete="off"
                    style={{
                      width:'100%', padding:'9px 10px 9px 30px', borderRadius:9,
                      background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)',
                      fontSize:'var(--fs-label)', fontFamily:'var(--mono)', boxSizing:'border-box',
                    }}
                  />
                </div>
              </label>
            ))}
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:'var(--fs-caption)', color:'var(--text3)', cursor:'pointer' }}>
              <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />
              {lang === 'fr' ? 'Afficher les clés' : lang === 'en' ? 'Show keys' : lang === 'es' ? 'Mostrar claves' : 'Mostra le chiavi'}
            </label>
          </div>

          {/* Note sécurité : aucune clé n'est stockée tant que le backend n'est pas branché */}
          <p style={{ fontSize:'var(--fs-caption)', color:'var(--text4)', lineHeight:1.5, margin:'0 0 16px' }}>
            {lang === 'fr' ? 'Aperçu de configuration. L\'enregistrement sera disponible une fois l\'intégration PayDunya branchée côté serveur (clés chiffrées au repos). Aucune clé n\'est stockée dans le navigateur.' : lang === 'en' ? 'Configuration preview. Saving becomes available once PayDunya is wired server-side (keys encrypted at rest). No key is stored in the browser.' : lang === 'es' ? 'Vista previa de configuración. El guardado estará disponible cuando PayDunya se conecte en el servidor (claves cifradas en reposo). No se almacena ninguna clave en el navegador.' : 'Anteprima di configurazione. Il salvataggio sarà disponibile una volta collegato PayDunya lato server (chiavi cifrate a riposo). Nessuna chiave viene memorizzata nel browser.'}
          </p>

          {/* Actions */}
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={() => setPayDunyaOpen(false)} className="mini-btn" style={{ flex:1, justifyContent:'center' }}>
              {lang === 'fr' ? 'Fermer' : lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : 'Chiudi'}
            </button>
            <button type="button" disabled aria-disabled="true"
              title={lang === 'fr' ? 'Disponible une fois l\'intégration backend connectée' : lang === 'en' ? 'Available once the backend integration is connected' : lang === 'es' ? 'Disponible cuando la integración backend esté conectada' : 'Disponibile una volta connessa l\'integrazione backend'}
              style={{
                flex:1, padding:'10px', background:'var(--bg4)',
                border:'1px solid var(--border)', borderRadius:10, color:'var(--text4)', fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)', cursor:'not-allowed', fontFamily:'var(--font)',
              }}>
              {lang === 'fr' ? 'Bientôt disponible' : lang === 'en' ? 'Coming soon' : lang === 'es' ? 'Próximamente' : 'Prossimamente'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          {/* ⚠️ Le titre disait « API & Intégrations » — le MÊME libellé que l'entrée de menu
              de /app/api-docs, qui est une autre page. Cette page-ci ne parle pas d'API : elle
              parle de moyens de paiement et de canaux d'envoi. Cf. § ⑤ du chantier. */}
          <h1 className="page-title">
            {lang === 'en' ? 'Payments & channels' : lang === 'es' ? 'Pagos y canales' : lang === 'it' ? 'Pagamenti e canali' : 'Paiements & canaux'}
          </h1>
          <p className="page-subtitle">
            {lang === 'en' ? 'What is configured on the server, and what responds' : lang === 'es' ? 'Lo que está configurado en el servidor y lo que responde' : lang === 'it' ? 'Cosa è configurato sul server e cosa risponde' : 'Ce qui est configuré côté serveur, et ce qui répond'}
          </p>
        </div>
        {/* ⚠️ NEUTRE tant que la sonde n'a pas répondu, et JAMAIS vert par défaut : la pastille
            pulsée verte s'affichait avant même que le serveur ait dit quoi que ce soit. Le vert
            est réservé au cas où tout est réellement configuré — sinon ambre, sinon gris. */}
        {(() => {
          const pending  = states === null
          const complete = !pending && totalConfigured === displayList.length && displayList.length > 0
          // ⚠️ Le vert exige « tout configuré ET rien en bac à sable » (cf. `enSandbox`).
          const tone = pending ? 'var(--text3)' : complete && enSandbox === 0 ? 'var(--acc2)' : 'var(--warn)'
          return (
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'8px 14px', borderRadius:12,
              background: `color-mix(in srgb, ${tone} 8%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tone} 22%, transparent)`,
            }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: tone }} />
              <span style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', color: tone }}>
                {pending
                  ? (lang === 'en' ? 'Checking…' : lang === 'es' ? 'Verificando…' : lang === 'it' ? 'Verifica…' : 'Vérification…')
                  : `${totalConfigured}/${displayList.length} ${lang === 'en' ? 'configured' : lang === 'es' ? 'configuradas' : lang === 'it' ? 'configurate' : 'configurées'}`
                    + (enSandbox > 0
                      ? ` · ${enSandbox} ${lang === 'en' ? 'in sandbox' : lang === 'es' ? 'en sandbox' : lang === 'it' ? 'in sandbox' : 'en bac à sable'}`
                      : '')}
              </span>
            </div>
          )
        })()}
      </div>

      {/* ── KPIs (réels uniquement) ── */}
      <div className="kpi-grid">
        {[
          { label:lang === 'en' ? 'Integrations' : lang === 'es' ? 'Integraciones' : lang === 'it' ? 'Integrazioni' : 'Intégrations', value:displayList.length, color:'var(--text)'  },
          { label:lang === 'en' ? 'Configured' : lang === 'es' ? 'Configuradas' : lang === 'it' ? 'Configurate' : 'Configurées', value: states === null ? '…' : totalConfigured, color:'var(--acc)'   },
          { label:lang === 'en' ? 'Reachable' : lang === 'es' ? 'Accesibles' : lang === 'it' ? 'Raggiungibili' : 'Joignables',   value:allChecked ? `${okCount}/${pingableList.length}` : '…', color:'var(--acc2)' },
          { label:lang === 'en' ? 'Transactions today' : lang === 'es' ? 'Transacciones hoy' : lang === 'it' ? 'Transazioni oggi' : 'Transactions du jour', value: txCount ?? '—', color:'var(--p)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Joignabilité des hôtes sondables ──────────────────────────────────────
          ⚠️ LA VÉRITÉ VACANTE, dans sa forme exacte : si `pingableList` est vide,
          `allChecked` vaut vrai (`0 === 0` et `.every()` sur le vide) et `anyError` faux,
          donc `allOk` était VRAI — barre verte, « Tous les services opérationnels », sur
          ZÉRO sonde. C'est la coche « toutes vos boutiques ont démarré » sous « 0 inscrites ».
          TROIS états, et l'état vide est NEUTRE : on constate, on ne rassure pas.

          ⚠️ Et le titre ne dit plus « tous les services » : trois prestataires sur cinq ne
          sont PAS sondables (`noPing`). Un quantificateur universel sur un sous-ensemble
          présenté comme le tout est le même défaut, en plus discret. */}
      {(() => {
        const aucune = pingableList.length === 0
        const tone = aucune ? 'var(--text3)' : allOk ? 'var(--acc2)' : anyError ? 'var(--danger)' : 'var(--acc)'
        return (
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:12,
            background: aucune ? 'var(--bg3)' : `color-mix(in srgb, ${tone} 6%, transparent)`,
            border: `1px solid ${aucune ? 'var(--border)' : `color-mix(in srgb, ${tone} 20%, transparent)`}`,
          }}>
            <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: tone, boxShadow: !aucune && allOk ? '0 0 8px var(--acc2)' : 'none' }} />
            <span style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>
              {aucune
                ? (lang === 'en' ? 'No host can be probed from the browser' : lang === 'es' ? 'Ningún host verificable desde el navegador' : lang === 'it' ? 'Nessun host verificabile dal browser' : 'Aucun hôte n’est vérifiable depuis le navigateur')
                : allOk
                ? (lang === 'en' ? 'Every probed host responds' : lang === 'es' ? 'Todos los hosts verificados responden' : lang === 'it' ? 'Tutti gli host verificati rispondono' : 'Les hôtes sondés répondent tous')
                : anyError
                ? (lang === 'en' ? 'Some hosts are unreachable' : lang === 'es' ? 'Algunos hosts no responden' : lang === 'it' ? 'Alcuni host non rispondono' : 'Certains hôtes sont injoignables')
                : (lang === 'en' ? 'Probing…' : lang === 'es' ? 'Verificando…' : lang === 'it' ? 'Verifica…' : 'Vérification en cours…')}
            </span>
            <span style={{ marginLeft:'auto', fontSize:'var(--fs-caption)', color:'var(--text3)', fontFamily:'var(--mono)' }}>
              {aucune ? '—' : `${okCount}/${pingableList.length} OK`}
            </span>
          </div>
        )
      })()}

      {/* ── Grids par catégorie ── */}
      {CATEGORIES.map(cat => {
        const items = displayList.filter(itg => CATEGORY_OF[itg.id] === cat.key)
        if (!items.length) return null
        return (
          <div key={cat.key}>
            <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-regular)', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px', margin:'0 0 10px 2px' }}>
              {cat.label[lang] ?? cat.label.fr}
            </div>
            <ResponsiveGrid min={300} gap={14}>
              {items.map(renderCard)}
            </ResponsiveGrid>
          </div>
        )
      })}

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
              display:'flex', alignItems:'center', justifyContent:'center',
            }}><Mail size={22} style={{ color:'var(--p2)' }} aria-hidden="true" /></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'var(--fs-title)', fontWeight:'var(--fw-bold)', color:'var(--text)' }}>
                Resend — {lang === 'en' ? 'Transactional emails' : lang === 'es' ? 'Emails transaccionales' : lang === 'it' ? 'Email transazionali' : 'Emails transactionnels'}
              </div>
              <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', lineHeight:1.4 }}>
                {lang === 'en' ? 'Welcome, trial reminders, upgrade confirmations and weekly reports.' : lang === 'es' ? 'Bienvenida, recordatorios de prueba, confirmaciones de upgrade e informes semanales.' : lang === 'it' ? 'Benvenuto, promemoria di prova, conferme di upgrade e report settimanali.' : 'Bienvenue, rappels d\'essai, confirmations d\'upgrade et rapports hebdomadaires.'}
              </div>
            </div>
            {/* ⚠️ L'effectif se DÉRIVE de la liste rendue juste en dessous : « 6 » était
                écrit en dur, donc faux au premier flux ajouté — et faux en silence. */}
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              background:'rgba(0,208,132,.12)', border:'1px solid rgba(0,208,132,.25)',
              color:'var(--acc2)', borderRadius:20, padding:'3px 10px',
              fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', flexShrink:0,
            }}>
              <CheckCircle2 size={12} style={{ flexShrink:0 }} aria-hidden="true" />
              {lang === 'en' ? `Active — ${EMAIL_FLOWS.length} emails configured` : lang === 'es' ? `Activo — ${EMAIL_FLOWS.length} emails configurados` : lang === 'it' ? `Attivo — ${EMAIL_FLOWS.length} email configurate` : `Actif — ${EMAIL_FLOWS.length} emails configurés`}
            </span>
          </div>

          {/* Tableau des flows email */}
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--fs-label)' }}>
              <thead>
                <tr style={{ background:'var(--bg4)' }}>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:'var(--fw-semibold)', fontSize:'var(--fs-caption)', textTransform:'uppercase' }}>
                    {lang === 'en' ? 'Trigger' : lang === 'es' ? 'Disparador' : lang === 'it' ? 'Attivazione' : 'Déclencheur'}
                  </th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:'var(--fw-semibold)', fontSize:'var(--fs-caption)', textTransform:'uppercase' }}>
                    Email
                  </th>
                  <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text3)', fontWeight:'var(--fw-semibold)', fontSize:'var(--fs-caption)', textTransform:'uppercase' }}>
                    {lang === 'en' ? 'Timing' : lang === 'es' ? 'Plazo' : lang === 'it' ? 'Tempistica' : 'Délai'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {EMAIL_FLOWS.map((flow, i) => (
                  <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px', color:'var(--text2)' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:7 }}>
                        <flow.Icon size={13} style={{ flexShrink:0, color:'var(--text3)' }} aria-hidden="true" />
                        {flow.trigger}
                      </span>
                    </td>
                    <td style={{ padding:'8px 12px', color:'var(--text)', fontWeight:'var(--fw-regular)' }}>{flow.email}</td>
                    <td style={{ padding:'8px 12px' }}>
                      <span style={{
                        background:'rgba(108,71,255,.1)', color:'var(--p3)',
                        borderRadius:6, padding:'2px 8px', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-regular)',
                      }}>{flow.delay}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Légende ── */}
      <div style={{
        padding:'14px 18px', borderRadius:14,
        background:'rgba(108,71,255,.06)', border:'1px solid rgba(108,71,255,.15)',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      }}>
        <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', lineHeight:1.5 }}>
          <span style={{ color:'var(--p2)', fontWeight:'var(--fw-semibold)' }}>
            {lang === 'en' ? 'Note:' : lang === 'es' ? 'Nota:' : lang === 'it' ? 'Nota:' : 'Note :'}
          </span>
          {' '}{lang === 'en' ? 'Latency and the ping verdict are measured live; today\'s transactions come from the database. Services without a public testable endpoint (payments, cache) show no latency.' : lang === 'es' ? 'La latencia y el veredicto del ping se miden en directo; las transacciones de hoy provienen de la base de datos. Los servicios sin endpoint público comprobable (pagos, caché) no muestran latencia.' : lang === 'it' ? 'Latenza ed esito del ping sono misurati in tempo reale; le transazioni di oggi provengono dal database. I servizi senza endpoint pubblico testabile (pagamenti, cache) non mostrano latenza.' : 'La latence et le verdict de la sonde sont mesurés en direct ; les transactions du jour proviennent de la base. Les services sans endpoint public testable (paiements, cache) n\'affichent pas de latence.'}
        </div>
      </div>

      {/* ── Modale config PayDunya ── */}
      {payDunyaOpen && <PayDunyaModal />}
    </div>
  )
}
