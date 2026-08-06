import { useState, useMemo, useEffect } from 'react'
import React from 'react'
import { useFormatAmount, useConvertToXOF, useConvertFromXOF, useCurrencyInfo, useAppStore } from '@/stores/appStore'
import { employeesApi, bonusesApi, salaryHistoryApi, attendanceApi, leaveRequestsApi } from '@/lib/api'
import { exportCSV } from '@/utils/export'
import { Download, Plus, X, Users, DollarSign, FileText, TrendingUp, Star, Pencil, Clock, Umbrella, Search, LayoutGrid, AlignJustify, CheckCircle, XCircle, AlertTriangle, Gift, Trash2, BarChart3, Calendar, User, Eye, CheckCheck, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import ViewField from '@/components/ui/ViewField'
import ValidatedInput from '@/components/ui/ValidatedInput'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import Pagination from '@/components/ui/Pagination'
import Tabs from '@/components/ui/TabBar'
import { logger } from '@/lib/logger'
import { confirm } from '@/lib/confirm'
import HRStatsBar from '@/components/hr/HRStatsBar'
import { usePagination } from '@/hooks/usePagination'

import HREmployeeGrid from '@/components/hr/HREmployeeGrid'
import HRTabs from '@/components/hr/HRTabs'
import HRModals from '@/components/hr/HRModals'
import EmptyState from '@/components/ui/EmptyState'
import { type Employee, type LeaveRequest, type AttendUiStatus, type ContractForm, type LeaveForm, COLORS, toInputDate, roleLabel, deptLabel, contractLabel, attendStatusToApi, attendStatusFromApi, mapApiLeave } from '@/components/hr/hrShared'
// ⚠️ Taux et calcul de paie : SOURCE UNIQUE (`payrollShared`). Ce fichier codait 0.08/0.05
// en dur — 6 fichiers le faisaient, donc 6 endroits à corriger au prochain changement de loi.
import { payRecordFromEmployee, printBulletin } from '@/components/payroll/payrollShared'

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HR() {
  const fmt    = useFormatAmount()
  const toXOF  = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
  const { symbol: currencySymbol, decimals: currencyDecimals } = useCurrencyInfo()
  const { lang, currency, tenant } = useAppStore()
  // Devise officielle de la boutique (salaire contractuel) ≠ devise d'affichage locale.
  const tenantCurrency = tenant?.currency ?? 'XOF'
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const [salaryInput, setSalaryInput] = useState('')
  const [tab, setTab] = useState<'team'|'contracts'|'pointage'|'leaves'|'payroll'>('team')
  const [viewMode, setViewMode] = useState<'grid'|'table'>('grid')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [leavesLoading, setLeavesLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [showEditEmpModal, setShowEditEmpModal] = useState(false)
  const [empEditMode, setEmpEditMode] = useState(false)
  const [editEmpForm, setEditEmpForm] = useState<any>({})

  // Contracts
  const [showNewContractModal, setShowNewContractModal] = useState(false)
  const [showContractDetailModal, setShowContractDetailModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Employee | null>(null)
  const [contractForm, setContractForm] = useState<ContractForm>({ empId: '', type: 'CDI', hiredAt: new Date().toISOString().split('T')[0], contractEnd: '', salary: 0, role: '', dept: 'Ventes' })

  // Payroll
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))
  const [payTab, setPayTab] = useState<'grid'|'payslip'|'bonuses'|'history'>('grid')
  const [bonuses, setBonuses] = useState<Record<string, number>>({})
  const [bonusList, setBonusList] = useState<{id:string; empId:string; amount:number; reason:string; date:string}[]>([])
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [salaryTarget, setSalaryTarget] = useState<any>(null)
  const [salaryHistory, setSalaryHistory] = useState<{id?:string; empId:string; date:string; oldSalary:number; newSalary:number; reason:string}[]>([])

  // Présences / Pointage — Phase 2 : source de vérité = backend (/api/attendance), plus de
  // localStorage. État keyé `${empId}_${date}` (status UI minuscule), chargé par mois.
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<Record<string, { in: string|null; out: string|null; status: AttendUiStatus }>>({})

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState<LeaveForm>({
    empId: '' as string | number,  // id employé (cuid string en prod ; '' = aucun)
    type: lang === 'en' ? 'Annual leave' : lang === 'es' ? 'Permiso anual' : lang === 'it' ? 'Ferie annuali' : 'Congé annuel',
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
      // ⚠️ `?? 3` réintroduisait la valeur par défaut du schéma côté ÉCRAN : une note
      // jamais saisie redevenait 3 après la migration qui l'a rendue nullable.
      perf:        emp.perf        ?? null,
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
      .then((data) => {
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
      .then((data) => {
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
      .then((data) => {
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

  // Phase 6 — charge les demandes de congé depuis l'API (remplace l'état in-memory).
  useEffect(() => {
    setLeavesLoading(true)
    leaveRequestsApi.list()
      .then(rows => { if (Array.isArray(rows)) setLeaves(rows.map(mapApiLeave)) })
      .catch(() => toast.error(lang === 'en' ? 'Failed to load leave requests' : lang === 'es' ? 'Error al cargar permisos' : lang === 'it' ? 'Caricamento ferie fallito' : 'Échec du chargement des congés'))
      .finally(() => setLeavesLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => { setSelectedEmp(null); setShowModal(true) }
    window.addEventListener('habashop:new-employee', handler)
    return () => window.removeEventListener('habashop:new-employee', handler)
  }, [])

  // Charge les présences du MOIS de la date sélectionnée depuis le backend (remplace les
  // entrées de ce mois ; clé `${empId}_${date}`). Refetch au changement de mois.
  const attendanceMonth = attendanceDate.slice(0, 7) // "YYYY-MM"
  useEffect(() => {
    let cancelled = false
    attendanceApi.list(attendanceMonth)
      .then(rows => {
        if (cancelled || !Array.isArray(rows)) return
        const map: Record<string, { in: string|null; out: string|null; status: AttendUiStatus }> = {}
        for (const r of rows) {
          map[`${r.employeeId}_${r.date}`] = {
            in: r.arriveTime ?? null, out: r.departTime ?? null, status: attendStatusFromApi(r.status),
          }
        }
        // Remplace les clés du mois courant (clé `${empId}_${YYYY-MM}-DD`), conserve les autres mois.
        setAttendance(prev => {
          const kept = Object.fromEntries(Object.entries(prev).filter(([k]) => !k.includes(`_${attendanceMonth}-`)))
          return { ...kept, ...map }
        })
      })
      .catch(() => { /* lecture best-effort */ })
    return () => { cancelled = true }
  }, [attendanceMonth])

  // Enregistre une entrée de présence : MAJ optimiste locale + upsert backend (status → API).
  // En cas d'échec : ROLLBACK atomique (restaure l'entrée précédente, ou retire la clé si
  // c'était une nouvelle entrée) → état local recollé à la DB, pas d'incohérence persistante.
  const saveAttendance = (empId: string, date: string, entry: { in: string|null; out: string|null; status: AttendUiStatus }) => {
    const key = `${empId}_${date}`
    const prevEntry = attendance[key] // valeur avant l'édition (closure = état au rendu courant)
    setAttendance(prev => ({ ...prev, [key]: entry }))
    attendanceApi.upsert({
      employeeId: empId, date, status: attendStatusToApi[entry.status],
      arriveTime: entry.in, departTime: entry.out,
    }).catch(() => {
      setAttendance(prev => {
        const next = { ...prev }
        if (prevEntry === undefined) delete next[key] // était une nouvelle entrée → on l'enlève
        else next[key] = prevEntry                    // sinon → on restaure l'ancienne
        return next
      })
      toast.error(i('Échec de l\'enregistrement de la présence', 'Failed to save attendance', 'Error al guardar la asistencia', 'Salvataggio presenza fallito'))
    })
  }

  const depts = useMemo(() => Array.from(new Set(employees.map(e => e.dept))), [employees])

  const handleConfirmRaise = async (empId: string, newSalaryXOF: number, reason: string) => {
    const emp = employees.find(e => String(e.id) === empId)
    const oldSalaryXOF = Number(emp?.salary) || 0
    const finalReason = reason || i('Augmentation', 'Salary increase', 'Aumento', 'Aumento')

    try {
      await employeesApi.update(empId, { salary: newSalaryXOF })
      const entry = await salaryHistoryApi.create({
        employeeId: empId,
        oldSalary: oldSalaryXOF,
        newSalary: newSalaryXOF,
        reason: finalReason,
      })

      setEmployees((prev: Employee[]) => prev.map(e =>
        String(e.id) === empId ? { ...e, salary: newSalaryXOF } : e
      ))
      setSalaryHistory(prev => [{
        id: entry.id,
        empId,
        employeeId: empId,
        oldSalary: oldSalaryXOF,
        newSalary: newSalaryXOF,
        reason: finalReason,
        date: entry.date ?? new Date().toISOString(),
      }, ...prev])

      toast.success(i(
        `Salaire mis à jour : ${fmt(newSalaryXOF)}`,
        `Salary updated: ${fmt(newSalaryXOF)}`,
        `Salario actualizado: ${fmt(newSalaryXOF)}`,
        `Stipendio aggiornato: ${fmt(newSalaryXOF)}`,
      ))
      setShowSalaryModal(false)
    } catch (err: any) {
      console.warn('raise failed:', err?.message)
      toast.error(i(
        'Échec de la mise à jour — réessayer',
        'Update failed — please retry',
        'Error al actualizar — reintentar',
        'Aggiornamento fallito — riprovare',
      ))
    }
  }

  const handleConfirmBonus = async (_empId: string | 'all', amountXOF: number, type: string) => {
    const targets = _empId === 'all'
      ? employees.filter(e => e.active !== false)
      : employees.filter(e => String(e.id) === _empId)
    const finalReason = type || i('Prime', 'Bonus', 'Prima', 'Premio')

    const results = await Promise.allSettled(
      targets.map(emp => bonusesApi.create({
        employeeId: String(emp.id),
        amount: amountXOF,
        reason: finalReason,
        date: new Date().toISOString(),
      }))
    )

    const created = results
      .map((r, idx) => r.status === 'fulfilled' ? { res: r.value, eid: String(targets[idx].id) } : null)
      .filter((x): x is { res: any; eid: string } => x !== null)
    const failed = results.length - created.length

    if (created.length > 0) {
      setBonusList(prev => [...prev, ...created.map(({ res, eid }) => ({
        id: res.id, empId: eid, amount: amountXOF, reason: res.reason ?? finalReason, date: res.date,
      }))])
      setBonuses(prev => {
        const next = { ...prev }
        for (const { eid } of created) next[eid] = (next[eid] ?? 0) + amountXOF
        return next
      })
    }

    if (failed === 0 && created.length > 0) {
      if (_empId === 'all') {
        toast.success(i(
          `Prime collective ${fmt(amountXOF)} (${created.length})`,
          `Group bonus ${fmt(amountXOF)} (${created.length})`,
          `Prima colectiva ${fmt(amountXOF)} (${created.length})`,
          `Premio collettivo ${fmt(amountXOF)} (${created.length})`,
        ))
      } else {
        toast.success(i(
          `Prime de ${fmt(amountXOF)} ajoutée`,
          `Bonus of ${fmt(amountXOF)} added`,
          `Prima de ${fmt(amountXOF)} añadida`,
          `Premio di ${fmt(amountXOF)} aggiunto`,
        ))
      }
      setShowSalaryModal(false)
    } else if (created.length > 0 && failed > 0) {
      toast.error(i(
        `Échecs partiels : ${failed}/${results.length} primes non enregistrées`,
        `Partial failures: ${failed}/${results.length} bonuses not saved`,
        `Fallos parciales: ${failed}/${results.length} primas no guardadas`,
        `Fallimenti parziali: ${failed}/${results.length} premi non salvati`,
      ))
    } else {
      toast.error(i(
        "Échec de l'ajout — réessayer",
        'Failed to add — please retry',
        'Error al agregar — reintentar',
        'Aggiunta fallita — riprovare',
      ))
    }
  }

  const handleDeleteSalaryHistory = async (id: string) => {
    if (!id || id.startsWith('local_')) {
      // Entrée pas encore persistée — retrait local seul (rare, ne devrait plus arriver après refactor).
      setSalaryHistory(prev => prev.filter(h => h.id !== id))
      return
    }
    const ok = await confirm({
      title: i('Supprimer cette révision ?', 'Delete this revision?', '¿Eliminar esta revisión?', 'Eliminare questa revisione?'),
      message: i(
        "Cette entrée d'historique sera supprimée définitivement. Le salaire actuel de l'employé n'est pas modifié.",
        "This history entry will be deleted permanently. The employee's current salary is not changed.",
        'Esta entrada del historial se eliminará permanentemente. El salario actual del empleado no cambia.',
        'Questa voce di cronologia sarà eliminata definitivamente. Lo stipendio attuale del dipendente non cambia.',
      ),
      danger: true,
    })
    if (!ok) return
    try {
      await salaryHistoryApi.delete(id)
      setSalaryHistory(prev => prev.filter(h => h.id !== id))
      toast.success(i('Révision supprimée', 'Revision deleted', 'Revisión eliminada', 'Revisione eliminata'))
    } catch (err: any) {
      console.warn('salary-history delete:', err?.message)
      toast.error(i('Échec de la suppression', 'Deletion failed', 'Error al eliminar', 'Eliminazione fallita'))
    }
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

  // ⚠️ Somme en XOF puis UNE conversion à l'affichage (via `fmt`). L'écran Paie fait
  // l'INVERSE — somme des lignes déjà converties — et c'est voulu là-bas : un bulletin liste
  // des lignes et annonce un total qui doit s'additionner (cf. `PayrollTable.tsx:30` et le
  // verrou `payrollConvertOnce.test.ts`). Les deux écrans peuvent donc différer d'un CENTIME
  // sur la même masse salariale (2 530,65 ici, 2 530,66 en Paie). Ce n'est PAS un bug :
  // deux arrondis corrects dans deux contextes différents. NE PAS « aligner » l'un sur
  // l'autre sans traiter la convention de la Paie — c'est elle qui fait foi devant un employé.
  const totalPayroll = useMemo(() => (employees ?? []).filter(e => e.active).reduce((s, e) => s + e.salary, 0), [employees])
  const activeCount  = useMemo(() => (employees ?? []).filter(e => e.active).length, [employees])
  const pendingLeaves = useMemo(() => (leaves ?? []).filter(l => l.status === 'pending').length, [leaves])

  // ⚠️ `generatePayslipPDF` (template RH maison, ~90 lignes) est SUPPRIMÉ. Il dupliquait le
  // bulletin de la page Paie avec un logo en TEXTE, des taux en dur dans les libellés, et un
  // contrat d'entrée ambigu : montants XOF depuis « Générer tous », montants DÉJÀ CONVERTIS
  // depuis les cartes, puis reconversion par `fmt` → NET 0,57 € au lieu de 371,37 € (mesuré).
  // Un seul générateur désormais : `printBulletin`, qui passe par `payrollDisplay`.

  const generateAllPayslips = () => {
    const actifs = employees.filter(e => e.active !== false)
    actifs.forEach((emp, i) => {
      // Un seul chemin : l'adaptateur produit un PayRecord, `printBulletin` fait le reste
      // (conversion UNE fois via `payrollDisplay`, lignes/total/net cohérents).
      const record = payRecordFromEmployee(emp, bonuses[String(emp.id)] ?? 0, payrollMonth)
      setTimeout(() => {
        printBulletin(record)
      }, i * 300)
    })
    toast.success(lang === 'en' ? `${actifs.length} payslips generated!` : lang === 'es' ? `${actifs.length} nóminas generadas !` : lang === 'it' ? `${actifs.length} buste paga generate !` : `${actifs.length} bulletins générés !`)
  }

  // Phase 6 — approbation/refus via l'API. Le backend /approve crée déjà le Shift Congé +
  // l'Attendance LEAVE (eachDateInclusive) → plus de writeLeaveShiftsToPlanning ni d'upsert
  // Attendance côté front. MAJ optimiste du statut local + revert si l'API échoue.
  async function handleLeaveAction(id: string, status: 'approved' | 'refused') {
    const prev = leaves
    setLeaves(p => p.map(l => l.id === id ? { ...l, status } : l))
    try {
      await (status === 'approved' ? leaveRequestsApi.approve(id) : leaveRequestsApi.refuse(id))
      toast.success(status === 'approved'
        ? (lang === 'en' ? 'Leave approved' : lang === 'es' ? 'Permiso aprobado' : lang === 'it' ? 'Ferie approvate' : 'Congé approuvé')
        : (lang === 'en' ? 'Leave refused' : lang === 'es' ? 'Permiso rechazado' : lang === 'it' ? 'Ferie rifiutate' : 'Congé refusé'))
      announce(status === 'approved'
        ? (lang === 'en' ? 'Leave approved' : lang === 'es' ? 'Permiso aprobado' : lang === 'it' ? 'Ferie approvate' : 'Congé approuvé')
        : (lang === 'en' ? 'Leave refused' : lang === 'es' ? 'Permiso rechazado' : lang === 'it' ? 'Ferie rifiutate' : 'Congé refusé'))
    } catch {
      setLeaves(prev) // revert : l'API a échoué
      toast.error(lang === 'en' ? 'Action failed' : lang === 'es' ? 'Acción fallida' : lang === 'it' ? 'Azione fallita' : 'Échec de l\'action')
    }
  }

  // Crée une demande de congé via l'API (depuis la modale) → ajoute au state.
  async function createLeave(form: { empId: string | number; type: string; startDate: string; endDate: string; notes: string }) {
    try {
      const r = await leaveRequestsApi.create({
        employeeId: String(form.empId), startDate: form.startDate, endDate: form.endDate,
        leaveType: form.type, reason: form.notes || null,
      })
      const created = mapApiLeave(r)
      // empName depuis l'employé local si l'API ne le renvoie pas
      if (!created.empName) created.empName = employees.find(e => String(e.id) === String(form.empId))?.name
      setLeaves(p => [created, ...p])
      toast.success(lang === 'en' ? 'Request submitted!' : lang === 'es' ? '¡Solicitud enviada!' : lang === 'it' ? 'Richiesta inviata!' : 'Demande soumise !')
    } catch {
      toast.error(lang === 'en' ? 'Submission failed' : lang === 'es' ? 'Envío fallido' : lang === 'it' ? 'Invio fallito' : 'Échec de la soumission')
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'en' ? 'Human Resources' : lang === 'es' ? 'Recursos Humanos' : lang === 'it' ? 'Risorse Umane' : 'Ressources Humaines'}
          </h1>
          <p className="page-subtitle">
            {employees.length} {lang === 'en' ? 'employees' : lang === 'es' ? 'empleados' : lang === 'it' ? 'dipendenti' : 'employés'} · {activeCount} {lang === 'en' ? 'active' : lang === 'es' ? 'activos' : lang === 'it' ? 'attivi' : 'actifs'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            exportCSV('RH', [
              lang === 'en' ? 'Name' : lang === 'es' ? 'Nombre' : lang === 'it' ? 'Nome' : 'Nom',
              lang === 'en' ? 'Role' : lang === 'es' ? 'Rol' : lang === 'it' ? 'Ruolo' : 'Rôle',
              lang === 'en' ? 'Department' : lang === 'es' ? 'Departamento' : lang === 'it' ? 'Dipartimento' : 'Département',
              lang === 'en' ? 'Contract' : lang === 'es' ? 'Contrato' : lang === 'it' ? 'Contratto' : 'Contrat',
              `${lang === 'en' ? 'Salary' : lang === 'es' ? 'Salario' : lang === 'it' ? 'Stipendio' : 'Salaire'} (${currency})`,
              lang === 'en' ? 'Hire date' : lang === 'es' ? 'Contratación' : lang === 'it' ? 'Assunzione' : 'Embauche',
              lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut',
            ],
              // Salaires stockés en base XOF → convertis vers la devise d'affichage
              employees.map(e => [e.name, roleLabel(e.role, lang), deptLabel(e.dept, lang), contractLabel(e.type, lang), Math.round(fromXOF(e.salary ?? 0) * 100) / 100, e.hiredAt, e.active ? (lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif') : (lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')]))
            toast.success(lang === 'en' ? 'CSV exported' : lang === 'es' ? 'CSV exportado' : lang === 'it' ? 'CSV esportato' : 'CSV exporté')
          }}>
            <Download size={14} /> Export
          </button>
          <button className="topbar-btn" onClick={() => { setSelectedEmp(null); setShowModal(true) }}>
            <Plus size={14} /> {lang === 'en' ? 'Add' : lang === 'es' ? 'Agregar' : lang === 'it' ? 'Aggiungi' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <HRStatsBar employees={employees} activeCount={activeCount} totalPayroll={totalPayroll} pendingLeaves={pendingLeaves} fmt={fmt} lang={lang} />

      {/* Tabs */}
      <Tabs
        variant="segmented"
        ariaLabel={lang === 'en' ? 'HR sections' : lang === 'es' ? 'Secciones RRHH' : lang === 'it' ? 'Sezioni HR' : 'Sections RH'}
        value={tab}
        onChange={id => setTab(id as typeof tab)}
        tabs={[
          { id: 'team',      icon: <Users size={13}/>,      label: lang === 'en' ? 'Team' : lang === 'es' ? 'Equipo' : lang === 'it' ? 'Squadra' : 'Équipe' },
          { id: 'contracts', icon: <FileText size={13}/>,   label: lang === 'en' ? 'Contracts' : lang === 'es' ? 'Contratos' : lang === 'it' ? 'Contratti' : 'Contrats' },
          { id: 'pointage',  icon: <Clock size={13}/>,      label: lang === 'en' ? 'Attendance' : lang === 'es' ? 'Asistencia' : lang === 'it' ? 'Presenze' : 'Présences' },
          { id: 'leaves',    icon: <Umbrella size={13}/>,   label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {lang === 'en' ? 'Leaves' : lang === 'es' ? 'Permisos' : lang === 'it' ? 'Ferie' : 'Congés'}
              {pendingLeaves > 0 && (
                <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', background: 'var(--acc)', color: '#000', borderRadius: 20, padding: '1px 6px', lineHeight: 1.5 }}>{pendingLeaves}</span>
              )}
            </span>
          ) },
          { id: 'payroll',   icon: <DollarSign size={13}/>, label: lang === 'en' ? 'Payroll' : lang === 'es' ? 'Remuneración' : lang === 'it' ? 'Retribuzione' : 'Rémunération' },
        ]}
      />

      {tab === 'team' && employees.length === 0 && !loadingEmployees ? (
        <div className="panel">
          <EmptyState
            icon={<Users size={40} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />}
            title={lang === 'en' ? 'No employees' : lang === 'es' ? 'Sin empleados' : lang === 'it' ? 'Nessun dipendente' : 'Aucun employé'}
            message={lang === 'en' ? 'Add your first employee to start managing your team.' : lang === 'es' ? 'Agregue su primer empleado para empezar a gestionar su equipo.' : lang === 'it' ? 'Aggiungi il tuo primo dipendente per iniziare a gestire la squadra.' : 'Ajoutez votre premier employé pour commencer à gérer votre équipe.'}
            action={{ label: lang === 'en' ? '+ Add an employee' : lang === 'es' ? '+ Agregar un empleado' : lang === 'it' ? '+ Aggiungi un dipendente' : '+ Ajouter un employé', onClick: () => { setSelectedEmp(null); setShowModal(true) } }}
          />
        </div>
      ) : tab === 'team' && (
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
        onDeleteSalaryHistory={handleDeleteSalaryHistory}
        generateAllPayslips={generateAllPayslips}
        setSalaryTarget={setSalaryTarget} setShowSalaryModal={setShowSalaryModal}
        setSelectedContract={setSelectedContract} setShowContractDetailModal={setShowContractDetailModal}
        setContractForm={setContractForm} setShowNewContractModal={setShowNewContractModal}
        attendance={attendance} onSaveAttendance={saveAttendance}
        attendanceDate={attendanceDate} setAttendanceDate={setAttendanceDate}
        pendingLeaves={pendingLeaves}
        leaves={leaves} leavesLoading={leavesLoading}
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
        toXOF={toXOF} currency={currency} currencySymbol={currencySymbol} tenantCurrency={tenantCurrency}
        openEditModal={openEditModal}
        showNewContractModal={showNewContractModal} setShowNewContractModal={setShowNewContractModal}
        contractForm={contractForm} setContractForm={setContractForm}
        showContractDetailModal={showContractDetailModal} setShowContractDetailModal={setShowContractDetailModal}
        selectedContract={selectedContract}
        showLeaveModal={showLeaveModal} setShowLeaveModal={setShowLeaveModal}
        leaveForm={leaveForm} setLeaveForm={setLeaveForm}
        onSubmitLeave={createLeave}
      />
    </div>
  )
}
