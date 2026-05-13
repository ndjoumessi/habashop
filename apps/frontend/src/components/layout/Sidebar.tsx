import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  Truck, Users, BarChart3, UserCheck, Calendar,
  Wallet, Receipt, TrendingUp, Shield, Activity,
  Bell, Settings, ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'principal' },
  { path: '/pos', label: 'Caisse (POS)', icon: ShoppingCart, section: 'principal' },
  { path: '/stock', label: 'Stock', icon: Package, section: 'principal' },
  { path: '/orders', label: 'Commandes', icon: ClipboardList, section: 'ventes' },
  { path: '/suppliers', label: 'Fournisseurs', icon: Truck, section: 'ventes' },
  { path: '/customers', label: 'Clients', icon: Users, section: 'ventes' },
  { path: '/reports', label: 'Rapports', icon: BarChart3, section: 'ventes' },
  { path: '/hr', label: 'Équipe RH', icon: UserCheck, section: 'rh' },
  { path: '/planning', label: 'Planning', icon: Calendar, section: 'rh' },
  { path: '/payroll', label: 'Paie', icon: Wallet, section: 'rh' },
  { path: '/expenses', label: 'Dépenses', icon: Receipt, section: 'finance' },
  { path: '/forecasts', label: 'Prévisions', icon: TrendingUp, section: 'finance' },
  { path: '/users', label: 'Utilisateurs', icon: Shield, section: 'admin' },
  { path: '/activity', label: 'Activité', icon: Activity, section: 'admin' },
  { path: '/notifications', label: 'Notifications', icon: Bell, section: 'admin' },
  { path: '/settings', label: 'Paramètres', icon: Settings, section: 'admin' },
]

const SECTIONS: Record<string, string> = {
  principal: 'Principal',
  ventes: 'Ventes & Clients',
  rh: 'Ressources Humaines',
  finance: 'Finance',
  admin: 'Administration',
}

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const groupedItems = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {} as Record<string, typeof NAV_ITEMS>)

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col transition-all duration-300 z-50"
      style={{
        width: sidebarOpen ? 'var(--sidebar)' : '72px',
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--p), var(--p2))' }}
        >
          H
        </div>
        {sidebarOpen && (
          <div>
            <div className="font-black text-base" style={{ color: 'var(--text)', letterSpacing: '-0.5px' }}>
              Haba<span style={{ color: 'var(--p)' }}>Shop</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--text3)' }}>v2.0</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {Object.entries(groupedItems).map(([section, items]) => (
          <div key={section} className="mb-4">
            {sidebarOpen && (
              <div className="px-2 mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                {SECTIONS[section]}
              </div>
            )}
            {items.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-2 py-2 rounded-lg mb-0.5 transition-all text-sm font-medium',
                    isActive
                      ? 'text-white'
                      : 'hover:text-white'
                  )
                }
                style={({ isActive }) => ({
                  background: isActive
                    ? 'linear-gradient(135deg, var(--p), var(--p2))'
                    : 'transparent',
                  color: isActive ? '#fff' : 'var(--text2)',
                  boxShadow: isActive ? '0 4px 14px rgba(91,78,232,0.35)' : 'none',
                })}
                title={!sidebarOpen ? label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      {sidebarOpen && user && (
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 p-2 rounded-lg mb-1" style={{ background: 'var(--bg3)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--p), var(--p2))' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{user.name}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text3)' }}>{user.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: 'var(--danger)' }}
          >
            <LogOut size={14} />
            <span>Déconnexion</span>
          </button>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10"
        style={{
          background: 'var(--p)',
          border: '2px solid var(--bg)',
          color: '#fff',
        }}
      >
        {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </aside>
  )
}
