import { useState } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Search, Download, Plus, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'

type EmployeeStatus = 'Actif' | 'Congé' | 'Absent'
type Role = 'Gérant' | 'Caissier' | 'Magasinier' | 'Livreur' | 'Agent'
type AttStatus = 'P' | 'A' | 'C' | 'F' | ''

interface AttRecord { date: string; status: AttStatus }

interface Employee {
  id: string; name: string; role: Role; phone: string; email: string
  hireDate: string; salary: number; status: EmployeeStatus
  attendance: AttRecord[]; leaveBalance: number; notes: string
}

const ROLES: Role[] = ['Gérant', 'Caissier', 'Magasinier', 'Livreur', 'Agent']

const STATUS_CFG: Record<EmployeeStatus, { cls: string }> = {
  Actif:  { cls: 'badge-green'  },
  Congé:  { cls: 'badge-violet' },
  Absent: { cls: 'badge-red'    },
}

const ATT_CFG: Record<AttStatus, { cls: string; label: string }> = {
  P:  { cls: 'badge-green',  label: 'P' },
  A:  { cls: 'badge-red',    label: 'A' },
  C:  { cls: 'badge-violet', label: 'C' },
  F:  { cls: 'badge-gray',   label: 'F' },
  '': { cls: 'badge-gray',   label: '–' },
}

const ATT_CYCLE: AttStatus[] = ['P', 'A', 'C', '']

const WEEK: { date: string; label: string }[] = [
  { date: '2026-05-11', label: 'Lun 11' },
  { date: '2026-05-12', label: 'Mar 12' },
  { date: '2026-05-13', label: 'Mer 13' },
  { date: '2026-05-14', label: 'Jeu 14' },
  { date: '2026-05-15', label: 'Ven 15' },
  { date: '2026-05-16', label: 'Sam 16' },
]

const TODAY = '2026-05-14'

const EMPLOYEES_INIT: Employee[] = [
  {
    id: '1', name: 'Mamadou Diallo', role: 'Gérant',
    phone: '+221 77 123 45 67', email: 'mamadou.diallo@habashop.sn',
    hireDate: '2022-03-01', salary: 450000, status: 'Actif', leaveBalance: 15,
    attendance: [
      { date: '2026-05-11', status: 'P' }, { date: '2026-05-12', status: 'P' },
      { date: '2026-05-13', status: 'P' }, { date: '2026-05-14', status: 'P' },
    ],
    notes: 'Responsable général de la boutique',
  },
  {
    id: '2', name: 'Fatou Ndiaye', role: 'Caissier',
    phone: '+221 76 234 56 78', email: 'fatou.ndiaye@habashop.sn',
    hireDate: '2023-01-15', salary: 220000, status: 'Actif', leaveBalance: 12,
    attendance: [
      { date: '2026-05-11', status: 'P' }, { date: '2026-05-12', status: 'P' },
      { date: '2026-05-13', status: 'P' }, { date: '2026-05-14', status: 'P' },
    ],
    notes: '',
  },
  {
    id: '3', name: 'Ibrahima Mbaye', role: 'Magasinier',
    phone: '+221 78 345 67 89', email: 'ibrahima.mbaye@habashop.sn',
    hireDate: '2023-06-01', salary: 180000, status: 'Actif', leaveBalance: 8,
    attendance: [
      { date: '2026-05-11', status: 'P' }, { date: '2026-05-12', status: 'A' },
      { date: '2026-05-13', status: 'P' }, { date: '2026-05-14', status: 'P' },
    ],
    notes: 'Gère le stock principal',
  },
  {
    id: '4', name: 'Aminata Sow', role: 'Caissier',
    phone: '+221 70 456 78 90', email: 'aminata.sow@habashop.sn',
    hireDate: '2024-02-01', salary: 200000, status: 'Congé', leaveBalance: 3,
    attendance: [
      { date: '2026-05-11', status: 'C' }, { date: '2026-05-12', status: 'C' },
      { date: '2026-05-13', status: 'C' }, { date: '2026-05-14', status: 'C' },
    ],
    notes: 'Congé annuel du 11 au 18 mai',
  },
  {
    id: '5', name: 'Moussa Thiam', role: 'Livreur',
    phone: '+221 77 567 89 01', email: 'moussa.thiam@habashop.sn',
    hireDate: '2023-09-15', salary: 160000, status: 'Actif', leaveBalance: 10,
    attendance: [
      { date: '2026-05-11', status: 'P' }, { date: '2026-05-12', status: 'P' },
      { date: '2026-05-13', status: 'P' }, { date: '2026-05-14', status: 'P' },
    ],
    notes: '',
  },
  {
    id: '6', name: 'Cheikh Fall', role: 'Magasinier',
    phone: '+221 76 678 90 12', email: 'cheikh.fall@habashop.sn',
    hireDate: '2024-05-01', salary: 165000, status: 'Absent', leaveBalance: 18,
    attendance: [
      { date: '2026-05-11', status: 'P' }, { date: '2026-05-12', status: 'P' },
      { date: '2026-05-13', status: 'P' }, { date: '2026-05-14', status: 'A' },
    ],
    notes: 'Absent sans justificatif',
  },
  {
    id: '7', name: 'Aïda Ba', role: 'Agent',
    phone: '+221 78 789 01 23', email: 'aida.ba@habashop.sn',
    hireDate: '2025-01-10', salary: 120000, status: 'Actif', leaveBalance: 22,
    attendance: [
      { date: '2026-05-11', status: 'P' }, { date: '2026-05-12', status: 'P' },
      { date: '2026-05-13', status: 'P' }, { date: '2026-05-14', status: 'P' },
    ],
    notes: '',
  },
]

