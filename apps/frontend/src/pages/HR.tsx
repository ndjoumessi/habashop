import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { exportCSV, openPDF, htmlTable, htmlKPIs, htmlInfoGrid } from '@/utils/export'
import { Download, Plus, Eye, X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import PhoneInput from '@/components/ui/PhoneInput'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
  id: number; name: string; role: string; dept: string; salary: number
  type: 'CDI' | 'CDD'; hiredAt: string; endAt?: string
  avatar: string; color: string; active: boolean
  phone: string; email: string; perf?: number
}

interface LeaveRequest {
  id: number; empId: number; type: string; from: string; to: string
  days: number; motif: string; status: 'pending' | 'approved' | 'refused'
}

type SalaryType = 'AUGMENTATION' | 'REVISION' | 'PROMOTION' | 'EMBAUCHE'

interface SalaryEntry {
  date: string; oldSalary: number; newSalary: number
  type: SalaryType; motif: string; approvedBy: string
}

// ── Données initiales ─────────────────────────────────────────────────────────

const EMPLOYEES_INIT: Employee[] = [
  { id:1, name:'Marie Bakayoko',   role:'Caissière',   dept:'Ventes',     salary:350000, type:'CDI', hiredAt:'01/03/2023',                    avatar:'MB', color:'#6C3FD6', active:true,  phone:'+221 77 111 22 33', email:'marie@shop.com',   perf:5 },
  { id:2, name:'Kofi Diallo',      role:'Magasinier',  dept:'Stock',      salary:420000, type:'CDI', hiredAt:'15/06/2024',                    avatar:'KD', color:'#F59E0B', active:true,  phone:'+221 77 222 33 44', email:'kofi@shop.com',    perf:4 },
  { id:3, name:'Aminata Touré',    role:'Comptable',   dept:'Finance',    salary:280000, type:'CDD', hiredAt:'01/09/2025', endAt:'31/08/2026', avatar:'AT', color:'#10B981', active:true,  phone:'+221 77 333 44 55', email:'aminata@shop.com', perf:4 },
  { id:4, name:'Seydou Koné',      role:'Caissier',    dept:'Ventes',     salary:310000, type:'CDI', hiredAt:'10/05/2025',                    avatar:'SK', color:'#EF4444', active:true,  phone:'+221 77 444 55 66', email:'seydou@shop.com',  perf:3 },
  { id:5, name:'Fatoumata Ndiaye', role:'Responsable', dept:'Direction',  salary:480000, type:'CDI', hiredAt:'01/01/2022',                    avatar:'FN', color:'#3B82F6', active:true,  phone:'+221 77 555 66 77', email:'fatou@shop.com',   perf:5 },
  { id:6, name:'Ibrahim Sow',      role:'Livreur',     dept:'Logistique', salary:220000, type:'CDD', hiredAt:'01/02/2026', endAt:'31/07/2026', avatar:'IS', color:'#8B5CF6', active:false, phone:'+221 77 666 77 88', email:'ibrahim@shop.com', perf:2 },
]

const SALARY_HISTORY_INIT: Record<number, SalaryEntry[]> = {
  1: [
    { date:'2023-03-01', oldSalary:0,      newSalary:300000, type:'EMBAUCHE',     motif:'Embauche initiale',              approvedBy:'Nelson Djoumessi' },
    { date:'2024-01-01', oldSalary:300000, newSalary:320000, type:'AUGMENTATION', motif:'Bonne performance annuelle',     approvedBy:'Nelson Djoumessi' },
    { date:'2024-07-01', oldSalary:320000, newSalary:350000, type:'PROMOTION',    motif:'Promotion Caissière principale', approvedBy:'Nelson Djoumessi' },
  ],
  2: [
    { date:'2024-06-15', oldSalary:0,      newSalary:380000, type:'EMBAUCHE',     motif:'Embauche initiale',              approvedBy:'Nelson Djoumessi' },
    { date:'2025-01-01', oldSalary:380000, newSalary:420000, type:'AUGMENTATION', motif:'Révision annuelle +10,5 %',      approvedBy:'Nelson Djoumessi' },
  ],
  3: [
    { date:'2025-09-01', oldSalary:0,      newSalary:280000, type:'EMBAUCHE',     motif:'CDD Comptable',                  approvedBy:'Nelson Djoumessi' },
  ],
  4: [
    { date:'2025-05-10', oldSalary:0,      newSalary:310000, type:'EMBAUCHE',     motif:'Embauche initiale',              approvedBy:'Nelson Djoumessi' },
  ],
  5: [
    { date:'2022-01-01', oldSalary:0,      newSalary:380000, type:'EMBAUCHE',     motif:'Embauche initiale',              approvedBy:'Nelson Djoumessi' },
    { date:'2023-01-01', oldSalary:380000, newSalary:420000, type:'AUGMENTATION', motif:'Révision annuelle',              approvedBy:'Nelson Djoumessi' },
    { date:'2023-07-01', oldSalary:420000, newSalary:460000, type:'PROMOTION',    motif:'Promotion Responsable',          approvedBy:'Nelson Djoumessi' },
    { date:'2024-01-01', oldSalary:460000, newSalary:480000, type:'AUGMENTATION', motif:'Révision annuelle +4,3 %',       approvedBy:'Nelson Djoumessi' },
  ],
  6: [
    { date:'2026-02-01', oldSalary:0,      newSalary:220000, type:'EMBAUCHE',     motif:'CDD Livreur',                    approvedBy:'Nelson Djoumessi' },
  ],
}

const TYPE_SALAIRE_CONFIG: Record<SalaryType, { color: string; bg: string; label: string }> = {
  EMBAUCHE:     { color:'var(--p2)',    bg:'rgba(91,78,232,.12)',   label:'Embauche'     },
  AUGMENTATION: { color:'var(--acc2)', bg:'rgba(14,196,126,.12)',  label:'Augmentation' },
  REVISION:     { color:'var(--acc)',  bg:'rgba(240,165,0,.12)',   label:'Révision'     },
  PROMOTION:    { color:'#F472B6',     bg:'rgba(244,114,182,.12)', label:'Promotion'    },
}

// ── Pointage ──────────────────────────────────────────────────────────────────

const POINTAGE_DATA: Record<number, Record<number, {
  status: 'present' | 'retard' | 'absent' | 'conge' | 'repos'
  arrive?: string; depart?: string
}>> = {
  1: {
    0: { status:'present', arrive:'08:02', depart:'17:00' },
    1: { status:'present', arrive:'07:58', depart:'17:05' },
    2: { status:'retard',  arrive:'09:35', depart:'17:00' },
    3: { status:'present', arrive:'08:01', depart:'17:02' },
    4: { status:'present', arrive:'07:55', depart:'17:00' },
    5: { status:'repos' }, 6: { status:'repos' },
  },
  2: {
    0: { status:'present', arrive:'08:00', depart:'18:00' },
    1: { status:'present', arrive:'08:05', depart:'18:00' },
    2: { status:'present', arrive:'07:50', depart:'18:00' },
    3: { status:'present', arrive:'08:00', depart:'18:00' },
    4: { status:'present', arrive:'08:00', depart:'18:00' },
    5: { status:'present', arrive:'08:00', depart:'13:00' },
    6: { status:'repos' },
  },
  3: {
    0: { status:'present', arrive:'08:30', depart:'17:00' },
    1: { status:'absent' },
    2: { status:'present', arrive:'08:25', depart:'17:00' },
    3: { status:'present', arrive:'08:30', depart:'17:00' },
    4: { status:'present', arrive:'08:28', depart:'17:00' },
    5: { status:'repos' }, 6: { status:'repos' },
  },
  4: {
    0: { status:'present', arrive:'13:00', depart:'18:00' },
    1: { status:'present', arrive:'08:00', depart:'13:00' },
    2: { status:'present', arrive:'08:00', depart:'18:00' },
    3: { status:'retard',  arrive:'14:20', depart:'18:00' },
    4: { status:'present', arrive:'08:00', depart:'13:00' },
    5: { status:'repos' }, 6: { status:'repos' },
  },
  5: {
    0: { status:'conge' }, 1: { status:'conge' }, 2: { status:'conge' },
    3: { status:'conge' }, 4: { status:'conge' }, 5: { status:'repos' }, 6: { status:'repos' },
  },
  6: {
    0: { status:'repos' }, 1: { status:'repos' }, 2: { status:'repos' },
    3: { status:'repos' }, 4: { status:'repos' }, 5: { status:'repos' }, 6: { status:'repos' },
  },
}

