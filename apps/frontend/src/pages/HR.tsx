import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount } from '@/stores/appStore'
import { exportCSV } from '@/utils/export'
import { Download, Plus, Eye, X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Employee {
  id: number; name: string; role: string; dept: string; salary: number
  type: 'CDI' | 'CDD'; hiredAt: string; endAt?: string
  avatar: string; color: string; active: boolean
  phone: string; email: string
}

interface LeaveRequest {
  id: number; empId: number; type: string; from: string; to: string
  days: number; motif: string; status: 'pending' | 'approved' | 'refused'
}

const EMPLOYEES: Employee[] = [
  { id:1, name:'Marie Bakayoko',   role:'Caissière',   dept:'Ventes',     salary:350000, type:'CDI', hiredAt:'01/03/2023',                    avatar:'MB', color:'#6C3FD6', active:true,  phone:'+221 77 111 22 33', email:'marie@shop.com' },
  { id:2, name:'Kofi Diallo',      role:'Magasinier',  dept:'Stock',      salary:420000, type:'CDI', hiredAt:'15/06/2024',                    avatar:'KD', color:'#F59E0B', active:true,  phone:'+221 77 222 33 44', email:'kofi@shop.com' },
  { id:3, name:'Aminata Touré',    role:'Comptable',   dept:'Finance',    salary:280000, type:'CDD', hiredAt:'01/09/2025', endAt:'31/08/2026', avatar:'AT', color:'#10B981', active:true,  phone:'+221 77 333 44 55', email:'aminata@shop.com' },
  { id:4, name:'Seydou Koné',      role:'Caissier',    dept:'Ventes',     salary:310000, type:'CDI', hiredAt:'10/05/2025',                    avatar:'SK', color:'#EF4444', active:true,  phone:'+221 77 444 55 66', email:'seydou@shop.com' },
  { id:5, name:'Fatoumata Ndiaye', role:'Responsable', dept:'Direction',  salary:480000, type:'CDI', hiredAt:'01/01/2022',                    avatar:'FN', color:'#3B82F6', active:true,  phone:'+221 77 555 66 77', email:'fatou@shop.com' },
  { id:6, name:'Ibrahim Sow',      role:'Livreur',     dept:'Logistique', salary:220000, type:'CDD', hiredAt:'01/02/2026', endAt:'31/07/2026', avatar:'IS', color:'#8B5CF6', active:false, phone:'+221 77 666 77 88', email:'ibrahim@shop.com' },
]

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
    5: { status:'repos' },
    6: { status:'repos' },
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
    5: { status:'repos' },
    6: { status:'repos' },
  },
  4: {
    0: { status:'present', arrive:'13:00', depart:'18:00' },
    1: { status:'present', arrive:'08:00', depart:'13:00' },
    2: { status:'present', arrive:'08:00', depart:'18:00' },
    3: { status:'retard',  arrive:'14:20', depart:'18:00' },
    4: { status:'present', arrive:'08:00', depart:'13:00' },
    5: { status:'repos' },
    6: { status:'repos' },
  },
  5: {
    0: { status:'conge' },
    1: { status:'conge' },
    2: { status:'conge' },
    3: { status:'conge' },
    4: { status:'conge' },
    5: { status:'repos' },
    6: { status:'repos' },
  },
  6: {
    0: { status:'repos' },
    1: { status:'repos' },
    2: { status:'repos' },
    3: { status:'repos' },
    4: { status:'repos' },
    5: { status:'repos' },
    6: { status:'repos' },
  },
}

const STATUS_CONFIG = {
  present: { label:'Présent', color:'var(--acc2)', bg:'rgba(14,196,126,.12)', border:'rgba(14,196,126,.25)' },
  retard:  { label:'Retard',  color:'var(--acc)',  bg:'rgba(240,165,0,.12)',  border:'rgba(240,165,0,.25)'  },
  absent:  { label:'Absent',  color:'var(--danger)',bg:'rgba(232,64,74,.12)', border:'rgba(232,64,74,.25)'  },
  conge:   { label:'Congé',   color:'#60A5FA',     bg:'rgba(59,130,246,.12)', border:'rgba(59,130,246,.25)' },
  repos:   { label:'Repos',   color:'var(--text3)', bg:'var(--bg3)',           border:'var(--border)'        },
}

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
  if (workdays === 0) return 100
  return Math.round((ontime / workdays) * 100)
}

function calcAbsences(empId: number): number {
  const data = POINTAGE_DATA[empId] ?? {}
  return Object.values(data).filter(p => p.status === 'absent').length
}

