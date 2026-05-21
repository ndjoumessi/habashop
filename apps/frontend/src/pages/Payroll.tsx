import { useState } from 'react'
import { useConfig, useFormatAmount, useAppStore, formatCurrency, convertCurrency, t } from '@/stores/appStore'
import { Download, Eye, Check, Zap, DollarSign, TrendingDown, FileText, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlInfoGrid } from '@/utils/export'

type PayStatus = 'PAYÉ' | 'EN ATTENTE' | 'SUSPENDU' | 'GÉNÉRÉ'

interface PayRecord {
  id: number; employee: string; avatar: string; color: string; role: string
  baseSalary: number; bonus: number; overtime: number; deductions: number
  absences: number; status: PayStatus; paidAt: string | null; month: string
}

const PAYROLL_INIT: PayRecord[] = [
  { id:1, employee:'Marie Bakayoko',   avatar:'MB', color:'#6C3FD6', role:'Caissière',
    baseSalary:350000, bonus:25000,  overtime:18000, deductions:35000, absences:1,
    status:'PAYÉ',       paidAt:'30/04/2026', month:'Avril 2026' },
  { id:2, employee:'Kofi Diallo',      avatar:'KD', color:'#F59E0B', role:'Magasinier',
    baseSalary:420000, bonus:0,      overtime:42000, deductions:42000, absences:0,
    status:'PAYÉ',       paidAt:'30/04/2026', month:'Avril 2026' },
  { id:3, employee:'Aminata Touré',    avatar:'AT', color:'#10B981', role:'Comptable',
    baseSalary:280000, bonus:15000,  overtime:0,     deductions:28000, absences:2,
    status:'EN ATTENTE', paidAt:null,         month:'Mai 2026'   },
  { id:4, employee:'Seydou Koné',      avatar:'SK', color:'#EF4444', role:'Caissier',
    baseSalary:310000, bonus:20000,  overtime:0,     deductions:31000, absences:0,
    status:'EN ATTENTE', paidAt:null,         month:'Mai 2026'   },
  { id:5, employee:'Fatoumata Ndiaye', avatar:'FN', color:'#3B82F6', role:'Responsable',
    baseSalary:480000, bonus:50000,  overtime:0,     deductions:53000, absences:0,
    status:'EN ATTENTE', paidAt:null,         month:'Mai 2026'   },
  { id:6, employee:'Ibrahim Sow',      avatar:'IS', color:'#8B5CF6', role:'Livreur',
    baseSalary:220000, bonus:0,      overtime:0,     deductions:22000, absences:5,
    status:'SUSPENDU',   paidAt:null,         month:'Mai 2026'   },
]

const MONTHS = [
  'Janvier 2026','Février 2026','Mars 2026','Avril 2026','Mai 2026',
  'Juin 2026','Juillet 2026','Août 2026','Septembre 2026','Octobre 2026',
  'Novembre 2026','Décembre 2026',
]

