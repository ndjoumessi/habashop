import { Sun, CloudSun, CalendarDays, Moon, Coffee, Umbrella } from 'lucide-react'

export const SHIFT_TYPES = {
  morning:   { label:'Matin',      hours:'08:00-13:00', color:'#00B8FF', icon:<Sun size={16}/>,         bg:'rgba(0,184,255,.12)'  },
  afternoon: { label:'Après-midi', hours:'13:00-18:00', color:'#FF9500', icon:<CloudSun size={16}/>,    bg:'rgba(255,149,0,.12)'   },
  full:      { label:'Journée',    hours:'08:00-18:00', color:'#00D084', icon:<CalendarDays size={16}/>, bg:'rgba(0,208,132,.12)'  },
  night:     { label:'Nuit',       hours:'20:00-06:00', color:'#6C47FF', icon:<Moon size={16}/>,         bg:'rgba(108,71,255,.12)' },
  rest:      { label:'Repos',      hours:'',            color:'#64647A', icon:<Coffee size={16}/>,       bg:'rgba(100,100,122,.12)'},
  leave:     { label:'Congé',      hours:'',            color:'#FF3B5C', icon:<Umbrella size={16}/>,     bg:'rgba(255,59,92,.12)'  },
}

export type ShiftType = keyof typeof SHIFT_TYPES

export interface PlanningEmployee { id: string; name: string; role: string; dept: string; avatar: string; color: string; isActive: boolean }

// Libellés des types de shift i18n (par clé)
const SHIFT_LABELS_T: Record<string, Record<string, string>> = {
  morning:   { fr:'Matin',      en:'Morning',   es:'Mañana',   it:'Mattina'    },
  afternoon: { fr:'Après-midi', en:'Afternoon', es:'Tarde',    it:'Pomeriggio' },
  full:      { fr:'Journée',    en:'Full day',  es:'Jornada',  it:'Giornata'   },
  night:     { fr:'Nuit',       en:'Night',     es:'Noche',    it:'Notte'      },
  rest:      { fr:'Repos',      en:'Day off',   es:'Descanso', it:'Riposo'     },
  leave:     { fr:'Congé',      en:'Leave',     es:'Permiso',  it:'Ferie'      },
}
export const shiftLabel = (key: string, lang: string) =>
  SHIFT_LABELS_T[key]?.[lang] ?? (SHIFT_TYPES as any)[key]?.label ?? key

export const getDayLabels = (lang: string) => ({
  fr:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
  en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  es:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
  it:['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
}[lang as 'fr'|'en'|'es'|'it'] ?? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])

// Stockage local des shifts (clé partagée Planning ⇄ écriture depuis l'approbation de congés HR).
export const SHIFTS_STORAGE_KEY = 'habashop_shifts'
// Carte parallèle des cellules VERROUILLÉES (congé approuvé) : `${empId}` → `${dayIndex}` → true.
// Séparée du store shifts (qui ne stocke qu'une string par case) → non invasif. Posée par
// writeLeaveShiftsToPlanning, lue par Planning/PlanningGrid. (Sera remplacée en Phase 6 par
// LeaveRequest.status=APPROVED quand le planning devient API-backed.)
export const LOCKED_SHIFTS_KEY = 'habashop_shifts_locked'
export function readLockedShifts(): Record<string, Record<number, boolean>> {
  try { return JSON.parse(localStorage.getItem(LOCKED_SHIFTS_KEY) ?? 'null') ?? {} } catch { return {} }
}

// Mappe un intervalle [from,to] (YYYY-MM-DD) sur des INDEX de jour de semaine (Lun=0…Dim=6),
// modèle de la grille planning. Fonction pure (testable). Borne dure à 366 j (anti-boucle).
export function weekdayIndicesForRange(from: string, to: string): number[] {
  const start = new Date(from), end = new Date(to)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return []
  const out = new Set<number>()
  const d = new Date(start)
  let guard = 0
  while (d <= end && guard++ < 366) {
    const js = d.getDay()              // 0=Dim…6=Sam (convention JS)
    out.add(js === 0 ? 6 : js - 1)     // → Lun=0…Dim=6 (convention grille)
    d.setDate(d.getDate() + 1)
  }
  return [...out].sort((a, b) => a - b)
}

