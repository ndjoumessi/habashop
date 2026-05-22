import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useConfig, t } from '@/stores/appStore'
import {
  LayoutDashboard, ShoppingCart, Package, Archive, Truck, Users,
  UserCog, Calendar, Wallet, Receipt, TrendingUp, BarChart2,
  Megaphone, Bot, Target, Code2, Settings, ShieldCheck, Activity,
  Store, ChevronLeft, ChevronRight, Sun, Moon, LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavSection = { section: string }
type NavItem    = { path: string; key: string; Icon: LucideIcon; badge?: string; badgeTeal?: boolean }
type NavEntry   = NavSection | NavItem

const NAV: NavEntry[] = [
  { section: 'Principal' },
  { path: '/app/dashboard', key: 'nav_dashboard', Icon: LayoutDashboard },
  { path: '/app/pos',       key: 'nav_pos',       Icon: ShoppingCart },
  { path: '/app/orders',    key: 'nav_orders',    Icon: Package, badge: '4' },
  { section: 'Gestion' },
  { path: '/app/stock',     key: 'nav_stock',     Icon: Archive },
  { path: '/app/suppliers', key: 'nav_suppliers', Icon: Truck },
  { path: '/app/customers', key: 'nav_customers', Icon: Users },
  { section: 'RH' },
  { path: '/app/hr',        key: 'nav_hr',        Icon: UserCog },
  { path: '/app/planning',  key: 'nav_planning',  Icon: Calendar },
  { path: '/app/payroll',   key: 'nav_payroll',   Icon: Wallet },
  { path: '/app/expenses',  key: 'nav_expenses',  Icon: Receipt },
  { section: 'Analyse' },
  { path: '/app/forecasts', key: 'nav_forecasts', Icon: TrendingUp },
  { path: '/app/reports',   key: 'nav_reports',   Icon: BarChart2 },
  { path: '/app/marketing', key: 'nav_marketing', Icon: Megaphone },
  { path: '/app/ai',        key: 'nav_ai',        Icon: Bot },
  { path: '/app/goals',     key: 'nav_goals',     Icon: Target },
  { path: '/app/api-docs',  key: 'nav_api_docs',  Icon: Code2 },
  { path: '/app/settings',  key: 'nav_settings',  Icon: Settings },
  { section: 'Administration' },
  { path: '/app/users',     key: 'nav_users',     Icon: ShieldCheck },
  { path: '/app/activity',  key: 'nav_activity',  Icon: Activity, badge: '12', badgeTeal: true },
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
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900, color: '#fff',
          boxShadow: '0 4px 12px rgba(108,71,255,.4)',
          flexShrink: 0,
          fontSize: 18,
        }}>H</div>
        {!collapsed && (
          <div>
            <div style={{
              fontSize: 16, fontWeight: 900, letterSpacing: '-.3px',
              background: 'linear-gradient(135deg, #A991FF, #7C6FF0)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>HabaShop</div>
            <div style={{
              fontSize: 9, color: 'var(--text3)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.5px',
            }}>
              {lang === 'fr' ? 'Gestion commerciale' : lang === 'en' ? 'Commerce Suite' : lang === 'es' ? 'Suite comercial' : 'Suite commerciale'}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav role="navigation" aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'} style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {NAV.map((item, i) => {
          if ('section' in item) {
            return collapsed ? null : (
              <div key={i} className="nav-section" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{item.section}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            )
          }
          const { Icon } = item
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? t(item.key) : undefined}
              style={collapsed ? { justifyContent: 'center', padding: '8px 0' } : undefined}
            >
              <div className="nav-icon-wrap">
                <Icon size={15} />
              </div>
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
        <button
          type="button"
          className="nav-item"
          onClick={() => navigate('/admin')}
          style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', ...(collapsed ? { justifyContent: 'center', padding: '8px 0' } : {}) }}
          title={collapsed ? 'Admin Panel' : undefined}
          aria-label="Admin Panel"
        >
          <div className="nav-icon-wrap">
            <Store size={15} />
          </div>
          {!collapsed && <span style={{ flex: 1 }}>Admin Panel</span>}
        </button>
      )}

      {/* Footer */}
      <div className="sidebar-footer" style={collapsed ? { flexDirection: 'column', gap: 8, padding: '8px 0', alignItems: 'center' } : undefined}>
        {/* Online indicator */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--acc2)',
            border: '2px solid var(--bg2)',
            boxShadow: '0 0 4px var(--acc2)',
          }} />
        </div>
        {!collapsed && (
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.name || 'Utilisateur'}</div>
            <div className="user-role">{user?.role || 'Admin'}</div>
          </div>
        )}
        <button
          onClick={() => updateConfig({ sidebarCollapsed: !collapsed })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}
          title={collapsed ? 'Étendre' : 'Réduire'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <button
          onClick={() => updateConfig({ theme: theme === 'dark' ? 'light' : 'dark' })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text3)' }}
          title="Changer le thème"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        {!collapsed && (
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}
            onClick={() => { logout(); navigate('/login') }}
            title="Déconnexion"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
