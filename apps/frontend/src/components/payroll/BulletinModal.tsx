import { useConfig } from '@/stores/appStore'
import { useModalFocus } from '@/hooks/useModalFocus'
import { X, CheckCircle, Printer, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { monthLabel, roleLabel, statusLabel, printBulletin, payrollBreakdown } from './payrollShared'
import type { PayRecord } from './payrollShared'

export default function BulletinModal({ record, onClose, onPay, fmt }: {
  record: PayRecord
  onClose: () => void
  onPay: (id: number) => void
  fmt: (n: number) => string
}) {
  const { lang } = useConfig()
  // Source unique du calcul (cohérent avec le bulletin PDF et la table paie).
  const bd = payrollBreakdown(record)
  const totalRetenues = bd.totalDeductions
  const boxRef = useModalFocus<HTMLDivElement>()

  return (
    <div role="dialog" aria-modal="true"
      aria-label={`${lang === 'en' ? 'Payslip' : lang === 'es' ? 'Nómina' : lang === 'it' ? 'Busta paga' : 'Bulletin de paie'} — ${record.employee}`}
      style={{
      position:'fixed', inset:0, zIndex:50,
      background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:20, overflowY:'auto',
    }} onClick={onClose}>
      <div ref={boxRef} style={{
        width:'100%', maxWidth:620,
        background:'var(--bg2)', border:'1px solid var(--border)',
        borderRadius:20, overflow:'hidden',
        boxShadow:'0 40px 100px rgba(0,0,0,.6)',
      }} onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div style={{
          background:'linear-gradient(135deg, var(--p), var(--p2))',
          padding:'24px 28px', display:'flex',
          alignItems:'center', justifyContent:'space-between',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{
              width:44, height:44, borderRadius:12,
              background:'rgba(255,255,255,.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22, fontWeight:'var(--fw-bold)', color:'#fff',
            }}>H</div>
            <div>
              <div style={{ fontSize:16, fontWeight:'var(--fw-bold)', color:'#fff' }}>
                HabaShop
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', marginTop:2 }}>
                {lang === 'en' ? 'Payslip' : lang === 'es' ? 'Nómina' : lang === 'it' ? 'Busta paga' : 'Bulletin de Paie'} — {monthLabel(record.month, lang)}
              </div>
            </div>
          </div>
          <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={onClose} style={{
            background:'rgba(255,255,255,.15)',
            border:'1px solid rgba(255,255,255,.25)',
            borderRadius:9, padding:'6px 10px',
            cursor:'pointer', color:'#fff',
            display:'flex', alignItems:'center',
          }}><X size={14}/></button>
        </div>

        {/* ── INFOS EMPLOYÉ ── */}
        <div style={{ padding:'20px 28px', borderBottom:'1px solid var(--border)' }}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:14, padding:'16px 18px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{
                width:48, height:48, borderRadius:'50%',
                background:record.color,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, fontWeight:'var(--fw-bold)', color:'#fff',
                boxShadow:`0 4px 14px ${record.color}44`,
              }}>{record.avatar}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>
                  {record.employee}
                </div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                  {roleLabel(record.role, lang)} · {lang === 'en' ? 'Permanent contract' : lang === 'es' ? 'Contrato indefinido' : lang === 'it' ? 'Contratto indeterminato' : 'Contrat CDI'}
                </div>
              </div>
            </div>
            <span style={{
              display:'inline-flex', alignItems:'center',
              background: record.status === 'PAYÉ' ? 'var(--c-green-bg)' : 'var(--c-orange-bg)',
              color: record.status === 'PAYÉ' ? 'var(--acc2)' : 'var(--warn)',
              border: `1px solid ${record.status === 'PAYÉ' ? 'var(--c-green-border)' : 'var(--c-orange-border)'}`,
              borderRadius:'var(--r-full)', padding:'3px 9px',
              fontSize:12, fontWeight:'var(--fw-semibold)',
            }}>{statusLabel(record.status, lang)}</span>
          </div>
        </div>

        {/* ── CORPS ── */}
        <div style={{ padding:'0 28px 24px' }}>

          {/* GAINS */}
          <div style={{ marginTop:20 }}>
            <div style={{
              fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase',
              letterSpacing:'1px', color:'var(--text3)',
              marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)',
            }}>{lang === 'en' ? 'EARNINGS' : lang === 'es' ? 'GANANCIAS' : lang === 'it' ? 'GUADAGNI' : 'GAINS'}</div>
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 80px 80px 100px',
              gap:8, marginBottom:6, fontSize:11, fontWeight:'var(--fw-semibold)',
              color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px',
            }}>
              <span>{lang === 'en' ? 'Label' : lang === 'es' ? 'Concepto' : lang === 'it' ? 'Voce' : 'Libellé'}</span>
              <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Base' : lang === 'es' ? 'Base' : lang === 'it' ? 'Base' : 'Base'}</span>
              <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Rate' : lang === 'es' ? 'Tasa' : lang === 'it' ? 'Tasso' : 'Taux'}</span>
              <span style={{ textAlign:'right' }}>{lang === 'en' ? 'Amount' : lang === 'es' ? 'Importe' : lang === 'it' ? 'Importo' : 'Montant'}</span>
            </div>
            {([
              { label:lang === 'en' ? 'Base salary' : lang === 'es' ? 'Salario base' : lang === 'it' ? 'Stipendio base' : 'Salaire de base',        base:'26j', taux:'100 %', montant:record.baseSalary, show:true },
              { label:lang === 'en' ? 'Performance bonus' : lang === 'es' ? 'Prima de rendimiento' : lang === 'it' ? 'Premio di rendimento' : 'Prime de performance',   base:'',    taux:'',      montant:record.bonus,       show:record.bonus > 0 },
              { label:lang === 'en' ? 'Overtime' : lang === 'es' ? 'Horas extra' : lang === 'it' ? 'Straordinari' : 'Heures supplémentaires', base:`${Math.round(record.overtime / record.baseSalary * 26 * 8)}h`, taux:'25 %', montant:record.overtime, show:record.overtime > 0 },
            ] as { label:string; base:string; taux:string; montant:number; show:boolean }[])
              .filter(r => r.show && r.montant > 0)
              .map((row, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 80px 100px',
                  gap:8, padding:'9px 0',
                  borderBottom:'1px solid var(--border)', alignItems:'center',
                }}>
                  {/* Libellés de lignes en text2 — hiérarchie : seuls les montants restent en text */}
                  <span style={{ fontSize:13, color:'var(--text2)' }}>{row.label}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{row.base}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{row.taux}</span>
                  <span style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)', textAlign:'right', fontFamily:'var(--mono)' }}>
                    {fmt(row.montant)}
                  </span>
                </div>
              ))
            }
            <div style={{
              display:'flex', justifyContent:'space-between',
              padding:'11px 12px', marginTop:8,
              background:'var(--c-green-bg2)', border:'1px solid var(--c-green-border)',
              borderRadius:10,
            }}>
              <span style={{ fontSize:13, fontWeight:'var(--fw-bold)', color:'var(--acc2)', letterSpacing:'.3px' }}>{lang === 'en' ? 'GROSS TOTAL' : lang === 'es' ? 'TOTAL BRUTO' : lang === 'it' ? 'TOTALE LORDO' : 'TOTAL BRUT'}</span>
              <span style={{ fontSize:14, fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                {fmt(bd.brut)}
              </span>
            </div>
          </div>

          {/* RETENUES */}
          <div style={{ marginTop:20 }}>
            <div style={{
              fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase',
              letterSpacing:'1px', color:'var(--text3)',
              marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)',
            }}>{lang === 'en' ? 'DEDUCTIONS' : lang === 'es' ? 'DEDUCCIONES' : lang === 'it' ? 'DETRAZIONI' : 'RETENUES'}</div>
            {([
              { label:`${lang === 'en' ? 'CNSS employee' : lang === 'es' ? 'CNSS empleado' : lang === 'it' ? 'CNSS dipendente' : 'CNSS employé'} (5,6 %)`,     taux:'5,6 %', montant: bd.cnss },
              { label:lang === 'en' ? 'Income tax (IRPP)' : lang === 'es' ? 'Impuesto salarial (IRPP)' : lang === 'it' ? 'Imposta sul reddito (IRPP)' : 'Impôt sur salaire (IRPP)', taux:'',      montant: bd.irpp },
              ...(record.absences > 0 ? [{ label:`${lang === 'en' ? 'Absence' : lang === 'es' ? 'Ausencia' : lang === 'it' ? 'Assenza' : 'Absence'} (${record.absences}j)`, taux:'', montant: bd.absencePenalty }] : []),
            ] as { label:string; taux:string; montant:number }[])
              .filter(r => r.montant > 0)
              .map((row, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 100px',
                  gap:8, padding:'9px 0',
                  borderBottom:'1px solid var(--border)', alignItems:'center',
                }}>
                  <span style={{ fontSize:13, color:'var(--text2)' }}>{row.label}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{row.taux}</span>
                  <span style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--danger)', textAlign:'right', fontFamily:'var(--mono)' }}>
                    − {fmt(row.montant)}
                  </span>
                </div>
              ))
            }
            <div style={{
              display:'flex', justifyContent:'space-between',
              padding:'11px 12px', marginTop:8,
              background:'var(--c-red-bg2)', border:'1px solid var(--c-red-border)',
              borderRadius:10,
            }}>
              <span style={{ fontSize:13, fontWeight:'var(--fw-bold)', color:'var(--danger)', letterSpacing:'.3px' }}>{lang === 'en' ? 'TOTAL DEDUCTIONS' : lang === 'es' ? 'TOTAL DEDUCCIONES' : lang === 'it' ? 'TOTALE DETRAZIONI' : 'TOTAL RETENUES'}</span>
              <span style={{ fontSize:14, fontWeight:'var(--fw-bold)', color:'var(--danger)', fontFamily:'var(--mono)' }}>
                − {fmt(totalRetenues)}
              </span>
            </div>
          </div>

          {/* NET À PAYER — en évidence (encart vert, montant 24px mono) */}
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'18px 20px', marginTop:16,
            background:'var(--c-green-bg)',
            border:'1px solid var(--c-green-border)', borderRadius:12,
          }}>
            <div>
              <div style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--acc2)', marginBottom:4, letterSpacing:'.5px' }}>{lang === 'en' ? 'NET PAYABLE' : lang === 'es' ? 'NETO A PAGAR' : lang === 'it' ? 'NETTO DA PAGARE' : 'NET À PAYER'}</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>{lang === 'en' ? 'Bank transfer' : lang === 'es' ? 'Transferencia bancaria' : lang === 'it' ? 'Bonifico bancario' : 'Virement bancaire'}</div>
            </div>
            <div style={{ fontSize:24, fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>
              {fmt(bd.net)}
            </div>
          </div>

        </div>

        {/* ── FOOTER ── */}
        <div style={{
          padding:'16px 28px', borderTop:'1px solid var(--border)',
          display:'flex', gap:10, background:'var(--bg3)',
        }}>
          <button
            onClick={() => { onPay(record.id); onClose() }}
            style={{
              flex:1, background:'linear-gradient(135deg, var(--acc2), #059669)',
              border:'none', borderRadius:10, padding:'11px',
              fontSize:13, fontWeight:'var(--fw-semibold)', color:'#fff',
              cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 4px 14px rgba(14,196,126,.3)',
            }}
          ><CheckCircle size={14} style={{ verticalAlign:'middle', marginRight:5 }}/> {lang === 'en' ? 'Mark as paid' : lang === 'es' ? 'Marcar como pagado' : lang === 'it' ? 'Segna come pagato' : 'Marquer comme payé'}</button>
          <button
            className="mini-btn"
            onClick={() => { printBulletin(record); toast.success(lang === 'en' ? '📄 PDF opened!' : lang === 'es' ? '📄 ¡PDF abierto!' : lang === 'it' ? '📄 PDF aperto!' : '📄 PDF ouvert !') }}
            style={{ padding:'11px 16px', fontSize:13, display:'flex', alignItems:'center', gap:5 }}
          ><Printer size={13}/> {lang === 'en' ? 'Print' : lang === 'es' ? 'Imprimir' : lang === 'it' ? 'Stampa' : 'Imprimer'}</button>
          <button
            className="mini-btn"
            onClick={() => { printBulletin(record); toast.success(lang === 'en' ? '📄 PDF opened!' : lang === 'es' ? '📄 ¡PDF abierto!' : lang === 'it' ? '📄 PDF aperto!' : '📄 PDF ouvert !') }}
            style={{ padding:'11px 16px', fontSize:13, display:'flex', alignItems:'center', gap:5 }}
          ><Download size={13}/> PDF</button>
        </div>

      </div>
    </div>
  )
}
