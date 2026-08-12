import { useState, useEffect } from 'react'
import { useAppStore, useConfig, useFormatAmount, convertFromXOF, t } from '@/stores/appStore'
import { expensesApi, salesApi, expenseBudgetsApi } from '@/lib/api'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { saved } from '@/lib/saved'
import { exportCSV, openPDF, htmlTable, htmlKPIs, exportAccountingExcel } from '@/utils/export'
import {
  BUDGETS_INIT, CATEGORIES, ttcAmount, mapApiExpense, nextExpId, monthYearLabel,
  type Category, type Expense, type ExpStatus,
} from '@/components/expenses/expensesShared'
import ExpensesKpis from '@/components/expenses/ExpensesKpis'
import ExpensesJournal from '@/components/expenses/ExpensesJournal'
import ExpensesBudget from '@/components/expenses/ExpensesBudget'
import { buildBudgetSummary } from '@/components/expenses/budgetSummary'
import AddExpenseModal from '@/components/expenses/AddExpenseModal'
import ExpenseDetailModal from '@/components/expenses/ExpenseDetailModal'
import EditBudgetsModal from '@/components/expenses/EditBudgetsModal'
import Tabs from '@/components/ui/TabBar'

export default function Expenses() {
  const { lang, currency } = useConfig()
  const fmt = useFormatAmount()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  const handleAccountingExport = async () => {
    const period = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { month: 'long', year: 'numeric' })
    const shopName = useAppStore.getState().tenant?.name || useAppStore.getState().shopName || 'HabaShop'
    try {
      const sales = await salesApi.list()
      exportAccountingExcel({ sales: sales ?? [], expenses, period, shopName, currency, lang })
      toast.success(tr('Export comptable téléchargé !', 'Accounting export downloaded!', '¡Exportación contable descargada!', 'Esportazione contabile scaricata!'))
    } catch {
      exportAccountingExcel({ sales: [], expenses, period, shopName, currency, lang })
      toast.success(tr('Export téléchargé (dépenses uniquement)', 'Export downloaded (expenses only)', 'Exportación descargada (solo gastos)', 'Esportazione scaricata (solo spese)'))
    }
  }

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    expensesApi.list()
      .then(data => setExpenses(data.map(mapApiExpense)))
      .catch(() => toast.error(tr('Impossible de charger les dépenses — réessayer', 'Could not load expenses — please retry', 'No se pudieron cargar los gastos — reintenta', 'Impossibile caricare le spese — riprova')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = () => setAddOpen(true)
    window.addEventListener('habashop:new-expense', handler)
    return () => window.removeEventListener('habashop:new-expense', handler)
  }, [])
  const [budgets, setBudgets]   = useState<Record<Category, number>>(BUDGETS_INIT)

  /**
   * ⚠️ Les budgets viennent du SERVEUR, plus de `BUDGETS_INIT`. En cas d'échec réseau
   * on garde les valeurs par défaut de l'état initial : c'est un repli d'AFFICHAGE,
   * pas une décision — aucune écriture n'en découle, et le prochain enregistrement
   * partira de ce que le commerçant voit.
   */
  useEffect(() => {
    expenseBudgetsApi.get()
      .then(r => { if (r?.budgets) setBudgets(prev => ({ ...prev, ...r.budgets } as typeof prev)) })
      .catch(() => { /* repli d'affichage : les défauts restent en place */ })
  }, [])

  const [tab, setTab]           = useState<'journal' | 'budget'>('journal')

  // Filters
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState<'Toutes' | Category>('Toutes')
  const [statFilter, setStatFilter] = useState<'Tous' | ExpStatus>('Tous')

  // Modals
  const [addOpen, setAddOpen]             = useState(false)
  const [budgetOpen, setBudgetOpen]       = useState(false)
  const [savingBudgets, setSavingBudgets] = useState(false)
  const [editBudgets, setEditBudgets]     = useState<Record<Category, number>>(BUDGETS_INIT)

  // Modifier dépense
  const [editExpense, setEditExpense]     = useState<Expense | null>(null)
  const [showEditExpModal, setShowEditExpModal] = useState(false)
  const [expEditMode, setExpEditMode]     = useState(false)
  const [editExpForm, setEditExpForm]     = useState({
    date: '', label: '', category: 'Loyer' as Category,
    amountHT: 0, vat: 0, mode: '', recurrent: false, notes: '',
  })

  // New expense form
  const [nDate,      setNDate]      = useState(new Date().toISOString().split('T')[0])
  const [nLabel,     setNLabel]     = useState('')
  const [nCat,       setNCat]       = useState<Category>('Loyer')
  const [nHT,        setNHT]        = useState('')
  const [nVat,       setNVat]       = useState(0)
  const [nMode,      setNMode]      = useState('Espèces')
  const [nRecurrent, setNRecurrent] = useState(false)
  const [nNotes,     setNNotes]     = useState('')

  const nTTC = nHT ? Math.round(parseFloat(nHT) * (1 + nVat / 100)) : 0

  // Computed
  // Préfixe AAAA-MM du mois COURANT (heure locale) — plus de mois figé en dur.
  // Le libellé KPI est déjà dynamique (ExpensesKpis : new Date()) ; on aligne la donnée.
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = expenses.filter(e => e.date.startsWith(monthPrefix))
  const totalThisMonth = thisMonth.reduce((s, e) => s + e.amount, 0)
  const totalPending = expenses.filter(e => e.status === 'EN ATTENTE').reduce((s, e) => s + e.amount, 0)
  const pendingCount = expenses.filter(e => e.status === 'EN ATTENTE').length
  const recurrentCount = expenses.filter(e => e.recurrent).length
  /**
   * SOURCE UNIQUE du panneau budgétaire. `totalBudget` et `budgetLeft` en
   * dérivent — ils étaient calculés ICI pendant que le total et le taux affichés
   * l'étaient dans `ExpensesBudget` à partir d'une AUTRE population. Deux calculs
   * séparés d'une même grandeur n'ont aucune raison de rester d'accord, et ils ne
   * l'étaient pas : 1 350 000 contre 285 000.
   */
  const budgetSummary = buildBudgetSummary(thisMonth, budgets, CATEGORIES)
  const monthLabel = monthYearLabel(lang, now)
  // ⚠️ `catSpent` et `totalBudget` ne sont plus des locaux : le panneau reçoit le
  // résumé ENTIER. Les redéclarer ici recréerait deux chemins vers la même grandeur,
  // c'est-à-dire exactement la structure qui avait produit la divergence.
  const budgetLeft = budgetSummary.variance

  // Filtered journal
  const filtered = expenses.filter(e => {
    if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter !== 'Toutes' && e.category !== catFilter) return false
    if (statFilter !== 'Tous' && e.status !== statFilter) return false
    return true
  })

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

  const csvExport = () => {
    // Montants stockés en base XOF → convertis vers la devise d'affichage (pattern reportsExport)
    const cv = (xof: number) => Math.round(convertFromXOF(xof ?? 0, currency) * 100) / 100
    exportCSV('habashop_depenses',
      [tr('Date','Date','Fecha','Data'), tr('Libellé','Label','Concepto','Descrizione'), tr('Catégorie','Category','Categoría','Categoria'),
       `${tr('Montant HT','Amount excl. tax','Importe sin IVA','Importo netto')} (${currency})`, tr('TVA','VAT','IVA','IVA'),
       `${tr('TTC','Incl. tax','Con IVA','Lordo')} (${currency})`, tr('Mode','Method','Modo','Modo'),
       tr('Récurrent','Recurring','Recurrente','Ricorrente'), tr('Statut','Status','Estado','Stato')],
      expenses.map(e => [e.date, e.label, e.category, cv(e.amount), e.vat + ' %', cv(Math.round(e.amount * (1 + e.vat / 100))), e.mode, e.recurrent ? tr('Oui','Yes','Sí','Sì') : tr('Non','No','No','No'), e.status])
    )
    toast.success(tr('Export dépenses téléchargé !','Expenses export downloaded!','¡Exportación de gastos descargada!','Esportazione spese scaricata!'))
  }

  async function markPaid(id: number) {
    const exp = expenses.find(e => e.id === id)
    if (exp?._apiId) {
      try { await expensesApi.update(exp._apiId, { status: 'PAYÉ' }) } catch {
        // Échec serveur : pas de MAJ locale (sinon désynchro silencieuse au prochain reload)
        toast.error(tr('Échec de la mise à jour — réessayer', 'Update failed — please retry', 'Error al actualizar — reintenta', 'Aggiornamento non riuscito — riprova'))
        return
      }
    }
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: 'PAYÉ' } : e))
    toast.success(tr('Dépense marquée comme payée','Expense marked as paid','Gasto marcado como pagado','Spesa contrassegnata come pagata'))
    announce(tr('Dépense marquée comme payée','Expense marked as paid','Gasto marcado como pagado','Spesa contrassegnata come pagata'))
  }

  async function deleteExpense(id: number) {
    const exp = expenses.find(e => e.id === id)
    if (exp?._apiId) {
      try { await expensesApi.delete(exp._apiId) } catch {
        toast.error(tr('Échec de la suppression — réessayer', 'Delete failed — please retry', 'Error al eliminar — reintenta', 'Eliminazione non riuscita — riprova'))
        return
      }
    }
    setExpenses(prev => prev.filter(e => e.id !== id))
    toast.success(tr('Dépense supprimée','Expense deleted','Gasto eliminado','Spesa eliminata'))
    announce(tr('Dépense supprimée','Expense deleted','Gasto eliminado','Spesa eliminata'))
  }

  async function addExpense() {
    if (!nLabel.trim() || !nHT) { toast.error(tr('Libellé et montant requis','Label and amount required','Etiqueta e importe requeridos','Etichetta e importo richiesti')); return }
    const ht = Math.round(parseFloat(nHT))
    const newExp: Expense = {
      id: nextExpId(), date: nDate, label: nLabel.trim(), category: nCat,
      amount: ht, vat: nVat, mode: nMode, status: 'EN ATTENTE', recurrent: nRecurrent,
    }
    // ⚠️ Ce fichier DOCUMENTE la règle quinze lignes plus bas (« `saved(...)`, PAS
    // `.catch(() => {})` ») et l'enfreignait ici sous l'autre forme : `try/catch {}`.
    // Une dépense refusée s'affichait « enregistrée » et disparaissait au rechargement —
    // sur un montant, c'est-à-dire sur de la comptabilité.
    const ok = await saved(
      expensesApi.create({ date: new Date(nDate).toISOString(), label: nLabel.trim(), category: nCat, amountHT: ht, vat: nVat, amountTTC: nTTC, mode: nMode, recurrent: nRecurrent, notes: nNotes, status: 'EN ATTENTE' })
        .then(created => { newExp._apiId = created.id }),
      tr('la dépense', 'the expense', 'el gasto', 'la spesa'),
    )
    // On NE ferme PAS le formulaire et on ne vide RIEN : la saisie reste là, prête
    // à être renvoyée. `saved` a déjà affiché le message du serveur.
    if (!ok) return
    setExpenses(prev => [newExp, ...prev])
    toast.success(tr('Dépense enregistrée','Expense saved','Gasto registrado','Spesa registrata'))
    announce(tr('Dépense enregistrée','Expense saved','Gasto registrado','Spesa registrata'))
    setAddOpen(false)
    setNLabel(''); setNHT(''); setNVat(0); setNRecurrent(false); setNNotes('')
  }

  /**
   * ENREGISTREMENT RÉEL depuis 2026-08-08 (table `ExpenseBudget`).
   *
   * ⚠️ `saved(...)`, PAS `.catch(() => {})`. Ce site affichait un toast de succès sur
   * une valeur qui n'allait nulle part ; le remplacer par une requête AVALÉE serait le
   * même mensonge sous une autre forme — l'écran affirmerait un enregistrement que le
   * serveur a refusé. `saved` RAPPORTE (message du serveur préféré au nôtre) et rend
   * un booléen : la décision reste ici.
   *
   * ⚠️ Le store local n'est mis à jour QU'EN CAS DE SUCCÈS, et la modale reste ouverte
   * sur échec — le commerçant garde sa saisie et voit pourquoi elle n'est pas passée.
   * L'inverse (optimiste puis silence) est exactement ce que `lib/saved.ts` ferme.
   */
  async function saveBudgets() {
    if (savingBudgets) return
    setSavingBudgets(true)
    const ok = await saved(
      expenseBudgetsApi.put(editBudgets),
      tr('les budgets de dépense', 'the expense budgets', 'los presupuestos de gastos', 'i budget di spesa'),
    )
    setSavingBudgets(false)
    if (!ok) return
    setBudgets({ ...editBudgets })
    toast.success(tr('Budgets enregistrés','Budgets saved','Presupuestos guardados','Budget salvati'))
    announce(tr('Budgets enregistrés','Budgets saved','Presupuestos guardados','Budget salvati'))
    setBudgetOpen(false)
  }

  const saveEditExpense = async () => {
    if (!editExpense) return
    if (!editExpForm.label || !editExpForm.amountHT) { toast.error(lang === 'en' ? 'Label and amount required' : lang === 'es' ? 'Etiqueta e importe requeridos' : lang === 'it' ? 'Etichetta e importo richiesti' : 'Libellé et montant requis'); return }
    if (editExpense._apiId) {
      try { await expensesApi.update(editExpense._apiId, { date: new Date(editExpForm.date).toISOString(), label: editExpForm.label, category: editExpForm.category, amountHT: editExpForm.amountHT, vat: editExpForm.vat, amountTTC: Math.round(editExpForm.amountHT * (1 + editExpForm.vat / 100)), mode: editExpForm.mode, recurrent: editExpForm.recurrent }) } catch {
        toast.error(tr('Échec de la sauvegarde — réessayer', 'Save failed — please retry', 'Error al guardar — reintenta', 'Salvataggio non riuscito — riprova'))
        return
      }
    }
    setExpenses(prev => prev.map(e =>
      e.id === editExpense.id
        ? { ...e, date:editExpForm.date, label:editExpForm.label, category:editExpForm.category, amount:editExpForm.amountHT, vat:editExpForm.vat, mode:editExpForm.mode, recurrent:editExpForm.recurrent }
        : e
    ))
    setExpEditMode(false)
    toast.success(`${lang === 'en' ? 'Expense updated' : lang === 'es' ? 'Gasto modificado' : lang === 'it' ? 'Spesa modificata' : 'Dépense modifiée'}`)
  }


  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'en' ? 'Expenses' : lang === 'es' ? 'Gastos' : lang === 'it' ? 'Spese' : 'Dépenses'}</h1>
          <p className="page-subtitle">{expenses.length} {lang === 'en' ? 'recorded expenses' : lang === 'es' ? 'gastos registrados' : lang === 'it' ? 'spese registrate' : 'dépenses enregistrées'}</p>
        </div>
        <button className="topbar-btn" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> {lang === 'en' ? 'New expense' : lang === 'es' ? 'Nuevo gasto' : lang === 'it' ? 'Nuova spesa' : 'Nouvelle dépense'}
        </button>
      </div>

      <ExpensesKpis
        totalThisMonth={totalThisMonth}
        totalPending={totalPending}
        pendingCount={pendingCount}
        recurrentCount={recurrentCount}
        budgetLeft={budgetLeft}
      />

      {/* Tabs */}
      <Tabs
        variant="pill"
        value={tab}
        onChange={id => setTab(id as typeof tab)}
        tabs={[
          { id:'journal', label: t('expenses_journal') },
          { id:'budget',  label: t('expenses_budget') },
        ]}
      />

      {tab === 'journal' && (
        <ExpensesJournal
          loading={loading}
          expenses={expenses}
          filtered={filtered}
          search={search} setSearch={setSearch}
          catFilter={catFilter} setCatFilter={setCatFilter}
          statFilter={statFilter} setStatFilter={setStatFilter}
          onAdd={() => setAddOpen(true)}
          onAccountingExport={handleAccountingExport}
          onPrintPDF={() => { printExpensesPDF(); toast.success('PDF ouvert !') }}
          onCSVExport={csvExport}
          onMarkPaid={markPaid}
          onDelete={deleteExpense}
          onEdit={(e) => {
            setEditExpense(e)
            setEditExpForm({ date:e.date, label:e.label, category:e.category, amountHT:e.amount, vat:e.vat, mode:e.mode, recurrent:e.recurrent, notes:'' })
            setExpEditMode(false)
            setShowEditExpModal(true)
          }}
        />
      )}

      {tab === 'budget' && (
        <ExpensesBudget
          budgets={budgets}
          summary={budgetSummary}
          monthLabel={monthLabel}
          onEditBudgets={() => { setEditBudgets({ ...budgets }); setBudgetOpen(true) }}
        />
      )}

      {addOpen && (
        <AddExpenseModal
          nDate={nDate} setNDate={setNDate}
          nLabel={nLabel} setNLabel={setNLabel}
          nCat={nCat} setNCat={setNCat}
          nHT={nHT} setNHT={setNHT}
          nVat={nVat} setNVat={setNVat}
          nMode={nMode} setNMode={setNMode}
          nRecurrent={nRecurrent} setNRecurrent={setNRecurrent}
          nNotes={nNotes} setNNotes={setNNotes}
          nTTC={nTTC}
          onClose={() => setAddOpen(false)}
          onSubmit={addExpense}
        />
      )}

      {showEditExpModal && editExpense && (
        <ExpenseDetailModal
          editExpense={editExpense}
          editExpForm={editExpForm}
          setEditExpForm={setEditExpForm}
          expEditMode={expEditMode}
          setExpEditMode={setExpEditMode}
          onClose={() => { setShowEditExpModal(false); setExpEditMode(false) }}
          onSave={saveEditExpense}
          onDelete={() => { deleteExpense(editExpense.id); setShowEditExpModal(false) }}
        />
      )}

      {budgetOpen && (
        <EditBudgetsModal
          editBudgets={editBudgets}
          setEditBudgets={setEditBudgets}
          onClose={() => setBudgetOpen(false)}
          onSave={saveBudgets}
        />
      )}
    </div>
  )
}
