import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { type Employee } from '@/components/hr/hrShared'
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
  employees: Employee[]; setEmployees: (v: any) => void
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
          onSave={(data) => {
            const newEmp: Employee = {
              ...data,
              id: Date.now(),
              avatar: data.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
              active: true,
            }
            setEmployees(prev => [...prev, newEmp])
            toast.success(lang === 'en' ? '✅ Employee added' : lang === 'es' ? '✅ Empleado agregado' : lang === 'it' ? '✅ Dipendente aggiunto' : '✅ Employé ajouté')
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
