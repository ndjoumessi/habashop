import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { employeesApi } from '@/lib/api'
import { saved } from '@/lib/saved'
import { type Employee, toEmployeeWrite, employeeFromApi } from '@/components/hr/hrShared'
import SalaryModal from '@/components/hr/modals/SalaryModal'
import EmpModal from '@/components/hr/modals/EmpModal'
import EditEmployeeModal from '@/components/hr/modals/EditEmployeeModal'
import NewContractModal from '@/components/hr/modals/NewContractModal'
import ContractDetailModal from '@/components/hr/modals/ContractDetailModal'
import LeaveRequestModal from '@/components/hr/modals/LeaveRequestModal'

interface HRModalsProps {
  showSalaryModal: boolean; setShowSalaryModal: (b: boolean) => void
  salaryTarget: any
  lang: string
  fmt: (n: number) => string
  employees: Employee[]; setEmployees: import("react").Dispatch<import("react").SetStateAction<Employee[]>>
  handleConfirmRaise: (empId: string, newSalaryXOF: number, reason: string) => void
  handleConfirmBonus: (empId: string, amountXOF: number, type: string) => void
  showModal: boolean; setShowModal: (b: boolean) => void
  showEditEmpModal: boolean; setShowEditEmpModal: (b: boolean) => void
  selectedEmp: Employee | null
  editEmpForm: any; setEditEmpForm: (v: any) => void
  empEditMode: boolean; setEmpEditMode: (b: boolean) => void
  salaryInput: string; setSalaryInput: (v: string) => void
  toXOF: (n: number) => number
  currency: string
  currencySymbol: string
  tenantCurrency?: string  // (déprécié) conservé pour compat appelant ; NewContractModal utilise désormais la devise d'affichage
  openEditModal: (emp: Employee) => void
  showNewContractModal: boolean; setShowNewContractModal: (b: boolean) => void
  contractForm: any; setContractForm: (v: any) => void
  showContractDetailModal: boolean; setShowContractDetailModal: (b: boolean) => void
  selectedContract: any
  showLeaveModal: boolean; setShowLeaveModal: (b: boolean) => void
  leaveForm: any; setLeaveForm: (v: any) => void
  onSubmitLeave: (form: any) => void
}

// Dispatcher fin : rend la modale active selon les flags d'ouverture (découpe à comportement identique).
export default function HRModals(props: HRModalsProps) {
  const {
    showSalaryModal, setShowSalaryModal, salaryTarget, lang, fmt, employees, setEmployees,
    handleConfirmRaise, handleConfirmBonus, showModal, setShowModal,
    showEditEmpModal, setShowEditEmpModal, selectedEmp, editEmpForm, setEditEmpForm,
    empEditMode, setEmpEditMode, salaryInput, setSalaryInput, toXOF, currency, currencySymbol,
    openEditModal, showNewContractModal, setShowNewContractModal, contractForm, setContractForm,
    showContractDetailModal, setShowContractDetailModal, selectedContract,
    showLeaveModal, setShowLeaveModal, leaveForm, setLeaveForm, onSubmitLeave,
  } = props
  return (
    <>
      {/* ── MODAL PRIME / AUGMENTATION ── */}
      {showSalaryModal && (
        <SalaryModal
          salaryTarget={salaryTarget} lang={lang} fmt={fmt} employees={employees}
          handleConfirmRaise={handleConfirmRaise} handleConfirmBonus={handleConfirmBonus}
          onClose={() => setShowSalaryModal(false)}
        />
      )}

      {/* ── MODAL EMPLOYEE (ajout) ── */}
      {showModal && (
        <EmpModal
          emp={null}
          onClose={() => setShowModal(false)}
          /* ⚠️ CE BLOC N'ENVOYAIT RIEN AU SERVEUR. Il fabriquait un `Employee` avec
             `id: Date.now()`, l'empilait dans l'état local et affichait « Employé ajouté » :
             la fiche disparaissait au rechargement. Pire que la disparition — l'id inventé
             n'était celui d'AUCUNE ligne, donc toute écriture ultérieure sur cette personne
             (modification, suppression, bulletin de paie) partait vers un id inexistant.

             ⚠️ L'id ne vient plus d'ici : il vient du SERVEUR, via `employeeFromApi`. C'est
             aussi ce qui rend l'écart `Employee.id: number` / cuid string sans effet ici —
             l'adaptateur le traverse déjà pour les fiches chargées par `GET /api/employees`
             (hrShared.tsx:369). Le corriger reste un chantier à part, il ne bloque pas. */
          onSave={async (form, extra) => {
            const requete = employeesApi.create(toEmployeeWrite(form, extra))
            // `saved` RAPPORTE (message du serveur préféré au nôtre) et rend un booléen ; la
            // décision reste ici — et ici, un refus ne ferme pas la modale, n'ajoute rien à la
            // liste et n'annonce aucun succès. La saisie du gérant est conservée à l'écran.
            const ok = await saved(
              requete,
              lang === 'en' ? 'the employee' : lang === 'es' ? 'el empleado' : lang === 'it' ? 'il dipendente' : 'l’employé',
            )
            if (!ok) return
            // La promesse est déjà résolue et son rejet déjà traité par `saved` : la ré-attendre
            // ne relance aucune requête et ne peut plus lever.
            const cree = await requete
            setEmployees(prev => [...prev, employeeFromApi(cree, prev.length)])
            toast.success(lang === 'en' ? 'Employee added' : lang === 'es' ? 'Empleado agregado' : lang === 'it' ? 'Dipendente aggiunto' : 'Employé ajouté')
            announce(lang === 'en' ? 'Employee added' : lang === 'es' ? 'Empleado agregado' : lang === 'it' ? 'Dipendente aggiunto' : 'Employé ajouté')
            setShowModal(false)
          }}
        />
      )}

      {/* ── MODAL EMPLOYÉ PREMIUM (édition) ── */}
      {showEditEmpModal && selectedEmp && (
        <EditEmployeeModal
          lang={lang} fmt={fmt} selectedEmp={selectedEmp}
          editEmpForm={editEmpForm} setEditEmpForm={setEditEmpForm}
          empEditMode={empEditMode} setEmpEditMode={setEmpEditMode}
          salaryInput={salaryInput} setSalaryInput={setSalaryInput}
          toXOF={toXOF} currency={currency} currencySymbol={currencySymbol}
          setEmployees={setEmployees} setShowEditEmpModal={setShowEditEmpModal}
          openEditModal={openEditModal}
        />
      )}

      {/* ── MODAL NOUVEAU CONTRAT ── */}
      {showNewContractModal && (
        <NewContractModal
          lang={lang} fmt={fmt} currencySymbol={currencySymbol} toXOF={toXOF} employees={employees} setEmployees={setEmployees}
          contractForm={contractForm} setContractForm={setContractForm}
          setShowNewContractModal={setShowNewContractModal}
        />
      )}

      {/* ── MODAL DÉTAIL CONTRAT ── */}
      {showContractDetailModal && selectedContract && (
        <ContractDetailModal
          lang={lang} fmt={fmt} selectedContract={selectedContract}
          setShowContractDetailModal={setShowContractDetailModal} openEditModal={openEditModal}
        />
      )}

      {/* ── MODAL LEAVE REQUEST ── */}
      {showLeaveModal && (
        <LeaveRequestModal
          lang={lang} employees={employees}
          leaveForm={leaveForm} setLeaveForm={setLeaveForm}
          setShowLeaveModal={setShowLeaveModal} onSubmitLeave={onSubmitLeave}
        />
      )}
    </>
  )
}
