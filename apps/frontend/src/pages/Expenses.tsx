import { useState } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Download, Plus, X, Search, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs } from '@/utils/export'

type Category = 'Loyer' | 'Énergie' | 'Transport' | 'Maintenance' | 'Fournitures' | 'Marketing' | 'Formation' | 'Autre'
type ExpStatus = 'PAYÉ' | 'EN ATTENTE'

interface Expense {
  id: number; date: string; label: string; category: Category
  amount: number; vat: number; mode: string
  status: ExpStatus; recurrent: boolean
}

const EXPENSES_INIT: Expense[] = [
  { id:1,  date:'2026-05-13', label:'Loyer boutique',       category:'Loyer',       amount:450000, vat:0,  mode:'Virement',    status:'PAYÉ',       recurrent:true  },
  { id:2,  date:'2026-05-12', label:'Facture électricité',  category:'Énergie',     amount:85000,  vat:18, mode:'Espèces',     status:'PAYÉ',       recurrent:false },
  { id:3,  date:'2026-05-11', label:'Transport livraison',  category:'Transport',   amount:35000,  vat:0,  mode:'Espèces',     status:'PAYÉ',       recurrent:false },
  { id:4,  date:'2026-05-10', label:'Maintenance frigo',    category:'Maintenance', amount:120000, vat:18, mode:'Chèque',      status:'EN ATTENTE', recurrent:false },
  { id:5,  date:'2026-05-08', label:'Fournitures bureau',   category:'Fournitures', amount:28000,  vat:18, mode:'Espèces',     status:'PAYÉ',       recurrent:false },
  { id:6,  date:'2026-05-05', label:'Abonnement internet',  category:'Énergie',     amount:45000,  vat:18, mode:'Prélèvement', status:'PAYÉ',       recurrent:true  },
  { id:7,  date:'2026-05-03', label:'Carburant véhicule',   category:'Transport',   amount:62000,  vat:0,  mode:'Espèces',     status:'PAYÉ',       recurrent:false },
  { id:8,  date:'2026-05-01', label:'Nettoyage locaux',     category:'Maintenance', amount:40000,  vat:0,  mode:'Espèces',     status:'PAYÉ',       recurrent:true  },
  { id:9,  date:'2026-04-28', label:'Publicité Facebook',   category:'Marketing',   amount:75000,  vat:0,  mode:'Carte',       status:'PAYÉ',       recurrent:false },
  { id:10, date:'2026-04-25', label:'Formation employés',   category:'Formation',   amount:150000, vat:0,  mode:'Virement',    status:'PAYÉ',       recurrent:false },
]

const BUDGETS_INIT: Record<Category, number> = {
  Loyer: 500000, Énergie: 150000, Transport: 100000, Maintenance: 200000,
  Fournitures: 50000, Marketing: 100000, Formation: 200000, Autre: 50000,
}

const CATEGORIES: Category[] = ['Loyer','Énergie','Transport','Maintenance','Fournitures','Marketing','Formation','Autre']

const CATEGORY_STYLE: Record<Category, { bg: string; color: string; icon: string }> = {
  Loyer:       { bg:'rgba(124,111,240,.15)', color:'#A89CF5', icon:'🏠' },
  Énergie:     { bg:'rgba(240,165,0,.15)',   color:'#F0A500', icon:'⚡' },
  Transport:   { bg:'rgba(59,130,246,.15)',  color:'#60A5FA', icon:'🚗' },
  Maintenance: { bg:'rgba(251,146,60,.15)',  color:'#FB923C', icon:'🔧' },
  Fournitures: { bg:'rgba(20,184,166,.15)',  color:'#2DD4BF', icon:'📦' },
  Marketing:   { bg:'rgba(236,72,153,.15)',  color:'#F472B6', icon:'📢' },
  Formation:   { bg:'rgba(14,196,126,.15)',  color:'#0EC47E', icon:'🎓' },
  Autre:       { bg:'rgba(136,134,168,.15)', color:'#8886A8', icon:'📌' },
}

