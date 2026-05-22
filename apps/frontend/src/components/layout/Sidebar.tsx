import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useConfig, t } from '@/stores/appStore'
import {
  LayoutDashboard, ShoppingCart, Package, Archive, Truck, Users,
  UserCog, Calendar, Wallet, Receipt, TrendingUp, BarChart2,
  Megaphone, Bot, Target, Code2, Settings, ShieldCheck, Activity,
  Store, ChevronLeft, ChevronRight, Sun, Moon, LogOut,
  ClipboardList, Wifi,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavSection = { section: string }
type NavItem    = { path: string; key: string; Icon: LucideIcon; badge?: string; badgeTeal?: boolean }
type NavEntry   = NavSection | NavItem

const NAV: NavEntry[] = [
  { section: 'Principal' },
  { path: '/app/dashboard', key: 'nav_dashboard', Icon: LayoutDashboard },
  { path: '/app/pos',       key: 'nav_pos',       Icon: ShoppingCart },
  { path: '/app/stock',     key: 'nav_stock',     Icon: Archive },
  { section: 'Gestion' },
  { path: '/app/customers', key: 'nav_customers', Icon: Users },
  { path: '/app/suppliers', key: 'nav_suppliers', Icon: Truck },
  { path: '/app/orders',    key: 'nav_orders',    Icon: ClipboardList, badge: '4' },
  { section: 'RH & Planning' },
  { path: '/app/hr',        key: 'nav_hr',        Icon: UserCog },
  { path: '/app/planning',  key: 'nav_planning',  Icon: Calendar },
  { path: '/app/payroll',   key: 'nav_payroll',   Icon: Wallet },
  { section: 'Analyse' },
  { path: '/app/reports',   key: 'nav_reports',   Icon: BarChart2 },
  { path: '/app/forecasts', key: 'nav_forecasts', Icon: TrendingUp },
  { path: '/app/expenses',  key: 'nav_expenses',  Icon: Receipt },
  { path: '/app/goals',     key: 'nav_goals',     Icon: Target },
  { path: '/app/marketing', key: 'nav_marketing', Icon: Megaphone },
  { path: '/app/ai',        key: 'nav_ai',        Icon: Bot, badge: 'AI' },
  { section: 'Système' },
  { path: '/app/settings',  key: 'nav_settings',  Icon: Settings },
  { path: '/app/api-docs',  key: 'nav_api_docs',  Icon: Code2 },
  { section: 'Administration' },
  { path: '/app/users',     key: 'nav_users',     Icon: ShieldCheck },
  { path: '/app/activity',  key: 'nav_activity',  Icon: Activity, badge: '12', badgeTeal: true },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme, sidebarCollapsed, cashierOpen, updateConfig, lang } = useConfig()
  void lang
  const navigate = useNavigate()
  const collapsed = sidebarCollapsed

  return (
    <div
      id="sidebar"
      style={{
        width: collapsed ? 60 : 'var(--sidebar)',
        transition: 'width .2s var(--ease)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="sidebar-logo"
        style={{ justifyContent: collapsed ? 'center' : undefined, paddingLeft: collapsed ? 0 : undefined }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
          background: 'linear-gradient(135deg,#6C47FF,#A991FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, color: '#fff', fontSize: 17,
          boxShadow: '0 4px 14px rgba(108,71,255,.45)',
          animation: 'none',
        }}>H</div>
        {!collapsed && (
          <div>
            <div style={{
              fontSize: 16, fontWeight: 900, letterSpacing: '-.3px',
              background: 'linear-gradient(135deg,#A991FF,#7C6FF0)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>HabaShop</div>
            <div style={{
              fontSize: 9, color: 'var(--text4)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.5px',
            }}>
              {lang === 'fr' ? 'Gestion commerciale'
                : lang === 'en' ? 'Commerce Suite'
                : lang === 'es' ? 'Suite comercial'
                : 'Suite commerciale'}
            </div>
          </div>
        )}
      </div>

      {/* Caisse ouverte indicator */}
      {cashierOpen && !collapsed && (
        <div style={{
          margin: '8px 12px', padding: '7px 12px', borderRadius: 10,
          background: 'rgba(0,208,132,.08)', border: '1px solid rgba(0,208,132,.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acc2)', boxShadow: '0 0 6px var(--acc2)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc2)' }}>
            {lang === 'fr' ? 'Caisse ouverte' : 'Till open'}
          </span>
          <button
            onClick={() => navigate('/app/pos')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--acc2)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font)', padding: 0 }}
          >
            {lang === 'fr' ? 'Fermer →' : 'Close →'}
          </button>
        </div>
      )}

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
              style={collapsed ? { justifyContent: 'center', padding: '8px 0', width: '100%', margin: '1px 0' } : undefined}
            >
              <div className="nav-icon-wrap">
                <Icon size={15} />
              </div>
              {!collapsed && <span style={{ flex: 1 }}>{t(item.key)}</span>}
              {!collapsed && item.badge && (
                <span
                  className="nav-badge"
                  style={item.badgeTeal
                    ? { background: 'rgba(108,71,255,.2)', color: 'var(--p3)', boxShadow: 'none' }
                    : item.badge === 'AI'
                      ? { background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)', color: '#fff' }
                      : undefined}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}

        {/* Admin Panel (SUPER_ADMIN only) */}
        {user?.role === 'SUPER_ADMIN' && (
          <button
            type="button"
            className="nav-item"
            onClick={() => navigate('/admin')}
            style={{
              background: 'none', border: '1px solid transparent', width: collapsed ? '100%' : 'calc(100% - 16px)',
              cursor: 'pointer',
              ...(collapsed ? { justifyContent: 'center', padding: '8px 0', margin: '1px 0' } : {}),
            }}
            title={collapsed ? 'Admin Panel' : undefined}
            aria-label="Admin Panel"
          >
            <div className="nav-icon-wrap">
              <Store size={15} />
            </div>
            {!collapsed && <span style={{ flex: 1 }}>Admin Panel</span>}
          </button>
        )}
      </nav>

      {/* Footer */}
      <div
        className="sidebar-footer"
        style={collapsed ? { flexDirection: 'column', gap: 8, padding: '8px 0', alignItems: 'center' } : undefined}
      >
        {/* Avatar with online indicator */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6C47FF,#A991FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff', fontSize: 13,
            boxShadow: '0 2px 8px rgba(108,71,255,.35)',
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'N'}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 9, height: 9, borderRadius: '50%',
            background: 'var(--acc2)',
            border: '2px solid var(--bg2)',
            boxShadow: '0 0 5px var(--acc2)',
          }} />
        </div>

        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.name || 'Nelson'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <Wifi size={9} style={{ color: 'var(--acc2)' }} />
              <span style={{ fontSize: 10, color: 'var(--acc2)', fontWeight: 600 }}>
                {lang === 'fr' ? 'En ligne' : 'Online'}
              </span>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => updateConfig({ sidebarCollapsed: !collapsed })}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text4)', display: 'flex', alignItems: 'center', transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text4)'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => updateConfig({ theme: theme === 'dark' ? 'light' : 'dark' })}
          aria-label="Toggle theme"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text4)', transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text4)'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Logout */}
        {!collapsed && (
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text4)', display: 'flex', alignItems: 'center', transition: 'color .15s' }}
            onClick={() => { logout(); navigate('/login') }}
            title={lang === 'fr' ? 'Déconnexion' : 'Sign out'}
            aria-label={lang === 'fr' ? 'Déconnexion' : 'Sign out'}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text4)'}
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
