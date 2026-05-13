import { TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

interface KPICardProps {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ReactNode
  color?: string
}

export default function KPICard({ label, value, change, changeType = 'neutral', icon, color = 'var(--p)' }: KPICardProps) {
  return (
    <div
      className="card flex flex-col gap-3 transition-all hover:-translate-y-0.5"
      style={{ cursor: 'default' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
          {label}
        </p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
          style={{ background: `${color}22`, color }}
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-black" style={{ color: 'var(--text)', letterSpacing: '-1px' }}>
          {value}
        </p>
        {change && (
          <div className={clsx('flex items-center gap-1 mt-1 text-xs font-semibold')}>
            {changeType === 'positive' && <TrendingUp size={12} style={{ color: 'var(--acc2)' }} />}
            {changeType === 'negative' && <TrendingDown size={12} style={{ color: 'var(--danger)' }} />}
            <span style={{
              color: changeType === 'positive' ? 'var(--acc2)'
                : changeType === 'negative' ? 'var(--danger)'
                : 'var(--text3)'
            }}>
              {change}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
