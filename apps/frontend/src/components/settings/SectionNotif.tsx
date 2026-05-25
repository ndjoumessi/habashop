import { useConfig } from '@/stores/appStore'
import { type L4, makeI, pick, panel, Head, ToggleCard } from '@/components/settings/settingsShared'

export default function SectionNotif() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)

  const NOTIFS: { key: any; icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string> }[] = [
    { key: 'notifEmailStock', icon: '⚠️', color: 'var(--danger)', label: { fr: 'Alertes rupture stock', en: 'Stock shortage alerts', es: 'Alertas de stock', it: 'Avvisi scorte' }, desc: { fr: 'Email quand un produit est en rupture', en: 'Email when a product runs out', es: 'Email cuando un producto se agota', it: 'Email quando un prodotto si esaurisce' } },
    { key: 'notifEmailSales', icon: '📊', color: 'var(--p2)', label: { fr: 'Rapport ventes par email', en: 'Sales report by email', es: 'Reporte de ventas por email', it: 'Report vendite via email' }, desc: { fr: 'Résumé des ventes par email', en: 'Sales summary by email', es: 'Resumen de ventas por email', it: 'Riepilogo vendite via email' } },
    { key: 'notifSmsSales', icon: '🛒', color: 'var(--acc2)', label: { fr: 'SMS ventes', en: 'Sales SMS', es: 'SMS de ventas', it: 'SMS vendite' }, desc: { fr: 'SMS pour les nouvelles ventes', en: 'SMS on new sales', es: 'SMS en nuevas ventas', it: 'SMS sulle nuove vendite' } },
    { key: 'notifSmsStock', icon: '📦', color: 'var(--acc)', label: { fr: 'SMS stock', en: 'Stock SMS', es: 'SMS de stock', it: 'SMS magazzino' }, desc: { fr: 'SMS pour les alertes stock', en: 'SMS for stock alerts', es: 'SMS para alertas de stock', it: 'SMS per avvisi scorte' } },
    { key: 'notifEmailPayroll', icon: '💼', color: 'var(--warn)', label: { fr: 'Email paie', en: 'Payroll email', es: 'Email de nómina', it: 'Email stipendi' }, desc: { fr: 'Notifie la génération des bulletins', en: 'Notify payslip generation', es: 'Notificar generación de nóminas', it: 'Notifica generazione buste paga' } },
    { key: 'notifPushAll', icon: '🔔', color: 'var(--p3)', label: { fr: 'Notifications push', en: 'Push notifications', es: 'Notificaciones push', it: 'Notifiche push' }, desc: { fr: 'Toutes les notifications dans l\'app', en: 'All in-app notifications', es: 'Todas las notificaciones en la app', it: 'Tutte le notifiche in-app' } },
  ]

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head emoji="🔔" tint="rgba(255,59,92,.04)"
        title={i('Notifications', 'Notifications', 'Notificaciones', 'Notifiche')}
        sub={i('Gérez vos alertes et rapports automatiques', 'Manage your alerts and automatic reports', 'Gestiona tus alertas y reportes automáticos', 'Gestisci i tuoi avvisi e report automatici')} />
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NOTIFS.map(n => (
          <ToggleCard key={n.key} icon={n.icon} color={n.color} label={pick(lang, n.label)} desc={pick(lang, n.desc)}
            on={!!(cfg as any)[n.key]} onChange={() => cfg.updateConfig({ [n.key]: !(cfg as any)[n.key] } as any)} />
        ))}
      </div>
    </div>
  )
}
