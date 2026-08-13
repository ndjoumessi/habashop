import { useState, useMemo, useEffect } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { useAppStore, t } from '@/stores/appStore'
import {
  Search, Download, X,
  ShoppingCart, Package, PackageCheck, PackageX, Lock, UserCog, ClipboardList,
  Users, UserPlus, UserMinus, UserX, Settings, Wallet, Heart, Target,
  CheckCircle, Info, AlertTriangle, AlertOctagon,
  Shield, ToggleLeft, LogIn, LogOut, Truck, Trash2, Activity as ActivityIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV } from '@/utils/export'
import { auditApi, accountApi } from '@/lib/api'
import type { ApiSecurityEvent } from '@/lib/apiTypes'
import type { LucideIcon } from 'lucide-react'

/**
 * CODE STOCKÉ → CATÉGORIE D'ÉCRAN.
 *
 * ⚠️ QUATRE codes réellement écrits par le serveur manquaient ici — `SETTINGS`,
 * `payroll`, `GOALS`, `account_deletion` — et la conséquence n'était pas cosmétique :
 * la clé non traduite retombait sur elle-même, donc `log.module` valait `'SETTINGS'`
 * pendant que l'option de filtre valait `'PARAMÈTRES'`. La comparaison `===` échouait,
 * et **filtrer « Paramètres » rendait ZÉRO ligne sur un journal composé à 80 % de
 * `SETTINGS`** (mesuré le 2026-08-14 sur `demo-tenant-001` : 7 des 8 lignes visibles).
 * Le badge, lui, affichait le code brut à l'écran.
 *
 * ⚠️ La liste se vérifie CONTRE LE SERVEUR, pas de mémoire : `activityTrace.test.ts`
 * balaie `apps/backend/src` et échoue si un `module: '…'` écrit là-bas n'a pas de
 * catégorie ici. Écrite à la main, elle se périmerait au premier module ajouté — et
 * en silence, puisque le seul symptôme est un filtre qui ne rend rien.
 */
const MODULE_NORMALIZE: Record<string, string> = {
  orders: 'COMMANDES', customers: 'CLIENTS', products: 'STOCK', suppliers: 'COMMANDES',
  billing: 'PARAMÈTRES', employees: 'RH', auth: 'AUTH', tenant: 'PARAMÈTRES', sales: 'VENTES',
  payroll: 'PAIE', goals: 'OBJECTIFS', account_deletion: 'COMPTE', settings: 'PARAMÈTRES',
  expenses: 'PARAMÈTRES',
  // Codes backend en majuscules (audit logs créés directement avec ces noms)
  USERS: 'UTILISATEURS', PRODUCTS: 'STOCK', CUSTOMERS: 'CLIENTS', SUPPLIERS: 'COMMANDES',
  SALES: 'VENTES', EMPLOYEES: 'RH', TENANT: 'PARAMÈTRES', AUTH: 'AUTH',
  SETTINGS: 'PARAMÈTRES', PAYROLL: 'PAIE', GOALS: 'OBJECTIFS', BILLING: 'PARAMÈTRES',
  ACCOUNT_DELETION: 'COMPTE', ORDERS: 'COMMANDES', EXPENSES: 'PARAMÈTRES',
}

/**
 * SOURCE UNIQUE de la clé de catégorie — utilisée par les lignes ET par les options
 * de filtre. Les deux la dérivaient séparément ; c'est exactement ainsi qu'une ligne
 * `SETTINGS` et une option `PARAMÈTRES` ont pu coexister sans jamais se rencontrer.
 *
 * ⚠️ Un code INCONNU reste VISIBLE sous sa forme brute plutôt que d'être rangé
 * d'office dans « Paramètres » : un module qu'on n'a pas prévu doit se voir, pas se
 * fondre dans une catégorie qui le rendrait introuvable.
 */
export function normalizeModule(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : ''
  return (MODULE_NORMALIZE[s] ?? (s || 'PARAMÈTRES')).toUpperCase()
}

