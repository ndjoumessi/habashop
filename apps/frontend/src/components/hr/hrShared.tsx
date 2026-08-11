import React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

// Formulaires HR (états de HR.tsx, threadés dans les modales).
export type ContractForm = { empId: string; type: string; hiredAt: string; contractEnd: string; salary: number; role: string; dept: string }
export type LeaveForm = { empId: string | number; type: string; startDate: string; endDate: string; notes: string }

/**
 * FRONTIÈRE — ce que `GET /api/employees` renvoie RÉELLEMENT (#185).
 *
 * ⚠️ Dérivé du `model Employee` de `schema.prisma` : la route fait
 * `prisma.employee.findMany({ where: { tenantId } })`, sans `select`, donc le modèle entier
 * traverse.
 *
 * ⚠️ TROIS écarts avec le type de domaine `Employee` ci-dessous, tous du motif exact de #215
 * (`isActive` lu comme `active`) :
 *   • `id` est un **cuid string**, jamais un nombre (cf. CLAUDE.md § Pièges — « jamais
 *     `Number(id)` ») — le domaine le déclare `number`, ce qui est faux sur le fil ;
 *   • `isActive` côté API ↔ `active` côté écran ;
 *   • `photo` côté API ↔ `photoUrl` côté écran.
 * Les confondre donne un `undefined` silencieux, pas une erreur.
 *
 * ⚠️ `GET /api/employees` ne filtre PAS `deletedAt` — la colonne existe (soft delete) mais la
 * liste la ignore. C'est une observation, pas une correction : la route `DELETE` fait un
 * `prisma.employee.delete()` DUR, donc `deletedAt` n'est aujourd'hui jamais renseigné par ce
 * chemin. Champ conservé au type parce qu'il EST sur le fil.
 */
/**
 * FRONTIÈRE — primes et historique salarial (#185).
 *
 * ⚠️ Dérivés des `model EmployeeBonus` / `model SalaryHistory` : les routes de `hr.ts` font
 * un `findMany` SANS `select`, donc les modèles entiers traversent. Les quatre routes de
 * liste (globale et par employé) rendent la MÊME forme.
 *
 * ⚠️ Ce sont les deux tables dont la FK `tenantId` vient d'être posée (#183) : `tenantId` est
 * bien sur le fil, il n'est simplement plus falsifiable côté base.
 */
export interface ApiEmployeeBonus {
  id: string
  tenantId: string
  employeeId: string
  amount: number
  reason: string
  /** `DateTime` Prisma → chaîne ISO après sérialisation JSON. */
  date: string
  createdAt: string
}

export interface ApiSalaryHistory {
  id: string
  tenantId: string
  employeeId: string
  oldSalary: number
  newSalary: number
  reason: string
  date: string
  createdAt: string
}

/** Corps de `POST /api/bonuses` — `employeeId` et `amount` sont EXIGÉS par le handler (400 sinon). */
export type BonusWrite = {
  employeeId: string
  amount: number
  reason?: string
  /** Absente → le serveur pose `new Date()`. */
  date?: string
}

/** Corps de `POST /api/salary-history` — `employeeId` et `newSalary` exigés (400 sinon). */
export type SalaryHistoryWrite = {
  employeeId: string
  newSalary: number
  /** Absent → 0 côté serveur, pas une erreur. */
  oldSalary?: number
  reason?: string
  date?: string
}

/**
 * FRONTIÈRE — plannings, présences, bulletins (#185).
 *
 * ⚠️ MÊME ASYMÉTRIE que les congés, sur DEUX domaines de plus : `GET /api/shifts` et
 * `GET /api/attendance` font tous deux
 * `include: { employee: { select: { id, name, avatar, dept } } }`, tandis que leurs `POST`
 * (upsert) et `PATCH` rendent la ligne NUE. Trois domaines RH partagent donc ce piège —
 * d'où un type de base et un type « …WithEmployee », jamais un type unique optimiste.
 *
 * ⚠️ `date` est une CHAÎNE `YYYY-MM-DD` et les heures des chaînes `HH:MM` — pas des
 * `DateTime`. C'est délibéré côté schéma ; les convertir en `Date` réintroduirait le
 * décalage de fuseau.
 */
