import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, authApi } from '@/lib/api'
import { useAppStore, formatInCurrency, THEME_OPTIONS } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import { useModalFocus } from '@/hooks/useModalFocus'
import { confirm } from '@/lib/confirm'
import { paymentMethodLabel, paymentMethodColor } from '@/lib/paymentMethods'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import {
  Store, CreditCard, Wallet,
  Search, X, Plus, ChevronRight,
  LayoutDashboard, Inbox, Check, RefreshCw, Mail, Calendar,
  Clock, Globe, LogOut, Settings, Lock,
} from 'lucide-react'
import LogoMark from '@/components/ui/LogoMark'
import OpsInfrastructure from '@/components/integrations/OpsInfrastructure'
import SecurityEvents from '@/components/admin/SecurityEvents'
import { Server, Rocket, CheckCircle2 } from 'lucide-react'
import { planAmountXOF, purchasablePlans } from '@/lib/plans'
import { DEFAULT_MARKET } from '@/lib/defaultMarket'

// Version PRODUIT = SOURCE UNIQUE injectée au build (package.json racine), jamais un
// littéral (la garde `versionSource.test.ts` échoue si un semver en dur réapparaît).
const APP_VERSION = __APP_VERSION__

type Tenant = {
  id: string; name: string; plan: string; currency: string
  // ⚠️ NULLABLE — la colonne `Tenant.country` l'est en base, et un tenant créé sans pays
  // existe réellement (le champ n'est pas obligatoire à l'inscription). Le déclarer `string`
  // faisait promettre au type ce que la donnée ne garantit pas.
  country: string | null
  vatRate?: number; createdAt: string; trialEnds?: string | null
  status?: string; isActive?: boolean; email?: string | null
  revenue?: number; lastActivityAt?: string | null
  _count?: { users: number; products: number; sales: number }
}

