import { useState, useMemo, useEffect } from 'react'
import React from 'react'
import { useFormatAmount, useConvertToXOF, useConvertFromXOF, useCurrencyInfo, useAppStore } from '@/stores/appStore'
import { employeesApi, bonusesApi, salaryHistoryApi } from '@/lib/api'
import { exportCSV } from '@/utils/export'
import { Download, Plus, X, Users, DollarSign, FileText, TrendingUp, Star, Pencil, Clock, Umbrella, Search, LayoutGrid, AlignJustify, CheckCircle, XCircle, AlertTriangle, Gift, Trash2, BarChart3, Calendar, User, Eye, CheckCheck, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import ViewField from '@/components/ui/ViewField'
import ValidatedInput from '@/components/ui/ValidatedInput'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
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

interface LeaveRequest {
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

const STATIC_EMPLOYEES: Employee[] = [
  { id:1, name:'Marie Bakayoko',   role:'Caissière',   dept:'Ventes',     salary:350000, type:'CDI', hiredAt:'01/03/2023',                    avatar:'MB', color:'#6C3FD6', active:true,  phone:'+221 77 111 22 33', email:'marie@shop.com',   perf:5 },
  { id:2, name:'Kofi Diallo',      role:'Magasinier',  dept:'Stock',      salary:420000, type:'CDI', hiredAt:'15/06/2024',                    avatar:'KD', color:'#F59E0B', active:true,  phone:'+221 77 222 33 44', email:'kofi@shop.com',    perf:4 },
  { id:3, name:'Aminata Touré',    role:'Comptable',   dept:'Finance',    salary:280000, type:'CDD', hiredAt:'01/09/2025', endAt:'31/08/2026', avatar:'AT', color:'#10B981', active:true,  phone:'+221 77 333 44 55', email:'aminata@shop.com', perf:4 },
  { id:4, name:'Seydou Koné',      role:'Caissier',    dept:'Ventes',     salary:310000, type:'CDI', hiredAt:'10/05/2025',                    avatar:'SK', color:'#EF4444', active:true,  phone:'+221 77 444 55 66', email:'seydou@shop.com',  perf:3 },
  { id:5, name:'Fatoumata Ndiaye', role:'Responsable', dept:'Direction',  salary:480000, type:'CDI', hiredAt:'01/01/2022',                    avatar:'FN', color:'#3B82F6', active:true,  phone:'+221 77 555 66 77', email:'fatou@shop.com',   perf:5 },
  { id:6, name:'Ibrahim Sow',      role:'Livreur',     dept:'Logistique', salary:220000, type:'CDD', hiredAt:'01/02/2026', endAt:'31/07/2026', avatar:'IS', color:'#8B5CF6', active:false, phone:'+221 77 666 77 88', email:'ibrahim@shop.com', perf:2 },
]

const POINTAGE: Record<number, Record<number, { status: 'present'|'retard'|'absent'|'conge'|'repos'; arrive?: string; depart?: string }>> = {
  1: { 0:{status:'present',arrive:'08:02',depart:'17:00'}, 1:{status:'present',arrive:'07:58',depart:'17:05'}, 2:{status:'retard',arrive:'09:35',depart:'17:00'}, 3:{status:'present',arrive:'08:01',depart:'17:02'}, 4:{status:'present',arrive:'07:55',depart:'17:00'}, 5:{status:'repos'}, 6:{status:'repos'} },
  2: { 0:{status:'present',arrive:'08:00',depart:'18:00'}, 1:{status:'present',arrive:'08:05',depart:'18:00'}, 2:{status:'present',arrive:'07:50',depart:'18:00'}, 3:{status:'present',arrive:'08:00',depart:'18:00'}, 4:{status:'present',arrive:'08:00',depart:'18:00'}, 5:{status:'present',arrive:'08:00',depart:'13:00'}, 6:{status:'repos'} },
  3: { 0:{status:'present',arrive:'08:30',depart:'17:00'}, 1:{status:'absent'}, 2:{status:'present',arrive:'08:25',depart:'17:00'}, 3:{status:'present',arrive:'08:30',depart:'17:00'}, 4:{status:'present',arrive:'08:28',depart:'17:00'}, 5:{status:'repos'}, 6:{status:'repos'} },
  4: { 0:{status:'present',arrive:'13:00',depart:'18:00'}, 1:{status:'present',arrive:'08:00',depart:'13:00'}, 2:{status:'present',arrive:'08:00',depart:'18:00'}, 3:{status:'retard',arrive:'14:20',depart:'18:00'}, 4:{status:'present',arrive:'08:00',depart:'13:00'}, 5:{status:'repos'}, 6:{status:'repos'} },
  5: { 0:{status:'conge'}, 1:{status:'conge'}, 2:{status:'conge'}, 3:{status:'conge'}, 4:{status:'conge'}, 5:{status:'repos'}, 6:{status:'repos'} },
  6: { 0:{status:'repos'}, 1:{status:'repos'}, 2:{status:'repos'}, 3:{status:'repos'}, 4:{status:'repos'}, 5:{status:'repos'}, 6:{status:'repos'} },
}

const LEAVE_INIT: LeaveRequest[] = [
  { id:1, empId:5, empName:'Fatoumata Ndiaye', type:'Congé annuel',  from:'2026-05-11', to:'2026-05-17', days:5, motif:'Repos annuel planifié', status:'approved' },
  { id:2, empId:1, empName:'Marie Bakayoko',   type:'Congé maladie', from:'2026-04-02', to:'2026-04-03', days:2, motif:'Grippe',                status:'approved' },
  { id:3, empId:3, empName:'Aminata Touré',    type:'Congé annuel',  from:'2026-03-15', to:'2026-03-19', days:3, motif:'Voyage familial',       status:'approved' },
  { id:4, empId:2, empName:'Kofi Diallo',      type:'Congé annuel',  from:'2026-05-20', to:'2026-05-24', days:5, motif:'Vacances famille',      status:'pending'  },
  { id:5, empId:4, empName:'Seydou Koné',      type:'Congé maladie', from:'2026-05-16', to:'2026-05-16', days:1, motif:'Visite médicale',       status:'pending'  },
]

const COLORS = ['#6C3FD6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#8B5CF6','#F472B6']
const DEPT_COLORS: Record<string, string> = {
  'Ventes':     '#6C3FD6',
  'Stock':      '#F59E0B',
  'Finance':    '#10B981',
  'Direction':  '#3B82F6',
  'Logistique': '#8B5CF6',
  'Marketing':  '#EC4899',
  'RH':         '#EF4444',
}


const STATUS_CFG = {
  present: { label:'Présent',  color:'var(--acc2)',    bg:'rgba(14,196,126,.12)'  },
  retard:  { label:'Retard',   color:'var(--acc)',     bg:'rgba(240,165,0,.12)'   },
  absent:  { label:'Absent',   color:'var(--danger)',  bg:'rgba(232,64,74,.12)'   },
  conge:   { label:'Congé',    color:'#60A5FA',        bg:'rgba(59,130,246,.12)'  },
  repos:   { label:'Repos',    color:'var(--text3)',   bg:'var(--bg3)'            },
}

const LEAVE_STATUS_CFG = {
  pending:  { label:'En attente', color:'var(--acc)',    bg:'rgba(240,165,0,.12)'  },
  approved: { label:'Approuvé',   color:'var(--acc2)',   bg:'rgba(14,196,126,.12)' },
  refused:  { label:'Refusé',     color:'var(--danger)', bg:'rgba(232,64,74,.12)'  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInputDate(dateStr: string | undefined | null): string {
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

function displayDate(dateStr: string | undefined | null, locale = 'fr-FR'): string {
  const iso = toInputDate(dateStr)
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale)
}

function calcAnciennete(hiredAt: string): string {
  const iso = toInputDate(hiredAt)
  if (!iso) return '—'
  const months = Math.floor((new Date('2026-05-18').getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (months < 0) return '—'
  const years = Math.floor(months / 12), rem = months % 12
  if (years >= 1) return `${years} an${years > 1 ? 's' : ''}${rem > 0 ? ` ${rem} mois` : ''}`
  return `${months} mois`
}

function calcHeures(empId: number): string {
  let total = 0
  Object.values(POINTAGE[empId] ?? {}).forEach(p => {
    if (p.arrive && p.depart) {
      const [ah, am] = p.arrive.split(':').map(Number)
      const [dh, dm] = p.depart.split(':').map(Number)
      total += (dh * 60 + dm) - (ah * 60 + am)
    }
  })
  return `${Math.floor(total / 60)}h${total % 60 > 0 ? String(total % 60).padStart(2, '0') : ''}`
}

function calcPonctualite(empId: number): number {
  let work = 0, ontime = 0
  Object.values(POINTAGE[empId] ?? {}).forEach(p => {
    if (['present','retard','absent'].includes(p.status)) { work++; if (p.status !== 'absent') ontime++ }
  })
  return work === 0 ? 100 : Math.round((ontime / work) * 100)
}


// ─── Avatar ───────────────────────────────────────────────────────────────────

function EmpAvatar({ emp, size = 36 }: { emp: Employee; size?: number }) {
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

function Stars({ v = 0 }: { v: number }) {
  return (
    <span style={{ fontSize: 11 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < v ? '#F59E0B' : 'var(--border2)' }}>★</span>
      ))}
    </span>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.5px', color: 'var(--text3)', display: 'block', marginBottom: 6,
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HR() {
  const fmt    = useFormatAmount()
  const toXOF  = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
  const { symbol: currencySymbol, decimals: currencyDecimals } = useCurrencyInfo()
  const { lang, currency } = useAppStore()
  const [salaryInput, setSalaryInput] = useState('')
  const [tab, setTab] = useState<'team'|'contracts'|'pointage'|'leaves'|'payroll'>('team')
  const [viewMode, setViewMode] = useState<'grid'|'table'>('grid')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>(STATIC_EMPLOYEES)
  const [leaves, setLeaves] = useState<LeaveRequest[]>(LEAVE_INIT)
  const [showModal, setShowModal] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [showEditEmpModal, setShowEditEmpModal] = useState(false)
  const [empEditMode, setEmpEditMode] = useState(false)
  const [editEmpForm, setEditEmpForm] = useState<any>({})

  // Contracts
  const [showNewContractModal, setShowNewContractModal] = useState(false)
  const [showContractDetailModal, setShowContractDetailModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Employee | null>(null)
  const [contractForm, setContractForm] = useState({ empId: '', type: 'CDI', hiredAt: new Date().toISOString().split('T')[0], contractEnd: '', salary: 0, role: '', dept: 'Ventes' })

  // Payroll
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))
  const [payTab, setPayTab] = useState<'grid'|'payslip'|'bonuses'|'history'>('grid')
  const [bonuses, setBonuses] = useState<Record<string, number>>({})
  const [bonusList, setBonusList] = useState<{id:string; empId:string; amount:number; reason:string; date:string}[]>([])
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [salaryTarget, setSalaryTarget] = useState<any>(null)
  const [salaryHistory, setSalaryHistory] = useState<{id?:string; empId:string; date:string; oldSalary:number; newSalary:number; reason:string}[]>([])

  // Présences / Pointage
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<Record<string, { in: string|null; out: string|null; status: 'present'|'absent'|'late'|'half' }>>(() => {
    try { return JSON.parse(localStorage.getItem('habashop_attendance') ?? 'null') ?? {} } catch { return {} }
  })

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    empId: 0,
    type: 'Congé annuel',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: '',
  })

  const openEditModal = (emp: Employee) => {
    setSelectedEmp(emp)
    // emp.salary est en XOF → convertir en devise courante pour l'input
    setSalaryInput(fromXOF(emp.salary || 0).toFixed(currencyDecimals))
    setEditEmpForm({
      name:        emp.name        ?? '',
      role:        emp.role        ?? '',
      dept:        emp.dept        ?? 'Ventes',
      type:        emp.type        ?? 'CDI',
      phone:       emp.phone       ?? '',
      email:       emp.email       ?? '',
      isActive:    emp.active,
      perf:        emp.perf        ?? 3,
      color:       emp.color       ?? '#6C47FF',
      photoUrl:    emp.photoUrl    ?? '',
      address:     emp.address     ?? '',
      hiredAt:     toInputDate(emp.hiredAt),
      contractEnd: toInputDate(emp.endAt),
    })
    setEmpEditMode(false)
    setShowEditEmpModal(true)
  }

  useEffect(() => {
    employeesApi.list()
      .then((data: any[]) => {
        if (data?.length) {
          setEmployees(data.map((e: any, i: number) => ({
            id: e.id ?? i + 1,
            name: e.name ?? e.firstName + ' ' + e.lastName,
            role: e.role ?? e.position ?? 'Employé',
            dept: e.department ?? e.dept ?? 'Général',
            salary: e.salary ?? e.baseSalary ?? 0,
            type: e.contractType ?? 'CDI',
            hiredAt: toInputDate(e.hiredAt ?? e.startDate) || '01/01/2024',
            endAt: toInputDate(e.endAt) || e.endAt,
            avatar: (e.name ?? e.firstName ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
            color: COLORS[i % COLORS.length],
            active: e.active ?? e.isActive ?? e.status !== 'inactive',
            phone: e.phone ?? '',
            email: e.email ?? '',
            address: e.address ?? '',
            perf: e.perf ?? e.performance,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEmployees(false))

    bonusesApi.list()
      .then((data: any[]) => {
        if (!Array.isArray(data)) return
        const list = data.map(b => ({ id: b.id, empId: b.employeeId, amount: Number(b.amount || 0), reason: b.reason, date: b.date }))
        setBonusList(list)
        const agg: Record<string, number> = {}
        list.forEach(b => { if (b.empId) agg[b.empId] = (agg[b.empId] ?? 0) + b.amount })
        setBonuses(agg)
        console.log('✅ Bonuses chargés:', agg)
      })
      .catch(err => console.warn('bonuses load:', err.message))

    salaryHistoryApi.list()
      .then((data: any[]) => {
        if (!Array.isArray(data)) return
        const normalized = data.map(h => ({
          id:         h.id,
          empId:      h.employeeId,
          employeeId: h.employeeId,
          date:       h.date ?? h.createdAt,
          oldSalary:  Number(h.oldSalary || 0),
          newSalary:  Number(h.newSalary || 0),
          reason:     h.reason ?? 'Augmentation',
        }))
        setSalaryHistory(normalized)
        console.log('✅ Salary history chargé:', normalized.length)
      })
      .catch(err => console.warn('salary-history load:', err.message))
  }, [])

  useEffect(() => {
    const handler = () => { setSelectedEmp(null); setShowModal(true) }
    window.addEventListener('habashop:new-employee', handler)
    return () => window.removeEventListener('habashop:new-employee', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('habashop_attendance', JSON.stringify(attendance))
  }, [attendance])

  const depts = useMemo(() => Array.from(new Set(employees.map(e => e.dept))), [employees])

  const handleConfirmRaise = async (empId: string, newSalaryXOF: number, reason: string) => {
    const emp = employees.find(e => String(e.id) === empId)
    const oldSalaryXOF = Number(emp?.salary) || 0

    setEmployees((prev: Employee[]) => prev.map(e =>
      String(e.id) === empId ? { ...e, salary: newSalaryXOF } : e
    ))
    setSalaryHistory(prev => [{
      id: `local_${Date.now()}`,
      empId,
      employeeId: empId,
      oldSalary: oldSalaryXOF,
      newSalary: newSalaryXOF,
      reason: reason || 'Augmentation',
      date: new Date().toISOString(),
    }, ...prev])

    employeesApi.update(empId, { salary: newSalaryXOF })
      .catch(err => console.warn('employee update:', err.message))
    salaryHistoryApi.create({ employeeId: empId, oldSalary: oldSalaryXOF, newSalary: newSalaryXOF, reason: reason || 'Augmentation' })
      .catch(err => console.warn('salary-history create:', err.message))

    toast.success(`✅ Salaire mis à jour : ${fmt(newSalaryXOF)}`)
    setShowSalaryModal(false)
  }

  const handleConfirmBonus = (_empId: string | 'all', amountXOF: number, type: string) => {
    const targets = _empId === 'all'
      ? employees.filter(e => e.active !== false)
      : employees.filter(e => String(e.id) === _empId)

    targets.forEach(emp => {
      const eid = String(emp.id)
      setBonuses(prev => ({ ...prev, [eid]: (prev[eid] ?? 0) + amountXOF }))
      bonusesApi.create({ employeeId: eid, amount: amountXOF, reason: type || 'Performance' })
        .then(b => setBonusList(prev => [...prev, { id: b.id, empId: eid, amount: amountXOF, reason: b.reason, date: b.date }]))
        .catch(err => {
          console.warn('bonus create:', err.message)
          setBonusList(prev => [...prev, { id: `local-${Date.now()}-${eid}`, empId: eid, amount: amountXOF, reason: type || 'Performance', date: new Date().toISOString() }])
        })
    })

    if (_empId === 'all') {
      toast.success(`✅ Prime collective ${fmt(amountXOF)} (${targets.length})`)
    } else {
      toast.success(`✅ Prime ${fmt(amountXOF)} → ${targets[0]?.name}`)
    }
    setShowSalaryModal(false)
  }

  const filtered = useMemo(() => (employees ?? []).filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)
    const matchDept = deptFilter === 'all' || e.dept === deptFilter
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? e.active : !e.active)
    return matchSearch && matchDept && matchStatus
  }), [employees, search, deptFilter, filterStatus])

  const totalPayroll = useMemo(() => (employees ?? []).filter(e => e.active).reduce((s, e) => s + e.salary, 0), [employees])
  const activeCount  = useMemo(() => (employees ?? []).filter(e => e.active).length, [employees])
  const pendingLeaves = useMemo(() => (leaves ?? []).filter(l => l.status === 'pending').length, [leaves])

  const generatePayslipPDF = (
    emp: any,
    data: { brut:number; bonus:number; cnss:number; ir:number; net:number; month:string }
  ) => {
    const monthLabel = new Date(data.month+'-01')
      .toLocaleDateString(lang==='fr'?'fr-FR':'en-US', {month:'long', year:'numeric'})
    const win = window.open('', '_blank', 'width=700,height=900')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Bulletin — ${emp.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#1a1a2e;padding:40px;max-width:600px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;margin-bottom:24px;border-bottom:3px solid #6C47FF}
.logo{font-size:24px;font-weight:900;color:#6C47FF;letter-spacing:-1px}
.badge{background:#6C47FF;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}
.section{background:#f8f7ff;border-radius:10px;padding:16px;margin-bottom:16px}
.section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#888;margin-bottom:10px}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #eee}
.row:last-child{border-bottom:none}
.label{color:#555}.value{font-weight:700;font-family:monospace}
.total-box{background:linear-gradient(135deg,#6C47FF,#8B6FFF);color:#fff;border-radius:12px;padding:20px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}
.total-label{font-size:14px;font-weight:700;opacity:.9}
.total-value{font-size:28px;font-weight:900;font-family:monospace;letter-spacing:-1px}
.footer{margin-top:30px;padding-top:16px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:11px;color:#999}
.sign-box{border:1px solid #ddd;border-radius:8px;padding:10px 16px;text-align:center;min-width:160px;font-size:11px;color:#888}
@media print{body{padding:20px}button{display:none!important}}
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:16px;right:16px;background:#6C47FF;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:700">🖨️ Imprimer</button>
<div class="header">
  <div><div class="logo">HabaShop</div>
  <div style="font-size:12px;color:#888;margin-top:4px;">${lang==='fr'?'Bulletin de paie':'Payslip'} — ${monthLabel}</div></div>
  <div class="badge">${lang==='fr'?'CONFIDENTIEL':'CONFIDENTIAL'}</div>
</div>
<div class="section">
  <div class="section-title">${lang==='fr'?'INFORMATIONS EMPLOYÉ':'EMPLOYEE INFORMATION'}</div>
  <div class="row"><span class="label">${lang==='fr'?'Nom':'Name'}</span><span class="value">${emp.name}</span></div>
  <div class="row"><span class="label">${lang==='fr'?'Poste':'Position'}</span><span class="value">${emp.role}</span></div>
  <div class="row"><span class="label">${lang==='fr'?'Département':'Department'}</span><span class="value">${emp.dept}</span></div>
  <div class="row"><span class="label">${lang==='fr'?'Type contrat':'Contract'}</span><span class="value">${emp.type}</span></div>
  <div class="row"><span class="label">${lang==='fr'?'Date embauche':'Hire date'}</span><span class="value">${emp.hiredAt}</span></div>
</div>
<div class="section">
  <div class="section-title">${lang==='fr'?'DÉTAIL DE LA RÉMUNÉRATION':'COMPENSATION DETAIL'}</div>
  <div class="row"><span class="label">${lang==='fr'?'Salaire brut de base':'Base gross salary'}</span><span class="value">${fmt(data.brut)}</span></div>
  ${data.bonus>0?`<div class="row"><span class="label">${lang==='fr'?'Prime du mois':'Monthly bonus'}</span><span class="value" style="color:#00D084;">+ ${fmt(data.bonus)}</span></div>`:''}
  <div class="row"><span class="label" style="font-weight:700">${lang==='fr'?'Total brut':'Total gross'}</span><span class="value">${fmt(data.brut+data.bonus)}</span></div>
</div>
<div class="section">
  <div class="section-title">${lang==='fr'?'COTISATIONS ET RETENUES':'CONTRIBUTIONS & DEDUCTIONS'}</div>
  <div class="row"><span class="label">CNSS (8%)</span><span class="value" style="color:#FF3B5C;">− ${fmt(data.cnss)}</span></div>
  <div class="row"><span class="label">${lang==='fr'?'Impôt sur le revenu (5%)':'Income tax (5%)'}</span><span class="value" style="color:#FFB800;">− ${fmt(data.ir)}</span></div>
  <div class="row"><span class="label" style="font-weight:700">${lang==='fr'?'Total retenues':'Total deductions'}</span><span class="value" style="color:#FF3B5C;">− ${fmt(data.cnss+data.ir)}</span></div>
</div>
<div class="total-box">
  <div><div class="total-label">${lang==='fr'?'NET À PAYER':'NET TO PAY'}</div>
  <div style="font-size:11px;opacity:.7;margin-top:4px;">${monthLabel}</div></div>
  <div class="total-value">${fmt(data.net)}</div>
</div>
<div class="footer">
  <div><div style="font-weight:700;margin-bottom:4px">HabaShop</div>
  <div>Document généré le ${new Date().toLocaleDateString('fr-FR')}</div></div>
  <div><div class="sign-box">${lang==='fr'?'Signature employeur<br/><br/><br/>':'Employer signature<br/><br/><br/>'}</div></div>
</div>
</body></html>`)
    win.document.close()
  }

  const generateAllPayslips = () => {
    const actifs = employees.filter(e => e.active !== false)
    actifs.forEach((emp, i) => {
      const brut  = Number(emp.salary)||0
      const bonus = bonuses[String(emp.id)] ?? 0
      const total = brut + bonus
      const cnss  = Math.round(total * 0.08)
      const ir    = Math.round(total * 0.05)
      const net   = total - cnss - ir
      setTimeout(() => {
        generatePayslipPDF(emp, { brut, bonus, cnss, ir, net, month: payrollMonth })
      }, i * 300)
    })
    toast.success(lang==='fr' ? `📄 ${actifs.length} bulletins générés !` : `📄 ${actifs.length} payslips generated!`)
  }

  function handleLeaveAction(id: number, status: 'approved' | 'refused') {
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    toast.success(status === 'approved' ? '✅ Congé approuvé' : '❌ Congé refusé')
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fr' ? 'Ressources Humaines' : 'Human Resources'}
          </h1>
          <p className="page-subtitle">
            {employees.length} {lang === 'fr' ? 'employés' : 'employees'} · {activeCount} {lang === 'fr' ? 'actifs' : 'active'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            exportCSV('RH', ['Nom','Rôle','Département','Contrat','Salaire','Embauche','Statut'],
              employees.map(e => [e.name, e.role, e.dept, e.type, e.salary, e.hiredAt, e.active ? 'Actif' : 'Inactif']))
            toast.success('CSV exporté')
          }}>
            <Download size={14} /> Export
          </button>
          <button className="topbar-btn" onClick={() => { setSelectedEmp(null); setShowModal(true) }}>
            <Plus size={14} /> {lang === 'fr' ? 'Ajouter' : 'Add'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[
          { icon: <Users size={18}/>,      label: lang==='fr'?'Effectif total':'Total staff',      value: `${employees.length}`,    color: '#6C47FF', sub: `${activeCount} ${lang==='fr'?'actifs':'active'}` },
          { icon: <DollarSign size={18}/>, label: lang==='fr'?'Masse salariale':'Payroll',          value: fmt(totalPayroll),         color: '#00D084', sub: lang==='fr'?'Ce mois':'This month' },
          { icon: <Umbrella size={18}/>,   label: lang==='fr'?'Congés en attente':'Pending leaves', value: `${pendingLeaves}`,        color: pendingLeaves > 0 ? '#F0A500' : '#00D084', sub: lang==='fr'?'à traiter':'to review' },
          { icon: <TrendingUp size={18}/>, label: lang==='fr'?'Performance moy.':'Avg performance', value: `${((employees ?? []).filter(e => e.perf).reduce((s, e) => s + (e.perf ?? 0), 0) / ((employees ?? []).filter(e => e.perf).length || 1)).toFixed(1)}/5`, color: '#FF9500', sub: lang==='fr'?'Top équipe':'Top team' },
        ].map(k => (
          <div key={k.label} className="panel" style={{ padding: '14px 16px', background: `linear-gradient(135deg,${k.color}18,${k.color}06)`, border: `1px solid ${k.color}28` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        {([
          { id: 'team'      as const, icon: <Users size={13}/>,      label: lang === 'fr' ? 'Équipe'       : 'Team'       },
          { id: 'contracts' as const, icon: <FileText size={13}/>,   label: lang === 'fr' ? 'Contrats'     : 'Contracts'  },
          { id: 'pointage'  as const, icon: <Clock size={13}/>,      label: lang === 'fr' ? 'Présences'    : 'Attendance' },
          { id: 'leaves'    as const, icon: <Umbrella size={13}/>,   label: lang === 'fr' ? 'Congés'       : 'Leaves'     },
          { id: 'payroll'   as const, icon: <DollarSign size={13}/>, label: lang === 'fr' ? 'Rémunération' : 'Payroll'    },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 9,
            background: tab === t.id
              ? 'linear-gradient(135deg,rgba(108,71,255,.18),rgba(0,184,255,.08))'
              : 'transparent',
            border: tab === t.id ? '1px solid rgba(108,71,255,.28)' : '1px solid transparent',
            color: tab === t.id ? 'var(--p2)' : 'var(--text3)',
            fontWeight: tab === t.id ? 700 : 500,
            fontSize: 12, cursor: 'pointer', transition: 'all .15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            boxShadow: tab === t.id ? '0 2px 10px rgba(108,71,255,.15)' : 'none',
          }}>
            <span style={{ display:'flex', opacity: tab === t.id ? 1 : 0.6 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'leaves' && pendingLeaves > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--acc)', color: '#000', borderRadius: 20, padding: '1px 6px', lineHeight: 1.5 }}>
                {pendingLeaves}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB TEAM ── */}
      {tab === 'team' && (
        <>
          {/* Filtres compacts sur une ligne */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
            {/* Recherche */}
            <div style={{ position:'relative', flex:1, minWidth:180 }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none', display:'flex' }}><Search size={13}/></span>
              <input className="input"
                style={{ paddingLeft:32, height:36, fontSize:13 }}
                placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
                value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Filtre département */}
            <select className="input"
              style={{ width:'auto', height:36, fontSize:12 }}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}>
              <option value="all">{lang === 'fr' ? 'Tous les depts' : 'All depts'}</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {/* Filtre statut */}
            <select className="input"
              style={{ width:'auto', height:36, fontSize:12 }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">{lang === 'fr' ? 'Tous statuts' : 'All status'}</option>
              <option value="active">{lang === 'fr' ? 'Actif' : 'Active'}</option>
              <option value="inactive">{lang === 'fr' ? 'Inactif' : 'Inactive'}</option>
            </select>
            {/* Toggle vue */}
            <div style={{ display:'flex', gap:2, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:3, flexShrink:0 }}>
              {[{id:'grid',icon:<LayoutGrid size={13}/>},{id:'table',icon:<AlignJustify size={13}/>}].map(v => (
                <button key={v.id} type="button"
                  onClick={() => setViewMode(v.id as any)}
                  style={{
                    width:28, height:28, borderRadius:6, border:'none', cursor:'pointer',
                    background: viewMode === v.id ? 'var(--p)' : 'transparent',
                    color: viewMode === v.id ? '#fff' : 'var(--text3)',
                    transition:'all .15s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>{v.icon}</button>
              ))}
            </div>
            {/* Bouton ajouter */}
            <button className="topbar-btn"
              style={{ height:36, padding:'0 14px', flexShrink:0 }}
              onClick={() => { setSelectedEmp(null); setShowModal(true) }}>
              + {lang === 'fr' ? 'Employé' : 'Employee'}
            </button>
          </div>

          {/* Grid view */}
          {viewMode === 'grid' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
              {loadingEmployees ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:16, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="skeleton" style={{ width:40, height:40, borderRadius:'50%', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div className="skeleton" style={{ width:'70%', height:13, borderRadius:4, marginBottom:6 }} />
                        <div className="skeleton" style={{ width:'50%', height:11, borderRadius:4 }} />
                      </div>
                    </div>
                    <div className="skeleton" style={{ width:'100%', height:8, borderRadius:4 }} />
                  </div>
                ))
              ) : filtered.map(emp => {
                const deptColor = DEPT_COLORS[emp.dept] ?? '#6C47FF'
                const isActive  = emp.active
                return (
                  <div key={emp.id} style={{
                    background:'linear-gradient(160deg,#0D0D1C,#111125)',
                    border:'1px solid var(--border)',
                    borderRadius:14, padding:0,
                    overflow:'hidden', cursor:'pointer',
                    transition:'all .18s',
                    opacity: isActive ? 1 : .65,
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = deptColor + '50'
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = `0 8px 24px ${deptColor}18`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'var(--border)'
                      el.style.transform = 'none'
                      el.style.boxShadow = 'none'
                    }}
                    onClick={() => openEditModal(emp)}
                  >
                    {/* Barre couleur dept */}
                    <div style={{ height:3, background:`linear-gradient(90deg,${deptColor},${deptColor}33)` }} />
                    <div style={{ padding:'14px 16px' }}>
                      {/* Avatar + Nom + Badge statut */}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
                        <div style={{
                          width:44, height:44, borderRadius:12,
                          background:`linear-gradient(135deg,${emp.color??'#6C47FF'},${emp.color??'#6C47FF'}66)`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:14, fontWeight:900, color:'#fff', flexShrink:0,
                          boxShadow:`0 3px 10px ${emp.color??'#6C47FF'}35`,
                        }}>
                          {emp.avatar}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.role}</div>
                        </div>
                        <span style={{
                          fontSize:9, fontWeight:700, textTransform:'uppercase',
                          background: isActive ? 'rgba(0,208,132,.1)' : 'rgba(255,59,92,.1)',
                          color: isActive ? 'var(--acc2)' : 'var(--danger)',
                          border:`1px solid ${isActive ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                          borderRadius:20, padding:'2px 7px', flexShrink:0,
                        }}>
                          {isActive ? (lang==='fr'?'Actif':'Active') : (lang==='fr'?'Inactif':'Inactive')}
                        </span>
                      </div>
                      {/* Métriques 2 cols */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 9px' }}>
                          <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>
                            {lang==='fr'?'Salaire':'Salary'}
                          </div>
                          <div style={{ fontSize:12, fontWeight:900, color:'var(--acc)', fontFamily:'var(--mono)' }}>{fmt(Number(emp.salary)||0)}</div>
                        </div>
                        <div style={{ background:`${deptColor}0D`, border:`1px solid ${deptColor}1A`, borderRadius:8, padding:'7px 9px' }}>
                          <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>Dept</div>
                          <div style={{ fontSize:11, fontWeight:700, color:deptColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.dept}</div>
                        </div>
                      </div>
                      {/* Footer card */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--text3)', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:5, padding:'2px 7px' }}>{emp.type}</span>
                        <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={9} style={{ color:'#F59E0B', opacity: s<=(emp.perf??3) ? 1 : .2, fill: s<=(emp.perf??3) ? '#F59E0B' : 'none' }} />
                          ))}
                        </div>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); openEditModal(emp) }}
                          style={{
                            width:26, height:26, borderRadius:7,
                            background:'rgba(255,149,0,.1)', border:'1px solid rgba(255,149,0,.2)',
                            cursor:'pointer', color:'var(--acc)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}><Pencil size={11}/></button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!loadingEmployees && filtered.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:14 }}>
                  {lang==='fr' ? 'Aucun employé trouvé' : 'No employee found'}
                </div>
              )}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="panel" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Employé</th>
                      <th scope="col">Département</th>
                      <th scope="col">Contrat</th>
                      <th scope="col">Ancienneté</th>
                      <th style={{ textAlign: 'right' }}>Salaire</th>
                      <th style={{ textAlign: 'center' }}>Perf.</th>
                      <th style={{ textAlign: 'center' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(emp => (
                      <tr key={emp.id} onClick={() => { openEditModal(emp) }} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <EmpAvatar emp={emp} size={32} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.role}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: DEPT_COLORS[emp.dept] ?? 'var(--text2)' }}>
                            {emp.dept}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                            color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                          }}>{emp.type}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{calcAnciennete(emp.hiredAt)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(emp.salary)}</td>
                        <td style={{ textAlign: 'center' }}>{emp.perf != null && <Stars v={emp.perf} />}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                            background: emp.active ? 'rgba(14,196,126,.12)' : 'var(--bg3)',
                            color: emp.active ? 'var(--acc2)' : 'var(--text3)',
                          }}>
                            {emp.active ? '● Actif' : '○ Inactif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>Aucun employé trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB CONTRACTS ── */}
      {tab === 'contracts' && (
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><FileText size={14}/> {lang === 'fr' ? 'Contrats en cours' : 'Active contracts'}</span>
            <button className="btn btn-primary btn-sm" onClick={() => { setContractForm({ empId: '', type: 'CDI', hiredAt: new Date().toISOString().split('T')[0], contractEnd: '', salary: 0, role: '', dept: 'Ventes' }); setShowNewContractModal(true) }}>
              <Plus size={14} /> {lang === 'fr' ? 'Nouveau contrat' : 'New contract'}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Employé</th>
                  <th scope="col">Département</th>
                  <th style={{ textAlign: 'center' }}>Type</th>
                  <th scope="col">Date début</th>
                  <th scope="col">Date fin</th>
                  <th style={{ textAlign: 'right' }}>Salaire brut</th>
                  <th style={{ textAlign: 'center' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {(employees ?? []).map(emp => {
                  const deptColor = DEPT_COLORS[emp.dept] ?? emp.color
                  const isExpiringSoon = emp.type === 'CDD' && emp.endAt
                    ? (() => {
                        const iso = toInputDate(emp.endAt)
                        if (!iso) return false
                        const diff = (new Date(iso).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        return diff <= 30 && diff >= 0
                      })()
                    : false
                  return (
                    <tr key={emp.id} onClick={() => { setSelectedContract(emp); setShowContractDetailModal(true) }} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <EmpAvatar emp={emp} size={32} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: deptColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: deptColor, fontWeight: 600 }}>{emp.dept}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                          color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                        }}>{emp.type}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {displayDate(emp.hiredAt, lang==='fr'?'fr-FR':'en-US')}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {emp.type === 'CDI' ? (
                          <span style={{ color:'var(--acc2)', fontWeight:600 }}>{lang==='fr'?'Indéterminé':'Permanent'}</span>
                        ) : emp.endAt ? (
                          <span style={{ color: isExpiringSoon ? 'var(--danger)' : 'var(--text2)', fontWeight: isExpiringSoon ? 700 : 400 }}>
                            {isExpiringSoon && <AlertTriangle size={11} style={{display:'inline',verticalAlign:'middle',marginRight:3,flexShrink:0}} />}{displayDate(emp.endAt, lang==='fr'?'fr-FR':'en-US')}
                          </span>
                        ) : (
                          <span style={{ color:'var(--acc)', fontWeight:600 }}>{lang==='fr'?'À définir':'To define'}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(emp.salary)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                          background: emp.active ? 'rgba(14,196,126,.12)' : 'var(--bg3)',
                          color: emp.active ? 'var(--acc2)' : 'var(--text3)',
                        }}>
                          {emp.active ? '✓ Actif' : '○ Inactif'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB PAYROLL ── */}
      {tab === 'payroll' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Sous-onglets */}
          <div style={{ display:'flex', gap:4, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:10, padding:4 }}>
            {([
              { id:'grid',    icon:<DollarSign size={13}/>, label: lang==='fr' ? 'Grille'     : 'Grid'     },
              { id:'payslip', icon:<FileText size={13}/>,   label: lang==='fr' ? 'Bulletins'  : 'Payslips' },
              { id:'bonuses', icon:<Gift size={13}/>,        label: lang==='fr' ? 'Primes'     : 'Bonuses'  },
              { id:'history', icon:<TrendingUp size={13}/>, label: lang==='fr' ? 'Historique' : 'History'  },
            ] as const).map(t => (
              <button key={t.id} type="button"
                onClick={() => setPayTab(t.id)}
                style={{
                  flex:1, padding:'7px', borderRadius:8, fontSize:12,
                  fontWeight:700, cursor:'pointer', fontFamily:'var(--font)', border:'none',
                  background: payTab===t.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
                  color: payTab===t.id ? '#fff' : 'var(--text3)',
                  transition:'all .15s',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                }}>
                {'icon' in t && <span style={{opacity:payTab===t.id?1:.6,display:'flex'}}>{(t as any).icon}</span>}
                {t.label}
              </button>
            ))}
          </div>

          {/* ── SOUS-ONGLET GRILLE ── */}
          {payTab === 'grid' && (
            <>
              {/* Contrôles */}
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input className="input" type="month"
                  style={{ width:'auto' }}
                  value={payrollMonth}
                  onChange={e => setPayrollMonth(e.target.value)} />
                <button className="btn btn-sm" onClick={() => {
                  const BOM = '﻿'
                  const activeEmps = (employees ?? []).filter(e => e.active)
                  const rows = [
                    ['Employé','Rôle','Brut','Prime','CNSS 8%','IR 5%','Net'],
                    ...activeEmps.map(emp => {
                      const brut  = emp.salary
                      const bonus = bonuses[String(emp.id)] ?? 0
                      const total = brut + bonus
                      const cnss  = Math.round(total * 0.08)
                      const ir    = Math.round(total * 0.05)
                      const net   = total - cnss - ir
                      return [emp.name, emp.role, brut, bonus, cnss, ir, net]
                    }),
                  ]
                  const csv = BOM + rows.map(r => r.join(';')).join('\r\n')
                  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `Paie_${payrollMonth}.csv`; a.click()
                  URL.revokeObjectURL(url)
                  toast.success('📊 Export paie téléchargé !')
                }}><Download size={14} /> CSV</button>
                <button className="btn btn-primary btn-sm"
                  onClick={() => generateAllPayslips()}
                  style={{display:'flex',alignItems:'center',gap:5}}>
                  <FileText size={13} /> {lang === 'fr' ? 'Tous les bulletins' : 'All payslips'}
                </button>
              </div>

              {/* KPIs paie */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[
                  { label: lang==='fr' ? 'Masse salariale brute' : 'Gross payroll', value: fmt(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)), color:'var(--p2)' },
                  { label: 'CNSS (8%)', value: fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.08)), color:'var(--danger)' },
                  { label: lang==='fr' ? 'Net à payer' : 'Net to pay', value: fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.92)), color:'var(--acc2)' },
                ].map(k => (
                  <div key={k.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>{k.label}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:k.color, fontFamily:'var(--mono)' }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Tableau paie */}
              <div className="panel">
                <div className="panel-h">
                  <span className="panel-t" style={{display:'flex',alignItems:'center',gap:6}}>
                    <DollarSign size={14}/> {lang==='fr' ? 'Détail de la paie' : 'Payroll detail'}{' — '}
                    {new Date(payrollMonth+'-01').toLocaleDateString(lang==='fr'?'fr-FR':'en-US',{month:'long',year:'numeric'})}
                  </span>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => { setShowSalaryModal(true); setSalaryTarget(null) }}>
                    + {lang==='fr' ? 'Prime collective' : 'Collective bonus'}
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{lang==='fr'?'EMPLOYÉ':'EMPLOYEE'}</th>
                        <th style={{textAlign:'right'}}>{lang==='fr'?'BRUT':'GROSS'}</th>
                        <th style={{textAlign:'right'}}>{lang==='fr'?'PRIME':'BONUS'}</th>
                        <th style={{textAlign:'right'}}>CNSS 8%</th>
                        <th style={{textAlign:'right'}}>IR 5%</th>
                        <th style={{textAlign:'right'}}>NET</th>
                        <th style={{textAlign:'center'}}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employees ?? []).filter(e => e.active).map(emp => {
                        const empId = String(emp.id)
                        const brut  = Number(emp.salary)||0
                        const bonus = bonuses[empId] ?? 0
                        const total = brut + bonus
                        const cnss  = Math.round(total * 0.08)
                        const ir    = Math.round(total * 0.05)
                        const net   = total - cnss - ir
                        return (
                          <tr key={emp.id}>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <EmpAvatar emp={emp} size={32} />
                                <div>
                                  <div style={{ fontWeight:700, fontSize:13 }}>{emp.name}</div>
                                  <div style={{ fontSize:10, color:'var(--text3)' }}>{emp.role}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:700 }}>{fmt(brut)}</td>
                            <td style={{ textAlign:'right' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                                <span style={{ fontFamily:'var(--mono)', fontSize:12, color: bonus>0 ? 'var(--acc2)' : 'var(--text3)' }}>
                                  {bonus>0 ? `+${fmt(bonus)}` : '—'}
                                </span>
                                <button type="button"
                                  onClick={() => { setSalaryTarget(emp); setShowSalaryModal(true) }}
                                  style={{ width:20, height:20, borderRadius:5, background:'rgba(0,208,132,.1)', border:'1px solid rgba(0,208,132,.2)', cursor:'pointer', fontSize:10, color:'var(--acc2)', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                              </div>
                            </td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--danger)', fontSize:12 }}>− {fmt(cnss)}</td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc)', fontSize:12 }}>− {fmt(ir)}</td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:900, color:'var(--acc2)' }}>{fmt(net)}</td>
                            <td style={{ textAlign:'center' }}>
                              <button className="btn btn-sm" style={{ fontSize:10, padding:'3px 8px', display:'flex', alignItems:'center', gap:4 }}
                                onClick={() => { setSalaryTarget({...emp, mode:'raise'}); setShowSalaryModal(true) }}>
                                <TrendingUp size={11}/> {lang==='fr'?'Augmenter':'Raise'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'var(--bg4)' }}>
                        <td style={{ fontWeight:800, color:'var(--text)', padding:'12px 14px' }}>TOTAL</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:800, color:'var(--p2)', padding:'12px 14px' }}>{fmt(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc2)', padding:'12px 14px' }}>{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--danger)', padding:'12px 14px' }}>− {fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.08))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc)', padding:'12px 14px' }}>− {fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.05))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:900, fontSize:15, color:'var(--acc2)', padding:'12px 14px' }}>{fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.87))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── SOUS-ONGLET BULLETINS ── */}
          {payTab === 'payslip' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text3)' }}>
                  {lang==='fr' ? 'Période :' : 'Period:'}
                </label>
                <input className="input" type="month"
                  style={{ width:'auto' }}
                  value={payrollMonth}
                  onChange={e => setPayrollMonth(e.target.value)} />
                <button className="topbar-btn"
                  style={{ fontSize:12, padding:'7px 14px', display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => generateAllPayslips()}>
                  <FileText size={13}/> {lang==='fr' ? 'Générer tous les bulletins' : 'Generate all payslips'}
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
                {employees.filter(e => e.active !== false).map(emp => {
                  const brut  = Number(emp.salary)||0
                  const bonus = bonuses[String(emp.id)] ?? 0
                  const total = brut + bonus
                  const cnss  = Math.round(total * 0.08)
                  const ir    = Math.round(total * 0.05)
                  const net   = total - cnss - ir
                  return (
                    <div key={emp.id} style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:14, padding:18, transition:'all .2s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                        <div style={{ width:40, height:40, borderRadius:11, background:`linear-gradient(135deg,${emp.color??'#6C47FF'},${emp.color??'#6C47FF'}66)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff', flexShrink:0 }}>
                          {emp.avatar ?? '??'}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{emp.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)' }}>{emp.role} · {emp.dept}</div>
                        </div>
                        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', background:'rgba(0,208,132,.1)', color:'var(--acc2)', border:'1px solid rgba(0,208,132,.2)', borderRadius:20, padding:'2px 8px' }}>
                          {new Date(payrollMonth+'-01').toLocaleDateString(lang==='fr'?'fr-FR':'en-US', {month:'short', year:'numeric'})}
                        </div>
                      </div>

                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                        {[
                          { label: lang==='fr'?'Salaire brut':'Gross salary', value: fmt(brut), color:'var(--text2)', sign:'' },
                          ...(bonus > 0 ? [{ label: lang==='fr'?'Prime':'Bonus', value: fmt(bonus), color:'var(--acc2)', sign:'+' }] : []),
                          { label: 'CNSS (8%)', value: fmt(cnss), color:'var(--danger)', sign:'−' },
                          { label: 'IR (5%)',   value: fmt(ir),   color:'var(--acc)',    sign:'−' },
                        ].map((row, i) => (
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                            <span style={{ color:'var(--text3)' }}>{row.label}</span>
                            <span style={{ color:row.color, fontFamily:'var(--mono)', fontWeight:600 }}>{row.sign} {row.value}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'rgba(0,208,132,.06)', border:'1px solid rgba(0,208,132,.12)', borderRadius:10, marginBottom:12 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>
                          {lang==='fr' ? 'NET À PAYER' : 'NET TO PAY'}
                        </span>
                        <span style={{ fontSize:20, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>
                          {fmt(net)}
                        </span>
                      </div>

                      <button className="mini-btn"
                        style={{ width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:5 }}
                        onClick={() => generatePayslipPDF(emp, { brut, bonus, cnss, ir, net, month: payrollMonth })}>
                        <FileText size={13}/> {lang==='fr' ? 'Télécharger bulletin' : 'Download payslip'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SOUS-ONGLET PRIMES ── */}
          {payTab === 'bonuses' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button className="topbar-btn"
                  onClick={() => { setSalaryTarget(null); setShowSalaryModal(true) }}>
                  + {lang==='fr' ? 'Nouvelle prime' : 'New bonus'}
                </button>
              </div>

              <div className="panel">
                <div className="panel-h">
                  <span className="panel-t" style={{display:'flex',alignItems:'center',gap:6}}><Gift size={14}/> {lang==='fr' ? 'Primes du mois' : 'Monthly bonuses'}</span>
                  <span style={{ fontSize:12, color:'var(--text3)' }}>
                    {lang==='fr' ? 'Total :' : 'Total:'}{' '}
                    <strong style={{ color:'var(--acc2)' }}>{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}</strong>
                  </span>
                </div>

                {Object.keys(bonuses).length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><Gift size={36} style={{color:'var(--text4)'}}/></div>
                    <div style={{ fontSize:14, fontWeight:600 }}>
                      {lang==='fr' ? 'Aucune prime ce mois' : 'No bonuses this month'}
                    </div>
                    <div style={{ fontSize:12, marginTop:6 }}>
                      {lang==='fr' ? 'Cliquez sur "+ Nouvelle prime" pour en ajouter' : 'Click "+ New bonus" to add one'}
                    </div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{lang==='fr'?'EMPLOYÉ':'EMPLOYEE'}</th>
                          <th scope="col">{lang==='fr'?'MONTANT':'AMOUNT'}</th>
                          <th scope="col">{lang==='fr'?'% DU SALAIRE':'% OF SALARY'}</th>
                          <th scope="col">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(bonuses).map(([empId, amount]) => {
                          const emp = employees.find(e => String(e.id) === empId)
                          if (!emp) return null
                          const pct = Number(emp.salary) > 0 ? Math.round((amount/Number(emp.salary))*100) : 0
                          return (
                            <tr key={empId}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ width:30, height:30, borderRadius:8, background:`${emp.color??'#6C47FF'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:emp.color??'#6C47FF' }}>
                                    {emp.avatar ?? '??'}
                                  </div>
                                  <span style={{ fontWeight:700, fontSize:13 }}>{emp.name}</span>
                                </div>
                              </td>
                              <td style={{ fontFamily:'var(--mono)', color:'var(--acc2)', fontWeight:800 }}>+{fmt(amount)}</td>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ flex:1, height:6, background:'var(--bg5)', borderRadius:99, overflow:'hidden', maxWidth:100 }}>
                                    <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:'linear-gradient(90deg,var(--acc2),var(--p2))', borderRadius:99 }} />
                                  </div>
                                  <span style={{ fontSize:11, color:'var(--acc2)', fontFamily:'var(--mono)', fontWeight:700 }}>{pct}%</span>
                                </div>
                              </td>
                              <td>
                                <button className="mini-btn"
                                  style={{ fontSize:10, padding:'3px 8px', color:'var(--danger)', borderColor:'rgba(255,59,92,.2)', display:'flex', alignItems:'center', gap:4 }}
                                  onClick={() => {
                                    const nb = {...bonuses}
                                    delete nb[empId]
                                    setBonuses(nb)
                                    const ids = bonusList.filter(b => b.empId === empId).map(b => b.id)
                                    setBonusList(prev => prev.filter(b => b.empId !== empId))
                                    ids.forEach(id => { if (!id.startsWith('local-')) bonusesApi.delete(id).catch(()=>{}) })
                                    toast.success(lang==='fr' ? 'Prime supprimée' : 'Bonus removed')
                                  }}>
                                  <Trash2 size={11}/> {lang==='fr' ? 'Supprimer' : 'Remove'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {Object.keys(bonuses).length > 0 && (
                <div style={{ padding:'14px 18px', background:'rgba(0,208,132,.05)', border:'1px solid rgba(0,208,132,.12)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                      <BarChart3 size={14} style={{color:'var(--acc2)',flexShrink:0}}/> {lang==='fr' ? 'Impact sur la masse salariale' : 'Impact on payroll'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang==='fr'
                        ? `${Object.keys(bonuses).length} employé(s) avec prime`
                        : `${Object.keys(bonuses).length} employee(s) with bonus`}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:22, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                      +{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{lang==='fr' ? 'Total primes' : 'Total bonuses'}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SOUS-ONGLET HISTORIQUE ── */}
          {payTab === 'history' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {salaryHistory.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', textAlign:'center', background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:20 }}>
                  <div style={{ width:72, height:72, borderRadius:20, background:'rgba(108,71,255,.1)', border:'1px solid rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}><TrendingUp size={32} style={{color:'var(--p2)'}}/></div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:8 }}>
                    {lang==='fr' ? 'Aucune révision salariale' : 'No salary revisions yet'}
                  </div>
                  <div style={{ fontSize:13, color:'var(--text3)', maxWidth:300, lineHeight:1.6 }}>
                    {lang==='fr'
                      ? 'Les augmentations et révisions salariales apparaîtront ici avec leur historique complet.'
                      : 'Salary increases and revisions will appear here with their complete history.'}
                  </div>
                  <button className="topbar-btn"
                    style={{ marginTop:20, display:'flex', alignItems:'center', gap:6 }}
                    onClick={() => {
                      if (employees.length > 0) {
                        setSalaryTarget({ ...employees[0], mode:'raise' })
                        setShowSalaryModal(true)
                      }
                    }}>
                    <TrendingUp size={14}/> {lang==='fr' ? 'Première révision salariale' : 'First salary revision'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Timeline verticale enrichie */}
                  <div style={{
                    display:'flex', flexDirection:'column', gap:0,
                    position:'relative',
                  }}>
                    {/* Ligne verticale centrale */}
                    <div style={{
                      position:'absolute',
                      left:28, top:20, bottom:20,
                      width:2,
                      background:'linear-gradient(180deg,var(--p),var(--p2),var(--acc2))',
                      borderRadius:99,
                      opacity:.3,
                    }}/>

                    {[...salaryHistory].reverse().map((h, i) => {
                      const emp   = employees.find(e => String(e.id) === (h.empId ?? (h as any).employeeId))
                      const diff  = h.newSalary - h.oldSalary
                      const pct   = Number(h.oldSalary) > 0
                        ? ((diff / Number(h.oldSalary)) * 100) : 0
                      const isPos = diff >= 0
                      const date  = h.date
                        ? new Date(h.date).toLocaleDateString(
                            lang === 'fr' ? 'fr-FR' : 'en-US',
                            { day:'numeric', month:'short', year:'numeric' }
                          )
                        : '—'

                      return (
                        <div key={i} style={{
                          display:'flex', gap:0,
                          alignItems:'stretch',
                        }}>
                          {/* Colonne gauche : point */}
                          <div style={{
                            width:58, flexShrink:0,
                            display:'flex', flexDirection:'column',
                            alignItems:'center',
                            position:'relative',
                          }}>
                            <div style={{
                              width:18, height:18,
                              borderRadius:'50%', flexShrink:0,
                              marginTop:20,
                              background: isPos
                                ? 'linear-gradient(135deg,var(--acc2),var(--p2))'
                                : 'linear-gradient(135deg,var(--danger),var(--warn))',
                              boxShadow: isPos
                                ? '0 0 12px rgba(0,208,132,.5)'
                                : '0 0 12px rgba(255,59,92,.5)',
                              border:'2px solid var(--bg)',
                              zIndex:1,
                              display:'flex', alignItems:'center',
                              justifyContent:'center',
                              fontSize:9, color:'#fff', fontWeight:900,
                            }}>
                              {isPos ? '↑' : '↓'}
                            </div>
                          </div>

                          {/* Carte principale */}
                          <div style={{
                            flex:1, marginBottom:12,
                            background:'var(--grad-card)',
                            border:`1px solid ${isPos
                              ? 'rgba(0,208,132,.15)' : 'rgba(255,59,92,.15)'}`,
                            borderRadius:16,
                            overflow:'hidden',
                            transition:'all .2s',
                          }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'
                              ;(e.currentTarget as HTMLElement).style.boxShadow =
                                isPos ? '0 4px 20px rgba(0,208,132,.1)' : '0 4px 20px rgba(255,59,92,.1)'
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'none'
                              ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                            }}
                          >
                            {/* Bande couleur haut */}
                            <div style={{
                              height:3,
                              background: isPos
                                ? 'linear-gradient(90deg,var(--acc2),var(--p2)33)'
                                : 'linear-gradient(90deg,var(--danger),var(--warn)33)',
                            }}/>

                            <div style={{
                              padding:'14px 18px',
                              display:'flex', alignItems:'center',
                              gap:14, flexWrap:'wrap',
                            }}>
                              {/* Avatar employé */}
                              <div style={{
                                width:42, height:42, borderRadius:12,
                                flexShrink:0,
                                background:`${emp?.color ?? '#6C47FF'}22`,
                                border:`2px solid ${emp?.color ?? '#6C47FF'}33`,
                                display:'flex', alignItems:'center',
                                justifyContent:'center',
                                fontSize:14, fontWeight:900,
                                color:emp?.color ?? '#6C47FF',
                                boxShadow:`0 2px 8px ${emp?.color ?? '#6C47FF'}25`,
                              }}>
                                {emp?.avatar ?? '??'}
                              </div>

                              {/* Infos employé */}
                              <div style={{ flex:1, minWidth:140 }}>
                                <div style={{
                                  fontSize:14, fontWeight:800,
                                  color:'var(--text)', marginBottom:3,
                                }}>
                                  {emp?.name ?? (lang === 'fr' ? 'Employé' : 'Employee')}
                                </div>
                                <div style={{
                                  display:'flex', alignItems:'center',
                                  gap:6, flexWrap:'wrap',
                                }}>
                                  <span style={{ fontSize:10, color:'var(--text3)', display:'inline-flex', alignItems:'center', gap:3 }}>
                                    <Calendar size={9}/> {date}
                                  </span>
                                  {h.reason && (
                                    <span style={{
                                      fontSize:10, fontWeight:600,
                                      background:'rgba(108,71,255,.1)',
                                      color:'var(--p3)',
                                      border:'1px solid rgba(108,71,255,.15)',
                                      borderRadius:99, padding:'1px 7px',
                                    }}>
                                      {h.reason}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Évolution salaire */}
                              <div style={{
                                display:'flex', flexDirection:'column',
                                alignItems:'flex-end', gap:4,
                              }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{
                                    fontSize:13, color:'var(--text3)',
                                    fontFamily:'var(--mono)',
                                    textDecoration:'line-through',
                                    opacity:.6,
                                  }}>
                                    {fmt(h.oldSalary)}
                                  </span>
                                  <div style={{ width:24, height:1, background:'var(--border2)' }}/>
                                  <span style={{
                                    fontSize:16, fontWeight:900,
                                    color:'var(--text)',
                                    fontFamily:'var(--mono)',
                                    letterSpacing:'-.5px',
                                  }}>
                                    {fmt(h.newSalary)}
                                  </span>
                                </div>

                                {/* Badge % */}
                                <div style={{
                                  display:'inline-flex',
                                  alignItems:'center', gap:5,
                                  padding:'4px 12px',
                                  background: isPos
                                    ? 'rgba(0,208,132,.1)'
                                    : 'rgba(255,59,92,.1)',
                                  border:`1px solid ${isPos
                                    ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                                  borderRadius:99,
                                }}>
                                  <span style={{ fontSize:11 }}>{isPos ? '↗' : '↘'}</span>
                                  <span style={{
                                    fontSize:13, fontWeight:900,
                                    color: isPos ? 'var(--acc2)' : 'var(--danger)',
                                    fontFamily:'var(--mono)',
                                  }}>
                                    {isPos ? '+' : ''}{pct.toFixed(1)}%
                                  </span>
                                  <span style={{
                                    fontSize:11,
                                    color: isPos ? 'var(--acc2)' : 'var(--danger)',
                                    opacity:.75,
                                  }}>
                                    ({isPos ? '+' : ''}{fmt(Math.abs(diff))})
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Barre progression */}
                            <div style={{ padding:'0 18px 14px' }}>
                              <div style={{
                                height:4,
                                background:'rgba(255,255,255,.06)',
                                borderRadius:99, overflow:'hidden',
                              }}>
                                <div style={{
                                  height:'100%',
                                  width:`${Math.min(100, Math.abs(pct) * 1.5)}%`,
                                  background: isPos
                                    ? 'linear-gradient(90deg,var(--acc2),var(--p2))'
                                    : 'linear-gradient(90deg,var(--danger),var(--warn))',
                                  borderRadius:99,
                                  transition:'width .6s ease',
                                  boxShadow: isPos
                                    ? '0 0 8px rgba(0,208,132,.4)'
                                    : '0 0 8px rgba(255,59,92,.4)',
                                }}/>
                              </div>
                              <div style={{
                                display:'flex', justifyContent:'space-between',
                                marginTop:4,
                              }}>
                                <span style={{ fontSize:9, color:'var(--text4)' }}>
                                  {lang === 'fr' ? 'Évolution' : 'Evolution'}
                                </span>
                                <span style={{
                                  fontSize:9, fontFamily:'var(--mono)',
                                  color: isPos ? 'var(--acc2)' : 'var(--danger)',
                                  fontWeight:700,
                                }}>
                                  {isPos ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Stats résumé en bas */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',
                    gap:10, marginTop:4,
                  }}>
                    {[
                      {
                        label: lang === 'fr' ? 'Révisions' : 'Revisions',
                        value: salaryHistory.length,
                        icon: <FileText size={16} />, color:'var(--p2)',
                      },
                      {
                        label: lang === 'fr' ? 'Employés' : 'Employees',
                        value: new Set(salaryHistory.map(h => h.empId)).size,
                        icon: <Users size={16} />, color:'var(--acc3)',
                      },
                      {
                        label: lang === 'fr' ? 'Hausse moy.' : 'Avg raise',
                        value: (() => {
                          const pcts = salaryHistory.map(h =>
                            Number(h.oldSalary) > 0
                              ? ((h.newSalary - h.oldSalary) / h.oldSalary) * 100
                              : 0
                          )
                          const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length
                          return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`
                        })(),
                        icon: <TrendingUp size={16} />, color:'var(--acc2)',
                      },
                      {
                        label: lang === 'fr' ? 'Impact total' : 'Total impact',
                        value: fmt(salaryHistory.reduce((s, h) => s + (h.newSalary - h.oldSalary), 0)),
                        icon: <DollarSign size={16} />, color:'var(--warn)',
                      },
                    ].map(k => (
                      <div key={k.label} style={{
                        background:'var(--grad-card)',
                        border:'1px solid var(--border)',
                        borderRadius:12, padding:'12px 14px',
                        display:'flex', alignItems:'center', gap:10,
                        transition:'all .15s',
                      }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
                          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                          ;(e.currentTarget as HTMLElement).style.transform = 'none'
                        }}
                      >
                        <div style={{
                          width:34, height:34, borderRadius:10,
                          background:'rgba(255,255,255,.04)',
                          display:'flex', alignItems:'center',
                          justifyContent:'center', color:k.color,
                          flexShrink:0,
                        }}>{k.icon}</div>
                        <div>
                          <div style={{
                            fontSize:9, fontWeight:700,
                            textTransform:'uppercase', letterSpacing:'.5px',
                            color:'var(--text3)', marginBottom:2,
                          }}>{k.label}</div>
                          <div style={{
                            fontSize:16, fontWeight:900,
                            color:k.color, fontFamily:'var(--mono)',
                            letterSpacing:'-.5px',
                          }}>{k.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL PRIME / AUGMENTATION ── */}
      {showSalaryModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget && setShowSalaryModal(false)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:900, color:'var(--text)', margin:0, display:'flex', alignItems:'center', gap:8 }}>
                {salaryTarget?.mode === 'raise'
                  ? <><TrendingUp size={15} style={{color:'var(--acc2)',flexShrink:0}}/>{lang==='fr' ? 'Augmentation salariale' : 'Salary raise'}</>
                  : <><Gift size={15} style={{color:'var(--acc)',flexShrink:0}}/>{lang==='fr' ? 'Ajouter une prime' : 'Add bonus'}{salaryTarget ? ` — ${salaryTarget.name}` : ''}</>}
              </h3>
              <button className="btn btn-sm" onClick={() => setShowSalaryModal(false)}>✕</button>
            </div>
            {salaryTarget?.mode === 'raise' ? (
              <SalaryRaiseForm
                emp={salaryTarget}
                lang={lang}
                fmt={fmt}
                onConfirm={(newSalary: number, reason: string) => {
                  handleConfirmRaise(String(salaryTarget.id), newSalary, reason)
                }}
                onClose={() => setShowSalaryModal(false)}
              />
            ) : (
              <BonusForm
                emp={salaryTarget}
                employees={(employees ?? []).filter(e => e.active)}
                lang={lang}
                fmt={fmt}
                onConfirm={(empId: string|'all', amount: number, reason?: string) => {
                  handleConfirmBonus(empId, amount, reason ?? 'Performance')
                }}
                onClose={() => setShowSalaryModal(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── TAB POINTAGE / PRÉSENCES ── */}
      {tab === 'pointage' && (() => {
        const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
          present: { label: lang==='fr'?'Présent':'Present',  color:'#00D084', bg:'rgba(0,208,132,.1)',  icon:<CheckCircle size={11}/> },
          late:    { label: lang==='fr'?'Retard':'Late',      color:'#F59E0B', bg:'rgba(245,158,11,.1)', icon:<Clock size={11}/> },
          absent:  { label: lang==='fr'?'Absent':'Absent',    color:'#EF4444', bg:'rgba(239,68,68,.1)',  icon:<XCircle size={11}/> },
          half:    { label: lang==='fr'?'Mi-temps':'Half',    color:'#3B82F6', bg:'rgba(59,130,246,.1)', icon:<AlertTriangle size={11}/> },
        }

        const dayEmp = employees.filter(e => e.active !== false)
        const todayKey = attendanceDate

        const countByStatus = (s: string) => dayEmp.filter(e => (attendance[`${String(e.id)}_${todayKey}`]?.status ?? 'absent') === s).length
        const presentCount = countByStatus('present') + countByStatus('late') + countByStatus('half')

        const exportAttendanceCSV = () => {
          const rows = dayEmp.map(e => {
            const key = `${String(e.id)}_${todayKey}`
            const a = attendance[key]
            return [e.name, e.role, a?.status ?? 'absent', a?.in ?? '—', a?.out ?? '—']
          })
          const lines = [['Employé','Poste','Statut','Arrivée','Départ'], ...rows]
          const csv = lines.map(r => r.join(';')).join('\n')
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `pointage_${todayKey}.csv`; a.click()
          URL.revokeObjectURL(url)
        }

        const markAllPresent = () => {
          const now = new Date()
          const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
          const updates: typeof attendance = {}
          dayEmp.forEach(e => {
            const key = `${String(e.id)}_${todayKey}`
            updates[key] = { in: hhmm, out: null, status: 'present' }
          })
          setAttendance(prev => ({ ...prev, ...updates }))
        }

        const setEmpField = (empId: string, field: 'in'|'out'|'status', value: string) => {
          const key = `${empId}_${todayKey}`
          setAttendance(prev => ({
            ...prev,
            [key]: { ...(prev[key] ?? { in: null, out: null, status: 'absent' }), [field]: value },
          }))
        }

        return (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Header toolbar */}
            <div className="panel" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:16, fontWeight:800, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={16}/> {lang==='fr'?'Feuille de présence':'Attendance sheet'}
              </span>
              <input type="date" className="input" value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                style={{ width:150, height:34, fontSize:13 }} />
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <button className="btn btn-sm" onClick={markAllPresent} style={{display:'flex',alignItems:'center',gap:5}}>
                  <CheckCheck size={13}/> {lang==='fr'?'Tous présents':'All present'}
                </button>
                <button className="btn btn-sm" onClick={exportAttendanceCSV} style={{display:'flex',alignItems:'center',gap:5}}>
                  <Download size={13}/> CSV
                </button>
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { icon:<CheckCircle size={20}/>, label:lang==='fr'?'Présents':'Present',  count:presentCount,          color:'#00D084', hex:'#00D084' },
                { icon:<Clock size={20}/>,       label:lang==='fr'?'Retards':'Late',      count:countByStatus('late'), color:'#F59E0B', hex:'#F59E0B' },
                { icon:<XCircle size={20}/>,     label:lang==='fr'?'Absents':'Absent',    count:countByStatus('absent'),color:'#EF4444', hex:'#EF4444' },
                { icon:<AlertTriangle size={20}/>,label:lang==='fr'?'Mi-temps':'Half-day', count:countByStatus('half'), color:'#3B82F6', hex:'#3B82F6' },
              ].map(k => (
                <div key={k.label} className="panel" style={{ padding:'12px 14px', position:'relative', overflow:'hidden', background:`linear-gradient(135deg,${k.hex}18,${k.hex}06)`, border:`1px solid ${k.hex}28` }}>
                  <div style={{ position:'absolute', top:-16, right:-16, width:64, height:64, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}20 0%,transparent 70%)`, pointerEvents:'none' }} />
                  <div style={{ color:k.color, marginBottom:6, display:'flex' }}>{k.icon}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:k.color, fontFamily:'var(--mono)' }}>{k.count}</div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginTop:2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Employee rows */}
            <div className="panel" style={{ overflow:'hidden', padding:0 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 110px 110px', gap:0, padding:'10px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)' }}>
                <span>{lang==='fr'?'Employé':'Employee'}</span>
                <span style={{ textAlign:'center' }}>{lang==='fr'?'Statut':'Status'}</span>
                <span style={{ textAlign:'center' }}>Arrivée</span>
                <span style={{ textAlign:'center' }}>Départ</span>
                <span style={{ textAlign:'center' }}>Actions</span>
              </div>
              {dayEmp.map((emp, i) => {
                const key = `${String(emp.id)}_${todayKey}`
                const a = attendance[key] ?? { in: null, out: null, status: 'absent' as const }
                const sc = STATUS_CONFIG[a.status]
                return (
                  <div key={emp.id} style={{
                    display:'grid', gridTemplateColumns:'1fr 90px 90px 110px 110px',
                    alignItems:'center', gap:0,
                    padding:'10px 16px',
                    borderBottom: i < dayEmp.length-1 ? '1px solid var(--border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg4)',
                  }}>
                    {/* Employé */}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:`${emp.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:emp.color, flexShrink:0 }}>
                        {emp.avatar}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{emp.name.split(' ')[0]}</div>
                        <div style={{ fontSize:10, color:'var(--text3)' }}>{emp.role}</div>
                      </div>
                    </div>
                    {/* Statut badge */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:sc.bg, color:sc.color, display:'inline-flex', alignItems:'center', gap:4 }}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    {/* Heure arrivée */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <input type="time" className="input" value={a.in ?? ''}
                        onChange={e => setEmpField(String(emp.id), 'in', e.target.value)}
                        style={{ width:80, height:30, fontSize:12, textAlign:'center', padding:'0 4px' }} />
                    </div>
                    {/* Heure départ */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <input type="time" className="input" value={a.out ?? ''}
                        onChange={e => setEmpField(String(emp.id), 'out', e.target.value)}
                        style={{ width:80, height:30, fontSize:12, textAlign:'center', padding:'0 4px' }} />
                    </div>
                    {/* Boutons statut */}
                    <div style={{ display:'flex', justifyContent:'center', gap:4 }}>
                      {(['present','late','absent','half'] as const).map(s => (
                        <button key={s} type="button"
                          onClick={() => setEmpField(String(emp.id), 'status', s)}
                          title={STATUS_CONFIG[s].label}
                          style={{
                            width:26, height:26, borderRadius:6, border:'none', cursor:'pointer',
                            background: a.status === s ? STATUS_CONFIG[s].bg : 'var(--bg3)',
                            color: STATUS_CONFIG[s].color,
                            outline: a.status === s ? `1.5px solid ${STATUS_CONFIG[s].color}` : 'none',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                          {STATUS_CONFIG[s].icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary footer */}
            <div className="panel" style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>
                {lang==='fr'?'Journée du':'Day of'} <strong style={{ color:'var(--text)' }}>{new Date(attendanceDate + 'T00:00:00').toLocaleDateString(lang==='fr'?'fr-FR':'en-US', { weekday:'long', day:'numeric', month:'long' })}</strong>
              </span>
              <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto' }}>
                {presentCount}/{dayEmp.length} {lang==='fr'?'présents':'present'} · {dayEmp.length > 0 ? Math.round(presentCount/dayEmp.length*100) : 0}% {lang==='fr'?'de présence':'attendance rate'}
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── TAB LEAVES ── */}
      {tab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingLeaves > 0 && (
            <div style={{ padding: '14px 16px', background: 'rgba(240,165,0,.1)', border: '1px solid rgba(240,165,0,.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} style={{ color: 'var(--acc)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)' }}>
                {pendingLeaves} demande{pendingLeaves > 1 ? 's' : ''} de congé en attente de validation
              </span>
            </div>
          )}

          <div className="panel">
            <div className="panel-h">
              <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><Umbrella size={14}/> {lang === 'fr' ? 'Demandes de congés' : 'Leave requests'}</span>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setLeaveForm({ empId: 0, type: lang === 'fr' ? 'Congé annuel' : 'Annual leave', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' })
                setShowLeaveModal(true)
              }}>
                <Plus size={14} /> {lang === 'fr' ? 'Nouvelle demande' : 'New request'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(leaves ?? []).map(leave => {
                const emp = (employees ?? []).find(e => e.id === leave.empId || Number(e.id) === leave.empId)
                const displayName = emp?.name ?? leave.empName ?? '—'
                const statusCfg = LEAVE_STATUS_CFG[leave.status]
                return (
                  <div key={leave.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
                    {emp && <EmpAvatar emp={emp} size={38} />}
                    {!emp && (
                      <div style={{ width:38, height:38, borderRadius:'50%', background:'#6C47FF22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#6C47FF', flexShrink:0 }}>
                        {displayName.slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{displayName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {leave.type} · {leave.from} → {leave.to} · <strong>{leave.days}j</strong>
                      </div>
                      {leave.motif && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>"{leave.motif}"</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                      {statusCfg.label}
                    </span>
                    {leave.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(14,196,126,.15)', border: '1px solid rgba(14,196,126,.3)', color: 'var(--acc2)' }}
                          onClick={() => handleLeaveAction(leave.id, 'approved')}>
                          ✓ {lang === 'fr' ? 'Approuver' : 'Approve'}
                        </button>
                        <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(232,64,74,.12)', border: '1px solid rgba(232,64,74,.25)', color: 'var(--danger)' }}
                          onClick={() => handleLeaveAction(leave.id, 'refused')}>
                          ✕ {lang === 'fr' ? 'Refuser' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {(leaves ?? []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 14 }}>
                  {lang === 'fr' ? 'Aucune demande de congé' : 'No leave requests'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EMPLOYEE (ajout) ── */}
      {showModal && (
        <EmpModal
          emp={null}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            const newEmp: Employee = {
              ...data,
              id: Date.now(),
              avatar: data.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
              active: true,
            }
            setEmployees(prev => [...prev, newEmp])
            toast.success('✅ Employé ajouté')
            setShowModal(false)
          }}
        />
      )}

      {/* ── MODAL EMPLOYÉ PREMIUM (édition) ── */}
      {showEditEmpModal && selectedEmp && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          onClick={e => e.target===e.currentTarget && setShowEditEmpModal(false)}>
          <div style={{ background:'#0D0D1C', border:'1px solid rgba(255,255,255,.1)', borderRadius:24, width:'100%', maxWidth:560, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.8)', position:'relative' }}>

            {/* Ligne décorative */}
            <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'40%', height:1, background:`linear-gradient(90deg,transparent,${editEmpForm.color??'#6C47FF'},transparent)` }} />

            {/* HEADER */}
            <div style={{ padding:'24px 24px 20px', background:`linear-gradient(135deg,${editEmpForm.color??'#6C47FF'}18,${editEmpForm.color??'#6C47FF'}05)`, borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div
                  style={{ width:60, height:60, borderRadius:18, overflow:'hidden', background:`linear-gradient(135deg,${editEmpForm.color??'#6C47FF'},${editEmpForm.color??'#6C47FF'}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'#fff', flexShrink:0, boxShadow:`0 8px 24px ${editEmpForm.color??'#6C47FF'}50`, border:`2px solid ${editEmpForm.color??'#6C47FF'}40`, letterSpacing:'-1px', cursor: empEditMode ? 'pointer' : 'default', position:'relative' }}
                  title={empEditMode ? (lang==='fr'?'Cliquer pour changer la photo':'Click to change photo') : undefined}
                  onClick={() => empEditMode && (document.getElementById('emp-photo-input') as HTMLInputElement)?.click()}>
                  {editEmpForm.photoUrl
                    ? <img src={editEmpForm.photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : (editEmpForm.name || selectedEmp.name || '??').split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase()
                  }
                </div>
                <input id="emp-photo-input" type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 2 * 1024 * 1024) { toast.error(lang==='fr'?'Photo trop lourde (max 2MB)':'Photo too large (max 2MB)'); return }
                  const r = new FileReader()
                  r.onload = ev => setEditEmpForm((fm:any) => ({ ...fm, photoUrl: ev.target?.result as string }))
                  r.readAsDataURL(f)
                  e.target.value = ''
                }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <h3 style={{ fontSize:18, fontWeight:900, color:'var(--text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {editEmpForm.name || selectedEmp.name}
                  </h3>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                    {editEmpForm.role || selectedEmp.role} · {editEmpForm.dept || selectedEmp.dept}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                    <button type="button"
                      onClick={() => empEditMode && setEditEmpForm((f:any) => ({ ...f, isActive:!f.isActive }))}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:99, border:'none', cursor: empEditMode ? 'pointer' : 'default', fontSize:11, fontWeight:700, fontFamily:'var(--font)', background: editEmpForm.isActive?'rgba(0,208,132,.15)':'rgba(255,59,92,.15)', color: editEmpForm.isActive?'var(--acc2)':'var(--danger)', transition:'all .15s' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background: editEmpForm.isActive?'var(--acc2)':'var(--danger)', boxShadow: editEmpForm.isActive?'0 0 6px var(--acc2)':'0 0 6px var(--danger)' }} />
                      {editEmpForm.isActive ? (lang==='fr'?'Employé actif':'Active') : (lang==='fr'?'Inactif':'Inactive')}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setShowEditEmpModal(false)}
                  style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)', cursor:'pointer', fontSize:16, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
              </div>
            </div>

            {/* CORPS */}
            <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'20px 24px' }}>

              {/* Mode banner */}
              {!empEditMode
                ? <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                    <Eye size={14} style={{ color:'var(--acc3)', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>
                      {lang==='fr' ? 'Mode visualisation — cliquez sur Modifier pour éditer' : 'View mode — click Edit to make changes'}
                    </span>
                  </div>
                : <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                    <Pencil size={14} style={{ color:'var(--warn)', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>
                      {lang==='fr' ? 'Mode édition — modifications non sauvegardées' : 'Edit mode — unsaved changes'}
                    </span>
                  </div>
              }

              {/* Identité */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:`${editEmpForm.color??'#6C47FF'}22`, display:'flex', alignItems:'center', justifyContent:'center', color:editEmpForm.color??'#6C47FF' }}><User size={10}/></div>
                  {lang==='fr'?'IDENTITÉ':'IDENTITY'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <ViewField label={lang==='fr'?'NOM COMPLET *':'FULL NAME *'} value={editEmpForm.name??''} editing={empEditMode}>
                    <ValidatedInput type="name" required autoFocus
                      value={editEmpForm.name??''}
                      onChange={val => setEditEmpForm((f:any) => ({ ...f, name:val }))}
                      placeholder="Aminata Diallo" lang={lang} />
                  </ViewField>
                  <ViewField label={lang==='fr'?'POSTE *':'POSITION *'} value={editEmpForm.role??''} editing={empEditMode}>
                    <input className="input" placeholder={lang==='fr'?'Ex: Caissière':'Ex: Cashier'} value={editEmpForm.role??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, role:e.target.value }))} />
                  </ViewField>
                </div>
              </div>

              {/* Contrat */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(255,149,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc)' }}><FileText size={10}/></div>
                  {lang==='fr'?'CONTRAT':'CONTRACT'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <ViewField label={lang==='fr'?'DÉPARTEMENT':'DEPARTMENT'} value={editEmpForm.dept??''} editing={empEditMode}>
                    <select className="input" value={editEmpForm.dept??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, dept:e.target.value }))}>
                      {Object.keys(DEPT_COLORS).map(d => <option key={d}>{d}</option>)}
                    </select>
                  </ViewField>
                  <ViewField label={lang==='fr'?'TYPE CONTRAT':'CONTRACT TYPE'} value={editEmpForm.type??'CDI'} editing={empEditMode}>
                    <select className="input" value={editEmpForm.type??'CDI'} onChange={e => setEditEmpForm((f:any) => ({ ...f, type:e.target.value }))}>
                      {['CDI','CDD','Temps partiel','Stage','Freelance'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </ViewField>
                  <ViewField label={lang==='fr'?'DATE EMBAUCHE':'HIRE DATE'} value={displayDate(editEmpForm.hiredAt)} editing={empEditMode}>
                    <input className="input" type="date" value={editEmpForm.hiredAt ?? ''} onChange={e => setEditEmpForm((f:any) => ({ ...f, hiredAt:e.target.value }))} />
                  </ViewField>
                  {editEmpForm.type === 'CDI' ? (
                    <ViewField label={lang==='fr'?'FIN DE CONTRAT':'CONTRACT END'} value={lang==='fr'?'∞ Indéterminé':'∞ Permanent'} color="var(--acc2)" editing={empEditMode}>
                      <div style={{ padding:'10px 14px', background:'rgba(0,208,132,.06)', border:'1px solid rgba(0,208,132,.12)', borderRadius:12, fontSize:13, color:'var(--acc2)', fontWeight:600 }}>
                        ∞ {lang==='fr'?'Contrat à durée indéterminée':'Permanent contract'}
                      </div>
                    </ViewField>
                  ) : (
                    <ViewField label={lang==='fr'?'FIN DE CONTRAT':'CONTRACT END'} value={displayDate(editEmpForm.contractEnd)} editing={empEditMode}>
                      <input className="input" type="date" value={editEmpForm.contractEnd??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, contractEnd:e.target.value }))} />
                    </ViewField>
                  )}
                </div>
              </div>

              {/* Rémunération */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(0,208,132,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc2)' }}><DollarSign size={10}/></div>
                  {lang==='fr'?'RÉMUNÉRATION':'COMPENSATION'}
                </div>
                <ViewField
                  label={lang==='fr'?`SALAIRE MENSUEL BRUT (${currency})`:`MONTHLY GROSS SALARY (${currency})`}
                  value={fmt(+salaryInput > 0 ? toXOF(+salaryInput) : (selectedEmp?.salary ?? 0))}
                  mono
                  editing={empEditMode}>
                  <div style={{ position:'relative' }}>
                    <input className="input" type="number" placeholder="0"
                      value={salaryInput}
                      onChange={e => setSalaryInput(e.target.value)}
                      style={{ paddingRight:60 }} />
                    <span style={{ position:'absolute', right:12, bottom:10, fontSize:11, fontWeight:700, color:'var(--text3)', pointerEvents:'none' }}>
                      {currencySymbol}
                    </span>
                  </div>
                </ViewField>
                {+salaryInput > 0 && (() => {
                  const salaryXOF = toXOF(+salaryInput)
                  const cnss = Math.round(salaryXOF * 0.08)
                  const ir   = Math.round(salaryXOF * 0.05)
                  const net  = salaryXOF - cnss - ir
                  return (
                    <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', gap:16, flexWrap:'wrap' }}>
                      <span>CNSS (8%): <strong style={{color:'var(--danger)'}}>− {fmt(cnss)}</strong></span>
                      <span>IR (5%): <strong style={{color:'var(--acc)'}}>− {fmt(ir)}</strong></span>
                      <span>Net: <strong style={{color:'var(--acc2)'}}>{fmt(net)}</strong></span>
                    </div>
                  )
                })()}
              </div>

              {/* Contact */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(0,184,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc3)' }}><User size={10}/></div>
                  {lang==='fr'?'CONTACT':'CONTACT'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <ViewField label={lang==='fr'?'TÉLÉPHONE':'PHONE'} value={editEmpForm.phone||''} icon="📞" editing={empEditMode}>
                    <PhoneInputWithCountry
                      value={editEmpForm.phone??''}
                      onChange={val => setEditEmpForm((f:any) => ({ ...f, phone:val }))}
                      lang={lang}
                    />
                  </ViewField>
                  <ViewField label="EMAIL" value={editEmpForm.email||''} icon="✉️" editing={empEditMode}>
                    <ValidatedInput type="email"
                      value={editEmpForm.email??''}
                      onChange={val => setEditEmpForm((f:any) => ({ ...f, email:val }))}
                      placeholder="nom@email.com" lang={lang} />
                  </ViewField>
                  {empEditMode ? (
                    <div style={{ gridColumn:'1/-1' }}>
                      <AddressAutocompleteInput
                        label={lang==='fr' ? 'ADRESSE' : 'ADDRESS'}
                        value={editEmpForm.address ?? ''}
                        onChange={val => setEditEmpForm((f:any) => ({ ...f, address: val }))}
                        lang={lang}
                      />
                    </div>
                  ) : (
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                        {lang==='fr' ? 'ADRESSE' : 'ADDRESS'}
                      </label>
                      <div style={{ padding:'9px 13px', background:'transparent', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, fontSize:13, color:'var(--text2)', minHeight:40, display:'flex', alignItems:'center', gap:8 }}>
                        <MapPin size={13} style={{ opacity:.7, flexShrink:0, color:'var(--text3)' }} />
                        <span>
                          {editEmpForm.address?.trim()
                            ? editEmpForm.address
                            : <span style={{ color:'var(--text4)', fontStyle:'italic', fontSize:12 }}>{lang==='fr' ? 'Non renseignée' : 'Not provided'}</span>
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(255,184,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFB800' }}><Star size={10}/></div>
                  PERFORMANCE
                </div>
                {empEditMode ? (
                  <div style={{ display:'flex', gap:4 }}>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button"
                        onClick={() => setEditEmpForm((f:any) => ({ ...f, perf:s }))}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', color: s<=(editEmpForm.perf??3) ? '#FFB800' : 'var(--border)', display:'flex', alignItems:'center' }}>
                        <Star size={22} fill={s<=(editEmpForm.perf??3) ? '#FFB800' : 'none'} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={16} style={{ color: s<=(editEmpForm.perf??3) ? '#FFB800' : 'var(--border)' }} fill={s<=(editEmpForm.perf??3) ? '#FFB800' : 'none'} />
                    ))}
                    <span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>{editEmpForm.perf??3}/5</span>
                  </div>
                )}
              </div>

              {/* Couleur avatar — visible uniquement en édition */}
              {empEditMode && (
                <div>
                  <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:16, height:16, borderRadius:4, background:'rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--p2)' }}><Pencil size={10}/></div>
                    {lang==='fr'?'COULEUR AVATAR':'AVATAR COLOR'}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['#6C47FF','#00B8FF','#00D084','#FF9500','#FF3B5C','#F472B6','#A991FF','#FFB800'].map(col => (
                      <button key={col} type="button"
                        onClick={() => setEditEmpForm((f:any) => ({ ...f, color:col }))}
                        style={{ width:28, height:28, borderRadius:'50%', background:col, border:'3px solid', borderColor: editEmpForm.color===col?'#fff':'transparent', cursor:'pointer', padding:0, boxShadow: editEmpForm.color===col?`0 0 0 3px ${col}`:'none', transition:'all .15s' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,.06)', background:'rgba(0,0,0,.2)', flexShrink:0, display:'flex', gap:8 }}>
              {!empEditMode ? (
                <>
                  <button onClick={() => setEmpEditMode(true)}
                    style={{ flex:1, padding:'12px', background:'linear-gradient(135deg,var(--p),var(--p2))', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'var(--sh-p)' }}>
                    ✏️ {lang==='fr'?'Modifier':'Edit'}
                  </button>
                  <button onClick={() => setShowEditEmpModal(false)}
                    style={{ padding:'12px 18px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, cursor:'pointer', color:'var(--text2)', fontSize:13, fontFamily:'var(--font)', fontWeight:600 }}>
                    {lang==='fr'?'Fermer':'Close'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      if (!editEmpForm.name?.trim()) { toast.error(lang==='fr'?'Nom requis':'Name required'); return }
                      const avatar = (editEmpForm.name||'??').split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase()
                      const salaryXOF = toXOF(+salaryInput || 0)
                      const data = { ...editEmpForm, avatar, salary: Math.round(salaryXOF) }
                      try {
                        await employeesApi.update(String(selectedEmp!.id), {
                          ...data,
                          hiredAt: data.hiredAt ? new Date(data.hiredAt).toISOString() : undefined,
                        })
                        setEmployees((prev: Employee[]) => prev.map(e => e.id===selectedEmp!.id ? {...e, ...data, avatar} : e))
                        toast.success('✅ '+(lang==='fr'?'Sauvegardé !':'Saved!'))
                      } catch {
                        setEmployees((prev: Employee[]) => prev.map(e => e.id===selectedEmp!.id ? {...e, ...data, avatar} : e))
                        toast.success('✅ Local')
                      }
                      setEmpEditMode(false)
                      setShowEditEmpModal(false)
                    }}
                    style={{ flex:1, padding:'12px', background:`linear-gradient(135deg,${editEmpForm.color??'#6C47FF'},${editEmpForm.color??'#6C47FF'}BB)`, border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    ✅ {lang==='fr'?'Sauvegarder':'Save'}
                  </button>
                  <button onClick={() => { openEditModal(selectedEmp!) }}
                    style={{ padding:'12px 16px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, cursor:'pointer', color:'var(--text2)', fontSize:13, fontFamily:'var(--font)', fontWeight:600 }}>
                    {lang==='fr'?'Annuler':'Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(lang==='fr'?`Supprimer ${selectedEmp!.name} ?`:`Delete ${selectedEmp!.name}?`)) return
                      setEmployees((prev: Employee[]) => prev.filter(e=>e.id!==selectedEmp!.id))
                      setShowEditEmpModal(false)
                      toast.success(lang==='fr'?'Supprimé':'Deleted')
                    }}
                    style={{ width:44, padding:'12px', background:'rgba(255,59,92,.1)', border:'1px solid rgba(255,59,92,.2)', borderRadius:12, cursor:'pointer', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={16}/></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LEAVE REQUEST ── */}
      {/* ── MODAL NOUVEAU CONTRAT ── */}
      {showNewContractModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget&&setShowNewContractModal(false)}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--sh-xl)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--text)' }}>📄 {lang==='fr'?'Nouveau contrat':'New contract'}</h3>
              <button onClick={()=>setShowNewContractModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={18}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>{lang==='fr'?'NOM DE L\'EMPLOYÉ':'EMPLOYEE NAME'}</label>
                <input className="input" placeholder={lang==='fr'?'Aminata Diallo':'Employee name'} value={contractForm.empId} onChange={e=>setContractForm(f=>({...f,empId:e.target.value}))}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>{lang==='fr'?'POSTE':'POSITION'}</label>
                  <input className="input" placeholder={lang==='fr'?'Ex: Caissière':'Ex: Cashier'} value={contractForm.role} onChange={e=>setContractForm(f=>({...f,role:e.target.value}))}/>
                </div>
                <div>
                  <label style={labelStyle}>{lang==='fr'?'DÉPARTEMENT':'DEPARTMENT'}</label>
                  <select className="input" value={contractForm.dept} onChange={e=>setContractForm(f=>({...f,dept:e.target.value}))}>
                    {Object.keys(DEPT_COLORS).map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{lang==='fr'?'TYPE CONTRAT':'CONTRACT TYPE'}</label>
                  <select className="input" value={contractForm.type} onChange={e=>setContractForm(f=>({...f,type:e.target.value}))}>
                    {['CDI','CDD','Temps partiel','Stage','Freelance'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{lang==='fr'?'DATE DÉBUT':'START DATE'}</label>
                  <input className="input" type="date" value={contractForm.hiredAt} onChange={e=>setContractForm(f=>({...f,hiredAt:e.target.value}))}/>
                </div>
                {contractForm.type==='CDD'&&(
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={labelStyle}>{lang==='fr'?'DATE FIN CONTRAT':'CONTRACT END DATE'}</label>
                    <input className="input" type="date" value={contractForm.contractEnd} onChange={e=>setContractForm(f=>({...f,contractEnd:e.target.value}))}/>
                  </div>
                )}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelStyle}>{lang==='fr'?'SALAIRE BRUT':'GROSS SALARY'}</label>
                  <div style={{ position:'relative' }}>
                    <input className="input" type="number" placeholder="150000" value={contractForm.salary||''} onChange={e=>setContractForm(f=>({...f,salary:+e.target.value}))} style={{ paddingRight:60 }}/>
                    <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:11, fontWeight:700, color:'var(--text3)', pointerEvents:'none' }}>FCFA</span>
                  </div>
                  {contractForm.salary>0&&(
                    <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', gap:12 }}>
                      <span>CNSS: <strong style={{color:'var(--danger)'}}>−{fmt(Math.round(contractForm.salary*0.08))}</strong></span>
                      <span>Net: <strong style={{color:'var(--acc2)'}}>{fmt(Math.round(contractForm.salary*0.87))}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button className="btn" style={{ flex:1 }} onClick={()=>setShowNewContractModal(false)}>{lang==='fr'?'Annuler':'Cancel'}</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{
                if (!contractForm.empId.trim()||!contractForm.role.trim()) {
                  toast.error(lang==='fr'?'Nom et poste requis':'Name and position required'); return
                }
                const newEmp: Employee = {
                  id: Date.now(),
                  name: contractForm.empId.trim(),
                  role: contractForm.role,
                  dept: contractForm.dept,
                  salary: contractForm.salary,
                  type: contractForm.type as 'CDI'|'CDD',
                  hiredAt: contractForm.hiredAt ? new Date(contractForm.hiredAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
                  endAt: contractForm.type==='CDD'&&contractForm.contractEnd ? new Date(contractForm.contractEnd).toLocaleDateString('fr-FR') : undefined,
                  avatar: contractForm.empId.trim().split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase(),
                  color: COLORS[employees.length % COLORS.length],
                  active: true, phone:'', email:'', perf:3,
                }
                setEmployees(prev=>[...prev, newEmp])
                toast.success('✅ '+(lang==='fr'?'Contrat créé !':'Contract created!'))
                setShowNewContractModal(false)
              }}>✅ {lang==='fr'?'Créer le contrat':'Create contract'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAIL CONTRAT ── */}
      {showContractDetailModal && selectedContract && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget&&setShowContractDetailModal(false)}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:480, boxShadow:'var(--sh-xl)', overflow:'hidden' }}>
            <div style={{ padding:'24px 24px 20px', background:`linear-gradient(135deg,${selectedContract.color}18,${selectedContract.color}05)`, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:56, height:56, borderRadius:16, overflow:'hidden', background:`linear-gradient(135deg,${selectedContract.color},${selectedContract.color}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff', flexShrink:0, boxShadow:`0 6px 20px ${selectedContract.color}50` }}>
                  {selectedContract.photoUrl
                    ? <img src={selectedContract.photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : selectedContract.avatar}
                </div>
                <div style={{ flex:1 }}>
                  <h3 style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--text)' }}>{selectedContract.name}</h3>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>{selectedContract.role} · {selectedContract.dept}</div>
                </div>
                <button onClick={()=>setShowContractDetailModal(false)} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, width:32, height:32, cursor:'pointer', color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✕</button>
              </div>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', gap:8 }}>
                <span style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, background:selectedContract.type==='CDI'?'rgba(108,71,255,.15)':'rgba(14,196,126,.12)', color:selectedContract.type==='CDI'?'var(--p2)':'var(--acc2)' }}>{selectedContract.type}</span>
                <span style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, background:selectedContract.active?'rgba(0,208,132,.12)':'var(--bg3)', color:selectedContract.active?'var(--acc2)':'var(--text3)' }}>
                  {selectedContract.active?(lang==='fr'?'Actif':'Active'):(lang==='fr'?'Inactif':'Inactive')}
                </span>
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  {label:lang==='fr'?'Date d\'embauche':'Hire date', value:displayDate(selectedContract.hiredAt, lang==='fr'?'fr-FR':'en-US')},
                  {label:lang==='fr'?'Ancienneté':'Seniority', value:calcAnciennete(selectedContract.hiredAt)},
                  ...(selectedContract.type!=='CDI'&&selectedContract.endAt
                    ? [{label:lang==='fr'?'Fin de contrat':'Contract end', value:displayDate(selectedContract.endAt, lang==='fr'?'fr-FR':'en-US')}]
                    : selectedContract.type==='CDI'
                      ? [{label:lang==='fr'?'Fin de contrat':'Contract end', value:lang==='fr'?'∞ Indéterminé':'∞ Permanent'}]
                      : []
                  ),
                ].map(row=>(
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>{row.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:'var(--mono)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:12, padding:16 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:12 }}>💰 {lang==='fr'?'RÉMUNÉRATION':'COMPENSATION'}</div>
                {[
                  {label:lang==='fr'?'Salaire brut':'Gross salary', value:fmt(selectedContract.salary), color:'var(--text)'},
                  {label:'CNSS (8%)', value:`− ${fmt(Math.round(selectedContract.salary*0.08))}`, color:'var(--danger)'},
                  {label:'IR (5%)', value:`− ${fmt(Math.round(selectedContract.salary*0.05))}`, color:'var(--acc)'},
                  {label:lang==='fr'?'Net à payer':'Net salary', value:fmt(Math.round(selectedContract.salary*0.87)), color:'var(--acc2)'},
                ].map(row=>(
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>{row.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:row.color, fontFamily:'var(--mono)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,.06)', background:'rgba(0,0,0,.15)', display:'flex', gap:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{
                openEditModal(selectedContract)
                setShowContractDetailModal(false)
              }}>✏️ {lang==='fr'?'Modifier':'Edit'}</button>
              <button className="btn" style={{ padding:'10px 16px' }} onClick={()=>setShowContractDetailModal(false)}>{lang==='fr'?'Fermer':'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLeaveModal(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                🌴 {lang === 'fr' ? 'Nouvelle demande' : 'New request'}
              </h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>{lang === 'fr' ? 'EMPLOYÉ' : 'EMPLOYEE'}</label>
                <select className="input" style={{ width: '100%' }}
                  value={leaveForm.empId}
                  onChange={e => setLeaveForm(f => ({ ...f, empId: Number(e.target.value) }))}>
                  <option value={0}>{lang === 'fr' ? 'Sélectionner...' : 'Select...'}</option>
                  {(employees ?? []).filter(e => e.active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{lang === 'fr' ? 'TYPE DE CONGÉ' : 'LEAVE TYPE'}</label>
                <select className="input" style={{ width: '100%' }}
                  value={leaveForm.type}
                  onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}>
                  {[
                    lang === 'fr' ? 'Congé annuel'        : 'Annual leave',
                    lang === 'fr' ? 'Congé maladie'       : 'Sick leave',
                    lang === 'fr' ? 'Formation'           : 'Training',
                    lang === 'fr' ? 'Personnel'           : 'Personal',
                    lang === 'fr' ? 'Maternité/Paternité' : 'Parental leave',
                  ].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{lang === 'fr' ? 'DU' : 'FROM'}</label>
                  <input className="input" type="date" style={{ width: '100%', boxSizing: 'border-box' }}
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>{lang === 'fr' ? 'AU' : 'TO'}</label>
                  <input className="input" type="date" style={{ width: '100%', boxSizing: 'border-box' }}
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>NOTES / MOTIF</label>
                <textarea className="input" rows={2} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  placeholder={lang === 'fr' ? 'Motif, justificatif...' : 'Reason, justification...'}
                  value={leaveForm.notes}
                  onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowLeaveModal(false)}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => {
                  if (!leaveForm.empId || !leaveForm.endDate) {
                    toast.error(lang === 'fr' ? 'Employé et dates requis' : 'Employee and dates required')
                    return
                  }
                  const emp = (employees ?? []).find(e => e.id === leaveForm.empId)
                  const start = new Date(leaveForm.startDate)
                  const end   = new Date(leaveForm.endDate)
                  const days  = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                  setLeaves(prev => [...prev, {
                    id: Date.now(),
                    empId: leaveForm.empId,
                    type: leaveForm.type,
                    from: leaveForm.startDate,
                    to: leaveForm.endDate,
                    days,
                    motif: leaveForm.notes,
                    status: 'pending',
                  }])
                  toast.success('✅ ' + (lang === 'fr' ? 'Demande soumise !' : 'Request submitted!'))
                  setShowLeaveModal(false)
                }}>
                ✅ {lang === 'fr' ? 'Soumettre' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal Employee ───────────────────────────────────────────────────────────

function EmpModal({ emp, onClose, onSave, onDelete }: {
  emp: Employee | null
  onClose: () => void
  onSave: (data: any) => void
  onDelete?: (id: number) => void
}) {
  const toXOF   = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
  const { code, symbol, decimals } = useCurrencyInfo()
  const lang = useAppStore(s => s.lang)
  const T = (fr: string, en: string, es: string, it: string) =>
    lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it

  const [name, setName]       = useState(emp?.name ?? '')
  const [role, setRole]       = useState(emp?.role ?? '')
  const [dept, setDept]       = useState(emp?.dept ?? '')
  const [salary, setSalary]   = useState(emp?.salary != null ? fromXOF(emp.salary).toFixed(decimals) : '')
  const [type, setType]       = useState<'CDI'|'CDD'>(emp?.type ?? 'CDI')
  const [hiredAt, setHiredAt] = useState(emp?.hiredAt ?? '')
  const [endAt, setEndAt]     = useState(emp?.endAt ?? '')
  const [phone, setPhone]     = useState(emp?.phone ?? '')
  const [email, setEmail]     = useState(emp?.email ?? '')
  const [color, setColor]     = useState(emp?.color ?? COLORS[0])
  const [active, setActive]   = useState(emp?.active ?? true)
  const [perf, setPerf]       = useState(emp?.perf ?? 3)

  const deptColor = DEPT_COLORS[dept] ?? color

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20,
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--sh-xl)',
      }}>
        {/* Fixed header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {emp && (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `linear-gradient(135deg, ${color}, ${color}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {emp.avatar}
              </div>
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>
                {emp ? emp.name : `➕ ${T('Nouvel employé', 'New employee', 'Nuevo empleado', 'Nuovo dipendente')}`}
              </h3>
              {emp && <div style={{ fontSize: 11, color: deptColor, fontWeight: 600, marginTop: 1 }}>{dept || emp.dept}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {emp && onDelete && (
              <button onClick={() => onDelete(emp.id)} style={{ background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.25)', borderRadius: 8, cursor: 'pointer', color: 'var(--danger)', padding: '6px 10px', fontSize: 14 }}>
                🗑
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ValidatedInput type="name" required autoFocus label={T('Nom complet *', 'Full name *', 'Nombre completo *', 'Nome completo *')}
              value={name} onChange={setName} placeholder="Prénom Nom" />
            <ValidatedInput type="text" required label={T('Poste *', 'Position *', 'Puesto *', 'Posizione *')}
              value={role} onChange={setRole} placeholder="Ex: Caissière" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">{T('Département', 'Department', 'Departamento', 'Dipartimento')}</label>
              <input className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder="Ex: Ventes" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="form-label">{T('Contrat', 'Contract', 'Contrato', 'Contratto')}</label>
              <select className="input" value={type} onChange={e => setType(e.target.value as 'CDI'|'CDD')} style={{ width: '100%' }}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">{T('Salaire brut', 'Gross salary', 'Salario bruto', 'Stipendio lordo')} ({code})</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder={code === 'XOF' || code === 'XAF' ? '350000' : '500'} style={{ width: '100%', boxSizing: 'border-box', paddingRight: 50 }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--acc2)', fontSize: 12, fontWeight: 800, pointerEvents: 'none' }}>{symbol}</span>
            </div>
            {salary && code !== 'XOF' && code !== 'XAF' && (
              <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 4 }}>
                <span>≈</span>
                <span style={{ color: 'var(--acc2)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.round(toXOF(Number(salary) || 0)).toLocaleString('fr-FR')} XOF</span>
                <span>{T('en base', 'stored', 'en base', 'in base')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">{T("Date d'embauche", 'Hire date', 'Fecha de contratación', 'Data di assunzione')}</label>
              <input className="input" value={hiredAt} onChange={e => setHiredAt(e.target.value)} placeholder="JJ/MM/AAAA" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            {type === 'CDD' && (
              <div>
                <label className="form-label">{T('Fin de contrat', 'Contract end', 'Fin de contrato', 'Fine contratto')}</label>
                <input className="input" value={endAt} onChange={e => setEndAt(e.target.value)} placeholder="JJ/MM/AAAA" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}
          </div>

          <PhoneInputWithCountry
            label="TÉLÉPHONE"
            value={phone}
            onChange={setPhone}
          />

          <ValidatedInput type="email" label="Email"
            value={email} onChange={setEmail}
            placeholder="prenom@boutique.com" />

          <div>
            <label className="form-label">{T('Performance', 'Performance', 'Rendimiento', 'Prestazione')}</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setPerf(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: star <= perf ? '#F59E0B' : 'var(--border2)', padding: '2px 3px', lineHeight: 1 }}>★</button>
              ))}
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>{perf}/5</span>
            </div>
          </div>

          {emp && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{T('Statut employé', 'Employee status', 'Estado del empleado', 'Stato dipendente')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{active ? T('Employé actif', 'Active employee', 'Empleado activo', 'Dipendente attivo') : T('Employé inactif', 'Inactive employee', 'Empleado inactivo', 'Dipendente inattivo')}</div>
              </div>
              <button onClick={() => setActive(a => !a)} style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: '1px solid',
                background: active ? 'rgba(14,196,126,.12)' : 'rgba(232,64,74,.1)',
                color: active ? 'var(--acc2)' : 'var(--danger)',
                borderColor: active ? 'rgba(14,196,126,.3)' : 'rgba(232,64,74,.25)',
              }}>
                {active ? `✓ ${T('Actif', 'Active', 'Activo', 'Attivo')}` : `✗ ${T('Inactif', 'Inactive', 'Inactivo', 'Inattivo')}`}
              </button>
            </div>
          )}

          <div>
            <label className="form-label">{T("Couleur d'avatar", 'Avatar color', 'Color de avatar', 'Colore avatar')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2, transition: 'all .15s', transform: color === c ? 'scale(1.2)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>

        </div>

        {/* Fixed footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{T('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => {
              if (!name.trim() || !role.trim()) { toast.error(T('Nom et poste requis', 'Name and position required', 'Nombre y puesto requeridos', 'Nome e posizione richiesti')); return }
              onSave({ name, role, dept, salary: toXOF(Number(salary) || 0), type, hiredAt, endAt: endAt || undefined, phone, email, color, active, perf })
            }}>
            {emp ? `💾 ${T('Enregistrer', 'Save', 'Guardar', 'Salva')}` : `➕ ${T('Ajouter', 'Add', 'Agregar', 'Aggiungi')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SalaryRaiseForm ──────────────────────────────────────────────────────────

function SalaryRaiseForm({ emp, lang, fmt, onConfirm, onClose }: any) {
  const fromXOF = useConvertFromXOF()
  const toXOF   = useConvertToXOF()
  const { currency, symbol, decimals } = useCurrencyInfo()

  const oldSalaryXOF = Number(emp.salary) || 0
  const [newSalaryInput, setNewSalaryInput] = useState(
    fromXOF(oldSalaryXOF).toFixed(decimals)
  )
  const [reason, setReason] = useState('')

  const newSalaryXOF = toXOF(+newSalaryInput || 0)
  const diff = newSalaryXOF - oldSalaryXOF
  const pct  = oldSalaryXOF > 0 ? Math.round((diff / oldSalaryXOF) * 100) : 0

  const lbl: React.CSSProperties = { display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Salaire actuel — affiché en devise courante via fmt() */}
      <div style={{ padding:'12px 16px', background:'rgba(108,71,255,.06)', border:'1px solid rgba(108,71,255,.12)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text2)' }}>{lang==='fr' ? 'Salaire actuel' : 'Current salary'}</span>
        <span style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:16, color:'var(--text)' }}>{fmt(oldSalaryXOF)}</span>
      </div>
      <div>
        <label style={lbl}>{lang==='fr' ? `NOUVEAU SALAIRE (${currency})` : `NEW SALARY (${currency})`}</label>
        <div style={{ position:'relative' }}>
          <ValidatedInput type="amount"
            value={newSalaryInput}
            onChange={setNewSalaryInput}
            placeholder="0"
            min={0}
            decimals={decimals}
            lang={lang}
            style={{ paddingRight: 40 }}
            autoFocus
          />
          <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:12, pointerEvents:'none', fontWeight:600 }}>{symbol}</span>
        </div>
        {newSalaryInput && +newSalaryInput > 0 && (
          <div style={{ marginTop:6, fontSize:11, display:'flex', gap:10, flexWrap:'wrap' }}>
            <span style={{ color:'var(--text3)' }}>
              {lang==='fr' ? 'Différence' : 'Difference'}{': '}
              <strong style={{ color: diff >= 0 ? 'var(--acc2)' : 'var(--danger)' }}>
                {diff >= 0 ? '+' : ''}{fmt(Math.abs(diff))} ({pct >= 0 ? '+' : ''}{pct}%)
              </strong>
            </span>
          </div>
        )}
      </div>
      <div>
        <label style={lbl}>{lang==='fr' ? 'MOTIF' : 'REASON'}</label>
        <input className="input" placeholder={lang==='fr' ? 'Ex: Promotion, Ancienneté...' : 'Ex: Promotion, Seniority...'} value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={() => {
          if (!newSalaryInput || +newSalaryInput <= 0) return
          onConfirm(newSalaryXOF, reason || 'Augmentation')
        }}>
          ✅ {lang==='fr' ? 'Confirmer' : 'Confirm'}
        </button>
        <button className="btn" style={{ padding:'10px 14px' }} onClick={onClose}>{lang==='fr' ? 'Annuler' : 'Cancel'}</button>
      </div>
    </div>
  )
}

// ─── BonusForm ──────────────────────────────────────────────────────────────────

function BonusForm({ emp, employees, lang, fmt, onConfirm, onClose }: any) {
  const toXOF  = useConvertToXOF()
  const { currency, symbol } = useCurrencyInfo()

  const [targetEmpId, setTargetEmpId] = useState(emp?.id != null ? String(emp.id) : 'all')
  const [amountInput, setAmountInput] = useState('')
  const [type, setType]               = useState('Performance')

  const amountXOF = toXOF(+amountInput || 0)

  const BONUS_TYPES: Record<string, string[]> = {
    fr:['Performance','Ancienneté','Fête','Transport','Logement','Autre'],
    en:['Performance','Seniority','Holiday','Transport','Housing','Other'],
    es:['Rendimiento','Antigüedad','Festivo','Transporte','Vivienda','Otro'],
    it:['Prestazione','Anzianità','Festività','Trasporto','Alloggio','Altro'],
  }
  const bTypes = BONUS_TYPES[lang] ?? BONUS_TYPES.fr
  const lbl: React.CSSProperties = { display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label style={lbl}>{lang==='fr' ? 'BÉNÉFICIAIRE' : 'RECIPIENT'}</label>
        <select className="input" value={targetEmpId} onChange={e => setTargetEmpId(e.target.value)}>
          <option value="all">🌍 {lang==='fr' ? "Toute l'équipe" : 'All team'}</option>
          {employees.map((e: any) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>{lang==='fr' ? 'TYPE DE PRIME' : 'BONUS TYPE'}</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {bTypes.map((t: string) => (
            <button key={t} type="button" onClick={() => setType(t)} style={{
              padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)',
              background: type===t ? 'rgba(0,208,132,.15)' : 'var(--bg4)',
              border:`1px solid ${type===t ? 'rgba(0,208,132,.3)' : 'var(--border)'}`,
              color: type===t ? 'var(--acc2)' : 'var(--text3)',
              transition:'all .12s',
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <label style={lbl}>{lang==='fr' ? `MONTANT (${currency})` : `AMOUNT (${currency})`}</label>
        <div style={{ position:'relative' }}>
          <ValidatedInput type="amount"
            value={amountInput}
            onChange={setAmountInput}
            placeholder="0"
            min={0}
            lang={lang}
          />
          <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:12, pointerEvents:'none', fontWeight:600 }}>{symbol}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={() => {
          if (!amountInput || +amountInput <= 0) return
          onConfirm(targetEmpId, amountXOF, type)
        }}>
          ✅ {lang==='fr' ? 'Ajouter la prime' : 'Add bonus'}
        </button>
        <button className="btn" style={{ padding:'10px 14px' }} onClick={onClose}>{lang==='fr' ? 'Annuler' : 'Cancel'}</button>
      </div>
    </div>
  )
}

// ─── AddressInputSimple ───────────────────────────────────────────────────────
// Input adresse interne HR — toujours éditable, autocomplete Google optionnel

function AddressInputSimple({
  value,
  onChange,
  lang = 'fr',
}: {
  value: string
  onChange: (v: string) => void
  lang?: string
}) {
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [show, setShow]               = React.useState(false)
  const [focused, setFocused]         = React.useState(false)
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string

  const fetchSuggestions = React.useCallback((input: string) => {
    if (!input || input.length < 3) { setSuggestions([]); return }
    const google = (window as any).google
    if (!google?.maps?.places?.AutocompleteService) return
    const svc = new google.maps.places.AutocompleteService()
    svc.getPlacePredictions(
      { input, types: ['address'], language: lang },
      (preds: any[] | null) => {
        setSuggestions((preds ?? []).slice(0, 5).map((p: any) => p.description))
      }
    )
  }, [lang])

  React.useEffect(() => {
    if (!apiKey) return
    if ((window as any).google?.maps?.places) return
    if (document.querySelector('script[data-gm]')) return
    const script = document.createElement('script')
    script.setAttribute('data-gm', '1')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${lang}`
    script.async = true
    document.head.appendChild(script)
  }, [apiKey])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg4)',
        border: `1.5px solid ${focused ? 'var(--p)' : 'var(--border)'}`,
        borderRadius: 12,
        transition: 'border-color .15s',
      }}>
        <MapPin size={14} style={{ padding:'0 6px 0 12px', flexShrink:0, color: focused ? 'var(--p2)' : 'var(--text3)', pointerEvents:'none', transition:'color .15s', marginLeft:12 }} />
        <input
          type="text"
          autoComplete="off"
          style={{
            flex: 1, background: 'transparent',
            border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 13,
            padding: '10px 12px 10px 4px',
            fontFamily: 'var(--font)',
          }}
          placeholder={lang === 'fr' ? 'Adresse complète...' : 'Full address...'}
          value={value}
          onFocus={() => { setFocused(true); setShow(true) }}
          onBlur={() => { setFocused(false); setTimeout(() => setShow(false), 200) }}
          onChange={e => {
            onChange(e.target.value)
            fetchSuggestions(e.target.value)
            setShow(true)
          }}
        />
        {value && (
          <button type="button" tabIndex={-1}
            onClick={() => { onChange(''); setSuggestions([]) }}
            style={{ padding:'0 10px', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text3)', flexShrink:0 }}>
            ✕
          </button>
        )}
      </div>

      {show && suggestions.length > 0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          zIndex:9999, background:'#0D0D1C',
          border:'1px solid rgba(255,255,255,.1)',
          borderRadius:10, overflow:'hidden',
          boxShadow:'0 8px 32px rgba(0,0,0,.8)',
        }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={() => { onChange(s); setSuggestions([]); setShow(false) }}
              style={{
                display:'flex', alignItems:'center', gap:8,
                width:'100%', padding:'9px 14px',
                background:'transparent', border:'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                cursor:'pointer', textAlign:'left',
                fontFamily:'var(--font)', fontSize:12, color:'var(--text)',
                transition:'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <MapPin size={12} style={{ flexShrink:0, color:'var(--text3)' }} />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