// Labels lisibles d'actions techniques en 4 langues
const ACTION_LABELS: Record<string, [string, string, string, string]> = {
  INVITE_USER:        ['Utilisateur invité',     'User invited',          'Usuario invitado',         'Utente invitato'],
  DELETE_USER:        ['Utilisateur supprimé',   'User deleted',          'Usuario eliminado',        'Utente eliminato'],
  UPDATE_USER:        ['Utilisateur modifié',    'User updated',          'Usuario actualizado',      'Utente aggiornato'],
  TOGGLE_USER_ACTIVE: ['Statut compte modifié',  'Account status changed','Estado de cuenta cambiado','Stato account modificato'],
  TOGGLE_USER_2FA:    ['2FA modifié',            '2FA changed',           '2FA cambiado',             '2FA modificato'],
  CREATE_PRODUCT:     ['Produit créé',           'Product created',       'Producto creado',          'Prodotto creato'],
  UPDATE_PRODUCT:     ['Produit modifié',        'Product updated',       'Producto actualizado',     'Prodotto aggiornato'],
  DELETE_PRODUCT:     ['Produit supprimé',       'Product deleted',       'Producto eliminado',       'Prodotto eliminato'],
  CREATE_CUSTOMER:    ['Client créé',            'Customer created',      'Cliente creado',           'Cliente creato'],
  DELETE_CUSTOMER:    ['Client supprimé',        'Customer deleted',      'Cliente eliminado',        'Cliente eliminato'],
  CREATE_SUPPLIER:    ['Fournisseur créé',       'Supplier created',      'Proveedor creado',         'Fornitore creato'],
  DELETE_SUPPLIER:    ['Fournisseur supprimé',   'Supplier deleted',      'Proveedor eliminado',      'Fornitore eliminato'],
  CREATE_SALE:        ['Vente enregistrée',      'Sale recorded',         'Venta registrada',         'Vendita registrata'],
  CREATE_EMPLOYEE:    ['Employé créé',           'Employee created',      'Empleado creado',          'Dipendente creato'],
  DELETE_EMPLOYEE:    ['Employé supprimé',       'Employee deleted',      'Empleado eliminado',       'Dipendente eliminato'],
  LOGIN:              ['Connexion',              'Login',                 'Inicio de sesión',         'Accesso'],
  LOGOUT:             ['Déconnexion',            'Logout',                'Cierre de sesión',         'Disconnessione'],
  UPDATE_TENANT:      ['Boutique mise à jour',   'Shop updated',          'Tienda actualizada',      'Negozio aggiornato'],
  CHANGE_PASSWORD:    ['Mot de passe changé',    'Password changed',      'Contraseña cambiada',      'Password cambiata'],
  // ⚠️ L'action RÉELLEMENT écrite par `routes/auth.ts` est `PASSWORD_CHANGE` — les
  // deux mots dans l'autre ordre. `CHANGE_PASSWORD` ci-dessus n'a jamais été écrit
  // par personne : le repli SNAKE_CASE→Title Case rendait donc « Password Change »,
  // en anglais, dans les quatre langues.
  PASSWORD_CHANGE:    ['Mot de passe modifié',   'Password changed',      'Contraseña cambiada',      'Password cambiata'],
  RESTORE_PRODUCT:    ['Produit restauré',       'Product restored',      'Producto restaurado',      'Prodotto ripristinato'],
  RESTORE_SUPPLIER:   ['Fournisseur restauré',   'Supplier restored',     'Proveedor restaurado',     'Fornitore ripristinato'],
  REFUND_SALE:        ['Remboursement vente',    'Refund sale',           'Reembolso de venta',       'Rimborso vendita'],
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  INVITE_USER:        UserPlus,
  DELETE_USER:        UserMinus,
  UPDATE_USER:        UserCog,
  TOGGLE_USER_ACTIVE: ToggleLeft,
  TOGGLE_USER_2FA:    Shield,
  CREATE_PRODUCT:     Package,
  UPDATE_PRODUCT:     PackageCheck,
  DELETE_PRODUCT:     PackageX,
  CREATE_CUSTOMER:    Users,
  DELETE_CUSTOMER:    UserX,
  CREATE_SUPPLIER:    Truck,
  DELETE_SUPPLIER:    Trash2,
  CREATE_SALE:        ShoppingCart,
  CREATE_EMPLOYEE:    UserPlus,
  DELETE_EMPLOYEE:    UserMinus,
  LOGIN:              LogIn,
  LOGOUT:             LogOut,
  UPDATE_TENANT:      Settings,
  CHANGE_PASSWORD:    Lock,
  PASSWORD_CHANGE:    Lock,
  RESTORE_PRODUCT:    Package,
  RESTORE_SUPPLIER:   Truck,
  REFUND_SALE:        ShoppingCart,
}

