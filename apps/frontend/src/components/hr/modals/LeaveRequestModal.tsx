import { X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import toast from 'react-hot-toast'
import { type Employee, labelStyle } from '@/components/hr/hrShared'

interface Props {
  lang: string
  employees: Employee[]
  leaveForm: import("@/components/hr/hrShared").LeaveForm; setLeaveForm: import("react").Dispatch<import("react").SetStateAction<import("@/components/hr/hrShared").LeaveForm>>
  setShowLeaveModal: (b: boolean) => void
  onSubmitLeave: (form: any) => void  // Phase 6 : POST /api/leave-requests géré par le parent
}

export default function LeaveRequestModal({ lang, employees, leaveForm, setLeaveForm, setShowLeaveModal, onSubmitLeave }: Props) {
  const boxRef = useModalFocus<HTMLDivElement>()
  return (
    <div role="dialog" aria-modal="true"
      aria-label={lang === 'en' ? 'New leave request' : lang === 'es' ? 'Nueva solicitud de permiso' : lang === 'it' ? 'Nuova richiesta di congedo' : 'Nouvelle demande de congé'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) setShowLeaveModal(false) }}>
      <div ref={boxRef} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
            🌴 {lang === 'en' ? 'New request' : lang === 'es' ? 'Nueva solicitud' : lang === 'it' ? 'Nuova richiesta' : 'Nouvelle demande'}
          </h3>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={() => setShowLeaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'}</label>
            <select aria-label={lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'} className="input" style={{ width: '100%' }}
              value={String(leaveForm.empId ?? '')}
              onChange={e => setLeaveForm(f => ({ ...f, empId: e.target.value }))}>
              <option value="">{lang === 'en' ? 'Select...' : lang === 'es' ? 'Seleccionar...' : lang === 'it' ? 'Seleziona...' : 'Sélectionner...'}</option>
              {(employees ?? []).filter(e => e.active).map(e => (
                <option key={e.id} value={String(e.id)}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{lang === 'en' ? 'LEAVE TYPE' : lang === 'es' ? 'TIPO DE PERMISO' : lang === 'it' ? 'TIPO DI PERMESSO' : 'TYPE DE CONGÉ'}</label>
            <select aria-label={lang === 'en' ? 'LEAVE TYPE' : lang === 'es' ? 'TIPO DE PERMISO' : lang === 'it' ? 'TIPO DI PERMESSO' : 'TYPE DE CONGÉ'} className="input" style={{ width: '100%' }}
              value={leaveForm.type}
              onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}>
              {[
                lang === 'en' ? 'Annual leave' : lang === 'es' ? 'Permiso anual' : lang === 'it' ? 'Ferie annuali' : 'Congé annuel',
                lang === 'en' ? 'Sick leave' : lang === 'es' ? 'Baja por enfermedad' : lang === 'it' ? 'Congedo malattia' : 'Congé maladie',
                lang === 'en' ? 'Training' : lang === 'es' ? 'Formación' : lang === 'it' ? 'Formazione' : 'Formation',
                lang === 'en' ? 'Personal' : lang === 'es' ? 'Personal' : lang === 'it' ? 'Personale' : 'Personnel',
                lang === 'en' ? 'Parental leave' : lang === 'es' ? 'Maternidad/Paternidad' : lang === 'it' ? 'Maternità/Paternità' : 'Maternité/Paternité',
              ].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <ResponsiveGrid min={160} gap={12}>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'FROM' : lang === 'es' ? 'DEL' : lang === 'it' ? 'DAL' : 'DU'}</label>
              <input aria-label={lang === 'en' ? 'FROM' : lang === 'es' ? 'DEL' : lang === 'it' ? 'DAL' : 'DU'} className="input" type="date" style={{ width: '100%', boxSizing: 'border-box' }}
                value={leaveForm.startDate}
                onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'TO' : lang === 'es' ? 'AL' : lang === 'it' ? 'AL' : 'AU'}</label>
              <input aria-label={lang === 'en' ? 'TO' : lang === 'es' ? 'AL' : lang === 'it' ? 'AL' : 'AU'} className="input" type="date" style={{ width: '100%', boxSizing: 'border-box' }}
                value={leaveForm.endDate}
                onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </ResponsiveGrid>
          <div>
            <label style={labelStyle}>{lang === 'en' ? 'NOTES / REASON' : lang === 'es' ? 'NOTAS / MOTIVO' : lang === 'it' ? 'NOTE / MOTIVO' : 'NOTES / MOTIF'}</label>
            <textarea aria-label={lang === 'en' ? 'NOTES / REASON' : lang === 'es' ? 'NOTAS / MOTIVO' : lang === 'it' ? 'NOTE / MOTIVO' : 'NOTES / MOTIF'} className="input" rows={2} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              placeholder={lang === 'en' ? 'Reason, justification...' : lang === 'es' ? 'Motivo, justificante...' : lang === 'it' ? 'Motivo, giustificativo...' : 'Motif, justificatif...'}
              value={leaveForm.notes}
              onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => setShowLeaveModal(false)}>
            {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => {
              if (!leaveForm.empId || !leaveForm.endDate) {
                toast.error(lang === 'en' ? 'Employee and dates required' : lang === 'es' ? 'Empleado y fechas requeridos' : lang === 'it' ? 'Dipendente e date richiesti' : 'Employé et dates requis')
                return
              }
              // Le parent (HR.tsx createLeave) POST /api/leave-requests + ajoute au state + toast.
              onSubmitLeave(leaveForm)
              setShowLeaveModal(false)
            }}>
            {lang === 'en' ? 'Submit' : lang === 'es' ? 'Enviar' : lang === 'it' ? 'Invia' : 'Soumettre'}
          </button>
        </div>
      </div>
    </div>
  )
}
