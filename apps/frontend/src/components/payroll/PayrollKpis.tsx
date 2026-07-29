import { useConfig, formatInCurrency } from '@/stores/appStore'
import { DollarSign, TrendingDown, FileText, CheckCircle } from 'lucide-react'

interface Props {
  /** ⚠️ DÉJÀ converti en devise d'affichage (somme des lignes de la table) — pas du XOF.
   *  Reconvertir ici produirait une double conversion, et un KPI qui ne correspond pas à
   *  l'addition de la colonne NET juste en dessous. */
  totalBrut: number
  totalNet: number
  generated: number
  paid: number
  totalCount: number
}

export default function PayrollKpis({ totalBrut, totalNet, generated, paid, totalCount }: Props) {
  const { lang, currency } = useConfig()
  const fmt = (v: number) => formatInCurrency(v, currency)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label:lang === 'en' ? 'Gross payroll' : lang === 'es' ? 'Nómina bruta' : lang === 'it' ? 'Massa salariale lorda' : 'Masse salariale brute', value:fmt(totalBrut),  sub:lang === 'en' ? 'All employees' : lang === 'es' ? 'Todos empleados' : lang === 'it' ? 'Tutti dipendenti' : 'Tous employés',                          color:'#6C47FF', icon:<DollarSign   size={18} /> },
        { label:lang === 'en' ? 'Net payable' : lang === 'es' ? 'Neto a pagar' : lang === 'it' ? 'Netto da pagare' : 'Net à payer',           value:fmt(totalNet),   sub:lang === 'en' ? 'After deductions' : lang === 'es' ? 'Tras deducciones' : lang === 'it' ? 'Dopo detrazioni' : 'Après retenues',                         color:'#00D084', icon:<TrendingDown size={18} />, hero:true },
        { label:lang === 'en' ? 'Payslips generated' : lang === 'es' ? 'Nóminas generadas' : lang === 'it' ? 'Buste paga generate' : 'Bulletins générés',     value:`${generated}/${totalCount}`,sub:`${totalCount - generated} ${lang === 'en' ? 'remaining' : lang === 'es' ? 'restantes' : lang === 'it' ? 'rimanenti' : 'restants'}`, color:'#F0A500', icon:<FileText     size={18} /> },
        { label:lang === 'en' ? 'Paid payslips' : lang === 'es' ? 'Nóminas pagadas' : lang === 'it' ? 'Buste paga pagate' : 'Bulletins payés',       value:`${paid}/${totalCount}`,     sub:`${totalCount - paid} ${lang === 'en' ? 'unpaid' : lang === 'es' ? 'sin pagar' : lang === 'it' ? 'non pagate' : 'non payés'}`,     color:'#00B8FF', icon:<CheckCircle  size={18} /> },
      ].map((k: { label:string; value:string; sub:string; color:string; icon:JSX.Element; hero?:boolean }) => (
        <div key={k.label} className="kpi-card" style={{ background:`linear-gradient(135deg,${k.color}18,${k.color}06)`, border:`1px solid ${k.color}28` }}>
          <div className="kpi-icon-w" style={{ color:k.color, background:`${k.color}20` }}>{k.icon}</div>
          <div className="kpi-label">{k.label}</div>
          {/* « Net à payer » = KPI héros : valeur 24px (vs 20px) */}
          <div className="kpi-value" style={{ color:k.color, fontSize:k.hero ? 24 : 20 }}>{k.value}</div>
          <div className="kpi-sub">{k.sub}</div>
        </div>
      ))}
    </div>
  )
}
