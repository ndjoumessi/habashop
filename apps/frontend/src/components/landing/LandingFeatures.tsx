import { ShoppingCart, Package, BarChart2, Users, Briefcase, Lock, Check } from 'lucide-react'
import { D } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
}

export default function LandingFeatures({ lp, i }: Props) {
  const items: Record<number, string[]> = {
    1: [
      i('Modes paiement multiples', 'Multiple payment modes', 'Múltiples modos de pago', 'Multi-pagamento'),
      i('Ticket WhatsApp', 'WhatsApp receipt', 'Ticket WhatsApp', 'Scontrino WhatsApp'),
      i('Mode offline', 'Offline mode', 'Modo offline', 'Modalità offline'),
    ],
    2: [
      i('Alertes rupture auto', 'Auto shortage alerts', 'Alertas de rotura auto', 'Avvisi esaurimento auto'),
      i('Scan codes-barres', 'Barcode scanning', 'Escaneo de códigos de barras', 'Scansione codici a barre'),
      i('Multi-entrepôts', 'Multi-warehouse', 'Multi-almacén', 'Multi-magazzino'),
    ],
    3: [
      i('KPIs temps réel', 'Real-time KPIs', 'KPIs en tiempo real', 'KPI in tempo reale'),
      i('Exports CSV / PDF', 'CSV / PDF exports', 'Exportaciones CSV / PDF', 'Export CSV / PDF'),
      i('Top produits', 'Top products', 'Top productos', 'Top prodotti'),
    ],
    4: [
      i('Points de fidélité', 'Loyalty points', 'Puntos de fidelidad', 'Punti fedeltà'),
      i('Historique achats', 'Purchase history', 'Historial de compras', 'Storico acquisti'),
      i('Segments clients', 'Customer segments', 'Segmentos de clientes', 'Segmenti clienti'),
    ],
    5: [
      i('Planning semaine', 'Weekly schedule', 'Horario semanal', 'Turni settimanali'),
      i('Bulletins PDF', 'PDF payslips', 'Nóminas PDF', 'Buste paga PDF'),
      i('Suivi présences', 'Attendance tracking', 'Seguimiento de asistencia', 'Tracciamento presenze'),
    ],
    6: [
      i('Rôles & permissions', 'Roles & permissions', 'Roles y permisos', 'Ruoli e permessi'),
      i('Auth 2FA TOTP', '2FA TOTP auth', 'Autenticación 2FA TOTP', 'Autenticazione 2FA TOTP'),
      i("Journal d'audit", 'Audit log', 'Registro de auditoría', 'Registro di audit'),
    ],
  }

  const features: { icon: JSX.Element; color: string; title: string; desc: string; items: string[] }[] = [
    { icon: <ShoppingCart size={22}/>, color: '#6C47FF', title: lp.feature1_title, desc: lp.feature1_desc, items: items[1] },
    { icon: <Package      size={22}/>, color: '#00B8FF', title: lp.feature2_title, desc: lp.feature2_desc, items: items[2] },
    { icon: <BarChart2    size={22}/>, color: '#A991FF', title: lp.feature3_title, desc: lp.feature3_desc, items: items[3] },
    { icon: <Users        size={22}/>, color: '#FF9500', title: lp.feature4_title, desc: lp.feature4_desc, items: items[4] },
    { icon: <Briefcase    size={22}/>, color: '#00D084', title: lp.feature5_title, desc: lp.feature5_desc, items: items[5] },
    { icon: <Lock         size={22}/>, color: '#FF3B5C', title: lp.feature6_title, desc: lp.feature6_desc, items: items[6] },
  ]
  return (
    <>
      <section id="section-features" style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg2 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{
            display: 'inline-block', background: 'rgba(234,179,8,.1)',
            border: '1px solid rgba(234,179,8,.3)', color: D.gold2,
            fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99,
            letterSpacing: '.8px',
          }}>{lp.features_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0', lineHeight: 1.2 }}>
            {lp.features_title}
          </h2>
          <p style={{ fontSize: 16, color: D.text2, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>{lp.features_sub}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: 'rgba(15,15,26,.8)',
              border: '1px solid rgba(139,92,246,.15)', borderRadius: 16, padding: 24,
              transition: 'all .3s ease',
              position: 'relative', overflow: 'hidden', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.borderColor = D.gold; el.style.boxShadow = '0 16px 40px rgba(234,179,8,.12)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = 'rgba(139,92,246,.15)'; el.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${f.color}1F,transparent 70%)`, pointerEvents: 'none' }}/>

              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: `linear-gradient(135deg,${D.p},#4F46E5)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, color: '#fff',
                boxShadow: `0 8px 24px ${D.p}40`,
              }}>{f.icon}</div>

              <h3 style={{ fontSize: 16, fontWeight: 700, color: D.text, marginBottom: 8, letterSpacing: '-.2px' }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: D.text2, lineHeight: 1.7, marginBottom: 16 }}>{f.desc}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {f.items.map(it => (
                  <div key={it} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: D.p3 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(124,58,237,.18)', color: D.p2, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={11} strokeWidth={3}/>
                    </span>
                    {it}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
