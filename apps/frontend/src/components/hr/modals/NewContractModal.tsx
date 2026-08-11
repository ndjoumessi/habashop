import { FileText, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useModalFocus } from '@/hooks/useModalFocus'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import toast from 'react-hot-toast'
import { type Employee, type ContractForm, type EmpForm, COLORS, CONTRACT_TYPES, DEPT_COLORS, labelStyle, deptLabel, roleLabel, contractLabel, isOpenEnded, toEmployeeWrite, employeeFromApi, initialesDe, toInputDate, contractEndToWire } from '@/components/hr/hrShared'
import { employeesApi } from '@/lib/api'
import { saved } from '@/lib/saved'
// ⚠️ Taux et calcul importés de la SOURCE UNIQUE (`payrollShared`). Ces fichiers codaient
// `0.08`/`0.05`/`0.87` en dur — le `0.87` étant le pire : un net magique qui devient
// silencieusement faux dès qu'un taux change.
// ⚠️ `payrollDisplay` : conversion UNE fois + arrondi cohérent (lignes/total/net). Les
// montants rendus sont DÉJÀ en devise d'affichage → `fmtDisplay`, jamais le `fmt` reçu en
// prop (qui reconvertirait). Verrou : `payrollConvertOnce.test.ts`.
import { payrollDisplay, fmtDisplay } from '@/components/payroll/payrollShared'
import { useConfig } from '@/stores/appStore'
import { DateField } from '@/components/ui/DatePicker'

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

  /* ── Combobox employé ───────────────────────────────────────────────────────
     `empExistantId` non nul ⇒ on MET À JOUR ce membre. Nul ⇒ on en crée un. Ces
     deux chemins doivent rester DISTINGUABLES à l'écran, sinon dupliquer une
     personne redevient un geste invisible. */
  const [comboOuvert, setComboOuvert] = useState(false)
  const [survol, setSurvol] = useState(0)
  const [empExistantId, setEmpExistantId] = useState<Employee['id'] | null>(null)
  // Requête en vol — anti double-soumission (seule raison admise de désactiver ce CTA).
  // Depuis que les deux chemins écrivent au serveur, deux clics créeraient deux fiches.
  const [saving, setSaving] = useState(false)
  const comboRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!comboOuvert) return
    const dehors = (e: MouseEvent) => { if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboOuvert(false) }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [comboOuvert])

  // ⚠️ Recherche INSENSIBLE aux accents : « Amina » doit trouver « Aminata Traoré ».
  // Sans `normalize`, un gérant qui tape sans accent ne trouve personne et crée un double.
  const sansAccent = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const saisie = sansAccent(contractForm.empId.trim())
  const suggestions = (employees ?? [])
    .filter(e => e.active !== false)
    .filter(e => saisie.length === 0 || sansAccent(e.name).includes(saisie))
    .slice(0, 6)

  const choisirEmploye = (e: Employee | undefined) => {
    if (!e) return
    setEmpExistantId(e.id)
    setComboOuvert(false)
    // Le contrat part de la situation ACTUELLE du membre : on ne repropose pas des
    // valeurs par défaut qui écraseraient son poste ou son salaire par inadvertance.
    setContractForm(f => ({
      ...f,
      empId: e.name,
      role: e.role ?? f.role,
      dept: e.dept ?? f.dept,
      type: (e.type as ContractForm['type']) ?? f.type,
      salary: Number(e.salary) || f.salary,
    }))
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'New contract' : lang === 'es' ? 'Nuevo contrato' : lang === 'it' ? 'Nuovo contratto' : 'Nouveau contrat'} onClick={e => e.target===e.currentTarget&&setShowNewContractModal(false)}>
      <div ref={boxRef} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:28, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--sh-xl)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:'var(--fw-semibold)', color:'var(--text)', display:'flex', alignItems:'center', gap:8 }}><FileText size={16} />{lang === 'en' ? 'New contract' : lang === 'es' ? 'Nuevo contrato' : lang === 'it' ? 'Nuovo contratto' : 'Nouveau contrat'}</h3>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={()=>setShowNewContractModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* ⚠️ COMBOBOX, pas un champ libre — et ce n'est PAS un confort de saisie.
              « Créer le contrat » faisait `setEmployees(prev => [...prev, newEmp])` sans
              jamais chercher : taper « Aminata » pour quelqu'un qui existe déjà fabriquait
              une SECONDE Aminata, avec un autre id, sa propre paie et sa propre ligne de
              planning. Le champ suggère donc l'équipe, et choisir un membre MET À JOUR son
              contrat au lieu de le dupliquer. */}
          <div style={{ position:'relative' }} ref={comboRef}>
            <label style={labelStyle} id="nc-emp-label">{lang === 'en' ? 'EMPLOYEE NAME' : lang === 'es' ? 'NOMBRE DEL EMPLEADO' : lang === 'it' ? 'NOME DEL DIPENDENTE' : 'NOM DE L\'EMPLOYÉ'}</label>
            <input
              className="input"
              role="combobox"
              aria-expanded={comboOuvert}
              aria-controls="nc-emp-list"
              aria-autocomplete="list"
              aria-labelledby="nc-emp-label"
              aria-label={lang === 'en' ? 'EMPLOYEE NAME' : lang === 'es' ? 'NOMBRE DEL EMPLEADO' : lang === 'it' ? 'NOME DEL DIPENDENTE' : 'NOM DE L\'EMPLOYÉ'}
              placeholder={lang === 'en' ? 'Search or type a new name' : lang === 'es' ? 'Buscar o escribir un nombre' : lang === 'it' ? 'Cerca o scrivi un nome' : 'Rechercher ou saisir un nouveau nom'}
              value={contractForm.empId}
              onChange={e => { setContractForm(f => ({ ...f, empId: e.target.value })); setEmpExistantId(null); setComboOuvert(true); setSurvol(0) }}
              onFocus={() => setComboOuvert(true)}
              onKeyDown={e => {
                if (!comboOuvert || suggestions.length === 0) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setSurvol(i => (i + 1) % suggestions.length) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSurvol(i => (i - 1 + suggestions.length) % suggestions.length) }
                else if (e.key === 'Enter') { e.preventDefault(); choisirEmploye(suggestions[survol]) }
                else if (e.key === 'Escape') { setComboOuvert(false) }
              }}
            />
            {comboOuvert && suggestions.length > 0 && (
              <ul id="nc-emp-list" role="listbox" className="nc-combo-list">
                {suggestions.map((e, idx) => (
                  <li key={e.id} role="option" aria-selected={idx === survol}
                    className={`nc-combo-opt${idx === survol ? ' nc-combo-on' : ''}`}
                    onMouseEnter={() => setSurvol(idx)}
                    onMouseDown={ev => { ev.preventDefault(); choisirEmploye(e) }}>
                    <span className="nc-combo-av" style={{ background:`${e.color}22`, color:e.color }}>{e.avatar}</span>
                    <span className="nc-combo-txt">
                      <strong>{e.name}</strong>
                      <em>{roleLabel(e.role, lang)} · {deptLabel(e.dept, lang)}</em>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* ⚠️ On DIT lequel des deux chemins va s'exécuter. Sans cette ligne, « mettre à
                jour » et « créer un homonyme » ont exactement la même apparence. */}
            {empExistantId !== null && (
              <div className="nc-combo-note nc-combo-note-maj">
                {lang === 'en' ? 'Existing member — their contract will be updated.' : lang === 'es' ? 'Miembro existente — se actualizará su contrato.' : lang === 'it' ? 'Membro esistente — il suo contratto sarà aggiornato.' : 'Membre existant — son contrat sera mis à jour.'}
              </div>
            )}
            {empExistantId === null && contractForm.empId.trim().length > 0 && (
              <div className="nc-combo-note">
                {lang === 'en' ? 'New person — a member will be created.' : lang === 'es' ? 'Nueva persona — se creará un miembro.' : lang === 'it' ? 'Nuova persona — sarà creato un membro.' : 'Nouvelle personne — un membre sera créé.'}
              </div>
            )}
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
                {CONTRACT_TYPES.map(t=><option key={t} value={t}>{contractLabel(t, lang)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'en' ? 'START DATE' : lang === 'es' ? 'FECHA INICIO' : lang === 'it' ? 'DATA INIZIO' : 'DATE DÉBUT'}</label>
              <DateField
                ariaLabel={lang === 'en' ? 'START DATE' : lang === 'es' ? 'FECHA INICIO' : lang === 'it' ? 'DATA INIZIO' : 'DATE DÉBUT'}
                style={{ width:'100%', boxSizing:'border-box' }}
                value={contractForm.hiredAt} onChange={v=>setContractForm(f=>({...f,hiredAt:v}))}/>
            </div>
            {!isOpenEnded(contractForm.type)&&(
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelStyle}>{lang === 'en' ? 'CONTRACT END DATE' : lang === 'es' ? 'FECHA FIN CONTRATO' : lang === 'it' ? 'DATA FINE CONTRATTO' : 'DATE FIN CONTRAT'}</label>
                <DateField
                  ariaLabel={lang === 'en' ? 'CONTRACT END DATE' : lang === 'es' ? 'FECHA FIN CONTRATO' : lang === 'it' ? 'DATA FINE CONTRATTO' : 'DATE FIN CONTRAT'}
                  style={{ width:'100%', boxSizing:'border-box' }}
                  min={contractForm.hiredAt || undefined}
                  value={contractForm.contractEnd} onChange={v=>setContractForm(f=>({...f,contractEnd:v}))}/>
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
          <button className="btn btn-primary" style={{ flex:1 }} disabled={saving} onClick={async ()=>{
            if (!contractForm.empId.trim()||!contractForm.role.trim()) {
              toast.error(lang === 'en' ? 'Name and position required' : lang === 'es' ? 'Nombre y puesto requeridos' : lang === 'it' ? 'Nome e posizione richiesti' : 'Nom et poste requis'); return
            }
            if (saving) return
            const nom = contractForm.empId.trim()
            // Saisi en devise d'AFFICHAGE → stocké en XOF (base). Arrondi comme dans
            // `EditEmployeeModal` : la base est en XOF, sans décimale.
            const salaryXof = Math.round(toXOF(contractForm.salary || 0))
            // ⚠️ ISO `yyyy-mm-dd` rendu par `DateField`, envoyé TEL QUEL. Ce bloc écrivait
            // `toLocaleDateString('fr-FR')` — côté serveur, `new Date('05/01/2024')` est lu
            // M/J/A et aurait rangé le 5 janvier au 1er mai.
            const hiredAtIso = toInputDate(contractForm.hiredAt) || undefined
            const quoi = lang === 'en' ? 'the contract' : lang === 'es' ? 'el contrato' : lang === 'it' ? 'il contratto' : 'le contrat'
            setSaving(true)
            try {
              /* ⚠️ DEUX CHEMINS, et c'est tout l'enjeu. Un contrat établi pour quelqu'un de
                 l'équipe ne doit PAS créer un HOMONYME — id différent, donc bulletin de paie
                 séparé, ligne de planning séparée, et deux fois la même personne dans
                 l'effectif. ⚠️ Mais AUCUN des deux n'atteignait le serveur : les deux
                 écrivaient en état LOCAL, sous un toast de succès, et le contrat disparaissait
                 au rechargement. Le chemin création fabriquait en plus un `id: Date.now()` qui
                 n'était l'id d'aucune ligne. */
              if (empExistantId !== null) {
                const ok = await saved(
                  // `String(...)` comme dans `EditEmployeeModal` : `Employee.id` est déclaré
                  // `number` mais porte un cuid — l'écart est traversé, pas nié.
                  employeesApi.update(String(empExistantId), {
                    role: contractForm.role, dept: contractForm.dept,
                    salary: salaryXof, type: contractForm.type,
                    ...(hiredAtIso !== undefined && { hiredAt: hiredAtIso }),
                    // ⚠️ RÉTABLI le 2026-08-11 : le serveur accepte désormais `endAt`. Corps
                    // PARTIEL délibérément — y passer tout le formulaire écraserait téléphone,
                    // e-mail et photo avec du vide. La conversion passe par la règle unique.
                    endAt: contractEndToWire(contractForm.contractEnd),
                  }),
                  quoi,
                )
                if (!ok) return
                setEmployees(prev => prev.map(e => e.id === empExistantId ? {
                  ...e,
                  role: contractForm.role, dept: contractForm.dept, salary: salaryXof,
                  type: contractForm.type, hiredAt: hiredAtIso ?? e.hiredAt,
                  // ⚠️ RÉTABLI : il avait été retiré parce que le serveur ne l'acceptait pas —
                  // l'afficher aurait affirmé un enregistrement inexistant. Ce n'est plus le
                  // cas, et l'envoi juste au-dessus est ce qui rend cet affichage honnête.
                  endAt: contractForm.contractEnd || undefined,
                } : e))
                toast.success(lang === 'en' ? 'Contract updated!' : lang === 'es' ? '¡Contrato actualizado!' : lang === 'it' ? 'Contratto aggiornato!' : 'Contrat mis à jour !')
                setShowNewContractModal(false)
                return
              }
              const form: EmpForm = {
                name: nom,
                role: contractForm.role,
                dept: contractForm.dept,
                type: contractForm.type,
                hiredAt: hiredAtIso ?? '',   // vide ⇒ le serveur pose `new Date()`
                // ⚠️ RÉTABLI : `toEmployeeWrite` le convertit en `endAt`. Un CDD créé depuis
                // cette modale sans échéance, c'est le défaut qu'on vient de fermer.
                contractEnd: contractForm.contractEnd || undefined,
                color: COLORS[employees.length % COLORS.length],
                isActive: true,
                phone: '', email: '',
                // ⚠️ `perf:3` notait 3 un employé créé depuis un contrat. `null` = non évalué.
                perf: null,
                address: '', photoUrl: '',
              }
              const requete = employeesApi.create(toEmployeeWrite(form, { salary: salaryXof, avatar: initialesDe(nom) }))
              const ok = await saved(requete, quoi)
              if (!ok) return
              // Déjà résolue, rejet déjà traité par `saved` : la ré-attendre ne relance aucune
              // requête et ne peut plus lever.
              const cree = await requete
              setEmployees(prev => [...prev, employeeFromApi(cree, prev.length)])
              toast.success(lang === 'en' ? 'Contract created!' : lang === 'es' ? '¡Contrato creado!' : lang === 'it' ? 'Contratto creato!' : 'Contrat créé !')
              setShowNewContractModal(false)
            } finally {
              setSaving(false)
            }
          }}>{saving
            ? (lang === 'en' ? 'Saving…' : lang === 'es' ? 'Guardando…' : lang === 'it' ? 'Salvataggio…' : 'Enregistrement…')
            : (lang === 'en' ? 'Create contract' : lang === 'es' ? 'Crear el contrato' : lang === 'it' ? 'Crea il contratto' : 'Créer le contrat')}</button>
        </div>
      </div>
    </div>
  )
}
