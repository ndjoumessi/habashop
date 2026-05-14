import { useState } from 'react'
import { useConfig, useFormatAmount } from '@/stores/appStore'
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

type AttCell = '✅' | '⚠️' | '❌' | '🏖️' | '—'
const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const ATTENDANCE: Record<number, { cells: AttCell[]; total: string }> = {
  1: { cells: ['✅','✅','⚠️','✅','✅','—','—'], total: '39h' },
  2: { cells: ['✅','✅','✅','✅','✅','✅','—'], total: '48h' },
  3: { cells: ['✅','❌','✅','✅','✅','—','—'], total: '32h' },
  4: { cells: ['✅','✅','✅','⚠️','✅','—','—'], total: '38h30' },
  5: { cells: ['🏖️','🏖️','🏖️','🏖️','🏖️','—','—'], total: 'Congé' },
  6: { cells: ['—','—','—','—','—','—','—'], total: 'Inactif' },
}

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

const WEEK_OFFSETS = [
  { label: 'Semaine du 7 au 13 mai 2026',   start: '07/05' },
  { label: 'Semaine du 14 au 20 mai 2026',  start: '14/05' },
  { label: 'Semaine du 21 au 27 mai 2026',  start: '21/05' },
]

export default function HR() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()

  const [tab, setTab] = useState<'team' | 'contracts' | 'attendance' | 'leaves'>('team')
  const [viewEmp, setViewEmp] = useState<Employee | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [weekIdx, setWeekIdx] = useState(1)
  const [pending, setPending] = useState<LeaveRequest[]>(LEAVE_PENDING_INIT)
  const [leaveOpen, setLeaveOpen] = useState(false)

  // New employee form
  const [newEmp, setNewEmp] = useState({ name: '', role: '', dept: '', salary: '', type: 'CDI', phone: '', email: '' })

  // New leave form
  const [newLeave, setNewLeave] = useState({ empId: '1', type: 'Congé annuel', from: '', to: '', motif: '' })

  const activeCount = EMPLOYEES.filter(e => e.active).length
  const masseSalariale = EMPLOYEES.reduce((s, e) => s + e.salary, 0)

  const TABS = [
    { id: 'team',       label: '👥 Équipe' },
    { id: 'contracts',  label: '📄 Contrats' },
    { id: 'attendance', label: '📅 Pointage' },
    { id: 'leaves',     label: '🏖️ Congés' },
  ] as const

  const leaveDays = (from: string, to: string) => {
    if (!from || !to) return 0
    const d1 = new Date(from), d2 = new Date(to)
    return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

  function handleApprove(id: number) {
    setPending(p => p.filter(r => r.id !== id))
    toast.success('Congé approuvé')
  }
  function handleRefuse(id: number) {
    setPending(p => p.filter(r => r.id !== id))
    toast.error('Congé refusé')
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total employés',  value: EMPLOYEES.length, sub: `${activeCount} actifs`, color: 'var(--p2)', icon: '👥' },
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
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus size={13} /> Nouvel employé
            </button>
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
                      <span className={`badge ${e.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(e.salary)}</td>
                    <td>
                      <span className={`badge ${e.active ? 'badge-green' : 'badge-gray'}`}>
                        {e.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <button className="mini-btn gap-1" onClick={() => setViewEmp(e)}>
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
                      <span className={`badge ${e.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>
                        {e.type}
                      </span>
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
                          <button className="mini-btn gap-1" onClick={() => toast.success('Renouvellement initié')}>
                            🔄
                          </button>
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
              <button className="mini-btn" onClick={() => setWeekIdx(i => Math.max(0, i - 1))}
                style={{ padding: '4px 7px' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', minWidth: 200, textAlign: 'center' }}>
                {WEEK_OFFSETS[weekIdx]?.label}
              </span>
              <button className="mini-btn" onClick={() => setWeekIdx(i => Math.min(WEEK_OFFSETS.length - 1, i + 1))}
                style={{ padding: '4px 7px' }}>
                <ChevronRight size={14} />
              </button>
              <button className="btn btn-ghost btn-sm gap-1" onClick={() => toast('📊 Export pointage…')}>
                <Download size={12} /> Export
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Employé</th>
                  {WEEK_DAYS.map(d => <th key={d} style={{ textAlign: 'center', minWidth: 50 }}>{d}</th>)}
                  <th style={{ textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {EMPLOYEES.map(e => {
                  const att = ATTENDANCE[e.id]
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar emp={e} size={28} />
                          <span className="td-bold text-xs">{e.name}</span>
                        </div>
                      </td>
                      {att.cells.map((cell, ci) => (
                        <td key={ci} style={{ textAlign: 'center', fontSize: 16 }}>{cell}</td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: att.total === 'Inactif' ? 'var(--text3)' : att.total === 'Congé' ? 'var(--p2)' : 'var(--acc2)',
                          fontFamily: 'var(--mono)',
                        }}>{att.total}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {[['✅','Présent'],['⚠️','Retard'],['❌','Absent'],['🏖️','Congé'],['—','Repos']].map(([ic, lb]) => (
              <div key={lb} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)' }}>
                <span style={{ fontSize: 15 }}>{ic}</span> {lb}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONGÉS ── */}
      {tab === 'leaves' && (
        <div className="space-y-4">
          {/* Demandes en attente */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-head">
              <span className="panel-title">⏳ Demandes en attente</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {pending.length > 0 && (
                  <span className="badge badge-amber">{pending.length}</span>
                )}
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
                        <button
                          onClick={() => handleApprove(req.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                            borderRadius: 8, background: 'rgba(16,185,129,.15)', color: '#10B981',
                            border: '1px solid rgba(16,185,129,.3)', fontWeight: 700, fontSize: 12,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          <Check size={13} /> Approuver
                        </button>
                        <button
                          onClick={() => handleRefuse(req.id)}
                          style={{
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

          {/* Historique */}
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

      {/* ── MODAL Voir employé ── */}
      {viewEmp && (
        <div className="modal-backdrop" onClick={() => setViewEmp(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Fiche employé</span>
              <button className="mini-btn" onClick={() => setViewEmp(null)}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 22 }}>
              <Avatar emp={viewEmp} size={60} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{viewEmp.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{viewEmp.role} · {viewEmp.dept}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <span className={`badge ${viewEmp.type === 'CDI' ? 'badge-violet' : 'badge-amber'}`}>{viewEmp.type}</span>
                  <span className={`badge ${viewEmp.active ? 'badge-green' : 'badge-gray'}`}>{viewEmp.active ? 'Actif' : 'Inactif'}</span>
                </div>
              </div>
            </div>
            {[
              ['📞 Téléphone', viewEmp.phone],
              ['✉️ Email', viewEmp.email],
              ['📅 Embauché le', viewEmp.hiredAt],
              ...(viewEmp.endAt ? [['🗓️ Fin de contrat', viewEmp.endAt]] : []),
              ['💰 Salaire', fmt(viewEmp.salary)],
            ].map(([lb, val]) => (
              <div key={lb as string} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>{lb}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: lb === '💰 Salaire' ? 'var(--mono)' : 'inherit' }}>{val}</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 18, width: '100%' }} onClick={() => setViewEmp(null)}>
              Fermer
            </button>
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
                { label: 'Nom complet', key: 'name', type: 'text', placeholder: 'Ex: Awa Diallo' },
                { label: 'Poste', key: 'role', type: 'text', placeholder: 'Ex: Caissière' },
                { label: 'Département', key: 'dept', type: 'text', placeholder: 'Ex: Ventes' },
                { label: 'Salaire (F CFA)', key: 'salary', type: 'number', placeholder: '350000' },
                { label: 'Téléphone', key: 'phone', type: 'text', placeholder: '+221 77 …' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'nom@shop.com' },
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
                  const emp = EMPLOYEES.find(e => e.id === +newLeave.empId)!
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