const STATUS_CONFIG = {
  present: { label:'Présent', color:'var(--acc2)', bg:'rgba(14,196,126,.12)', border:'rgba(14,196,126,.25)' },
  retard:  { label:'Retard',  color:'var(--acc)',  bg:'rgba(240,165,0,.12)',  border:'rgba(240,165,0,.25)'  },
  absent:  { label:'Absent',  color:'var(--danger)',bg:'rgba(232,64,74,.12)', border:'rgba(232,64,74,.25)'  },
  conge:   { label:'Congé',   color:'#60A5FA',     bg:'rgba(59,130,246,.12)', border:'rgba(59,130,246,.25)' },
  repos:   { label:'Repos',   color:'var(--text3)', bg:'var(--bg3)',           border:'var(--border)'        },
}

// ── Congés ────────────────────────────────────────────────────────────────────

const LEAVE_HISTORY: LeaveRequest[] = [
  { id:10, empId:5, type:'Congé annuel',    from:'2026-05-11', to:'2026-05-17', days:5, motif:'Repos annuel planifié',     status:'approved' },
  { id:11, empId:1, type:'Congé maladie',   from:'2026-04-02', to:'2026-04-03', days:2, motif:'Grippe',                    status:'approved' },
  { id:12, empId:3, type:'Congé annuel',    from:'2026-03-15', to:'2026-03-19', days:3, motif:'Voyage familial',           status:'approved' },
  { id:13, empId:6, type:'Congé sans solde',from:'2026-02-20', to:'2026-02-21', days:1, motif:'Démarches administratives', status:'refused'  },
]

const LEAVE_PENDING_INIT: LeaveRequest[] = [
  { id:20, empId:2, type:'Congé annuel',  from:'2026-05-20', to:'2026-05-24', days:5, motif:'Vacances famille', status:'pending' },
  { id:21, empId:4, type:'Congé maladie', from:'2026-05-16', to:'2026-05-16', days:1, motif:'Visite médicale',  status:'pending' },
]

const LEAVES_TAKEN: Record<number, number> = { 1: 2, 2: 0, 3: 3, 4: 0, 5: 5, 6: 0 }

// ── Pointage semaines ─────────────────────────────────────────────────────────

const WEEK_DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

// ── Fonctions utilitaires ─────────────────────────────────────────────────────

function calcHeures(empId: number): string {
  const data = POINTAGE_DATA[empId] ?? {}
  let total = 0
  Object.values(data).forEach(p => {
    if (p.arrive && p.depart) {
      const [ah, am] = p.arrive.split(':').map(Number)
      const [dh, dm] = p.depart.split(':').map(Number)
      total += (dh * 60 + dm) - (ah * 60 + am)
    }
  })
  return `${Math.floor(total / 60)}h${total % 60 > 0 ? total % 60 : ''}`
}

function calcPonctualite(empId: number): number {
  const data = POINTAGE_DATA[empId] ?? {}
  let workdays = 0, ontime = 0
  Object.values(data).forEach(p => {
    if (p.status === 'present' || p.status === 'retard' || p.status === 'absent') {
      workdays++
      if (p.status !== 'absent') ontime++
    }
  })
  return workdays === 0 ? 100 : Math.round((ontime / workdays) * 100)
}

function calcAbsences(empId: number): number {
  return Object.values(POINTAGE_DATA[empId] ?? {}).filter(p => p.status === 'absent').length
}

function calcAnciennete(hiredAt: string): string {
  const [d, m, y] = hiredAt.split('/')
  const months = Math.floor((new Date('2026-05-14').getTime() - new Date(+y, +m - 1, +d).getTime()) / (1000 * 60 * 60 * 24 * 30))
  const years = Math.floor(months / 12), rem = months % 12
  if (years >= 1) return `${years} an${years > 1 ? 's' : ''}${rem > 0 ? ` ${rem} mois` : ''}`
  return `${months} mois`
}


// ── Composants ────────────────────────────────────────────────────────────────

function Avatar({ emp, size = 36 }: { emp: Employee; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: emp.color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 800, letterSpacing: '-0.5px',
    }}>{emp.avatar}</div>
  )
}

