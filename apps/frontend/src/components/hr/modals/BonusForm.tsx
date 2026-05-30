import React, { useState } from 'react'
import { useConvertToXOF, useCurrencyInfo } from '@/stores/appStore'
import ValidatedInput from '@/components/ui/ValidatedInput'

export default function BonusForm({ emp, employees, lang, fmt, onConfirm, onClose }: any) {
  const toXOF  = useConvertToXOF()
  const { symbol } = useCurrencyInfo()

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
        <label style={lbl}>{lang === 'en' ? `AMOUNT (${symbol})` : lang === 'es' ? `IMPORTE (${symbol})` : lang === 'it' ? `IMPORTO (${symbol})` : `MONTANT (${symbol})`}</label>
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