function printBulletin(bulletin: PayRecord) {
  const { currency } = useAppStore.getState()
  const fmtP = (n: number) => formatCurrency(convertCurrency(n, 'XOF', currency), currency)

  const absencePenalty = Math.round(bulletin.absences * bulletin.baseSalary / 26)
  const brut = bulletin.baseSalary + bulletin.bonus + bulletin.overtime
  const net  = brut - bulletin.deductions - absencePenalty
  const cnss = Math.round(bulletin.baseSalary * 0.056)
  const irpp = Math.round(bulletin.deductions - cnss - absencePenalty)

  const gainsRows: string[][] = [
    [t('payslip_base_salary'), '26 j', '100 %', fmtP(bulletin.baseSalary)],
    ...(bulletin.bonus > 0 ? [[t('payslip_bonus'), '', '', fmtP(bulletin.bonus)]] : []),
    ...(bulletin.overtime > 0 ? [[t('payslip_overtime'), '', '25 %', fmtP(bulletin.overtime)]] : []),
  ]
  const retenuesRows: string[][] = [
    [t('payslip_cnss'), '5,6 %', fmtP(cnss)],
    ...(irpp > 0 ? [[t('payslip_tax'), '', fmtP(irpp)]] : []),
    ...(bulletin.absences > 0 ? [[`${t('payslip_absence_deduction')} (${bulletin.absences}j)`, '', fmtP(absencePenalty)]] : []),
  ]

  const body = `
    ${htmlInfoGrid([
      { label: t('hr_new_employee').toUpperCase(), value: `<span style="font-size:16px;font-weight:900;">${bulletin.employee}</span><br><span style="font-size:12px;color:#888;">${bulletin.role}</span>` },
      { label: t('doc_period').toUpperCase(),      value: `${bulletin.month}<br><span style="font-size:11px;color:#888;">Statut : <strong style="color:${bulletin.status === 'PAYÉ' ? '#059669' : '#d97706'}">${bulletin.status}</strong></span>` },
    ])}

    <h2>${t('payslip_gains')}</h2>
    ${htmlTable(
      [t('expenses_label'), t('payroll_base'), '%', t('col_amount')],
      gainsRows,
      ['', '', `<strong>${t('payslip_gross')}</strong>`, `<strong>${fmtP(brut)}</strong>`]
    )}

    <h2>${t('payslip_deductions')}</h2>
    ${htmlTable(
      [t('expenses_label'), '%', t('col_amount')],
      retenuesRows,
      ['', `<strong>${t('payslip_total_deductions')}</strong>`, `<strong style="color:#dc2626;">- ${fmtP(bulletin.deductions)}</strong>`]
    )}

    <div class="net-payer">
      <div>
        <div class="net-label">${t('doc_net')}</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">
          ${t('doc_payment_mode')} · ${bulletin.status === 'PAYÉ' ? bulletin.paidAt ?? '' : t('status_pending')}
        </div>
      </div>
      <div class="net-value">${fmtP(net)}</div>
    </div>

    <div class="signature-block">
      <div><div class="signature-line">${t('doc_signature_employer')}</div></div>
      <div><div class="signature-line">${t('doc_signature_employee')}</div></div>
    </div>
  `
  openPDF(`${t('payslip_title')} — ${bulletin.employee} — ${bulletin.month}`, body)
}

const STATUS_CFG: Record<PayStatus, { cls: string; label: string }> = {
  'PAYÉ':       { cls:'badge-green',  label:'PAYÉ'       },
  'EN ATTENTE': { cls:'badge-amber',  label:'EN ATTENTE' },
  'SUSPENDU':   { cls:'badge-red',    label:'SUSPENDU'   },
  'GÉNÉRÉ':     { cls:'badge-violet', label:'GÉNÉRÉ'     },
}

function calcNet(r: PayRecord) {
  const absencePenalty = Math.round(r.absences * r.baseSalary / 26)
  return r.baseSalary + r.bonus + r.overtime - r.deductions - absencePenalty
}

function calcBrut(r: PayRecord) {
  return r.baseSalary + r.bonus + r.overtime
}

function EmpAvatar({ r, size = 32 }: { r: PayRecord; size?: number }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:r.color, display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', fontSize:size * 0.35, fontWeight:800,
    }}>{r.avatar}</div>
  )
}

