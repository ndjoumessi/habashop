import type React from 'react'

export type L4 = 'fr' | 'en' | 'es' | 'it'
export const makeI = (lang: string) => (fr: string, en: string, es: string, it: string) =>
  lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it
export const pick = (lang: string, o: Record<L4, string>) => o[lang as L4] ?? o.fr

export const panel: React.CSSProperties = {
  background: 'var(--grad-card)',
  border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden',
}

export function Switch({ on, onClick, color, disabled }: { on: boolean; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on} style={{
      width: 48, height: 26, borderRadius: 99, flexShrink: 0,
      background: on ? color : 'var(--bg4)', border: 'none',
      cursor: disabled ? 'default' : 'pointer', transition: 'all .25s', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .25s', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }} />
    </button>
  )
}

export function ToggleCard({ icon, color, label, desc, on, onChange, disabled }: {
  icon: string; color: string; label: string; desc: string; on: boolean; onChange: () => void; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg3)', border: `1px solid var(--border)`, borderRadius: 14, transition: 'border-color .2s' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{desc}</div>
      </div>
      <Switch on={on} onClick={onChange} color={color} disabled={disabled} />
    </div>
  )
}

// `icon` = élément Lucide (ex. <Store size={16}/>) — cohérent avec le reste de l'UI (plus d'emoji).
export function Head({ icon, title, sub, tint, right }: { icon: React.ReactNode; title: string; sub?: string; tint: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: `linear-gradient(135deg,${tint},transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', color: 'var(--p2)', flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: 0, marginBottom: sub ? 3 : 0 }}>{title}</h2>
          {sub && <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}