function calcAnciennete(hiredAt: string): string {
  const [d, m, y] = hiredAt.split('/')
  const hired = new Date(+y, +m - 1, +d)
  const months = Math.floor((new Date('2026-05-14').getTime() - hired.getTime()) / (1000 * 60 * 60 * 24 * 30))
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years >= 1) return `${years} an${years > 1 ? 's' : ''}${rem > 0 ? ` ${rem} mois` : ''}`
  return `${months} mois`
}

function todayBadge(emp: Employee): { label: string; cls: string } {
  if (!emp.active) return { label: 'Inactif', cls: 'badge-gray' }
  const p = POINTAGE_DATA[emp.id]?.[3]
  if (!p) return { label: '—', cls: 'badge-gray' }
  if (p.status === 'present') return { label: 'Présent',   cls: 'badge-green' }
  if (p.status === 'retard')  return { label: 'En retard', cls: 'badge-amber' }
  if (p.status === 'absent')  return { label: 'Absent',    cls: 'badge-red'   }
  if (p.status === 'conge')   return { label: 'En congé',  cls: 'badge-blue'  }
  return { label: 'Repos', cls: 'badge-gray' }
}

const EMP_PERF: Record<number, number> = { 1: 4, 2: 5, 3: 4, 4: 3, 5: 5, 6: 2 }
const LEAVES_TAKEN: Record<number, number> = { 1: 2, 2: 0, 3: 3, 4: 0, 5: 5, 6: 0 }

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

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const WEEK_OFFSETS = [
  { label: 'Semaine du 7 au 13 mai 2026',  start: '07/05' },
  { label: 'Semaine du 14 au 20 mai 2026', start: '14/05' },
  { label: 'Semaine du 21 au 27 mai 2026', start: '21/05' },
]

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
  if (!emp.endAt) return <span className="badge badge-green">Actif</span>
  const [d, m, y] = emp.endAt.split('/')
  const end = new Date(+y, +m - 1, +d)
  const now = new Date('2026-05-14')
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (diff <= 2) return <span className="badge badge-red">Expire {m}/{y.slice(2)}</span>
  if (diff <= 4) return <span className="badge badge-amber">Expire {m}/{y.slice(2)}</span>
  return <span className="badge badge-green">Actif</span>
}

