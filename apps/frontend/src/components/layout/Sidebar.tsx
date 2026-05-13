import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const NAV = [
  { section: 'Principal' },
  { path: '/app/dashboard', label: 'Tableau de bord', icon: '🏠' },
  { path: '/app/pos',       label: 'Point de vente',  icon: '🛒' },
  { path: '/app/orders',    label: 'Commandes',        icon: '📦', badge: '4' },
  { section: 'Gestion' },
  { path: '/app/stock',     label: 'Stock & Produits', icon: '🗄️' },
  { path: '/app/suppliers', label: 'Fournisseurs',     icon: '🚚' },
  { path: '/app/customers', label: 'Clients',          icon: '👥' },
  { section: 'RH' },
  { path: '/app/hr',        label: 'Employés',         icon: '🧑‍💼' },
  { path: '/app/planning',  label: 'Planning',         icon: '📅' },
  { path: '/app/payroll',   label: 'Paie',             icon: '💰' },
  { path: '/app/expenses',  label: 'Dépenses',         icon: '🧾' },
  { section: 'Analyse' },
  { path: '/app/forecasts', label: 'Prévisions',       icon: '🔮' },
  { path: '/app/reports',   label: 'Rapports',         icon: '📊' },
  { path: '/app/settings',  label: 'Paramètres',       icon: '⚙️' },
  { section: 'Administration' },
  { path: '/app/users',     label: 'Utilisateurs',     icon: '🔐' },
  { path: '/app/activity',  label: 'Journal activités',icon: '📋', badge: '12', badgeTeal: true },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useAppStore()
  const navigate = useNavigate()

  return (
    <div id="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">H</div>
        <div className="logo-text">Haba<em>Shop</em></div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {NAV.map((item, i) => {
          if ('section' in item) {
            return <div key={i} className="nav-section">{item.section}</div>
          }
          return (
            <NavLink
              key={item.path}
              to={item.path!}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span className="nav-badge" style={item.badgeTeal ? { background: 'rgba(91,78,232,.2)', color: 'var(--p2)' } : undefined}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
        <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name">{user?.name || 'Utilisateur'}</div>
          <div className="user-role">{user?.role || 'Admin'}</div>
        </div>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}
          title="Changer le thème"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <span
          style={{ color: 'var(--text2)', cursor: 'pointer', fontSize: 16, padding: 4 }}
          onClick={() => { logout(); navigate('/login') }}
          title="Déconnexion"
        >⏻</span>
      </div>
    </div>
  )
}
