import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount } from '@/stores/appStore'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { employeesApi } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { exportCSV } from '@/utils/export'
import {
  buildMonths, monthLabel, currentMonthLabel, PAY_COLORS,
  roleLabel, statusLabel, calcNet, calcBrut, printBulletin,
  type PayRecord, type PayStatus,
} from '@/components/payroll/payrollShared'
import PayrollKpis from '@/components/payroll/PayrollKpis'
import PayrollTable from '@/components/payroll/PayrollTable'
import BulletinModal from '@/components/payroll/BulletinModal'

// Ré-export pour la rétro-compat des imports/tests existants (payroll-months.test.ts).
export { buildMonths, monthLabel }

export default function Payroll() {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const navigate = useNavigate()

  const [records, setRecords]       = useState<PayRecord[]>([])
  const [month, setMonth]           = useState(currentMonthLabel)
  const [bulletin, setBulletin]     = useState<PayRecord | null>(null)

  useEffect(() => {
    employeesApi.list()
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return
        setRecords(data
          .filter((e: any) => (e.active ?? e.isActive ?? e.status !== 'inactive'))
          .map((e: any, i: number) => {
            const name = e.name ?? (`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || (lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'))
            return {
              id: typeof e.id === 'number' ? e.id : i + 1,
              employee: name,
              avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
              color: PAY_COLORS[i % PAY_COLORS.length],
              role: e.role ?? e.position ?? 'Employé',
              baseSalary: Number(e.salary ?? e.baseSalary ?? 0),
              bonus: 0, overtime: 0, deductions: 0, absences: 0,
              status: 'EN ATTENTE' as PayStatus, paidAt: null, month: currentMonthLabel,
            }
          }))
      })
      .catch(() => {})
  }, [])

  const filtered = records.filter(r => r.month === month)

  const totalBrut = records.reduce((s, r) => s + calcBrut(r), 0)
  const totalNet  = records.reduce((s, r) => s + calcNet(r), 0)
  const generated = records.filter(r => r.status === 'GÉNÉRÉ' || r.status === 'PAYÉ').length
  const paid      = records.filter(r => r.status === 'PAYÉ').length

  function generatePayroll() {
    const count = records.filter(r => r.month === month && r.status === 'EN ATTENTE').length
    if (count === 0) { toast.error(lang === 'en' ? 'No pending payslips for this month' : lang === 'es' ? 'Sin nóminas pendientes este mes' : lang === 'it' ? 'Nessuna busta paga in attesa per questo mese' : 'Aucun bulletin en attente pour ce mois'); return }
    setRecords(prev => prev.map(r =>
      r.month === month && r.status === 'EN ATTENTE' ? { ...r, status: 'GÉNÉRÉ' } : r
    ))
    toast.success(lang === 'en' ? `${count} payslip(s) generated for ${monthLabel(month, lang)}` : lang === 'es' ? `${count} nómina(s) generada(s) para ${monthLabel(month, lang)}` : lang === 'it' ? `${count} busta/e paga generata/e per ${monthLabel(month, lang)}` : `${count} bulletin(s) généré(s) pour ${monthLabel(month, lang)}`)
  }

  function markPaid(id: number) {
    setRecords(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'PAYÉ', paidAt: '14/05/2026' } : r
    ))
    toast.success(lang === 'en' ? 'Payslip marked as paid' : lang === 'es' ? 'Nómina marcada como pagada' : lang === 'it' ? 'Busta paga segnata come pagata' : 'Bulletin marqué comme payé')
  }

  const exportPayrollCSV = () => {
    exportCSV('habashop_paie',
      [
        lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé',
        lang === 'en' ? 'Role' : lang === 'es' ? 'Puesto' : lang === 'it' ? 'Ruolo' : 'Poste',
        lang === 'en' ? 'Base salary' : lang === 'es' ? 'Salario base' : lang === 'it' ? 'Stipendio base' : 'Salaire base',
        lang === 'en' ? 'Bonuses' : lang === 'es' ? 'Primas' : lang === 'it' ? 'Premi' : 'Primes',
        lang === 'en' ? 'Overtime' : lang === 'es' ? 'Horas extra' : lang === 'it' ? 'Straordinari' : 'Heures sup',
        lang === 'en' ? 'Deductions' : lang === 'es' ? 'Deducciones' : lang === 'it' ? 'Detrazioni' : 'Retenues',
        lang === 'en' ? 'Absences' : lang === 'es' ? 'Ausencias' : lang === 'it' ? 'Assenze' : 'Absences',
        'Net',
        lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut',
      ],
      records.map(r => {
        const net = r.baseSalary + r.bonus + r.overtime - r.deductions - (r.absences * Math.round(r.baseSalary / 26))
        return [r.employee, roleLabel(r.role, lang), r.baseSalary, r.bonus, r.overtime, r.deductions, r.absences, net, statusLabel(r.status, lang)]
      })
    )
    toast.success(lang === 'en' ? '📊 CSV export downloaded!' : lang === 'es' ? '📊 ¡Exportación CSV descargada!' : lang === 'it' ? '📊 Esportazione CSV scaricata!' : '📊 Export CSV téléchargé !')
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'en' ? 'Payroll' : lang === 'es' ? 'Nómina y salarios' : lang === 'it' ? 'Buste paga e stipendi' : 'Paie & Salaires'}</h1>
          <p className="page-subtitle">{lang === 'en' ? `Period: ${monthLabel(month, lang)}` : lang === 'es' ? `Período: ${monthLabel(month, lang)}` : lang === 'it' ? `Periodo: ${monthLabel(month, lang)}` : `Période : ${monthLabel(month, lang)}`}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          exportCSV('paie_' + month, [lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé', lang === 'en' ? 'Gross' : lang === 'es' ? 'Bruto' : lang === 'it' ? 'Lordo' : 'Brut', 'Net', lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'], records.map(r => [r.employee, calcBrut(r), calcNet(r), statusLabel(r.status, lang)]))
          toast.success(lang === 'en' ? 'CSV exported' : lang === 'es' ? 'CSV exportado' : lang === 'it' ? 'CSV esportato' : 'CSV exporté')
        }}>
          <Download size={14} /> Export
        </button>
      </div>

      <PayrollKpis
        totalBrut={totalBrut}
        totalNet={totalNet}
        generated={generated}
        paid={paid}
        totalCount={records.length}
      />

      {records.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="💰"
            title={lang === 'en' ? 'No payroll data' : lang === 'es' ? 'Sin datos de nómina' : lang === 'it' ? 'Nessun dato busta paga' : 'Aucune donnée de paie'}
            message={lang === 'en' ? 'Add employees with their salaries to manage payroll.' : lang === 'es' ? 'Agregue empleados con sus salarios para gestionar la nómina.' : lang === 'it' ? 'Aggiungi dipendenti con i loro stipendi per gestire le buste paga.' : 'Ajoutez des employés avec leurs salaires pour gérer la paie.'}
            action={{ label: lang === 'en' ? 'Manage employees' : lang === 'es' ? 'Gestionar empleados' : lang === 'it' ? 'Gestisci dipendenti' : 'Gérer les employés', onClick: () => navigate('/app/hr') }}
          />
        </div>
      ) : (
        <PayrollTable
          month={month}
          setMonth={setMonth}
          filtered={filtered}
          onExportCSV={exportPayrollCSV}
          onGenerate={generatePayroll}
          onView={setBulletin}
          onMarkPaid={markPaid}
          onPrintPDF={(r) => { printBulletin(r); toast.success(lang === 'en' ? '📄 PDF opened!' : lang === 'es' ? '📄 ¡PDF abierto!' : lang === 'it' ? '📄 PDF aperto!' : '📄 PDF ouvert !') }}
        />
      )}

      {/* Modal bulletin */}
      {bulletin && (
        <BulletinModal
          record={bulletin}
          onClose={() => setBulletin(null)}
          onPay={markPaid}
          fmt={fmt}
        />
      )}
    </div>
  )
}
