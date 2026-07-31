import { X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import toast from 'react-hot-toast'
import { type Employee, type ContractForm, COLORS, DEPT_COLORS, labelStyle, deptLabel, contractLabel } from '@/components/hr/hrShared'
// ⚠️ Taux et calcul importés de la SOURCE UNIQUE (`payrollShared`). Ces fichiers codaient
// `0.08`/`0.05`/`0.87` en dur — le `0.87` étant le pire : un net magique qui devient
// silencieusement faux dès qu'un taux change.
// ⚠️ `payrollDisplay` : conversion UNE fois + arrondi cohérent (lignes/total/net). Les
// montants rendus sont DÉJÀ en devise d'affichage → `fmtDisplay`, jamais le `fmt` reçu en
// prop (qui reconvertirait). Verrou : `payrollConvertOnce.test.ts`.
import { payrollDisplay, fmtDisplay, CNSS_RATE, IR_RATE } from '@/components/payroll/payrollShared'
import { useConfig } from '@/stores/appStore'

interface Props {
  lang: string
  fmt: (n: number) => string
  // Devise d'AFFICHAGE locale (même pattern qu'EmpModal) : le champ se saisit dans
  // la devise vue à l'écran, converti en XOF au submit (storage inchangé, base XOF).
  currencySymbol: string
  toXOF: (n: number) => number
  employees: Employee[]; setEmployees: import("react").Dispatch<import("react").SetStateAction<Employee[]>>
  contractForm: ContractForm; setContractForm: import("react").Dispatch<import("react").SetStateAction<ContractForm>>
  setShowNewContractModal: (b: boolean) => void
}

export default function NewContractModal({ lang, fmt, currencySymbol, toXOF, employees, setEmployees, contractForm, setContractForm, setShowNewContractModal }: Props) {
  const { currency: curN } = useConfig()
  // Suffixe = SYMBOLE de la devise d'affichage (cohérent avec la grille Paie : "€" si EUR, "FCFA" si XOF…).
  const currencySuffix = currencySymbol
  // Montant saisi (devise d'affichage) → XOF pour les aperçus et le storage.
  const salaryXOF = toXOF(contractForm.salary || 0)
  const boxRef = useModalFocus<HTMLDivElement>()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'New contract' : lang === 'es' ? 'Nuevo contrato' : lang === 'it' ? 'Nuovo contratto' : 'Nouveau contrat'} onClick={e => e.target===e.currentTarget&&setShowNewContractModal(false)}>
      <div ref={boxRef} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--sh-xl)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>📄 {lang === 'en' ? 'New contract' : lang === 'es' ? 'Nuevo contrato' : lang === 'it' ? 'Nuovo contratto' : 'Nouveau contrat'}</h3>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={()=>setShowNewContractModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>{lang === 'en' ? 'EMPLOYEE NAME' : lang === 'es' ? 'NOMBRE DEL EMPLEADO' : lang === 'it' ? 'NOME DEL DIPENDENTE' : 'NOM DE L\'EMPLOYÉ'}</label>
            <input aria-label={lang === 'en' ? 'EMPLOYEE NAME' : lang === 'es' ? 'NOMBRE DEL EMPLEADO' : lang === 'it' ? 'NOME DEL DIPENDENTE' : 'NOM DE L\'EMPLOYÉ'} className="input" placeholder={lang === 'en' ? 'Employee name' : lang === 'es' ? 'Nombre del empleado' : lang === 'it' ? 'Nome del dipendente' : 'Aminata Diallo'} value={contractForm.empId} onChange={e=>setContractForm(f=>({...f,empId:e.target.value}))}/>
          </div>
          <ResponsiveGrid min={160} gap={12}>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'POSITION' : lang === 'es' ? 'PUESTO' : lang === 'it' ? 'POSIZIONE' : 'POSTE'}</label>
              <input aria-label={lang === 'en' ? 'POSITION' : lang === 'es' ? 'PUESTO' : lang === 'it' ? 'POSIZIONE' : 'POSTE'} className="input" placeholder={lang === 'en' ? 'Ex: Cashier' : lang === 'es' ? 'Ej: Cajera' : lang === 'it' ? 'Es: Cassiera' : 'Ex: Caissière'} value={contractForm.role} onChange={e=>setContractForm(f=>({...f,role:e.target.value}))}/>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'DEPARTMENT' : lang === 'es' ? 'DEPARTAMENTO' : lang === 'it' ? 'REPARTO' : 'DÉPARTEMENT'}</label>
              <select aria-label={lang === 'en' ? 'DEPARTMENT' : lang === 'es' ? 'DEPARTAMENTO' : lang === 'it' ? 'REPARTO' : 'DÉPARTEMENT'} className="input" value={contractForm.dept} onChange={e=>setContractForm(f=>({...f,dept:e.target.value}))}>
                {Object.keys(DEPT_COLORS).map(d=><option key={d} value={d}>{deptLabel(d, lang)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'CONTRACT TYPE' : lang === 'es' ? 'TIPO CONTRATO' : lang === 'it' ? 'TIPO CONTRATTO' : 'TYPE CONTRAT'}</label>
              <select aria-label={lang === 'en' ? 'CONTRACT TYPE' : lang === 'es' ? 'TIPO CONTRATO' : lang === 'it' ? 'TIPO CONTRATTO' : 'TYPE CONTRAT'} className="input" value={contractForm.type} onChange={e=>setContractForm(f=>({...f,type:e.target.value}))}>
                {['CDI','CDD','Temps partiel','Stage','Freelance'].map(t=><option key={t} value={t}>{contractLabel(t, lang)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'START DATE' : lang === 'es' ? 'FECHA INICIO' : lang === 'it' ? 'DATA INIZIO' : 'DATE DÉBUT'}</label>
              <input aria-label={lang === 'en' ? 'START DATE' : lang === 'es' ? 'FECHA INICIO' : lang === 'it' ? 'DATA INIZIO' : 'DATE DÉBUT'} className="input" type="date" value={contractForm.hiredAt} onChange={e=>setContractForm(f=>({...f,hiredAt:e.target.value}))}/>
            </div>
            {contractForm.type==='CDD'&&(
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelStyle}>{lang === 'en' ? 'CONTRACT END DATE' : lang === 'es' ? 'FECHA FIN CONTRATO' : lang === 'it' ? 'DATA FINE CONTRATTO' : 'DATE FIN CONTRAT'}</label>
                <input aria-label={lang === 'en' ? 'CONTRACT END DATE' : lang === 'es' ? 'FECHA FIN CONTRATO' : lang === 'it' ? 'DATA FINE CONTRATTO' : 'DATE FIN CONTRAT'} className="input" type="date" value={contractForm.contractEnd} onChange={e=>setContractForm(f=>({...f,contractEnd:e.target.value}))}/>
              </div>
            )}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={labelStyle}>{lang === 'en' ? 'GROSS SALARY' : lang === 'es' ? 'SALARIO BRUTO' : lang === 'it' ? 'STIPENDIO LORDO' : 'SALAIRE BRUT'}</label>
              <div style={{ position:'relative' }}>
                <input aria-label={lang === 'en' ? 'GROSS SALARY' : lang === 'es' ? 'SALARIO BRUTO' : lang === 'it' ? 'STIPENDIO LORDO' : 'SALAIRE BRUT'} className="input" type="number" placeholder="150000" value={contractForm.salary||''} onChange={e=>setContractForm(f=>({...f,salary:+e.target.value}))} style={{ paddingRight:60 }}/>
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--text3)', pointerEvents:'none' }}>{currencySuffix}</span>
              </div>
              {contractForm.salary>0&&(
                <div style={{ marginTop:6, fontSize:'var(--fs-caption)', color:'var(--text3)', display:'flex', gap:12 }}>
                  <span>CNSS: <strong style={{color:'var(--danger)'}}>−{fmtDisplay(payrollDisplay({ baseSalary: salaryXOF, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, curN).cnss, curN)}</strong></span>
                  <span>{lang === 'en' ? 'Net' : lang === 'es' ? 'Neto' : lang === 'it' ? 'Netto' : 'Net'}: <strong style={{color:'var(--acc2)'}}>{fmtDisplay(payrollDisplay({ baseSalary: salaryXOF, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, curN).net, curN)}</strong></span>
                </div>
              )}
            </div>
          </ResponsiveGrid>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:24 }}>
          <button className="btn" style={{ flex:1 }} onClick={()=>setShowNewContractModal(false)}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{
            if (!contractForm.empId.trim()||!contractForm.role.trim()) {
              toast.error(lang === 'en' ? 'Name and position required' : lang === 'es' ? 'Nombre y puesto requeridos' : lang === 'it' ? 'Nome e posizione richiesti' : 'Nom et poste requis'); return
            }
            const newEmp: Employee = {
              id: Date.now(),
              name: contractForm.empId.trim(),
              role: contractForm.role,
              dept: contractForm.dept,
              salary: toXOF(contractForm.salary || 0),  // saisi en devise d'affichage → stocké en XOF (base)
              type: contractForm.type as 'CDI'|'CDD',
              hiredAt: contractForm.hiredAt ? new Date(contractForm.hiredAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
              endAt: contractForm.type==='CDD'&&contractForm.contractEnd ? new Date(contractForm.contractEnd).toLocaleDateString('fr-FR') : undefined,
              avatar: contractForm.empId.trim().split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase(),
              color: COLORS[employees.length % COLORS.length],
              active: true, phone:'', email:'', perf:3,
            }
            setEmployees(prev=>[...prev, newEmp])
            toast.success(lang === 'en' ? 'Contract created!' : lang === 'es' ? '¡Contrato creado!' : lang === 'it' ? 'Contratto creato!' : 'Contrat créé !')
            setShowNewContractModal(false)
          }}>✅ {lang === 'en' ? 'Create contract' : lang === 'es' ? 'Crear el contrato' : lang === 'it' ? 'Crea il contratto' : 'Créer le contrat'}</button>
        </div>
      </div>
    </div>
  )
}
