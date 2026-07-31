import { ShoppingCart, Users, Crown, Briefcase, Calculator } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Connexion instantanée par rôle — RÉSERVÉE À LA DÉMO.
 *
 * ⚠️ Ce module contient le mot de passe des comptes de démonstration. Il n'est rendu
 * QUE si `VITE_DEMO_MODE === '1'` (cf. LoginPage) ; en production, la constante est
 * repliée à `false` au build et ce fichier disparaît du bundle livré — vérifié par
 * `npm run verify:demo-flag` (grep de `dist/` sur le mot de passe).
 *
 * ⚠️ Ceci n'est PAS la sécurité : les comptes démo existent sur le backend de prod et
 * leur mot de passe est public (dépôt public). Ce qui protège réellement, c'est la
 * garde serveur `Tenant.isDemo` (403 DEMO_TENANT_FORBIDDEN sur tout ce qui coûte ou
 * détruit). Ici on réduit la surface et on cesse d'afficher « connexion sans mot de
 * passe » à un prospect ; rien de plus.
 */

const DEMO_PASSWORD = 'demo1234'

type DemoRole = { key: string; email: string; Icon: LucideIcon; tint: string; testid: string }

const DEMO_ROLES: DemoRole[] = [
  { key: 'admin',      email: 'admin@habashop.com',      Icon: Crown,        tint: 'var(--p3)',     testid: 'demo-admin' },
  { key: 'manager',    email: 'manager@habashop.com',    Icon: Briefcase,    tint: 'var(--acc2)',   testid: 'demo-manager' },
  { key: 'cashier',    email: 'cashier@habashop.com',    Icon: ShoppingCart, tint: 'var(--acc3)',   testid: 'demo-cashier' },
  { key: 'accountant', email: 'accountant@habashop.com', Icon: Calculator,   tint: 'var(--acc)',    testid: 'demo-accountant' },
  { key: 'hr',         email: 'hr@habashop.com',         Icon: Users,        tint: 'var(--danger)', testid: 'demo-hr' },
]

interface Props {
  i: (fr: string, en: string, es: string, it: string) => string
  busyRole: string | null
  disabled: boolean
  onPick: (key: string, email: string, password: string) => void
}

export default function DemoRoleLogin({ i, busyRole, disabled, onPick }: Props) {
  const meta: Record<string, { label: string; sub: string }> = {
    admin:      { label: i('Admin','Admin','Administrador','Amministratore'),   sub: i('Accès total','Full access','Acceso total','Accesso totale') },
    manager:    { label: i('Manager','Manager','Gerente','Manager'),            sub: i('Gestion','Management','Gestión','Gestione') },
    cashier:    { label: i('Caissier','Cashier','Cajero','Cassiere'),           sub: i('Caisse','POS','TPV','Cassa') },
    accountant: { label: i('Comptable','Accountant','Contable','Contabile'),    sub: i('Finances','Finance','Finanzas','Finanze') },
    hr:         { label: i('RH','HR','RR. HH.','Risorse Umane'),                sub: i('Employés & paie','Staff & payroll','Personal y nóminas','Personale e buste paga') },
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12,
        fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
        color: 'var(--acc)', background: 'var(--c-orange-bg)',
        border: '1px solid var(--c-orange-border)', borderRadius: 'var(--r-full, 999px)',
        padding: '4px 11px',
      }}>
        {i('Environnement de démonstration','Demo environment','Entorno de demostración','Ambiente dimostrativo')}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {i(
          'Les identifiants sont pré-remplis ; la connexion reste une authentification normale.',
          'Credentials are pre-filled; sign-in remains a normal authentication.',
          'Las credenciales se rellenan solas; el acceso sigue siendo una autenticación normal.',
          'Le credenziali sono precompilate; l’accesso resta un’autenticazione normale.',
        )}
      </p>
      <div className="login-demo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {DEMO_ROLES.map(r => {
          const m = meta[r.key]
          const busy = busyRole === r.key
          return (
            <button
              key={r.key}
              type="button"
              data-testid={r.testid}
              onClick={() => onPick(r.key, r.email, DEMO_PASSWORD)}
              disabled={disabled}
              aria-label={`${i('Connexion démo','Demo login','Acceso demo','Accesso demo')} — ${m.label}`}
              className="login-demo-chip"
              style={{
                gridColumn: r.key === 'hr' ? '1 / -1' : 'auto',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 11px', textAlign: 'left',
                background: 'var(--card2)', border: '1px solid var(--border)',
                borderRadius: 10, fontFamily: 'var(--font)',
                cursor: disabled ? 'wait' : 'pointer',
                opacity: disabled && !busy ? 0.5 : 1,
                transition: 'background .15s, border-color .15s, opacity .15s',
              }}
            >
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: `color-mix(in srgb, ${r.tint} 16%, transparent)`, color: r.tint,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {busy
                  ? <span className="login-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid color-mix(in srgb, currentColor 30%, transparent)', borderTopColor: 'currentColor', display: 'inline-block' }}/>
                  : <r.Icon size={15} strokeWidth={2.3} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{m.label}</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--text3)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
