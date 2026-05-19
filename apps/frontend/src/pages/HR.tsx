import { useState, useMemo, useEffect } from 'react'
import { useFormatAmount, useAppStore } from '@/stores/appStore'
import { employeesApi } from '@/lib/api'
import { exportCSV } from '@/utils/export'
import { Download, Plus, X } from 'lucide-react'
import PhoneInput from '@/components/ui/PhoneInput'
import toast from 'react-hot-toast'

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
}

interface LeaveRequest {
  id: number
  empId: number
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
  { id:1, empId:5, type:'Congé annuel',  from:'2026-05-11', to:'2026-05-17', days:5, motif:'Repos annuel planifié', status:'approved' },
  { id:2, empId:1, type:'Congé maladie', from:'2026-04-02', to:'2026-04-03', days:2, motif:'Grippe',                status:'approved' },
  { id:3, empId:3, type:'Congé annuel',  from:'2026-03-15', to:'2026-03-19', days:3, motif:'Voyage familial',       status:'approved' },
  { id:4, empId:2, type:'Congé annuel',  from:'2026-05-20', to:'2026-05-24', days:5, motif:'Vacances famille',      status:'pending'  },
  { id:5, empId:4, type:'Congé maladie', from:'2026-05-16', to:'2026-05-16', days:1, motif:'Visite médicale',       status:'pending'  },
]

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const COLORS = ['#6C3FD6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#8B5CF6','#F472B6']

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

