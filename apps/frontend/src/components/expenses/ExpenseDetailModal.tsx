import { useConfig, useFormatAmount } from '@/stores/appStore'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { X, Pencil, FileText, Check, Trash2 } from 'lucide-react'
import { CATEGORIES, MODES, VAT_RATES, catLabel } from './expensesShared'
import type { Category, Expense } from './expensesShared'

interface EditExpForm {
  date: string; label: string; category: Category
  amountHT: number; vat: number; mode: string; recurrent: boolean; notes: string
}

interface Props {
  editExpense: Expense
  editExpForm: EditExpForm
  setEditExpForm: (fn: (f: EditExpForm) => EditExpForm) => void
  expEditMode: boolean
  setExpEditMode: (v: boolean) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
}

export default function ExpenseDetailModal(props: Props) {
  const { editExpForm, setEditExpForm, expEditMode, setExpEditMode, onClose, onSave, onDelete } = props
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const cl = (c: string) => catLabel(c, lang)
  const editExpTTC = Math.round(editExpForm.amountHT * (1 + editExpForm.vat / 100))

  const vf = (label: string, value: string | number, mono = false) => (
    <div>
      <label style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', display:'block', marginBottom:5 }}>{label}</label>
      {expEditMode ? null : (
        <div style={{ padding:'9px 13px', background:'transparent', border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:500, color:'var(--text2)', minHeight:40, display:'flex', alignItems:'center', fontFamily: mono ? 'var(--mono)' : 'var(--font)' }}>
          {value || <span style={{ color:'var(--text4)', fontStyle:'italic', fontSize:12 }}>{lang === 'en' ? 'Not set' : lang === 'es' ? 'No indicado' : lang === 'it' ? 'Non indicato' : 'Non renseigné'}</span>}
        </div>
      )}
    </div>
  )

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontWeight:800, fontSize:16, color:'var(--text)', display:'flex', alignItems:'center', gap:7 }}>
            {expEditMode ? <><Pencil size={15}/> {lang === 'en' ? 'Edit expense' : lang === 'es' ? 'Editar el gasto' : lang === 'it' ? 'Modifica la spesa' : 'Modifier la dépense'}</> : <><FileText size={15}/> {lang === 'en' ? 'Expense detail' : lang === 'es' ? 'Detalle del gasto' : lang === 'it' ? 'Dettaglio spesa' : 'Détail dépense'}</>}
          </span>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="mini-btn" onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <ResponsiveGrid min={160} gap={10}>
            <div>
              {vf(lang === 'en' ? 'Date' : lang === 'es' ? 'Fecha' : lang === 'it' ? 'Data' : 'Date', editExpForm.date)}
              {expEditMode && <input className="input" type="date" value={editExpForm.date} onChange={e => setEditExpForm(f => ({...f, date:e.target.value}))} style={{ width:'100%', boxSizing:'border-box' }} />}
            </div>
            <div>
              {vf(lang === 'en' ? 'Category' : lang === 'es' ? 'Categoría' : lang === 'it' ? 'Categoria' : 'Catégorie', editExpForm.category)}
              {expEditMode && <select className="input" value={editExpForm.category} onChange={e => setEditExpForm(f => ({...f, category:e.target.value as Category}))} style={{ width:'100%', boxSizing:'border-box' }}>{CATEGORIES.map(c => <option key={c} value={c}>{cl(c)}</option>)}</select>}
            </div>
          </ResponsiveGrid>
          <div>
            {vf(lang === 'en' ? 'Label' : lang === 'es' ? 'Etiqueta' : lang === 'it' ? 'Etichetta' : 'Libellé', editExpForm.label)}
            {expEditMode && <input className="input" value={editExpForm.label} onChange={e => setEditExpForm(f => ({...f, label:e.target.value}))} placeholder={lang === 'en' ? 'Description...' : lang === 'es' ? 'Descripción...' : lang === 'it' ? 'Descrizione...' : 'Description...'} style={{ width:'100%', boxSizing:'border-box' }} />}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              {vf(lang === 'en' ? 'Amount excl.' : lang === 'es' ? 'Importe s/IVA' : lang === 'it' ? 'Importo netto' : 'Montant HT', fmt(editExpForm.amountHT), true)}
              {expEditMode && <input className="input" type="number" value={editExpForm.amountHT || ''} onChange={e => setEditExpForm(f => ({...f, amountHT:+e.target.value}))} style={{ width:'100%', boxSizing:'border-box' }} />}
            </div>
            <div>
              {vf('TVA', `${editExpForm.vat} %`)}
              {expEditMode && <select className="input" value={editExpForm.vat} onChange={e => setEditExpForm(f => ({...f, vat:+e.target.value}))} style={{ width:'100%', boxSizing:'border-box' }}>{VAT_RATES.map(v => <option key={v} value={v}>{v} %</option>)}</select>}
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', display:'block', marginBottom:5 }}>TTC</label>
              <div style={{ padding:'9px 13px', border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, color:'var(--acc2)', fontFamily:'var(--mono)', minHeight:40, display:'flex', alignItems:'center' }}>{fmt(editExpTTC)}</div>
            </div>
          </div>
          <ResponsiveGrid min={160} gap={10}>
            <div>
              {vf(lang === 'en' ? 'Payment mode' : lang === 'es' ? 'Modo de pago' : lang === 'it' ? 'Metodo pagamento' : 'Mode paiement', editExpForm.mode)}
              {expEditMode && <select className="input" value={editExpForm.mode} onChange={e => setEditExpForm(f => ({...f, mode:e.target.value}))} style={{ width:'100%', boxSizing:'border-box' }}>{MODES.map(m => <option key={m}>{m}</option>)}</select>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
              {!expEditMode ? (
                <div>
                  <label style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', display:'block', marginBottom:5 }}>{lang === 'en' ? 'Recurring' : lang === 'es' ? 'Recurrente' : lang === 'it' ? 'Ricorrente' : 'Récurrente'}</label>
                  <div style={{ padding:'9px 13px', background:'transparent', border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:500, color: editExpForm.recurrent ? 'var(--acc2)' : 'var(--text3)', minHeight:40, display:'flex', alignItems:'center' }}>
                    {editExpForm.recurrent ? `✅ ${lang === 'en' ? 'Yes' : lang === 'es' ? 'Sí' : lang === 'it' ? 'Sì' : 'Oui'}` : `— ${lang === 'en' ? 'No' : lang === 'es' ? 'No' : lang === 'it' ? 'No' : 'Non'}`}
                  </div>
                </div>
              ) : (
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', paddingBottom:2 }}>
                  <button type="button" onClick={() => setEditExpForm(f => ({...f, recurrent:!f.recurrent}))}
                    style={{ width:44, height:24, borderRadius:99, background: editExpForm.recurrent ? 'var(--p2)' : 'var(--bg4)', border:'none', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:2, left: editExpForm.recurrent ? 22 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 2px 4px rgba(0,0,0,.2)' }} />
                  </button>
                  <span style={{ fontSize:13, color:'var(--text2)' }}>{lang === 'en' ? 'Recurring' : lang === 'es' ? 'Recurrente' : lang === 'it' ? 'Ricorrente' : 'Récurrente'}</span>
                </label>
              )}
            </div>
          </ResponsiveGrid>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:20 }}>
          {!expEditMode ? (
            <>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center', display:'flex', alignItems:'center', gap:6 }} onClick={() => setExpEditMode(true)}>
                <Pencil size={14}/> {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}
              </button>
              <button className="mini-btn" onClick={onClose}>
                {lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}
              </button>
              <button aria-label={lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'} className="mini-btn" style={{ color:'var(--danger)', borderColor:'rgba(255,59,92,.2)' }}
                onClick={onDelete}>
                <Trash2 size={13}/>
              </button>
            </>
          ) : (
            <>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center', display:'flex', alignItems:'center', gap:6 }} onClick={onSave}>
                <Check size={14}/> {lang === 'en' ? 'Save' : lang === 'es' ? 'Guardar' : lang === 'it' ? 'Salva' : 'Sauvegarder'}
              </button>
              <button className="mini-btn" onClick={() => setExpEditMode(false)}>
                {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