function ContractStatus({ emp }: { emp: Employee }) {
  if (!emp.active) return <span className="badge badge-gray">Inactif</span>
  if (!emp.endAt)  return <span className="badge badge-green">Actif</span>
  const [, m, y] = emp.endAt.split('/')
  const diff = Math.ceil((new Date(+y, +m - 1, +emp.endAt.split('/')[0]).getTime() - new Date('2026-05-14').getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (diff <= 2) return <span className="badge badge-red">Expire {m}/{y.slice(2)}</span>
  if (diff <= 4) return <span className="badge badge-amber">Expire {m}/{y.slice(2)}</span>
  return <span className="badge badge-green">Actif</span>
}

// ── Module principal ──────────────────────────────────────────────────────────

export default function HR() {
  const { lang } = useConfig()
  void lang
  const fmt      = useFormatAmount()
  const navigate = useNavigate()

  // ── État employés (mutable) ──
  const [employees,    setEmployees]    = useState<Employee[]>(EMPLOYEES_INIT)

  // ── Navigation ──
  const [tab,          setTab]          = useState<'team'|'contracts'|'attendance'|'leaves'|'salary'>('team')

  // ── Fiche employé ──
  const [viewEmp,      setViewEmp]      = useState<Employee | null>(null)

  // ── Ajout employé ──
  const [addOpen,      setAddOpen]      = useState(false)
  const [newEmp,       setNewEmp]       = useState({ name:'', role:'', dept:'', salary:'', type:'CDI', phone:'', email:'' })

  // ── Pointage ──
  const [currentWeek,    setCurrentWeek]    = useState(new Date())
  const [editPointage,   setEditPointage]   = useState<{ empId:number; dayIndex:number; day:Date } | null>(null)
  const [pointageEdits,  setPointageEdits]  = useState<Record<string, { status:string; arrive?:string; depart?:string }>>({})

  // ── Congés ──
  const [pending,      setPending]      = useState<LeaveRequest[]>(LEAVE_PENDING_INIT)
  const [leaveOpen,    setLeaveOpen]    = useState(false)
  const [newLeave,     setNewLeave]     = useState({ empId:'1', type:'Congé annuel', from:'', to:'', motif:'' })

  // ── Salaires ──
  const [salaryHistory,     setSalaryHistory]     = useState<Record<number, SalaryEntry[]>>(SALARY_HISTORY_INIT)
  const [showSalaryModal,   setShowSalaryModal]   = useState(false)
  const [selectedEmpSalary, setSelectedEmpSalary] = useState<number | null>(null)
  const [salaryForm, setSalaryForm] = useState<{ type: SalaryType; newSalary: number; motif: string; effectiveDate: string }>({
    type: 'AUGMENTATION', newSalary: 0, motif: '', effectiveDate: new Date().toISOString().split('T')[0],
  })
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null)

  // ── Modifier employé ──
  const [editEmployee,     setEditEmployee]     = useState<Employee | null>(null)
  const [showEditEmpModal, setShowEditEmpModal] = useState(false)
  const [editEmpForm,      setEditEmpForm]      = useState({
    name: '', role: '', dept: '', phone: '',
    email: '', salary: 0, type: 'CDI' as 'CDI' | 'CDD',
    hiredAt: '', active: true,
  })

  // ── Pointage helpers ──
  const weekDays  = getWeekDays(currentWeek)
  const prevWeek  = () => { const d = new Date(currentWeek); d.setDate(d.getDate()-7); setCurrentWeek(d) }
  const nextWeek  = () => { const d = new Date(currentWeek); d.setDate(d.getDate()+7); setCurrentWeek(d) }

  const getPointageKey = (empId: number, dayIndex: number) => `${empId}_${dayIndex}`
  const getPointage    = (empId: number, dayIndex: number) => {
    const key = getPointageKey(empId, dayIndex)
    return pointageEdits[key] ?? POINTAGE_DATA[empId]?.[dayIndex]
  }

  // ── Contrats ──
  const generateContract = (emp: Employee) => {
    const history    = salaryHistory[emp.id] ?? []
    const lastSalary = history[history.length-1]?.newSalary ?? emp.salary
    const body = `
      <div style="text-align:center;margin-bottom:30px;">
        <div style="font-size:18px;font-weight:900;color:#5B4EE8;margin-bottom:8px;">
          CONTRAT DE TRAVAIL — ${emp.type}
        </div>
        <div style="font-size:13px;color:#666;">Entre HabaShop (l'Employeur) et ${emp.name} (l'Employé)</div>
      </div>
      <h2>Article 1 — Parties</h2>
      ${htmlInfoGrid([
        { label:'EMPLOYEUR',    value:'HabaShop — Dakar Central' },
        { label:'EMPLOYÉ',      value:emp.name },
        { label:'POSTE',        value:emp.role },
        { label:'DÉPARTEMENT',  value:emp.dept },
      ])}
      <h2>Article 2 — Durée et type de contrat</h2>
      ${htmlInfoGrid([
        { label:'TYPE',             value: emp.type === 'CDI' ? 'Contrat à Durée Indéterminée (CDI)' : 'Contrat à Durée Déterminée (CDD)' },
        { label:'DATE DE DÉBUT',    value: emp.hiredAt },
        { label:'DATE DE FIN',      value: emp.endAt ?? (emp.type === 'CDI' ? 'Indéterminée' : 'À définir') },
        { label:"PÉRIODE D'ESSAI",  value: emp.type === 'CDI' ? '3 mois renouvelable une fois' : "Sans période d'essai" },
      ])}
      <h2>Article 3 — Rémunération</h2>
      ${htmlInfoGrid([
        { label:'SALAIRE DE BASE',  value: lastSalary.toLocaleString('fr-FR') + ' FCFA / mois' },
        { label:'MODE DE PAIEMENT', value:'Virement bancaire' },
        { label:'PÉRIODICITÉ',      value:'Mensuelle (fin de mois)' },
        { label:'AVANTAGES',        value:'CNSS, assurance maladie' },
      ])}
      <h2>Article 4 — Conditions de travail</h2>
      ${htmlInfoGrid([
        { label:'HORAIRES',          value:'8h00 – 18h00 (selon planning)' },
        { label:'JOURS TRAVAILLÉS',  value:'Lundi au Samedi' },
        { label:'CONGÉS ANNUELS',    value:'25 jours ouvrables / an' },
        { label:'LIEU DE TRAVAIL',   value:'HabaShop — Dakar, Sénégal' },
      ])}
      <h2>Article 5 — Contact</h2>
      ${htmlInfoGrid([
        { label:'TÉLÉPHONE', value: emp.phone },
        { label:'EMAIL',     value: emp.email ?? '' },
      ])}
      <div class="signature-block" style="margin-top:40px;">
        <div>
          <div style="font-size:12px;color:#666;margin-bottom:40px;">Fait à Dakar, le ${new Date().toLocaleDateString('fr-FR')}</div>
          <div class="signature-line">Pour HabaShop — L'Employeur</div>
        </div>
        <div>
          <div style="font-size:12px;color:#666;margin-bottom:40px;">Lu et approuvé par l'employé</div>
          <div class="signature-line">${emp.name} — L'Employé</div>
        </div>
      </div>
    `
    openPDF(`Contrat ${emp.type} — ${emp.name}`, body)
    toast.success(`📄 Contrat de ${emp.name} généré`)
  }

  // ── Dérivés ──
  const printEmployeesPDF = () => {
    const body = `
      ${htmlKPIs([
        { label: t('kpi_employees'),      value: String(employees.length) },
        { label: t('hr_active_count'),    value: String(employees.filter(e => e.active).length) },
        { label: t('hr_payroll_mass'),    value: fmt(employees.reduce((s,e) => s+e.salary, 0)) },
        { label: t('hr_contract_cdi'),    value: String(employees.filter(e => e.type === 'CDI').length) },
      ])}
      <h2>${t('hr_pdf_title')}</h2>
      ${htmlTable(
        [t('col_name'), t('col_role'), t('hr_dept'), t('col_type'), t('hr_hired_at'), t('hr_base_salary'), t('col_status')],
        employees.map(e => [
          e.name, e.role, e.dept, e.type, e.hiredAt,
          fmt(e.salary),
          e.active ? `<span class="badge badge-green">${t('status_active')}</span>` : `<span class="badge badge-red">${t('status_inactive')}</span>`,
        ]),
        ['','','','','',
         '<strong>' + fmt(employees.reduce((s,e) => s+e.salary, 0)) + '</strong>',
         `<strong>${t('hr_pdf_payroll_total')}</strong>`]
      )}
    `
    openPDF(t('hr_pdf_title'), body)
  }

  const printEmployeeFichePDF = (emp: Employee) => {
    const history = salaryHistory[emp.id] ?? []
    const body = `
      ${htmlInfoGrid([
        { label: t('col_name'),      value: emp.name    },
        { label: t('col_role'),      value: emp.role    },
        { label: t('hr_dept'),       value: emp.dept    },
        { label: t('col_type'),      value: emp.type    },
        { label: t('hr_hired_at'),   value: emp.hiredAt },
        { label: t('col_phone'),     value: emp.phone   },
        { label: t('settings_email'),value: emp.email   },
        { label: t('hr_base_salary'),value: fmt(emp.salary) },
      ])}
      ${history.length > 0 ? `
        <h2>${t('hr_pdf_salary_history')}</h2>
        ${htmlTable(
          [t('col_date'), t('col_type'), t('hr_salary'), t('hr_base_salary'), '%', t('order_pdf_notes')],
          history.map(h => {
            const pct = h.oldSalary > 0
              ? '+' + ((h.newSalary - h.oldSalary) / h.oldSalary * 100).toFixed(1) + ' %'
              : '—'
            return [
              h.date, h.type,
              h.oldSalary > 0 ? fmt(h.oldSalary) : '—',
              fmt(h.newSalary),
              pct, h.motif,
            ]
          })
        )}
      ` : ''}
    `
    openPDF(`${t('hr_pdf_fiche')} — ${emp.name}`, body)
  }

  const activeCount    = employees.filter(e => e.active).length
  const masseSalariale = employees.reduce((s, e) => s + e.salary, 0)
  const salaireMoyen   = Math.round(masseSalariale / employees.length)

  const TABS = [
    { id: 'team',       label: `👥 ${t('hr_team')}`       },
    { id: 'contracts',  label: `📄 ${t('hr_contracts')}`  },
    { id: 'attendance', label: `📅 ${t('hr_attendance')}` },
    { id: 'leaves',     label: `🏖️ ${t('hr_leaves')}`    },
    { id: 'salary',     label: `💰 ${t('hr_salary')}`     },
  ] as const

  const leaveDays = (from: string, to: string) => {
    if (!from || !to) return 0
    return Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

  function handleApprove(id: number) { setPending(p => p.filter(r => r.id !== id)); toast.success('Congé approuvé') }
  function handleRefuse(id: number)  { setPending(p => p.filter(r => r.id !== id)); toast.error('Congé refusé')    }

  function openSalaryModal(empId: number) {
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    setSelectedEmpSalary(empId)
    setSalaryForm(f => ({ ...f, newSalary: emp.salary }))
    setShowSalaryModal(true)
  }

  function confirmSalary() {
    if (!selectedEmpSalary || !salaryForm.newSalary || !salaryForm.motif.trim()) {
      toast.error('Remplissez tous les champs')
      return
    }
    const emp = employees.find(e => e.id === selectedEmpSalary)
    if (!emp) return

    setSalaryHistory(prev => ({
      ...prev,
      [selectedEmpSalary]: [
        ...(prev[selectedEmpSalary] ?? []),
        {
          date:       salaryForm.effectiveDate,
          oldSalary:  emp.salary,
          newSalary:  salaryForm.newSalary,
          type:       salaryForm.type,
          motif:      salaryForm.motif,
          approvedBy: 'Nelson Djoumessi',
        },
      ],
    }))

    setEmployees(prev => prev.map(e =>
      e.id === selectedEmpSalary ? { ...e, salary: salaryForm.newSalary } : e
    ))

    toast.success(`✅ Salaire de ${emp.name} mis à jour — ${fmt(salaryForm.newSalary)}`)
    setShowSalaryModal(false)
    setSalaryForm({ type:'AUGMENTATION', newSalary:0, motif:'', effectiveDate: new Date().toISOString().split('T')[0] })
    setSelectedEmpSalary(null)
  }

  return (
    <div className="space-y-5 animate-in">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:t('kpi_employees'),    value:employees.length,    sub:`${activeCount} ${t('status_active').toLowerCase()}`, color:'var(--p2)',   icon:'👥' },
          { label:t('hr_active_count'), value:activeCount,          sub:'1 absent',                                              color:'var(--acc2)', icon:'✅' },
          { label:t('hr_payroll_mass'), value:fmt(masseSalariale),  sub:t('common_month'),                                      color:'var(--acc)',  icon:'💰' },
          { label:t('hr_leave_count'),  value:2,                    sub:'1 en attente',                                          color:'var(--p3)',   icon:'🏖️' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            style={{
              padding:'8px 18px', borderRadius:10, fontSize:13, fontWeight:700,
              fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
              background: tab === tb.id ? 'var(--p)' : 'var(--card)',
              color:  tab === tb.id ? '#fff' : 'var(--text2)',
              border: tab === tb.id ? 'none' : '1px solid var(--border)',
              boxShadow: tab === tb.id ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
            }}
          >{tb.label}</button>
        ))}
      </div>

      {/* ── TAB ÉQUIPE ── */}
      {tab === 'team' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">👥 Équipe</span>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
                exportCSV('habashop_employes',
                  ['Nom','Poste','Département','Contrat','Date embauche','Salaire','Statut'],
                  employees.map(e => [e.name, e.role, e.dept, e.type, e.hiredAt, e.salary, e.active ? 'Actif' : 'Inactif'])
                )
                toast.success('📊 Export CSV téléchargé !')
              }}>
                <Download size={13} /> CSV
              </button>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printEmployeesPDF(); toast.success('📄 PDF ouvert !') }}>
                <Download size={13} /> PDF
              </button>
              <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus size={13} /> Nouvel employé
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employé</th><th>Département</th><th>Contrat</th>
                  <th>Salaire</th><th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Avatar emp={e} size={34} />
                        <div>
                          <div className="td-bold text-sm">{e.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)' }}>{e.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color:'var(--text2)' }}>{e.dept}</td>
                    <td><span className={`badge ${e.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>{e.type}</span></td>
                    <td className="td-num text-sm" style={{ color:'var(--acc2)' }}>{fmt(e.salary)}</td>
                    <td><span className={`badge ${e.active ? 'badge-green' : 'badge-gray'}`}>{e.active ? 'Actif' : 'Inactif'}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button className="mini-btn gap-1" onClick={() => setViewEmp(e)}>
                          <Eye size={12} /> Voir
                        </button>
                        <button className="mini-btn" onClick={() => {
                          setEditEmployee(e)
                          setEditEmpForm({
                            name: e.name, role: e.role, dept: e.dept, phone: e.phone,
                            email: e.email ?? '', salary: e.salary, type: e.type as 'CDI' | 'CDD',
                            hiredAt: e.hiredAt, active: e.active,
                          })
                          setShowEditEmpModal(true)
                        }}>✏️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTRATS ── */}
      {tab === 'contracts' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📄 Contrats</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Employé</th><th>Type</th><th>Début</th><th>Fin</th><th>Salaire</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <Avatar emp={e} size={28} />
                        <span className="td-bold text-xs">{e.name}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${e.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>{e.type}</span></td>
                    <td className="td-mono text-xs">{e.hiredAt}</td>
                    <td className="td-mono text-xs" style={{ color:e.endAt ? 'var(--acc)' : 'var(--text3)' }}>{e.endAt ?? '—'}</td>
                    <td className="td-num text-sm" style={{ color:'var(--acc2)' }}>{fmt(e.salary)}</td>
                    <td><ContractStatus emp={e} /></td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button className="mini-btn gap-1" onClick={() => generateContract(e)}>
                          <Download size={11} /> PDF
                        </button>
                        {e.type === 'CDD' && e.active && (
                          <button className="mini-btn" style={{ color:'var(--acc)' }}
                            onClick={() => toast.success(`🔄 Renouvellement de ${e.name} initié`)}>🔄 Renouveler</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB POINTAGE ── */}
      {tab === 'attendance' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📅 Pointage</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button className="mini-btn" onClick={prevWeek} style={{ padding:'4px 7px' }}>
                <ChevronLeft size={14} />
              </button>
              <div style={{ textAlign:'center', minWidth:200 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>
                  Semaine {getWeekNumber(weekDays[0])}
                </div>
                <div style={{ fontSize:10, color:'var(--text3)' }}>
                  {weekDays[0].toLocaleDateString('fr-FR')} — {weekDays[6].toLocaleDateString('fr-FR')}
                </div>
              </div>
              <button className="mini-btn" onClick={nextWeek} style={{ padding:'4px 7px' }}>
                <ChevronRight size={14} />
              </button>
              <button className="btn btn-ghost btn-sm gap-1" onClick={() => {
                exportCSV('habashop_pointage',
                  ['Employé', ...weekDays.map(d => d.toLocaleDateString('fr-FR')), 'Total'],
                  employees.map(emp => {
                    const days = weekDays.map((_, i) => {
                      const p = getPointage(emp.id, i)
                      if (!p) return '—'
                      if (p.arrive) return `${p.arrive}-${p.depart}`
                      return STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG]?.label ?? p.status
                    })
                    return [emp.name, ...days, calcHeures(emp.id)]
                  })
                )
                toast.success('📊 Pointage exporté')
              }}>
                <Download size={12} /> Export
              </button>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ minWidth:900 }}>
              <thead>
                <tr>
                  <th style={{ minWidth:160 }}>Employé</th>
                  {weekDays.map((day, i) => {
                    const isToday = day.toDateString() === new Date().toDateString()
                    return (
                      <th key={i} style={{
                        textAlign:'center', minWidth:88,
                        color: isToday ? 'var(--p2)' : 'var(--text3)',
                        background: isToday ? 'rgba(91,78,232,.08)' : 'transparent',
                      }}>
                        <div>{WEEK_DAY_NAMES[i]}</div>
                        <div style={{ fontSize:10, fontWeight:600 }}>{day.getDate()}/{day.getMonth()+1}</div>
                      </th>
                    )
                  })}
                  <th style={{ textAlign:'center', minWidth:80 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar emp={e} size={28} />
                        <span className="td-bold text-xs">{e.name}</span>
                      </div>
                    </td>
                    {Array.from({ length:7 }, (_, dayIndex) => {
                      const p   = getPointage(e.id, dayIndex)
                      if (!p) return (
                        <td key={dayIndex} style={{ padding:'8px 6px', textAlign:'center', cursor:'pointer' }}
                          onClick={() => setEditPointage({ empId:e.id, dayIndex, day:weekDays[dayIndex] })}>
                          <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>
                        </td>
                      )
                      const cfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG]
                      return (
                        <td key={dayIndex} style={{ padding:'8px 6px', textAlign:'center', cursor:'pointer' }}
                          onClick={() => setEditPointage({ empId:e.id, dayIndex, day:weekDays[dayIndex] })}>
                          <div style={{
                            display:'inline-flex', flexDirection:'column',
                            alignItems:'center', gap:2,
                            background:cfg.bg, border:`1px solid ${cfg.border}`,
                            borderRadius:9, padding:'6px 8px', minWidth:72,
                            transition:'opacity .15s',
                          }}
                            onMouseEnter={el => (el.currentTarget as HTMLElement).style.opacity = '.75'}
                            onMouseLeave={el => (el.currentTarget as HTMLElement).style.opacity = '1'}
                          >
                            <span style={{ fontSize:10, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
                            {p.arrive && (
                              <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                                {p.arrive} → {p.depart}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td style={{ textAlign:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, fontFamily:'var(--mono)', color:e.active ? 'var(--acc2)' : 'var(--text3)' }}>
                        {calcHeures(e.id)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:14, display:'flex', gap:18, flexWrap:'wrap', paddingTop:12, borderTop:'1px solid var(--border)' }}>
            {Object.entries(STATUS_CONFIG).map(([, cfg]) => (
              <div key={cfg.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)' }}>
                <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:cfg.color }} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL Modifier pointage ── */}
      {editPointage && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setEditPointage(null)}>
          <div className="modal-box" style={{ maxWidth:380 }}>
            <h3 style={{ fontSize:15, fontWeight:800, marginBottom:12, color:'var(--text)' }}>⏱️ Modifier le pointage</h3>
            <div style={{ marginBottom:14, fontSize:13, color:'var(--text2)' }}>
              {employees.find(e=>e.id===editPointage.empId)?.name} — {editPointage.day.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'})}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:16 }}>
              {(['present','retard','absent','conge','repos'] as const).map(st => {
                const current = getPointage(editPointage.empId, editPointage.dayIndex)?.status
                const isSelected = current === st
                return (
                  <button key={st}
                    onClick={() => {
                      const key = getPointageKey(editPointage.empId, editPointage.dayIndex)
                      setPointageEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), status:st } }))
                    }}
                    style={{
                      padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:700,
                      cursor:'pointer', fontFamily:'var(--font)',
                      background: isSelected ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                      border:`1px solid ${isSelected ? 'var(--p2)' : 'var(--border)'}`,
                      color: isSelected ? 'var(--p2)' : 'var(--text2)',
                    }}>
                    {st==='present'?'✅ Présent':st==='retard'?'⚠️ Retard':st==='absent'?'❌ Absent':st==='conge'?'🏖️ Congé':'💤 Repos'}
                  </button>
                )
              })}
            </div>
            {['present','retard'].includes(getPointage(editPointage.empId, editPointage.dayIndex)?.status ?? '') && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, color:'var(--text3)', marginBottom:4, fontWeight:700, textTransform:'uppercase' }}>Arrivée</label>
                  <input className="input" type="time"
                    value={getPointage(editPointage.empId, editPointage.dayIndex)?.arrive ?? '08:00'}
                    onChange={e => {
                      const key = getPointageKey(editPointage.empId, editPointage.dayIndex)
                      setPointageEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), arrive:e.target.value } } as any))
                    }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, color:'var(--text3)', marginBottom:4, fontWeight:700, textTransform:'uppercase' }}>Départ</label>
                  <input className="input" type="time"
                    value={getPointage(editPointage.empId, editPointage.dayIndex)?.depart ?? '17:00'}
                    onChange={e => {
                      const key = getPointageKey(editPointage.empId, editPointage.dayIndex)
                      setPointageEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), depart:e.target.value } } as any))
                    }} />
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }}
                onClick={() => { toast.success('✅ Pointage mis à jour'); setEditPointage(null) }}>
                ✅ Enregistrer
              </button>
              <button className="mini-btn" style={{ padding:'10px 14px' }}
                onClick={() => setEditPointage(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONGÉS ── */}
      {tab === 'leaves' && (
        <div className="space-y-4">
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title">⏳ Demandes en attente</span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {pending.length > 0 && <span className="badge badge-amber">{pending.length}</span>}
                <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setLeaveOpen(true)}>
                  <Plus size={13} /> Nouvelle demande
                </button>
              </div>
            </div>
            {pending.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text3)', fontSize:13 }}>Aucune demande en attente</div>
            ) : (
              <div className="space-y-3">
                {pending.map(req => {
                  const emp = employees.find(e => e.id === req.empId)!
                  return (
                    <div key={req.id} style={{
                      display:'flex', alignItems:'center', gap:14,
                      padding:'13px 15px', borderRadius:12,
                      background:'var(--bg3)', border:'1px solid var(--border)',
                    }}>
                      <Avatar emp={emp} size={36} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{emp.name}</div>
                        <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                          {req.type} · {req.from} → {req.to} · {req.days} jour{req.days > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text2)', marginTop:1 }}>{req.motif}</div>
                      </div>
                      <div style={{ display:'flex', gap:7 }}>
                        <button onClick={() => handleApprove(req.id)} style={{
                          display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                          borderRadius:8, background:'rgba(16,185,129,.15)', color:'#10B981',
                          border:'1px solid rgba(16,185,129,.3)', fontWeight:700, fontSize:12,
                          cursor:'pointer', fontFamily:'inherit',
                        }}>
                          <Check size={13} /> Approuver
                        </button>
                        <button onClick={() => handleRefuse(req.id)} style={{
                          display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                          borderRadius:8, background:'rgba(239,68,68,.12)', color:'#F87171',
                          border:'1px solid rgba(239,68,68,.25)', fontWeight:700, fontSize:12,
                          cursor:'pointer', fontFamily:'inherit',
                        }}>
                          <X size={13} /> Refuser
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title">📋 Historique des congés</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employé</th><th>Type</th><th>Période</th><th>Durée</th><th>Statut</th></tr></thead>
                <tbody>
                  {LEAVE_HISTORY.map(h => {
                    const emp = employees.find(e => e.id === h.empId)!
                    return (
                      <tr key={h.id}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Avatar emp={emp} size={26} />
                            <span className="td-bold text-xs">{emp.name}</span>
                          </div>
                        </td>
                        <td className="text-xs" style={{ color:'var(--text2)' }}>{h.type}</td>
                        <td className="td-mono text-xs">{h.from} → {h.to}</td>
                        <td className="td-num text-xs">{h.days}j</td>
                        <td>
                          <span className={`badge ${h.status==='approved'?'badge-green':h.status==='refused'?'badge-red':'badge-amber'}`}>
                            {h.status==='approved'?'Approuvé':h.status==='refused'?'Refusé':'En attente'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB RÉMUNÉRATION ── */}
      {tab === 'salary' && (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="kpi-grid">
            {[
              { label:'Masse salariale totale', value:fmt(masseSalariale), color:'var(--p2)'   },
              { label:'Salaire moyen',           value:fmt(salaireMoyen),  color:'var(--acc2)' },
              { label:'Plus haute augmentation', value:'+10,5 %',          color:'var(--acc)'  },
              { label:'Prochaine révision',      value:'Janvier 2027',     color:'var(--text2)'},
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color:k.color, fontSize:22 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Grille des salaires */}
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title">💰 Grille des salaires</span>
              <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
                const totalMasse = employees.reduce((s,e) => s+e.salary, 0)
                const body = `
                  ${htmlKPIs([
                    { label:'MASSE SALARIALE', value:fmt(totalMasse) },
                    { label:'SALAIRE MOYEN',   value:fmt(Math.round(totalMasse/employees.length)) },
                    { label:'NB EMPLOYÉS',     value:String(employees.length) },
                    { label:'CONTRATS CDI',    value:String(employees.filter(e=>e.type==='CDI').length) },
                  ])}
                  <h2>Grille des salaires</h2>
                  ${htmlTable(
                    ['Employé','Poste','Contrat','Embauche','Salaire actuel','Évolution'],
                    employees.map(emp => {
                      const hist  = salaryHistory[emp.id] ?? []
                      const first = hist[0]?.newSalary ?? emp.salary
                      const pct   = first > 0 && emp.salary !== first
                        ? '+' + ((emp.salary-first)/first*100).toFixed(1) + ' %' : '—'
                      return [emp.name, emp.role, emp.type, emp.hiredAt, fmt(emp.salary), pct]
                    }),
                    ['','','','',`<strong>${fmt(totalMasse)}</strong>`,'<strong>MASSE SALARIALE</strong>']
                  )}
                `
                openPDF('Grille des salaires', body)
                toast.success('📄 PDF grille des salaires ouvert')
              }}>
                <Download size={13} /> PDF
              </button>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
                exportCSV('habashop_remuneration',
                  ['Employé','Poste','Contrat','Date embauche','Salaire actuel','Évolution','Dernière révision'],
                  employees.map(emp => {
                    const history    = salaryHistory[emp.id] ?? []
                    const first      = history[0]?.newSalary ?? emp.salary
                    const evolution  = first > 0 && emp.salary !== first
                      ? '+' + ((emp.salary - first) / first * 100).toFixed(1) + ' %'
                      : '—'
                    const lastRev    = history[history.length-1]?.date ?? emp.hiredAt
                    return [emp.name, emp.role, emp.type, emp.hiredAt, emp.salary, evolution, lastRev]
                  })
                )
                toast.success('📊 Export rémunération téléchargé !')
              }}>
                <Download size={13} /> Export CSV
              </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th><th>Poste</th><th>Contrat</th><th>Date embauche</th>
                    <th>Salaire actuel</th><th>Évolution</th><th>Dernière révision</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const history   = salaryHistory[emp.id] ?? []
                    const firstSal  = history[0]?.newSalary ?? emp.salary
                    const evolution = firstSal > 0 && emp.salary !== firstSal
                      ? ((emp.salary - firstSal) / firstSal * 100)
                      : null
                    const lastRev   = history[history.length-1]?.date ?? emp.hiredAt
                    return (
                      <tr key={emp.id}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                            <Avatar emp={emp} size={30} />
                            <span className="td-bold text-sm">{emp.name}</span>
                          </div>
                        </td>
                        <td className="text-xs" style={{ color:'var(--text2)' }}>{emp.role}</td>
                        <td><span className={`badge ${emp.type==='CDI'?'badge-violet':'badge-amber'}`}>{emp.type}</span></td>
                        <td className="td-mono text-xs">{emp.hiredAt}</td>
                        <td className="td-num" style={{ color:'var(--acc2)', fontWeight:800 }}>{fmt(emp.salary)}</td>
                        <td>
                          {evolution !== null ? (
                            <span style={{
                              fontWeight:800, fontSize:12, fontFamily:'var(--mono)',
                              color: evolution > 0 ? 'var(--acc2)' : 'var(--danger)',
                            }}>
                              {evolution > 0 ? '+' : ''}{evolution.toFixed(1)} %
                            </span>
                          ) : (
                            <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>
                          )}
                        </td>
                        <td className="td-mono text-xs" style={{ color:'var(--text3)' }}>{lastRev}</td>
                        <td>
                          <button className="mini-btn" onClick={() => openSalaryModal(emp.id)}>
                            ✏️ Modifier
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:'var(--bg3)' }}>
                    <td colSpan={4} style={{ padding:'12px 9px', fontWeight:700, fontSize:12, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px' }}>
                      Masse salariale totale
                    </td>
                    <td className="td-num" style={{ color:'var(--p2)', fontWeight:900, fontSize:15 }}>
                      {fmt(masseSalariale)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Historique par employé — accordéon */}
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-h">
              <span className="panel-t">📈 Historique des révisions</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {employees.map(emp => {
                const history  = salaryHistory[emp.id] ?? []
                const isOpen   = expandedEmp === emp.id
                return (
                  <div key={emp.id} style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
                    {/* En-tête accordéon */}
                    <button
                      onClick={() => setExpandedEmp(isOpen ? null : emp.id)}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', gap:12,
                        padding:'14px 16px', background: isOpen ? 'rgba(91,78,232,.06)' : 'var(--bg3)',
                        border:'none', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left',
                        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                        transition:'background .15s',
                      }}
                    >
                      <Avatar emp={emp} size={34} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{emp.name}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{emp.role} · {history.length} révision{history.length > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:14, fontWeight:800, color:'var(--acc2)', fontFamily:'var(--mono)' }}>{fmt(emp.salary)}</div>
                          <div style={{ fontSize:10, color:'var(--text3)' }}>Salaire actuel</div>
                        </div>
                        <span style={{ fontSize:12, color:'var(--text3)', transition:'transform .15s', display:'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </div>
                    </button>

                    {/* Timeline */}
                    {isOpen && (
                      <div style={{ padding:'16px 20px', background:'var(--card)' }}>
                        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                          <button className="mini-btn" style={{ flex:1, justifyContent:'center' }}
                            onClick={() => {
                              setSelectedEmpSalary(emp.id)
                              setSalaryForm(f => ({ ...f, newSalary:emp.salary }))
                              setShowSalaryModal(true)
                            }}>✏️ Modifier salaire</button>
                          <button className="mini-btn" style={{ flex:1, justifyContent:'center' }}
                            onClick={() => { printEmployeeFichePDF(emp); toast.success('📄 PDF ouvert !') }}>
                            📄 Fiche PDF</button>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                          {history.map((entry, i) => {
                            const cfg = TYPE_SALAIRE_CONFIG[entry.type]
                            const pct = entry.oldSalary > 0
                              ? ((entry.newSalary - entry.oldSalary) / entry.oldSalary * 100).toFixed(1)
                              : null
                            return (
                              <div key={i} style={{ display:'flex', gap:16, position:'relative' }}>
                                {i < history.length - 1 && (
                                  <div style={{
                                    position:'absolute', left:15, top:32,
                                    width:2, height:'calc(100% - 16px)',
                                    background:'var(--border)',
                                  }} />
                                )}
                                <div style={{
                                  width:32, height:32, borderRadius:'50%', flexShrink:0,
                                  background:cfg.bg, border:`2px solid ${cfg.color}`,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  zIndex:1, fontSize:13,
                                }}>
                                  {entry.type==='EMBAUCHE'?'🏁':entry.type==='AUGMENTATION'?'📈':entry.type==='PROMOTION'?'⭐':'🔄'}
                                </div>
                                <div style={{
                                  flex:1, marginBottom:12,
                                  background:'var(--bg3)', border:'1px solid var(--border)',
                                  borderRadius:12, padding:'12px 16px',
                                }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                                    <div>
                                      <span style={{
                                        background:cfg.bg, color:cfg.color,
                                        borderRadius:20, padding:'2px 10px',
                                        fontSize:11, fontWeight:700,
                                      }}>{cfg.label}</span>
                                      <span style={{ marginLeft:8, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                                        {entry.date}
                                      </span>
                                    </div>
                                    {pct && (
                                      <span style={{
                                        fontSize:13, fontWeight:800,
                                        color: parseFloat(pct) >= 0 ? 'var(--acc2)' : 'var(--danger)',
                                      }}>
                                        {parseFloat(pct) >= 0 ? '▲' : '▼'} +{pct} %
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                                    {entry.oldSalary > 0 && (
                                      <>
                                        <div>
                                          <div style={{ fontSize:10, color:'var(--text3)' }}>Ancien salaire</div>
                                          <div style={{ fontSize:14, fontWeight:700, color:'var(--text2)', fontFamily:'var(--mono)', textDecoration:'line-through' }}>
                                            {fmt(entry.oldSalary)}
                                          </div>
                                        </div>
                                        <span style={{ fontSize:18, color:'var(--text3)' }}>→</span>
                                      </>
                                    )}
                                    <div>
                                      <div style={{ fontSize:10, color:'var(--text3)' }}>Nouveau salaire</div>
                                      <div style={{ fontSize:16, fontWeight:800, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                                        {fmt(entry.newSalary)}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ marginTop:8, fontSize:12, color:'var(--text2)' }}>📝 {entry.motif}</div>
                                  <div style={{ marginTop:4, fontSize:11, color:'var(--text3)' }}>✅ Approuvé par {entry.approvedBy}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Fiche employé ── */}
      {viewEmp && (
        <div className="modal-backdrop"
          style={{ alignItems:'flex-start', paddingTop:'5vh', paddingBottom:'5vh', overflowY:'auto' }}
          onClick={e => e.target === e.currentTarget && setViewEmp(null)}
        >
          <div className="modal-box" style={{ maxWidth:640, width:'100%', padding:0, overflow:'hidden' }}>

            {/* ── HEADER ── */}
            <div style={{
              background:'linear-gradient(135deg, rgba(91,78,232,.2), rgba(124,111,240,.1))',
              padding:'24px 28px',
              borderBottom:'1px solid var(--border)',
              display:'flex', alignItems:'center',
              justifyContent:'space-between', gap:16,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{
                  width:72, height:72, borderRadius:'50%',
                  background:viewEmp.color, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:28, fontWeight:900, color:'#fff',
                  flexShrink:0, boxShadow:`0 8px 24px ${viewEmp.color}55`,
                }}>{viewEmp.avatar}</div>
                <div>
                  <h2 style={{ fontSize:20, fontWeight:900, color:'var(--text)', marginBottom:4, letterSpacing:'-0.5px' }}>
                    {viewEmp.name}
                  </h2>
                  <p style={{ fontSize:13, color:'var(--text2)', marginBottom:8 }}>
                    {viewEmp.role} · {viewEmp.dept}
                  </p>
                  <div style={{ display:'flex', gap:8 }}>
                    <span style={{
                      background:'rgba(148,163,184,.15)', color:'var(--text2)',
                      border:'1px solid var(--border)', borderRadius:20,
                      padding:'3px 12px', fontSize:11, fontWeight:700,
                    }}>{viewEmp.type}</span>
                    <span style={{
                      background: viewEmp.active ? 'rgba(14,196,126,.15)' : 'rgba(148,163,184,.15)',
                      color: viewEmp.active ? 'var(--acc2)' : 'var(--text3)',
                      border: `1px solid ${viewEmp.active ? 'rgba(14,196,126,.3)' : 'var(--border)'}`,
                      borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:700,
                    }}>{viewEmp.active ? '● Actif' : '○ Inactif'}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewEmp(null)} style={{
                background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)',
                borderRadius:9, padding:'7px 14px', cursor:'pointer',
                color:'var(--text)', fontSize:13, fontWeight:600,
                fontFamily:'var(--font)', display:'flex', alignItems:'center', gap:6,
              }}>✕ Fermer</button>
            </div>

            {/* ── CORPS SCROLLABLE ── */}
            <div style={{ maxHeight:'calc(90vh - 180px)', overflowY:'auto', padding:'20px 28px' }}>

              {/* Infos 2×2 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                {[
                  {
                    label:'CONTRAT', icon:'📄',
                    value: viewEmp.type,
                    color: viewEmp.type === 'CDI' ? 'var(--p2)' : 'var(--acc)',
                    mono: false,
                  },
                  {
                    label:'ANCIENNETÉ', icon:'📅',
                    value: calcAnciennete(viewEmp.hiredAt),
                    color:'var(--text)',
                    mono: false,
                  },
                  {
                    label:'SALAIRE DE BASE', icon:'💰',
                    value: fmt(viewEmp.salary),
                    color:'var(--acc2)',
                    mono: true,
                  },
                  {
                    label:'PERFORMANCE', icon:'🏆',
                    value: '⭐'.repeat(viewEmp.perf ?? 4) + '☆'.repeat(5 - (viewEmp.perf ?? 4)),
                    color:'var(--acc)',
                    mono: false,
                  },
                ].map(info => (
                  <div key={info.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
                    <div style={{
                      fontSize:10, fontWeight:700, textTransform:'uppercase',
                      letterSpacing:'.8px', color:'var(--text3)', marginBottom:8,
                      display:'flex', alignItems:'center', gap:6,
                    }}>
                      <span>{info.icon}</span> {info.label}
                    </div>
                    <div style={{
                      fontSize:16, fontWeight:800, color:info.color,
                      fontFamily: info.mono ? 'var(--mono)' : 'inherit',
                      letterSpacing: info.mono ? '-0.5px' : 'normal',
                    }}>{info.value}</div>
                  </div>
                ))}
              </div>

              {/* Contact */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                {[
                  { icon:'📞', label:'TÉLÉPHONE', value:viewEmp.phone, truncate:false },
                  { icon:'📧', label:'EMAIL',      value:viewEmp.email, truncate:true  },
                ].map(c => (
                  <div key={c.label} style={{
                    background:'var(--bg3)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'10px 14px',
                    display:'flex', alignItems:'center', gap:10,
                  }}>
                    <span style={{ fontSize:16 }}>{c.icon}</span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>{c.label}</div>
                      <div style={{
                        fontSize: c.truncate ? 12 : 13, fontWeight:600, color:'var(--text)',
                        ...(c.truncate ? { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } : {}),
                      }}>{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Performance ce mois */}
              <div style={{ marginBottom:20 }}>
                <div style={{
                  fontSize:10.5, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'.8px', color:'var(--text3)', marginBottom:12,
                }}>PERFORMANCE CE MOIS</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {(() => {
                    const ponct    = calcPonctualite(viewEmp.id)
                    const absences = calcAbsences(viewEmp.id)
                    const congesRestants = 25 - (LEAVES_TAKEN[viewEmp.id] ?? 0)
                    return [
                      {
                        label:'Ponctualité', value:`${ponct} %`,
                        color: ponct >= 90 ? 'var(--acc2)' : ponct >= 70 ? 'var(--acc)' : 'var(--danger)',
                        bg:    ponct >= 90 ? 'rgba(14,196,126,.12)' : ponct >= 70 ? 'rgba(240,165,0,.12)' : 'rgba(232,64,74,.12)',
                      },
                      {
                        label:'Heures travaillées', value:calcHeures(viewEmp.id),
                        color:'var(--p2)', bg:'rgba(91,78,232,.12)',
                      },
                      {
                        label:'Absences', value:`${absences} jour${absences > 1 ? 's' : ''}`,
                        color: absences === 0 ? 'var(--acc2)' : absences <= 2 ? 'var(--acc)' : 'var(--danger)',
                        bg:    absences === 0 ? 'rgba(14,196,126,.12)' : absences <= 2 ? 'rgba(240,165,0,.12)' : 'rgba(232,64,74,.12)',
                      },
                      {
                        label:'Congés restants', value:`${congesRestants} j / 25`,
                        color:'var(--acc)', bg:'rgba(240,165,0,.12)',
                      },
                    ]
                  })().map(stat => (
                    <div key={stat.label} style={{ background:stat.bg, border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ fontSize:10.5, color:'var(--text3)', marginBottom:8, fontWeight:500 }}>{stat.label}</div>
                      <div style={{ fontSize:22, fontWeight:900, color:stat.color, fontFamily:'var(--mono)', letterSpacing:'-1px' }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historique rémunération rapide */}
              {(salaryHistory[viewEmp.id] ?? []).length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{
                    fontSize:10.5, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.8px', color:'var(--text3)', marginBottom:12,
                  }}>HISTORIQUE RÉMUNÉRATION</div>
                  <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                    {(salaryHistory[viewEmp.id] ?? []).slice(-3).map((entry, i, arr) => {
                      const cfg = TYPE_SALAIRE_CONFIG[entry.type]
                      const pct = entry.oldSalary > 0
                        ? ((entry.newSalary - entry.oldSalary) / entry.oldSalary * 100).toFixed(1)
                        : null
                      return (
                        <div key={i} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'10px 14px',
                          borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:'2px 9px', fontSize:10, fontWeight:700 }}>
                              {cfg.label}
                            </span>
                            <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{entry.date}</span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:13, fontWeight:700, color:'var(--acc2)', fontFamily:'var(--mono)' }}>{fmt(entry.newSalary)}</span>
                            {pct && (
                              <span style={{ fontSize:11, fontWeight:700, color: parseFloat(pct) >= 0 ? 'var(--acc2)' : 'var(--danger)' }}>
                                {parseFloat(pct) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(pct))} %
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── FOOTER BOUTONS ── */}
            <div style={{
              padding:'16px 28px', borderTop:'1px solid var(--border)',
              background:'var(--bg3)', display:'grid',
              gridTemplateColumns:'1fr 1fr', gap:8,
            }}>
              <button onClick={() => { navigate('/app/payroll'); setViewEmp(null) }} style={{
                background:'linear-gradient(135deg, var(--p), var(--p2))',
                border:'none', borderRadius:10, padding:'10px',
                fontSize:13, fontWeight:700, color:'#fff',
                cursor:'pointer', fontFamily:'var(--font)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>💰 Bulletin de paie</button>

              <button onClick={() => { navigate('/app/planning'); setViewEmp(null) }} style={{
                background:'var(--bg4)', border:'1px solid var(--border)',
                borderRadius:10, padding:'10px',
                fontSize:13, fontWeight:700, color:'var(--text)',
                cursor:'pointer', fontFamily:'var(--font)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>📅 Voir planning</button>

              <button onClick={() => toast(`📞 ${viewEmp.phone}`)} style={{
                background:'var(--bg4)', border:'1px solid var(--border)',
                borderRadius:10, padding:'10px',
                fontSize:13, fontWeight:700, color:'var(--text)',
                cursor:'pointer', fontFamily:'var(--font)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>📞 Contacter</button>

              <button onClick={() => {
                setSelectedEmpSalary(viewEmp.id)
                setSalaryForm(f => ({ ...f, newSalary: viewEmp.salary }))
                setShowSalaryModal(true)
                setViewEmp(null)
              }} style={{
                background:'rgba(14,196,126,.12)',
                border:'1px solid rgba(14,196,126,.25)',
                borderRadius:10, padding:'10px',
                fontSize:13, fontWeight:700, color:'var(--acc2)',
                cursor:'pointer', fontFamily:'var(--font)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>✏️ Modifier salaire</button>

              <button onClick={() => { printEmployeeFichePDF(viewEmp); toast.success('📄 PDF ouvert !') }} style={{
                gridColumn:'1 / -1',
                background:'var(--bg4)', border:'1px solid var(--border)',
                borderRadius:10, padding:'10px',
                fontSize:13, fontWeight:700, color:'var(--text)',
                cursor:'pointer', fontFamily:'var(--font)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>📄 Fiche PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Modification salaire ── */}
      {showSalaryModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowSalaryModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>

            {/* Header */}
            <div style={{ marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:10 }}>💰 Modifier le salaire</h3>
              {selectedEmpSalary && (() => {
                const emp = employees.find(e => e.id === selectedEmpSalary)
                if (!emp) return null
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg3)', borderRadius:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:'50%',
                      background:emp.color, display:'flex',
                      alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:800, color:'#fff', flexShrink:0,
                    }}>{emp.avatar}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{emp.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>
                        Salaire actuel :{' '}
                        <strong style={{ color:'var(--acc2)', fontFamily:'var(--mono)' }}>{fmt(emp.salary)}</strong>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Formulaire */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Type de modification */}
              <div>
                <label style={{ display:'block', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>
                  Type de modification
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {(['AUGMENTATION','REVISION','PROMOTION','EMBAUCHE'] as SalaryType[]).map(type => {
                    const cfg = TYPE_SALAIRE_CONFIG[type]
                    return (
                      <button key={type}
                        onClick={() => setSalaryForm(f => ({ ...f, type }))}
                        style={{
                          padding:'10px 12px',
                          background: salaryForm.type === type ? cfg.bg : 'var(--bg3)',
                          border:`1.5px solid ${salaryForm.type === type ? cfg.color : 'var(--border)'}`,
                          borderRadius:10, cursor:'pointer',
                          fontSize:12, fontWeight:700,
                          color: salaryForm.type === type ? cfg.color : 'var(--text2)',
                          fontFamily:'var(--font)', transition:'all .15s',
                        }}
                      >{cfg.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* Nouveau salaire */}
              <div>
                <label style={{ display:'block', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                  Nouveau salaire (FCFA)
                </label>
                <input
                  className="input"
                  type="number"
                  placeholder="Ex: 380000"
                  value={salaryForm.newSalary || ''}
                  onChange={e => setSalaryForm(f => ({ ...f, newSalary: +e.target.value }))}
                />
                {salaryForm.newSalary > 0 && selectedEmpSalary && (() => {
                  const emp = employees.find(e => e.id === selectedEmpSalary)
                  if (!emp) return null
                  const diff = salaryForm.newSalary - emp.salary
                  const pct  = ((diff / emp.salary) * 100).toFixed(1)
                  return (
                    <div style={{
                      marginTop:8, padding:'8px 12px',
                      background: diff >= 0 ? 'rgba(14,196,126,.08)' : 'rgba(232,64,74,.08)',
                      border:`1px solid ${diff >= 0 ? 'rgba(14,196,126,.2)' : 'rgba(232,64,74,.2)'}`,
                      borderRadius:8, fontSize:12,
                      display:'flex', justifyContent:'space-between',
                    }}>
                      <span style={{ color:'var(--text2)' }}>
                        {diff >= 0 ? '▲ Augmentation' : '▼ Réduction'} de {fmt(Math.abs(diff))}
                      </span>
                      <span style={{ fontWeight:800, color: diff >= 0 ? 'var(--acc2)' : 'var(--danger)' }}>
                        {diff >= 0 ? '+' : ''}{pct} %
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* Date d'effet */}
              <div>
                <label style={{ display:'block', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                  Date d'effet
                </label>
                <input
                  className="input"
                  type="date"
                  value={salaryForm.effectiveDate}
                  onChange={e => setSalaryForm(f => ({ ...f, effectiveDate: e.target.value }))}
                />
              </div>

              {/* Motif */}
              <div>
                <label style={{ display:'block', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                  Motif / Justification
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Ex: Révision annuelle suite à évaluation de performance..."
                  value={salaryForm.motif}
                  onChange={e => setSalaryForm(f => ({ ...f, motif: e.target.value }))}
                  style={{ resize:'vertical' }}
                />
              </div>
            </div>

            {/* Boutons */}
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }} onClick={confirmSalary}>
                ✅ Confirmer la modification
              </button>
              <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowSalaryModal(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Nouvel employé ── */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:460 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Nouvel employé</span>
              <button className="mini-btn" onClick={() => setAddOpen(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nom complet',     key:'name',   type:'text',   placeholder:'Ex: Awa Diallo' },
                { label:'Poste',           key:'role',   type:'text',   placeholder:'Ex: Caissière'  },
                { label:'Département',     key:'dept',   type:'text',   placeholder:'Ex: Ventes'     },
                { label:'Salaire (F CFA)', key:'salary', type:'number', placeholder:'350000'         },
                { label:'Email',           key:'email',  type:'email',  placeholder:'nom@shop.com'   },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{f.label}</label>
                  <input className="input" type={f.type} placeholder={f.placeholder}
                    value={(newEmp as Record<string,string>)[f.key]}
                    onChange={ev => setNewEmp(p => ({ ...p, [f.key]: ev.target.value }))}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Téléphone</label>
                <PhoneInput value={newEmp.phone} onChange={phone => setNewEmp(p => ({ ...p, phone }))} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Type de contrat</label>
                <select className="input" value={newEmp.type} onChange={e => setNewEmp(p => ({ ...p, type:e.target.value }))}
                  style={{ width:'100%', boxSizing:'border-box' }}>
                  <option>CDI</option><option>CDD</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setAddOpen(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }}
                onClick={() => { toast.success('Employé ajouté (demo)'); setAddOpen(false) }}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Modifier employé ── */}
      {showEditEmpModal && editEmployee && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setShowEditEmpModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:540 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <h3 style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>✏️ Modifier — {editEmployee.name}</h3>
                <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Modifiez les informations de l'employé</p>
              </div>
              <button className="mini-btn" onClick={() => setShowEditEmpModal(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { label:'Nom complet *',  key:'name',  type:'text'  },
                { label:'Poste *',        key:'role',  type:'text'  },
                { label:'Email',          key:'email', type:'email' },
              ].map(f => (
                <div key={f.key} className={f.key === 'email' ? 'col-span-2' : ''}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>{f.label}</label>
                  <input className="input" type={f.type}
                    value={(editEmpForm as Record<string,string|number|boolean>)[f.key] as string}
                    onChange={e => setEditEmpForm(f2 => ({...f2, [f.key]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Département</label>
                <select className="input" value={editEmpForm.dept}
                  onChange={e => setEditEmpForm(f => ({...f, dept:e.target.value}))}>
                  {['Ventes','Stock','Finance','Direction','Logistique','RH'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Type contrat</label>
                <select className="input" value={editEmpForm.type}
                  onChange={e => setEditEmpForm(f => ({...f, type:e.target.value as 'CDI'|'CDD'}))}>
                  <option value="CDI">CDI</option><option value="CDD">CDD</option>
                  <option value="Intérim">Intérim</option><option value="Stage">Stage</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Téléphone</label>
                <PhoneInput value={editEmpForm.phone} onChange={phone => setEditEmpForm(f => ({...f, phone}))} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Statut</label>
                <select className="input" value={editEmpForm.active ? 'active' : 'inactive'}
                  onChange={e => setEditEmpForm(f => ({...f, active:e.target.value==='active'}))}>
                  <option value="active">Actif</option><option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:0 }} onClick={() => setShowEditEmpModal(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center' }}
                onClick={() => {
                  if (!editEmpForm.name || !editEmpForm.role) { toast.error('Nom et poste requis'); return }
                  setEmployees(prev => prev.map(e =>
                    e.id === editEmployee.id ? { ...e, ...editEmpForm } : e
                  ))
                  setShowEditEmpModal(false)
                  toast.success(`✅ ${editEmpForm.name} mis à jour`)
                }}>✅ Enregistrer les modifications</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Nouvelle demande congé ── */}
      {leaveOpen && (
        <div className="modal-backdrop" onClick={() => setLeaveOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Nouvelle demande de congé</span>
              <button className="mini-btn" onClick={() => setLeaveOpen(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Employé</label>
                <select className="input" value={newLeave.empId} onChange={e => setNewLeave(p => ({ ...p, empId:e.target.value }))}
                  style={{ width:'100%', boxSizing:'border-box' }}>
                  {employees.filter(e => e.active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Type</label>
                <select className="input" value={newLeave.type} onChange={e => setNewLeave(p => ({ ...p, type:e.target.value }))}
                  style={{ width:'100%', boxSizing:'border-box' }}>
                  {['Congé annuel','Congé maladie','Congé maternité','Congé sans solde','Autre'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Du</label>
                  <input className="input" type="date" value={newLeave.from}
                    onChange={e => setNewLeave(p => ({ ...p, from:e.target.value }))}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Au</label>
                  <input className="input" type="date" value={newLeave.to}
                    onChange={e => setNewLeave(p => ({ ...p, to:e.target.value }))}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
              </div>
              {newLeave.from && newLeave.to && (
                <div style={{ fontSize:12, color:'var(--acc2)', fontWeight:700, fontFamily:'var(--mono)' }}>
                  Durée : {leaveDays(newLeave.from, newLeave.to)} jour(s)
                </div>
              )}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Motif</label>
                <input className="input" type="text" placeholder="Ex: Voyage familial"
                  value={newLeave.motif} onChange={e => setNewLeave(p => ({ ...p, motif:e.target.value }))}
                  style={{ width:'100%', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setLeaveOpen(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }}
                onClick={() => {
                  if (!newLeave.from || !newLeave.to) { toast.error('Sélectionnez les dates'); return }
                  const days = leaveDays(newLeave.from, newLeave.to)
                  const emp  = employees.find(e => e.id === +newLeave.empId)!
                  setPending(p => [...p, {
                    id: Date.now(), empId:emp.id, type:newLeave.type,
                    from:newLeave.from, to:newLeave.to, days,
                    motif:newLeave.motif || '—', status:'pending',
                  }])
                  setNewLeave({ empId:'1', type:'Congé annuel', from:'', to:'', motif:'' })
                  setLeaveOpen(false)
                  toast.success('Demande soumise')
                }}>
                Soumettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
