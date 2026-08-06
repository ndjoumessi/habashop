import {
  Crown, Target, ShoppingCart, Calculator, UserCog,
} from 'lucide-react'
import { t } from '@/stores/appStore'
import { fmtDate } from '@/lib/formatDate'
import type { LucideIcon } from 'lucide-react'

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR'

export interface User {
  id: string; name: string; email: string; role: Role
  active: boolean; twoFA: boolean; lastLogin: string; createdAt: string
}

export const ROLE_CONFIG: Record<Role, { label: string; cls: string; desc: string; color: string; Icon: LucideIcon }> = {
  ADMIN:      { label:'Administrateur', cls:'badge-red',    desc:'Accès total à tous les modules', color:'#6C47FF', Icon: Crown      },
  MANAGER:    { label:'Gérant',         cls:'badge-violet', desc:'Tous modules sauf utilisateurs',  color:'#FF9500', Icon: Target     },
  CASHIER:    { label:'Caissier',       cls:'badge-teal',   desc:'POS uniquement',                  color:'#00D084', Icon: ShoppingCart },
  ACCOUNTANT: { label:'Comptable',      cls:'badge-amber',  desc:'Ventes, dépenses, rapports',     color:'#FFB800', Icon: Calculator },
  HR:         { label:'RH',             cls:'badge-blue',   desc:'RH, planning, paie',             color:'#00B8FF', Icon: UserCog   },
}

export const PERMISSIONS: Record<Role, string[]> = {
  ADMIN:      ['Dashboard','POS','Stock','Commandes','Fournisseurs','Clients','Rapports','RH','Planning','Paie','Dépenses','Prévisions','Utilisateurs','Activité','Paramètres'],
  MANAGER:    ['Dashboard','POS','Stock','Commandes','Fournisseurs','Clients','Rapports','RH','Planning','Dépenses','Prévisions'],
  CASHIER:    ['POS','Stock (lecture)'],
  ACCOUNTANT: ['Dashboard','Rapports','Dépenses','Commandes (lecture)'],
  HR:         ['RH','Planning','Paie'],
}

// Libellés des modules i18n (par nom FR, comme la sidebar)
const MODULE_LABELS_T: Record<string, Record<string, string>> = {
  'Dashboard':    { fr:'Dashboard',    en:'Dashboard',  es:'Panel',          it:'Dashboard'     },
  'POS':          { fr:'POS',          en:'POS',        es:'POS',            it:'POS'           },
  'Stock':        { fr:'Stock',        en:'Stock',      es:'Stock',          it:'Stock'         },
  'Commandes':    { fr:'Commandes',    en:'Orders',     es:'Pedidos',        it:'Ordini'        },
  'Fournisseurs': { fr:'Fournisseurs', en:'Suppliers',  es:'Proveedores',    it:'Fornitori'     },
  'Clients':      { fr:'Clients',      en:'Customers',  es:'Clientes',       it:'Clienti'       },
  'Rapports':     { fr:'Rapports',     en:'Reports',    es:'Informes',       it:'Rapporti'      },
  'RH':           { fr:'RH',           en:'HR',         es:'RR.HH.',         it:'HR'            },
  'Planning':     { fr:'Planning',     en:'Schedule',   es:'Planificación',  it:'Pianificazione'},
  'Paie':         { fr:'Paie',         en:'Payroll',    es:'Nómina',         it:'Busta paga'    },
  'Dépenses':     { fr:'Dépenses',     en:'Expenses',   es:'Gastos',         it:'Spese'         },
  'Prévisions':   { fr:'Prévisions',   en:'Forecasts',  es:'Previsiones',    it:'Previsioni'    },
  'Utilisateurs': { fr:'Utilisateurs', en:'Users',      es:'Usuarios',       it:'Utenti'        },
  'Activité':     { fr:'Activité',     en:'Activity',   es:'Actividad',      it:'Attività'      },
  'Paramètres':   { fr:'Paramètres',   en:'Settings',   es:'Configuración',  it:'Impostazioni'  },
}
const READONLY_T: Record<string, string> = { fr:'lecture', en:'read-only', es:'lectura', it:'lettura' }
export const moduleLabel = (mod: string, lang: string) => {
  const ro = mod.match(/^(.*?)\s*\(lecture\)$/)
  if (ro) return `${MODULE_LABELS_T[ro[1]]?.[lang] ?? ro[1]} (${READONLY_T[lang] ?? 'lecture'})`
  return MODULE_LABELS_T[mod]?.[lang] ?? mod
}

