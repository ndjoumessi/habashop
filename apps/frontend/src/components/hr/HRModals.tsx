import { useState } from 'react'
import React from 'react'
import { X, DollarSign, FileText, TrendingUp, Star, Pencil, Gift, Trash2, User, Eye, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { employeesApi } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import { useConvertToXOF, useConvertFromXOF, useCurrencyInfo, useAppStore } from '@/stores/appStore'
import ViewField from '@/components/ui/ViewField'
import ValidatedInput from '@/components/ui/ValidatedInput'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { type Employee, COLORS, DEPT_COLORS, labelStyle, displayDate, calcAnciennete } from '@/components/hr/hrShared'

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
  openEditModal: (emp: Employee) => void
  showNewContractModal: boolean; setShowNewContractModal: (b: boolean) => void
  contractForm: any; setContractForm: (v: any) => void
  showContractDetailModal: boolean; setShowContractDetailModal: (b: boolean) => void
  selectedContract: any
  showLeaveModal: boolean; setShowLeaveModal: (b: boolean) => void
  leaveForm: any; setLeaveForm: (v: any) => void
  setLeaves: (v: any) => void
}

export default function HRModals({ showSalaryModal, setShowSalaryModal, salaryTarget, lang, fmt, employees, setEmployees, handleConfirmRaise, handleConfirmBonus, showModal, setShowModal, showEditEmpModal, setShowEditEmpModal, selectedEmp, editEmpForm, setEditEmpForm, empEditMode, setEmpEditMode, salaryInput, setSalaryInput, toXOF, currency, currencySymbol, openEditModal, showNewContractModal, setShowNewContractModal, contractForm, setContractForm, showContractDetailModal, setShowContractDetailModal, selectedContract, showLeaveModal, setShowLeaveModal, leaveForm, setLeaveForm, setLeaves }: HRModalsProps) {
  return (
    <>
      {/* ── MODAL PRIME / AUGMENTATION ── */}
      {showSalaryModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget && setShowSalaryModal(false)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:900, color:'var(--text)', margin:0, display:'flex', alignItems:'center', gap:8 }}>
                {salaryTarget?.mode === 'raise'
                  ? <><TrendingUp size={15} style={{color:'var(--acc2)',flexShrink:0}}/>{lang === 'en' ? 'Salary raise' : lang === 'es' ? 'Aumento salarial' : lang === 'it' ? 'Aumento salariale' : 'Augmentation salariale'}</>
                  : <><Gift size={15} style={{color:'var(--acc)',flexShrink:0}}/>{lang === 'en' ? 'Add bonus' : lang === 'es' ? 'Agregar una prima' : lang === 'it' ? 'Aggiungi un premio' : 'Ajouter une prime'}{salaryTarget ? ` — ${salaryTarget.name}` : ''}</>}
              </h3>
              <button className="btn btn-sm" onClick={() => setShowSalaryModal(false)}>✕</button>
            </div>
            {salaryTarget?.mode === 'raise' ? (
              <SalaryRaiseForm
                emp={salaryTarget}
                lang={lang}
                fmt={fmt}
                onConfirm={(newSalary: number, reason: string) => {
                  handleConfirmRaise(String(salaryTarget.id), newSalary, reason)
                }}
                onClose={() => setShowSalaryModal(false)}
              />
            ) : (
              <BonusForm
                emp={salaryTarget}
                employees={(employees ?? []).filter(e => e.active)}
                lang={lang}
                fmt={fmt}
                onConfirm={(empId: string|'all', amount: number, reason?: string) => {
                  handleConfirmBonus(empId, amount, reason ?? 'Performance')
                }}
                onClose={() => setShowSalaryModal(false)}
              />
            )}
          </div>
        </div>
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
            setShowModal(false)
          }}
        />
      )}

      {/* ── MODAL EMPLOYÉ PREMIUM (édition) ── */}
      {showEditEmpModal && selectedEmp && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          onClick={e => e.target===e.currentTarget && setShowEditEmpModal(false)}>
          <div style={{ background:'#0D0D1C', border:'1px solid rgba(255,255,255,.1)', borderRadius:24, width:'100%', maxWidth:560, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.8)', position:'relative' }}>

            {/* Ligne décorative */}
            <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'40%', height:1, background:`linear-gradient(90deg,transparent,${editEmpForm.color??'var(--p)'},transparent)` }} />

            {/* HEADER */}
            <div style={{ padding:'24px 24px 20px', background:`linear-gradient(135deg,${editEmpForm.color??'var(--p)'}18,${editEmpForm.color??'var(--p)'}05)`, borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div
                  style={{ width:60, height:60, borderRadius:18, overflow:'hidden', background:`linear-gradient(135deg,${editEmpForm.color??'var(--p)'},${editEmpForm.color??'var(--p)'}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'#fff', flexShrink:0, boxShadow:`0 8px 24px ${editEmpForm.color??'var(--p)'}50`, border:`2px solid ${editEmpForm.color??'var(--p)'}40`, letterSpacing:'-1px', cursor: empEditMode ? 'pointer' : 'default', position:'relative' }}
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
                  <h3 style={{ fontSize:18, fontWeight:900, color:'var(--text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {editEmpForm.name || selectedEmp.name}
                  </h3>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                    {editEmpForm.role || selectedEmp.role} · {editEmpForm.dept || selectedEmp.dept}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                    <button type="button"
                      onClick={() => empEditMode && setEditEmpForm((f:any) => ({ ...f, isActive:!f.isActive }))}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:99, border:'none', cursor: empEditMode ? 'pointer' : 'default', fontSize:11, fontWeight:700, fontFamily:'var(--font)', background: editEmpForm.isActive?'rgba(0,208,132,.15)':'rgba(255,59,92,.15)', color: editEmpForm.isActive?'var(--acc2)':'var(--danger)', transition:'all .15s' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background: editEmpForm.isActive?'var(--acc2)':'var(--danger)', boxShadow: editEmpForm.isActive?'0 0 6px var(--acc2)':'0 0 6px var(--danger)' }} />
                      {editEmpForm.isActive ? (lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Employé actif') : (lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setShowEditEmpModal(false)}
                  style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)', cursor:'pointer', fontSize:16, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
              </div>
            </div>

            {/* CORPS */}
            <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'20px 24px' }}>

              {/* Mode banner */}
              {!empEditMode
                ? <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                    <Eye size={14} style={{ color:'var(--acc3)', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>
                      {lang === 'en' ? 'View mode — click Edit to make changes' : lang === 'es' ? 'Modo visualización — haz clic en Editar para modificar' : lang === 'it' ? 'Modalità visualizzazione — clicca su Modifica per modificare' : 'Mode visualisation — cliquez sur Modifier pour éditer'}
                    </span>
                  </div>
                : <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                    <Pencil size={14} style={{ color:'var(--warn)', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>
                      {lang === 'en' ? 'Edit mode — unsaved changes' : lang === 'es' ? 'Modo edición — cambios no guardados' : lang === 'it' ? 'Modalità modifica — modifiche non salvate' : 'Mode édition — modifications non sauvegardées'}
                    </span>
                  </div>
              }

              {/* Identité */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:`${editEmpForm.color??'var(--p)'}22`, display:'flex', alignItems:'center', justifyContent:'center', color:editEmpForm.color??'var(--p)' }}><User size={10}/></div>
                  {lang === 'en' ? 'IDENTITY' : lang === 'es' ? 'IDENTIDAD' : lang === 'it' ? 'IDENTITÀ' : 'IDENTITÉ'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <ViewField label={lang === 'en' ? 'FULL NAME *' : lang === 'es' ? 'NOMBRE COMPLETO *' : lang === 'it' ? 'NOME COMPLETO *' : 'NOM COMPLET *'} value={editEmpForm.name??''} editing={empEditMode}>
                    <ValidatedInput type="name" required autoFocus
                      value={editEmpForm.name??''}
                      onChange={val => setEditEmpForm((f:any) => ({ ...f, name:val }))}
                      placeholder="Aminata Diallo" lang={lang} />
                  </ViewField>
                  <ViewField label={lang === 'en' ? 'POSITION *' : lang === 'es' ? 'PUESTO *' : lang === 'it' ? 'POSIZIONE *' : 'POSTE *'} value={editEmpForm.role??''} editing={empEditMode}>
                    <input className="input" placeholder={lang === 'en' ? 'Ex: Cashier' : lang === 'es' ? 'Ej: Cajera' : lang === 'it' ? 'Es: Cassiera' : 'Ex: Caissière'} value={editEmpForm.role??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, role:e.target.value }))} />
                  </ViewField>
                </div>
              </div>

              {/* Contrat */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(255,149,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc)' }}><FileText size={10}/></div>
                  {lang === 'en' ? 'CONTRACT' : lang === 'es' ? 'CONTRATO' : lang === 'it' ? 'CONTRATTO' : 'CONTRAT'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <ViewField label={lang === 'en' ? 'DEPARTMENT' : lang === 'es' ? 'DEPARTAMENTO' : lang === 'it' ? 'REPARTO' : 'DÉPARTEMENT'} value={editEmpForm.dept??''} editing={empEditMode}>
                    <select className="input" value={editEmpForm.dept??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, dept:e.target.value }))}>
                      {Object.keys(DEPT_COLORS).map(d => <option key={d}>{d}</option>)}
                    </select>
                  </ViewField>
                  <ViewField label={lang === 'en' ? 'CONTRACT TYPE' : lang === 'es' ? 'TIPO CONTRATO' : lang === 'it' ? 'TIPO CONTRATTO' : 'TYPE CONTRAT'} value={editEmpForm.type??'CDI'} editing={empEditMode}>
                    <select className="input" value={editEmpForm.type??'CDI'} onChange={e => setEditEmpForm((f:any) => ({ ...f, type:e.target.value }))}>
                      {['CDI','CDD','Temps partiel','Stage','Freelance'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </ViewField>
                  <ViewField label={lang === 'en' ? 'HIRE DATE' : lang === 'es' ? 'FECHA CONTRATACIÓN' : lang === 'it' ? 'DATA ASSUNZIONE' : 'DATE EMBAUCHE'} value={displayDate(editEmpForm.hiredAt)} editing={empEditMode}>
                    <input className="input" type="date" value={editEmpForm.hiredAt ?? ''} onChange={e => setEditEmpForm((f:any) => ({ ...f, hiredAt:e.target.value }))} />
                  </ViewField>
                  {editEmpForm.type === 'CDI' ? (
                    <ViewField label={lang === 'en' ? 'CONTRACT END' : lang === 'es' ? 'FIN DE CONTRATO' : lang === 'it' ? 'FINE CONTRATTO' : 'FIN DE CONTRAT'} value={lang === 'en' ? '∞ Permanent' : lang === 'es' ? '∞ Indefinido' : lang === 'it' ? '∞ Indeterminato' : '∞ Indéterminé'} color="var(--acc2)" editing={empEditMode}>
                      <div style={{ padding:'10px 14px', background:'rgba(0,208,132,.06)', border:'1px solid var(--c-green-bg)', borderRadius:12, fontSize:13, color:'var(--acc2)', fontWeight:600 }}>
                        ∞ {lang === 'en' ? 'Permanent contract' : lang === 'es' ? 'Contrato indefinido' : lang === 'it' ? 'Contratto a tempo indeterminato' : 'Contrat à durée indéterminée'}
                      </div>
                    </ViewField>
                  ) : (
                    <ViewField label={lang === 'en' ? 'CONTRACT END' : lang === 'es' ? 'FIN DE CONTRATO' : lang === 'it' ? 'FINE CONTRATTO' : 'FIN DE CONTRAT'} value={displayDate(editEmpForm.contractEnd)} editing={empEditMode}>
                      <input className="input" type="date" value={editEmpForm.contractEnd??''} onChange={e => setEditEmpForm((f:any) => ({ ...f, contractEnd:e.target.value }))} />
                    </ViewField>
                  )}
                </div>
              </div>

              {/* Rémunération */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(0,208,132,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc2)' }}><DollarSign size={10}/></div>
                  {lang === 'en' ? 'COMPENSATION' : lang === 'es' ? 'REMUNERACIÓN' : lang === 'it' ? 'RETRIBUZIONE' : 'RÉMUNÉRATION'}
                </div>
                <ViewField
                  label={lang==='fr'?`SALAIRE MENSUEL BRUT (${currency})`:`MONTHLY GROSS SALARY (${currency})`}
                  value={fmt(+salaryInput > 0 ? toXOF(+salaryInput) : (selectedEmp?.salary ?? 0))}
                  mono
                  editing={empEditMode}>
                  <div style={{ position:'relative' }}>
                    <input className="input" type="number" placeholder="0"
                      value={salaryInput}
                      onChange={e => setSalaryInput(e.target.value)}
                      style={{ paddingRight:60 }} />
                    <span style={{ position:'absolute', right:12, bottom:10, fontSize:11, fontWeight:700, color:'var(--text3)', pointerEvents:'none' }}>
                      {currencySymbol}
                    </span>
                  </div>
                </ViewField>
                {+salaryInput > 0 && (() => {
                  const salaryXOF = toXOF(+salaryInput)
                  const cnss = Math.round(salaryXOF * 0.08)
                  const ir   = Math.round(salaryXOF * 0.05)
                  const net  = salaryXOF - cnss - ir
                  return (
                    <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', gap:16, flexWrap:'wrap' }}>
                      <span>CNSS (8%): <strong style={{color:'var(--danger)'}}>− {fmt(cnss)}</strong></span>
                      <span>IR (5%): <strong style={{color:'var(--acc)'}}>− {fmt(ir)}</strong></span>
                      <span>Net: <strong style={{color:'var(--acc2)'}}>{fmt(net)}</strong></span>
                    </div>
                  )
                })()}
              </div>

              {/* Contact */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(0,184,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--acc3)' }}><User size={10}/></div>
                  {lang === 'en' ? 'CONTACT' : lang === 'es' ? 'CONTACTO' : lang === 'it' ? 'CONTATTO' : 'CONTACT'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
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
                      placeholder="nom@email.com" lang={lang} />
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
                      <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                        {lang === 'en' ? 'ADDRESS' : lang === 'es' ? 'DIRECCIÓN' : lang === 'it' ? 'INDIRIZZO' : 'ADRESSE'}
                      </label>
                      <div style={{ padding:'9px 13px', background:'transparent', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, fontSize:13, color:'var(--text2)', minHeight:40, display:'flex', alignItems:'center', gap:8 }}>
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
                </div>
              </div>

              {/* Performance */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:16, height:16, borderRadius:4, background:'rgba(255,184,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--warn)' }}><Star size={10}/></div>
                  PERFORMANCE
                </div>
                {empEditMode ? (
                  <div style={{ display:'flex', gap:4 }}>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button"
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
                  <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:16, height:16, borderRadius:4, background:'rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--p2)' }}><Pencil size={10}/></div>
                    {lang === 'en' ? 'AVATAR COLOR' : lang === 'es' ? 'COLOR AVATAR' : lang === 'it' ? 'COLORE AVATAR' : 'COULEUR AVATAR'}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['var(--p)','var(--acc3)','var(--acc2)','var(--acc)','var(--danger)','#F472B6','var(--p3)','var(--warn)'].map(col => (
                      <button key={col} type="button"
                        onClick={() => setEditEmpForm((f:any) => ({ ...f, color:col }))}
                        style={{ width:28, height:28, borderRadius:'50%', background:col, border:'3px solid', borderColor: editEmpForm.color===col?'#fff':'transparent', cursor:'pointer', padding:0, boxShadow: editEmpForm.color===col?`0 0 0 3px ${col}`:'none', transition:'all .15s' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,.06)', background:'rgba(0,0,0,.2)', flexShrink:0, display:'flex', gap:8 }}>
              {!empEditMode ? (
                <>
                  <button onClick={() => setEmpEditMode(true)}
                    style={{ flex:1, padding:'12px', background:'linear-gradient(135deg,var(--p),var(--p2))', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'var(--sh-p)' }}>
                    ✏️ {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}
                  </button>
                  <button onClick={() => setShowEditEmpModal(false)}
                    style={{ padding:'12px 18px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, cursor:'pointer', color:'var(--text2)', fontSize:13, fontFamily:'var(--font)', fontWeight:600 }}>
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
                        toast.success('✅ '+(lang === 'en' ? 'Saved!' : lang === 'es' ? '¡Guardado!' : lang === 'it' ? 'Salvato!' : 'Sauvegardé !'))
                      } catch {
                        setEmployees((prev: Employee[]) => prev.map(e => e.id===selectedEmp!.id ? {...e, ...data, avatar} : e))
                        toast.success('✅ Local')
                      }
                      setEmpEditMode(false)
                      setShowEditEmpModal(false)
                    }}
                    style={{ flex:1, padding:'12px', background:`linear-gradient(135deg,${editEmpForm.color??'var(--p)'},${editEmpForm.color??'var(--p)'}BB)`, border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    ✅ {lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : lang === 'it' ? 'Salva' : 'Sauvegarder'}
                  </button>
                  <button onClick={() => { openEditModal(selectedEmp!) }}
                    style={{ padding:'12px 16px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, cursor:'pointer', color:'var(--text2)', fontSize:13, fontFamily:'var(--font)', fontWeight:600 }}>
                    {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!(await confirm({ title: lang === 'en' ? 'Delete employee' : lang === 'es' ? 'Eliminar empleado' : lang === 'it' ? 'Elimina dipendente' : "Supprimer l'employé", message: lang==='fr'?`Supprimer ${selectedEmp!.name} ? Cette action est irréversible.`:`Delete ${selectedEmp!.name}? This action is irreversible.`, danger: true }))) return
                      setEmployees((prev: Employee[]) => prev.filter(e=>e.id!==selectedEmp!.id))
                      setShowEditEmpModal(false)
                      toast.success(lang === 'en' ? 'Deleted' : lang === 'es' ? 'Eliminado' : lang === 'it' ? 'Eliminato' : 'Supprimé')
                    }}
                    style={{ width:44, padding:'12px', background:'rgba(255,59,92,.1)', border:'1px solid rgba(255,59,92,.2)', borderRadius:12, cursor:'pointer', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={16}/></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LEAVE REQUEST ── */}
      {/* ── MODAL NOUVEAU CONTRAT ── */}
      {showNewContractModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget&&setShowNewContractModal(false)}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--sh-xl)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--text)' }}>📄 {lang === 'en' ? 'New contract' : lang === 'es' ? 'Nuevo contrato' : lang === 'it' ? 'Nuovo contratto' : 'Nouveau contrat'}</h3>
              <button onClick={()=>setShowNewContractModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={18}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>{lang === 'en' ? 'EMPLOYEE NAME' : lang === 'es' ? 'NOMBRE DEL EMPLEADO' : lang === 'it' ? 'NOME DEL DIPENDENTE' : 'NOM DE L\'EMPLOYÉ'}</label>
                <input aria-label={lang === 'en' ? 'EMPLOYEE NAME' : lang === 'es' ? 'NOMBRE DEL EMPLEADO' : lang === 'it' ? 'NOME DEL DIPENDENTE' : 'NOM DE L\'EMPLOYÉ'} className="input" placeholder={lang === 'en' ? 'Employee name' : lang === 'es' ? 'Nombre del empleado' : lang === 'it' ? 'Nome del dipendente' : 'Aminata Diallo'} value={contractForm.empId} onChange={e=>setContractForm(f=>({...f,empId:e.target.value}))}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>{lang === 'en' ? 'POSITION' : lang === 'es' ? 'PUESTO' : lang === 'it' ? 'POSIZIONE' : 'POSTE'}</label>
                  <input aria-label={lang === 'en' ? 'POSITION' : lang === 'es' ? 'PUESTO' : lang === 'it' ? 'POSIZIONE' : 'POSTE'} className="input" placeholder={lang === 'en' ? 'Ex: Cashier' : lang === 'es' ? 'Ej: Cajera' : lang === 'it' ? 'Es: Cassiera' : 'Ex: Caissière'} value={contractForm.role} onChange={e=>setContractForm(f=>({...f,role:e.target.value}))}/>
                </div>
                <div>
                  <label style={labelStyle}>{lang === 'en' ? 'DEPARTMENT' : lang === 'es' ? 'DEPARTAMENTO' : lang === 'it' ? 'REPARTO' : 'DÉPARTEMENT'}</label>
                  <select aria-label={lang === 'en' ? 'DEPARTMENT' : lang === 'es' ? 'DEPARTAMENTO' : lang === 'it' ? 'REPARTO' : 'DÉPARTEMENT'} className="input" value={contractForm.dept} onChange={e=>setContractForm(f=>({...f,dept:e.target.value}))}>
                    {Object.keys(DEPT_COLORS).map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{lang === 'en' ? 'CONTRACT TYPE' : lang === 'es' ? 'TIPO CONTRATO' : lang === 'it' ? 'TIPO CONTRATTO' : 'TYPE CONTRAT'}</label>
                  <select aria-label={lang === 'en' ? 'CONTRACT TYPE' : lang === 'es' ? 'TIPO CONTRATO' : lang === 'it' ? 'TIPO CONTRATTO' : 'TYPE CONTRAT'} className="input" value={contractForm.type} onChange={e=>setContractForm(f=>({...f,type:e.target.value}))}>
                    {['CDI','CDD','Temps partiel','Stage','Freelance'].map(t=><option key={t}>{t}</option>)}
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
                    <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:11, fontWeight:700, color:'var(--text3)', pointerEvents:'none' }}>FCFA</span>
                  </div>
                  {contractForm.salary>0&&(
                    <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', gap:12 }}>
                      <span>CNSS: <strong style={{color:'var(--danger)'}}>−{fmt(Math.round(contractForm.salary*0.08))}</strong></span>
                      <span>Net: <strong style={{color:'var(--acc2)'}}>{fmt(Math.round(contractForm.salary*0.87))}</strong></span>
                    </div>
                  )}
                </div>
              </div>
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
                  salary: contractForm.salary,
                  type: contractForm.type as 'CDI'|'CDD',
                  hiredAt: contractForm.hiredAt ? new Date(contractForm.hiredAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
                  endAt: contractForm.type==='CDD'&&contractForm.contractEnd ? new Date(contractForm.contractEnd).toLocaleDateString('fr-FR') : undefined,
                  avatar: contractForm.empId.trim().split(' ').map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase(),
                  color: COLORS[employees.length % COLORS.length],
                  active: true, phone:'', email:'', perf:3,
                }
                setEmployees(prev=>[...prev, newEmp])
                toast.success('✅ '+(lang === 'en' ? 'Contract created!' : lang === 'es' ? '¡Contrato creado!' : lang === 'it' ? 'Contratto creato!' : 'Contrat créé !'))
                setShowNewContractModal(false)
              }}>✅ {lang === 'en' ? 'Create contract' : lang === 'es' ? 'Crear el contrato' : lang === 'it' ? 'Crea il contratto' : 'Créer le contrat'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAIL CONTRAT ── */}
      {showContractDetailModal && selectedContract && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget&&setShowContractDetailModal(false)}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, width:'100%', maxWidth:480, boxShadow:'var(--sh-xl)', overflow:'hidden' }}>
            <div style={{ padding:'24px 24px 20px', background:`linear-gradient(135deg,${selectedContract.color}18,${selectedContract.color}05)`, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:56, height:56, borderRadius:16, overflow:'hidden', background:`linear-gradient(135deg,${selectedContract.color},${selectedContract.color}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff', flexShrink:0, boxShadow:`0 6px 20px ${selectedContract.color}50` }}>
                  {selectedContract.photoUrl
                    ? <img src={selectedContract.photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : selectedContract.avatar}
                </div>
                <div style={{ flex:1 }}>
                  <h3 style={{ margin:0, fontSize:17, fontWeight:900, color:'var(--text)' }}>{selectedContract.name}</h3>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>{selectedContract.role} · {selectedContract.dept}</div>
                </div>
                <button onClick={()=>setShowContractDetailModal(false)} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, width:32, height:32, cursor:'pointer', color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✕</button>
              </div>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', gap:8 }}>
                <span style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, background:selectedContract.type==='CDI'?'rgba(108,71,255,.15)':'rgba(14,196,126,.12)', color:selectedContract.type==='CDI'?'var(--p2)':'var(--acc2)' }}>{selectedContract.type}</span>
                <span style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, background:selectedContract.active?'var(--c-green-bg)':'var(--bg3)', color:selectedContract.active?'var(--acc2)':'var(--text3)' }}>
                  {selectedContract.active?(lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif'):(lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')}
                </span>
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  {label:lang === 'en' ? 'Hire date' : lang === 'es' ? 'Fecha de contratación' : lang === 'it' ? 'Data di assunzione' : 'Date d\'embauche', value:displayDate(selectedContract.hiredAt, lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR')},
                  {label:lang === 'en' ? 'Seniority' : lang === 'es' ? 'Antigüedad' : lang === 'it' ? 'Anzianità' : 'Ancienneté', value:calcAnciennete(selectedContract.hiredAt)},
                  ...(selectedContract.type!=='CDI'&&selectedContract.endAt
                    ? [{label:lang === 'en' ? 'Contract end' : lang === 'es' ? 'Fin de contrato' : lang === 'it' ? 'Fine contratto' : 'Fin de contrat', value:displayDate(selectedContract.endAt, lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR')}]
                    : selectedContract.type==='CDI'
                      ? [{label:lang === 'en' ? 'Contract end' : lang === 'es' ? 'Fin de contrato' : lang === 'it' ? 'Fine contratto' : 'Fin de contrat', value:lang === 'en' ? '∞ Permanent' : lang === 'es' ? '∞ Indefinido' : lang === 'it' ? '∞ Indeterminato' : '∞ Indéterminé'}]
                      : []
                  ),
                ].map(row=>(
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>{row.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:'var(--mono)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:12, padding:16 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)', marginBottom:12 }}>💰 {lang === 'en' ? 'COMPENSATION' : lang === 'es' ? 'REMUNERACIÓN' : lang === 'it' ? 'RETRIBUZIONE' : 'RÉMUNÉRATION'}</div>
                {[
                  {label:lang === 'en' ? 'Gross salary' : lang === 'es' ? 'Salario bruto' : lang === 'it' ? 'Stipendio lordo' : 'Salaire brut', value:fmt(selectedContract.salary), color:'var(--text)'},
                  {label:'CNSS (8%)', value:`− ${fmt(Math.round(selectedContract.salary*0.08))}`, color:'var(--danger)'},
                  {label:'IR (5%)', value:`− ${fmt(Math.round(selectedContract.salary*0.05))}`, color:'var(--acc)'},
                  {label:lang === 'en' ? 'Net salary' : lang === 'es' ? 'Neto a pagar' : lang === 'it' ? 'Netto da pagare' : 'Net à payer', value:fmt(Math.round(selectedContract.salary*0.87)), color:'var(--acc2)'},
                ].map(row=>(
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>{row.label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:row.color, fontFamily:'var(--mono)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,.06)', background:'rgba(0,0,0,.15)', display:'flex', gap:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{
                openEditModal(selectedContract)
                setShowContractDetailModal(false)
              }}>✏️ {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}</button>
              <button className="btn" style={{ padding:'10px 16px' }} onClick={()=>setShowContractDetailModal(false)}>{lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}</button>
            </div>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLeaveModal(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                🌴 {lang === 'en' ? 'New request' : lang === 'es' ? 'Nueva solicitud' : lang === 'it' ? 'Nuova richiesta' : 'Nouvelle demande'}
              </h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>{lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'}</label>
                <select aria-label={lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'} className="input" style={{ width: '100%' }}
                  value={leaveForm.empId}
                  onChange={e => setLeaveForm(f => ({ ...f, empId: Number(e.target.value) }))}>
                  <option value={0}>{lang === 'en' ? 'Select...' : lang === 'es' ? 'Seleccionar...' : lang === 'it' ? 'Seleziona...' : 'Sélectionner...'}</option>
                  {(employees ?? []).filter(e => e.active).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              </div>
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
                  const emp = (employees ?? []).find(e => e.id === leaveForm.empId)
                  const start = new Date(leaveForm.startDate)
                  const end   = new Date(leaveForm.endDate)
                  const days  = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                  setLeaves(prev => [...prev, {
                    id: Date.now(),
                    empId: leaveForm.empId,
                    type: leaveForm.type,
                    from: leaveForm.startDate,
                    to: leaveForm.endDate,
                    days,
                    motif: leaveForm.notes,
                    status: 'pending',
                  }])
                  toast.success('✅ ' + (lang === 'en' ? 'Request submitted!' : lang === 'es' ? '¡Solicitud enviada!' : lang === 'it' ? 'Richiesta inviata!' : 'Demande soumise !'))
                  setShowLeaveModal(false)
                }}>
                ✅ {lang === 'en' ? 'Submit' : lang === 'es' ? 'Enviar' : lang === 'it' ? 'Invia' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Modal Employee ───────────────────────────────────────────────────────────

function EmpModal({ emp, onClose, onSave, onDelete }: {
  emp: Employee | null
  onClose: () => void
  onSave: (data: any) => void
  onDelete?: (id: number) => void
}) {
  const toXOF   = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
  const { code, symbol, decimals } = useCurrencyInfo()
  const lang = useAppStore(s => s.lang)
  const T = (fr: string, en: string, es: string, it: string) =>
    lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it

  const [name, setName]       = useState(emp?.name ?? '')
  const [role, setRole]       = useState(emp?.role ?? '')
  const [dept, setDept]       = useState(emp?.dept ?? '')
  const [salary, setSalary]   = useState(emp?.salary != null ? fromXOF(emp.salary).toFixed(decimals) : '')
  const [type, setType]       = useState<'CDI'|'CDD'>(emp?.type ?? 'CDI')
  const [hiredAt, setHiredAt] = useState(emp?.hiredAt ?? '')
  const [endAt, setEndAt]     = useState(emp?.endAt ?? '')
  const [phone, setPhone]     = useState(emp?.phone ?? '')
  const [email, setEmail]     = useState(emp?.email ?? '')
  const [color, setColor]     = useState(emp?.color ?? COLORS[0])
  const [active, setActive]   = useState(emp?.active ?? true)
  const [perf, setPerf]       = useState(emp?.perf ?? 3)

  const deptColor = DEPT_COLORS[dept] ?? color

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20,
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--sh-xl)',
      }}>
        {/* Fixed header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {emp && (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `linear-gradient(135deg, ${color}, ${color}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {emp.avatar}
              </div>
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>
                {emp ? emp.name : `➕ ${T('Nouvel employé', 'New employee', 'Nuevo empleado', 'Nuovo dipendente')}`}
              </h3>
              {emp && <div style={{ fontSize: 11, color: deptColor, fontWeight: 600, marginTop: 1 }}>{dept || emp.dept}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {emp && onDelete && (
              <button onClick={() => onDelete(emp.id)} style={{ background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.25)', borderRadius: 8, cursor: 'pointer', color: 'var(--danger)', padding: '6px 10px', fontSize: 14 }}>
                🗑
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ValidatedInput type="name" required autoFocus label={T('Nom complet *', 'Full name *', 'Nombre completo *', 'Nome completo *')}
              value={name} onChange={setName} placeholder={T('Prénom Nom', 'First Last', 'Nombre Apellido', 'Nome Cognome')} />
            <ValidatedInput type="text" required label={T('Poste *', 'Position *', 'Puesto *', 'Posizione *')}
              value={role} onChange={setRole} placeholder={T('Ex: Caissière', 'Ex: Cashier', 'Ej: Cajera', 'Es: Cassiera')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">{T('Département', 'Department', 'Departamento', 'Dipartimento')}</label>
              <input aria-label={T('Département', 'Department', 'Departamento', 'Dipartimento')} className="input" value={dept} onChange={e => setDept(e.target.value)} placeholder={T('Ex: Ventes', 'Ex: Sales', 'Ej: Ventas', 'Es: Vendite')} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="form-label">{T('Contrat', 'Contract', 'Contrato', 'Contratto')}</label>
              <select aria-label={T('Contrat', 'Contract', 'Contrato', 'Contratto')} className="input" value={type} onChange={e => setType(e.target.value as 'CDI'|'CDD')} style={{ width: '100%' }}>
                <option value="CDI">{T('CDI', 'Permanent', 'Indefinido', 'Indeterminato')}</option>
                <option value="CDD">{T('CDD', 'Fixed-term', 'Temporal', 'Determinato')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">{T('Salaire brut', 'Gross salary', 'Salario bruto', 'Stipendio lordo')} ({code})</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder={code === 'XOF' || code === 'XAF' ? '350000' : '500'} style={{ width: '100%', boxSizing: 'border-box', paddingRight: 50 }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--acc2)', fontSize: 12, fontWeight: 800, pointerEvents: 'none' }}>{symbol}</span>
            </div>
            {salary && code !== 'XOF' && code !== 'XAF' && (
              <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 4 }}>
                <span>≈</span>
                <span style={{ color: 'var(--acc2)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.round(toXOF(Number(salary) || 0)).toLocaleString('fr-FR')} XOF</span>
                <span>{T('en base', 'stored', 'en base', 'in base')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">{T("Date d'embauche", 'Hire date', 'Fecha de contratación', 'Data di assunzione')}</label>
              <input aria-label={T("Date d'embauche", 'Hire date', 'Fecha de contratación', 'Data di assunzione')} className="input" value={hiredAt} onChange={e => setHiredAt(e.target.value)} placeholder="JJ/MM/AAAA" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            {type === 'CDD' && (
              <div>
                <label className="form-label">{T('Fin de contrat', 'Contract end', 'Fin de contrato', 'Fine contratto')}</label>
                <input aria-label={T('Fin de contrat', 'Contract end', 'Fin de contrato', 'Fine contratto')} className="input" value={endAt} onChange={e => setEndAt(e.target.value)} placeholder="JJ/MM/AAAA" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}
          </div>

          <PhoneInputWithCountry
            label={T('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')}
            value={phone}
            onChange={setPhone}
          />

          <ValidatedInput type="email" label="Email"
            value={email} onChange={setEmail}
            placeholder="prenom@boutique.com" />

          <div>
            <label className="form-label">{T('Performance', 'Performance', 'Rendimiento', 'Prestazione')}</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setPerf(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: star <= perf ? '#F59E0B' : 'var(--border2)', padding: '2px 3px', lineHeight: 1 }}>★</button>
              ))}
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>{perf}/5</span>
            </div>
          </div>

          {emp && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{T('Statut employé', 'Employee status', 'Estado del empleado', 'Stato dipendente')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{active ? T('Employé actif', 'Active employee', 'Empleado activo', 'Dipendente attivo') : T('Employé inactif', 'Inactive employee', 'Empleado inactivo', 'Dipendente inattivo')}</div>
              </div>
              <button onClick={() => setActive(a => !a)} style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: '1px solid',
                background: active ? 'rgba(14,196,126,.12)' : 'rgba(232,64,74,.1)',
                color: active ? 'var(--acc2)' : 'var(--danger)',
                borderColor: active ? 'rgba(14,196,126,.3)' : 'rgba(232,64,74,.25)',
              }}>
                {active ? `✓ ${T('Actif', 'Active', 'Activo', 'Attivo')}` : `✗ ${T('Inactif', 'Inactive', 'Inactivo', 'Inattivo')}`}
              </button>
            </div>
          )}

          <div>
            <label className="form-label">{T("Couleur d'avatar", 'Avatar color', 'Color de avatar', 'Colore avatar')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2, transition: 'all .15s', transform: color === c ? 'scale(1.2)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>

        </div>

        {/* Fixed footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{T('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => {
              if (!name.trim() || !role.trim()) { toast.error(T('Nom et poste requis', 'Name and position required', 'Nombre y puesto requeridos', 'Nome e posizione richiesti')); return }
              onSave({ name, role, dept, salary: toXOF(Number(salary) || 0), type, hiredAt, endAt: endAt || undefined, phone, email, color, active, perf })
            }}>
            {emp ? `💾 ${T('Enregistrer', 'Save', 'Guardar', 'Salva')}` : `➕ ${T('Ajouter', 'Add', 'Agregar', 'Aggiungi')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SalaryRaiseForm ──────────────────────────────────────────────────────────

function SalaryRaiseForm({ emp, lang, fmt, onConfirm, onClose }: any) {
  const fromXOF = useConvertFromXOF()
  const toXOF   = useConvertToXOF()
  const { currency, symbol, decimals } = useCurrencyInfo()

  const oldSalaryXOF = Number(emp.salary) || 0
  const [newSalaryInput, setNewSalaryInput] = useState(
    fromXOF(oldSalaryXOF).toFixed(decimals)
  )
  const [reason, setReason] = useState('')

  const newSalaryXOF = toXOF(+newSalaryInput || 0)
  const diff = newSalaryXOF - oldSalaryXOF
  const pct  = oldSalaryXOF > 0 ? Math.round((diff / oldSalaryXOF) * 100) : 0

  const lbl: React.CSSProperties = { display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Salaire actuel — affiché en devise courante via fmt() */}
      <div style={{ padding:'12px 16px', background:'rgba(108,71,255,.06)', border:'1px solid var(--c-purple-bg)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text2)' }}>{lang === 'en' ? 'Current salary' : lang === 'es' ? 'Salario actual' : lang === 'it' ? 'Stipendio attuale' : 'Salaire actuel'}</span>
        <span style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:16, color:'var(--text)' }}>{fmt(oldSalaryXOF)}</span>
      </div>
      <div>
        <label style={lbl}>{lang==='fr' ? `NOUVEAU SALAIRE (${currency})` : `NEW SALARY (${currency})`}</label>
        <div style={{ position:'relative' }}>
          <ValidatedInput type="amount"
            value={newSalaryInput}
            onChange={setNewSalaryInput}
            placeholder="0"
            min={0}
            decimals={decimals}
            lang={lang}
            style={{ paddingRight: 40 }}
            autoFocus
          />
          <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:12, pointerEvents:'none', fontWeight:600 }}>{symbol}</span>
        </div>
        {newSalaryInput && +newSalaryInput > 0 && (
          <div style={{ marginTop:6, fontSize:11, display:'flex', gap:10, flexWrap:'wrap' }}>
            <span style={{ color:'var(--text3)' }}>
              {lang === 'en' ? 'Difference' : lang === 'es' ? 'Diferencia' : lang === 'it' ? 'Differenza' : 'Différence'}{': '}
              <strong style={{ color: diff >= 0 ? 'var(--acc2)' : 'var(--danger)' }}>
                {diff >= 0 ? '+' : ''}{fmt(Math.abs(diff))} ({pct >= 0 ? '+' : ''}{pct}%)
              </strong>
            </span>
          </div>
        )}
      </div>
      <div>
        <label style={lbl}>{lang === 'en' ? 'REASON' : lang === 'es' ? 'MOTIVO' : lang === 'it' ? 'MOTIVO' : 'MOTIF'}</label>
        <input aria-label={lang === 'en' ? 'REASON' : lang === 'es' ? 'MOTIVO' : lang === 'it' ? 'MOTIVO' : 'MOTIF'} className="input" placeholder={lang === 'en' ? 'Ex: Promotion, Seniority...' : lang === 'es' ? 'Ej: Promoción, Antigüedad...' : lang === 'it' ? 'Es: Promozione, Anzianità...' : 'Ex: Promotion, Ancienneté...'} value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={() => {
          if (!newSalaryInput || +newSalaryInput <= 0) return
          onConfirm(newSalaryXOF, reason || 'Augmentation')
        }}>
          ✅ {lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : lang === 'it' ? 'Conferma' : 'Confirmer'}
        </button>
        <button className="btn" style={{ padding:'10px 14px' }} onClick={onClose}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
      </div>
    </div>
  )
}

// ─── BonusForm ──────────────────────────────────────────────────────────────────

function BonusForm({ emp, employees, lang, fmt, onConfirm, onClose }: any) {
  const toXOF  = useConvertToXOF()
  const { currency, symbol } = useCurrencyInfo()

  const [targetEmpId, setTargetEmpId] = useState(emp?.id != null ? String(emp.id) : 'all')
  const [amountInput, setAmountInput] = useState('')
  const [type, setType]               = useState('Performance')

  const amountXOF = toXOF(+amountInput || 0)

  const BONUS_TYPES: Record<string, string[]> = {
    fr:['Performance','Ancienneté','Fête','Transport','Logement','Autre'],
    en:['Performance','Seniority','Holiday','Transport','Housing','Other'],
    es:['Rendimiento','Antigüedad','Festivo','Transporte','Vivienda','Otro'],
    it:['Prestazione','Anzianità','Festività','Trasporto','Alloggio','Altro'],
  }
  const bTypes = BONUS_TYPES[lang] ?? BONUS_TYPES.fr
  const lbl: React.CSSProperties = { display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label style={lbl}>{lang === 'en' ? 'RECIPIENT' : lang === 'es' ? 'BENEFICIARIO' : lang === 'it' ? 'BENEFICIARIO' : 'BÉNÉFICIAIRE'}</label>
        <select aria-label={lang === 'en' ? 'RECIPIENT' : lang === 'es' ? 'BENEFICIARIO' : lang === 'it' ? 'BENEFICIARIO' : 'BÉNÉFICIAIRE'} className="input" value={targetEmpId} onChange={e => setTargetEmpId(e.target.value)}>
          <option value="all">🌍 {lang === 'en' ? 'All team' : lang === 'es' ? 'Todo el equipo' : lang === 'it' ? 'Tutta la squadra' : "Toute l'équipe"}</option>
          {employees.map((e: any) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>{lang === 'en' ? 'BONUS TYPE' : lang === 'es' ? 'TIPO DE PRIMA' : lang === 'it' ? 'TIPO DI PREMIO' : 'TYPE DE PRIME'}</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {bTypes.map((t: string) => (
            <button key={t} type="button" onClick={() => setType(t)} style={{
              padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)',
              background: type===t ? 'rgba(0,208,132,.15)' : 'var(--bg4)',
              border:`1px solid ${type===t ? 'rgba(0,208,132,.3)' : 'var(--border)'}`,
              color: type===t ? 'var(--acc2)' : 'var(--text3)',
              transition:'all .12s',
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <label style={lbl}>{lang==='fr' ? `MONTANT (${currency})` : `AMOUNT (${currency})`}</label>
        <div style={{ position:'relative' }}>
          <ValidatedInput type="amount"
            value={amountInput}
            onChange={setAmountInput}
            placeholder="0"
            min={0}
            lang={lang}
          />
          <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:12, pointerEvents:'none', fontWeight:600 }}>{symbol}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={() => {
          if (!amountInput || +amountInput <= 0) return
          onConfirm(targetEmpId, amountXOF, type)
        }}>
          ✅ {lang === 'en' ? 'Add bonus' : lang === 'es' ? 'Agregar prima' : lang === 'it' ? 'Aggiungi premio' : 'Ajouter la prime'}
        </button>
        <button className="btn" style={{ padding:'10px 14px' }} onClick={onClose}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
      </div>
    </div>
  )
}

// ─── AddressInputSimple ───────────────────────────────────────────────────────
// Input adresse interne HR — toujours éditable, autocomplete Google optionnel

function AddressInputSimple({
  value,
  onChange,
  lang = 'fr',
}: {
  value: string
  onChange: (v: string) => void
  lang?: string
}) {
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [show, setShow]               = React.useState(false)
  const [focused, setFocused]         = React.useState(false)
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string

  const fetchSuggestions = React.useCallback((input: string) => {
    if (!input || input.length < 3) { setSuggestions([]); return }
    const google = (window as any).google
    if (!google?.maps?.places?.AutocompleteService) return
    const svc = new google.maps.places.AutocompleteService()
    svc.getPlacePredictions(
      { input, types: ['address'], language: lang },
      (preds: any[] | null) => {
        setSuggestions((preds ?? []).slice(0, 5).map((p: any) => p.description))
      }
    )
  }, [lang])

  React.useEffect(() => {
    if (!apiKey) return
    if ((window as any).google?.maps?.places) return
    if (document.querySelector('script[data-gm]')) return
    const script = document.createElement('script')
    script.setAttribute('data-gm', '1')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${lang}`
    script.async = true
    document.head.appendChild(script)
  }, [apiKey])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg4)',
        border: `1.5px solid ${focused ? 'var(--p)' : 'var(--border)'}`,
        borderRadius: 12,
        transition: 'border-color .15s',
      }}>
        <MapPin size={14} style={{ padding:'0 6px 0 12px', flexShrink:0, color: focused ? 'var(--p2)' : 'var(--text3)', pointerEvents:'none', transition:'color .15s', marginLeft:12 }} />
        <input
          type="text"
          autoComplete="off"
          style={{
            flex: 1, background: 'transparent',
            border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 13,
            padding: '10px 12px 10px 4px',
            fontFamily: 'var(--font)',
          }}
          placeholder={lang === 'en' ? 'Full address...' : lang === 'es' ? 'Dirección completa...' : lang === 'it' ? 'Indirizzo completo...' : 'Adresse complète...'}
          value={value}
          onFocus={() => { setFocused(true); setShow(true) }}
          onBlur={() => { setFocused(false); setTimeout(() => setShow(false), 200) }}
          onChange={e => {
            onChange(e.target.value)
            fetchSuggestions(e.target.value)
            setShow(true)
          }}
        />
        {value && (
          <button type="button" tabIndex={-1}
            onClick={() => { onChange(''); setSuggestions([]) }}
            style={{ padding:'0 10px', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text3)', flexShrink:0 }}>
            ✕
          </button>
        )}
      </div>

      {show && suggestions.length > 0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          zIndex:9999, background:'#0D0D1C',
          border:'1px solid rgba(255,255,255,.1)',
          borderRadius:10, overflow:'hidden',
          boxShadow:'0 8px 32px rgba(0,0,0,.8)',
        }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={() => { onChange(s); setSuggestions([]); setShow(false) }}
              style={{
                display:'flex', alignItems:'center', gap:8,
                width:'100%', padding:'9px 14px',
                background:'transparent', border:'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                cursor:'pointer', textAlign:'left',
                fontFamily:'var(--font)', fontSize:12, color:'var(--text)',
                transition:'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <MapPin size={12} style={{ flexShrink:0, color:'var(--text3)' }} />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