// Valeur mensuelle par plan, en XOF. Affichée TELLE QUELLE (fmtXOF) : la console plateforme
// raisonne en FCFA, jamais convertie vers la devise du super-admin. Cf. adminXof.test.ts.
//
// ⚠️ Les montants viennent du CATALOGUE (`lib/plans.ts`, jumeau du backend) — ils étaient
// en dur ici et donnaient une QUATRIÈME grille : starter 9 900 · pro 24 900 · business
// 24 900 · enterprise 49 900, quand la vitrine affichait 14 400 / 34 750.
// `enterprise` vaut 0 : il est sur DEVIS, donc il n'a pas de valeur mensuelle catalogue.
// Le chiffre d'affaires d'un tenant enterprise ne se déduit pas d'une constante — il est
// porté par sa PlanRequest, saisie par l'opérateur à l'activation.
const PLAN_PRICE: Record<string, number> = {
  free: 0, trial: 0,
  starter:    planAmountXOF('starter', 'monthly') ?? 0,
  business:   planAmountXOF('business', 'monthly') ?? 0,
  pro:        planAmountXOF('pro', 'monthly') ?? 0,   // alias ascendant, résolu vers business
  enterprise: planAmountXOF('enterprise', 'monthly') ?? 0,
}
const PLAN_COLOR: Record<string, string> = {
  free: 'var(--text3)', trial: 'var(--warn)', starter: 'var(--acc2)',
  pro: 'var(--p2)', business: 'var(--p2)', enterprise: 'var(--p)',
}
const planKey = (p?: string) => (p || 'free').toLowerCase()
const planPrice = (p?: string) => PLAN_PRICE[planKey(p)] ?? 0
const planColor = (p?: string) => PLAN_COLOR[planKey(p)] ?? 'var(--text3)'
// Teinte translucide dérivée d'une couleur (token CSS) — respecte les 7 thèmes.
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const darken = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, #000)`
// Temps relatif compact (4 langues) pour la dernière activité d'une boutique.
function relTime(iso: string | null | undefined, i: (fr: string, en: string, es: string, it: string) => string): string {
  if (!iso) return i('jamais', 'never', 'nunca', 'mai')
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d >= 1) return i(`il y a ${d} j`, `${d}d ago`, `hace ${d} d`, `${d} g fa`)
  const h = Math.floor(diff / 3600000)
  if (h >= 1) return i(`il y a ${h} h`, `${h}h ago`, `hace ${h} h`, `${h} h fa`)
  return i("à l'instant", 'just now', 'ahora', 'adesso')
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const lang = useAppStore(s => s.lang)
  const theme = useAppStore(s => s.theme)
  const updateConfig = useAppStore(s => s.updateConfig)
  const logout = useAuthStore(s => s.logout)
  // La console plateforme raisonne en XOF : plans et CA sont tarifés en XOF, et l'opérateur
  // veut voir des FCFA — jamais la devise d'affichage du super-admin connecté, qui convertirait
  // via des taux externes fluctuants et mentirait sur le CA réel. D'où formatInCurrency(_, 'XOF')
  // et non le convertisseur per-viewer. Verrouillé par adminXof.test.ts.
  const fmtXOF = (n: number) => formatInCurrency(n, 'XOF')
  const { i } = useI18n()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'plan' | 'users' | 'products' | 'sales' | 'createdAt' | 'revenue' | 'lastActivityAt'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [showNewTenant, setShowNewTenant] = useState(false)
  // Volet compte MINIMAL de la coquille /admin (mot de passe, langue, thème) — PAS la page
  // Réglages commerçant (qui parle d'une boutique que l'opérateur ne gère pas).
  const [showAccount, setShowAccount] = useState(false)
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  const detailBoxRef = useModalFocus<HTMLDivElement>(!!selected)
  const newTenantBoxRef = useModalFocus<HTMLDivElement>(showNewTenant)
  const accountBoxRef = useModalFocus<HTMLDivElement>(showAccount)

  const doLogout = () => { logout(); navigate('/login') }
  const changePassword = async () => {
    if (pwd.next.length < 8) { toast.error(i('Mot de passe : 8 caractères minimum', 'Password: 8 characters minimum', 'Contraseña: mínimo 8 caracteres', 'Password: minimo 8 caratteri')); return }
    if (pwd.next !== pwd.confirm) { toast.error(i('Les mots de passe ne correspondent pas', 'Passwords do not match', 'Las contraseñas no coinciden', 'Le password non corrispondono')); return }
    setSavingPwd(true)
    try {
      await authApi.changePassword(pwd.current, pwd.next)
      toast.success(i('Mot de passe mis à jour', 'Password updated', 'Contraseña actualizada', 'Password aggiornata'))
      setPwd({ current: '', next: '', confirm: '' })
    } catch (e: any) {
      toast.error(e?.message || i('Échec de la mise à jour', 'Update failed', 'Error al actualizar', 'Aggiornamento fallito'))
    } finally { setSavingPwd(false) }
  }
  const [newTenantForm, setNewTenantForm] = useState({ name: '', currency: DEFAULT_MARKET.currency as string, country: DEFAULT_MARKET.country as string, plan: 'starter', adminEmail: '', adminPassword: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'requests'>('overview')
  const [planRequests, setPlanRequests] = useState<any[]>([])

  const loadStats = async () => {
    setRefreshing(true)
    try {
      const [t, s, r] = await Promise.all([adminApi.tenants(), adminApi.stats(), adminApi.planRequests().catch(() => [])])
      setTenants(t); setStats(s); setPlanRequests(r)
    } catch {
      toast.error(i('Accès refusé — SUPER_ADMIN requis', 'Access denied — SUPER_ADMIN required', 'Acceso denegado — SUPER_ADMIN requerido', 'Accesso negato — SUPER_ADMIN richiesto'))
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { loadStats() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = planRequests.length

  const handleApprove = async (id: string) => {
    if (!(await confirm({ title: i('Approuver la demande', 'Approve request', 'Aprobar solicitud', 'Approva richiesta'), message: i('Approuver cette demande et activer le plan ?', 'Approve this request and activate the plan?', '¿Aprobar esta solicitud y activar el plan?', 'Approvare questa richiesta e attivare il piano?') }))) return
    try {
      await adminApi.reviewPlanRequest(id, { action: 'approve', adminNotes: i('Paiement validé', 'Payment validated', 'Pago validado', 'Pagamento convalidato') })
      toast.success(i('Plan activé !', 'Plan activated!', '¡Plan activado!', 'Piano attivato!'))
      setPlanRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore')) }
  }

  const handleReject = async (id: string) => {
    const reason = window.prompt(i('Raison du rejet (optionnel) :', 'Rejection reason (optional):', 'Razón del rechazo (opcional):', 'Motivo del rifiuto (opzionale):'))
    if (reason === null) return
    try {
      await adminApi.reviewPlanRequest(id, { action: 'reject', adminNotes: reason || i('Demande rejetée', 'Request rejected', 'Solicitud rechazada', 'Richiesta rifiutata') })
      toast.success(i('Demande rejetée', 'Request rejected', 'Solicitud rechazada', 'Richiesta rifiutata'))
      setPlanRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore')) }
  }

  const DAY = 86400000

  // ── ACTIVATION (héros) : le chiffre qui décide de la vie du SaaS — inscrites n'ayant JAMAIS
  //    ajouté de produit. Entonnoir Inscrites → Produit → Vente. Liste triée « jamais revenues »
  //    d'abord (pas de lastActivityAt), puis inscription la plus ancienne. Données réelles.
  const activation = useMemo(() => {
    const withProduct = tenants.filter(t => (t._count?.products ?? 0) > 0).length
    const withSale = tenants.filter(t => (t._count?.sales ?? 0) > 0).length
    const neverProduct = tenants.filter(t => (t._count?.products ?? 0) === 0).sort((a, b) => {
      const aBack = a.lastActivityAt ? 1 : 0, bBack = b.lastActivityAt ? 1 : 0
      if (aBack !== bBack) return aBack - bBack
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
    return { registered: tenants.length, withProduct, withSale, neverProduct }
  }, [tenants])

  // ── UNE seule liste « à traiter » (fusion rétention + facturation) : chaque boutique porte
  //    SES motifs (essai ≤3j / inactive / demande de plan / paiement à vérifier). Le rapprochement
  //    est fait pour l'opérateur (une payante silencieuse + paiement en échec = une seule entrée).
  const toTreat = useMemo(() => {
    const now = Date.now()
    const map = new Map<string, { tenant: Tenant; reasons: { kind: string; label: string; color: string }[] }>()
    const add = (t: Tenant | undefined, kind: string, label: string, color: string) => {
      if (!t) return
      const e = map.get(t.id) ?? { tenant: t, reasons: [] as { kind: string; label: string; color: string }[] }
      if (!e.reasons.some(r => r.kind === kind)) e.reasons.push({ kind, label, color })
      map.set(t.id, e)
    }
    for (const t of tenants) {
      if (t.status === 'trial' && t.trialEnds) {
        const ms = new Date(t.trialEnds).getTime() - now
        if (ms >= 0 && ms < 3 * DAY) add(t, 'trial', i('essai expire ≤ 3 j', 'trial ends ≤ 3 d', 'prueba ≤ 3 d', 'prova ≤ 3 g'), 'var(--warn)')
      }
      if (t.lastActivityAt && now - new Date(t.lastActivityAt).getTime() > 14 * DAY) add(t, 'inactive', i('inactive', 'inactive', 'inactiva', 'inattiva'), 'var(--acc)')
    }
    for (const r of planRequests) {
      const t = tenants.find(x => x.name === r.tenant?.name)
      if (r.paymentRef) add(t, 'payment', i('paiement à vérifier', 'payment to review', 'pago por revisar', 'pagamento da verificare'), 'var(--danger)')
      else add(t, 'plan', i('demande de plan', 'plan request', 'solicitud de plan', 'richiesta piano'), 'var(--p2)')
    }
    return [...map.values()].sort((a, b) => b.reasons.length - a.reasons.length)
  }, [tenants, planRequests, i])

  // « Relancer » = lien de contact PRÉ-REMPLI (e-mail). Pas d'envoi automatisé (gabarits/suivi/
  // désinscription pour un volume qui n'existe pas encore). L'opérateur écrit, personnellement.
  const relancer = (t: Tenant) => {
    if (!t.email) { toast.error(i('Aucun e-mail pour cette boutique', 'No email for this shop', 'Sin email para esta tienda', 'Nessuna email per questo negozio')); return }
    const subject = encodeURIComponent(i('Un coup de main pour démarrer sur HabaShop ?', 'A hand getting started on HabaShop?', '¿Ayuda para empezar en HabaShop?', 'Una mano per iniziare su HabaShop?'))
    const body = encodeURIComponent(i(
      `Bonjour,\n\nVous vous êtes inscrit sur HabaShop mais n'avez pas encore ajouté de produit. Puis-je vous aider à démarrer ?`,
      `Hello,\n\nYou signed up on HabaShop but haven't added a product yet. Can I help you get started?`,
      `Hola,\n\nSe registró en HabaShop pero aún no ha agregado un producto. ¿Puedo ayudarle a empezar?`,
      `Ciao,\n\nTi sei registrato su HabaShop ma non hai ancora aggiunto un prodotto. Posso aiutarti a iniziare?`))
    window.location.href = `mailto:${t.email}?subject=${subject}&body=${body}`
  }

  const view = useMemo(() => {
    let arr = tenants
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter(t => [t.name, t.country, t.plan].some(v => String(v || '').toLowerCase().includes(q)))
    const val = (t: Tenant): string | number => {
      switch (sortKey) {
        case 'name': return String(t.name || '').toLowerCase()
        case 'plan': return String(t.plan || '').toLowerCase()
        case 'users': return t._count?.users ?? 0
        case 'products': return t._count?.products ?? 0
        case 'sales': return t._count?.sales ?? 0
        case 'createdAt': return new Date(t.createdAt).getTime()
        case 'revenue': return t.revenue ?? 0
        case 'lastActivityAt': return t.lastActivityAt ? new Date(t.lastActivityAt).getTime() : 0
      }
    }
    return [...arr].sort((a, b) => {
      const x = val(a), y = val(b)
      if (x < y) return sortDir === 'asc' ? -1 : 1
      if (x > y) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [tenants, query, sortKey, sortDir])

  const PlanBadge = ({ plan }: { plan: string }) => (
    <span style={{ background: mix(planColor(plan), 14), color: planColor(plan), borderRadius: 20, padding: '2px 10px', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'capitalize' }}>{plan}</span>
  )

  const statusCfg = (t: Tenant): { h: string; label: string } => {
    const st = t.status ?? (t.isActive === false ? 'suspended' : 'active')
    if (st === 'active') return { h: 'var(--acc2)', label: i('Actif', 'Active', 'Activo', 'Attivo') }
    if (st === 'trial') return { h: 'var(--warn)', label: i('Essai', 'Trial', 'Prueba', 'Prova') }
    if (st === 'suspended') return { h: 'var(--danger)', label: i('Suspendu', 'Suspended', 'Suspendido', 'Sospeso') }
    if (st === 'pending_payment') return { h: 'var(--acc)', label: i('Paiement', 'Payment', 'Pago', 'Pagamento') }
    return { h: 'var(--text3)', label: st }
  }

  const TABS = [
    { id: 'overview' as const, label: i("Vue d'ensemble", 'Overview', 'Resumen', 'Panoramica'), icon: <LayoutDashboard size={15} />, count: null as number | null, alert: false },
    { id: 'tenants' as const, label: i('Boutiques', 'Shops', 'Tiendas', 'Negozi'), icon: <Store size={15} />, count: stats?.totalTenants ?? null, alert: false },
    { id: 'requests' as const, label: i('Demandes', 'Requests', 'Solicitudes', 'Richieste'), icon: <Inbox size={15} />, count: pendingCount || null, alert: pendingCount > 0 },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      {/* ── Bandeau CONTEXTE PLATEFORME : distinction forte (couleur + libellé) pour
          ne JAMAIS confondre « toutes les boutiques » avec « ma boutique ». ── */}
      <div role="note" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--acc) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--acc) 40%, transparent)', color: 'var(--acc)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)' }}>
        <Globe size={14} />
        <span>{i('Contexte plateforme — vous consultez TOUTES les boutiques', 'Platform context — you are viewing ALL shops', 'Contexto de plataforma — está viendo TODAS las tiendas', 'Contesto piattaforma — stai visualizzando TUTTI i negozi')}</span>
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoMark size={44} />
          <div>
            <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', margin: 0, letterSpacing: '-.5px' }}>{i('Console plateforme', 'Platform console', 'Consola de plataforma', 'Console piattaforma')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.25)', color: 'var(--acc2)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc2)', boxShadow: '0 0 6px var(--acc2)' }} />
                {i('Système opérationnel', 'System operational', 'Sistema operativo', 'Sistema operativo')}
              </span>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>v{APP_VERSION}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton label={i('Actualiser les statistiques', 'Refresh stats', 'Actualizar estadísticas', 'Aggiorna statistiche')} icon={<RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />} onClick={loadStats} disabled={refreshing} variant="surface" />
          <div style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 'var(--fs-label)', color: 'var(--text3)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={13} /> {new Date().toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <button className="topbar-btn" onClick={() => setShowNewTenant(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> {i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</button>
          {/* Coquille opérateur : compte (minimal) + déconnexion. AUCUN retour vers l'app commerçant. */}
          <IconButton label={i('Mon compte', 'My account', 'Mi cuenta', 'Il mio account')} icon={<Settings size={16} />} onClick={() => setShowAccount(true)} variant="surface" />
          <IconButton label={i('Déconnexion', 'Sign out', 'Cerrar sesión', 'Disconnetti')} icon={<LogOut size={16} />} onClick={doLogout} variant="surface" />
        </div>
      </div>

      {/* KPIs MRR / segments / churn RETIRÉS (étape 2) : des chiffres qu'on regarde sans
          pouvoir agir dessus. Remplacés par l'activation (héros) + la liste « à traiter ». */}

      {/* ── Onglets premium ── */}
      <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20, overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: 'none', background: isActive ? 'var(--card)' : 'transparent', color: isActive ? 'var(--text)' : 'var(--text3)', fontSize: 'var(--fs-label)', fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s ease', whiteSpace: 'nowrap', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,.15)' : 'none', minHeight: 40, flexShrink: 0 }}>
              <span style={{ color: isActive ? 'var(--p3)' : 'var(--text4)', display: 'flex', transition: 'color .15s' }}>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', padding: '0 5px',
                  background: tab.alert ? 'rgba(255,59,92,.15)' : isActive ? 'rgba(108,71,255,.15)' : 'var(--bg4)',
                  color: tab.alert ? 'var(--danger)' : isActive ? 'var(--p3)' : 'var(--text4)',
                  border: `1px solid ${tab.alert ? 'rgba(255,59,92,.3)' : isActive ? 'rgba(108,71,255,.2)' : 'var(--border)'}` }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Overview : graphiques ── */}
      {activeTab === 'overview' && (
        loading ? (
          <ResponsiveGrid min={300} gap={16}>
            <Skeleton height={220} /><Skeleton height={220} />
          </ResponsiveGrid>
        ) : tenants.length === 0 ? (
          <EmptyState icon="🏪" title={i('Aucune boutique', 'No shops', 'Sin tiendas', 'Nessun negozio')} message={i('Aucun tenant inscrit pour le moment.', 'No tenants registered yet.', 'Ningún inquilino registrado todavía.', 'Nessun tenant registrato.')} action={{ label: i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio'), onClick: () => setShowNewTenant(true) }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ══ ACTIVATION — HÉROS : le chiffre qui décide de la vie du SaaS, en tête ══
               À zéro « jamais activées » = BONNE nouvelle → état de succès (vert discret),
               pas une carte d'alerte avec un zéro géant. Le compte à rebours n'apparaît qu'≥1. */}
          <div className="panel" style={{ borderColor: activation.neverProduct.length === 0
            ? 'color-mix(in srgb, var(--acc2) 30%, var(--border))'
            : 'color-mix(in srgb, var(--warn) 30%, var(--border))' }}>
            <div className="panel-head"><span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Rocket size={15} /> {i('Activation', 'Activation', 'Activación', 'Attivazione')}</span></div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                {activation.neverProduct.length === 0 ? (
                  <div style={{ minWidth: 220, display: 'flex', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, var(--acc2) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--acc2) 25%, var(--border))', borderRadius: 12, padding: '12px 14px' }}>
                    <CheckCircle2 size={30} style={{ color: 'var(--acc2)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{i('Toutes vos boutiques ont démarré', 'All your shops have started', 'Todas sus tiendas han arrancado', 'Tutti i tuoi negozi sono partiti')}</div>
                      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginTop: 3 }}>{activation.registered} {i('inscrites, chacune avec au moins un produit', 'signed up, each with at least one product', 'registradas, cada una con al menos un producto', 'registrati, ciascuno con almeno un prodotto')}</div>
                    </div>
                  </div>
                ) : (
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--warn)' }}>{i('Jamais activées', 'Never activated', 'Nunca activadas', 'Mai attivate')}</div>
                  <div style={{ fontSize: 46, fontWeight: 'var(--fw-bold)', lineHeight: 1, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                    {activation.neverProduct.length}<span style={{ fontSize: 'var(--fs-md)', color: 'var(--text3)' }}> / {activation.registered} {i('boutiques', 'shops', 'tiendas', 'negozi')}</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', maxWidth: '42ch', marginTop: 6 }}>
                    {i('inscrites sans aucun produit enregistré.', 'signed up with no product recorded.', 'registradas sin ningún producto registrado.', 'registrati senza alcun prodotto registrato.')}
                  </div>
                </div>
                )}
                {/* entonnoir Inscrites → Produit → Vente */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 240 }}>
                  {[
                    { lab: i('Inscrites', 'Signed up', 'Registradas', 'Registrate'), n: activation.registered, c: 'var(--p)' },
                    { lab: i('Ont ajouté un produit', 'Added a product', 'Agregaron producto', 'Prodotto aggiunto'), n: activation.withProduct, c: 'var(--acc3)' },
                    { lab: i('Ont vendu', 'Made a sale', 'Vendieron', 'Hanno venduto'), n: activation.withSale, c: 'var(--acc2)' },
                  ].map(s => {
                    const w = activation.registered ? Math.round((s.n / activation.registered) * 100) : 0
                    return (
                      <div key={s.lab} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', minWidth: 130 }}>{s.lab}</span>
                        <div style={{ height: 24, borderRadius: 6, background: s.c, width: `${Math.max(9, w)}%`, display: 'flex', alignItems: 'center', padding: '0 9px', color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-bold)', fontFamily: 'var(--mono)' }}>{s.n}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* liste actionnable — « jamais revenues » d'abord */}
              {activation.neverProduct.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activation.neverProduct.slice(0, 6).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{t.name}</div>
                        <div style={{ fontSize: 'var(--fs-caption)', color: t.lastActivityAt ? 'var(--text3)' : 'var(--danger)', fontWeight: t.lastActivityAt ? 'var(--fw-regular)' : 'var(--fw-semibold)' }}>
                          {t.lastActivityAt ? `${i('dern. connexion', 'last login', 'últ. conexión', 'ultimo accesso')} ${relTime(t.lastActivityAt, i)}` : i('jamais revenue', 'never returned', 'nunca volvió', 'mai tornata')}
                          {' · '}{i('inscrite', 'joined', 'registrada', 'iscritta')} {relTime(t.createdAt, i)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="mini-btn" style={{ minHeight: 36, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => relancer(t)}><Mail size={13} /> {i('Relancer', 'Follow up', 'Contactar', 'Ricontatta')}</button>
                        <button className="mini-btn" style={{ minHeight: 36 }} onClick={() => setSelected(t)}>{i('Fiche', 'Details', 'Ficha', 'Scheda')}</button>
                      </div>
                    </div>
                  ))}
                  {activation.neverProduct.length > 6 && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', paddingLeft: 2 }}>+{activation.neverProduct.length - 6} {i('autres', 'more', 'más', 'altre')}</div>}
                </div>
              )}
            </div>
          </div>

          {/* ══ UNE liste « à traiter » — fusion rétention + facturation, motif en étiquette ══
               TOUJOURS affichée (outil de surveillance) : vide → état explicite qui nomme chaque
               signal surveillé comme sain, jamais un panneau qui disparaît (= « fonction absente ? »). */}
          <div className="panel">
              <div className="panel-head"><span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Inbox size={15} /> {i('Boutiques à traiter', 'Shops to handle', 'Tiendas por atender', 'Negozi da gestire')} <span style={{ fontSize: 'var(--fs-caption)', padding: '2px 8px', borderRadius: 99, background: 'var(--bg3)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{toTreat.length}</span></span></div>
              {toTreat.length === 0 ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    i("aucun essai n'expire dans les 3 jours", 'no trial ends within 3 days', 'ninguna prueba vence en 3 días', 'nessuna prova scade entro 3 giorni'),
                    i('aucune boutique inactive', 'no inactive shop', 'ninguna tienda inactiva', 'nessun negozio inattivo'),
                    i('aucune demande de plan en attente', 'no pending plan request', 'sin solicitudes de plan pendientes', 'nessuna richiesta di piano in sospeso'),
                    i('aucun paiement à vérifier', 'no payment to review', 'ningún pago por revisar', 'nessun pagamento da verificare'),
                  ].map(line => (
                    <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--text3)' }}>
                      <CheckCircle2 size={15} style={{ color: 'var(--acc2)', flexShrink: 0 }} /> {line}
                    </div>
                  ))}
                </div>
              ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {toTreat.map(({ tenant, reasons }) => (
                  <div key={tenant.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{tenant.name}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {reasons.map(r => (
                          <span key={r.kind} style={{ fontSize: 10, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.4px', borderRadius: 99, padding: '2px 8px', background: mix(r.color, 12), color: r.color, border: `1px solid ${mix(r.color, 25)}` }}>{r.label}</span>
                        ))}
                      </div>
                    </div>
                    <button className="mini-btn" style={{ minHeight: 36, flexShrink: 0 }} onClick={() => setSelected(tenant)}>{i('Fiche', 'Details', 'Ficha', 'Scheda')}</button>
                  </div>
                ))}
              </div>
              )}
          </div>

          {/* ══ SANTÉ TECHNIQUE — statut infra (vert tant que rien ne casse), source 1bis ══ */}
          <div className="panel">
            <div className="panel-head"><span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Server size={15} /> {i('Santé technique', 'Technical health', 'Salud técnica', 'Salute tecnica')}</span></div>
            <div style={{ padding: 16 }}>
              <OpsInfrastructure />
            </div>
          </div>

          {/* ══ ÉVÉNEMENTS DE SÉCURITÉ — échelle UTILISATEUR (hors boutique) ══ */}
          <SecurityEvents />
          </div>
        )
      )}

      {/* ── Tenants : cartes ── */}
      {activeTab === 'tenants' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><Store size={15} /> {i('Boutiques', 'Shops', 'Tiendas', 'Negozi')} <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>({view.length})</span></span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="input" style={{ paddingLeft: 32, width: 200, height: 38 }} aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={i('Rechercher…', 'Search…', 'Buscar…', 'Cerca…')} value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <select aria-label={i('Trier par', 'Sort by', 'Ordenar por', 'Ordina per')} className="input" style={{ width: 'auto', height: 38 }} value={sortKey} onChange={e => setSortKey(e.target.value as any)}>
                <option value="createdAt">{i('Date', 'Date', 'Fecha', 'Data')}</option>
                <option value="lastActivityAt">{i('Dernière activité', 'Last activity', 'Última actividad', 'Ultima attività')}</option>
                <option value="revenue">{i('CA', 'Revenue', 'Ingresos', 'Fatturato')}</option>
                <option value="name">{i('Nom', 'Name', 'Nombre', 'Nome')}</option>
                <option value="plan">Plan</option>
                <option value="sales">{i('Ventes', 'Sales', 'Ventas', 'Vendite')}</option>
                <option value="products">{i('Produits', 'Products', 'Productos', 'Prodotti')}</option>
                <option value="users">{i('Users', 'Users', 'Usuarios', 'Utenti')}</option>
              </select>
              <button className="mini-btn" aria-label={i('Inverser le tri', 'Toggle sort direction', 'Invertir orden', 'Inverti ordine')} title={sortDir === 'asc' ? 'A→Z' : 'Z→A'} onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))} style={{ width: 38, height: 38, justifyContent: 'center' }}>{sortDir === 'asc' ? '↑' : '↓'}</button>
            </div>
          </div>

          {loading ? (
            <ResponsiveGrid min={320} gap={12}>
              <Skeleton height={150} /><Skeleton height={150} /><Skeleton height={150} /><Skeleton height={150} />
            </ResponsiveGrid>
          ) : view.length === 0 ? (
            <EmptyState icon="🏪" title={query ? i('Aucun résultat', 'No results', 'Sin resultados', 'Nessun risultato') : i('Aucune boutique', 'No shops', 'Sin tiendas', 'Nessun negozio')} message={query ? i('Aucune boutique ne correspond à votre recherche.', 'No shop matches your search.', 'Ninguna tienda coincide con tu búsqueda.', 'Nessun negozio corrisponde alla ricerca.') : i('Aucun tenant inscrit pour le moment.', 'No tenants registered yet.', 'Ningún inquilino registrado todavía.', 'Nessun tenant registrato.')} />
          ) : (
            <ResponsiveGrid min={320} gap={12}>
              {view.map(t => {
                const pc = planColor(t.plan)
                const sc = statusCfg(t)
                const initials = (t.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                const open = () => setSelected(t)
                return (
                  <div key={t.id} role="button" tabIndex={0} aria-label={`${t.name} — ${planKey(t.plan)}`}
                    onClick={open}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all .15s ease' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,.2)'; el.style.borderColor = mix(pc, 50) }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderColor = 'var(--border)' }}>
                    <div style={{ height: 3, background: `linear-gradient(90deg,${pc},${mix(pc, 40)})` }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${pc},${darken(pc, 70)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: '#fff', flexShrink: 0, boxShadow: `0 4px 10px ${mix(pc, 35)}` }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{t.name}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.4px', background: mix(pc, 12), color: pc, border: `1px solid ${mix(pc, 22)}` }}>{planKey(t.plan)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', background: mix(sc.h, 14), color: sc.h, border: `1px solid ${mix(sc.h, 28)}` }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: sc.h, boxShadow: sc.label === i('Actif', 'Active', 'Activo', 'Attivo') ? `0 0 5px ${sc.h}` : 'none' }} />
                              {sc.label}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text4)', flexShrink: 0 }} />
                      </div>

                      <div style={{ height: 1, background: 'var(--border)', margin: '0 0 10px' }} />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', borderRadius: 9, overflow: 'hidden', marginBottom: 10 }}>
                        {[
                          { lbl: i('Ventes', 'Sales', 'Ventas', 'Vendite'), val: String(t._count?.sales ?? 0), color: 'var(--acc)' },
                          { lbl: i('Produits', 'Products', 'Productos', 'Prodotti'), val: String(t._count?.products ?? 0), color: 'var(--p3)' },
                          { lbl: i('Users', 'Users', 'Usuarios', 'Utenti'), val: String(t._count?.users ?? 0), color: 'var(--acc2)' },
                        ].map((m, idx) => (
                          <div key={idx} style={{ background: 'var(--card)', padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: m.color, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.val}</div>
                            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 1 }}>{m.lbl}</div>
                          </div>
                        ))}
                      </div>

                      {/* CA boutique (refunded exclu) — donnée réelle via /api/admin/tenants */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 8, background: mix('var(--acc3)', 8), marginBottom: 10 }}>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 5 }}><Wallet size={11} /> {i('CA', 'Revenue', 'Ingresos', 'Fatturato')}</span>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--acc3)', fontFamily: 'var(--mono)' }}>{fmtXOF(t.revenue ?? 0)}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={10} style={{ color: 'var(--text4)', flexShrink: 0 }} />
                          {i('Activité', 'Activity', 'Actividad', 'Attività')} {relTime(t.lastActivityAt, i)}
                        </div>
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                          {new Date(t.createdAt).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </ResponsiveGrid>
          )}
        </div>
      )}

      {/* ── Demandes de plan ── */}
      {activeTab === 'requests' && (
        <div>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CreditCard size={15} /> {i('Demandes de plans en attente', 'Pending plan requests', 'Solicitudes de planes pendientes', 'Richieste piani in attesa')}
            {pendingCount > 0 && <span style={{ fontSize: 'var(--fs-caption)', padding: '2px 8px', borderRadius: 99, background: 'rgba(255,59,92,.15)', color: 'var(--danger)', fontWeight: 'var(--fw-semibold)' }}>{pendingCount}</span>}
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton height={92} count={3} /></div>
          ) : planRequests.length === 0 ? (
            <EmptyState icon="🎉" title={i('Aucune demande en attente', 'No pending requests', 'Sin solicitudes pendientes', 'Nessuna richiesta in attesa')} message={i('Toutes les demandes de plan ont été traitées.', 'All plan requests have been processed.', 'Todas las solicitudes han sido procesadas.', 'Tutte le richieste sono state elaborate.')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {planRequests.map(req => {
                // ⚠️ Deux branches pour CINQ moyens : `mtn_money`, `virement` et `card`
                // s'affichaient BRUTS à l'opérateur. Record partagé (jumeau backend).
                const pm = { label: paymentMethodLabel(req.paymentMethod, lang), c: paymentMethodColor(req.paymentMethod) }
                return (
                  <div key={req.id} style={{ background: 'var(--card)', border: '1px solid rgba(255,149,0,.2)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'rgba(255,149,0,.1)', border: '1px solid rgba(255,149,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc)' }}>
                      <CreditCard size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 4 }}>{req.tenant?.name ?? '—'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', background: 'rgba(108,71,255,.1)', color: 'var(--p3)', border: '1px solid rgba(108,71,255,.2)', textTransform: 'capitalize' }}>{req.plan} · {req.period}</span>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', background: 'rgba(255,149,0,.1)', color: 'var(--acc)', border: '1px solid rgba(255,149,0,.2)', fontFamily: 'var(--mono)' }}>{fmtXOF(req.amount ?? 0)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', background: mix(pm.c, 12), color: pm.c, border: `1px solid ${mix(pm.c, 25)}` }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: pm.c }} /> {pm.label}
                        </span>
                      </div>
                      {req.paymentRef && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', fontFamily: 'var(--mono)', marginTop: 4 }}>{i('Réf', 'Ref', 'Ref', 'Rif')}: {req.paymentRef}</div>}
                      {req.notes && <div style={{ marginTop: 3, fontStyle: 'italic', color: 'var(--text4)', fontSize: 'var(--fs-caption)' }}>"{req.notes}"</div>}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      <button onClick={() => handleApprove(req.id)} aria-label={`${i('Approuver', 'Approve', 'Aprobar', 'Approva')} ${req.tenant?.name ?? req.id}`}
                        style={{ padding: '8px 16px', borderRadius: 9, background: 'linear-gradient(135deg,var(--acc2),#00875A)', border: 'none', color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5, minHeight: 36 }}>
                        <Check size={13} /> {i('Approuver', 'Approve', 'Aprobar', 'Approva')}
                      </button>
                      <button onClick={() => handleReject(req.id)} aria-label={`${i('Rejeter', 'Reject', 'Rechazar', 'Rifiuta')} ${req.tenant?.name ?? req.id}`}
                        style={{ padding: '8px 14px', borderRadius: 9, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.2)', color: 'var(--danger)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5, minHeight: 36 }}>
                        <X size={13} /> {i('Rejeter', 'Reject', 'Rechazar', 'Rifiuta')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={selected.name} onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div ref={detailBoxRef} style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px,100vw)', background: 'var(--card,#fff)', borderLeft: '1px solid var(--border,rgba(0,0,0,.08))', boxShadow: '-20px 0 60px rgba(0,0,0,.3)', padding: 24, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', margin: 0 }}>{selected.name}</h3>
                <div style={{ marginTop: 6 }}><PlanBadge plan={planKey(selected.plan)} /></div>
              </div>
              <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={() => setSelected(null)}><X size={14} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { l: i('Utilisateurs', 'Users', 'Usuarios', 'Utenti'), v: selected._count?.users ?? 0 },
                { l: i('Produits', 'Products', 'Productos', 'Prodotti'), v: selected._count?.products ?? 0 },
                { l: i('Ventes', 'Sales', 'Ventas', 'Vendite'), v: selected._count?.sales ?? 0 },
                { l: i('Valeur/mois', 'Value/mo', 'Valor/mes', 'Valore/mese'), v: fmtXOF(planPrice(selected.plan)) },
              ].map(s => (
                <div key={s.l} className="kpi-card" style={{ padding: 12 }}>
                  <div className="kpi-label">{s.l}</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-sm)' }}>
              {[
                ['ID', selected.id],
                [i('Devise', 'Currency', 'Divisa', 'Valuta'), selected.currency],
                [i('Pays', 'Country', 'País', 'Paese'), selected.country ?? '—'],
                [i('TVA', 'VAT', 'IVA', 'IVA'), `${selected.vatRate ?? 0}%`],
                [i('Créée le', 'Created', 'Creada', 'Creato'), new Date(selected.createdAt).toLocaleString(lang)],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border,rgba(0,0,0,.06))', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text3)' }}>{l}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 'var(--fw-regular)', fontFamily: l === 'ID' ? 'monospace' : undefined, fontSize: l === 'ID' ? 11 : 13 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New tenant modal */}
      {showNewTenant && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')} onClick={e => e.target === e.currentTarget && setShowNewTenant(false)}>
          <div ref={newTenantBoxRef} className="modal-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><Store size={16} /> {i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</h3>
              <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={() => setShowNewTenant(false)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>{i('Nom de la boutique *', 'Shop name *', 'Nombre de la tienda *', 'Nome del negozio *')}</label>
                <input aria-label={i('Nom de la boutique *', 'Shop name *', 'Nombre de la tienda *', 'Nome del negozio *')} className="input" placeholder="Ex: Superette Kouassi" value={newTenantForm.name} onChange={e => setNewTenantForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Plan</label>
                  <select aria-label="Plan" className="input" value={newTenantForm.plan} onChange={e => setNewTenantForm(f => ({ ...f, plan: e.target.value }))}>
                    {purchasablePlans().map(p => (
                      <option key={p.id} value={p.id}>{p.label} — {fmtXOF(p.monthly ?? 0)}/{i('mois', 'mo', 'mes', 'mese')}</option>
                    ))}
                    {/* Sur devis : aucun prix affiché, l'opérateur saisit le montant négocié. */}
                    <option value="enterprise">Enterprise — {i('sur devis', 'custom quote', 'presupuesto', 'su preventivo')}</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{i('Devise', 'Currency', 'Divisa', 'Valuta')}</label>
                  <select aria-label={i('Devise', 'Currency', 'Divisa', 'Valuta')} className="input" value={newTenantForm.currency} onChange={e => setNewTenantForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="XAF">FCFA (XAF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar US (USD)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>{i('Email administrateur', 'Admin email', 'Email admin', 'Email admin')}</label>
                <input aria-label={i('Email administrateur', 'Admin email', 'Email admin', 'Email admin')} className="input" type="email" placeholder="admin@boutique.com" value={newTenantForm.adminEmail} onChange={e => setNewTenantForm(f => ({ ...f, adminEmail: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{i('Mot de passe admin', 'Admin password', 'Contraseña admin', 'Password admin')}</label>
                <input aria-label={i('Mot de passe admin', 'Admin password', 'Contraseña admin', 'Password admin')} className="input" type="password" placeholder={i('Min. 8 caractères', 'Min. 8 chars', 'Mín. 8 caracteres', 'Min. 8 caratteri')} value={newTenantForm.adminPassword} onChange={e => setNewTenantForm(f => ({ ...f, adminPassword: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="topbar-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={async () => {
                if (!newTenantForm.name) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
                try {
                  const created = await adminApi.createTenant(newTenantForm)
                  setTenants(prev => [created, ...prev])
                  setShowNewTenant(false)
                  toast.success(i(`Boutique "${newTenantForm.name}" créée !`, `Shop "${newTenantForm.name}" created!`, `¡Tienda "${newTenantForm.name}" creada!`, `Negozio "${newTenantForm.name}" creato!`))
                  setNewTenantForm({ name: '', currency: DEFAULT_MARKET.currency, country: DEFAULT_MARKET.country, plan: 'starter', adminEmail: '', adminPassword: '' })
                } catch {
                  toast.error(i('Erreur création boutique', 'Error creating shop', 'Error al crear tienda', 'Errore creazione negozio'))
                }
              }}>{i('Créer la boutique', 'Create shop', 'Crear tienda', 'Crea negozio')}</button>
              <button className="mini-btn" style={{ padding: '10px 16px' }} onClick={() => setShowNewTenant(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Volet COMPTE minimal (opérateur) : mot de passe, langue, thème. Volontairement
          PAS la page Réglages commerçant (TVA/POS/boutique) — hors périmètre d'un opérateur. ── */}
      {showAccount && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i('Mon compte', 'My account', 'Mi cuenta', 'Il mio account')} onClick={e => e.target === e.currentTarget && setShowAccount(false)}>
          <div ref={accountBoxRef} className="modal-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Settings size={16} /> {i('Mon compte', 'My account', 'Mi cuenta', 'Il mio account')}</h3>
              <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={() => setShowAccount(false)}><X size={14} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}><Globe size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{i('Langue', 'Language', 'Idioma', 'Lingua')}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['it', 'Italiano']] as const).map(([code, label]) => (
                  <button key={code} className="mini-btn" onClick={() => updateConfig({ lang: code })}
                    style={lang === code ? { background: 'var(--c-purple-bg)', borderColor: 'var(--p2)', color: 'var(--p2)' } : undefined}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{i('Thème', 'Theme', 'Tema', 'Tema')}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {THEME_OPTIONS.map(o => (
                  <button key={o.key} className="mini-btn" onClick={() => updateConfig({ theme: o.key })}
                    style={theme === o.key ? { background: 'var(--c-purple-bg)', borderColor: 'var(--p2)', color: 'var(--p2)' } : undefined}>{o.emoji} {o.label[lang] ?? o.label.fr}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={lbl}><Lock size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />{i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input className="input" type="password" autoComplete="current-password" aria-label={i('Mot de passe actuel', 'Current password', 'Contraseña actual', 'Password attuale')} placeholder={i('Mot de passe actuel', 'Current password', 'Contraseña actual', 'Password attuale')} value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} />
                <input className="input" type="password" autoComplete="new-password" aria-label={i('Nouveau mot de passe', 'New password', 'Nueva contraseña', 'Nuova password')} placeholder={i('Nouveau (min. 8 caractères)', 'New (min. 8 chars)', 'Nueva (mín. 8 caracteres)', 'Nuova (min. 8 caratteri)')} value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} />
                <input className="input" type="password" autoComplete="new-password" aria-label={i('Confirmer le nouveau mot de passe', 'Confirm new password', 'Confirmar nueva contraseña', 'Conferma nuova password')} placeholder={i('Confirmer', 'Confirm', 'Confirmar', 'Conferma')} value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} />
                <button className="topbar-btn" style={{ justifyContent: 'center' }} disabled={savingPwd || !pwd.current || !pwd.next} onClick={changePassword}>
                  {savingPwd ? '…' : i('Mettre à jour', 'Update', 'Actualizar', 'Aggiorna')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }
