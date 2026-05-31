import { type Employee, type LeaveRequest, type AttendUiStatus } from '@/components/hr/hrShared'
import HRContractsTab from '@/components/hr/tabs/HRContractsTab'
import HRPayrollTab from '@/components/hr/tabs/HRPayrollTab'
import HRAttendanceTab from '@/components/hr/tabs/HRAttendanceTab'
import HRLeavesTab from '@/components/hr/tabs/HRLeavesTab'

interface HRTabsProps {
  tab: string
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  payTab: 'grid' | 'payslip' | 'bonuses' | 'history'; setPayTab: (v: any) => void
  payrollMonth: string; setPayrollMonth: (v: string) => void
  bonuses: Record<string, number>; setBonuses: (v: any) => void
  bonusList: { id: string; empId: string; amount: number; reason: string; date: string }[]; setBonusList: (v: any) => void
  salaryHistory: any[]
  onDeleteSalaryHistory?: (id: string) => void
  generateAllPayslips: () => void
  generatePayslipPDF: (emp: any, data: any) => void
  setSalaryTarget: (v: any) => void; setShowSalaryModal: (b: boolean) => void
  setSelectedContract: (e: any) => void; setShowContractDetailModal: (b: boolean) => void
  setContractForm: (v: any) => void; setShowNewContractModal: (b: boolean) => void
  attendance: Record<string, { in: string | null; out: string | null; status: AttendUiStatus }>
  onSaveAttendance: (empId: string, date: string, entry: { in: string | null; out: string | null; status: AttendUiStatus }) => void
  attendanceDate: string; setAttendanceDate: (v: string) => void
  pendingLeaves: number
  leaves: LeaveRequest[]
  setLeaveForm: (v: any) => void; setShowLeaveModal: (b: boolean) => void
  handleLeaveAction: (id: number, status: 'approved' | 'refused') => void
}

// Conteneur fin : aiguille vers le composant d'onglet (découpe à comportement identique).
export default function HRTabs(props: HRTabsProps) {
  const {
    tab, employees, fmt, lang, payTab, setPayTab, payrollMonth, setPayrollMonth,
    bonuses, setBonuses, bonusList, setBonusList, salaryHistory, onDeleteSalaryHistory,
    generateAllPayslips, generatePayslipPDF, setSalaryTarget, setShowSalaryModal,
    setSelectedContract, setShowContractDetailModal, setContractForm, setShowNewContractModal,
    attendance, onSaveAttendance, attendanceDate, setAttendanceDate,
    pendingLeaves, leaves, setLeaveForm, setShowLeaveModal, handleLeaveAction,
  } = props
  return (
    <>
      {tab === 'contracts' && (
        <HRContractsTab
          employees={employees} fmt={fmt} lang={lang}
          setSelectedContract={setSelectedContract} setShowContractDetailModal={setShowContractDetailModal}
          setContractForm={setContractForm} setShowNewContractModal={setShowNewContractModal}
        />
      )}

      {tab === 'payroll' && (
        <HRPayrollTab
          employees={employees} fmt={fmt} lang={lang}
          payTab={payTab} setPayTab={setPayTab}
          payrollMonth={payrollMonth} setPayrollMonth={setPayrollMonth}
          bonuses={bonuses} setBonuses={setBonuses}
          bonusList={bonusList} setBonusList={setBonusList}
          salaryHistory={salaryHistory} onDeleteSalaryHistory={onDeleteSalaryHistory}
          generateAllPayslips={generateAllPayslips} generatePayslipPDF={generatePayslipPDF}
          setSalaryTarget={setSalaryTarget} setShowSalaryModal={setShowSalaryModal}
        />
      )}

      {tab === 'pointage' && (
        <HRAttendanceTab
          employees={employees} lang={lang}
          attendance={attendance} onSaveAttendance={onSaveAttendance}
          attendanceDate={attendanceDate} setAttendanceDate={setAttendanceDate}
        />
      )}

      {tab === 'leaves' && (
        <HRLeavesTab
          employees={employees} lang={lang}
          pendingLeaves={pendingLeaves} leaves={leaves}
          setLeaveForm={setLeaveForm} setShowLeaveModal={setShowLeaveModal}
          handleLeaveAction={handleLeaveAction}
        />
      )}
    </>
  )
}
