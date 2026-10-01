import { useConfig, useFormatAmount } from '@/stores/appStore'
import { TrendingDown, Clock, RefreshCw, BarChart2 } from 'lucide-react'
import { monthYearLabel } from './expensesShared'
import type { BudgetSummary } from './budgetSummary'

interface Props {
  totalThisMonth: number
  /** ⚠️ En **TTC** — `enAttenteTTC`. Le libellé dit « paiement » : c'est ce qui sort de la caisse. */
  totalPending: number
  pendingCount: number
  recurrentCount: number
  /**
   * ⚠️ LE RÉSUMÉ ENTIER, pas seulement `variance`. La carte a besoin de distinguer TROIS états,
   * et « aucun budget posé » ne se lit pas dans la variance : sans budget elle vaut l'opposé de
   * la dépense, ce qui se faisait passer pour un dépassement. `usagePct === null` est le
   * prédicat que `budgetSummary` définit DÉJÀ pour cet état — en recalculer un second ici
   * recréerait deux chemins vers la même question.
   */
  summary: BudgetSummary
}

export default function ExpensesKpis({ totalThisMonth, totalPending, pendingCount, recurrentCount, summary }: Props) {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const monthName = new Date().toLocaleDateString(locale, { month: 'long' })
  // Source unique — le panneau « Budget vs Réel » nomme la MÊME période.
  const monthYear = monthYearLabel(lang)

  /**
   * ⚠️ LA BASE EST NOMMÉE SUR CHAQUE MONTANT. Les cartes portaient deux bases différentes sans
   * le dire — dépenses du mois en HT, attente de paiement en TTC — et le PDF une troisième
   * lecture de la même grandeur. Un montant qui ne dit pas sa base est un montant qu'on compare
   * à tort, exactement comme une moyenne sans son dénominateur.
   */
  const ht  = tr('HT',  'excl. VAT', 'sin IVA',  'IVA escl.')
  const ttc = tr('TTC', 'incl. VAT', 'con IVA',  'IVA incl.')

  /**
   * ⚠️ TROIS ÉTATS, PAS DEUX. `Math.max(0, variance)` affichait « 0 » en ROUGE sur un
   * dépassement : un nombre PLAUSIBLE (« j'ai tout consommé ») là où la vérité était
   * « 150 000 au-dessus », la magnitude ne vivant que dans la couleur. Et sans aucun budget la
   * variance vaut l'opposé de la dépense : l'annoncer comme un dépassement serait affirmer le
   * franchissement d'un plafond qui n'existe pas. L'état vide est donc NEUTRE et MUET — il dit
   * pourquoi il est vide, il ne félicite ni n'alarme.
   */
  const carteBudget = summary.usagePct === null
    ? {
        label: tr('Budget mensuel', 'Monthly budget', 'Presupuesto mensual', 'Budget mensile'),
        value: '—',
        sub: tr('Aucun budget défini', 'No budget set', 'Sin presupuesto definido', 'Nessun budget definito'),
        color: 'var(--text3)', icon: <BarChart2 size={18} />,
      }
    : summary.variance < 0
      ? {
          label: tr('Budget dépassé', 'Over budget', 'Presupuesto excedido', 'Budget superato'),
          value: fmt(-summary.variance),
          sub: `${tr('Sur budget mensuel', 'Of monthly budget', 'Del presupuesto mensual', 'Del budget mensile')} · ${ht}`,
          color: 'var(--danger)', icon: <BarChart2 size={18} />,
        }
      : {
          label: tr('Budget restant', 'Remaining budget', 'Presupuesto restante', 'Budget rimanente'),
          value: fmt(summary.variance),
          sub: `${tr('Sur budget mensuel', 'Of monthly budget', 'Del presupuesto mensual', 'Del budget mensile')} · ${ht}`,
          color: 'var(--acc2)', icon: <BarChart2 size={18} />,
        }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label:`${tr('Dépenses','Expenses','Gastos','Spese')} (${monthName})`, value:fmt(totalThisMonth), sub:`${monthYear} · ${ht}`, color:'var(--danger)', icon:<TrendingDown size={18} /> },
        { label:tr('En attente paiement','Pending payment','Pago pendiente','Pagamento in attesa'), value:fmt(totalPending), sub:`${pendingCount} ${tr('facture(s)','invoice(s)','factura(s)','fattura/e')} · ${ttc}`, color:'var(--acc)', icon:<Clock size={18} /> },
        { label:tr('Dépenses récurrentes','Recurring expenses','Gastos recurrentes','Spese ricorrenti'), value:recurrentCount, sub:tr('Mensuelles / abonnements','Monthly / subscriptions','Mensuales / suscripciones','Mensili / abbonamenti'), color:'var(--p2)', icon:<RefreshCw size={18} /> },
        carteBudget,
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