export interface ApiShift {
  id: string
  tenantId: string
  employeeId: string
  date: string
  /** morning | afternoon | full | night | rest | leave — validé serveur (400 sinon). */
  shiftTypeKey: string
  startTime: string | null
  endTime: string | null
  label: string | null
  color: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiAttendance {
  id: string
  tenantId: string
  employeeId: string
  date: string
  /** PRESENT | LATE | ABSENT | LEAVE | REST */
  status: string
  arriveTime: string | null
  departTime: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

/** L'employé partiellement sélectionné, commun aux trois listes RH. */
export type EmployeeStub = { id: string; name: string; avatar: string; dept: string }

/**
 * Corps de `PATCH /api/shifts/:id` — le handler n'écrit QUE ces cinq champs (spread
 * conditionnel sur `!== undefined`). `employeeId` et `date` ne sont PAS modifiables : ils
 * identifient la case du planning, on supprime et on recrée.
 */
export type ShiftWrite = {
  shiftTypeKey?: string
  startTime?: string | null
  endTime?: string | null
  label?: string | null
  color?: string | null
}

/** Corps de `PATCH /api/attendance/:id` — quatre champs, même motif. */
export type AttendanceWrite = {
  status?: string
  arriveTime?: string | null
  departTime?: string | null
  note?: string | null
}

/** Formes rendues par les LISTES seules (`include` serveur). */
export interface ApiShiftWithEmployee extends ApiShift { employee: EmployeeStub }
export interface ApiAttendanceWithEmployee extends ApiAttendance { employee: EmployeeStub }

/**
 * Bulletin PERSISTÉ — ⚠️ INSTANTANÉ GELÉ (cf. § Paie de CLAUDE.md) : `baseSalary`, `bonus`,
 * `overtime`, `deductions`, `absences`, `cnss`, `ir`, `net` ET `employeeName` sont figés à la
 * génération. `cnss`/`ir` le sont parce qu'ils dépendent de TAUX LÉGAUX : les recalculer à
 * l'affichage rejouerait un bulletin passé au barème du jour.
 *
 * ⚠️ Ne JAMAIS joindre `Employee.salary` pour l'affichage — une augmentation postérieure
 * réécrirait ce qui a été versé.
 */
export interface ApiPayroll {
  id: string
  tenantId: string
  employeeId: string
  /** Clé ISO `YYYY-MM`, jamais le libellé d'écran — le serveur refuse le reste en 400. */
  month: string
  status: string
  /** Posé par le SERVEUR : une date de versement doit être vérifiable, pas déclarée. */
  paidAt: string | null
  employeeName: string
  role: string
  baseSalary: number
  bonus: number
  overtime: number
  deductions: number
  absences: number
  cnss: number
  ir: number
  net: number
  createdAt: string
  updatedAt: string
}

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REFUSED'] as const
export type LeaveStatus = typeof LEAVE_STATUSES[number]

/**
 * FRONTIÈRE — `GET /api/leave-requests` (#185).
 *
 * ⚠️ ASYMÉTRIE, comme pour les commandes : la LISTE fait
 * `include: { employee: { select: { id, name, avatar, dept } } }`, alors que `PATCH`,
 * `approve` et `refuse` rendent la demande NUE, sans `employee`. Un type unique qui
 * promettrait `employee` partout ferait lire `undefined.name` sur le retour d'une
 * approbation — l'erreur n'apparaîtrait qu'à l'exécution.
 *
 * ⚠️ `startDate`/`endDate` sont des CHAÎNES `YYYY-MM-DD` en base (pas des `DateTime`) :
 * les traiter en dates ferait repasser par le décalage de fuseau que `fmtDate` évite.
 */
export interface ApiLeaveRequest {
  id: string
  tenantId: string
  employeeId: string
  startDate: string
  endDate: string
  leaveType: string
  status: LeaveStatus
  reason: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Forme RENVOYÉE PAR LA LISTE seule : la demande + l'employé partiellement sélectionné. */
export interface ApiLeaveRequestWithEmployee extends ApiLeaveRequest {
  employee: { id: string; name: string; avatar: string; dept: string }
}

/** Corps de `PATCH /api/leave-requests/:id` — le handler n'écrit QUE ces quatre champs. */
export type LeaveRequestWrite = {
  startDate?: string
  endDate?: string
  leaveType?: string
  reason?: string | null
}

export interface ApiEmployee {
  id: string
  tenantId: string
  name: string
  role: string
  dept: string
  type: string
  salary: number
  phone: string | null
  email: string | null
  address: string | null
  photo: string | null
  hiredAt: string
  endAt: string | null
  isActive: boolean
  /** `null` = pas encore évalué. ⚠️ Ne PAS retyper `number` : ce serait rouvrir la porte au repli `?? 3`. */
  perf: number | null
  avatar: string
  color: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Corps accepté en écriture — miroir d'`EMPLOYEE_FIELDS` (`apps/backend/src/schemas/writesB.ts`),
 * partagé par CREATE et UPDATE. ⚠️ `hiredAt` y est `z.any()` : le serveur accepte une chaîne
 * ISO, on ne promet donc pas mieux qu'une chaîne ici.
 */
export type EmployeeWrite = {
  name?: string
  role?: string
  dept?: string
  type?: string
  salary?: number
  phone?: string | null
  email?: string | null
  address?: string | null
  photo?: string | null
  isActive?: boolean
  color?: string
  hiredAt?: string
  /** `null` = non évalué ; `undefined` = champ non transmis. Les deux sont distincts. */
  perf?: number | null
  avatar?: string
}

export interface Employee {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  /** Libellé de contrat — `string` OUVERT, pas `ContractType` : la colonne est libre en base. */
  type: string
  hiredAt: string
  endAt?: string
  avatar: string
  color: string
  active: boolean
  phone: string
  email: string
  /** `null` = non évalué ; `undefined` = champ non transmis. Les deux sont distincts. */
  perf?: number | null
  address?: string
  photoUrl?: string
}

export interface LeaveRequest {
  id: string          // cuid backend (LeaveRequest.id)
  empId: string       // employeeId
  empName?: string
  type: string
  from: string
  to: string
  days: number
  motif: string
  status: 'pending' | 'approved' | 'refused'
}

// Mappe une demande de congé API (status MAJUSCULE, employeeId/startDate/endDate/leaveType/reason)
// → forme frontend LeaveRequest (status minuscule, from/to/type/motif). `days` recalculé.
export function mapApiLeave(r: any): LeaveRequest {
  const from = String(r.startDate ?? ''), to = String(r.endDate ?? '')
  const days = (from && to) ? eachDateInclusive(from, to).length : 0
  return {
    id: String(r.id),
    empId: String(r.employeeId ?? ''),
    empName: r.employee?.name,
    type: r.leaveType ?? 'Congé',
    from, to, days,
    motif: r.reason ?? '',
    status: (String(r.status ?? 'PENDING').toLowerCase() as LeaveRequest['status']),
  }
}

// ─── Static data ──────────────────────────────────────────────────────────────

/**
 * ÉTAT DU FORMULAIRE EMPLOYÉ — le type qui manquait à la liste.
 *
 * ⚠️ `HR.tsx` le tenait en `useState<any>({})` et `EditEmployeeModal` en `editEmpForm: any`.
 * C'est le membre absent de la série qui a permis le `strict: true` (`StockForm`, `CatForm`,
 * `CustomerForm`, `ContractForm`, `LeaveForm`, `DiscountForm`) — et son absence a coûté trois
 * défauts mesurés en production le 2026-08-09, tous invisibles à `tsc` :
 *   • la photo n'était JAMAIS persistée ni relue (`photoUrl` envoyé, `photo` attendu) ;
 *   • un CDD s'affichait « CDI » (l'adaptateur lisait `e.contractType`, qui n'existe pas) ;
 *   • la couleur enregistrée était écrasée par la palette à chaque chargement.
 * Un `any` ne laisse pas passer une faute de frappe : il laisse passer une API imaginaire.
 */
export type EmpForm = {
  name: string
  role: string
  dept: string
  type: string
  hiredAt: string
  /** ⚠️ Nom d'ÉCRAN pour `Employee.endAt`. ⚠️ ET IL N'EST PAS PERSISTABLE : ni `EMPLOYEE_FIELDS`
   *  (zod) ni `routes/employees.ts` n'acceptent de date de fin. Le champ est saisi et jeté —
   *  mesuré le 2026-08-09, le seul CDD de production porte `endAt: null`. Dette BACKEND, pas
   *  un oubli d'ici : `toEmployeeWrite` ne l'envoie donc pas, plutôt que de le faire stripper. */
  contractEnd?: string
  color: string
  /** ⚠️ `isActive`, PAS `active` : ce formulaire suit le nom du FIL, et zod l'accepte tel quel.
   *  Le renommer en `active` casserait la modale, qui le lit sous ce nom. Vérifié avant d'écrire. */
  isActive: boolean
  phone: string
  email: string
  perf?: number | null
  address?: string
  /** ⚠️ Nom d'ÉCRAN. Le fil porte `photo` — c'est `toEmployeeWrite` qui convertit. */
  photoUrl?: string
}

/**
 * ADAPTATEUR API → ÉCRAN. Seule voie autorisée pour construire un `Employee`.
 *
 * ⚠️ Le paramètre est `ApiEmployee`, PAS `any` : lire un champ que le serveur n'envoie pas
 * devient une **erreur de compilation** (TS2339) au lieu d'un `undefined` silencieux. C'est
 * la parade appliquée à `routes/export.ts` après quatre lectures de champs inexistants.
 */
export function employeeFromApi(e: ApiEmployee, index: number): Employee {
  return {
    // ⚠️ `Employee.id` est déclaré `number` alors que le fil porte un cuid STRING. Écart connu,
    // documenté en tête de fichier, HORS PÉRIMÈTRE ici : le corriger ripple sur tout le module.
    id: (e.id ?? index + 1) as unknown as number,
    name: e.name,
    role: e.role,
    dept: e.dept,
    salary: e.salary ?? 0,
    // ⚠️ `e.type`, PAS `e.contractType` — ce dernier n'existe pas sur le fil, donc le repli
    // `?? 'CDI'` s'appliquait TOUJOURS : Aminata Touré était en CDD en base et « CDI » à l'écran.
    type: e.type || 'CDI',
    hiredAt: toInputDate(e.hiredAt) || '01/01/2024',
    endAt: toInputDate(e.endAt) || undefined,
    avatar: e.avatar || initialesDe(e.name),
    // ⚠️ La couleur ENREGISTRÉE prime ; la palette n'est qu'un repli pour un employé qui n'en a
    // pas. `COLORS[index % n]` inconditionnel jetait le choix du gérant à chaque rechargement.
    color: e.color || COLORS[index % COLORS.length],
    active: e.isActive,
    phone: e.phone ?? '',
    email: e.email ?? '',
    perf: e.perf,
    address: e.address ?? '',
    photoUrl: e.photo ?? undefined,
  }
}

/**
 * ADAPTATEUR ÉCRAN → API. Seule voie autorisée pour construire un corps d'écriture.
 *
 * ⚠️ Étaler le formulaire brut (`{ ...editEmpForm }`) était LE défaut : la liste blanche zod du
 * serveur **strippe** les clés inconnues, donc `photoUrl` partait et disparaissait sans un mot,
 * pendant que l'écran affichait « Sauvegardé ! ». Le retour est `EmployeeWrite`, miroir
 * d'`EMPLOYEE_FIELDS` — ajouter un champ ici sans l'ajouter au zod ne compile pas.
 */
export function toEmployeeWrite(form: EmpForm, extra: { salary?: number; avatar?: string } = {}): EmployeeWrite {
  return {
    ...(extra.salary !== undefined && { salary: extra.salary }),
    ...(extra.avatar !== undefined && { avatar: extra.avatar }),
    name: form.name,
    role: form.role,
    dept: form.dept,
    type: form.type,
    phone: form.phone || null,
    email: form.email || null,
    address: form.address || null,
    photo: form.photoUrl || null,   // ⚠️ LE mappage qui manquait — `photoUrl` à l'écran, `photo` sur le fil
    isActive: form.isActive,
    color: form.color,
    hiredAt: form.hiredAt,
    perf: form.perf,
  }
}

/** Formulaire employé vide — l'état initial doit satisfaire `EmpForm`, pas `{}`. */
export function empFormVide(): EmpForm {
  return { name: '', role: '', dept: 'Ventes', type: 'CDI', hiredAt: '', color: 'var(--p)',
           isActive: true, phone: '', email: '', perf: null, address: '', photoUrl: '' }
}

/** Initiales d'un nom — repli d'avatar quand la base n'en porte pas. */
export function initialesDe(nom: string): string {
  return (nom || '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export const COLORS = ['#6C3FD6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#8B5CF6','#F472B6']
export const DEPT_COLORS: Record<string, string> = {
  'Ventes':     '#6C3FD6',
  'Stock':      '#F59E0B',
  'Finance':    '#10B981',
  'Direction':  '#3B82F6',
  'Logistique': '#8B5CF6',
  'Marketing':  '#EC4899',
  'RH':         '#EF4444',
}


export const STATUS_CFG = {
  present: { label:'Présent',  color:'var(--acc2)',    bg:'rgba(14,196,126,.12)'  },
  retard:  { label:'Retard',   color:'var(--acc)',     bg:'rgba(240,165,0,.12)'   },
  absent:  { label:'Absent',   color:'var(--danger)',  bg:'rgba(232,64,74,.12)'   },
  conge:   { label:'Congé',    color:'#60A5FA',        bg:'rgba(59,130,246,.12)'  },
  repos:   { label:'Repos',    color:'var(--text3)',   bg:'var(--bg3)'            },
}

export const LEAVE_STATUS_CFG = {
  pending:  { label:'En attente', color:'var(--acc)',    bg:'rgba(240,165,0,.12)'  },
  approved: { label:'Approuvé',   color:'var(--acc2)',   bg:'rgba(14,196,126,.12)' },
  refused:  { label:'Refusé',     color:'var(--danger)', bg:'rgba(232,64,74,.12)'  },
}

// ─── i18n maps (rôles / départements / statuts) ─────────────────────────────────
// Traduisent les valeurs FR à l'affichage uniquement ; les valeurs custom passent inchangées (fallback).

export const localeOf = (lang: string): string =>
  lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

export const ROLE_LABELS: Record<string, Record<string, string>> = {
  'Caissier':    { fr:'Caissier',    en:'Cashier',     es:'Cajero',      it:'Cassiere'     },
  'Caissière':   { fr:'Caissière',   en:'Cashier',     es:'Cajera',      it:'Cassiera'     },
  'Vendeur':     { fr:'Vendeur',     en:'Sales rep',   es:'Vendedor',    it:'Venditore'    },
  'Vendeuse':    { fr:'Vendeuse',    en:'Sales rep',   es:'Vendedora',   it:'Venditrice'   },
  'Manager':     { fr:'Manager',     en:'Manager',     es:'Gerente',     it:'Manager'      },
  'Directeur':   { fr:'Directeur',   en:'Director',    es:'Director',    it:'Direttore'    },
  'Directrice':  { fr:'Directrice',  en:'Director',    es:'Directora',   it:'Direttrice'   },
  'Comptable':   { fr:'Comptable',   en:'Accountant',  es:'Contable',    it:'Contabile'    },
  'Magasinier':  { fr:'Magasinier',  en:'Storekeeper', es:'Almacenero',  it:'Magazziniere' },
  'Magasinière': { fr:'Magasinière', en:'Storekeeper', es:'Almacenera',  it:'Magazziniera' },
  'Responsable': { fr:'Responsable', en:'Supervisor',  es:'Responsable', it:'Responsabile' },
  'Livreur':     { fr:'Livreur',     en:'Delivery',    es:'Repartidor',  it:'Fattorino'    },
  'Sécurité':    { fr:'Sécurité',    en:'Security',    es:'Seguridad',   it:'Sicurezza'    },
  'RH':          { fr:'RH',          en:'HR',          es:'RR.HH.',      it:'HR'           },
  'Admin':       { fr:'Admin',       en:'Admin',       es:'Admin',       it:'Admin'        },
  'Employé':     { fr:'Employé',     en:'Employee',    es:'Empleado',    it:'Dipendente'   },
}
export const roleLabel = (r: string, lang: string): string =>
  ROLE_LABELS[r]?.[lang] ?? r

export const DEPT_LABELS: Record<string, Record<string, string>> = {
  'Ventes':     { fr:'Ventes',     en:'Sales',      es:'Ventas',     it:'Vendite'    },
  'Stock':      { fr:'Stock',      en:'Stock',      es:'Stock',      it:'Stock'      },
  'Finance':    { fr:'Finance',    en:'Finance',    es:'Finanzas',   it:'Finanza'    },
  'Direction':  { fr:'Direction',  en:'Management', es:'Dirección',  it:'Direzione'  },
  'Marketing':  { fr:'Marketing',  en:'Marketing',  es:'Marketing',  it:'Marketing'  },
  'Logistique': { fr:'Logistique', en:'Logistics',  es:'Logística',  it:'Logistica'  },
  'RH':         { fr:'RH',         en:'HR',         es:'RR.HH.',     it:'HR'         },
  'IT':         { fr:'IT',         en:'IT',         es:'IT',         it:'IT'         },
  'Sécurité':   { fr:'Sécurité',   en:'Security',   es:'Seguridad',  it:'Sicurezza'  },
  'Général':    { fr:'Général',    en:'General',    es:'General',    it:'Generale'   },
}
export const deptLabel = (d: string, lang: string): string =>
  DEPT_LABELS[d]?.[lang] ?? d

/**
 * LES TYPES DE CONTRAT — source unique. Les trois formulaires la consomment, aucun ne réénumère.
 *
 * ⚠️ MESURÉ le 2026-08-06 : le domaine était énuméré à TROIS endroits et les trois divergeaient —
 * `EmpModal` n'offrait que CDI/CDD, `EditEmployeeModal` et `NewContractModal` les cinq. Un employé
 * créé en « Stage » depuis un écran devenait inéditable depuis l'autre.
 *
 * ⚠️ `Employee.type` reste un `string`, PAS `ContractType` — et c'est délibéré. La colonne est un
 * `String` libre en base (`schema.prisma`, aucun enum) et le zod backend est `z.string().optional()` :
 * typer le domaine en union FERMÉE serait une nouvelle affirmation que la donnée ne garantit pas,
 * exactement le motif qu'on vient de retirer. `ContractType` ne type que l'état de FORMULAIRE, où le
 * `<select>` rend l'ensemble réellement clos. `contractLabel` retombe déjà sur la valeur brute pour
 * l'inconnu — un type non prévu doit rester visible, jamais assimilé (cf. `Tenant.status`).
 */
export const CONTRACT_TYPES = ['CDI', 'CDD', 'Temps partiel', 'Stage', 'Freelance'] as const
export type ContractType = typeof CONTRACT_TYPES[number]

/**
 * Seul « CDI » est à durée INDÉTERMINÉE. Les quatre autres peuvent porter une fin de contrat.
 *
 * ⚠️ NE PAS s'en servir pour décider qu'un contrat EXPIRE : c'est `endAt` qui le dit, pas le
 * libellé. Un Stage ou un Freelance daté expire tout autant qu'un CDD — cf. `HRContractsTab`.
 */
export const isOpenEnded = (type: string): boolean => type === 'CDI'

export const CONTRACT_LABELS: Record<string, Record<string, string>> = {
  'CDI':       { fr:'CDI',       en:'Permanent',  es:'Indefinido', it:'Indeterminato' },
  'CDD':       { fr:'CDD',       en:'Fixed-term', es:'Temporal',   it:'Determinato'   },
  'Freelance': { fr:'Freelance', en:'Freelance',  es:'Freelance',  it:'Freelance'     },
  'Stage':     { fr:'Stage',     en:'Internship', es:'Prácticas',  it:'Tirocinio'     },
  'Temps partiel': { fr:'Temps partiel', en:'Part-time', es:'Tiempo parcial', it:'Part-time' },
}
export const contractLabel = (t: string, lang: string): string =>
  CONTRACT_LABELS[t]?.[lang] ?? t

export const ATTEND_LABELS: Record<string, Record<string, string>> = {
  present: { fr:'Présent',  en:'Present',  es:'Presente',      it:'Presente'       },
  retard:  { fr:'Retard',   en:'Late',     es:'Retraso',       it:'Ritardo'        },
  late:    { fr:'Retard',   en:'Late',     es:'Retraso',       it:'Ritardo'        },
  absent:  { fr:'Absent',   en:'Absent',   es:'Ausente',       it:'Assente'        },
  half:    { fr:'Mi-temps', en:'Half-day', es:'Media jornada', it:'Mezza giornata' },
  conge:   { fr:'Congé',    en:'On leave', es:'De permiso',    it:'In ferie'       },
  repos:   { fr:'Repos',    en:'Day off',  es:'Descanso',      it:'Riposo'         },
  leave:   { fr:'Congé',    en:'Leave',    es:'Permiso',       it:'Congedo'        },
  rest:    { fr:'Repos',    en:'Rest',     es:'Descanso',      it:'Riposo'         },
}
export const attendStatusLabel = (s: string, lang: string): string =>
  ATTEND_LABELS[s]?.[lang] ?? (STATUS_CFG as any)[s]?.label ?? s

// Mapping statut feuille de présence (frontend, minuscule) ⇄ API Attendance (MAJUSCULE).
// La feuille gère present/late/absent/half/leave/rest (1:1 avec l'API depuis Phase 3).
export type AttendUiStatus = 'present' | 'late' | 'absent' | 'half' | 'leave' | 'rest'
export const attendStatusToApi: Record<AttendUiStatus, string> = {
  present: 'PRESENT', late: 'LATE', absent: 'ABSENT', half: 'HALF', leave: 'LEAVE', rest: 'REST',
}
export function attendStatusFromApi(s: string): AttendUiStatus {
  const m: Record<string, AttendUiStatus> = {
    PRESENT: 'present', LATE: 'late', ABSENT: 'absent', HALF: 'half', LEAVE: 'leave', REST: 'rest',
  }
  return m[s] ?? 'absent'
}

// Tous les jours calendaires "YYYY-MM-DD" de `from` à `to` INCLUS (UTC, sans dérive de
// fuseau). Pur (testable). Borne dure 366 j. Utilisé pour reporter un congé approuvé en
// entrées Attendance LEAVE jour par jour.
export function eachDateInclusive(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return []
  const start = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return []
  const out: string[] = []
  const d = new Date(start)
  let guard = 0
  while (d <= end && guard++ < 366) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export const LEAVE_LABELS: Record<string, Record<string, string>> = {
  pending:  { fr:'En attente', en:'Pending',  es:'Pendiente', it:'In attesa' },
  approved: { fr:'Approuvé',   en:'Approved', es:'Aprobado',  it:'Approvato' },
  refused:  { fr:'Refusé',     en:'Refused',  es:'Rechazado', it:'Rifiutato' },
}
export const leaveStatusLabel = (s: string, lang: string): string =>
  LEAVE_LABELS[s]?.[lang] ?? (LEAVE_STATUS_CFG as any)[s]?.label ?? s

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toInputDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  } catch {}
  return ''
}

export function displayDate(dateStr: string | undefined | null, locale = 'fr-FR'): string {
  const iso = toInputDate(dateStr)
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale)
}

// `now` = date de référence ("aujourd'hui"), injectable pour des tests déterministes ;
// par défaut la date du jour réelle (la prod calcule donc une ancienneté qui avance).
export function calcAnciennete(hiredAt: string, lang: string = 'fr', now: Date = new Date()): string {
  const iso = toInputDate(hiredAt)
  if (!iso) return '—'
  const months = Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (months < 0) return '—'
  const years = Math.floor(months / 12), rem = months % 12
  const yLabel = (n: number) => lang === 'en' ? `${n}y` : lang === 'es' ? `${n} año${n > 1 ? 's' : ''}` : lang === 'it' ? `${n} anno${n > 1 ? 'i' : ''}` : `${n} an${n > 1 ? 's' : ''}`
  const mLabel = (n: number) => lang === 'en' ? `${n}mo` : lang === 'es' ? `${n} mes${n > 1 ? 'es' : ''}` : lang === 'it' ? `${n} mese${n > 1 ? 'i' : ''}` : `${n} mois`
  if (years >= 1) return `${yLabel(years)}${rem > 0 ? ` ${mLabel(rem)}` : ''}`
  return mLabel(months)
}


// ─── Avatar ───────────────────────────────────────────────────────────────────

export function EmpAvatar({ emp, size = 36 }: { emp: Employee; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${emp.color}, ${emp.color}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 'var(--fw-bold)', color: '#fff', flexShrink: 0,
      boxShadow: `0 2px 8px ${emp.color}44`,
    }}>
      {emp.avatar}
    </div>
  )
}

// ─── Stars ────────────────────────────────────────────────────────────────────

export function Stars({ v = 0 }: { v: number }) {
  return (
    <span style={{ fontSize: 'var(--fs-caption)' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < v ? '#F59E0B' : 'var(--border2)' }}>★</span>
      ))}
    </span>
  )
}

export const labelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase',
  letterSpacing: '.5px', color: 'var(--text3)', display: 'block', marginBottom: 6,
}
