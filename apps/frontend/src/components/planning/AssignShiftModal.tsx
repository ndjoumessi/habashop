import { X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import { SHIFT_TYPES, shiftLabel, localeFor } from './planningShared'
import type { ShiftType } from './planningShared'

interface Props {
  lang: string
  shiftModal: { empId: string; di: number; name: string }
  modalShift: ShiftType
  setModalShift: (s: ShiftType) => void
  weekDays: Date[]
  onConfirm: () => void
  onClose: () => void
}

export default function AssignShiftModal({ lang, shiftModal, modalShift, setModalShift, weekDays, onConfirm, onClose }: Props) {
  const locale = localeFor(lang)
  const boxRef = useModalFocus<HTMLDivElement>()

  return (
    <div role="dialog" aria-modal="true"
      aria-label={lang === 'en' ? 'Assign shift' : lang === 'es' ? 'Asignar un turno' : lang === 'it' ? 'Assegna un turno' : 'Assigner un shift'}
      style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:20,
    }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div ref={boxRef} style={{
        width:'100%', maxWidth:400,
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:20, overflow:'hidden',
        boxShadow:'var(--sh-xl)',
      }}>
        {/* Header */}
        <div style={{
          padding:'18px 20px 14px',
          background:'var(--bg3)',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize:15, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>
              {lang === 'en' ? 'Assign shift' : lang === 'es' ? 'Asignar un turno' : lang === 'it' ? 'Assegna un turno' : 'Assigner un shift'}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
              {shiftModal.name} · {weekDays[shiftModal.di]?.toLocaleDateString(locale,{weekday:'short',day:'numeric',month:'short'})}
            </div>
          </div>
          <IconButton label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} icon={<X size={14}/>} onClick={onClose} variant="surface" />
        </div>

        {/* Shift type buttons */}
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:2 }}>
            {lang === 'en' ? 'SHIFT TYPE' : lang === 'es' ? 'TIPO DE TURNO' : lang === 'it' ? 'TIPO DI TURNO' : 'TYPE DE SHIFT'}
          </div>
          <ResponsiveGrid min={160} gap={8}>
            {(Object.entries(SHIFT_TYPES) as [ShiftType, typeof SHIFT_TYPES[ShiftType]][]).map(([key,s]) => (
              <button key={key} type="button"
                onClick={() => setModalShift(key)}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 12px', borderRadius:10,
                  border:`1.5px solid ${modalShift===key ? s.color : 'var(--border)'}`,
                  background: modalShift===key ? s.bg : 'var(--bg3)',
                  cursor:'pointer', fontFamily:'var(--font)',
                  fontSize:12, fontWeight:'var(--fw-semibold)',
                  color: modalShift===key ? s.color : 'var(--text3)',
                  transition:'all .1s',
                }}>
                <span style={{ color: modalShift===key ? s.color : 'var(--text3)', display:'flex' }}>{s.icon}</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:12, fontWeight:'var(--fw-semibold)' }}>{shiftLabel(key, lang)}</div>
                  {s.hours && <div style={{ fontSize:11, fontFamily:'var(--mono)', opacity:.7 }}>{s.hours}</div>}
                </div>
                {modalShift===key && (
                  <span style={{ marginLeft:'auto', fontSize:11, background:`${s.color}30`, color:s.color, borderRadius:99, padding:'2px 6px', fontWeight:'var(--fw-bold)' }}>✓</span>
                )}
              </button>
            ))}
          </ResponsiveGrid>

          {/* Actions */}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button
              onClick={onConfirm}
              style={{
                flex:1, padding:'11px', borderRadius:10,
                background:`linear-gradient(135deg,${SHIFT_TYPES[modalShift].color},${SHIFT_TYPES[modalShift].color}CC)`,
                border:'none', cursor:'pointer',
                fontSize:13, fontWeight:'var(--fw-semibold)', color:'#fff',
                fontFamily:'var(--font)',
                boxShadow:`0 4px 14px ${SHIFT_TYPES[modalShift].color}40`,
                transition:'all .15s',
              }}>
              {lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : lang === 'it' ? 'Conferma' : 'Confirmer'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding:'11px 16px', borderRadius:10,
                background:'var(--bg3)',
                border:'1px solid var(--border)',
                cursor:'pointer', color:'var(--text3)',
                fontSize:13, fontFamily:'var(--font)',
              }}>
              {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