function BulletinModal({ record, onClose, onPay, fmt }: {
  record: PayRecord
  onClose: () => void
  onPay: (id: number) => void
  fmt: (n: number) => string
}) {
  const absencePenalty = Math.round(record.absences * record.baseSalary / 26)
  const totalRetenues = record.deductions + absencePenalty

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:50,
      background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:20, overflowY:'auto',
    }} onClick={onClose}>
      <div style={{
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
              fontSize:22, fontWeight:900, color:'#fff',
            }}>H</div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>
                HabaShop — Dakar Central
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', marginTop:2 }}>
                Bulletin de Paie — {record.month}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,.15)',
            border:'1px solid rgba(255,255,255,.25)',
            borderRadius:9, padding:'6px 10px',
            cursor:'pointer', color:'#fff', fontSize:14,
          }}>✕</button>
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
                fontSize:18, fontWeight:800, color:'#fff',
                boxShadow:`0 4px 14px ${record.color}44`,
              }}>{record.avatar}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                  {record.employee}
                </div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                  {record.role} · Contrat CDI
                </div>
              </div>
            </div>
            <span style={{
              background: record.status === 'PAYÉ' ? 'rgba(14,196,126,.15)' : 'rgba(240,165,0,.15)',
              color: record.status === 'PAYÉ' ? 'var(--acc2)' : 'var(--acc)',
              border: `1px solid ${record.status === 'PAYÉ' ? 'rgba(14,196,126,.3)' : 'rgba(240,165,0,.3)'}`,
              borderRadius:20, padding:'5px 14px',
              fontSize:12, fontWeight:700,
            }}>{record.status}</span>
          </div>
        </div>

        {/* ── CORPS ── */}
        <div style={{ padding:'0 28px 24px' }}>

          {/* GAINS */}
          <div style={{ marginTop:20 }}>
            <div style={{
              fontSize:10.5, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'1px', color:'var(--text3)',
              marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)',
            }}>GAINS</div>
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 80px 80px 100px',
              gap:8, marginBottom:6, fontSize:10, fontWeight:700,
              color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px',
            }}>
              <span>Libellé</span>
              <span style={{ textAlign:'center' }}>Base</span>
              <span style={{ textAlign:'center' }}>Taux</span>
              <span style={{ textAlign:'right' }}>Montant</span>
            </div>
            {([
              { label:'Salaire de base',        base:'26j', taux:'100 %', montant:record.baseSalary, show:true },
              { label:'Prime de performance',   base:'',    taux:'',      montant:record.bonus,       show:record.bonus > 0 },
              { label:'Heures supplémentaires', base:`${Math.round(record.overtime / record.baseSalary * 26 * 8)}h`, taux:'25 %', montant:record.overtime, show:record.overtime > 0 },
            ] as { label:string; base:string; taux:string; montant:number; show:boolean }[])
              .filter(r => r.show && r.montant > 0)
              .map((row, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 80px 100px',
                  gap:8, padding:'9px 0',
                  borderBottom:'1px solid var(--border)', alignItems:'center',
                }}>
                  <span style={{ fontSize:13, color:'var(--text)' }}>{row.label}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{row.base}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{row.taux}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', textAlign:'right', fontFamily:'var(--mono)' }}>
                    {fmt(row.montant)}
                  </span>
                </div>
              ))
            }
            <div style={{
              display:'flex', justifyContent:'space-between',
              padding:'11px 12px', marginTop:8,
              background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.2)',
              borderRadius:10,
            }}>
              <span style={{ fontSize:13, fontWeight:800, color:'var(--acc2)', letterSpacing:'.3px' }}>TOTAL BRUT</span>
              <span style={{ fontSize:14, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                {fmt(record.baseSalary + record.bonus + record.overtime)}
              </span>
            </div>
          </div>

          {/* RETENUES */}
          <div style={{ marginTop:20 }}>
            <div style={{
              fontSize:10.5, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'1px', color:'var(--text3)',
              marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)',
            }}>RETENUES</div>
            {([
              { label:'CNSS employé (5,6 %)',     taux:'5,6 %', montant: Math.round(record.baseSalary * 0.056) },
              { label:'Impôt sur salaire (IRPP)', taux:'',      montant: Math.round(record.deductions - record.baseSalary * 0.056 - (record.absences * record.baseSalary / 26)) },
              ...(record.absences > 0 ? [{ label:`Absence (${record.absences}j)`, taux:'', montant: Math.round(record.absences * record.baseSalary / 26) }] : []),
            ] as { label:string; taux:string; montant:number }[])
              .filter(r => r.montant > 0)
              .map((row, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 100px',
                  gap:8, padding:'9px 0',
                  borderBottom:'1px solid var(--border)', alignItems:'center',
                }}>
                  <span style={{ fontSize:13, color:'var(--text)' }}>{row.label}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{row.taux}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--danger)', textAlign:'right', fontFamily:'var(--mono)' }}>
                    − {fmt(row.montant)}
                  </span>
                </div>
              ))
            }
            <div style={{
              display:'flex', justifyContent:'space-between',
              padding:'11px 12px', marginTop:8,
              background:'rgba(232,64,74,.08)', border:'1px solid rgba(232,64,74,.2)',
              borderRadius:10,
            }}>
              <span style={{ fontSize:13, fontWeight:800, color:'var(--danger)', letterSpacing:'.3px' }}>TOTAL RETENUES</span>
              <span style={{ fontSize:14, fontWeight:900, color:'var(--danger)', fontFamily:'var(--mono)' }}>
                − {fmt(totalRetenues)}
              </span>
            </div>
          </div>

          {/* NET À PAYER */}
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'18px 20px', marginTop:16,
            background:'linear-gradient(135deg, rgba(91,78,232,.15), rgba(124,111,240,.08))',
            border:'2px solid rgba(91,78,232,.35)', borderRadius:14,
          }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, letterSpacing:'.5px' }}>NET À PAYER</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>Virement bancaire</div>
            </div>
            <div style={{ fontSize:28, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)', letterSpacing:'-1.5px' }}>
              {fmt(record.baseSalary + record.bonus + record.overtime - record.deductions - (record.absences * Math.round(record.baseSalary / 26)))}
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
              fontSize:13, fontWeight:700, color:'#fff',
              cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 4px 14px rgba(14,196,126,.3)',
            }}
          >✅ Marquer comme payé</button>
          <button
            className="mini-btn"
            onClick={() => { printBulletin(record); toast.success('📄 PDF ouvert !') }}
            style={{ padding:'11px 16px', fontSize:13 }}
          >🖨️ Imprimer</button>
          <button
            className="mini-btn"
            onClick={() => { printBulletin(record); toast.success('📄 PDF ouvert !') }}
            style={{ padding:'11px 16px', fontSize:13 }}
          >📥 PDF</button>
        </div>

      </div>
    </div>
  )
}

