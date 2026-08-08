import { useConfig, useFormatAmount } from '@/stores/appStore'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { Settings } from 'lucide-react'
import { CATEGORIES, CatPill } from './expensesShared'
import type { Category } from './expensesShared'
import type { BudgetSummary } from './budgetSummary'

interface Props {
  budgets: Record<Category, number>
  /**
   * ⚠️ Le résumé COMPLET, calculé une fois par l'appelant. Ce composant recevait
   * `catSpent` + `totalBudget` + `budgetLeft` et refaisait DEUX sommes lui-même :
   * c'est là que la divergence naissait. Il n'additionne plus rien.
   */
  summary: BudgetSummary
  /** Période décrite par les chiffres, DITE à l'écran (« Août 2026 »). */
  monthLabel: string
  onEditBudgets: () => void
}

export default function ExpensesBudget({ budgets, summary, monthLabel, onEditBudgets }: Props) {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const tr = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const { spentByCategory: catSpent, totalBudget, totalSpent, variance: budgetLeft, usagePct } = summary

  return (
    <div className="space-y-4">
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onEditBudgets}>
          <Settings size={13} /> {tr('Modifier les budgets','Edit budgets','Editar presupuestos','Modifica budget')}
        </button>
      </div>

      {/* ⚠️ L'ÉTAT VIDE SE DIT. Huit cartes à 0 % sont EXACTES mais se lisent « mes
          dépenses ont disparu » — d'autant plus qu'avant ce correctif, elles montraient
          tout l'historique. On constate, sans féliciter : ni coche, ni couleur de
          succès, ni « budget respecté ». Trois états, jamais deux. */}
      {totalSpent === 0 && (
        <div style={{
          padding:'10px 14px', borderRadius:'var(--r-sm)',
          background:'var(--bg2)', border:'1px solid var(--border)',
          color:'var(--text3)', fontSize:'var(--fs-label)',
        }}>
          {tr(
            `Aucune dépense enregistrée en ${monthLabel}. Les budgets ci-dessous portent sur ce mois.`,
            `No expense recorded in ${monthLabel}. The budgets below cover this month.`,
            `Ningún gasto registrado en ${monthLabel}. Los presupuestos siguientes cubren este mes.`,
            `Nessuna spesa registrata a ${monthLabel}. I budget seguenti riguardano questo mese.`,
          )}
        </div>
      )}

      {/* ⚠️ Aucun budget posé → AUCUNE carte ne se rend (`budgets[cat] > 0`), et un
          onglet vide sans explication se lit comme un écran cassé. On dit ce qui
          manque et par où le poser — l'état vide se constate et s'oriente, il ne
          se félicite pas et ne se laisse pas deviner. */}
      {totalBudget === 0 && (
        <div style={{
          padding:'14px 16px', borderRadius:'var(--r-md)',
          background:'var(--bg2)', border:'1px dashed var(--border2)',
          color:'var(--text2)', fontSize:'var(--fs-sm)',
        }}>
          {tr(
            'Aucun budget défini pour cette boutique. Utilisez « Modifier les budgets » pour poser vos montants mensuels.',
            'No budget set for this shop. Use “Edit budgets” to enter your monthly amounts.',
            'Ningún presupuesto definido para esta tienda. Use «Editar presupuestos» para introducir sus importes mensuales.',
            'Nessun budget definito per questo negozio. Usa «Modifica budget» per inserire i tuoi importi mensili.',
          )}
        </div>
      )}

      <ResponsiveGrid min={160} gap={12}>
        {CATEGORIES.filter(cat => budgets[cat] > 0).map(cat => {
          const spent = catSpent[cat] ?? 0
          const budget = budgets[cat]
          const pct = Math.min(100, Math.round(spent / budget * 100))
          const over = spent > budget
          const barColor = pct < 70 ? 'var(--acc2)' : pct < 90 ? 'var(--acc)' : 'var(--danger)'
          return (
            <div key={cat} style={{
              background:'var(--bg2)', border:'1px solid var(--border2)',
              borderRadius:12, padding:16, transition:'all .15s ease',
            }}
              onMouseEnter={ev => { const el = ev.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--sh-sm)' }}
              onMouseLeave={ev => { const el = ev.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                {/* Pill catégorie (teintes de la palette conservées — seule la forme est pill) */}
                <CatPill cat={cat} lang={lang} />
                {over && (
                  <span className="badge badge-red">{tr('Dépassé !','Over budget!','¡Excedido!','Superato!')}</span>
                )}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'var(--fs-label)' }}>
                <span style={{ color:'var(--text3)' }}>{tr('Budget','Budget','Presupuesto','Budget')} : <strong style={{ color:'var(--text2)' }}>{fmt(budget)}</strong></span>
                <span style={{ color:'var(--text3)' }}>{tr('Réel','Actual','Real','Reale')} : <strong style={{ color: over ? 'var(--danger)' : 'var(--text)' }}>{fmt(spent)}</strong></span>
              </div>
              <div style={{ height:9, background:'var(--bg4)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                <div style={{
                  width:`${pct}%`, height:'100%',
                  background: barColor,
                  borderRadius:99, transition:'width .4s',
                }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--fs-label)' }}>
                <span style={{ fontWeight:'var(--fw-semibold)', color: barColor, fontFamily:'var(--mono)' }}>{pct} %</span>
                <span style={{ color: over ? 'var(--danger)' : 'var(--acc2)', fontWeight:'var(--fw-regular)' }}>
                  {over ? `${tr('Dépassé de','Over by','Excedido en','Superato di')} ${fmt(spent - budget)}` : `${tr('Restant','Remaining','Restante','Rimanente')} : ${fmt(budget - spent)}`}
                </span>
              </div>
            </div>
          )
        })}
      </ResponsiveGrid>

      {/* Résumé total */}
      <div style={{
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:12, padding:16,
      }}>
        <div className="panel-head" style={{ marginBottom:16 }}>
          {/* ⚠️ La période est NOMMÉE. « Résumé mensuel » sans son mois laissait le
              lecteur supposer la période — et il supposait « tout », ce qui était
              justement ce que le calcul faisait. Un chiffre sans son périmètre
              n'est pas une mesure. */}
          <span className="panel-title">
            {lang === 'en' ? 'Monthly summary' : lang === 'es' ? 'Resumen mensual' : lang === 'it' ? 'Riepilogo mensile' : 'Résumé mensuel'}
            {' — '}<span style={{ color:'var(--text3)', fontWeight:'var(--fw-regular)' }}>{monthLabel}</span>
          </span>
        </div>
        {/* Total dépensé — mis en valeur (pattern total POS : encart bg2, 24px mono) */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'12px 14px', marginBottom:12,
          background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8,
        }}>
          <span style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-bold)', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px' }}>
            {tr('Total dépensé','Total spent','Total gastado','Totale speso')}
          </span>
          <span style={{ fontSize:'var(--fs-display)', fontWeight:'var(--fw-bold)', color:'var(--text)', fontFamily:'var(--mono)', letterSpacing:'-.5px' }}>
            {fmt(totalSpent)}
          </span>
        </div>
        {[
          { label:tr('Budget total mensuel','Total monthly budget','Presupuesto total mensual','Budget mensile totale'),  value:fmt(totalBudget),            color:'var(--text2)' },
          { label:tr('Écart','Variance','Variación','Variazione'),                  value:fmt(Math.abs(budgetLeft)),   color: budgetLeft >= 0 ? 'var(--acc2)' : 'var(--danger)', prefix: budgetLeft >= 0 ? '▲ +' : '▼ -' },
          // ⚠️ Sans budget, PAS de pourcentage : `spent / 0 * 100` rendait `Infinity`,
          // affiché « Infinity % » à tout commerçant qui remettait ses budgets à zéro.
          { label:tr("Taux d'utilisation",'Usage rate','Tasa de uso','Tasso di utilizzo'),    value: usagePct === null ? '—' : `${usagePct} %`, color: 'var(--p2)' },
        ].map(r => (
          <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:'var(--fs-sm)', color:'var(--text3)' }}>{r.label}</span>
            <span style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)', color:r.color, fontFamily:'var(--mono)' }}>
              {(r as { prefix?: string }).prefix ?? ''}{r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
