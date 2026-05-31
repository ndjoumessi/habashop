import React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Employee {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  type: 'CDI' | 'CDD'
  hiredAt: string
  endAt?: string
  avatar: string
  color: string
  active: boolean
  phone: string
  email: string
  perf?: number
  address?: string
  photoUrl?: string
}

export interface LeaveRequest {
  id: number
  empId: number
  empName?: string
  type: string
  from: string
  to: string
  days: number
  motif: string
  status: 'pending' | 'approved' | 'refused'
}

// ─── Static data ──────────────────────────────────────────────────────────────

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
      fontSize: size * 0.36, fontWeight: 800, color: '#fff', flexShrink: 0,
      boxShadow: `0 2px 8px ${emp.color}44`,
    }}>
      {emp.avatar}
    </div>
  )
}

// ─── Stars ────────────────────────────────────────────────────────────────────

export function Stars({ v = 0 }: { v: number }) {
  return (
    <span style={{ fontSize: 11 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < v ? '#F59E0B' : 'var(--border2)' }}>★</span>
      ))}
    </span>
  )
}

export const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.5px', color: 'var(--text3)', display: 'block', marginBottom: 6,
}
