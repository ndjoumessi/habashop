import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import LogoMark from '@/components/ui/LogoMark'
import { useAuthStore, canAccess } from '@/stores/authStore'
import { useConfig, useCashierIsOpen, t } from '@/stores/appStore'
import { stockTransfersApi } from '@/lib/api'
import {
  LayoutDashboard, ShoppingCart, Archive, Truck, Users,
  UserCog, Calendar, Wallet, Receipt, TrendingUp, BarChart2,
  Megaphone, Bot, Target, Code2, Settings, ShieldCheck, Activity,
  Store, ChevronLeft, ChevronRight, Sun, Moon, LogOut,
  ClipboardList, Wifi, Plug, Lock, RefreshCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import TenantSwitcher from './TenantSwitcher'

type NavSection = { sectionKey: string }
type NavItem    = { path: string; key: string; Icon: LucideIcon; badge?: string; badgeTag?: boolean }
type NavEntry   = NavSection | NavItem

// Zone QUOTIDIENNE : les 2-3 écrans ouverts chaque jour. Épinglée en tête et
// rendue visuellement distincte (bloc surélevé) — role-filtrée comme le reste.
const DAILY: NavItem[] = [
  { path: '/app/pos',       key: 'nav_pos',       Icon: ShoppingCart },
  { path: '/app/dashboard', key: 'nav_dashboard', Icon: LayoutDashboard },
  { path: '/app/stock',     key: 'nav_stock',     Icon: Archive },
]

// Refonte : 7 groupes → 4 groupes d'INTENTION (Vendre / Gérer / Analyser /
// Configurer). Système + Administration fusionnés dans « Configurer » (fin du
// recouvrement Gestion/Système/Administration). Badges factices supprimés
// (Commandes « 4 », Activité « 12 ») ; seul Stock garde un badge de données réelles.
const NAV: NavEntry[] = [
  { sectionKey: 'nav_sec_sell' },
  { path: '/app/customers',     key: 'nav_customers',     Icon: Users },
  { path: '/app/subscriptions', key: 'nav_subscriptions', Icon: RefreshCw },
  { path: '/app/marketing',     key: 'nav_marketing',     Icon: Megaphone },
  { sectionKey: 'nav_sec_manage' },
  { path: '/app/suppliers',     key: 'nav_suppliers',     Icon: Truck },
  { path: '/app/orders',        key: 'nav_orders',        Icon: ClipboardList },
  { path: '/app/hr',            key: 'nav_hr',            Icon: UserCog },
  { path: '/app/planning',      key: 'nav_planning',      Icon: Calendar },
  { path: '/app/payroll',       key: 'nav_payroll',       Icon: Wallet },
  { sectionKey: 'nav_sec_analyze' },
  { path: '/app/expenses',  key: 'nav_expenses',  Icon: Receipt },
  { path: '/app/reports',   key: 'nav_reports',   Icon: BarChart2 },
  { path: '/app/forecasts', key: 'nav_forecasts', Icon: TrendingUp },
  { path: '/app/goals',     key: 'nav_goals',     Icon: Target },
  { sectionKey: 'nav_sec_configure' },
  { path: '/app/ai',            key: 'nav_ai',            Icon: Bot, badge: 'AI', badgeTag: true },
  { path: '/app/settings',      key: 'nav_settings',      Icon: Settings },
  { path: '/app/integrations',  key: 'nav_integrations',  Icon: Plug },
  { path: '/app/api-docs',      key: 'nav_api_docs',      Icon: Code2 },
  { path: '/app/users',         key: 'nav_users',         Icon: ShieldCheck },
  { path: '/app/activity',      key: 'nav_activity',      Icon: Activity },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const tenants = useAuthStore(s => s.tenants)
  const activeTenantId = useAuthStore(s => s.activeTenantId)
  const { theme, sidebarCollapsed, updateConfig, lang } = useConfig()
  void lang
  const navigate = useNavigate()
  const collapsed = sidebarCollapsed
  const canPos = canAccess(user?.role, 'pos')
  const cashierIsOpen = useCashierIsOpen() // source unique de vérité (cashierOpen exclu de partialize)

  // Badge Stock : transferts reçus en attente de MA confirmation (multi-boutiques, MANAGER+).
  const [pendingTransfers, setPendingTransfers] = useState(0)
  const isManagerPlus = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(String(user?.role).toUpperCase())
  useEffect(() => {
    if (tenants.length <= 1 || !isManagerPlus) { setPendingTransfers(0); return }
    stockTransfersApi.list('pending')
      .then(list => setPendingTransfers(list.filter(t => t.toTenantId === activeTenantId).length))
      .catch(() => {})
  }, [tenants.length, activeTenantId, isManagerPlus])

  return (
    <div
      id="sidebar"
      style={{
        width: collapsed ? 64 : 'var(--sidebar)',
        transition: 'width .2s var(--ease)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Brand header */}
      <div
        className="sidebar-logo"
        style={{ justifyContent: collapsed ? 'center' : undefined, paddingLeft: collapsed ? 0 : undefined }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)', flexShrink: 0,
          overflow: 'hidden', boxShadow: 'var(--sh-p)', display: 'flex',
        }}><LogoMark /></div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 'var(--fw-bold)', letterSpacing: '-.3px',
              background: 'linear-gradient(135deg,var(--p2),var(--p))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>HabaShop</div>
            <div style={{
              fontSize: 'var(--fs-caption)', color: 'var(--text4)', fontWeight: 'var(--fw-semibold)',
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

      {/* Switcher multi-boutiques (affiché seulement si > 1 boutique) */}
      <TenantSwitcher collapsed={collapsed} />

      {/* Caisse — état proéminent (action centrale du commerçant) */}
      {canPos && cashierIsOpen && (
        collapsed ? (
          <div title={lang === 'en' ? 'Till open' : lang === 'es' ? 'Caja abierta' : lang === 'it' ? 'Cassa aperta' : 'Caisse ouverte'}
            style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--acc2)', boxShadow: '0 0 8px var(--acc2)', animation: 'pulse 2s infinite' }} />
          </div>
        ) : (
          <div style={{
            margin: '10px 12px 4px', padding: '8px 12px', borderRadius: 'var(--r-md)',
            background: 'var(--c-green-bg2)', border: '1px solid var(--c-green-border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acc2)', boxShadow: '0 0 6px var(--acc2)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--acc2)' }}>
              {lang === 'en' ? 'Till open' : lang === 'es' ? 'Caja abierta' : lang === 'it' ? 'Cassa aperta' : 'Caisse ouverte'}
            </span>
            <button
              onClick={() => navigate('/app/pos')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--acc2)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', fontFamily: 'var(--font)', padding: 0 }}
            >
              {lang === 'en' ? 'Close →' : lang === 'es' ? 'Cerrar →' : lang === 'it' ? 'Chiudi →' : 'Fermer →'}
            </button>
          </div>
        )
      )}
      {canPos && !cashierIsOpen && !collapsed && (
        <button
          onClick={() => navigate('/app/pos')}
          style={{
            margin: '10px 12px 4px', padding: '8px 12px', borderRadius: 'var(--r-md)', width: 'calc(100% - 24px)',
            background: 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font)',
          }}
        >
          <Lock size={12} style={{ color: 'var(--text4)', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text3)' }}>
            {lang === 'en' ? 'Till closed' : lang === 'es' ? 'Caja cerrada' : lang === 'it' ? 'Cassa chiusa' : 'Caisse fermée'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', color: 'var(--p3)' }}>
            {lang === 'en' ? 'Open →' : lang === 'es' ? 'Abrir →' : lang === 'it' ? 'Apri →' : 'Ouvrir →'}
          </span>
        </button>
      )}

      {/* Navigation (filtered by role) */}
      <nav role="navigation" aria-label={lang === 'en' ? 'Main navigation' : lang === 'es' ? 'Navegación principal' : lang === 'it' ? 'Navigazione principale' : 'Navigation principale'} style={{ flex: 1, overflowY: 'auto', padding: '6px 0 8px' }}>
        {/* Zone QUOTIDIENNE épinglée — actions du jour, visuellement distinctes */}
        {(() => {
          const daily = DAILY.filter(it => canAccess(user?.role, it.path.split('/').pop() || ''))
          if (daily.length === 0) return null
          return (
            <div className="nav-daily" style={{ margin: collapsed ? '2px 8px 6px' : '2px 10px 8px', padding: collapsed ? '4px' : '6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {!collapsed && (
                <div className="nav-section" style={{ padding: '2px 6px 4px' }}>
                  <span>{t('nav_sec_daily')}</span>
                </div>
              )}
              {daily.map(item => {
                const { Icon } = item
                const dynBadge = item.path === '/app/stock' && pendingTransfers > 0 ? String(pendingTransfers) : undefined
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
                    aria-label={t(item.key)}
                    title={collapsed ? t(item.key) : undefined}
                  >
                    <div className="nav-icon-wrap"><Icon size={18} /></div>
                    {!collapsed && <span className="nav-label" style={{ fontWeight: 'var(--fw-semibold)' }}>{t(item.key)}</span>}
                    {!collapsed && dynBadge && <span className="nav-badge">{dynBadge}</span>}
                    {collapsed && dynBadge && <span className="nav-dot" />}
                  </NavLink>
                )
              })}
            </div>
          )
        })()}
        {(() => {
          // Walk NAV: only emit a section header if at least one following item
          // (before the next section) is allowed by the current role.
          const out: NavEntry[] = []
          let pendingSection: NavSection | null = null
          for (const entry of NAV) {
            if ('sectionKey' in entry) { pendingSection = entry; continue }
            const slug = entry.path.split('/').pop() || ''
            if (!canAccess(user?.role, slug)) continue
            if (pendingSection) { out.push(pendingSection); pendingSection = null }
            out.push(entry)
          }
          return out
        })().map((item, i) => {
          if ('sectionKey' in item) {
            // Mode réduit : pas de libellé → simple filet séparateur (sauf tout en haut)
            return collapsed
              ? (i === 0 ? null : <div key={`s-${i}`} className="nav-section-rule" />)
              : (
                <div key={`s-${i}`} className="nav-section">
                  <span>{t(item.sectionKey)}</span>
                  <div className="nav-section-line" />
                </div>
              )
          }
          const { Icon } = item
          // Badge dynamique « transferts en attente » sur Stock (multi-boutiques).
          const dynBadge = item.path === '/app/stock' && pendingTransfers > 0 ? String(pendingTransfers) : item.badge
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
              aria-label={t(item.key)}
              title={collapsed ? t(item.key) : undefined}
            >
              <div className="nav-icon-wrap">
                <Icon size={16} />
              </div>
              {!collapsed && <span className="nav-label">{t(item.key)}</span>}
              {!collapsed && dynBadge && (
                <span className={`nav-badge${item.badgeTag ? ' tag' : ''}`}>{dynBadge}</span>
              )}
              {collapsed && dynBadge && <span className="nav-dot" />}
            </NavLink>
          )
        })}

        {/* Admin Panel — admin PLATEFORME uniquement (jamais le rôle tenant SUPER_ADMIN) */}
        {user?.isPlatformAdmin === true && (
          <button
            type="button"
            className={`nav-item${collapsed ? ' collapsed' : ''}`}
            onClick={() => navigate('/admin')}
            title={collapsed ? 'Admin Panel' : undefined}
            aria-label="Admin Panel"
          >
            <div className="nav-icon-wrap">
              <Store size={16} />
            </div>
            {!collapsed && <span className="nav-label">Admin Panel</span>}
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
            background: 'var(--grad-p)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'var(--fw-bold)', color: '#fff', fontSize: 13,
            boxShadow: 'var(--sh-p)',
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
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--acc2)', fontWeight: 'var(--fw-semibold)' }}>
                {lang === 'en' ? 'Online' : lang === 'es' ? 'En línea' : lang === 'it' ? 'Online' : 'En ligne'}
              </span>
            </div>
            {/* Identifiant de build : permet de vérifier d'un coup d'œil qu'on est
                bien sur la dernière version (et non une copie en cache). */}
            <div title={lang === 'en' ? 'Build version' : 'Version du build'}
              style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', fontFamily: 'var(--mono)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {__BUILD_ID__}
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
            title={lang === 'en' ? 'Sign out' : lang === 'es' ? 'Cerrar sesión' : lang === 'it' ? 'Disconnetti' : 'Déconnexion'}
            aria-label={lang === 'en' ? 'Sign out' : lang === 'es' ? 'Cerrar sesión' : lang === 'it' ? 'Disconnetti' : 'Déconnexion'}
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
