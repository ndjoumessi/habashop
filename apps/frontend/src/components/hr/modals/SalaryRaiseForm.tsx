import React, { useState } from 'react'
import { useConvertFromXOF, useConvertToXOF, useCurrencyInfo } from '@/stores/appStore'
import ValidatedInput from '@/components/ui/ValidatedInput'

export default function SalaryRaiseForm({ emp, lang, fmt, onConfirm, onClose }: any) {
  const fromXOF = useConvertFromXOF()
  const toXOF   = useConvertToXOF()
  const { symbol, decimals } = useCurrencyInfo()

  const oldSalaryXOF = Number(emp.salary) || 0
  const [newSalaryInput, setNewSalaryInput] = useState(
    fromXOF(oldSalaryXOF).toFixed(decimals)
  )
  const [reason, setReason] = useState('')

  const newSalaryXOF = toXOF(+newSalaryInput || 0)
  const diff = newSalaryXOF - oldSalaryXOF
  const pct  = oldSalaryXOF > 0 ? Math.round((diff / oldSalaryXOF) * 100) : 0

  const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Salaire actuel — affiché en devise courante via fmt() */}
      <div style={{ padding:'12px 16px', background:'rgba(108,71,255,.06)', border:'1px solid var(--c-purple-bg)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text2)' }}>{lang === 'en' ? 'Current salary' : lang === 'es' ? 'Salario actual' : lang === 'it' ? 'Stipendio attuale' : 'Salaire actuel'}</span>
        <span style={{ fontFamily:'var(--mono)', fontWeight:'var(--fw-bold)', fontSize:16, color:'var(--text)' }}>{fmt(oldSalaryXOF)}</span>
      </div>
      <div>
        <label style={lbl}>{lang === 'en' ? `NEW SALARY (${symbol})` : lang === 'es' ? `NUEVO SALARIO (${symbol})` : lang === 'it' ? `NUOVO STIPENDIO (${symbol})` : `NOUVEAU SALAIRE (${symbol})`}</label>
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
          onConfirm(newSalaryXOF, reason || '')
        }}>
          ✅ {lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : lang === 'it' ? 'Conferma' : 'Confirmer'}
        </button>
        <button className="btn" style={{ padding:'10px 14px' }} onClick={onClose}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
      </div>
    </div>
  )
}
