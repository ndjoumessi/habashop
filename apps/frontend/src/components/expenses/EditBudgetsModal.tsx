import { useConfig } from '@/stores/appStore'
import IconButton from '@/components/ui/IconButton'
import { X, Settings } from 'lucide-react'
import { CATEGORIES, CATEGORY_STYLE, catLabel } from './expensesShared'
import type { Category } from './expensesShared'

interface Props {
  editBudgets: Record<Category, number>
  setEditBudgets: (fn: (b: Record<Category, number>) => Record<Category, number>) => void
  onClose: () => void
  onSave: () => void
}

export default function EditBudgetsModal({ editBudgets, setEditBudgets, onClose, onSave }: Props) {
  const { lang } = useConfig()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const cl = (c: string) => catLabel(c, lang)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontWeight:'var(--fw-bold)', fontSize:16, color:'var(--text)', display:'flex', alignItems:'center', gap:7 }}><Settings size={16}/> {tr('Modifier les budgets','Edit budgets','Editar presupuestos','Modifica budget')}</span>
          <IconButton label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} icon={<X size={15} />} onClick={onClose} variant="surface" />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {CATEGORIES.map(cat => {
            const s = CATEGORY_STYLE[cat]
            return (
              <div key={cat} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:16 }}>{s.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', width:110, flexShrink:0 }}>{cl(cat)}</span>
                <input className="input" type="number" value={editBudgets[cat]}
                  onChange={e => setEditBudgets(b => ({ ...b, [cat]: +e.target.value }))}
                  style={{ flex:1, boxSizing:'border-box' }} />
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={onClose}>{tr('Annuler','Cancel','Cancelar','Annulla')}</button>
          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={onSave}>{tr('Sauvegarder','Save','Guardar','Salva')}</button>
        </div>
      </div>
    </div>
  )
}
