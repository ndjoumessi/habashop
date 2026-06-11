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

// (Phase 6-planning : planning DATÉ via /api/shifts. Les helpers localStorage transitoires
//  — SHIFTS_STORAGE_KEY, LOCKED_SHIFTS_KEY/readLockedShifts, weekdayIndicesForRange,
//  writeLeaveShiftsToPlanning — ont été SUPPRIMÉS. Le verrouillage des congés approuvés est
//  désormais dérivé de LeaveRequest.status=APPROVED côté Planning.)

export const localeFor = (lang: string) =>
  lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

// Date locale → "YYYY-MM-DD" (clé Shift backend ; local, pas UTC, pour coller à weekDays/monthGrid).
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const buildT = (lang: string) => ({
  fr:{
    title:'Planning', week:'Semaine', month:'Mois', today:'Aujourd\'hui',
    prev:'Préc.', next:'Suiv.', employee:'Employé',
    allDepts:'Tous les départements', allStatus:'Tous les shifts',
    assignTip:'Sélectionnez un type puis cliquez sur une case',
    clearTip:'Double-clic ou touche Suppr pour effacer',
    filterDeptAria:'Filtrer par département', filterStatusAria:'Filtrer par type de shift',
    export:'Export CSV', stats:'Résumé semaine',
    noEmp:'Aucun employé',
    emptyCell:'Vide', moveHandle:'Déplacer',
    moveMode:'Mode déplacement — choisissez une case puis Entrée, ou touchez la case cible. Échap pour annuler.',
    moved:'Créneau déplacé.', moveCancelled:'Déplacement annulé.',
    prevWeek:'Semaine précédente', nextWeek:'Semaine suivante',
    prevMonth:'Mois précédent', nextMonth:'Mois suivant',
    viewToggle:'Bascule vue semaine/mois',
    copyWeekAria:'Copier la semaine vers la suivante',
    assignGroup:'Type de créneau à assigner',
  },
  en:{
    title:'Planning', week:'Week', month:'Month', today:'Today',
    prev:'Prev', next:'Next', employee:'Employee',
    allDepts:'All departments', allStatus:'All shifts',
    assignTip:'Select a type then click a cell',
    clearTip:'Double-click or Delete key to clear',
    filterDeptAria:'Filter by department', filterStatusAria:'Filter by shift type',
    export:'Export CSV', stats:'Week summary',
    noEmp:'No employees',
    emptyCell:'Empty', moveHandle:'Move',
    moveMode:'Move mode — choose a cell then Enter, or tap the target cell. Esc to cancel.',
    moved:'Shift moved.', moveCancelled:'Move cancelled.',
    prevWeek:'Previous week', nextWeek:'Next week',
    prevMonth:'Previous month', nextMonth:'Next month',
    viewToggle:'Toggle week/month view',
    copyWeekAria:'Copy week to next week',
    assignGroup:'Shift type to assign',
  },
  es:{
    title:'Planificación', week:'Semana', month:'Mes', today:'Hoy',
    prev:'Ant.', next:'Sig.', employee:'Empleado',
    allDepts:'Todos los departamentos', allStatus:'Todos los turnos',
    assignTip:'Seleccione un tipo y haga clic en una celda',
    clearTip:'Doble clic o tecla Supr para borrar',
    filterDeptAria:'Filtrar por departamento', filterStatusAria:'Filtrar por tipo de turno',
    export:'Exportar CSV', stats:'Resumen semana',
    noEmp:'Sin empleados',
    emptyCell:'Vacío', moveHandle:'Mover',
    moveMode:'Modo mover — elija una celda y pulse Intro, o toque la celda destino. Esc para cancelar.',
    moved:'Turno movido.', moveCancelled:'Movimiento cancelado.',
    prevWeek:'Semana anterior', nextWeek:'Semana siguiente',
    prevMonth:'Mes anterior', nextMonth:'Mes siguiente',
    viewToggle:'Cambiar vista semana/mes',
    copyWeekAria:'Copiar la semana a la siguiente',
    assignGroup:'Tipo de turno a asignar',
  },
  it:{
    title:'Pianificazione', week:'Settimana', month:'Mese', today:'Oggi',
    prev:'Prec.', next:'Succ.', employee:'Dipendente',
    allDepts:'Tutti i reparti', allStatus:'Tutti i turni',
    assignTip:'Seleziona un tipo poi clicca una cella',
    clearTip:'Doppio clic o tasto Canc per cancellare',
    filterDeptAria:'Filtra per reparto', filterStatusAria:'Filtra per tipo di turno',
    export:'Esporta CSV', stats:'Riepilogo settimana',
    noEmp:'Nessun dipendente',
    emptyCell:'Vuoto', moveHandle:'Sposta',
    moveMode:'Modalità spostamento — scegli una cella poi Invio, o tocca la cella di destinazione. Esc per annullare.',
    moved:'Turno spostato.', moveCancelled:'Spostamento annullato.',
    prevWeek:'Settimana precedente', nextWeek:'Settimana successiva',
    prevMonth:'Mese precedente', nextMonth:'Mese successivo',
    viewToggle:'Cambia vista settimana/mese',
    copyWeekAria:'Copia la settimana nella successiva',
    assignGroup:'Tipo di turno da assegnare',
  },
}[lang as 'fr'|'en'|'es'|'it'] ?? {
  title:'Planning',week:'Week',month:'Month',today:'Today',prev:'Prev',next:'Next',
  employee:'Employee',allDepts:'All depts',allStatus:'All',
  assignTip:'Select type then click',clearTip:'Dbl-click or Delete to clear',
  filterDeptAria:'Filter by department',filterStatusAria:'Filter by shift type',
  export:'Export',stats:'Summary',noEmp:'No employees',
  emptyCell:'Empty',moveHandle:'Move',
  moveMode:'Move mode — choose a cell then Enter, or tap the target cell. Esc to cancel.',
  moved:'Shift moved.',moveCancelled:'Move cancelled.',
  prevWeek:'Previous week',nextWeek:'Next week',
  prevMonth:'Previous month',nextMonth:'Next month',
  viewToggle:'Toggle week/month view',
  copyWeekAria:'Copy week to next week',
  assignGroup:'Shift type to assign',
})
