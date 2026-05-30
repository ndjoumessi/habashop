import { t } from '@/stores/appStore'

interface Props {
  stats: { total: number; active: number; with2FA: number; admins: number }
}

export default function UsersKpis({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label:t('users_total'),       value:stats.total,   color:'var(--p2)'     },
        { label:t('users_active'),      value:stats.active,  color:'var(--acc2)'   },
        { label:t('users_2fa_enabled'), value:stats.with2FA, color:'var(--p3)'     },
        { label:t('users_admins'),      value:stats.admins,  color:'var(--danger)' },
      ].map(k => (
        <div key={k.label} className="kpi-card">
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
        </div>
      ))}
    </div>
  )
}
