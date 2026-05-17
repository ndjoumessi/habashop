import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useConfig, t } from '@/stores/appStore'

type NavSection = { section: string }
type NavItem    = { path: string; key: string; icon: string; badge?: string; badgeTeal?: boolean }
type NavEntry   = NavSection | NavItem

const NAV: NavEntry[] = [
  { section: 'Principal' },
  { path: '/app/dashboard', key: 'nav_dashboard', icon: '🏠' },
  { path: '/app/pos',       key: 'nav_pos',       icon: '🛒' },
  { path: '/app/orders',    key: 'nav_orders',    icon: '📦', badge: '4' },
  { section: 'Gestion' },
  { path: '/app/stock',     key: 'nav_stock',     icon: '🗄️' },
  { path: '/app/suppliers', key: 'nav_suppliers', icon: '🚚' },
  { path: '/app/customers', key: 'nav_customers', icon: '👥' },
  { section: 'RH' },
  { path: '/app/hr',        key: 'nav_hr',        icon: '🧑‍💼' },
  { path: '/app/planning',  key: 'nav_planning',  icon: '📅' },
  { path: '/app/payroll',   key: 'nav_payroll',   icon: '💰' },
  { path: '/app/expenses',  key: 'nav_expenses',  icon: '🧾' },
  { section: 'Analyse' },
  { path: '/app/forecasts', key: 'nav_forecasts', icon: '🔮' },
  { path: '/app/reports',   key: 'nav_reports',   icon: '📊' },
  { path: '/app/settings',  key: 'nav_settings',  icon: '⚙️' },
  { section: 'Administration' },
  { path: '/app/users',     key: 'nav_users',     icon: '🔐' },
  { path: '/app/activity',  key: 'nav_activity',  icon: '📋', badge: '12', badgeTeal: true },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme, sidebarCollapsed, updateConfig, lang } = useConfig()
  void lang
  const navigate = useNavigate()

  const collapsed = sidebarCollapsed

  return (
    <div
      id="sidebar"
      style={{
        width: collapsed ? 60 : 'var(--sidebar)',
        transition: 'width .2s',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div className="sidebar-logo" style={{ justifyContent: collapsed ? 'center' : undefined }}>
        <div className="logo-icon">H</div>
        {!collapsed && <div className="logo-text">Haba<em>Shop</em></div>}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {NAV.map((item, i) => {
          if ('section' in item) {
            return collapsed ? null : (
              <div key={i} className="nav-section">{item.section}</div>
            )
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? t(item.key) : undefined}
              style={collapsed ? { justifyContent: 'center', padding: '8px 0' } : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span style={{ flex: 1 }}>{t(item.key)}</span>}
              {!collapsed && item.badge && (
                <span className="nav-badge" style={item.badgeTeal ? { background: 'rgba(91,78,232,.2)', color: 'var(--p2)' } : undefined}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Admin Panel (SUPER_ADMIN only) */}
      {user?.role === 'SUPER_ADMIN' && (
        <div
          className="nav-item"
          onClick={() => navigate('/admin')}
          style={{ cursor: 'pointer', ...(collapsed ? { justifyContent: 'center', padding: '8px 0' } : {}) }}
          title={collapsed ? 'Admin Panel' : undefined}
        >
          <span className="nav-icon">🏪</span>
          {!collapsed && <span style={{ flex: 1 }}>Admin Panel</span>}
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer" style={collapsed ? { flexDirection: 'column', gap: 8, padding: '8px 0', alignItems: 'center' } : undefined}>
        <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
        {!collapsed && (
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.name || 'Utilisateur'}</div>
            <div className="user-role">{user?.role || 'Admin'}</div>
          </div>
        )}
        <button
          onClick={() => updateConfig({ sidebarCollapsed: !collapsed })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 4, color: 'var(--text3)' }}
          title={collapsed ? 'Étendre' : 'Réduire'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
        <button
          onClick={() => updateConfig({ theme: theme === 'dark' ? 'light' : 'dark' })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}
          title="Changer le thème"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {!collapsed && (
          <span
            style={{ color: 'var(--text2)', cursor: 'pointer', fontSize: 16, padding: 4 }}
            onClick={() => { logout(); navigate('/login') }}
            title="Déconnexion"
          >⏻</span>
        )}
      </div>
    </div>
  )
}