function calcAnciennete(hiredAt: string): string {
  const [d, m, y] = hiredAt.split('/')
  const months = Math.floor((new Date('2026-05-18').getTime() - new Date(+y, +m - 1, +d).getTime()) / (1000 * 60 * 60 * 24 * 30))
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

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
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
  const fmt = useFormatAmount()
  const { lang } = useAppStore()
  const [tab, setTab] = useState<'team'|'payroll'|'schedule'|'leaves'>('team')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('Tous')
  const [typeFilter, setTypeFilter] = useState('Tous')
  const [employees, setEmployees] = useState<Employee[]>(STATIC_EMPLOYEES)
  const [leaves, setLeaves] = useState<LeaveRequest[]>(LEAVE_INIT)
  const [showModal, setShowModal] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  // Payroll
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))

  // Planning
  const [planningWeek, setPlanningWeek] = useState(new Date())

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    empId: 0,
    type: 'Congé annuel',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: '',
  })

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
            hiredAt: e.hiredAt ?? e.startDate ?? '01/01/2024',
            endAt: e.endAt,
            avatar: (e.name ?? e.firstName ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
            color: COLORS[i % COLORS.length],
            active: e.active ?? e.status !== 'inactive',
            phone: e.phone ?? '',
            email: e.email ?? '',
            perf: e.perf ?? e.performance,
          })))
        }
      })
      .catch(() => {})
  }, [])

  const depts = useMemo(() => ['Tous', ...Array.from(new Set(employees.map(e => e.dept)))], [employees])

  const filtered = useMemo(() => (employees ?? []).filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)
    const matchDept = deptFilter === 'Tous' || e.dept === deptFilter
    const matchType = typeFilter === 'Tous' || e.type === typeFilter
    return matchSearch && matchDept && matchType
  }), [employees, search, deptFilter, typeFilter])

  const totalPayroll = useMemo(() => (employees ?? []).filter(e => e.active).reduce((s, e) => s + e.salary, 0), [employees])
  const activeCount  = useMemo(() => (employees ?? []).filter(e => e.active).length, [employees])
  const pendingLeaves = useMemo(() => (leaves ?? []).filter(l => l.status === 'pending').length, [leaves])

  // Planning week
  const weekStart = getWeekStart(planningWeek)
  const weekDays = Array(7).fill(null).map((_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  function handleLeaveAction(id: number, status: 'approved' | 'refused') {
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    toast.success(status === 'approved' ? '✅ Congé approuvé' : '❌ Congé refusé')
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            👥 {lang === 'fr' ? 'Ressources Humaines' : 'Human Resources'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '3px 0 0' }}>
            {employees.length} employés · {activeCount} actifs
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => {
            exportCSV('RH', ['Nom','Rôle','Département','Contrat','Salaire','Embauche','Statut'],
              employees.map(e => [e.name, e.role, e.dept, e.type, e.salary, e.hiredAt, e.active ? 'Actif' : 'Inactif']))
            toast.success('CSV exporté')
          }}>
            <Download size={14} /> Export
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setSelectedEmp(null); setShowModal(true) }}>
            <Plus size={14} /> {lang === 'fr' ? 'Ajouter' : 'Add'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { icon: '👥', label: 'Effectif total',    value: `${employees.length}`,    color: '#6C47FF', sub: `${activeCount} actifs` },
          { icon: '💰', label: 'Masse salariale',   value: fmt(totalPayroll),         color: '#00D084', sub: 'Ce mois' },
          { icon: '📋', label: 'Congés en attente', value: `${pendingLeaves}`,        color: pendingLeaves > 0 ? '#F0A500' : '#00D084', sub: 'à traiter' },
          { icon: '🏆', label: 'Performance moy.',  value: `${((employees ?? []).filter(e => e.perf).reduce((s, e) => s + (e.perf ?? 0), 0) / ((employees ?? []).filter(e => e.perf).length || 1)).toFixed(1)}/5`, color: '#FF9500', sub: 'Top équipe' },
        ].map(k => (
          <div key={k.label} className="panel" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{k.icon}</div>
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
          { id: 'team',     icon: '👥', label: lang === 'fr' ? 'Équipe'   : 'Team'     },
          { id: 'payroll',  icon: '💰', label: lang === 'fr' ? 'Paie'     : 'Payroll'  },
          { id: 'schedule', icon: '📅', label: lang === 'fr' ? 'Planning' : 'Schedule' },
          { id: 'leaves',   icon: '🏖️', label: lang === 'fr' ? 'Congés'   : 'Leaves'   },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 9,
            background: tab === t.id ? 'var(--card)' : 'transparent',
            border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text3)',
            fontWeight: tab === t.id ? 700 : 500,
            fontSize: 13, cursor: 'pointer', transition: 'all .15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: tab === t.id ? 'var(--sh-sm)' : 'none',
          }}>
            <span>{t.icon}</span>
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="input" placeholder="🔍 Rechercher..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <select className="input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ minWidth: 130 }}>
              {depts.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ minWidth: 110 }}>
              {['Tous','CDI','CDD'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 14 }}>
            {filtered.map((emp, index) => (
              <div key={emp.id} className="panel" style={{
                padding: 18, cursor: 'pointer',
                border: '1px solid var(--border)',
                opacity: emp.active ? 1 : 0.65,
                transition: 'all .2s',
                animation: `slideIn ${index * 0.05}s ease both`,
              }}
                onClick={() => { setSelectedEmp(emp); setShowModal(true) }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--p)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <EmpAvatar emp={emp} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{emp.role} · {emp.dept}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                      color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                    }}>{emp.type}</span>
                    {!emp.active && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)' }}>Inactif</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Ancienneté',  value: calcAnciennete(emp.hiredAt) },
                    { label: 'Heures',      value: calcHeures(emp.id) },
                    { label: 'Ponctualité', value: calcPonctualite(emp.id) + '%' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--p2)' }}>
                    {fmt(emp.salary)}<span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>/mois</span>
                  </span>
                  {emp.perf != null && <Stars v={emp.perf} />}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 14 }}>
                Aucun employé trouvé
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB PAYROLL ── */}
      {tab === 'payroll' && (
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="panel-t">💰 {lang === 'fr' ? 'Masse salariale' : 'Payroll'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input" type="month" style={{ width: 'auto' }}
                value={payrollMonth}
                onChange={e => setPayrollMonth(e.target.value)} />
              <button className="btn btn-sm" onClick={() => {
                const BOM = '﻿'
                const activeEmps = (employees ?? []).filter(e => e.active)
                const rows = [
                  ['Employé','Rôle','Département','Type','Brut','CNSS 8%','IR 5%','Net','Statut'],
                  ...activeEmps.map(emp => {
                    const brut = emp.salary
                    const cnss = Math.round(brut * 0.08)
                    const ir   = Math.round(brut * 0.05)
                    const net  = brut - cnss - ir
                    return [emp.name, emp.role, emp.dept, emp.type, brut, cnss, ir, net, 'Payé']
                  }),
                ]
                const csv = BOM + rows.map(r => r.join(';')).join('\r\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `Paie_${payrollMonth}.csv`
                a.click()
                URL.revokeObjectURL(url)
                toast.success('📊 Export paie téléchargé !')
              }}>
                <Download size={14} /> {lang === 'fr' ? 'Export CSV' : 'Export CSV'}
              </button>
              <button className="btn btn-primary btn-sm"
                onClick={() => toast.success('📄 Fiches de paie générées !')}>
                📄 {lang === 'fr' ? 'Fiches PDF' : 'Pay slips'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, paddingLeft: 2 }}>
            {new Date(payrollMonth + '-01').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}
            {' · '}<span style={{ fontWeight: 900, color: 'var(--p2)' }}>{fmt(totalPayroll)}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Poste</th>
                  <th>Contrat</th>
                  <th style={{ textAlign: 'right' }}>Salaire brut</th>
                  <th style={{ textAlign: 'right' }}>CNSS 8%</th>
                  <th style={{ textAlign: 'right' }}>IR 5%</th>
                  <th style={{ textAlign: 'right' }}>Net à payer</th>
                  <th style={{ textAlign: 'center' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {(employees ?? []).filter(e => e.active).map(emp => {
                  const cnss = Math.round(emp.salary * 0.08)
                  const ir   = Math.round(emp.salary * 0.05)
                  const net  = emp.salary - cnss - ir
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <EmpAvatar emp={emp} size={32} />
                          <span style={{ fontWeight: 700 }}>{emp.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 13 }}>{emp.role}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                          color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                        }}>{emp.type}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(emp.salary)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--danger)', fontSize: 12 }}>− {fmt(cnss)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--danger)', fontSize: 12 }}>− {fmt(ir)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 900, color: 'var(--acc2)' }}>{fmt(net)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(14,196,126,.12)', color: 'var(--acc2)' }}>✓ Payé</span>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'rgba(108,71,255,.06)', fontWeight: 900 }}>
                  <td colSpan={3} style={{ fontWeight: 900, color: 'var(--text)' }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 900 }}>{fmt(totalPayroll)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--danger)' }}>− {fmt(Math.round(totalPayroll * 0.08))}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--danger)' }}>− {fmt(Math.round(totalPayroll * 0.05))}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 900, color: 'var(--p2)' }}>{fmt(totalPayroll - Math.round(totalPayroll * 0.08) - Math.round(totalPayroll * 0.05))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB SCHEDULE ── */}
      {tab === 'schedule' && (
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="panel-t">📅 {lang === 'fr' ? 'Planning semaine' : 'Weekly schedule'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => { const d = new Date(planningWeek); d.setDate(d.getDate() - 7); setPlanningWeek(d) }}>
                ← {lang === 'fr' ? 'Préc.' : 'Prev'}
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {weekStart.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                {' – '}
                {weekDays[6].toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <button className="btn btn-sm" onClick={() => { const d = new Date(planningWeek); d.setDate(d.getDate() + 7); setPlanningWeek(d) }}>
                {lang === 'fr' ? 'Suiv.' : 'Next'} →
              </button>
              <button className="btn btn-sm" onClick={() => setPlanningWeek(new Date())}>
                {lang === 'fr' ? "Auj." : 'Today'}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', width: 160 }}>Employé</th>
                  {WEEK_DAYS.map((d, di) => (
                    <th key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      <div>{d}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginTop: 2 }}>
                        {weekDays[di].getDate()}/{weekDays[di].getMonth() + 1}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(employees ?? []).map((emp, ri) => (
                  <tr key={emp.id} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <EmpAvatar emp={emp} size={28} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{emp.name.split(' ')[0]}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{emp.role}</div>
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const pt = POINTAGE[emp.id]?.[dayIdx] ?? { status: 'repos' as const }
                      const cfg = STATUS_CFG[pt.status]
                      return (
                        <td key={dayIdx} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, background: cfg.bg, minWidth: 60 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                            {pt.arrive && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{pt.arrive}</span>}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, padding: '0 4px' }}>
            {Object.entries(STATUS_CFG).map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.bg, border: `1px solid ${cfg.color}44` }} />
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB LEAVES ── */}
      {tab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingLeaves > 0 && (
            <div style={{ padding: '14px 16px', background: 'rgba(240,165,0,.1)', border: '1px solid rgba(240,165,0,.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⏳</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)' }}>
                {pendingLeaves} demande{pendingLeaves > 1 ? 's' : ''} de congé en attente de validation
              </span>
            </div>
          )}

          <div className="panel">
            <div className="panel-h">
              <span className="panel-t">🏖️ {lang === 'fr' ? 'Demandes de congés' : 'Leave requests'}</span>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setLeaveForm({ empId: 0, type: lang === 'fr' ? 'Congé annuel' : 'Annual leave', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' })
                setShowLeaveModal(true)
              }}>
                <Plus size={14} /> {lang === 'fr' ? 'Nouvelle demande' : 'New request'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(leaves ?? []).map(leave => {
                const emp = (employees ?? []).find(e => e.id === leave.empId)
                const statusCfg = LEAVE_STATUS_CFG[leave.status]
                return (
                  <div key={leave.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
                    {emp && <EmpAvatar emp={emp} size={38} />}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{emp?.name ?? '—'}</div>
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

      {/* ── MODAL EMPLOYEE ── */}
      {showModal && (
        <EmpModal
          emp={selectedEmp}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (selectedEmp) {
              employeesApi.update(String(selectedEmp.id), data).catch(() => {})
              setEmployees(prev => prev.map(e => e.id === selectedEmp.id ? { ...e, ...data } : e))
              toast.success('✅ Employé mis à jour')
            } else {
              const newEmp: Employee = {
                ...data,
                id: Date.now(),
                avatar: data.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
                active: true,
              }
              setEmployees(prev => [...prev, newEmp])
              toast.success('✅ Employé ajouté')
            }
            setShowModal(false)
          }}
          onDelete={selectedEmp ? (id) => {
            if (window.confirm(lang === 'fr' ? 'Supprimer cet employé ?' : 'Delete this employee?')) {
              setEmployees(prev => prev.filter(e => e.id !== id))
              setShowModal(false)
              toast.success('✅ Employé supprimé')
            }
          } : undefined}
        />
      )}

      {/* ── MODAL LEAVE REQUEST ── */}
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
  const [name, setName]       = useState(emp?.name ?? '')
  const [role, setRole]       = useState(emp?.role ?? '')
  const [dept, setDept]       = useState(emp?.dept ?? '')
  const [salary, setSalary]   = useState(String(emp?.salary ?? ''))
  const [type, setType]       = useState<'CDI'|'CDD'>(emp?.type ?? 'CDI')
  const [hiredAt, setHiredAt] = useState(emp?.hiredAt ?? '')
  const [endAt, setEndAt]     = useState(emp?.endAt ?? '')
  const [phone, setPhone]     = useState(emp?.phone ?? '')
  const [email, setEmail]     = useState(emp?.email ?? '')
  const [color, setColor]     = useState(emp?.color ?? COLORS[0])
  const [active, setActive]   = useState(emp?.active ?? true)
  const [perf, setPerf]       = useState(emp?.perf ?? 3)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-xl)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
            {emp ? '✏️ Modifier l\'employé' : '➕ Nouvel employé'}
          </h3>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Nom complet *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Prénom Nom" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="form-label">Poste *</label>
              <input className="input" value={role} onChange={e => setRole(e.target.value)} placeholder="Ex: Caissière" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Département</label>
              <input className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder="Ex: Ventes" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="form-label">Contrat</label>
              <select className="input" value={type} onChange={e => setType(e.target.value as 'CDI'|'CDD')} style={{ width: '100%' }}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Salaire brut (XOF)</label>
            <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Ex: 350000" style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Date d'embauche</label>
              <input className="input" value={hiredAt} onChange={e => setHiredAt(e.target.value)} placeholder="JJ/MM/AAAA" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            {type === 'CDD' && (
              <div>
                <label className="form-label">Fin de contrat</label>
                <input className="input" value={endAt} onChange={e => setEndAt(e.target.value)} placeholder="JJ/MM/AAAA" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Téléphone</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>

          <div>
            <label className="form-label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@boutique.com" style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label className="form-label">Performance</label>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Statut employé</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{active ? 'Employé actif' : 'Employé inactif'}</div>
              </div>
              <button onClick={() => setActive(a => !a)} style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: '1px solid',
                background: active ? 'rgba(14,196,126,.12)' : 'rgba(232,64,74,.1)',
                color: active ? 'var(--acc2)' : 'var(--danger)',
                borderColor: active ? 'rgba(14,196,126,.3)' : 'rgba(232,64,74,.25)',
              }}>
                {active ? '✓ Actif' : '✗ Inactif'}
              </button>
            </div>
          )}

          <div>
            <label className="form-label">Couleur d'avatar</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2, transition: 'all .15s', transform: color === c ? 'scale(1.2)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => {
              if (!name.trim() || !role.trim()) { toast.error('Nom et poste requis'); return }
              onSave({ name, role, dept, salary: Number(salary) || 0, type, hiredAt, endAt: endAt || undefined, phone, email, color, active, perf })
            }}>
            {emp ? '💾 Enregistrer' : '➕ Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
