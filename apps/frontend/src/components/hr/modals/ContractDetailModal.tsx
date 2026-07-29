import { useModalFocus } from '@/hooks/useModalFocus'
import { type Employee, displayDate, calcAnciennete, roleLabel, deptLabel } from '@/components/hr/hrShared'
// ⚠️ Taux et calcul importés de la SOURCE UNIQUE (`payrollShared`). Ces fichiers codaient
// `0.08`/`0.05`/`0.87` en dur — le `0.87` étant le pire : un net magique qui devient
// silencieusement faux dès qu'un taux change.
import { payrollBreakdown, CNSS_RATE, IR_RATE } from '@/components/payroll/payrollShared'

interface Props {
  lang: string
  fmt: (n: number) => string
  selectedContract: any
  setShowContractDetailModal: (b: boolean) => void
  openEditModal: (emp: Employee) => void
}

export default function ContractDetailModal({ lang, fmt, selectedContract, setShowContractDetailModal, openEditModal }: Props) {
  const contractBd = payrollBreakdown({ baseSalary: Number(selectedContract?.salary) || 0, bonus: 0, overtime: 0, deductions: 0, absences: 0 })
  const boxRef = useModalFocus<HTMLDivElement>()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'Contract details' : lang === 'es' ? 'Detalle del contrato' : lang === 'it' ? 'Dettaglio contratto' : 'Détail du contrat'} onClick={e => e.target===e.currentTarget&&setShowContractDetailModal(false)}>
      <div ref={boxRef} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:480, boxShadow:'var(--sh-xl)', overflow:'hidden' }}>
        <div style={{ padding:'24px 24px 20px', background:`linear-gradient(135deg,${selectedContract.color}18,${selectedContract.color}05)`, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:56, height:56, borderRadius:16, overflow:'hidden', background:`linear-gradient(135deg,${selectedContract.color},${selectedContract.color}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:'var(--fw-semibold)', color:'#fff', flexShrink:0, boxShadow:`0 6px 20px ${selectedContract.color}50` }}>
              {selectedContract.photoUrl
                ? <img src={selectedContract.photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : selectedContract.avatar}
            </div>
            <div style={{ flex:1 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>{selectedContract.name}</h3>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>{roleLabel(selectedContract.role, lang)} · {deptLabel(selectedContract.dept, lang)}</div>
            </div>
            <button onClick={()=>setShowContractDetailModal(false)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, width:32, height:32, cursor:'pointer', color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✕</button>
          </div>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:'var(--fw-semibold)', padding:'5px 14px', borderRadius:20, background:selectedContract.type==='CDI'?'rgba(108,71,255,.15)':'rgba(14,196,126,.12)', color:selectedContract.type==='CDI'?'var(--p2)':'var(--acc2)' }}>{selectedContract.type}</span>
            <span style={{ fontSize:12, fontWeight:'var(--fw-semibold)', padding:'5px 14px', borderRadius:20, background:selectedContract.active?'var(--c-green-bg)':'var(--bg3)', color:selectedContract.active?'var(--acc2)':'var(--text3)' }}>
              {selectedContract.active?(lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif'):(lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')}
            </span>
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              {label:lang === 'en' ? 'Hire date' : lang === 'es' ? 'Fecha de contratación' : lang === 'it' ? 'Data di assunzione' : 'Date d\'embauche', value:displayDate(selectedContract.hiredAt, lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR')},
              {label:lang === 'en' ? 'Seniority' : lang === 'es' ? 'Antigüedad' : lang === 'it' ? 'Anzianità' : 'Ancienneté', value:calcAnciennete(selectedContract.hiredAt, lang)},
              ...(selectedContract.type!=='CDI'&&selectedContract.endAt
                ? [{label:lang === 'en' ? 'Contract end' : lang === 'es' ? 'Fin de contrato' : lang === 'it' ? 'Fine contratto' : 'Fin de contrat', value:displayDate(selectedContract.endAt, lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR')}]
                : selectedContract.type==='CDI'
                  ? [{label:lang === 'en' ? 'Contract end' : lang === 'es' ? 'Fin de contrato' : lang === 'it' ? 'Fine contratto' : 'Fin de contrat', value:lang === 'en' ? '∞ Permanent' : lang === 'es' ? '∞ Indefinido' : lang === 'it' ? '∞ Indeterminato' : '∞ Indéterminé'}]
                  : []
              ),
            ].map(row=>(
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{row.label}</span>
                <span style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)', fontFamily:'var(--mono)' }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:12, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:12 }}>💰 {lang === 'en' ? 'COMPENSATION' : lang === 'es' ? 'REMUNERACIÓN' : lang === 'it' ? 'RETRIBUZIONE' : 'RÉMUNÉRATION'}</div>
            {[
              {label:lang === 'en' ? 'Gross salary' : lang === 'es' ? 'Salario bruto' : lang === 'it' ? 'Stipendio lordo' : 'Salaire brut', value:fmt(selectedContract.salary), color:'var(--text)'},
              {label:`CNSS (${CNSS_RATE * 100}%)`, value:`− ${fmt(contractBd.cnss)}`, color:'var(--danger)'},
              {label:`IR (${IR_RATE * 100}%)`, value:`− ${fmt(contractBd.ir)}`, color:'var(--acc)'},
              {label:lang === 'en' ? 'Net salary' : lang === 'es' ? 'Neto a pagar' : lang === 'it' ? 'Netto da pagare' : 'Net à payer', value:fmt(contractBd.net), color:'var(--acc2)'},
            ].map(row=>(
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{row.label}</span>
                <span style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:row.color, fontFamily:'var(--mono)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', background:'var(--bg3)', display:'flex', gap:8 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{
            openEditModal(selectedContract)
            setShowContractDetailModal(false)
          }}>✏️ {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}</button>
          <button className="btn" style={{ padding:'10px 16px' }} onClick={()=>setShowContractDetailModal(false)}>{lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}</button>
        </div>
      </div>
    </div>
  )
}
