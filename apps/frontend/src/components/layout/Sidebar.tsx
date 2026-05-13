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
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">H</div>
        <div className="logo-text">Haba<em>Shop</em></div>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
          style={{ background: 'rgba(20,184,166,0.15)', color: 'var(--teal)' }}>
          v2.0
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 pb-4">
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
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className="nav-badge"
                  style={item.badgeTeal
                    ? { background: 'rgba(20,184,166,0.2)', color: 'var(--teal)' }
                    : undefined}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer user */}
      <div className="mx-2 mb-2 p-3 rounded-xl" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="avatar w-8 h-8 text-xs">{user?.name?.charAt(0) || 'U'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{user?.name || 'Utilisateur'}</div>
            <div className="text-xs truncate" style={{ color: 'var(--text3)' }}>{user?.role || 'Admin'}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex-1 py-1 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--bg4)', color: 'var(--text2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {theme === 'dark' ? '☀️ Clair' : '🌙 Sombre'}
          </button>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="py-1 px-2 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}
