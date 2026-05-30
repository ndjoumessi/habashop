import { DollarSign, Truck, CheckCircle, Package } from 'lucide-react'
import { useFormatAmount, t } from '@/stores/appStore'

interface Props { totalEngaged: number; pending: number; receivedMonth: number; drafts: number }

export default function OrdersKpis({ totalEngaged, pending, receivedMonth, drafts }: Props) {
  const fmt = useFormatAmount()
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: t('orders_engaged'),        value: fmt(totalEngaged),      color: 'var(--p2)',    hex: '#6C47FF', icon: <DollarSign  size={18} /> },
        { label: t('status_transit'),        value: String(pending),        color: 'var(--acc)',   hex: '#FF9500', icon: <Truck       size={18} /> },
        { label: t('orders_received_month'), value: String(receivedMonth),  color: 'var(--acc2)', hex: '#00D084', icon: <CheckCircle size={18} /> },
        { label: t('status_draft'),          value: String(drafts),         color: 'var(--text3)', hex: '#8888A8', icon: <Package     size={18} /> },
      ].map(k => (
        <div key={k.label} className="kpi-card" style={{
          background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
          border: `1px solid ${k.hex}28`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
          <div className="kpi-icon-w" style={{ color: k.color, background: `${k.hex}20` }}>{k.icon}</div>
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
        </div>
      ))}
    </div>
  )
}
