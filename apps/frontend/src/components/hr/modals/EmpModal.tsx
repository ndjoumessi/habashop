import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useConvertToXOF, useConvertFromXOF, useCurrencyInfo, useAppStore } from '@/stores/appStore'
import ValidatedInput from '@/components/ui/ValidatedInput'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import { type Employee, COLORS, DEPT_COLORS, deptLabel } from '@/components/hr/hrShared'

export default function EmpModal({ emp, onClose, onSave, onDelete }: {
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
  const boxRef = useModalFocus<HTMLDivElement>()

  return (
    <div role="dialog" aria-modal="true"
      aria-label={emp ? T('Modifier un employé', 'Edit an employee', 'Editar un empleado', 'Modifica un dipendente') : T('Nouvel employé', 'New employee', 'Nuevo empleado', 'Nuovo dipendente')}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={boxRef} style={{
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
                fontSize: 14, fontWeight: 'var(--fw-bold)', color: '#fff', flexShrink: 0,
              }}>
                {emp.avatar}
              </div>
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
                {emp ? emp.name : `➕ ${T('Nouvel employé', 'New employee', 'Nuevo empleado', 'Nuovo dipendente')}`}
              </h3>
              {emp && <div style={{ fontSize: 11, color: deptColor, fontWeight: 'var(--fw-regular)', marginTop: 1 }}>{deptLabel(dept || emp.dept, lang)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {emp && onDelete && (
              <button onClick={() => onDelete(emp.id)} style={{ background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.25)', borderRadius: 8, cursor: 'pointer', color: 'var(--danger)', padding: '6px 10px', fontSize: 14 }}>
                🗑
              </button>
            )}
            <IconButton label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} icon={<X size={18} />} onClick={onClose} variant="ghost" />
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ResponsiveGrid min={160} gap={12}>
            <ValidatedInput type="name" required autoFocus label={T('Nom complet *', 'Full name *', 'Nombre completo *', 'Nome completo *')}
              value={name} onChange={setName} placeholder={T('Prénom Nom', 'First Last', 'Nombre Apellido', 'Nome Cognome')} />
            <ValidatedInput type="text" required label={T('Poste *', 'Position *', 'Puesto *', 'Posizione *')}
              value={role} onChange={setRole} placeholder={T('Ex: Caissière', 'Ex: Cashier', 'Ej: Cajera', 'Es: Cassiera')} />
          </ResponsiveGrid>

          <ResponsiveGrid min={160} gap={12}>
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
          </ResponsiveGrid>

          <div>
            <label className="form-label">{T('Salaire brut', 'Gross salary', 'Salario bruto', 'Stipendio lordo')} ({symbol})</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder={code === 'XOF' || code === 'XAF' ? '350000' : '500'} style={{ width: '100%', boxSizing: 'border-box', paddingRight: 50 }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--acc2)', fontSize: 12, fontWeight: 'var(--fw-bold)', pointerEvents: 'none' }}>{symbol}</span>
            </div>
            {salary && code !== 'XOF' && code !== 'XAF' && (
              <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 4 }}>
                <span>≈</span>
                <span style={{ color: 'var(--acc2)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)' }}>{Math.round(toXOF(Number(salary) || 0)).toLocaleString('fr-FR')} XOF</span>
                <span>{T('en base', 'stored', 'en base', 'in base')}</span>
              </div>
            )}
          </div>

          <ResponsiveGrid min={160} gap={12}>
            <div>
              <label className="form-label">{T("Date d'embauche", 'Hire date', 'Fecha de contratación', 'Data di assunzione')}</label>
              <input aria-label={T("Date d'embauche", 'Hire date', 'Fecha de contratación', 'Data di assunzione')} className="input" value={hiredAt} onChange={e => setHiredAt(e.target.value)} placeholder={T('JJ/MM/AAAA', 'DD/MM/YYYY', 'DD/MM/AAAA', 'GG/MM/AAAA')} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            {type === 'CDD' && (
              <div>
                <label className="form-label">{T('Fin de contrat', 'Contract end', 'Fin de contrato', 'Fine contratto')}</label>
                <input aria-label={T('Fin de contrat', 'Contract end', 'Fin de contrato', 'Fine contratto')} className="input" value={endAt} onChange={e => setEndAt(e.target.value)} placeholder={T('JJ/MM/AAAA', 'DD/MM/YYYY', 'DD/MM/AAAA', 'GG/MM/AAAA')} style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}
          </ResponsiveGrid>

          <PhoneInputWithCountry
            label={T('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')}
            value={phone}
            onChange={setPhone}
          />

          <ValidatedInput type="email" label="Email"
            value={email} onChange={setEmail}
            placeholder={T('prenom@boutique.com', 'name@store.com', 'nombre@tienda.com', 'nome@negozio.com')} />

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
                <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{T('Statut employé', 'Employee status', 'Estado del empleado', 'Stato dipendente')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{active ? T('Employé actif', 'Active employee', 'Empleado activo', 'Dipendente attivo') : T('Employé inactif', 'Inactive employee', 'Empleado inactivo', 'Dipendente inattivo')}</div>
              </div>
              <button onClick={() => setActive(a => !a)} style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 'var(--fw-semibold)', fontSize: 12, cursor: 'pointer', border: '1px solid',
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
