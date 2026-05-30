import { SHIFT_TYPES, shiftLabel } from './planningShared'
import type { ShiftType } from './planningShared'

interface Props {
  lang: string
  activeShift: ShiftType
  setActiveShift: (s: ShiftType) => void
}

export default function ShiftSelector({ lang, activeShift, setActiveShift }: Props) {
  return (
    <div style={{
      display:'flex', gap:6, flexWrap:'wrap',
      padding:'12px 16px',
      background:'var(--grad-card)',
      border:'1px solid var(--border)',
      borderRadius:16,
    }}>
      <div style={{
        fontSize:10, fontWeight:800,
        textTransform:'uppercase', letterSpacing:'.6px',
        color:'var(--text3)', alignSelf:'center',
        marginRight:6, flexShrink:0,
      }}>
        {lang === 'en' ? 'ASSIGN:' : lang === 'es' ? 'ASIGNAR:' : lang === 'it' ? 'ASSEGNA:' : 'ASSIGNER :'}
      </div>
      {(Object.entries(SHIFT_TYPES) as [ShiftType, typeof SHIFT_TYPES[ShiftType]][])
        .map(([key,s]) => (
        <button key={key} type="button"
          onClick={()=>setActiveShift(key)}
          style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'8px 14px', borderRadius:10,
            border:`1.5px solid ${activeShift===key
              ? s.color : 'var(--border)'}`,
            background: activeShift===key
              ? s.bg : 'transparent',
            cursor:'pointer', fontFamily:'var(--font)',
            fontSize:11, fontWeight:700,
            color: activeShift===key ? s.color : 'var(--text3)',
            transition:'all .12s',
            boxShadow: activeShift===key
              ? `0 3px 10px ${s.color}30` : 'none',
            transform: activeShift===key ? 'scale(1.02)' : 'scale(1)',
          }}>
          <span style={{ color: activeShift===key ? s.color : 'var(--text3)', display:'flex' }}>{s.icon}</span>
          <span>{shiftLabel(key, lang)}</span>
          {s.hours && (
            <span style={{
              fontSize:9, fontFamily:'var(--mono)', opacity:.7,
            }}>{s.hours}</span>
          )}
          {activeShift===key && (
            <span style={{
              fontSize:9, background:'var(--p)',
              color:'#fff', borderRadius:99,
              padding:'1px 5px', fontWeight:800,
            }}>✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
