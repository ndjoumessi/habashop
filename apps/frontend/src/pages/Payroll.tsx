import { useState } from 'react'
import { useConfig, useFormatAmount } from '@/stores/appStore'
import { Download, Eye, X, Check, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const brut = calcBrut(record)
  const cnss = Math.round(record.baseSalary * 0.056)
  const impot = record.deductions - cnss
  const absencePenalty = Math.round(record.absences * record.baseSalary / 26)
  const totalRetenues = record.deductions + absencePenalty
  const net = calcNet(record)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:540 }}>
        {/* Header bulletin */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:4 }}>
              <div style={{
                width:32, height:32, borderRadius:8,
                background:'linear-gradient(135deg, var(--p), var(--p2))',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, fontWeight:900, color:'#fff',
              }}>H</div>
              <span style={{ fontWeight:800, fontSize:15, color:'var(--text)' }}>HabaShop — Dakar Central</span>
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginLeft:41 }}>Rue 10 × 23, Dakar, Sénégal</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontWeight:800, fontSize:14, color:'var(--p2)' }}>BULLETIN DE PAIE</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{record.month}</div>
          </div>
        </div>

        {/* Employé info */}
        <div style={{
          padding:'12px 14px', background:'var(--bg3)', borderRadius:10, marginBottom:18,
          display:'flex', alignItems:'center', gap:14,
        }}>
          <EmpAvatar r={record} size={44} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>{record.employee}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
              {record.role} · Contrat CDI
            </div>
          </div>
          <span className={`badge ${STATUS_CFG[record.status].cls}`}>{record.status}</span>
        </div>

        {/* Tableau gains */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
            Gains
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Libellé','Base','Taux','Montant'].map(h => (
                  <th key={h} style={{ padding:'5px 8px', textAlign: h === 'Montant' ? 'right' : 'left', color:'var(--text3)', fontWeight:600, borderBottom:'1px solid var(--border)', fontSize:10.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding:'7px 8px', color:'var(--text)' }}>Salaire de base</td>
                <td style={{ padding:'7px 8px', color:'var(--text3)', fontSize:11 }}>26j</td>
                <td style={{ padding:'7px 8px', color:'var(--text3)', fontSize:11 }}>100%</td>
                <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:600, fontFamily:'var(--mono)' }}>{fmt(record.baseSalary)}</td>
              </tr>
              {record.bonus > 0 && (
                <tr>
                  <td style={{ padding:'7px 8px', color:'var(--text)' }}>Prime de performance</td>
                  <td style={{ padding:'7px 8px' }} /><td style={{ padding:'7px 8px' }} />
                  <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:600, fontFamily:'var(--mono)' }}>{fmt(record.bonus)}</td>
                </tr>
              )}
              {record.overtime > 0 && (
                <tr>
                  <td style={{ padding:'7px 8px', color:'var(--text)' }}>Heures supplémentaires</td>
                  <td style={{ padding:'7px 8px', color:'var(--text3)', fontSize:11 }}>+H</td>
                  <td style={{ padding:'7px 8px', color:'var(--text3)', fontSize:11 }}>25%</td>
                  <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:600, fontFamily:'var(--mono)' }}>{fmt(record.overtime)}</td>
                </tr>
              )}
              <tr style={{ background:'rgba(14,196,126,.07)', borderTop:'1px solid var(--border)' }}>
                <td colSpan={3} style={{ padding:'8px 8px', fontWeight:700, color:'var(--acc2)' }}>TOTAL BRUT</td>
                <td style={{ padding:'8px 8px', textAlign:'right', fontWeight:800, fontFamily:'var(--mono)', color:'var(--acc2)', fontSize:13 }}>{fmt(brut)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tableau retenues */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
            Retenues
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <tbody>
              <tr>
                <td style={{ padding:'7px 8px', color:'var(--text)' }}>CNSS employé (5,6%)</td>
                <td style={{ padding:'7px 8px', color:'var(--text3)', fontSize:11 }}>5,6%</td>
                <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:600, fontFamily:'var(--mono)', color:'var(--danger)' }}>{fmt(cnss)}</td>
              </tr>
              <tr>
                <td style={{ padding:'7px 8px', color:'var(--text)' }}>Impôt sur salaire (IRPP)</td>
                <td style={{ padding:'7px 8px' }} />
                <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:600, fontFamily:'var(--mono)', color:'var(--danger)' }}>{fmt(Math.max(0, impot))}</td>
              </tr>
              {record.absences > 0 && (
                <tr>
                  <td style={{ padding:'7px 8px', color:'var(--text)' }}>Absence ({record.absences}j)</td>
                  <td style={{ padding:'7px 8px' }} />
                  <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:600, fontFamily:'var(--mono)', color:'var(--danger)' }}>{fmt(absencePenalty)}</td>
                </tr>
              )}
              <tr style={{ background:'rgba(232,64,74,.07)', borderTop:'1px solid var(--border)' }}>
                <td colSpan={2} style={{ padding:'8px 8px', fontWeight:700, color:'var(--danger)' }}>TOTAL RETENUES</td>
                <td style={{ padding:'8px 8px', textAlign:'right', fontWeight:800, fontFamily:'var(--mono)', color:'var(--danger)', fontSize:13 }}>{fmt(totalRetenues)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* NET À PAYER */}
        <div style={{
          padding:'14px 16px', background:'rgba(14,196,126,.1)',
          border:'1.5px solid rgba(14,196,126,.3)', borderRadius:10,
          display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20,
        }}>
          <span style={{ fontWeight:800, fontSize:15, color:'var(--acc2)' }}>NET À PAYER</span>
          <span style={{ fontWeight:900, fontSize:22, color:'var(--acc2)', fontFamily:'var(--mono)' }}>{fmt(net)}</span>
        </div>

        {/* Footer */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20, fontSize:12 }}>
          <div style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:8 }}>
            <div style={{ color:'var(--text3)', fontSize:11, marginBottom:3 }}>Mode de paiement</div>
            <div style={{ fontWeight:600, color:'var(--text)' }}>Virement bancaire</div>
          </div>
          <div style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:8 }}>
            <div style={{ color:'var(--text3)', fontSize:11, marginBottom:3 }}>Date de paiement</div>
            <div style={{ fontWeight:600, color:'var(--text)' }}>{record.paidAt ?? 'En attente'}</div>
          </div>
        </div>

        {/* Boutons */}
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm gap-1.5" style={{ flex:1 }} onClick={() => toast('🖨️ Impression…')}>
            🖨️ Imprimer
          </button>
          <button className="btn btn-ghost btn-sm gap-1.5" style={{ flex:1 }} onClick={() => toast('📥 Téléchargement PDF…')}>
            <Download size={12} /> PDF
          </button>
          {(record.status === 'EN ATTENTE' || record.status === 'GÉNÉRÉ') && (
            <button className="btn btn-primary btn-sm gap-1.5" style={{ flex:1 }}
              onClick={() => { onPay(record.id); onClose() }}>
              <Check size={12} /> Marquer payé
            </button>
          )}
          <button className="mini-btn" onClick={onClose}><X size={14} /></button>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Masse salariale brute', value:fmt(totalBrut),  sub:'Tous employés',                      color:'var(--p2)',   icon:'💰' },
          { label:'Masse salariale nette', value:fmt(totalNet),   sub:'Après retenues',                     color:'var(--acc2)', icon:'💵' },
          { label:'Bulletins générés',     value:`${generated}/6`,sub:`${records.length - generated} restants`, color:'var(--acc)', icon:'📄' },
          { label:'Bulletins payés',       value:`${paid}/6`,     sub:`${records.length - paid} non payés`, color:'var(--p3)',   icon:'✅' },
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
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📥 Export CSV paie…')}>
          <Download size={13} /> Export CSV
        </button>
        <button className="btn btn-primary btn-sm gap-1.5" onClick={generatePayroll}>
          <Zap size={13} /> Générer la paie du mois
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">💳 Paie — {month}</span>
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
                        <button className="mini-btn gap-1" onClick={() => toast('📥 Téléchargement…')}>
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