// Descriptions des rôles i18n
const ROLE_DESC_T: Record<Role, Record<string, string>> = {
  ADMIN:      { fr:'Accès total à tous les modules', en:'Full access to all modules',      es:'Acceso total a todos los módulos',   it:'Accesso totale a tutti i moduli' },
  MANAGER:    { fr:'Tous modules sauf utilisateurs', en:'All modules except users',         es:'Todos los módulos excepto usuarios', it:'Tutti i moduli tranne utenti' },
  CASHIER:    { fr:'POS uniquement',                 en:'POS only',                         es:'Solo POS',                           it:'Solo POS' },
  ACCOUNTANT: { fr:'Ventes, dépenses, rapports',     en:'Sales, expenses, reports',         es:'Ventas, gastos, informes',          it:'Vendite, spese, rapporti' },
  HR:         { fr:'RH, planning, paie',             en:'HR, schedule, payroll',            es:'RR.HH., planificación, nómina',      it:'HR, pianificazione, busta paga' },
}
export const roleDesc = (role: Role, lang: string) => ROLE_DESC_T[role]?.[lang] ?? ROLE_CONFIG[role].desc

export const AVATAR_COLORS: Record<Role, string> = {
  ADMIN:      '#6C47FF',
  MANAGER:    '#FF9500',
  CASHIER:    '#00D084',
  ACCOUNTANT: '#FFB800',
  HR:         '#00B8FF',
}

const VALID_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR']

export function mapApiUser(u: any): User {
  const role = (VALID_ROLES.includes(u.role) ? u.role : 'CASHIER') as Role
  return {
    id: String(u.id),
    name: u.name ?? u.email?.split('@')[0] ?? '—',
    email: u.email ?? '',
    role,
    active: u.isActive ?? u.active ?? true,
    twoFA: u.twoFAEnabled ?? u.twoFA ?? false,
    lastLogin: u.lastLoginAt ?? u.lastLogin ?? '',  // ISO ou vide
    createdAt: u.createdAt ?? '',                    // ISO conservée pour formatage à l'affichage
  }
}

export function initials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

export const RECENT_LOGIN_MS = 5 * 60 * 1000

/**
 * Connexion RÉCENTE — mesure un ÉVÉNEMENT D'AUTHENTIFICATION, pas une présence.
 *
 * ⚠️ NE PAS rebaptiser « en ligne » : c'était le nom précédent (`isOnlineNow`) et il
 * promettait ce qu'aucune donnée ne porte. Nous n'observons pas d'activité — seulement
 * l'instant où le mot de passe a été validé. Quelqu'un qui se connecte puis ferme
 * l'onglet reste « connecté il y a 2 min », ce qui est VRAI ; il n'est pas « en ligne »,
 * ce qui serait FAUX. Même famille que la pastille de santé Ops : le signal doit dire ce
 * qu'il mesure, pas ce qu'on aimerait qu'il mesure.
 *
 * ⚠️ La fonction était par ailleurs INATTEIGNABLE : `lastLoginAt` n'était écrit nulle part
 * (0/8 comptes en production, mesuré le 2026-08-06), donc elle rendait `false` par
 * construction. Elle est vivante depuis que `POST /api/auth/login` pose la colonne.
 *
 * `now` injecté (convention du dépôt : jamais de `new Date()` figé dans un test).
 */
export function loggedInRecently(u: User, now: number = Date.now()) {
  if (!u.active || !u.lastLogin) return false
  const ts = new Date(u.lastLogin).getTime()
  if (Number.isNaN(ts)) return false
  return now - ts < RECENT_LOGIN_MS
}

/**
 * Ce que la carte affiche sous « Connexion ».
 *
 * ⚠️ TROIS états, jamais deux — l'absence de trace n'est pas un fait sur la personne.
 * « Jamais » affirmait que le compte ne s'était jamais connecté ; la vérité est que nous
 * n'avons rien enregistré (la colonne n'a commencé à être écrite qu'au déploiement de ce
 * correctif, et les 8 comptes existants sont à `null`). Un écran ne doit pas transformer
 * son propre trou de mesure en jugement sur l'utilisateur.
 */
export function lastLoginLabel(
  u: User,
  lang: string,
  now: number = Date.now(),
): string {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  if (!u.lastLogin) return i('Aucune trace', 'No record', 'Sin registro', 'Nessuna traccia')
  const ts = new Date(u.lastLogin).getTime()
  if (Number.isNaN(ts)) return i('Aucune trace', 'No record', 'Sin registro', 'Nessuna traccia')

  const elapsed = now - ts
  if (elapsed < 60_000) return i('À l’instant', 'Just now', 'Ahora mismo', 'Proprio ora')
  if (elapsed < 3_600_000) {
    const min = Math.floor(elapsed / 60_000)
    return i(`il y a ${min} min`, `${min} min ago`, `hace ${min} min`, `${min} min fa`)
  }
  return fmtDate(u.lastLogin)
}

// Libellés de rôle (t() reactif sur la langue via getState)
export const buildRoleLabels = (): Record<Role, string> => ({
  ADMIN:      t('users_role_admin'),
  MANAGER:    t('users_role_manager'),
  CASHIER:    t('users_role_cashier'),
  ACCOUNTANT: t('users_role_accountant'),
  HR:         t('users_role_hr'),
})