export default function HR() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const navigate = useNavigate()

  const [tab,      setTab]      = useState<'team' | 'contracts' | 'attendance' | 'leaves'>('team')
  const [viewEmp,  setViewEmp]  = useState<Employee | null>(null)
  const [addOpen,  setAddOpen]  = useState(false)
  const [weekIdx,  setWeekIdx]  = useState(1)
  const [pending,  setPending]  = useState<LeaveRequest[]>(LEAVE_PENDING_INIT)
  const [leaveOpen,setLeaveOpen]= useState(false)
  const [editMode, setEditMode] = useState(false)

  const [newEmp,   setNewEmp]   = useState({ name: '', role: '', dept: '', salary: '', type: 'CDI', phone: '', email: '' })
  const [newLeave, setNewLeave] = useState({ empId: '1', type: 'Congé annuel', from: '', to: '', motif: '' })

  const activeCount    = EMPLOYEES.filter(e => e.active).length
  const masseSalariale = EMPLOYEES.reduce((s, e) => s + e.salary, 0)

  const TABS = [
    { id: 'team',       label: '👥 Équipe'   },
    { id: 'contracts',  label: '📄 Contrats' },
    { id: 'attendance', label: '📅 Pointage' },
    { id: 'leaves',     label: '🏖️ Congés'  },
  ] as const

  const leaveDays = (from: string, to: string) => {
    if (!from || !to) return 0
    const d1 = new Date(from), d2 = new Date(to)
    return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

  function handleApprove(id: number) { setPending(p => p.filter(r => r.id !== id)); toast.success('Congé approuvé') }
  function handleRefuse(id: number)  { setPending(p => p.filter(r => r.id !== id)); toast.error('Congé refusé')    }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total employés',  value: EMPLOYEES.length, sub: `${activeCount} actifs`, color: 'var(--p2)',  icon: '👥' },
          { label: 'Actifs',          value: activeCount,       sub: '1 absent',              color: 'var(--acc2)', icon: '✅' },
          { label: 'Masse salariale', value: fmt(masseSalariale), sub: 'Ce mois',             color: 'var(--acc)', icon: '💰' },
          { label: 'Congés en cours', value: 2,                 sub: '1 en attente',          color: 'var(--p3)',  icon: '🏖️' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
              background: tab === tb.id ? 'var(--p)' : 'var(--card)',
              color: tab === tb.id ? '#fff' : 'var(--text2)',
              border: tab === tb.id ? 'none' : '1px solid var(--border)',
              boxShadow: tab === tb.id ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
            }}
          >{tb.label}</button>
        ))}
      </div>

      {/* ── TAB ÉQUIPE ── */}
      {tab === 'team' && (
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">👥 Équipe</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
                exportCSV('habashop_employes',
                  ['Nom','Poste','Département','Contrat','Date embauche','Salaire','Statut'],
                  EMPLOYEES.map(e => [e.name, e.role, e.dept, e.type, e.hiredAt, e.salary, e.active ? 'Actif' : 'Inactif'])
                )
                toast.success('📊 Export CSV téléchargé !')
              }}>
                <Download size={13} /> Export
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
                {EMPLOYEES.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar emp={e} size={34} />
                        <div>
                          <div className="td-bold text-sm">{e.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text2)' }}>{e.dept}</td>
                    <td>
                      <span className={`badge ${e.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>{e.type}</span>
                    </td>
                    <td className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(e.salary)}</td>
                    <td>
                      <span className={`badge ${e.active ? 'badge-green' : 'badge-gray'}`}>
                        {e.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <button className="mini-btn gap-1" onClick={() => { setViewEmp(e); setEditMode(false) }}>
                        <Eye size={12} /> Voir
                      </button>
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
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">📄 Contrats</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employé</th><th>Type</th><th>Début</th>
                  <th>Fin</th><th>Salaire</th><th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {EMPLOYEES.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar emp={e} size={28} />
                        <span className="td-bold text-xs">{e.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${e.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>{e.type}</span>
                    </td>
                    <td className="td-mono text-xs">{e.hiredAt}</td>
                    <td className="td-mono text-xs" style={{ color: e.endAt ? 'var(--acc)' : 'var(--text3)' }}>
                      {e.endAt ?? '—'}
                    </td>
                    <td className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(e.salary)}</td>
                    <td><ContractStatus emp={e} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="mini-btn gap-1" onClick={() => toast('📥 Téléchargement contrat…')}>
                          <Download size={11} />
                        </button>
                        {e.type === 'CDD' && e.active && (
                          <button className="mini-btn gap-1" onClick={() => toast.success('Renouvellement initié')}>🔄</button>
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
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">📅 Pointage</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="mini-btn" onClick={() => setWeekIdx(i => Math.max(0, i - 1))} style={{ padding: '4px 7px' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', minWidth: 200, textAlign: 'center' }}>
                {WEEK_OFFSETS[weekIdx]?.label}
              </span>
              <button className="mini-btn" onClick={() => setWeekIdx(i => Math.min(WEEK_OFFSETS.length - 1, i + 1))} style={{ padding: '4px 7px' }}>
                <ChevronRight size={14} />
              </button>
              <button className="btn btn-ghost btn-sm gap-1" onClick={() => {
                exportCSV('habashop_pointage',
                  ['Employé','Lun','Mar','Mer','Jeu','Ven','Sam','Dim','Total heures'],
                  EMPLOYEES.map(e => {
                    const data = POINTAGE_DATA[e.id] ?? {}
                    const days = Array.from({ length: 7 }, (_, i) => {
                      const p = data[i]
                      if (!p) return '—'
                      if (p.arrive) return `${p.arrive}-${p.depart}`
                      return STATUS_CONFIG[p.status].label
                    })
                    return [e.name, ...days, calcHeures(e.id)]
                  })
                )
                toast.success('📊 Export pointage téléchargé !')
              }}>
                <Download size={12} /> Export
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Employé</th>
                  {WEEK_DAYS.map(d => <th key={d} style={{ textAlign: 'center', minWidth: 88 }}>{d}</th>)}
                  <th style={{ textAlign: 'center', minWidth: 80 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {EMPLOYEES.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar emp={e} size={28} />
                        <span className="td-bold text-xs">{e.name}</span>
                      </div>
                    </td>
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const p   = POINTAGE_DATA[e.id]?.[dayIndex]
                      if (!p) return (
                        <td key={dayIndex} style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                        </td>
                      )
                      const cfg = STATUS_CONFIG[p.status]
                      return (
                        <td key={dayIndex} style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', flexDirection: 'column',
                            alignItems: 'center', gap: 2,
                            background: cfg.bg, border: `1px solid ${cfg.border}`,
                            borderRadius: 9, padding: '6px 8px', minWidth: 72,
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            {p.arrive && (
                              <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                                {p.arrive} → {p.depart}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)',
                        color: e.active ? 'var(--acc2)' : 'var(--text3)',
                      }}>{calcHeures(e.id)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {Object.entries(STATUS_CONFIG).map(([, cfg]) => (
              <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)' }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                  background: cfg.color,
                }} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONGÉS ── */}
      {tab === 'leaves' && (
        <div className="space-y-4">
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-head">
              <span className="panel-title">⏳ Demandes en attente</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {pending.length > 0 && <span className="badge badge-amber">{pending.length}</span>}
                <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setLeaveOpen(true)}>
                  <Plus size={13} /> Nouvelle demande
                </button>
              </div>
            </div>
            {pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                Aucune demande en attente
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map(req => {
                  const emp = EMPLOYEES.find(e => e.id === req.empId)!
                  return (
                    <div key={req.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 15px', borderRadius: 12,
                      background: 'var(--bg3)', border: '1px solid var(--border)',
                    }}>
                      <Avatar emp={emp} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{emp.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                          {req.type} · {req.from} → {req.to} · {req.days} jour{req.days > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{req.motif}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => handleApprove(req.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                          borderRadius: 8, background: 'rgba(16,185,129,.15)', color: '#10B981',
                          border: '1px solid rgba(16,185,129,.3)', fontWeight: 700, fontSize: 12,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          <Check size={13} /> Approuver
                        </button>
                        <button onClick={() => handleRefuse(req.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                          borderRadius: 8, background: 'rgba(239,68,68,.12)', color: '#F87171',
                          border: '1px solid rgba(239,68,68,.25)', fontWeight: 700, fontSize: 12,
                          cursor: 'pointer', fontFamily: 'inherit',
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

          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-head">
              <span className="panel-title">📋 Historique des congés</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Employé</th><th>Type</th><th>Période</th><th>Durée</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {LEAVE_HISTORY.map(h => {
                    const emp = EMPLOYEES.find(e => e.id === h.empId)!
                    return (
                      <tr key={h.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar emp={emp} size={26} />
                            <span className="td-bold text-xs">{emp.name}</span>
                          </div>
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text2)' }}>{h.type}</td>
                        <td className="td-mono text-xs">{h.from} → {h.to}</td>
                        <td className="td-num text-xs">{h.days}j</td>
                        <td>
                          <span className={`badge ${h.status === 'approved' ? 'badge-green' : h.status === 'refused' ? 'badge-red' : 'badge-amber'}`}>
                            {h.status === 'approved' ? 'Approuvé' : h.status === 'refused' ? 'Refusé' : 'En attente'}
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

      {/* ── MODAL Fiche employé ── */}
      {viewEmp && (
        <div className="modal-backdrop" onClick={() => setViewEmp(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 18, flexShrink: 0,
                  background: viewEmp.color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 800,
                  boxShadow: `0 8px 24px ${viewEmp.color}55`,
                }}>{viewEmp.avatar}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{viewEmp.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{viewEmp.role} · {viewEmp.dept}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${viewEmp.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>{viewEmp.type}</span>
                    {(() => {
                      const tb = todayBadge(viewEmp)
                      return <span className={`badge ${tb.cls}`}>{tb.label}</span>
                    })()}
                  </div>
                </div>
              </div>
              <button className="mini-btn" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setViewEmp(null)}>
                <X size={14} /> Fermer
              </button>
            </div>

            {/* Grille infos 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'CONTRAT',    value: viewEmp.type },
                { label: 'ANCIENNETÉ', value: calcAnciennete(viewEmp.hiredAt) },
                { label: 'SALAIRE BASE', value: fmt(viewEmp.salary) },
                { label: 'PERFORMANCE', value: '⭐'.repeat(EMP_PERF[viewEmp.id] ?? 3) },
              ].map(f => (
                <div key={f.label} style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Performance ce mois — 4 mini-cards */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
                Performance ce mois
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(() => {
                  const ponct = calcPonctualite(viewEmp.id)
                  const ponctBg = ponct >= 90 ? 'rgba(14,196,126,.15)' : ponct >= 70 ? 'rgba(240,165,0,.15)' : 'rgba(232,64,74,.15)'
                  const ponctColor = ponct >= 90 ? 'var(--acc2)' : ponct >= 70 ? 'var(--acc)' : 'var(--danger)'
                  const absences = calcAbsences(viewEmp.id)
                  const congesRestants = 25 - (LEAVES_TAKEN[viewEmp.id] ?? 0)
                  return [
                    { label: 'Ponctualité',       value: `${ponct} %`,              bg: ponctBg,             color: ponctColor   },
                    { label: 'Heures travaillées', value: calcHeures(viewEmp.id),   bg: 'var(--bg3)',         color: 'var(--p2)'  },
                    { label: 'Absences',           value: `${absences} jour${absences > 1 ? 's' : ''}`, bg: absences > 0 ? 'rgba(232,64,74,.1)' : 'var(--bg3)', color: absences > 0 ? 'var(--danger)' : 'var(--acc2)' },
                    { label: 'Congés restants',    value: `${congesRestants} j / 25`, bg: 'var(--bg3)',       color: 'var(--p3)'  },
                  ]
                })().map(m => (
                  <div key={m.label} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: m.bg, border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 5 }}>{m.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulaire inline si editMode */}
            {editMode && (
              <div style={{ padding: '14px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>✏️ Modifier la fiche</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Poste',  val: viewEmp.role  },
                    { label: 'Téléphone', val: viewEmp.phone },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{f.label}</div>
                      <input className="input" defaultValue={f.val} style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }}
                  onClick={() => { toast.success('Fiche mise à jour (demo)'); setEditMode(false) }}>
                  Sauvegarder
                </button>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { navigate('/app/payroll'); setViewEmp(null) }}>
                💰 Bulletin de paie
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { navigate('/app/planning'); setViewEmp(null) }}>
                📅 Voir planning
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📞 Appel ${viewEmp.phone}`)}>
                📞 Contacter
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(v => !v)}>
                ✏️ Modifier la fiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Nouvel employé ── */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Nouvel employé</span>
              <button className="mini-btn" onClick={() => setAddOpen(false)}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Nom complet',     key: 'name',   type: 'text',   placeholder: 'Ex: Awa Diallo'  },
                { label: 'Poste',           key: 'role',   type: 'text',   placeholder: 'Ex: Caissière'   },
                { label: 'Département',     key: 'dept',   type: 'text',   placeholder: 'Ex: Ventes'      },
                { label: 'Salaire (F CFA)', key: 'salary', type: 'number', placeholder: '350000'          },
                { label: 'Téléphone',       key: 'phone',  type: 'text',   placeholder: '+221 77 …'       },
                { label: 'Email',           key: 'email',  type: 'email',  placeholder: 'nom@shop.com'    },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input className="input" type={f.type} placeholder={f.placeholder}
                    value={(newEmp as Record<string, string>)[f.key]}
                    onChange={ev => setNewEmp(p => ({ ...p, [f.key]: ev.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Type de contrat</label>
                <select className="input" value={newEmp.type} onChange={e => setNewEmp(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box' }}>
                  <option>CDI</option><option>CDD</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setAddOpen(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                onClick={() => { toast.success('Employé ajouté (demo)'); setAddOpen(false) }}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Nouvelle demande congé ── */}
      {leaveOpen && (
        <div className="modal-backdrop" onClick={() => setLeaveOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Nouvelle demande de congé</span>
              <button className="mini-btn" onClick={() => setLeaveOpen(false)}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Employé</label>
                <select className="input" value={newLeave.empId} onChange={e => setNewLeave(p => ({ ...p, empId: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box' }}>
                  {EMPLOYEES.filter(e => e.active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Type</label>
                <select className="input" value={newLeave.type} onChange={e => setNewLeave(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box' }}>
                  {['Congé annuel','Congé maladie','Congé maternité','Congé sans solde','Autre'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Du</label>
                  <input className="input" type="date" value={newLeave.from}
                    onChange={e => setNewLeave(p => ({ ...p, from: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Au</label>
                  <input className="input" type="date" value={newLeave.to}
                    onChange={e => setNewLeave(p => ({ ...p, to: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
              {newLeave.from && newLeave.to && (
                <div style={{ fontSize: 12, color: 'var(--acc2)', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                  Durée : {leaveDays(newLeave.from, newLeave.to)} jour(s)
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Motif</label>
                <input className="input" type="text" placeholder="Ex: Voyage familial"
                  value={newLeave.motif} onChange={e => setNewLeave(p => ({ ...p, motif: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setLeaveOpen(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                onClick={() => {
                  if (!newLeave.from || !newLeave.to) { toast.error('Sélectionnez les dates'); return }
                  const days = leaveDays(newLeave.from, newLeave.to)
                  const emp  = EMPLOYEES.find(e => e.id === +newLeave.empId)!
                  setPending(p => [...p, {
                    id: Date.now(), empId: emp.id, type: newLeave.type,
                    from: newLeave.from, to: newLeave.to, days,
                    motif: newLeave.motif || '—', status: 'pending',
                  }])
                  setNewLeave({ empId: '1', type: 'Congé annuel', from: '', to: '', motif: '' })
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