function actionLabel(action: string, lang: string): string {
  const labels = ACTION_LABELS[action]
  if (!labels) {
    // Fallback : SNAKE_CASE → Title Case (e.g. "CREATE_FOO" → "Create Foo")
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
  const idx = lang === 'en' ? 1 : lang === 'es' ? 2 : lang === 'it' ? 3 : 0
  return labels[idx]
}

// Extrait une info utile (nom, email, id) du JSON stocké dans la description backend.
// Évite d'afficher le code action en double (ex: "DELETE_USER" comme description).
/**
 * ⚠️ LE CHANGEMENT AVANT→APRÈS ÉTAIT STOCKÉ ET JETÉ. `PATCH /api/tenant` écrit
 * `{ currency: { avant, apres }, vatRate: { avant, apres }, … }` — précisément pour
 * qu'on puisse répondre à « qui a posé ce XAF sur un tenant sénégalais ». Cette
 * fonction n'extrayait que `name | email | ref | id` : aucune de ces clés n'existe
 * dans ce payload, elle rendait donc la chaîne VIDE. Résultat à l'écran : cinq
 * « Tenant Locale Change » rigoureusement indistinguables.
 * *Une trace qu'on ne peut pas consulter n'est pas une trace, c'est un stockage.*
 *
 * ⚠️ ON N'AFFICHE PAS N'IMPORTE QUEL JSON pour autant. Le rendu reste limité à deux
 * formes CONNUES — les clés utiles, et le couple avant/après. Déverser l'objet entier
 * ferait entrer dans l'écran tout ce qu'un futur appelant y mettrait, données
 * personnelles comprises : c'est l'inverse de la règle qui a fait limiter cet audit à
 * des codes et des nombres.
 */
export function parseDescription(raw: unknown, action: string): string {
  const s = typeof raw === 'string' ? raw : ''
  if (!s || s === action) return ''
  if (!s.startsWith('{')) return s
  try {
    const obj = JSON.parse(s) as Record<string, unknown>
    // Forme 1 — un changement de champs : { champ: { avant, apres }, … }
    const changements = Object.entries(obj)
      .filter(([, v]) => !!v && typeof v === 'object' && 'apres' in (v as object))
      .map(([champ, v]) => {
        const { avant, apres } = v as { avant?: unknown; apres?: unknown }
        // ⚠️ « — » pour une valeur absente, jamais une chaîne vide : « devise  → XAF »
        // se lirait comme un bogue d'affichage, quand c'est un champ qui n'existait pas.
        const lisible = (x: unknown) => (x === null || x === undefined || x === '' ? '—' : String(x))
        return `${champ} ${lisible(avant)} → ${lisible(apres)}`
      })
    if (changements.length) return changements.join(' · ')
    // Forme 2 — une entité nommée : { name | email | ref | id }
    const v = obj.name || obj.email || obj.ref || obj.id || ''
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

type Severity = 'success' | 'info' | 'warning' | 'danger'

interface ActivityEntry {
  id: number; module: string; action: string; user: string
  avatar: string; color: string; description: string
  rawDescription: string; createdAt: string
  ip: string; date: string; time: string; severity: Severity
}

const MODULE_CONFIG: Record<string, { color: string; bg: string; label: string; Icon: LucideIcon }> = {
  VENTES:       { color:'#818CF8', bg:'rgba(99,102,241,.15)',   label:'Ventes',       Icon: ShoppingCart },
  STOCK:        { color:'#F59E0B', bg:'rgba(245,158,11,.15)',   label:'Stock',        Icon: Package      },
  AUTH:         { color:'#EF4444', bg:'rgba(239,68,68,.15)',    label:'Auth',         Icon: Lock         },
  RH:           { color:'#A78BFA', bg:'rgba(139,92,246,.15)',   label:'RH',           Icon: UserCog      },
  COMMANDES:    { color:'#2DD4BF', bg:'rgba(20,184,166,.15)',   label:'Commandes',    Icon: ClipboardList },
  UTILISATEURS: { color:'#60A5FA', bg:'rgba(59,130,246,.15)',   label:'Utilisateurs', Icon: Users        },
  PARAMÈTRES:   { color:'#94A3B8', bg:'rgba(148,163,184,.15)', label:'Paramètres',   Icon: Settings     },
  PAIE:         { color:'#34D399', bg:'rgba(16,185,129,.15)',   label:'Paie',         Icon: Wallet       },
  CLIENTS:      { color:'#F472B6', bg:'rgba(244,114,182,.15)', label:'Clients',      Icon: Heart        },
  OBJECTIFS:    { color:'#FBBF24', bg:'rgba(251,191,36,.15)',   label:'Objectifs',    Icon: Target       },
  COMPTE:       { color:'#FB7185', bg:'rgba(251,113,133,.15)', label:'Compte',       Icon: UserX        },
}

/** Catégories d'écran connues — exporté pour que le verrou puisse confronter cette
 *  liste aux modules RÉELLEMENT écrits par le serveur, sans importer les icônes. */
export const CATEGORIES_MODULE: readonly string[] = Object.keys(MODULE_CONFIG)

/** Libellé de catégorie localisé. VENTES traduit (fr/en/es/it) ; les autres gardent
   leur label (codes/abréviations type RH/Auth/Stock, ou déjà clairs). Utilisé par le
   badge ET le filtre → cohérence, et plus aucun « SALES »/clé brute affichée. */
function moduleLabel(key: string, lang: string): string {
  if (key === 'VENTES')    return lang === 'en' ? 'Sales'   : lang === 'es' ? 'Ventas'    : lang === 'it' ? 'Vendite'  : 'Ventes'
  if (key === 'OBJECTIFS') return lang === 'en' ? 'Goals'   : lang === 'es' ? 'Objetivos' : lang === 'it' ? 'Obiettivi' : 'Objectifs'
  if (key === 'COMPTE')    return lang === 'en' ? 'Account' : lang === 'es' ? 'Cuenta'    : lang === 'it' ? 'Account'  : 'Compte'
  return MODULE_CONFIG[key]?.label ?? key
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; Icon: LucideIcon; label: string }> = {
  success: { color:'var(--acc2)',    bg:'rgba(14,196,126,.1)',  Icon: CheckCircle,   label:'Succès'  },
  info:    { color:'var(--p2)',      bg:'rgba(91,78,232,.1)',   Icon: Info,          label:'Info'    },
  warning: { color:'var(--acc)',     bg:'rgba(240,165,0,.1)',   Icon: AlertTriangle, label:'Alerte'  },
  danger:  { color:'var(--danger)',  bg:'rgba(232,64,74,.1)',   Icon: AlertOctagon,  label:'Danger'  },
}

function mapAuditLog(l: any, idx: number): ActivityEntry {
  // ⚠️ LA MÊME fonction que les options de filtre. Deux dérivations séparées de la
  // même clé, c'est le défaut qu'on ferme : la ligne disait `SETTINGS`, l'option
  // disait `PARAMÈTRES`, et l'égalité n'arrivait jamais.
  const mod = normalizeModule(l.module)
  const cfg = MODULE_CONFIG[mod] ?? MODULE_CONFIG['PARAMÈTRES']
  const name = l.user?.name ?? 'Système'
  const d = new Date(l.createdAt)
  const sev: Severity = (['success', 'info', 'warning', 'danger'].includes(l.severity) ? l.severity : 'info') as Severity
  const rawDescription = typeof l.description === 'string' ? l.description : ''
  return {
    id: idx + 1,
    module: mod,
    action: l.action ?? '',
    user: name,
    avatar: name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(),
    color: cfg.color,
    rawDescription,
    createdAt: isNaN(d.getTime()) ? '' : d.toISOString(),
    description: rawDescription, // conservé pour la recherche, mais le rendu utilise parseDescription
    ip: l.ip ?? '—',
    date: isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
    time: isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5),
    severity: sev,
  }
}

const TODAY_ISO = new Date().toISOString().slice(0, 10)

const ITEMS_PER_PAGE = 8

export default function Activity() {
  const { lang } = useAppStore()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])

  const [search,         setSearch]         = useState('')
  const [moduleFilter,   setModuleFilter]   = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateFilter,     setDateFilter]     = useState('all')
  const [currentPage,    setCurrentPage]    = useState(1)
  const [loading,        setLoading]        = useState(true)
  /** Compte RÉEL en base, envoyé par la route. `null` tant qu'on ne le sait pas. */
  const [totalServeur,   setTotalServeur]   = useState<number | null>(null)
  /** Le journal n'a pas pu être lu — DISTINCT de « aucun événement ». */
  const [echec,          setEchec]          = useState(false)
  /** Compteurs calculés EN BASE — voir `ApiAuditLogPage`. `null` = pas encore connus. */
  const [stats,          setStats]          = useState<{ aujourdhui: number; alertes: number } | null>(null)
  /**
   * Codes de module PRÉSENTS en base, envoyés par la route. `null` = pas encore connus.
   * ⚠️ Ni les options du filtre ni le KPI ne se dérivent des lignes chargées : la route
   * plafonne, donc un module dont le dernier événement est au-delà du plafond
   * disparaîtrait du filtre — et le module deviendrait littéralement infiltrable.
   */
  const [modulesPresents, setModulesPresents] = useState<string[] | null>(null)

  useEffect(() => {
    auditApi.list()
      .then((page) => {
        setActivityLog((page?.items ?? []).map(mapAuditLog))
        // ⚠️ Le total vient du SERVEUR, jamais de `items.length` : la route plafonne.
        // `?? 0` serait un chiffre inventé — on garde `null`, et l'écran le DIT.
        setTotalServeur(typeof page?.total === 'number' ? page.total : null)
        setStats(page?.stats ?? null)
        setModulesPresents(Array.isArray(page?.modulesPresents) ? page.modulesPresents : null)
      })
      // ⚠️ L'ERREUR NE S'AVALE PAS ICI NON PLUS. La route REMONTE volontairement son
      // échec (« un journal d'audit muet est pire qu'un journal indisponible, parce
      // qu'on le croit ») — et l'écran le transformait en liste vide, donc en « il ne
      // s'est rien passé ». Le garde serveur faisait son travail, l'affichage le
      // défaisait.
      .catch(() => setEchec(true))
      .finally(() => setLoading(false))
  }, [])

  /**
   * ── (b) LA SÉCURITÉ DU COMPTE VIT DANS UNE AUTRE TABLE ───────────────────────
   *
   * `UserAuditLog` est d'échelle UTILISATEUR : le schéma interdit explicitement de
   * lui donner un `tenantId` (« un changement de mot de passe n'appartient à aucune
   * boutique »), et il n'a pas de FK vers `User` pour qu'un audit de sécurité
   * SURVIVE à la suppression du compte qu'il audite. Ce journal-ci, lui, est
   * tenant-scopé. Les deux ne peuvent donc pas fusionner.
   *
   * ⚠️ Le résultat, mesuré le 2026-08-14 : le filtre proposait « Auth » et ne
   * pouvait RIEN rendre, jamais — la route ne lit que `auditLog`. Pire, la seule
   * surface qui expose ces événements à leur propriétaire
   * (`GET /api/account/security-activity`, strictement `where: { userId }`) était
   * déjà écrite côté serveur ET côté client (`accountApi.securityActivity`), et
   * AUCUN écran ne l'appelait. Une surface morte : l'événement était écrit, lisible,
   * et invisible.
   *
   * ⚠️ PANNEAU SÉPARÉ, JAMAIS FUSIONNÉ DANS LA LISTE. Fondues dans le journal de la
   * boutique, ces lignes rendraient l'écran DIFFÉRENT selon qui le regarde — deux
   * administrateurs verraient deux journaux, et le CSV exporté ne serait celui de
   * personne. Le panneau dit son échelle dans son titre.
   */
  const [secuEvents, setSecuEvents] = useState<ApiSecurityEvent[] | null>(null)
  /** ⚠️ DISTINCT de « aucun événement » — même règle que le journal principal. */
  const [secuEchec,  setSecuEchec]  = useState(false)

  useEffect(() => {
    accountApi.securityActivity()
      .then(ev => setSecuEvents(Array.isArray(ev) ? ev : []))
      .catch(() => setSecuEchec(true))
  }, [])

  /**
   * OPTIONS DU FILTRE — dérivées de ce que la base porte VRAIMENT.
   *
   * ⚠️ Elles venaient de `Object.keys(MODULE_CONFIG)` : neuf catégories figées, dont
   * « Auth » (autre table), « RH » (aucun `writeAudit` côté employés) et « Stock »
   * (seules les suppressions de produit écrivent) — trois options qui ne pouvaient
   * rien rendre, à côté de quatre codes écrits qu'aucune option n'atteignait. Un
   * filtre qui promet ce que la donnée ne porte pas est la famille « champ déclaré
   * qui se fait passer pour une mesure » : on s'y fie, et un résultat vide se lit
   * « il ne s'est rien passé » au lieu de « cette option est morte ».
   *
   * ⚠️ Dédupliqué APRÈS normalisation : `orders` et `suppliers` tombent tous deux sur
   * « Commandes ». Compter les codes STOCKÉS afficherait 2 au KPI pour 1 seule
   * option — deux nombres muets qui se contredisent sur le même écran.
   */
  const optionsModules = useMemo(() => {
    if (!modulesPresents) return null
    const cles = [...new Set(modulesPresents.map(normalizeModule))]
    return cles.sort((a, b) => moduleLabel(a, lang).localeCompare(moduleLabel(b, lang)))
  }, [modulesPresents, lang])

  const filtered = useMemo(() => activityLog.filter(log => {
    const q = search.toLowerCase()
    const haystack = `${log.user} ${actionLabel(log.action, lang)} ${parseDescription(log.rawDescription, log.action)} ${log.action} ${log.module}`.toLowerCase()
    const matchSearch   = !q || haystack.includes(q)
    const matchModule   = !moduleFilter || log.module === moduleFilter
    const matchSeverity = !severityFilter || log.severity === severityFilter
    const matchDate     = dateFilter === 'today' ? log.date === TODAY_ISO : true
    return matchSearch && matchModule && matchSeverity && matchDate
  }), [activityLog, search, moduleFilter, severityFilter, dateFilter, lang])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  // ⚠️ PLUS AUCUN COMPTEUR DÉRIVÉ DES LIGNES CHARGÉES. Ils portaient sur les ≤100
  // entrées reçues : « Alertes sécurité » ratait toute alerte plus ancienne que la
  // 100ᵉ ligne, et « Aujourd'hui » se trompait dès qu'une journée dépassait le
  // plafond. Ils viennent maintenant de la base. `null` tant qu'on ne sait pas.
  // ⚠️ Comparaison au total SERVEUR, jamais à une constante recopiée : le plafond vit
  // dans la route, et un 100 réécrit ici se périmerait au premier changement.
  const tronque       = totalServeur !== null && totalServeur > activityLog.length
  const hasFilters    = !!(search || moduleFilter || severityFilter || dateFilter !== 'all')

  const resetPage = () => setCurrentPage(1)

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <Skeleton height={56} count={5} />
    </div>
  )

  /**
   * ⚠️ ÉCHEC N'EST PAS VIDE. Un journal vide AFFIRME qu'il ne s'est rien passé — c'est
   * précisément ce qu'on ne peut pas laisser dire quand la lecture a échoué. Le message
   * nomme l'état et ne présente AUCUN chiffre : ni total, ni « 0 aujourd'hui », puisque
   * aucun n'est connu.
   */
  if (echec) return (
    <div className="panel" style={{ padding: 24, textAlign: 'center' }} role="status">
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
        {lang === 'en' ? 'Audit log unavailable' : lang === 'es' ? 'Registro no disponible'
          : lang === 'it' ? 'Registro non disponibile' : "Journal d'audit indisponible"}
      </div>
      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginTop: 6 }}>
        {lang === 'en' ? 'This does NOT mean "no activity" - the log could not be read.'
          : lang === 'es' ? 'NO significa "sin actividad" - no se pudo leer el registro.'
          : lang === 'it' ? 'NON significa "nessuna attività" - il registro non è leggibile.'
          : "Cela ne veut PAS dire « aucune activité » : le journal n'a pas pu être lu."}
      </div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>
        {lang === 'en' ? 'Retry' : lang === 'es' ? 'Reintentar' : lang === 'it' ? 'Riprova' : 'Réessayer'}
      </button>
    </div>
  )

  return (
    <div className="space-y-5 animate-in">

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fr' ? "Journal d'activité" : lang === 'en' ? 'Activity Log' : lang === 'es' ? 'Registro de actividad' : 'Registro attività'}
          </h1>
          <p className="page-subtitle">
            {/* ⚠️ « Traçabilité COMPLÈTE de toutes les actions » a été retiré : c'était
                FAUX de deux façons — la route plafonne à 100 lignes, et toutes les
                actions n'écrivent pas d'audit (`PATCH /api/tenant` n'en écrivait aucun
                jusqu'au 2026-08-08). Une promesse d'exhaustivité sur un journal d'audit
                est pire qu'un silence : on cesse de chercher ailleurs. Même famille que
                les « 150+ pays » retirés de la page de connexion. */}
            {tronque
              ? (lang === 'en' ? `${activityLog.length} most recent of ${totalServeur}`
                : lang === 'es' ? `${activityLog.length} más recientes de ${totalServeur}`
                : lang === 'it' ? `${activityLog.length} più recenti su ${totalServeur}`
                : `${activityLog.length} plus récents sur ${totalServeur}`)
              : (lang === 'en' ? 'Actions recorded by the audit trail'
                : lang === 'es' ? 'Acciones registradas por la auditoría'
                : lang === 'it' ? 'Azioni registrate dall’audit'
                : "Actions enregistrées par le journal d'audit")}
          </p>
        </div>
        <button className="topbar-btn" onClick={() => {
          exportCSV('habashop_activite',
            ['Horodatage','Module','Action','Utilisateur','Description','IP','Sévérité'],
            filtered.map(log => [`${log.date} ${log.time}`, log.module, log.action, log.user, log.description, log.ip, log.severity])
          )
          toast.success(lang === 'en' ? 'Export downloaded!' : lang === 'es' ? '¡Exportación descargada!' : lang === 'it' ? 'Esportazione scaricata!' : 'Export téléchargé !')
        }}>
          <Download size={14} /> {lang === 'en' ? 'Export CSV' : lang === 'es' ? 'Exportar CSV' : lang === 'it' ? 'Esporta CSV' : 'Exporter CSV'}
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { label: t('activity_total'),    value: totalServeur ?? '…',  color:'var(--p2)'     },
          { label: t('activity_today'),    value: stats?.aujourdhui ?? '…', color:'var(--acc2)' },
          // ⚠️ ZÉRO ALERTE EST UNE BONNE NOUVELLE — la peindre en ROUGE la fait lire
          // comme une alarme. La couleur ne s'allume que s'il y a quelque chose à
          // signaler ; l'œil croit la couleur avant le chiffre.
          { label: t('activity_security'), value: stats?.alertes ?? '…',
            color: stats && stats.alertes > 0 ? 'var(--danger)' : 'var(--text3)' },
          // ⚠️ MÊME SOURCE que les options du filtre — le nombre affiché ici est
          // exactement le nombre d'options proposées à côté. Il venait du serveur
          // (`modules.length`, codes STOCKÉS) alors que les options venaient d'un
          // `Record` figé : rien ne garantissait qu'ils parlent du même ensemble.
          { label: t('activity_modules'),  value: optionsModules?.length ?? '…', color:'var(--acc)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Panel ── */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Filtres */}
        <div style={{ padding:'14px 20px', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
            <input className="input" style={{ paddingLeft:34, fontSize:'var(--fs-sm)' }}
              aria-label="Rechercher" placeholder={lang === 'en' ? 'Search user, action, description...' : lang === 'es' ? 'Buscar usuario, acción, descripción...' : lang === 'it' ? 'Cerca utente, azione, descrizione...' : 'Rechercher utilisateur, action, description...'}
              value={search} onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>
          <select className="input" style={{ width:'auto', fontSize:'var(--fs-sm)' }}
            value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); resetPage() }}>
            <option value="">{t('activity_filter_module')}</option>
            {(optionsModules ?? []).map(m => <option key={m} value={m}>{moduleLabel(m, lang)}</option>)}
          </select>
          {/* ⚠️ « Toutes » ne disait pas toutes QUOI — trois filtres côte à côte, dont
              un sans objet nommé. Un lecteur d'écran l'annonçait de même. */}
          <select className="input" style={{ width:'auto', fontSize:'var(--fs-sm)' }}
            aria-label={i('Sévérité', 'Severity', 'Severidad', 'Gravità')}
            value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); resetPage() }}>
            <option value="">{i('Toutes sévérités', 'All severities', 'Todas las severidades', 'Tutte le gravità')}</option>
            <option value="success">{i('Succès', 'Success', 'Éxito', 'Successo')}</option>
            <option value="info">Info</option>
            <option value="warning">{i('Alerte', 'Warning', 'Alerta', 'Avviso')}</option>
            <option value="danger">{i('Danger', 'Danger', 'Peligro', 'Pericolo')}</option>
          </select>
          <select className="input" style={{ width:'auto', fontSize:'var(--fs-sm)' }}
            value={dateFilter} onChange={e => { setDateFilter(e.target.value); resetPage() }}>
            <option value="all">{lang === 'en' ? 'All dates' : lang === 'es' ? 'Todas las fechas' : lang === 'it' ? 'Tutte le date' : 'Toutes dates'}</option>
            <option value="today">{lang === 'en' ? 'Today' : lang === 'es' ? 'Hoy' : lang === 'it' ? 'Oggi' : "Aujourd'hui"}</option>
          </select>
          {hasFilters && (
            <button className="mini-btn" style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}
              onClick={() => { setSearch(''); setModuleFilter(''); setSeverityFilter(''); setDateFilter('all'); setCurrentPage(1) }}>
              <X size={12} /> {lang === 'en' ? 'Clear' : lang === 'es' ? 'Borrar' : lang === 'it' ? 'Cancella' : 'Effacer'}
            </button>
          )}
        </div>

        {/* ── Timeline ── */}
        <div style={{ padding:'8px 20px 20px', borderTop:'1px solid var(--border)', minHeight:200 }}>
          {paginated.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text3)', fontSize:'var(--fs-body)' }}>
              {lang === 'en' ? 'No events found' : lang === 'es' ? 'Sin eventos encontrados' : lang === 'it' ? 'Nessun evento trovato' : 'Aucun événement trouvé'}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', position:'relative', paddingTop:12 }}>
              {/* Ligne verticale gradient */}
              <div style={{
                position:'absolute', left:19, top:24, bottom:8, width:2,
                background:'linear-gradient(180deg,var(--p),var(--p2),var(--acc2))',
                opacity:.13, borderRadius:99,
              }} />

              {paginated.map(log => {
                const mod         = MODULE_CONFIG[log.module]
                const sev         = SEVERITY_CONFIG[log.severity]
                const moduleColor = mod?.color ?? 'var(--text3)'
                const ActionIcon  = ACTION_ICONS[log.action] ?? mod?.Icon ?? ActivityIcon
                const labelHuman  = actionLabel(log.action, lang)
                const detail      = parseDescription(log.rawDescription, log.action)
                const localeStr   = lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
                const dt          = log.createdAt ? new Date(log.createdAt) : null
                const timeStr     = dt ? dt.toLocaleTimeString(localeStr, { hour: '2-digit', minute: '2-digit' }) : log.time
                const dateStr     = dt ? dt.toLocaleDateString(localeStr, { day: 'numeric', month: 'short' }) : log.date
                const sevLabel    = log.severity === 'success' ? i('Succès', 'Success', 'Éxito', 'Successo')
                                  : log.severity === 'warning' ? i('Alerte', 'Warning', 'Alerta', 'Avviso')
                                  : log.severity === 'danger'  ? i('Danger', 'Danger', 'Peligro', 'Pericolo')
                                  : 'Info'

                return (
                  <div key={log.id}
                    style={{
                      // ⚠️ DENSITÉ — écran de COMPARAISON (on y cherche qui a fait quoi,
                      // et quand), donc le vide y est de la place qu'on n'a pas donnée à
                      // l'information. Passage de 14/18 à 9/14 px : ~10 px gagnés par
                      // ligne, soit une entrée de plus par écran toutes les six.
                      // ⚠️ Ce n'est PAS un écran de décision (cf. `select-shop`, où le
                      // calme isole le choix) — la distinction a déjà été prise à
                      // l'envers une fois.
                      display:'flex', alignItems:'flex-start', gap:12,
                      padding:'9px 14px',
                      background:'var(--card)',
                      border:'1px solid var(--border)',
                      borderLeft:`3px solid ${sev.color}`,
                      borderRadius:12,
                      marginBottom:6,
                      transition:'transform .15s, box-shadow .15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateX(3px)'
                      el.style.boxShadow = '0 4px 16px rgba(0,0,0,.10)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'none'
                      el.style.boxShadow = 'none'
                    }}>
                    {/* Icône d'action dans cercle coloré module */}
                    <div style={{
                      width:38, height:38, borderRadius:'50%', flexShrink:0,
                      background: `${moduleColor}18`,
                      border:`1px solid ${moduleColor}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <ActionIcon size={16} color={moduleColor} />
                    </div>

                    {/* Contenu */}
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Ligne 1 : action lisible + badge sévérité */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'var(--fw-semibold)', fontSize:'var(--fs-body)', color:'var(--text)' }}>
                          {labelHuman}
                        </span>
                        <span style={{
                          fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', padding:'2px 7px', borderRadius:99,
                          background: sev.bg, color: sev.color,
                          textTransform:'uppercase', letterSpacing:'.4px',
                        }}>
                          {sevLabel}
                        </span>
                      </div>

                      {/* Ligne 2 : auteur · module */}
                      <div style={{ fontSize:'var(--fs-label)', color:'var(--text2)', marginBottom: detail ? 4 : 0 }}>
                        <span style={{ fontWeight:'var(--fw-regular)' }}>{log.user}</span>
                        <span style={{ opacity: 0.5 }}> · </span>
                        <span>{moduleLabel(log.module, lang)}</span>
                      </div>

                      {/* Ligne 3 : détail parsé (nom, email…) si dispo */}
                      {detail && (
                        <div style={{
                          fontSize:'var(--fs-label)', color:'var(--text3)', fontStyle:'italic',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        }}>
                          {detail}
                        </div>
                      )}
                    </div>

                    {/* Date à droite */}
                    <div style={{
                      fontSize:'var(--fs-caption)', color:'var(--text3)',
                      flexShrink:0, textAlign:'right',
                      display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2,
                    }}>
                      <span style={{ fontFamily:'var(--mono)' }}>{timeStr}</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 20px', borderTop:'1px solid var(--border)', background:'var(--bg3)',
        }}>
          <span style={{ fontSize:'var(--fs-label)', color:'var(--text3)' }}>
            {filtered.length} événement{filtered.length !== 1 ? 's' : ''} · Page {currentPage}/{totalPages}
          </span>
          <div style={{ display:'flex', gap:6 }}>
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
              ← {lang === 'en' ? 'Prev' : lang === 'es' ? 'Ant.' : lang === 'it' ? 'Prec.' : 'Préc.'}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={{
                width:30, height:30, borderRadius:8, border:'none', cursor:'pointer',
                fontFamily:'var(--font)', fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)',
                background: currentPage === page ? 'var(--p)' : 'var(--bg4)',
                color:      currentPage === page ? '#fff'     : 'var(--text2)',
              }}>{page}</button>
            ))}
            <button className="mini-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
              {lang === 'en' ? 'Next' : lang === 'es' ? 'Sig.' : lang === 'it' ? 'Succ.' : 'Suiv.'} →
            </button>
          </div>
        </div>
      </div>

      {/* ── Sécurité de MON compte — échelle utilisateur, hors boutique ──────────
          ⚠️ Panneau SÉPARÉ par nécessité, pas par goût : `UserAuditLog` n'a pas de
          `tenantId` (le schéma l'interdit) et ne peut donc pas entrer dans un journal
          tenant-scopé. Fusionner les deux listes rendrait aussi l'écran DIFFÉRENT
          selon le lecteur, puisque la route ne rend que SES propres événements.
          Le titre porte l'échelle : sans lui, un admin croirait voir la sécurité de
          toute la boutique. */}
      <div className="panel" style={{ padding: '16px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <Shield size={15} color="var(--p2)" />
          <h2 style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-semibold)', color:'var(--text)', margin:0 }}>
            {i('Sécurité de mon compte', 'My account security', 'Seguridad de mi cuenta', 'Sicurezza del mio account')}
          </h2>
        </div>
        <p style={{ fontSize:'var(--fs-label)', color:'var(--text3)', margin:'0 0 12px' }}>
          {i("Événements liés à votre compte, pas à la boutique — ils n'apparaissent pas dans le journal ci-dessus, et vous seul les voyez.",
             'Events tied to your account, not the shop - they are absent from the log above, and only you can see them.',
             'Eventos de su cuenta, no de la tienda: no aparecen en el registro anterior y solo usted los ve.',
             'Eventi legati al tuo account, non al negozio: assenti dal registro qui sopra, e visibili solo a te.')}
        </p>

        {/* ⚠️ TROIS états, jamais deux. « Rien à afficher » ne doit pas absorber
            « on n'a pas pu lire » : sur un panneau de SÉCURITÉ, une liste vide qui
            veut dire « échec » affirme qu'il ne s'est rien passé sur le compte. */}
        {secuEchec ? (
          <div role="status" style={{ fontSize:'var(--fs-label)', color:'var(--text2)' }}>
            {i("Activité de sécurité indisponible — cela ne veut pas dire « aucun événement ».",
               'Security activity unavailable - this does not mean "no events".',
               'Actividad de seguridad no disponible: no significa «sin eventos».',
               'Attività di sicurezza non disponibile: non significa «nessun evento».')}
          </div>
        ) : secuEvents === null ? (
          <Skeleton height={38} count={2} />
        ) : secuEvents.length === 0 ? (
          <div style={{ fontSize:'var(--fs-label)', color:'var(--text3)' }}>
            {i('Aucun changement de mot de passe enregistré sur ce compte.',
               'No password change recorded on this account.',
               'Ningún cambio de contraseña registrado en esta cuenta.',
               'Nessuna modifica della password registrata su questo account.')}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {secuEvents.map(ev => {
              const localeStr = lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
              const dt        = new Date(ev.createdAt)
              const valide    = !isNaN(dt.getTime())
              const sev       = SEVERITY_CONFIG[ev.severity as Severity] ?? SEVERITY_CONFIG.info
              const EvIcon    = ACTION_ICONS[ev.action] ?? Shield
              return (
                <div key={ev.id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'9px 14px', background:'var(--card)',
                  border:'1px solid var(--border)', borderLeft:`3px solid ${sev.color}`,
                  borderRadius:12,
                }}>
                  <EvIcon size={15} color={sev.color} style={{ flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'var(--fs-body)', color:'var(--text)' }}>
                      {actionLabel(ev.action, lang)}
                    </div>
                    {/* ⚠️ On rend l'IP, PAS `ev.description` : le seul écrivain de cette
                        table y met un littéral FRANÇAIS (« Mot de passe modifié »), qui
                        redirait l'action et injecterait du français dans un écran
                        anglais. L'IP, elle, est l'information propre à l'événement.
                        Si une action future y porte un détail réel, c'est là qu'il ira. */}
                    {ev.ip && (
                      <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', fontFamily:'var(--mono)' }}>
                        {ev.ip}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', flexShrink:0, textAlign:'right' }}>
                    {valide
                      ? `${dt.toLocaleDateString(localeStr, { day:'numeric', month:'short' })} · ${dt.toLocaleTimeString(localeStr, { hour:'2-digit', minute:'2-digit' })}`
                      : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
