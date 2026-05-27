import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, useAppStore, formatCurrency, convertCurrency, t } from '@/stores/appStore'
import { Download, Eye, Check, Zap, DollarSign, TrendingDown, FileText, CheckCircle, X, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { employeesApi } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import { exportCSV, openPDF, htmlTable, htmlInfoGrid } from '@/utils/export'

type PayStatus = 'PAYÉ' | 'EN ATTENTE' | 'SUSPENDU' | 'GÉNÉRÉ'

interface PayRecord {
  id: number; employee: string; avatar: string; color: string; role: string
  baseSalary: number; bonus: number; overtime: number; deductions: number
  absences: number; status: PayStatus; paidAt: string | null; month: string
}

const MONTHS = [
  'Janvier 2026','Février 2026','Mars 2026','Avril 2026','Mai 2026',
  'Juin 2026','Juillet 2026','Août 2026','Septembre 2026','Octobre 2026',
  'Novembre 2026','Décembre 2026',
]

const PAY_COLORS = ['#6C3FD6','#F59E0B','#10B981','#EF4444','#3B82F6','#8B5CF6','#EC4899','#F472B6']
const currentMonthLabel = MONTHS[new Date().getMonth()] ?? MONTHS[0]

// Localise un libellé de mois FR ("Mai 2026") sans changer la valeur stockée (clé de filtre)
const FR_MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const monthLabel = (m: string, lang: string) => {
  const [name, yearStr] = m.split(' ')
  const idx = FR_MONTH_NAMES.indexOf(name)
  if (idx < 0) return m
  const year = Number(yearStr) || new Date().getFullYear()
  const loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const s = new Date(year, idx, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Libellés des postes employés (traduits à l'affichage, valeurs custom passent inchangées)
const ROLE_T: Record<string, Record<string, string>> = {
  'Caissier':   { fr:'Caissier',   en:'Cashier',     es:'Cajero',     it:'Cassiere'     },
  'Caissière':  { fr:'Caissière',  en:'Cashier',     es:'Cajera',     it:'Cassiera'     },
  'Vendeur':    { fr:'Vendeur',    en:'Sales rep',   es:'Vendedor',   it:'Venditore'    },
  'Vendeuse':   { fr:'Vendeuse',   en:'Sales rep',   es:'Vendedora',  it:'Venditrice'   },
  'Manager':    { fr:'Manager',    en:'Manager',     es:'Gerente',    it:'Manager'      },
  'Directeur':  { fr:'Directeur',  en:'Director',    es:'Director',   it:'Direttore'    },
  'Comptable':  { fr:'Comptable',  en:'Accountant',  es:'Contable',   it:'Contabile'    },
  'Magasinier': { fr:'Magasinier', en:'Storekeeper', es:'Almacenero', it:'Magazziniere' },
  'Livreur':    { fr:'Livreur',    en:'Delivery',    es:'Repartidor', it:'Fattorino'    },
  'Sécurité':   { fr:'Sécurité',   en:'Security',    es:'Seguridad',  it:'Sicurezza'    },
}
const roleLabel = (r: string, lang: string) => ROLE_T[r]?.[lang] ?? r

function printBulletin(bulletin: PayRecord) {
  const { currency, lang } = useAppStore.getState()
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
      { label: t('hr_new_employee').toUpperCase(), value: `<span style="font-size:16px;font-weight:900;">${bulletin.employee}</span><br><span style="font-size:12px;color:#888;">${roleLabel(bulletin.role, lang)}</span>` },
      { label: t('doc_period').toUpperCase(),      value: `${monthLabel(bulletin.month, lang)}<br><span style="font-size:11px;color:#888;">${lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'} : <strong style="color:${bulletin.status === 'PAYÉ' ? '#059669' : '#d97706'}">${statusLabel(bulletin.status, lang)}</strong></span>` },
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
  openPDF(`${t('payslip_title')} — ${bulletin.employee} — ${monthLabel(bulletin.month, lang)}`, body)
}

const STATUS_CFG: Record<PayStatus, { cls: string; label: string }> = {
  'PAYÉ':       { cls:'badge-green',  label:'PAYÉ'       },
  'EN ATTENTE': { cls:'badge-amber',  label:'EN ATTENTE' },
  'SUSPENDU':   { cls:'badge-red',    label:'SUSPENDU'   },
  'GÉNÉRÉ':     { cls:'badge-violet', label:'GÉNÉRÉ'     },
}

const STATUS_LABELS: Record<PayStatus, Record<string, string>> = {
  'PAYÉ':       { fr:'PAYÉ',       en:'PAID',      es:'PAGADO',     it:'PAGATO'    },
  'EN ATTENTE': { fr:'EN ATTENTE', en:'PENDING',   es:'PENDIENTE',  it:'IN ATTESA' },
  'SUSPENDU':   { fr:'SUSPENDU',   en:'SUSPENDED', es:'SUSPENDIDO', it:'SOSPESO'   },
  'GÉNÉRÉ':     { fr:'GÉNÉRÉ',     en:'GENERATED', es:'GENERADO',   it:'GENERATO'  },
}
const statusLabel = (s: PayStatus, lang: string) => STATUS_LABELS[s]?.[lang] ?? s

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
  const { lang } = useConfig()
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
                HabaShop
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', marginTop:2 }}>
                {lang === 'en' ? 'Payslip' : lang === 'es' ? 'Nómina' : lang === 'it' ? 'Busta paga' : 'Bulletin de Paie'} — {monthLabel(record.month, lang)}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
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
                fontSize:18, fontWeight:800, color:'#fff',
                boxShadow:`0 4px 14px ${record.color}44`,
              }}>{record.avatar}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                  {record.employee}
                </div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                  {roleLabel(record.role, lang)} · {lang === 'en' ? 'Permanent contract' : lang === 'es' ? 'Contrato indefinido' : lang === 'it' ? 'Contratto indeterminato' : 'Contrat CDI'}
                </div>
              </div>
            </div>
            <span style={{
              background: record.status === 'PAYÉ' ? 'rgba(14,196,126,.15)' : 'rgba(240,165,0,.15)',
              color: record.status === 'PAYÉ' ? 'var(--acc2)' : 'var(--acc)',
              border: `1px solid ${record.status === 'PAYÉ' ? 'rgba(14,196,126,.3)' : 'rgba(240,165,0,.3)'}`,
              borderRadius:20, padding:'5px 14px',
              fontSize:12, fontWeight:700,
            }}>{statusLabel(record.status, lang)}</span>
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
            }}>{lang === 'en' ? 'EARNINGS' : lang === 'es' ? 'GANANCIAS' : lang === 'it' ? 'GUADAGNI' : 'GAINS'}</div>
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 80px 80px 100px',
              gap:8, marginBottom:6, fontSize:10, fontWeight:700,
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
              <span style={{ fontSize:13, fontWeight:800, color:'var(--acc2)', letterSpacing:'.3px' }}>{lang === 'en' ? 'GROSS TOTAL' : lang === 'es' ? 'TOTAL BRUTO' : lang === 'it' ? 'TOTALE LORDO' : 'TOTAL BRUT'}</span>
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
            }}>{lang === 'en' ? 'DEDUCTIONS' : lang === 'es' ? 'DEDUCCIONES' : lang === 'it' ? 'DETRAZIONI' : 'RETENUES'}</div>
            {([
              { label:`${lang === 'en' ? 'CNSS employee' : lang === 'es' ? 'CNSS empleado' : lang === 'it' ? 'CNSS dipendente' : 'CNSS employé'} (5,6 %)`,     taux:'5,6 %', montant: Math.round(record.baseSalary * 0.056) },
              { label:lang === 'en' ? 'Income tax (IRPP)' : lang === 'es' ? 'Impuesto salarial (IRPP)' : lang === 'it' ? 'Imposta sul reddito (IRPP)' : 'Impôt sur salaire (IRPP)', taux:'',      montant: Math.round(record.deductions - record.baseSalary * 0.056 - (record.absences * record.baseSalary / 26)) },
              ...(record.absences > 0 ? [{ label:`${lang === 'en' ? 'Absence' : lang === 'es' ? 'Ausencia' : lang === 'it' ? 'Assenza' : 'Absence'} (${record.absences}j)`, taux:'', montant: Math.round(record.absences * record.baseSalary / 26) }] : []),
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
              <span style={{ fontSize:13, fontWeight:800, color:'var(--danger)', letterSpacing:'.3px' }}>{lang === 'en' ? 'TOTAL DEDUCTIONS' : lang === 'es' ? 'TOTAL DEDUCCIONES' : lang === 'it' ? 'TOTALE DETRAZIONI' : 'TOTAL RETENUES'}</span>
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
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, letterSpacing:'.5px' }}>{lang === 'en' ? 'NET PAYABLE' : lang === 'es' ? 'NETO A PAGAR' : lang === 'it' ? 'NETTO DA PAGARE' : 'NET À PAYER'}</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>{lang === 'en' ? 'Bank transfer' : lang === 'es' ? 'Transferencia bancaria' : lang === 'it' ? 'Bonifico bancario' : 'Virement bancaire'}</div>
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

export default function Payroll() {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const navigate = useNavigate()

  const [records, setRecords]       = useState<PayRecord[]>([])
  const [month, setMonth]           = useState(currentMonthLabel)
  const [bulletin, setBulletin]     = useState<PayRecord | null>(null)

  useEffect(() => {
    employeesApi.list()
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return
        setRecords(data
          .filter((e: any) => (e.active ?? e.isActive ?? e.status !== 'inactive'))
          .map((e: any, i: number) => {
            const name = e.name ?? (`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Employé')
            return {
              id: typeof e.id === 'number' ? e.id : i + 1,
              employee: name,
              avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
              color: PAY_COLORS[i % PAY_COLORS.length],
              role: e.role ?? e.position ?? 'Employé',
              baseSalary: Number(e.salary ?? e.baseSalary ?? 0),
              bonus: 0, overtime: 0, deductions: 0, absences: 0,
              status: 'EN ATTENTE' as PayStatus, paidAt: null, month: currentMonthLabel,
            }
          }))
      })
      .catch(() => {})
  }, [])

  const filtered = records.filter(r => r.month === month)

  const totalBrut = records.reduce((s, r) => s + calcBrut(r), 0)
  const totalNet  = records.reduce((s, r) => s + calcNet(r), 0)
  const generated = records.filter(r => r.status === 'GÉNÉRÉ' || r.status === 'PAYÉ').length
  const paid      = records.filter(r => r.status === 'PAYÉ').length

  function generatePayroll() {
    const count = records.filter(r => r.month === month && r.status === 'EN ATTENTE').length
    if (count === 0) { toast.error(lang === 'en' ? 'No pending payslips for this month' : lang === 'es' ? 'Sin nóminas pendientes este mes' : lang === 'it' ? 'Nessuna busta paga in attesa per questo mese' : 'Aucun bulletin en attente pour ce mois'); return }
    setRecords(prev => prev.map(r =>
      r.month === month && r.status === 'EN ATTENTE' ? { ...r, status: 'GÉNÉRÉ' } : r
    ))
    toast.success(lang === 'en' ? `${count} payslip(s) generated for ${monthLabel(month, lang)}` : lang === 'es' ? `${count} nómina(s) generada(s) para ${monthLabel(month, lang)}` : lang === 'it' ? `${count} busta/e paga generata/e per ${monthLabel(month, lang)}` : `${count} bulletin(s) généré(s) pour ${monthLabel(month, lang)}`)
  }

  function markPaid(id: number) {
    setRecords(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'PAYÉ', paidAt: '14/05/2026' } : r
    ))
    toast.success(lang === 'en' ? 'Payslip marked as paid' : lang === 'es' ? 'Nómina marcada como pagada' : lang === 'it' ? 'Busta paga segnata come pagata' : 'Bulletin marqué comme payé')
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'en' ? 'Payroll' : lang === 'es' ? 'Nómina y salarios' : lang === 'it' ? 'Buste paga e stipendi' : 'Paie & Salaires'}</h1>
          <p className="page-subtitle">{lang === 'en' ? `Period: ${monthLabel(month, lang)}` : lang === 'es' ? `Período: ${monthLabel(month, lang)}` : lang === 'it' ? `Periodo: ${monthLabel(month, lang)}` : `Période : ${monthLabel(month, lang)}`}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          exportCSV('paie_' + month, [lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé', lang === 'en' ? 'Gross' : lang === 'es' ? 'Bruto' : lang === 'it' ? 'Lordo' : 'Brut', 'Net', lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'], records.map(r => [r.employee, calcBrut(r), calcNet(r), statusLabel(r.status, lang)]))
          toast.success(lang === 'en' ? 'CSV exported' : lang === 'es' ? 'CSV exportado' : lang === 'it' ? 'CSV esportato' : 'CSV exporté')
        }}>
          <Download size={14} /> Export
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:lang === 'en' ? 'Gross payroll' : lang === 'es' ? 'Nómina bruta' : lang === 'it' ? 'Massa salariale lorda' : 'Masse salariale brute', value:fmt(totalBrut),  sub:lang === 'en' ? 'All employees' : lang === 'es' ? 'Todos empleados' : lang === 'it' ? 'Tutti dipendenti' : 'Tous employés',                          color:'#6C47FF', icon:<DollarSign   size={18} /> },
          { label:lang === 'en' ? 'Net payable' : lang === 'es' ? 'Neto a pagar' : lang === 'it' ? 'Netto da pagare' : 'Net à payer',           value:fmt(totalNet),   sub:lang === 'en' ? 'After deductions' : lang === 'es' ? 'Tras deducciones' : lang === 'it' ? 'Dopo detrazioni' : 'Après retenues',                         color:'#00D084', icon:<TrendingDown size={18} /> },
          { label:lang === 'en' ? 'Payslips generated' : lang === 'es' ? 'Nóminas generadas' : lang === 'it' ? 'Buste paga generate' : 'Bulletins générés',     value:`${generated}/${records.length}`,sub:`${records.length - generated} ${lang === 'en' ? 'remaining' : lang === 'es' ? 'restantes' : lang === 'it' ? 'rimanenti' : 'restants'}`, color:'#F0A500', icon:<FileText     size={18} /> },
          { label:lang === 'en' ? 'Paid payslips' : lang === 'es' ? 'Nóminas pagadas' : lang === 'it' ? 'Buste paga pagate' : 'Bulletins payés',       value:`${paid}/${records.length}`,     sub:`${records.length - paid} ${lang === 'en' ? 'unpaid' : lang === 'es' ? 'sin pagar' : lang === 'it' ? 'non pagate' : 'non payés'}`,     color:'#00B8FF', icon:<CheckCircle  size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ background:`linear-gradient(135deg,${k.color}18,${k.color}06)`, border:`1px solid ${k.color}28` }}>
            <div className="kpi-icon-w" style={{ color:k.color, background:`${k.color}20` }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:20 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {records.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="💰"
            title={lang === 'en' ? 'No payroll data' : lang === 'es' ? 'Sin datos de nómina' : lang === 'it' ? 'Nessun dato busta paga' : 'Aucune donnée de paie'}
            message={lang === 'en' ? 'Add employees with their salaries to manage payroll.' : lang === 'es' ? 'Agregue empleados con sus salarios para gestionar la nómina.' : lang === 'it' ? 'Aggiungi dipendenti con i loro stipendi per gestire le buste paga.' : 'Ajoutez des employés avec leurs salaires pour gérer la paie.'}
            action={{ label: lang === 'en' ? 'Manage employees' : lang === 'es' ? 'Gestionar empleados' : lang === 'it' ? 'Gestisci dipendenti' : 'Gérer les employés', onClick: () => navigate('/app/hr') }}
          />
        </div>
      ) : (
      <>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select className="input" value={month} onChange={e => setMonth(e.target.value)}
          style={{ width:'auto', minWidth:180 }}>
          {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m, lang)}</option>)}
        </select>
        <div style={{ flex:1 }} />
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
          exportCSV('habashop_paie',
            [
              lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé',
              lang === 'en' ? 'Role' : lang === 'es' ? 'Puesto' : lang === 'it' ? 'Ruolo' : 'Poste',
              lang === 'en' ? 'Base salary' : lang === 'es' ? 'Salario base' : lang === 'it' ? 'Stipendio base' : 'Salaire base',
              lang === 'en' ? 'Bonuses' : lang === 'es' ? 'Primas' : lang === 'it' ? 'Premi' : 'Primes',
              lang === 'en' ? 'Overtime' : lang === 'es' ? 'Horas extra' : lang === 'it' ? 'Straordinari' : 'Heures sup',
              lang === 'en' ? 'Deductions' : lang === 'es' ? 'Deducciones' : lang === 'it' ? 'Detrazioni' : 'Retenues',
              lang === 'en' ? 'Absences' : lang === 'es' ? 'Ausencias' : lang === 'it' ? 'Assenze' : 'Absences',
              'Net',
              lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut',
            ],
            records.map(r => {
              const net = r.baseSalary + r.bonus + r.overtime - r.deductions - (r.absences * Math.round(r.baseSalary / 26))
              return [r.employee, roleLabel(r.role, lang), r.baseSalary, r.bonus, r.overtime, r.deductions, r.absences, net, statusLabel(r.status, lang)]
            })
          )
          toast.success(lang === 'en' ? '📊 CSV export downloaded!' : lang === 'es' ? '📊 ¡Exportación CSV descargada!' : lang === 'it' ? '📊 Esportazione CSV scaricata!' : '📊 Export CSV téléchargé !')
        }}>
          <Download size={13} /> Export CSV
        </button>
        <button className="btn btn-primary btn-sm gap-1.5" onClick={generatePayroll}>
          <Zap size={13} /> {lang === 'en' ? 'Generate monthly payroll' : lang === 'es' ? 'Generar nómina del mes' : lang === 'it' ? 'Genera busta paga del mese' : 'Générer la paie du mois'}
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">{lang === 'en' ? 'Payroll' : lang === 'es' ? 'Nómina' : lang === 'it' ? 'Buste paga' : 'Paie'} — {monthLabel(month, lang)}</span>
          <span className="badge badge-gray">{filtered.length} {filtered.length > 1 ? (lang === 'en' ? 'employees' : lang === 'es' ? 'empleados' : lang === 'it' ? 'dipendenti' : 'employés') : (lang === 'en' ? 'employee' : lang === 'es' ? 'empleado' : lang === 'it' ? 'dipendente' : 'employé')}</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 0', color:'var(--text3)', fontSize:13 }}>
            {lang === 'en' ? `No payslips for ${monthLabel(month, lang)}` : lang === 'es' ? `Sin nóminas para ${monthLabel(month, lang)}` : lang === 'it' ? `Nessuna busta paga per ${monthLabel(month, lang)}` : `Aucun bulletin pour ${monthLabel(month, lang)}`}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</th><th scope="col">{lang === 'en' ? 'Role' : lang === 'es' ? 'Puesto' : lang === 'it' ? 'Ruolo' : 'Poste'}</th><th scope="col">{lang === 'en' ? 'Base' : lang === 'es' ? 'Base' : lang === 'it' ? 'Base' : 'Base'}</th>
                  <th scope="col">{lang === 'en' ? 'Bonuses' : lang === 'es' ? 'Primas' : lang === 'it' ? 'Premi' : 'Primes'}</th><th scope="col">{lang === 'en' ? 'Overtime' : lang === 'es' ? 'Horas extra' : lang === 'it' ? 'Straordinari' : 'Heures sup.'}</th><th scope="col">{lang === 'en' ? 'Deductions' : lang === 'es' ? 'Deducciones' : lang === 'it' ? 'Detrazioni' : 'Retenues'}</th>
                  <th scope="col">{lang === 'en' ? 'Absences' : lang === 'es' ? 'Ausencias' : lang === 'it' ? 'Assenze' : 'Absences'}</th><th scope="col">NET</th><th scope="col">{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</th><th scope="col">Actions</th>
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
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{roleLabel(r.role, lang)}</td>
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
                      <span className={`badge ${STATUS_CFG[r.status].cls}`}>{statusLabel(r.status, lang)}</span>
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
                        <button className="mini-btn gap-1" onClick={() => { printBulletin(r); toast.success(lang === 'en' ? '📄 PDF opened!' : lang === 'es' ? '📄 ¡PDF abierto!' : lang === 'it' ? '📄 PDF aperto!' : '📄 PDF ouvert !') }}>
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
      </>
      )}

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