const BLANK_FORM = {
  name: '', role: 'Caissier' as Role, phone: '', email: '',
  hireDate: '', salary: 150000, notes: '',
}

function getAtt(emp: Employee, date: string): AttStatus {
  return emp.attendance.find(a => a.date === date)?.status ?? ''
}

export default function HR() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const [employees, setEmployees] = useState<Employee[]>(EMPLOYEES_INIT)
  const [tab, setTab] = useState<'equipe' | 'presences'>('equipe')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('')
  const [viewEmp, setViewEmp] = useState<Employee | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  const filtered = employees.filter(e =>
    (!search || e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter   || e.role   === roleFilter) &&
    (!statusFilter || e.status === statusFilter)
  )

  const totalSalary = employees.reduce((s, e) => s + e.salary, 0)
  const presentToday = employees.filter(e => getAtt(e, TODAY) === 'P').length
  const onLeave = employees.filter(e => e.status === 'Congé').length
  const absent  = employees.filter(e => e.status === 'Absent').length

  const cycleAtt = (empId: string, date: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id !== empId) return e
      const cur = getAtt(e, date)
      const next = ATT_CYCLE[(ATT_CYCLE.indexOf(cur) + 1) % ATT_CYCLE.length]
      const existing = e.attendance.findIndex(a => a.date === date)
      const attendance = existing >= 0
        ? e.attendance.map((a, i) => i === existing ? { ...a, status: next } : a)
        : [...e.attendance, { date, status: next }]
      return { ...e, attendance }
    }))
  }

  const addEmployee = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nom et téléphone requis'); return
    }
    const newE: Employee = {
      id: String(Date.now()),
      name: form.name, role: form.role, phone: form.phone, email: form.email,
      hireDate: form.hireDate, salary: form.salary, status: 'Actif',
      attendance: [], leaveBalance: 22, notes: form.notes,
    }
    setEmployees(prev => [newE, ...prev])
    setShowCreate(false)
    setForm(BLANK_FORM)
    toast.success(`✅ ${newE.name} ajouté à l'équipe`)
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total employés',       value: employees.length.toString(),                    color: 'var(--p2)',   icon: '👥' },
          { label: 'Présents aujourd\'hui', value: `${presentToday} / ${employees.length}`,        color: 'var(--acc2)', icon: '✅' },
          { label: 'En congé',             value: onLeave.toString(),                             color: 'var(--p3)',   icon: '🏖️' },
          { label: 'Masse salariale',       value: fmt(totalSalary),                               color: 'var(--acc)',  icon: '💰' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['equipe', 'presences'] as const).map(tb => (
          <button key={tb}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === tb ? 'var(--p)' : 'var(--card)',
              color: tab === tb ? '#fff' : 'var(--text2)',
              border: tab === tb ? 'none' : '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: tab === tb ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
            }}
            onClick={() => setTab(tb)}
          >
            {tb === 'equipe' ? '👥 Équipe' : '📅 Présences'}
          </button>
        ))}
      </div>

      {/* ── Onglet Équipe ── */}
      {tab === 'equipe' && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">👥 Équipe</span>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📊 Export CSV…')}>
                <Download size={13} /> {t('btn_export')}
              </button>
              <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus size={13} /> {t('btn_add')}
              </button>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="search-box flex-1 min-w-40">
              <Search size={13} className="search-icon" />
              <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Nom, rôle…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input py-2 text-sm w-auto" value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}>
              <option value="">Tous rôles</option>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <select className="input py-2 text-sm w-auto" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="">Tous statuts</option>
              <option>Actif</option><option>Congé</option><option>Absent</option>
            </select>
          </div>

          {/* Tableau */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employé</th><th>Rôle</th><th>Téléphone</th>
                  <th>Ancienneté</th><th>Salaire</th><th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const years = Math.floor((new Date(TODAY).getTime() - new Date(e.hireDate).getTime()) / (365.25 * 24 * 3600 * 1000))
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="td-bold">{e.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{e.email}</div>
                      </td>
                      <td><span className="badge badge-teal">{e.role}</span></td>
                      <td className="td-mono text-xs">{e.phone}</td>
                      <td className="text-xs" style={{ color: 'var(--text2)' }}>
                        {years > 0 ? `${years} an${years > 1 ? 's' : ''}` : '< 1 an'}
                      </td>
                      <td className="td-num text-sm" style={{ color: 'var(--acc2)' }}>
                        {fmt(e.salary)}
                      </td>
                      <td><span className={`badge ${STATUS_CFG[e.status].cls}`}>{e.status}</span></td>
                      <td>
                        <button className="btn btn-sm btn-ghost" title="Voir fiche" onClick={() => setViewEmp(e)}>
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>Aucun employé trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Onglet Présences ── */}
      {tab === 'presences' && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">📅 Présences — semaine du 11 au 16 mai 2026</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text3)' }}>
                <span className="badge badge-green">P</span> Présent
                <span className="badge badge-red">A</span> Absent
                <span className="badge badge-violet">C</span> Congé
                <span className="badge badge-gray">F</span> Férié
              </div>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>Cliquer pour modifier</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Employé</th>
                  {WEEK.map(d => (
                    <th key={d.date} style={{
                      textAlign: 'center',
                      color: d.date === TODAY ? 'var(--p2)' : undefined,
                      fontWeight: d.date === TODAY ? 800 : undefined,
                    }}>
                      {d.label}
                      {d.date === TODAY && <div style={{ fontSize: 9, color: 'var(--p3)', marginTop: 1 }}>AUJOURD'HUI</div>}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Total P</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => {
                  const totalP = WEEK.filter(d => getAtt(e, d.date) === 'P').length
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="td-bold text-xs">{e.name}</div>
                        <div style={{ color: 'var(--text3)', fontSize: 11 }}>{e.role}</div>
                      </td>
                      {WEEK.map(d => {
                        const st = getAtt(e, d.date)
                        const cfg = ATT_CFG[st]
                        return (
                          <td key={d.date} style={{ textAlign: 'center', padding: '8px 4px' }}>
                            <button
                              className={`badge ${cfg.cls}`}
                              style={{ cursor: 'pointer', minWidth: 28, border: 'none', fontFamily: 'inherit' }}
                              title="Cliquer pour changer"
                              onClick={() => cycleAtt(e.id, d.date)}
                            >
                              {cfg.label}
                            </button>
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-green font-black">{totalP}/6</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg3)' }}>
                  <td className="text-xs font-bold" style={{ color: 'var(--text2)', padding: '8px 12px' }}>Présents</td>
                  {WEEK.map(d => {
                    const count = employees.filter(e => getAtt(e, d.date) === 'P').length
                    return (
                      <td key={d.date} style={{ textAlign: 'center', padding: '8px 4px' }}>
                        <span className={`badge ${count === employees.length ? 'badge-green' : count >= employees.length * 0.7 ? 'badge-amber' : 'badge-red'} font-black`}>
                          {count}
                        </span>
                      </td>
                    )
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {(absent > 0 || onLeave > 0) && (
            <div className="mt-4 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--acc)' }}>
              ⚠️ {absent > 0 && `${absent} absent${absent > 1 ? 's' : ''} non justifié${absent > 1 ? 's' : ''}`}
              {absent > 0 && onLeave > 0 && ' · '}
              {onLeave > 0 && `${onLeave} en congé${onLeave > 1 ? 's' : ''}`}
            </div>
          )}
        </div>
      )}

      {/* ── Modal fiche employé ── */}
      {viewEmp && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewEmp(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  👤 {viewEmp.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  {viewEmp.role} · En poste depuis {new Date(viewEmp.hireDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CFG[viewEmp.status].cls}`}>{viewEmp.status}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewEmp(null)}><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Téléphone', value: viewEmp.phone },
                { label: 'Email',     value: viewEmp.email },
                { label: 'Salaire',   value: fmt(viewEmp.salary) },
                { label: 'Congés restants', value: `${viewEmp.leaveBalance} jours` },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>
                Présences cette semaine
              </div>
              <div className="flex gap-2 flex-wrap">
                {WEEK.map(d => {
                  const st = getAtt(viewEmp, d.date)
                  const cfg = ATT_CFG[st]
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text3)' }}>{d.label.split(' ')[0]}</span>
                      <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Barre congés */}
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
              <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: 'var(--text2)' }}>
                <span>Solde de congés</span>
                <span style={{ color: 'var(--p2)', fontFamily: 'var(--mono)' }}>
                  {viewEmp.leaveBalance} / 30 jours
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  width: `${(viewEmp.leaveBalance / 30) * 100}%`,
                  height: '100%', borderRadius: 99, transition: 'width .4s',
                  background: viewEmp.leaveBalance <= 5 ? 'var(--danger)' : viewEmp.leaveBalance <= 10 ? 'var(--acc)' : 'var(--acc2)',
                }} />
              </div>
            </div>

            {viewEmp.notes && (
              <div className="p-3 rounded-xl text-xs mb-4"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--acc)' }}>
                📝 {viewEmp.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                onClick={() => { toast.success(`✉️ Message envoyé à ${viewEmp.name}`); setViewEmp(null) }}>
                ✉️ Contacter
              </button>
              <button className="btn btn-ghost"
                onClick={() => { toast(`🏖️ Demande de congé créée pour ${viewEmp.name}`); setViewEmp(null) }}>
                🏖️ Poser congé
              </button>
              <button className="btn btn-ghost" onClick={() => setViewEmp(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouvel employé ── */}
      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>➕ Nouvel employé</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Nom complet',         key: 'name',     type: 'text',   span: true  },
                { label: 'Téléphone',            key: 'phone',    type: 'text',   span: false },
                { label: 'Email',                key: 'email',    type: 'email',  span: false },
                { label: 'Date d\'embauche',     key: 'hireDate', type: 'date',   span: false },
                { label: 'Salaire mensuel (XOF)',key: 'salary',   type: 'number', span: false },
              ] as const).map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--text3)' }}>{f.label}</label>
                  <input className="input text-sm" type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? +e.target.value : e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Rôle</label>
                <select className="input text-sm" value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value as Role }))}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
                <textarea className="input text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={addEmployee}>
                ✅ {t('btn_add')} l'employé
              </button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