const MODES = ['Espèces','Carte','Chèque','Virement','Prélèvement']
const VAT_RATES = [0, 10, 18, 20]

function CatPill({ cat }: { cat: Category }) {
  const s = CATEGORY_STYLE[cat]
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px',
      borderRadius:20, fontSize:11, fontWeight:600,
      background:s.bg, color:s.color,
    }}>{s.icon} {cat}</span>
  )
}

export default function Expenses() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()

  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES_INIT)
  const [budgets, setBudgets]   = useState<Record<Category, number>>(BUDGETS_INIT)
  const [tab, setTab]           = useState<'journal' | 'budget'>('journal')

  // Filters
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState<'Toutes' | Category>('Toutes')
  const [statFilter, setStatFilter] = useState<'Tous' | ExpStatus>('Tous')

  // Modals
  const [addOpen, setAddOpen]             = useState(false)
  const [budgetOpen, setBudgetOpen]       = useState(false)
  const [editBudgets, setEditBudgets]     = useState<Record<Category, number>>(BUDGETS_INIT)

  // Modifier dépense
  const [editExpense, setEditExpense]     = useState<Expense | null>(null)
  const [showEditExpModal, setShowEditExpModal] = useState(false)
  const [editExpForm, setEditExpForm]     = useState({
    date: '', label: '', category: 'Loyer' as Category,
    amountHT: 0, vat: 0, mode: '', recurrent: false, notes: '',
  })
  const editExpTTC = Math.round(editExpForm.amountHT * (1 + editExpForm.vat / 100))

  // New expense form
  const [nDate,      setNDate]      = useState('2026-05-14')
  const [nLabel,     setNLabel]     = useState('')
  const [nCat,       setNCat]       = useState<Category>('Loyer')
  const [nHT,        setNHT]        = useState('')
  const [nVat,       setNVat]       = useState(0)
  const [nMode,      setNMode]      = useState('Espèces')
  const [nRecurrent, setNRecurrent] = useState(false)
  const [nNotes,     setNNotes]     = useState('')

  const nTTC = nHT ? Math.round(parseFloat(nHT) * (1 + nVat / 100)) : 0

  // Computed
  const may = expenses.filter(e => e.date.startsWith('2026-05'))
  const totalMay   = may.reduce((s, e) => s + e.amount, 0)
  const totalPending = expenses.filter(e => e.status === 'EN ATTENTE').reduce((s, e) => s + e.amount, 0)
  const recurrentCount = expenses.filter(e => e.recurrent).length
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0)
  const budgetLeft  = totalBudget - totalMay

  // Filtered journal
  const filtered = expenses.filter(e => {
    if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter !== 'Toutes' && e.category !== catFilter) return false
    if (statFilter !== 'Tous' && e.status !== statFilter) return false
    return true
  })

  function ttcAmount(e: Expense) { return Math.round(e.amount * (1 + e.vat / 100)) }

  const printExpensesPDF = () => {
    const total = expenses.reduce((s, e) => s + ttcAmount(e), 0)
    const paid  = expenses.filter(e => e.status === 'PAYÉ').reduce((s, e) => s + ttcAmount(e), 0)
    const body = `
      ${htmlKPIs([
        { label: t('expense_pdf_total'),   value: fmt(total) },
        { label: t('expense_pdf_paid'),    value: fmt(paid)  },
        { label: t('expense_pdf_pending'), value: fmt(total - paid) },
        { label: t('expenses_recurrent'),  value: String(expenses.filter(e => e.recurrent).length) },
      ])}
      <h2>${t('expense_pdf_title')}</h2>
      ${htmlTable(
        [t('col_date'), t('expenses_label'), t('col_category'), t('expenses_amount_ht'), t('expenses_tva'), t('expenses_ttc'), t('expenses_mode'), t('col_status')],
        expenses.map(e => [
          e.date, e.label, e.category,
          fmt(e.amount),
          e.vat + ' %',
          fmt(ttcAmount(e)),
          e.mode,
          e.status === 'PAYÉ'
            ? `<span class="badge badge-green">${t('status_paid')}</span>`
            : `<span class="badge badge-amber">${t('status_pending')}</span>`,
        ]),
        ['','','','','',
         '<strong>' + fmt(total) + '</strong>','','']
      )}
    `
    openPDF(t('expense_pdf_title'), body)
  }

  function markPaid(id: number) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: 'PAYÉ' } : e))
    toast.success('Dépense marquée comme payée')
  }

  function deleteExpense(id: number) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    toast.success('Dépense supprimée')
  }

  function addExpense() {
    if (!nLabel.trim() || !nHT) { toast.error('Libellé et montant requis'); return }
    const newExp: Expense = {
      id: Date.now(), date: nDate, label: nLabel.trim(), category: nCat,
      amount: Math.round(parseFloat(nHT)), vat: nVat,
      mode: nMode, status: 'EN ATTENTE', recurrent: nRecurrent,
    }
    setExpenses(prev => [newExp, ...prev])
    toast.success('Dépense enregistrée')
    setAddOpen(false)
    setNLabel(''); setNHT(''); setNVat(0); setNRecurrent(false); setNNotes('')
  }

  function saveBudgets() {
    setBudgets({ ...editBudgets })
    toast.success('Budgets mis à jour')
    setBudgetOpen(false)
  }

  const catSpent: Record<Category, number> = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
    return acc
  }, {} as Record<Category, number>)

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Dépenses (mai)',      value:fmt(totalMay),     sub:'Mai 2026',                color:'var(--danger)', icon:'💸' },
          { label:'En attente paiement', value:fmt(totalPending), sub:`${expenses.filter(e=>e.status==='EN ATTENTE').length} facture(s)`, color:'var(--acc)', icon:'⏳' },
          { label:'Dépenses récurrentes',value:recurrentCount,    sub:'Mensuelles / abonnements', color:'var(--p2)',    icon:'🔄' },
          { label:'Budget restant',      value:fmt(Math.max(0, budgetLeft)), sub:'Sur budget mensuel', color: budgetLeft >= 0 ? 'var(--acc2)' : 'var(--danger)', icon:'📊' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize: typeof k.value === 'number' ? 28 : 18 }}>
              {k.value}
            </div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6 }}>
        {[
          { id:'journal', label:`📋 ${t('expenses_journal')}` },
          { id:'budget',  label:`📊 ${t('expenses_budget')}` },
        ].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id as typeof tab)} style={{
            padding:'8px 18px', borderRadius:10, fontSize:13, fontWeight:700,
            fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
            background: tab === tb.id ? 'var(--p)' : 'var(--card)',
            color: tab === tb.id ? '#fff' : 'var(--text2)',
            border: tab === tb.id ? 'none' : '1px solid var(--border)',
            boxShadow: tab === tb.id ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
          }}>{tb.label}</button>
        ))}
      </div>

      {/* ── ONGLET JOURNAL ── */}
      {tab === 'journal' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📋 Journal des dépenses</span>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus size={13} /> Ajouter dépense
            </button>
          </div>

          {/* Filtres */}
          <div style={{ display:'flex', gap:9, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text2)' }} />
              <input className="input" placeholder="Rechercher…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft:30, width:200, boxSizing:'border-box' }} />
            </div>
            <select className="input" value={catFilter} onChange={e => setCatFilter(e.target.value as typeof catFilter)}
              style={{ width:'auto', minWidth:140 }}>
              <option value="Toutes">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="input" value={statFilter} onChange={e => setStatFilter(e.target.value as typeof statFilter)}
              style={{ width:'auto', minWidth:140 }}>
              <option value="Tous">Tous statuts</option>
              <option value="PAYÉ">PAYÉ</option>
              <option value="EN ATTENTE">EN ATTENTE</option>
            </select>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printExpensesPDF(); toast.success('📄 PDF ouvert !') }}>
              <Download size={12} /> PDF
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_depenses',
                ['Date','Libellé','Catégorie','Montant HT','TVA','TTC','Mode','Récurrent','Statut'],
                expenses.map(e => [e.date, e.label, e.category, e.amount, e.vat + ' %', Math.round(e.amount * (1 + e.vat / 100)), e.mode, e.recurrent ? 'Oui' : 'Non', e.status])
              )
              toast.success('📊 Export dépenses téléchargé !')
            }}>
              <Download size={12} /> Export
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Libellé</th><th>Catégorie</th>
                  <th>Montant HT</th><th>TVA</th><th>TTC</th>
                  <th>Mode</th><th style={{ textAlign:'center' }}>Récurrent</th>
                  <th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td className="td-mono text-xs">{e.date}</td>
                    <td className="td-bold text-xs">{e.label}</td>
                    <td><CatPill cat={e.category} /></td>
                    <td className="td-num text-sm">{fmt(e.amount)}</td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{e.vat} %</td>
                    <td className="td-num text-sm" style={{ color:'var(--acc2)' }}>{fmt(ttcAmount(e))}</td>
                    <td>
                      <span className="badge badge-gray">{e.mode}</span>
                    </td>
                    <td style={{ textAlign:'center', fontSize:16 }}>{e.recurrent ? '🔄' : '—'}</td>
                    <td>
                      <span className={`badge ${e.status === 'PAYÉ' ? 'badge-green' : 'badge-amber'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        {e.status === 'EN ATTENTE' && (
                          <button className="mini-btn" title="Marquer payé" onClick={() => markPaid(e.id)}>✅</button>
                        )}
                        <button className="mini-btn" title="Modifier" onClick={() => {
                          setEditExpense(e)
                          setEditExpForm({
                            date: e.date,
                            label: e.label,
                            category: e.category,
                            amountHT: e.amount,
                            vat: e.vat,
                            mode: e.mode,
                            recurrent: e.recurrent,
                            notes: '',
                          })
                          setShowEditExpModal(true)
                        }}>✏️</button>
                        <button className="mini-btn" title="Supprimer" onClick={() => deleteExpense(e.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--text3)', padding:'24px', fontSize:13 }}>Aucune dépense trouvée</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONGLET BUDGET VS RÉEL ── */}
      {tab === 'budget' && (
        <div className="space-y-4">
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn btn-ghost btn-sm gap-1.5"
              onClick={() => { setEditBudgets({ ...budgets }); setBudgetOpen(true) }}>
              <Settings size={13} /> Modifier les budgets
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12 }}>
            {CATEGORIES.filter(cat => budgets[cat] > 0).map(cat => {
              const spent = catSpent[cat] ?? 0
              const budget = budgets[cat]
              const pct = Math.min(100, Math.round(spent / budget * 100))
              const over = spent > budget
              const barColor = pct < 70 ? 'var(--acc2)' : pct < 90 ? 'var(--acc)' : 'var(--danger)'
              const s = CATEGORY_STYLE[cat]
              return (
                <div key={cat} style={{
                  background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:14, padding:'16px 18px',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:18 }}>{s.icon}</span>
                      <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{cat}</span>
                    </div>
                    {over && (
                      <span className="badge badge-red">Dépassé !</span>
                    )}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:12 }}>
                    <span style={{ color:'var(--text3)' }}>Budget : <strong style={{ color:'var(--text2)' }}>{fmt(budget)}</strong></span>
                    <span style={{ color:'var(--text3)' }}>Réel : <strong style={{ color: over ? 'var(--danger)' : 'var(--text)' }}>{fmt(spent)}</strong></span>
                  </div>
                  <div style={{ height:9, background:'var(--bg4)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                    <div style={{
                      width:`${pct}%`, height:'100%',
                      background: barColor,
                      borderRadius:99, transition:'width .4s',
                    }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ fontWeight:700, color: barColor, fontFamily:'var(--mono)' }}>{pct} %</span>
                    <span style={{ color: over ? 'var(--danger)' : 'var(--acc2)', fontWeight:600 }}>
                      {over ? `Dépassé de ${fmt(spent - budget)}` : `Restant : ${fmt(budget - spent)} ✅`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Résumé total */}
          <div style={{
            background:'var(--card)', border:'1px solid var(--border)',
            borderRadius:14, padding:'18px 20px',
          }}>
            <div className="panel-head" style={{ marginBottom:16 }}>
              <span className="panel-title">📊 Résumé mensuel</span>
            </div>
            {[
              { label:'Budget total mensuel',  value:fmt(totalBudget),            color:'var(--text2)' },
              { label:'Total dépensé',          value:fmt(Object.values(catSpent).reduce((s,v) => s+v, 0)), color:'var(--acc)' },
              { label:'Écart',                  value:fmt(Math.abs(budgetLeft)),   color: budgetLeft >= 0 ? 'var(--acc2)' : 'var(--danger)', prefix: budgetLeft >= 0 ? '▲ +' : '▼ -' },
              { label:'Taux d\'utilisation',    value:`${Math.round(Object.values(catSpent).reduce((s,v)=>s+v,0)/totalBudget*100)} %`, color: 'var(--p2)' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--text3)' }}>{r.label}</span>
                <span style={{ fontSize:13, fontWeight:700, color:r.color, fontFamily:'var(--mono)' }}>
                  {(r as { prefix?: string }).prefix ?? ''}{r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL Ajouter dépense ── */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Ajouter une dépense</span>
              <button className="mini-btn" onClick={() => setAddOpen(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Date</label>
                  <input className="input" type="date" value={nDate} onChange={e => setNDate(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Catégorie</label>
                  <select className="input" value={nCat} onChange={e => setNCat(e.target.value as Category)}
                    style={{ width:'100%', boxSizing:'border-box' }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Libellé</label>
                <input className="input" type="text" placeholder="Ex: Facture EDF"
                  value={nLabel} onChange={e => setNLabel(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Montant HT (F CFA)</label>
                  <input className="input" type="number" placeholder="Ex: 85000"
                    value={nHT} onChange={e => setNHT(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Taux TVA</label>
                  <select className="input" value={nVat} onChange={e => setNVat(+e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box' }}>
                    {VAT_RATES.map(v => <option key={v} value={v}>{v} %</option>)}
                  </select>
                </div>
              </div>
              {nHT && (
                <div style={{
                  padding:'10px 13px', background:'rgba(14,196,126,.1)',
                  border:'1px solid rgba(14,196,126,.25)', borderRadius:8,
                  display:'flex', justifyContent:'space-between', fontSize:13,
                }}>
                  <span style={{ color:'var(--text3)' }}>Montant TTC calculé :</span>
                  <span style={{ fontWeight:800, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                    {nTTC.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Mode de paiement</label>
                <select className="input" value={nMode} onChange={e => setNMode(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box' }}>
                  {MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="checkbox" id="recurrent" checked={nRecurrent}
                  onChange={e => setNRecurrent(e.target.checked)}
                  style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--p2)' }} />
                <label htmlFor="recurrent" style={{ fontSize:13, color:'var(--text2)', cursor:'pointer', fontWeight:600 }}>
                  Dépense récurrente (mensuelle)
                </label>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Notes (optionnel)</label>
                <input className="input" type="text" placeholder="Informations supplémentaires…"
                  value={nNotes} onChange={e => setNNotes(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setAddOpen(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={addExpense}>✅ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Modifier dépense ── */}
      {showEditExpModal && editExpense && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setShowEditExpModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>✏️ Modifier la dépense</span>
              <button className="mini-btn" onClick={() => setShowEditExpModal(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Date</label>
                  <input className="input" type="date" value={editExpForm.date}
                    onChange={e => setEditExpForm(f => ({...f, date:e.target.value}))}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Catégorie</label>
                  <select className="input" value={editExpForm.category}
                    onChange={e => setEditExpForm(f => ({...f, category:e.target.value as Category}))}
                    style={{ width:'100%', boxSizing:'border-box' }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Libellé *</label>
                <input className="input" value={editExpForm.label}
                  onChange={e => setEditExpForm(f => ({...f, label:e.target.value}))}
                  placeholder="Description de la dépense..."
                  style={{ width:'100%', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Montant HT</label>
                  <input className="input" type="number" value={editExpForm.amountHT || ''}
                    onChange={e => setEditExpForm(f => ({...f, amountHT:+e.target.value}))}
                    style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>TVA (%)</label>
                  <select className="input" value={editExpForm.vat}
                    onChange={e => setEditExpForm(f => ({...f, vat:+e.target.value}))}
                    style={{ width:'100%', boxSizing:'border-box' }}>
                    {VAT_RATES.map(v => <option key={v} value={v}>{v} %</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>TTC</label>
                  <div style={{
                    padding:'10px 13px', background:'var(--bg4)',
                    border:'1px solid var(--border)', borderRadius:10,
                    fontSize:13, fontWeight:700, color:'var(--acc2)', fontFamily:'var(--mono)',
                  }}>{fmt(editExpTTC)}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Mode de paiement</label>
                  <select className="input" value={editExpForm.mode}
                    onChange={e => setEditExpForm(f => ({...f, mode:e.target.value}))}
                    style={{ width:'100%', boxSizing:'border-box' }}>
                    {MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <button type="button" onClick={() => setEditExpForm(f => ({...f, recurrent:!f.recurrent}))}
                      style={{
                        width:44, height:24, borderRadius:99,
                        background: editExpForm.recurrent ? 'var(--p2)' : 'var(--bg4)',
                        border:'none', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0,
                      }}>
                      <div style={{
                        position:'absolute', top:2,
                        left: editExpForm.recurrent ? 22 : 2,
                        width:20, height:20, borderRadius:'50%',
                        background:'#fff', transition:'left .2s', boxShadow:'0 2px 4px rgba(0,0,0,.2)',
                      }} />
                    </button>
                    <span style={{ fontSize:13, color:'var(--text2)' }}>Dépense récurrente</span>
                  </label>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setShowEditExpModal(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => {
                if (!editExpForm.label || !editExpForm.amountHT) { toast.error('Libellé et montant requis'); return }
                setExpenses(prev => prev.map(e =>
                  e.id === editExpense.id
                    ? { ...e, date:editExpForm.date, label:editExpForm.label, category:editExpForm.category,
                        amount:editExpForm.amountHT, vat:editExpForm.vat, mode:editExpForm.mode,
                        recurrent:editExpForm.recurrent }
                    : e
                ))
                setShowEditExpModal(false)
                toast.success(`✅ Dépense "${editExpForm.label}" modifiée`)
              }}>✅ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Modifier budgets ── */}
      {budgetOpen && (
        <div className="modal-backdrop" onClick={() => setBudgetOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>⚙️ Modifier les budgets</span>
              <button className="mini-btn" onClick={() => setBudgetOpen(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {CATEGORIES.map(cat => {
                const s = CATEGORY_STYLE[cat]
                return (
                  <div key={cat} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:16 }}>{s.icon}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', width:110, flexShrink:0 }}>{cat}</span>
                    <input className="input" type="number" value={editBudgets[cat]}
                      onChange={e => setEditBudgets(b => ({ ...b, [cat]: +e.target.value }))}
                      style={{ flex:1, boxSizing:'border-box' }} />
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setBudgetOpen(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={saveBudgets}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
