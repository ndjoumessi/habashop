import { useState, useRef, useEffect } from 'react'
import { useAuthStore, getLandingForRole } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import { Store, ChevronDown, Check, Loader2 } from 'lucide-react'

/**
 * Sélecteur de boutique active (multi-boutiques). Affiché sous le logo dans la
 * sidebar UNIQUEMENT si l'user a > 1 boutique. Le choix bascule le JWT puis
 * recharge l'app (refetch complet, pas de TanStack Query).
 */
export default function TenantSwitcher({ collapsed }: { collapsed: boolean }) {
  const { i } = useI18n()
  const { tenants, activeTenantId, switchTenant, user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  // Pas de switcher si une seule boutique (ou aucune).
  if (tenants.length <= 1) return null

  const active = tenants.find(t => t.id === activeTenantId) ?? tenants[0]

  const choose = async (tenantId: string) => {
    if (tenantId === activeTenantId) { setOpen(false); return }
    setPending(tenantId)
    try {
      await switchTenant(tenantId)
      window.location.assign(getLandingForRole(user?.role))
    } catch {
      setPending(null)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', margin: collapsed ? '8px auto' : '8px 12px 4px', width: collapsed ? 'auto' : 'calc(100% - 24px)' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={i('Changer de boutique', 'Switch shop', 'Cambiar tienda', 'Cambia negozio')}
        title={collapsed ? active.name : undefined}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: collapsed ? 38 : '100%', height: collapsed ? 38 : 'auto',
          padding: collapsed ? 0 : '8px 10px', borderRadius: 'var(--r-md)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'var(--bg3)', border: '1px solid var(--border)',
          cursor: 'pointer', fontFamily: 'var(--font)', transition: 'border-color .15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--p3)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
      >
        <Store size={15} style={{ color: 'var(--p2)', flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.name}</span>
            <ChevronDown size={14} style={{ color: 'var(--text4)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            width: collapsed ? 220 : '100%', minWidth: 200, zIndex: 100,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            boxShadow: '0 12px 32px rgba(0,0,0,.24)', overflow: 'hidden', padding: 4,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '6px 10px 4px' }}>
            {i('Mes boutiques', 'My shops', 'Mis tiendas', 'I miei negozi')}
          </div>
          {tenants.map(t => {
            const isActive = t.id === activeTenantId
            const isPending = pending === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={!!pending}
                onClick={() => choose(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', borderRadius: 8, border: 'none',
                  background: isActive ? 'var(--bg3)' : 'transparent',
                  cursor: pending ? 'default' : 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!pending && !isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Store size={14} style={{ color: isActive ? 'var(--p2)' : 'var(--text3)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{t.currency} · {t.role}</div>
                </div>
                {isPending
                  ? <Loader2 size={14} style={{ color: 'var(--p2)', animation: 'spin .6s linear infinite', flexShrink: 0 }} />
                  : isActive
                    ? <Check size={14} style={{ color: 'var(--p2)', flexShrink: 0 }} />
                    : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
