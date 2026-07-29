import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, CURRENCY_DECIMALS } from '@/stores/appStore'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { employeesApi, payrollApi } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/skeleton'
import { exportCSV } from '@/utils/export'
import {
  buildMonths, monthLabel, monthKey, currentMonthLabel, PAY_COLORS,
  roleLabel, statusLabel, calcNet, calcBrut, printBulletin, payrollDisplay,
  PENDING_PREFIX, isPending,
  type PayRecord, type PayStatus,
} from '@/components/payroll/payrollShared'
import PayrollKpis from '@/components/payroll/PayrollKpis'
import PayrollTable from '@/components/payroll/PayrollTable'
import BulletinModal from '@/components/payroll/BulletinModal'

// Ré-export pour la rétro-compat des imports/tests existants (payroll-months.test.ts).
export { buildMonths, monthLabel }

export default function Payroll() {
  const { lang, currency } = useConfig()
  const fmt = useFormatAmount()
  const navigate = useNavigate()

  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

  const [records, setRecords]       = useState<PayRecord[]>([])
  const [month, setMonth]           = useState(currentMonthLabel)
  const [bulletin, setBulletin]     = useState<PayRecord | null>(null)
  const [loading, setLoading]       = useState(true)

  const loadErr = () => toast.error(lang === 'en' ? 'Could not load payroll data — please retry' : lang === 'es' ? 'No se pudieron cargar los datos de nómina — reintenta' : lang === 'it' ? 'Impossibile caricare i dati paghe — riprova' : 'Impossible de charger les données de paie — réessayer')

  /**
   * Fusionne les employés ACTIFS et les bulletins PERSISTÉS du mois affiché.
   *
   * ⚠️ Un bulletin persisté fait AUTORITÉ sur ses montants : ils ont été figés à la génération
   * (cf. `model Payroll`). On ne les recalcule PAS depuis `Employee.salary`, sinon une
   * augmentation réécrirait rétroactivement une paie déjà versée.
   * Un employé sans bulletin apparaît en « EN ATTENTE » avec un id `pending:<employeeId>` :
   * il est affiché, pas encore en base.
   */
  async function load(monthDisplay: string) {
    const key = monthKey(monthDisplay)
    if (!key) { loadErr(); setLoading(false); return }
    setLoading(true)
    try {
      const [employees, bulletins] = await Promise.all([
        employeesApi.list(),
        payrollApi.list(key),
      ])
      const parEmploye = new Map<string, any>((bulletins ?? []).map((b: any) => [b.employeeId, b]))
      const actifs = (Array.isArray(employees) ? employees : [])
        .filter((e: any) => (e.active ?? e.isActive ?? e.status !== 'inactive'))

      setRecords(actifs.map((e: any, i: number) => {
        const b = parEmploye.get(String(e.id))
        const name = (b?.employeeName ?? e.name ?? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim())
          || (lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé')
        return {
          id: b?.id ?? `${PENDING_PREFIX}${e.id}`,
          employeeId: String(e.id),
          employee: name,
          avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
          color: PAY_COLORS[i % PAY_COLORS.length],
          role: b?.role || e.role || e.position || 'Employé',
          // ⚠️ Montants FIGÉS s'ils existent ; sinon APERÇU depuis la fiche employé. Un bulletin
          // persisté fait autorité : ses cotisations ont été calculées au barème du jour de la
          // génération (`Payroll.cnss`/`ir` en base). Le recalcul ne sert qu'aux lignes
          // « EN ATTENTE », qui ne sont pas encore un bulletin.
          baseSalary: Number(b?.baseSalary ?? e.salary ?? e.baseSalary ?? 0),
          bonus:      Number(b?.bonus ?? 0),
          overtime:   Number(b?.overtime ?? 0),
          deductions: Number(b?.deductions ?? 0),
          absences:   Number(b?.absences ?? 0),
          status: (b?.status ?? 'EN ATTENTE') as PayStatus,
          paidAt: b?.paidAt ? new Date(b.paidAt).toLocaleDateString(locale) : null,
          month: monthDisplay,
        }
      }))
    } catch {
      loadErr()
    } finally {
      setLoading(false)
    }
  }

  // Recharge au changement de mois : les bulletins sont propres à chaque mois.
  useEffect(() => { void load(month) }, [month])

  const filtered = records.filter(r => r.month === month)

  // ⚠️ Les KPI somment les montants AFFICHÉS (déjà convertis, cohérents entre eux), pas les
  // valeurs XOF : sinon le KPI « Net à payer » ne correspond pas à l'addition de la colonne NET
  // de la table juste en dessous. `PayrollKpis` reçoit donc des montants en devise
  // d'affichage — il les formate avec `formatInCurrency`, sans reconvertir.
  const decK = CURRENCY_DECIMALS[currency as keyof typeof CURRENCY_DECIMALS] ?? 2
  const arrK = (x: number) => Math.round(x * 10 ** decK) / 10 ** decK
  const totalBrut = arrK(records.reduce((s, r) => s + payrollDisplay(r, currency).brut, 0))
  const totalNet  = arrK(records.reduce((s, r) => s + payrollDisplay(r, currency).net, 0))
  const generated = records.filter(r => r.status === 'GÉNÉRÉ' || r.status === 'PAYÉ').length
  const paid      = records.filter(r => r.status === 'PAYÉ').length

  const actionErr = () => toast.error(lang === 'en' ? 'Action failed — please retry' : lang === 'es' ? 'Acción fallida — reintenta' : lang === 'it' ? 'Azione fallita — riprova' : 'Action échouée — réessayer')

  // Fige les bulletins du mois côté serveur. Idempotent : rejouer ne duplique pas et ne
  // réécrit AUCUN bulletin existant (un bulletin déjà payé garde son montant).
  async function generatePayroll() {
    const key = monthKey(month)
    if (!key) { actionErr(); return }
    const attendus = records.filter(r => r.status === 'EN ATTENTE').length
    if (attendus === 0) { toast.error(lang === 'en' ? 'No pending payslips for this month' : lang === 'es' ? 'Sin nóminas pendientes este mes' : lang === 'it' ? 'Nessuna busta paga in attesa per questo mese' : 'Aucun bulletin en attente pour ce mois'); return }
    try {
      const { created } = await payrollApi.generate(key)
      await load(month)
      toast.success(lang === 'en' ? `${created} payslip(s) generated for ${monthLabel(month, lang)}` : lang === 'es' ? `${created} nómina(s) generada(s) para ${monthLabel(month, lang)}` : lang === 'it' ? `${created} busta/e paga generata/e per ${monthLabel(month, lang)}` : `${created} bulletin(s) généré(s) pour ${monthLabel(month, lang)}`)
    } catch { actionErr() }
  }

  /**
   * Marque un bulletin « PAYÉ ». La date de versement est posée par le SERVEUR — elle doit
   * être vérifiable, pas déclarée par le navigateur.
   *
   * ⚠️ Le bouton « Payer » s'affiche aussi sur « EN ATTENTE », donc sur un bulletin qui
   * n'existe pas encore en base : on le GÉNÈRE d'abord, sinon le clic serait sans effet
   * persistant — précisément le bug qu'on ferme.
   */
  async function markPaid(id: string) {
    try {
      let rowId = id
      if (isPending(id)) {
        const key = monthKey(month)
        if (!key) { actionErr(); return }
        const { rows } = await payrollApi.generate(key)
        const empId = id.slice(PENDING_PREFIX.length)
        const row = rows.find((r: any) => String(r.employeeId) === empId)
        if (!row) { actionErr(); return }
        rowId = row.id
      }
      await payrollApi.setStatus(rowId, 'PAYÉ')
      await load(month)
      toast.success(lang === 'en' ? 'Payslip marked as paid' : lang === 'es' ? 'Nómina marcada como pagada' : lang === 'it' ? 'Busta paga segnata come pagata' : 'Bulletin marqué comme payé')
    } catch { actionErr() }
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
    toast.success(lang === 'en' ? 'CSV export downloaded!' : lang === 'es' ? '¡Exportación CSV descargada!' : lang === 'it' ? 'Esportazione CSV scaricata!' : 'Export CSV téléchargé !')
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'en' ? 'Payroll' : lang === 'es' ? 'Nómina y salarios' : lang === 'it' ? 'Buste paga e stipendi' : 'Paie & Salaires'}</h1>
          <p className="page-subtitle">{lang === 'en' ? `Period: ${monthLabel(month, lang)}` : lang === 'es' ? `Período: ${monthLabel(month, lang)}` : lang === 'it' ? `Periodo: ${monthLabel(month, lang)}` : `Période : ${monthLabel(month, lang)}`}</p>
        </div>
        {/* Export CSV doublon supprimé — celui de la toolbar PayrollTable (plus complet) reste la seule entrée. */}
      </div>

      <PayrollKpis
        totalBrut={totalBrut}
        totalNet={totalNet}
        generated={generated}
        paid={paid}
        totalCount={records.length}
      />

      {loading ? (
        /* État de chargement : skeletons (la page était muette pendant le fetch initial) */
        <div className="panel" style={{ padding: 16 }}>
          <Skeleton height={38} count={6} radius={8} />
        </div>
      ) : records.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Wallet size={40} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />}
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
          onPrintPDF={(r) => { printBulletin(r); toast.success(lang === 'en' ? 'PDF opened!' : lang === 'es' ? '¡PDF abierto!' : lang === 'it' ? 'PDF aperto!' : 'PDF ouvert !') }}
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
