import type React from 'react'
import { useId } from 'react'

export type L4 = 'fr' | 'en' | 'es' | 'it'
export const makeI = (lang: string) => (fr: string, en: string, es: string, it: string) =>
  lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it
export const pick = (lang: string, o: Record<L4, string>) => o[lang as L4] ?? o.fr

export const panel: React.CSSProperties = {
  background: 'var(--grad-card)',
  border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden',
}

export function Switch({ on, onClick, color, disabled, label, describedBy }: { on: boolean; onClick: () => void; color: string; disabled?: boolean; label?: string; describedBy?: string }) {
  // stopPropagation : la card parente (ToggleCard) est cliquable — sans ça, un clic sur le switch togglerait deux fois.
  return (
    <button type="button" disabled={disabled} onClick={e => { e.stopPropagation(); onClick() }} role="switch" aria-checked={on} aria-label={label} aria-describedby={describedBy} style={{
      /* Pattern POSModals : piste OFF = var(--bg5) + bordure var(--border) (visible en Soleil), ON = couleur sémantique, knob #fff */
      width: 48, height: 26, borderRadius: 'var(--r-full)', flexShrink: 0, boxSizing: 'border-box',
      background: on ? color : 'var(--bg5)', border: '1px solid var(--border)',
      cursor: disabled ? 'default' : 'pointer', transition: 'all .25s', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 24 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .25s', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }} />
    </button>
  )
}

// `icon` = élément Lucide (ex. <Bell size={18}/>) — plus d'emoji UI.
// Card ENTIÈRE cliquable (le label aussi) ; le Switch isole son clic (stopPropagation) pour éviter le double toggle.
export function ToggleCard({ icon, color, label, desc, on, onChange, disabled }: {
  icon: React.ReactNode; color: string; label: string; desc: string; on: boolean; onChange: () => void; disabled?: boolean
}) {
  const descId = useId() // la description est annoncée par le lecteur d'écran via aria-describedby sur le Switch
  return (
    <div
      onClick={() => { if (!disabled) onChange() }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = `color-mix(in srgb, ${color} 45%, var(--border))` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg3)', border: `1px solid var(--border)`, borderRadius: 14, transition: 'border-color .2s', cursor: disabled ? 'default' : 'pointer', userSelect: 'none' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginBottom: 2 }}>{label}</div>
        <div id={descId} style={{ fontSize: 11, color: 'var(--text3)' }}>{desc}</div>
      </div>
      <Switch on={on} onClick={onChange} color={color} disabled={disabled} label={label} describedBy={descId} />
    </div>
  )
}

// Intertitre de groupe (icône Lucide + libellé uppercase) — sépare les blocs de toggles (Email / SMS / Push, Tickets / Caisse…).
export function GroupLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 2 }}>
      <span style={{ display: 'flex', color: 'var(--text3)' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text3)' }}>{label}</span>
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
