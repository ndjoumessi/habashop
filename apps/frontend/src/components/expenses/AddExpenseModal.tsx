import { useConfig, useFormatAmount } from '@/stores/appStore'
import { X, Check } from 'lucide-react'
import ValidatedInput from '@/components/ui/ValidatedInput'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { CATEGORIES, MODES, VAT_RATES, catLabel } from './expensesShared'
import type { Category } from './expensesShared'

interface Props {
  nDate: string; setNDate: (v: string) => void
  nLabel: string; setNLabel: (v: string) => void
  nCat: Category; setNCat: (v: Category) => void
  nHT: string; setNHT: (v: string) => void
  nVat: number; setNVat: (v: number) => void
  nMode: string; setNMode: (v: string) => void
  nRecurrent: boolean; setNRecurrent: (v: boolean) => void
  nNotes: string; setNNotes: (v: string) => void
  nTTC: number
  onClose: () => void
  onSubmit: () => void
}

export default function AddExpenseModal(props: Props) {
  const {
    nDate, setNDate, nLabel, setNLabel, nCat, setNCat, nHT, setNHT,
    nVat, setNVat, nMode, setNMode, nRecurrent, setNRecurrent, nNotes, setNNotes,
    nTTC, onClose, onSubmit,
  } = props
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const cl = (c: string) => catLabel(c, lang)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:480 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{tr('Ajouter une dépense','Add an expense','Agregar un gasto','Aggiungi una spesa')}</span>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="mini-btn" onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <ResponsiveGrid min={160} gap={10}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Date','Date','Fecha','Data')}</label>
              <input aria-label={tr('Date','Date','Fecha','Data')} className="input" type="date" value={nDate} onChange={e => setNDate(e.target.value)}
                style={{ width:'100%', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Catégorie','Category','Categoría','Categoria')}</label>
              <select aria-label={tr('Catégorie','Category','Categoría','Categoria')} className="input" value={nCat} onChange={e => setNCat(e.target.value as Category)}
                style={{ width:'100%', boxSizing:'border-box' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{cl(c)}</option>)}
              </select>
            </div>
          </ResponsiveGrid>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Libellé','Label','Etiqueta','Etichetta')}</label>
            <input aria-label={tr('Libellé','Label','Etiqueta','Etichetta')} className="input" type="text" placeholder={tr('Ex: Facture EDF','Ex: Electricity bill','Ej: Factura de luz','Es: Bolletta luce')}
              value={nLabel} onChange={e => setNLabel(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box' }} />
          </div>
          <ResponsiveGrid min={160} gap={10}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Montant HT (F CFA)','Amount excl. VAT (F CFA)','Importe s/IVA (F CFA)','Importo netto (F CFA)')}</label>
              <ValidatedInput type="amount"
                value={nHT} onChange={setNHT}
                placeholder="Ex: 85000"
                min={0} required lang={lang} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Taux TVA','VAT rate','Tasa IVA','Aliquota IVA')}</label>
              <select aria-label={tr('Taux TVA','VAT rate','Tasa IVA','Aliquota IVA')} className="input" value={nVat} onChange={e => setNVat(+e.target.value)}
                style={{ width:'100%', boxSizing:'border-box' }}>
                {VAT_RATES.map(v => <option key={v} value={v}>{v} %</option>)}
              </select>
            </div>
          </ResponsiveGrid>
          {nHT && (
            <div style={{
              padding:'10px 13px', background:'rgba(14,196,126,.1)',
              border:'1px solid rgba(14,196,126,.25)', borderRadius:8,
              display:'flex', justifyContent:'space-between', fontSize:13,
            }}>
              <span style={{ color:'var(--text3)' }}>{tr('Montant TTC calculé :','Calculated total incl. VAT:','Importe c/IVA calculado:','Importo lordo calcolato:')}</span>
              <span style={{ fontWeight:800, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                {fmt(nTTC)}
              </span>
            </div>
          )}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Mode de paiement','Payment method','Método de pago','Metodo di pagamento')}</label>
            <select aria-label={tr('Mode de paiement','Payment method','Método de pago','Metodo di pagamento')} className="input" value={nMode} onChange={e => setNMode(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box' }}>
              {MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox" id="recurrent" checked={nRecurrent}
              onChange={e => setNRecurrent(e.target.checked)}
              style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--p2)' }} />
            <label htmlFor="recurrent" style={{ fontSize:13, color:'var(--text2)', cursor:'pointer', fontWeight:600 }}>
              {tr('Dépense récurrente (mensuelle)','Recurring expense (monthly)','Gasto recurrente (mensual)','Spesa ricorrente (mensile)')}
            </label>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>{tr('Notes (optionnel)','Notes (optional)','Notas (opcional)','Note (opzionale)')}</label>
            <input aria-label={tr('Notes (optionnel)','Notes (optional)','Notas (opcional)','Note (opzionale)')} className="input" type="text" placeholder={tr('Informations supplémentaires…','Additional information…','Información adicional…','Informazioni aggiuntive…')}
              value={nNotes} onChange={e => setNNotes(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={onClose}>{tr('Annuler','Cancel','Cancelar','Annulla')}</button>
          <button className="btn btn-primary btn-sm" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} onClick={onSubmit}><Check size={14}/> {tr('Enregistrer','Save','Guardar','Salva')}</button>
        </div>
      </div>
    </div>
  )
}
