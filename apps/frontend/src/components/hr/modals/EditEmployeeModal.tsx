import { DollarSign, FileText, Pencil, Star, Trash2, User, Eye, MapPin } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { employeesApi } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import ViewField from '@/components/ui/ViewField'
import ValidatedInput from '@/components/ui/ValidatedInput'
// ⚠️ Taux et calcul importés de la SOURCE UNIQUE (`payrollShared`). Ces fichiers codaient
// `0.08`/`0.05`/`0.87` en dur — le `0.87` étant le pire : un net magique qui devient
// silencieusement faux dès qu'un taux change.
// ⚠️ `payrollDisplay` : conversion UNE fois + arrondi cohérent (lignes/total/net). Les
// montants rendus sont DÉJÀ en devise d'affichage → `fmtDisplay`, jamais le `fmt` reçu en
// prop (qui reconvertirait). Verrou : `payrollConvertOnce.test.ts`.
import { payrollDisplay, fmtDisplay, CNSS_RATE, IR_RATE } from '@/components/payroll/payrollShared'
import { useConfig } from '@/stores/appStore'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type Employee, DEPT_COLORS, displayDate, roleLabel, deptLabel, contractLabel } from '@/components/hr/hrShared'

interface Props {
  lang: string
  fmt: (n: number) => string
  selectedEmp: Employee
  editEmpForm: any; setEditEmpForm: (v: any) => void
  empEditMode: boolean; setEmpEditMode: (b: boolean) => void
  salaryInput: string; setSalaryInput: (v: string) => void
  toXOF: (n: number) => number
  currency: string
  currencySymbol: string
  setEmployees: (v: any) => void
  setShowEditEmpModal: (b: boolean) => void
  openEditModal: (emp: Employee) => void
}

