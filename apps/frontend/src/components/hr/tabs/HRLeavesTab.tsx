import { Clock, Umbrella, Plus } from 'lucide-react'
import { type Employee, type LeaveRequest, EmpAvatar, LEAVE_STATUS_CFG, leaveStatusLabel } from '@/components/hr/hrShared'

interface Props {
  employees: Employee[]
  lang: string
  pendingLeaves: number
  leaves: LeaveRequest[]
  setLeaveForm: (v: any) => void; setShowLeaveModal: (b: boolean) => void
  handleLeaveAction: (id: number, status: 'approved' | 'refused') => void
}

export default function HRLeavesTab({ employees, lang, pendingLeaves, leaves, setLeaveForm, setShowLeaveModal, handleLeaveAction }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pendingLeaves > 0 && (
        <div style={{ padding: '14px 16px', background: 'rgba(240,165,0,.1)', border: '1px solid rgba(240,165,0,.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={18} style={{ color: 'var(--acc)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)' }}>
            {lang === 'en'
              ? `${pendingLeaves} leave request${pendingLeaves > 1 ? 's' : ''} pending approval`
              : lang === 'es'
              ? `${pendingLeaves} solicitud${pendingLeaves > 1 ? 'es' : ''} de permiso pendiente${pendingLeaves > 1 ? 's' : ''} de aprobación`
              : lang === 'it'
              ? `${pendingLeaves} richiest${pendingLeaves > 1 ? 'e' : 'a'} di permesso in attesa di approvazione`
              : `${pendingLeaves} demande${pendingLeaves > 1 ? 's' : ''} de congé en attente de validation`}
          </span>
        </div>
      )}

      <div className="panel">
        <div className="panel-h">
          <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><Umbrella size={14}/> {lang === 'en' ? 'Leave requests' : lang === 'es' ? 'Solicitudes de permiso' : lang === 'it' ? 'Richieste di permesso' : 'Demandes de congés'}</span>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setLeaveForm({ empId: 0, type: lang === 'en' ? 'Annual leave' : lang === 'es' ? 'Permiso anual' : lang === 'it' ? 'Ferie annuali' : 'Congé annuel', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' })
            setShowLeaveModal(true)
          }}>
            <Plus size={14} /> {lang === 'en' ? 'New request' : lang === 'es' ? 'Nueva solicitud' : lang === 'it' ? 'Nuova richiesta' : 'Nouvelle demande'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(leaves ?? []).map(leave => {
            const emp = (employees ?? []).find(e => e.id === leave.empId || Number(e.id) === leave.empId)
            const displayName = emp?.name ?? leave.empName ?? '—'
            const statusCfg = LEAVE_STATUS_CFG[leave.status]
            return (
              <div key={leave.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
                {emp && <EmpAvatar emp={emp} size={38} />}
                {!emp && (
                  <div style={{ width:38, height:38, borderRadius:'50%', background:'#6C47FF22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'var(--p)', flexShrink:0 }}>
                    {displayName.slice(0,2).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{displayName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {leave.type} · {leave.from} → {leave.to} · <strong>{leave.days}{lang === 'en' ? 'd' : lang === 'es' ? 'd' : lang === 'it' ? 'g' : 'j'}</strong>
                  </div>
                  {leave.motif && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>"{leave.motif}"</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                  {leaveStatusLabel(leave.status, lang)}
                </span>
                {leave.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(14,196,126,.15)', border: '1px solid rgba(14,196,126,.3)', color: 'var(--acc2)' }}
                      onClick={() => handleLeaveAction(leave.id, 'approved')}>
                      ✓ {lang === 'en' ? 'Approve' : lang === 'es' ? 'Aprobar' : lang === 'it' ? 'Approva' : 'Approuver'}
                    </button>
                    <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(232,64,74,.12)', border: '1px solid rgba(232,64,74,.25)', color: 'var(--danger)' }}
                      onClick={() => handleLeaveAction(leave.id, 'refused')}>
                      ✕ {lang === 'en' ? 'Reject' : lang === 'es' ? 'Rechazar' : lang === 'it' ? 'Rifiuta' : 'Refuser'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {(leaves ?? []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 14 }}>
              {lang === 'en' ? 'No leave requests' : lang === 'es' ? 'Sin solicitudes de permiso' : lang === 'it' ? 'Nessuna richiesta di permesso' : 'Aucune demande de congé'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