export default function Payroll() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()

  const [records, setRecords]       = useState<PayRecord[]>(PAYROLL_INIT)
  const [month, setMonth]           = useState('Mai 2026')
  const [bulletin, setBulletin]     = useState<PayRecord | null>(null)

  const filtered = records.filter(r => r.month === month)

  const totalBrut = records.reduce((s, r) => s + calcBrut(r), 0)
  const totalNet  = records.reduce((s, r) => s + calcNet(r), 0)
  const generated = records.filter(r => r.status === 'GÉNÉRÉ' || r.status === 'PAYÉ').length
  const paid      = records.filter(r => r.status === 'PAYÉ').length

  function generatePayroll() {
    const count = records.filter(r => r.month === month && r.status === 'EN ATTENTE').length
    if (count === 0) { toast.error('Aucun bulletin en attente pour ce mois'); return }
    setRecords(prev => prev.map(r =>
      r.month === month && r.status === 'EN ATTENTE' ? { ...r, status: 'GÉNÉRÉ' } : r
    ))
    toast.success(`${count} bulletin(s) généré(s) pour ${month}`)
  }

  function markPaid(id: number) {
    setRecords(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'PAYÉ', paidAt: '14/05/2026' } : r
    ))
    toast.success('Bulletin marqué comme payé')
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fr' ? 'Paie & Salaires' : 'Payroll'}</h1>
          <p className="page-subtitle">{lang === 'fr' ? `Période : ${month}` : `Period: ${month}`}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          exportCSV('paie_' + month, ['Employé','Brut','Net','Statut'], records.map(r => [r.employee, calcBrut(r), calcNet(r), r.status]))
          toast.success('CSV exporté')
        }}>
          <Download size={14} /> Export
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Masse salariale brute', value:fmt(totalBrut),  sub:'Tous employés',                      color:'var(--p2)',   icon:<DollarSign   size={18} /> },
          { label:'Masse salariale nette', value:fmt(totalNet),   sub:'Après retenues',                     color:'var(--acc2)', icon:<TrendingDown size={18} /> },
          { label:'Bulletins générés',     value:`${generated}/6`,sub:`${records.length - generated} restants`, color:'var(--acc)', icon:<FileText     size={18} /> },
          { label:'Bulletins payés',       value:`${paid}/6`,     sub:`${records.length - paid} non payés`, color:'var(--p3)',   icon:<CheckCircle  size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:20 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select className="input" value={month} onChange={e => setMonth(e.target.value)}
          style={{ width:'auto', minWidth:180 }}>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <div style={{ flex:1 }} />
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
          exportCSV('habashop_paie',
            ['Employé','Poste','Salaire base','Primes','Heures sup','Retenues','Absences','Net','Statut'],
            records.map(r => {
              const net = r.baseSalary + r.bonus + r.overtime - r.deductions - (r.absences * Math.round(r.baseSalary / 26))
              return [r.employee, r.role, r.baseSalary, r.bonus, r.overtime, r.deductions, r.absences, net, r.status]
            })
          )
          toast.success('📊 Export CSV téléchargé !')
        }}>
          <Download size={13} /> Export CSV
        </button>
        <button className="btn btn-primary btn-sm gap-1.5" onClick={generatePayroll}>
          <Zap size={13} /> Générer la paie du mois
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">Paie — {month}</span>
          <span className="badge badge-gray">{filtered.length} employé{filtered.length > 1 ? 's' : ''}</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 0', color:'var(--text3)', fontSize:13 }}>
            Aucun bulletin pour {month}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employé</th><th>Poste</th><th>Base</th>
                  <th>Primes</th><th>Heures sup.</th><th>Retenues</th>
                  <th>Absences</th><th>NET</th><th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <EmpAvatar r={r} size={30} />
                        <span className="td-bold" style={{ fontSize:12 }}>{r.employee}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{r.role}</td>
                    <td className="td-num text-sm">{fmt(r.baseSalary)}</td>
                    <td className="td-num text-sm" style={{ color:r.bonus > 0 ? 'var(--acc2)' : 'var(--text3)' }}>
                      {r.bonus > 0 ? fmt(r.bonus) : '—'}
                    </td>
                    <td className="td-num text-sm" style={{ color:r.overtime > 0 ? 'var(--p2)' : 'var(--text3)' }}>
                      {r.overtime > 0 ? fmt(r.overtime) : '—'}
                    </td>
                    <td className="td-num text-sm" style={{ color:'var(--danger)' }}>
                      {fmt(r.deductions)}
                    </td>
                    <td>
                      {r.absences > 0
                        ? <span style={{ fontSize:12, fontWeight:700, color:'var(--danger)' }}>{r.absences}j</span>
                        : <span style={{ fontSize:12, color:'var(--text3)' }}>0</span>
                      }
                    </td>
                    <td className="td-num" style={{ color:'var(--acc2)', fontSize:13 }}>{fmt(calcNet(r))}</td>
                    <td>
                      <span className={`badge ${STATUS_CFG[r.status].cls}`}>{STATUS_CFG[r.status].label}</span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button className="mini-btn gap-1" onClick={() => setBulletin(r)}>
                          <Eye size={11} /> Voir
                        </button>
                        {(r.status === 'EN ATTENTE' || r.status === 'GÉNÉRÉ') && (
                          <button className="mini-btn gap-1" onClick={() => markPaid(r.id)}>
                            <Check size={11} /> Payer
                          </button>
                        )}
                        <button className="mini-btn gap-1" onClick={() => { printBulletin(r); toast.success('📄 PDF ouvert !') }}>
                          <Download size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal bulletin */}
      {bulletin && (
        <BulletinModal
          record={bulletin}
          onClose={() => setBulletin(null)}
          onPay={markPaid}
          fmt={fmt}
        />
      )}
    </div>
  )
}
