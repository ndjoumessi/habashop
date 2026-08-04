import Skeleton from '@/components/ui/skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { useConfig, useFormatAmount } from '@/stores/appStore'
import { fmtDate } from '@/lib/formatDate'
import { Plus, Search, BarChart2, Download, RefreshCw, Check, Clock, Pencil, Trash2 } from 'lucide-react'
import { CATEGORIES, CATEGORY_STYLE, CatPill, catLabel, ttcAmount } from './expensesShared'
import type { Category, Expense, ExpStatus } from './expensesShared'

interface Props {
  loading: boolean
  expenses: Expense[]
  filtered: Expense[]
  search: string
  setSearch: (v: string) => void
  catFilter: 'Toutes' | Category
  setCatFilter: (v: 'Toutes' | Category) => void
  statFilter: 'Tous' | ExpStatus
  setStatFilter: (v: 'Tous' | ExpStatus) => void
  onAdd: () => void
  onAccountingExport: () => void
  onPrintPDF: () => void
  onCSVExport: () => void
  onMarkPaid: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (e: Expense) => void
}

export default function ExpensesJournal(props: Props) {
  const {
    loading, expenses, filtered, search, setSearch, catFilter, setCatFilter,
    statFilter, setStatFilter, onAdd, onAccountingExport, onPrintPDF, onCSVExport,
    onMarkPaid, onDelete, onEdit,
  } = props
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const cl = (c: string) => catLabel(c, lang)

  return (
    <div className="panel" style={{ marginBottom:0 }}>
      <div className="panel-head">
        <span className="panel-title">{lang === 'en' ? 'Expense log' : lang === 'es' ? 'Registro de gastos' : lang === 'it' ? 'Registro spese' : 'Journal des dépenses'}</span>
        <button className="btn btn-primary btn-sm gap-1.5" onClick={onAdd}>
          <Plus size={13} /> {tr('Ajouter dépense','Add expense','Agregar gasto','Aggiungi spesa')}
        </button>
      </div>

      {!loading && expenses.length === 0 ? (
        <EmptyState
          icon="💸"
          title={lang === 'en' ? 'No expenses recorded' : lang === 'es' ? 'Sin gastos registrados' : lang === 'it' ? 'Nessuna spesa registrata' : 'Aucune dépense enregistrée'}
          message={lang === 'en' ? 'Record your expenses to track your costs.' : lang === 'es' ? 'Registre sus gastos para controlar sus costos.' : lang === 'it' ? 'Registra le tue spese per monitorare i costi.' : 'Enregistrez vos dépenses pour suivre vos charges.'}
          action={{ label: lang === 'en' ? '+ Add an expense' : lang === 'es' ? '+ Agregar un gasto' : lang === 'it' ? '+ Aggiungi una spesa' : '+ Ajouter une dépense', onClick: onAdd }}
        />
      ) : (<>
      {/* Filtres */}
      <div style={{ display:'flex', gap:9, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text2)' }} />
          <input className="input" aria-label={tr('Rechercher','Search','Buscar','Cerca')} placeholder={tr('Rechercher…','Search…','Buscar…','Cerca…')} value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft:30, width:200, boxSizing:'border-box' }} />
        </div>
        <select className="input" value={catFilter} onChange={e => setCatFilter(e.target.value as typeof catFilter)}
          style={{ width:'auto', minWidth:140 }}>
          <option value="Toutes">{tr('Toutes catégories','All categories','Todas las categorías','Tutte le categorie')}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{cl(c)}</option>)}
        </select>
        <select className="input" value={statFilter} onChange={e => setStatFilter(e.target.value as typeof statFilter)}
          style={{ width:'auto', minWidth:140 }}>
          <option value="Tous">{tr('Tous statuts','All statuses','Todos los estados','Tutti gli stati')}</option>
          <option value="PAYÉ">{tr('Payé','Paid','Pagado','Pagato')}</option>
          <option value="EN ATTENTE">{tr('En attente','Pending','Pendiente','In attesa')}</option>
        </select>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onAccountingExport}>
          <BarChart2 size={12}/> {lang === 'en' ? 'Accounting export' : lang === 'es' ? 'Exportación contable' : lang === 'it' ? 'Esportazione contabile' : 'Export comptable'}
        </button>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onPrintPDF}>
          <Download size={12} /> PDF
        </button>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onCSVExport}>
          <Download size={12} /> Export
        </button>
      </div>

      <div className="table-wrap data-table">
        <table aria-label={tr('Journal des dépenses','Expense log','Registro de gastos','Registro spese')}>
          <thead>
            <tr>
              <th scope="col">{tr('Date','Date','Fecha','Data')}</th><th scope="col">{tr('Libellé','Label','Etiqueta','Etichetta')}</th><th scope="col">{tr('Catégorie','Category','Categoría','Categoria')}</th>
              <th scope="col" className="th-num">{tr('Montant HT','Amount excl.','Importe s/IVA','Importo netto')}</th><th scope="col">TVA</th><th scope="col" className="th-num">TTC</th>
              <th scope="col">{tr('Mode','Mode','Modo','Modo')}</th><th scope="col" style={{ textAlign:'center' }}>{tr('Récurrent','Recurring','Recurrente','Ricorrente')}</th>
              <th scope="col">{tr('Statut','Status','Estado','Stato')}</th><th scope="col">{tr('Actions','Actions','Acciones','Azioni')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: '8px 14px' }}><Skeleton height={32} count={6} radius={8} /></td></tr>
            ) : (<>
            {filtered.map(e => {
              const catStyle = CATEGORY_STYLE[e.category]
              return (
                <tr key={e.id} style={{ borderLeft:`3px solid ${catStyle.color}40` }}>
                  <td className="td-mono text-xs">{fmtDate(e.date)}</td>
                  <td>
                    <div className="td-bold text-xs">{e.label}</div>
                    {e.recurrent && <div style={{ fontSize:'var(--fs-caption)', color:'var(--p2)', marginTop:2, display:'flex', alignItems:'center', gap:3 }}><RefreshCw size={9}/> {tr('Récurrent','Recurring','Recurrente','Ricorrente')}</div>}
                  </td>
                  <td><CatPill cat={e.category} lang={lang} /></td>
                  <td className="td-num text-sm">{fmt(e.amount)}</td>
                  <td style={{ fontSize:'var(--fs-label)', color:'var(--text3)' }}>{e.vat} %</td>
                  <td className="td-num text-sm" style={{ color:'var(--acc2)', fontWeight:'var(--fw-semibold)' }}>{fmt(ttcAmount(e))}</td>
                  <td>
                    <span className="badge badge-gray">{e.mode}</span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    {e.recurrent
                      ? <RefreshCw size={14} style={{ color:'var(--p2)', margin:'0 auto' }}/>
                      : <span style={{ color:'var(--text3)' }}>—</span>}
                  </td>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      padding:'3px 9px', borderRadius:'var(--r-full)', fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)',
                      background: e.status === 'PAYÉ' ? 'var(--c-green-bg)' : 'var(--c-orange-bg)',
                      color:       e.status === 'PAYÉ' ? 'var(--acc2)'      : 'var(--warn)',
                      border:      e.status === 'PAYÉ' ? '1px solid var(--c-green-border)' : '1px solid var(--c-orange-border)',
                    }}>
                      {e.status === 'PAYÉ' ? <Check size={10}/> : <Clock size={10}/>}
                      {e.status === 'PAYÉ' ? tr('Payé','Paid','Pagado','Pagato') : tr('En attente','Pending','Pendiente','In attesa')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      {e.status === 'EN ATTENTE' && (
                        <button className="btn btn-sm btn-ghost stock-action" title={tr('Marquer payé','Mark as paid','Marcar como pagado','Segna come pagato')} onClick={() => onMarkPaid(e.id)}><Check size={14}/></button>
                      )}
                      <button className="btn btn-sm btn-ghost stock-action" title={tr('Modifier','Edit','Editar','Modifica')} onClick={() => onEdit(e)}><Pencil size={14}/></button>
                      <button className="btn btn-sm btn-ghost stock-action" title={tr('Supprimer','Delete','Eliminar','Elimina')} onClick={() => onDelete(e.id)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--text3)', padding:'24px', fontSize:'var(--fs-sm)' }}>{tr('Aucune dépense trouvée','No expense found','Sin gastos encontrados','Nessuna spesa trovata')}</td></tr>
            )}
            </>)}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  )
}
