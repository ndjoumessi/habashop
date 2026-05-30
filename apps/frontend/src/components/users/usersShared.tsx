import {
  Crown, Target, ShoppingCart, Calculator, UserCog,
} from 'lucide-react'
import { t } from '@/stores/appStore'
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

// En ligne = actif ET dernière activité < 5 min
export function isOnlineNow(u: User) {
  if (!u.active || !u.lastLogin) return false
  const ts = new Date(u.lastLogin).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < 5 * 60 * 1000
}

// Libellés de rôle (t() reactif sur la langue via getState)
export const buildRoleLabels = (): Record<Role, string> => ({
  ADMIN:      t('users_role_admin'),
  MANAGER:    t('users_role_manager'),
  CASHIER:    t('users_role_cashier'),
  ACCOUNTANT: t('users_role_accountant'),
  HR:         t('users_role_hr'),
})