export default function EditEmployeeModal({ lang, fmt, selectedEmp, editEmpForm, setEditEmpForm, empEditMode, setEmpEditMode, salaryInput, setSalaryInput, toXOF, currencySymbol, setEmployees, setShowEditEmpModal, openEditModal }: Props) {
  const { currency: curEmp } = useConfig()
  const boxRef = useModalFocus<HTMLDivElement>()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={lang === 'en' ? 'Employee details' : lang === 'es' ? 'Detalle del empleado' : lang === 'it' ? 'Dettaglio dipendente' : "Détail de l'employé"}
      onClick={e => e.target===e.currentTarget && setShowEditEmpModal(false)}>
      <div ref={boxRef} className="modal-box" style={{ borderRadius:24, maxWidth:560, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', padding:0 }}>

        {/* Ligne décorative */}
        <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'40%', height:1, background:`linear-gradient(90deg,transparent,${editEmpForm.color??'var(--p)'},transparent)` }} />

        {/* HEADER */}
        <div style={{ padding:'24px 24px 20px', background:`linear-gradient(135deg,${editEmpForm.color??'var(--p)'}18,${editEmpForm.color??'var(--p)'}05)`, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div
              style={{ width:60, height:60, borderRadius:18, overflow:'hidden', background:`linear-gradient(135deg,${editEmpForm.color??'var(--p)'},${editEmpForm.color??'var(--p)'}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:'var(--fw-semibold)', color:'#fff', flexShrink:0, boxShadow:`0 8px 24px ${editEmpForm.color??'var(--p)'}50`, border:`2px solid ${editEmpForm.color??'var(--p)'}40`, letterSpacing:'-1px', cursor: empEditMode ? 'pointer' : 'default', position:'relative' }}
              title={empEditMode ? (lang === 'en' ? 'Click to change photo' : lang === 'es' ? 'Clic para cambiar la foto' : lang === 'it' ? 'Clicca per cambiare la foto' : 'Cliquer pour changer la photo') : undefined}
              onClick={() => empEditMode && (document.getElementById('emp-photo-input') as HTMLInputElement)?.click()}>
              {editEmpForm.photoUrl
                ? <img src={editEmpForm.photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : (editEmpForm.name || selectedEmp.name || '??').split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase()
              }
            </div>
            <input id="emp-photo-input" type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > 2 * 1024 * 1024) { toast.error(lang === 'en' ? 'Photo too large (max 2MB)' : lang === 'es' ? 'Foto demasiado pesada (máx 2MB)' : lang === 'it' ? 'Foto troppo pesante (max 2MB)' : 'Photo trop lourde (max 2MB)'); return }
              const r = new FileReader()
              r.onload = ev => setEditEmpForm((fm:any) => ({ ...fm, photoUrl: ev.target?.result as string }))
              r.readAsDataURL(f)
              e.target.value = ''
            }} />
            <div style={{ flex:1, minWidth:0 }}>
              <h3 style={{ fontSize:18, fontWeight:'var(--fw-semibold)', color:'var(--text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {editEmpForm.name || selectedEmp.name}
              </h3>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                {roleLabel(editEmpForm.role || selectedEmp.role, lang)} · {deptLabel(editEmpForm.dept || selectedEmp.dept, lang)}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                <button type="button"
                  onClick={() => empEditMode && setEditEmpForm((f:any) => ({ ...f, isActive:!f.isActive }))}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:99, border:'none', cursor: empEditMode ? 'pointer' : 'default', fontSize:11, fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)', background: editEmpForm.isActive?'rgba(0,208,132,.15)':'rgba(255,59,92,.15)', color: editEmpForm.isActive?'var(--acc2)':'var(--danger)', transition:'all .15s' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background: editEmpForm.isActive?'var(--acc2)':'var(--danger)', boxShadow: editEmpForm.isActive?'0 0 6px var(--acc2)':'0 0 6px var(--danger)' }} />
                  {editEmpForm.isActive ? (lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Employé actif') : (lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => setShowEditEmpModal(false)}
              style={{ width:32, height:32, borderRadius:10, background:'var(--bg3)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
          </div>
        </div>

        {/* CORPS */}
        <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'20px 24px' }}>

          {/* Mode banner */}
          {!empEditMode
            ? <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                <Eye size={14} style={{ color:'var(--acc3)', flexShrink:0 }} />
                <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:'var(--fw-regular)' }}>
                  {lang === 'en' ? 'View mode — click Edit to make changes' : lang === 'es' ? 'Modo visualización — haz clic en Editar para modificar' : lang === 'it' ? 'Modalità visualizzazione — clicca su Modifica per modificare' : 'Mode visualisation — cliquez sur Modifier pour éditer'}
                </span>
              </div>
            : <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                <Pencil size={14} style={{ color:'var(--warn)', flexShrink:0 }} />
                <span style={{ fontSize:12, color:'var(--warn)', fontWeight:'var(--fw-regular)' }}>
                  {lang === 'en' ? 'Edit mode — unsaved changes' : lang === 'es' ? 'Modo edición — cambios no guardados' : lang === 'it' ? 'Modalità modifica — modifiche non salvate' : 'Mode édition — modifications non sauvegardées'}
                </span>
              </div>
          }

          {/* Identité */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:`${editEmpForm.color??'var(--p)'}22`, display:'flex', alignItems:'center', justifyContent:'center', color:editEmpForm.color??'var(--p)' }}><User size={10}/></div>
              {lang === 'en' ? 'IDENTITY' : lang === 'es' ? 'IDENTIDAD' : lang === 'it' ? 'IDENTITÀ' : 'IDENTITÉ'}
            </div>
            <ResponsiveGrid min={160} gap={10}>
              <ViewField label={lang === 'en' ? 'FULL NAME *' : lang === 'es' ? 'NOMBRE COMPLETO *' : lang === 'it' ? 'NOME COMPLETO *' : 'NOM COMPLET *'} value={editEmpForm.name??''} editing={empEditMode}>
                <ValidatedInput type="name" required autoFocus
                  value={editEmpForm.name??''}
                  onChange={val => setEditEmpForm((f:any) => ({ ...f, name:val }))}
                  placeholder="Aminata Diallo" lang={lang} />
              </ViewField>
              <ViewField label={lang === 'en' ? 'POSITION *' : lang === 'es' ? 'PUESTO *' : lang === 'it' ? 'POSIZIONE *' : 'POSTE *'} value={editEmpForm.role??''} editing={empEditMode}>
                <input className="input" placeholder={lang === 'en' ? 'Ex: Cashier' : lang === 'es' ? 'Ej: Cajera' : lang === 'it' ? 'Es: Cassiera' : 'Ex: Caissière'} value={editEmpForm.role??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, role:e.target.value }))} />
              </ViewField>
            </ResponsiveGrid>
          </div>

          {/* Contrat */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:'rgba(255,149,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc)' }}><FileText size={10}/></div>
              {lang === 'en' ? 'CONTRACT' : lang === 'es' ? 'CONTRATO' : lang === 'it' ? 'CONTRATTO' : 'CONTRAT'}
            </div>
            <ResponsiveGrid min={160} gap={10}>
              <ViewField label={lang === 'en' ? 'DEPARTMENT' : lang === 'es' ? 'DEPARTAMENTO' : lang === 'it' ? 'REPARTO' : 'DÉPARTEMENT'} value={editEmpForm.dept??''} editing={empEditMode}>
                <select className="input" value={editEmpForm.dept??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, dept:e.target.value }))}>
                  {Object.keys(DEPT_COLORS).map(d => <option key={d} value={d}>{deptLabel(d, lang)}</option>)}
                </select>
              </ViewField>
              <ViewField label={lang === 'en' ? 'CONTRACT TYPE' : lang === 'es' ? 'TIPO CONTRATO' : lang === 'it' ? 'TIPO CONTRATTO' : 'TYPE CONTRAT'} value={editEmpForm.type??'CDI'} editing={empEditMode}>
                <select className="input" value={editEmpForm.type??'CDI'} onChange={e => setEditEmpForm((f:any) => ({ ...f, type:e.target.value }))}>
                  {['CDI','CDD','Temps partiel','Stage','Freelance'].map(t => <option key={t} value={t}>{contractLabel(t, lang)}</option>)}
                </select>
              </ViewField>
              <ViewField label={lang === 'en' ? 'HIRE DATE' : lang === 'es' ? 'FECHA CONTRATACIÓN' : lang === 'it' ? 'DATA ASSUNZIONE' : 'DATE EMBAUCHE'} value={displayDate(editEmpForm.hiredAt)} editing={empEditMode}>
                <input className="input" type="date" value={editEmpForm.hiredAt ?? ''} onChange={e => setEditEmpForm((f:any) => ({ ...f, hiredAt:e.target.value }))} />
              </ViewField>
              {editEmpForm.type === 'CDI' ? (
                <ViewField label={lang === 'en' ? 'CONTRACT END' : lang === 'es' ? 'FIN DE CONTRATO' : lang === 'it' ? 'FINE CONTRATTO' : 'FIN DE CONTRAT'} value={lang === 'en' ? '∞ Permanent' : lang === 'es' ? '∞ Indefinido' : lang === 'it' ? '∞ Indeterminato' : '∞ Indéterminé'} color="var(--acc2)" editing={empEditMode}>
                  <div style={{ padding:'10px 14px', background:'rgba(0,208,132,.06)', border:'1px solid var(--c-green-bg)', borderRadius:12, fontSize:13, color:'var(--acc2)', fontWeight:'var(--fw-regular)' }}>
                    ∞ {lang === 'en' ? 'Permanent contract' : lang === 'es' ? 'Contrato indefinido' : lang === 'it' ? 'Contratto a tempo indeterminato' : 'Contrat à durée indéterminée'}
                  </div>
                </ViewField>
              ) : (
                <ViewField label={lang === 'en' ? 'CONTRACT END' : lang === 'es' ? 'FIN DE CONTRATO' : lang === 'it' ? 'FINE CONTRATTO' : 'FIN DE CONTRAT'} value={displayDate(editEmpForm.contractEnd)} editing={empEditMode}>
                  <input className="input" type="date" value={editEmpForm.contractEnd??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, contractEnd:e.target.value }))} />
                </ViewField>
              )}
            </ResponsiveGrid>
          </div>

          {/* Rémunération */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:'rgba(0,208,132,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc2)' }}><DollarSign size={10}/></div>
              {lang === 'en' ? 'COMPENSATION' : lang === 'es' ? 'REMUNERACIÓN' : lang === 'it' ? 'RETRIBUZIONE' : 'RÉMUNÉRATION'}
            </div>
            <ViewField
              label={lang === 'en' ? `MONTHLY GROSS SALARY (${currencySymbol})` : lang === 'es' ? `SALARIO BRUTO MENSUAL (${currencySymbol})` : lang === 'it' ? `STIPENDIO LORDO MENSILE (${currencySymbol})` : `SALAIRE MENSUEL BRUT (${currencySymbol})`}
              // ⚠️ Passait par la prop `fmt` (convertisseur injecté) alors que les CNSS/IR/net
              // juste en dessous viennent de `payrollDisplay` : deux chemins dans le même bloc.
              value={fmtDisplay(payrollDisplay({ baseSalary: +salaryInput > 0 ? toXOF(+salaryInput) : (selectedEmp?.salary ?? 0), bonus: 0, overtime: 0, deductions: 0, absences: 0 }, curEmp).baseSalary, curEmp)}
              mono
              editing={empEditMode}>
              <div style={{ position:'relative' }}>
                <input className="input" type="number" placeholder="0"
                  value={salaryInput}
                  onChange={e => setSalaryInput(e.target.value)}
                  style={{ paddingRight:60 }} />
                <span style={{ position:'absolute', right:12, bottom:10, fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text3)', pointerEvents:'none' }}>
                  {currencySymbol}
                </span>
              </div>
            </ViewField>
            {+salaryInput > 0 && (() => {
              const salaryXOF = toXOF(+salaryInput)
              // ⚠️ `net` valait `salaryXOF - cnss - ir` : une SOUSTRACTION D'EUROS À DES FRANCS
              // CFA. 426,77 € affiché au lieu de 371,37 € (55,40 € d'écart). Le net vient
              // désormais du même détail que les retenues.
              const { cnss, ir, net } = payrollDisplay({ baseSalary: salaryXOF, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, curEmp)
              return (
                <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', gap:16, flexWrap:'wrap' }}>
                  <span>CNSS ({CNSS_RATE * 100}%): <strong style={{color:'var(--danger)'}}>− {fmtDisplay(cnss, curEmp)}</strong></span>
                  <span>IR ({IR_RATE * 100}%): <strong style={{color:'var(--acc)'}}>− {fmtDisplay(ir, curEmp)}</strong></span>
                  <span>{lang === 'en' ? 'Net' : lang === 'es' ? 'Neto' : lang === 'it' ? 'Netto' : 'Net'}: <strong style={{color:'var(--acc2)'}}>{fmtDisplay(net, curEmp)}</strong></span>
                </div>
              )
            })()}
          </div>

          {/* Contact */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:'rgba(0,184,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc3)' }}><User size={10}/></div>
              {lang === 'en' ? 'CONTACT' : lang === 'es' ? 'CONTACTO' : lang === 'it' ? 'CONTATTO' : 'CONTACT'}
            </div>
            <ResponsiveGrid min={160} gap={10}>
              <ViewField label={lang === 'en' ? 'PHONE' : lang === 'es' ? 'TELÉFONO' : lang === 'it' ? 'TELEFONO' : 'TÉLÉPHONE'} value={editEmpForm.phone||''} icon="📞" editing={empEditMode}>
                <PhoneInputWithCountry
                  value={editEmpForm.phone??''}
                  onChange={val => setEditEmpForm((f:any) => ({ ...f, phone:val }))}
                  lang={lang}
                />
              </ViewField>
              <ViewField label="EMAIL" value={editEmpForm.email||''} icon="✉️" editing={empEditMode}>
                <ValidatedInput type="email"
                  value={editEmpForm.email??''}
                  onChange={val => setEditEmpForm((f:any) => ({ ...f, email:val }))}
                  placeholder={lang === 'en' ? 'name@email.com' : lang === 'es' ? 'nombre@email.com' : lang === 'it' ? 'nome@email.com' : 'nom@email.com'} lang={lang} />
              </ViewField>
              {empEditMode ? (
                <div style={{ gridColumn:'1/-1' }}>
                  <AddressAutocompleteInput
                    label={lang === 'en' ? 'ADDRESS' : lang === 'es' ? 'DIRECCIÓN' : lang === 'it' ? 'INDIRIZZO' : 'ADRESSE'}
                    value={editEmpForm.address ?? ''}
                    onChange={val => setEditEmpForm((f:any) => ({ ...f, address: val }))}
                    lang={lang}
                  />
                </div>
              ) : (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                    {lang === 'en' ? 'ADDRESS' : lang === 'es' ? 'DIRECCIÓN' : lang === 'it' ? 'INDIRIZZO' : 'ADRESSE'}
                  </label>
                  <div style={{ padding:'9px 13px', background:'transparent', border:'1px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text2)', minHeight:40, display:'flex', alignItems:'center', gap:8 }}>
                    <MapPin size={13} style={{ opacity:.7, flexShrink:0, color:'var(--text3)' }} />
                    <span>
                      {editEmpForm.address?.trim()
                        ? editEmpForm.address
                        : <span style={{ color:'var(--text4)', fontStyle:'italic', fontSize:12 }}>{lang === 'en' ? 'Not provided' : lang === 'es' ? 'No indicada' : lang === 'it' ? 'Non indicata' : 'Non renseignée'}</span>
                      }
                    </span>
                  </div>
                </div>
              )}
            </ResponsiveGrid>
          </div>

          {/* Performance */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:'rgba(255,184,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--warn)' }}><Star size={10}/></div>
              {lang === 'en' ? 'PERFORMANCE' : lang === 'es' ? 'RENDIMIENTO' : lang === 'it' ? 'PRESTAZIONE' : 'PERFORMANCE'}
            </div>
            {empEditMode ? (
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3,4,5].map(s => (
                  <button aria-label={`${lang === 'en' ? 'Rating' : lang === 'es' ? 'Valoración' : lang === 'it' ? 'Valutazione' : 'Note'} ${s}/5`} key={s} type="button"
                    onClick={() => setEditEmpForm((f:any) => ({ ...f, perf:s }))}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', color: s<=(editEmpForm.perf??3) ? 'var(--warn)' : 'var(--border)', display:'flex', alignItems:'center' }}>
                    <Star size={22} fill={s<=(editEmpForm.perf??3) ? 'var(--warn)' : 'none'} />
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={16} style={{ color: s<=(editEmpForm.perf??3) ? 'var(--warn)' : 'var(--border)' }} fill={s<=(editEmpForm.perf??3) ? 'var(--warn)' : 'none'} />
                ))}
                <span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>{editEmpForm.perf??3}/5</span>
              </div>
            )}
          </div>

          {/* Couleur avatar — visible uniquement en édition */}
          {empEditMode && (
            <div>
              <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:16, height:16, borderRadius:4, background:'rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--p2)' }}><Pencil size={10}/></div>
                {lang === 'en' ? 'AVATAR COLOR' : lang === 'es' ? 'COLOR AVATAR' : lang === 'it' ? 'COLORE AVATAR' : 'COULEUR AVATAR'}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {['var(--p)','var(--acc3)','var(--acc2)','var(--acc)','var(--danger)','#F472B6','var(--p3)','var(--warn)'].map(col => (
                  <button key={col} type="button"
                    onClick={() => setEditEmpForm((f:any) => ({ ...f, color:col }))}
                    style={{ width:28, height:28, borderRadius:'50%', background:col, border:'3px solid', borderColor: editEmpForm.color===col?'var(--bg)':'transparent', cursor:'pointer', padding:0, boxShadow: editEmpForm.color===col?`0 0 0 3px ${col}`:'none', transition:'all .15s' }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', background:'var(--bg3)', flexShrink:0, display:'flex', gap:8 }}>
          {!empEditMode ? (
            <>
              <button onClick={() => setEmpEditMode(true)}
                style={{ flex:1, padding:'12px', background:'linear-gradient(135deg,var(--p),var(--p2))', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:'var(--fw-bold)', cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'var(--sh-p)' }}>
                ✏️ {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}
              </button>
              <button onClick={() => setShowEditEmpModal(false)}
                style={{ padding:'12px 18px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', color:'var(--text2)', fontSize:13, fontFamily:'var(--font)', fontWeight:'var(--fw-regular)' }}>
                {lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={async () => {
                  if (!editEmpForm.name?.trim()) { toast.error(lang === 'en' ? 'Name required' : lang === 'es' ? 'Nombre requerido' : lang === 'it' ? 'Nome richiesto' : 'Nom requis'); return }
                  const avatar = (editEmpForm.name||'??').split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase()
                  const salaryXOF = toXOF(+salaryInput || 0)
                  const data = { ...editEmpForm, avatar, salary: Math.round(salaryXOF) }
                  try {
                    await employeesApi.update(String(selectedEmp!.id), {
                      ...data,
                      hiredAt: data.hiredAt ? new Date(data.hiredAt).toISOString() : undefined,
                    })
                    setEmployees((prev: Employee[]) => prev.map(e => e.id===selectedEmp!.id ? {...e, ...data, avatar} : e))
                    toast.success(lang === 'en' ? 'Saved!' : lang === 'es' ? '¡Guardado!' : lang === 'it' ? 'Salvato!' : 'Sauvegardé !')
                  } catch {
                    setEmployees((prev: Employee[]) => prev.map(e => e.id===selectedEmp!.id ? {...e, ...data, avatar} : e))
                    toast.success('Local')
                  }
                  announce(lang === 'en' ? 'Employee updated' : lang === 'es' ? 'Empleado actualizado' : lang === 'it' ? 'Dipendente aggiornato' : 'Employé mis à jour')
                  setEmpEditMode(false)
                  setShowEditEmpModal(false)
                }}
                style={{ flex:1, padding:'12px', background:`linear-gradient(135deg,${editEmpForm.color??'var(--p)'},${editEmpForm.color??'var(--p)'}BB)`, border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:'var(--fw-bold)', cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                ✅ {lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : lang === 'it' ? 'Salva' : 'Sauvegarder'}
              </button>
              <button onClick={() => { openEditModal(selectedEmp!) }}
                style={{ padding:'12px 16px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', color:'var(--text2)', fontSize:13, fontFamily:'var(--font)', fontWeight:'var(--fw-regular)' }}>
                {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
              </button>
              <button
                onClick={async () => {
                  if (!(await confirm({ title: lang === 'en' ? 'Delete employee' : lang === 'es' ? 'Eliminar empleado' : lang === 'it' ? 'Elimina dipendente' : "Supprimer l'employé", message: lang==='fr'?`Supprimer ${selectedEmp!.name} ? Cette action est irréversible.`:`Delete ${selectedEmp!.name}? This action is irreversible.`, danger: true }))) return
                  setEmployees((prev: Employee[]) => prev.filter(e=>e.id!==selectedEmp!.id))
                  setShowEditEmpModal(false)
                  toast.success(lang === 'en' ? 'Deleted' : lang === 'es' ? 'Eliminado' : lang === 'it' ? 'Eliminato' : 'Supprimé')
                }}
                aria-label={lang === 'en' ? 'Delete employee' : lang === 'es' ? 'Eliminar empleado' : lang === 'it' ? 'Elimina dipendente' : "Supprimer l'employé"}
                style={{ width:44, padding:'12px', background:'rgba(255,59,92,.1)', border:'1px solid rgba(255,59,92,.2)', borderRadius:12, cursor:'pointer', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={16}/></button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
