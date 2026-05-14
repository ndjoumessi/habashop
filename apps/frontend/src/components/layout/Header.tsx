import { useLocation } from 'react-router-dom'
import { useConfig, t } from '@/stores/appStore'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import CurrencyBadge from '@/components/ui/CurrencyBadge'

const TITLE_KEYS: Record<string, string> = {
  '/app/dashboard': 'nav_dashboard',
  '/app/pos':       'nav_pos',
  '/app/stock':     'nav_stock',
  '/app/orders':    'nav_orders',
  '/app/suppliers': 'nav_suppliers',
  '/app/customers': 'nav_customers',
  '/app/reports':   'nav_reports',
  '/app/hr':        'nav_hr',
  '/app/planning':  'nav_planning',
  '/app/payroll':   'nav_payroll',
  '/app/expenses':  'nav_expenses',
  '/app/forecasts': 'nav_forecasts',
  '/app/users':     'nav_users',
  '/app/activity':  'nav_activity',
  '/app/settings':  'nav_settings',
}

export default function Header() {
  const location = useLocation()
  const { lang } = useConfig() // subscribe to store so t() re-evaluates on lang change
  void lang // consumed for reactivity

  const titleKey = TITLE_KEYS[location.pathname]
  const title = titleKey ? t(titleKey) : 'HabaShop'

  return (
    <div className="topbar">
      <div className="page-title">{title}</div>
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input type="text" placeholder="Rechercher produit, client…" />
      </div>
      <LanguageSwitcher />
      <CurrencyBadge />
      <button className="topbar-btn">＋ {t('btn_new')}</button>
      <div className="icon-btn">
        🔔<div className="notif-dot" />
      </div>
    </div>
  )
}
