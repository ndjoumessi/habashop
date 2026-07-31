import { useConfig, useFormatAmount } from '@/stores/appStore'
import { TrendingDown, Clock, RefreshCw, BarChart2 } from 'lucide-react'

interface Props {
  totalThisMonth: number
  totalPending: number
  pendingCount: number
  recurrentCount: number
  budgetLeft: number
}

export default function ExpensesKpis({ totalThisMonth, totalPending, pendingCount, recurrentCount, budgetLeft }: Props) {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const monthName = new Date().toLocaleDateString(locale, { month: 'long' })
  const monthYear = (() => { const m = new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' }); return m.charAt(0).toUpperCase() + m.slice(1) })()

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label:`${tr('Dépenses','Expenses','Gastos','Spese')} (${monthName})`, value:fmt(totalThisMonth), sub:monthYear, color:'var(--danger)', icon:<TrendingDown size={18} /> },
        { label:tr('En attente paiement','Pending payment','Pago pendiente','Pagamento in attesa'), value:fmt(totalPending), sub:`${pendingCount} ${tr('facture(s)','invoice(s)','factura(s)','fattura/e')}`, color:'var(--acc)', icon:<Clock size={18} /> },
        { label:tr('Dépenses récurrentes','Recurring expenses','Gastos recurrentes','Spese ricorrenti'), value:recurrentCount, sub:tr('Mensuelles / abonnements','Monthly / subscriptions','Mensuales / suscripciones','Mensili / abbonamenti'), color:'var(--p2)', icon:<RefreshCw size={18} /> },
        { label:tr('Budget restant','Remaining budget','Presupuesto restante','Budget rimanente'), value:fmt(Math.max(0, budgetLeft)), sub:tr('Sur budget mensuel','Of monthly budget','Del presupuesto mensual','Del budget mensile'), color: budgetLeft >= 0 ? 'var(--acc2)' : 'var(--danger)', icon:<BarChart2 size={18} /> },
      ].map(k => (
        <div key={k.label} className="kpi-card" style={{ border:'1px solid var(--border2)', boxShadow:'var(--sh-sm)', overflow:'hidden' }}>
          <div className="kpi-icon-w" style={{ color:k.color, background:`color-mix(in srgb, ${k.color} 12%, transparent)` }}>{k.icon}</div>
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-value" style={{ color:k.color, fontSize: typeof k.value === 'number' ? 28 : 18 }}>
            {k.value}
          </div>
          <div className="kpi-sub">{k.sub}</div>
        </div>
      ))}
    </div>
  )
}