// Écrit des shifts "Congé" dans le store planning (localStorage) pour un employé sur les
// jours couverts par l'intervalle. Best-effort (localStorage peut être indisponible).
// ⚠️ Le modèle planning est indexé par jour de semaine (0-6), AGNOSTIQUE de la semaine :
// le congé s'affiche donc sur ces jours quelle que soit la semaine affichée (limite connue).
export function writeLeaveShiftsToPlanning(empId: string, from: string, to: string): void {
  try {
    const indices = weekdayIndicesForRange(from, to)
    if (indices.length === 0) return
    const raw = JSON.parse(localStorage.getItem(SHIFTS_STORAGE_KEY) ?? 'null') ?? {}
    const empShifts = { ...(raw[empId] ?? {}) }
    indices.forEach(di => { empShifts[di] = 'leave' as ShiftType })
    raw[empId] = empShifts
    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(raw))
    // Verrouille ces cellules (congé approuvé → non modifiable dans la grille).
    const locked = readLockedShifts()
    const empLocked = { ...(locked[empId] ?? {}) }
    indices.forEach(di => { empLocked[di] = true })
    locked[empId] = empLocked
    localStorage.setItem(LOCKED_SHIFTS_KEY, JSON.stringify(locked))
  } catch { /* localStorage indisponible : best-effort, on ignore */ }
}

export const localeFor = (lang: string) =>
  lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

export const buildT = (lang: string) => ({
  fr:{
    title:'Planning', week:'Semaine', today:'Aujourd\'hui',
    prev:'Préc.', next:'Suiv.', employee:'Employé',
    allDepts:'Tous les départements', allStatus:'Tous les shifts',
    assignTip:'Sélectionnez un type puis cliquez sur une case',
    clearTip:'Double-clic pour effacer',
    export:'Export CSV', stats:'Résumé semaine',
    noEmp:'Aucun employé',
  },
  en:{
    title:'Planning', week:'Week', today:'Today',
    prev:'Prev', next:'Next', employee:'Employee',
    allDepts:'All departments', allStatus:'All shifts',
    assignTip:'Select a type then click a cell',
    clearTip:'Double-click to clear',
    export:'Export CSV', stats:'Week summary',
    noEmp:'No employees',
  },
  es:{
    title:'Planificación', week:'Semana', today:'Hoy',
    prev:'Ant.', next:'Sig.', employee:'Empleado',
    allDepts:'Todos los departamentos', allStatus:'Todos los turnos',
    assignTip:'Seleccione un tipo y haga clic en una celda',
    clearTip:'Doble clic para borrar',
    export:'Exportar CSV', stats:'Resumen semana',
    noEmp:'Sin empleados',
  },
  it:{
    title:'Pianificazione', week:'Settimana', today:'Oggi',
    prev:'Prec.', next:'Succ.', employee:'Dipendente',
    allDepts:'Tutti i reparti', allStatus:'Tutti i turni',
    assignTip:'Seleziona un tipo poi clicca una cella',
    clearTip:'Doppio clic per cancellare',
    export:'Esporta CSV', stats:'Riepilogo settimana',
    noEmp:'Nessun dipendente',
  },
}[lang as 'fr'|'en'|'es'|'it'] ?? {
  title:'Planning',week:'Week',today:'Today',prev:'Prev',next:'Next',
  employee:'Employee',allDepts:'All depts',allStatus:'All',
  assignTip:'Select type then click',clearTip:'Dbl-click to clear',
  export:'Export',stats:'Summary',noEmp:'No employees',
})
