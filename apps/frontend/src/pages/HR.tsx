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
import Pagination from '@/components/ui/Pagination'
import { logger } from '@/lib/logger'
import { confirm } from '@/lib/confirm'
import HRStatsBar from '@/components/hr/HRStatsBar'
import { usePagination } from '@/hooks/usePagination'

import HREmployeeGrid from '@/components/hr/HREmployeeGrid'
import HRTabs from '@/components/hr/HRTabs'
import HRModals from '@/components/hr/HRModals'
import { type Employee, type LeaveRequest, STATIC_EMPLOYEES, LEAVE_INIT, COLORS, toInputDate } from '@/components/hr/hrShared'

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
      color:       emp.color       ?? 'var(--p)',
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
        logger.log('✅ Bonuses chargés:', agg)
      })
      .catch(err => logger.warn('bonuses load:', err.message))

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
        logger.log('✅ Salary history chargé:', normalized.length)
      })
      .catch(err => logger.warn('salary-history load:', err.message))
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
  const pg = usePagination(filtered, 12)
  useEffect(() => { pg.reset() }, [search, deptFilter, filterStatus])

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
      <HRStatsBar employees={employees} activeCount={activeCount} totalPayroll={totalPayroll} pendingLeaves={pendingLeaves} fmt={fmt} lang={lang} />

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

      {tab === 'team' && (
        <HREmployeeGrid
          search={search} setSearch={setSearch}
          deptFilter={deptFilter} setDeptFilter={setDeptFilter}
          depts={depts}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          viewMode={viewMode} setViewMode={setViewMode}
          setSelectedEmp={setSelectedEmp} setShowModal={setShowModal}
          loadingEmployees={loadingEmployees}
          pg={pg}
          openEditModal={openEditModal}
          filtered={filtered}
          fmt={fmt} lang={lang}
        />
      )}

      <HRTabs
        tab={tab}
        employees={employees}
        fmt={fmt} lang={lang}
        payTab={payTab} setPayTab={setPayTab}
        payrollMonth={payrollMonth} setPayrollMonth={setPayrollMonth}
        bonuses={bonuses} setBonuses={setBonuses}
        bonusList={bonusList} setBonusList={setBonusList}
        salaryHistory={salaryHistory}
        generateAllPayslips={generateAllPayslips}
        generatePayslipPDF={generatePayslipPDF}
        setSalaryTarget={setSalaryTarget} setShowSalaryModal={setShowSalaryModal}
        setSelectedContract={setSelectedContract} setShowContractDetailModal={setShowContractDetailModal}
        setContractForm={setContractForm} setShowNewContractModal={setShowNewContractModal}
        attendance={attendance} setAttendance={setAttendance}
        attendanceDate={attendanceDate} setAttendanceDate={setAttendanceDate}
        pendingLeaves={pendingLeaves}
        leaves={leaves}
        setLeaveForm={setLeaveForm} setShowLeaveModal={setShowLeaveModal}
        handleLeaveAction={handleLeaveAction}
      />

      <HRModals
        showSalaryModal={showSalaryModal} setShowSalaryModal={setShowSalaryModal}
        salaryTarget={salaryTarget}
        fmt={fmt} lang={lang}
        employees={employees} setEmployees={setEmployees}
        handleConfirmRaise={handleConfirmRaise} handleConfirmBonus={handleConfirmBonus}
        showModal={showModal} setShowModal={setShowModal}
        showEditEmpModal={showEditEmpModal} setShowEditEmpModal={setShowEditEmpModal}
        selectedEmp={selectedEmp}
        editEmpForm={editEmpForm} setEditEmpForm={setEditEmpForm}
        empEditMode={empEditMode} setEmpEditMode={setEmpEditMode}
        salaryInput={salaryInput} setSalaryInput={setSalaryInput}
        toXOF={toXOF} currency={currency} currencySymbol={currencySymbol}
        openEditModal={openEditModal}
        showNewContractModal={showNewContractModal} setShowNewContractModal={setShowNewContractModal}
        contractForm={contractForm} setContractForm={setContractForm}
        showContractDetailModal={showContractDetailModal} setShowContractDetailModal={setShowContractDetailModal}
        selectedContract={selectedContract}
        showLeaveModal={showLeaveModal} setShowLeaveModal={setShowLeaveModal}
        leaveForm={leaveForm} setLeaveForm={setLeaveForm}
        setLeaves={setLeaves}
      />
    </div>
  )
}
