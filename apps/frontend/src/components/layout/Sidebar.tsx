import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const NAV = [
  { section: 'Principal' },
  { path: '/dashboard', label: 'Tableau de bord', icon: '🏠' },
  { path: '/pos', label: 'Point de vente', icon: '🛒' },
  { path: '/orders', label: 'Commandes', icon: '📦', badge: '4' },
  { section: 'Gestion' },
  { path: '/stock', label: 'Stock & Produits', icon: '🗄️' },
  { path: '/suppliers', label: 'Fournisseurs', icon: '🚚' },
  { path: '/customers', label: 'Clients', icon: '👥' },
  { section: 'RH' },
  { path: '/hr', label: 'Employés', icon: '🧑‍💼' },
  { path: '/planning', label: 'Planning', icon: '📅' },
  { path: '/payroll', label: 'Paie', icon: '💰' },
  { path: '/expenses', label: 'Dépenses', icon: '🧾' },
  { section: 'Analyse' },
  { path: '/forecasts', label: 'Prévisions', icon: '🔮' },
  { path: '/reports', label: 'Rapports', icon: '📊' },
  { path: '/settings', label: 'Paramètres', icon: '⚙️' },
  { section: 'Administration' },
  { path: '/users', label: 'Utilisateurs', icon: '🔐' },
  { path: '/activity', label: 'Journal activités', icon: '📋', badge: '12', badgeStyle: { background: 'rgba(91,78,232,.2)', color: 'var(--p2)' } },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div id="sidebar">
      <div className="logo">
        <div className="logo-icon">H</div>
        <div className="logo-text">Haba<span>Shop</span></div>
      </div>

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
            <span>{item.label}</span>
            {item.badge && (
              <span className="badge" style={item.badgeStyle}>{item.badge}</span>
            )}
          </NavLink>
        )
      })}

      <div className="sidebar-footer">
        <div className="avatar" id="sbAvatar">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.name || 'Utilisateur'}</div>
          <div className="user-role">{user?.role || 'Admin'}</div>
        </div>
        <span
          style={{ color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }}
          onClick={() => { logout(); navigate('/login') }}
        >⏻</span>
      </div>
    </div>
  )
}
