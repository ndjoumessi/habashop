import { useEffect, useState } from 'react'
import { Bell, MessageCircle } from 'lucide-react'
import Skeleton from '@/components/ui/skeleton'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { tenantApi } from '@/lib/api'
import { type L4, makeI, pick, panel, Head, ToggleCard } from '@/components/settings/settingsShared'

export default function SectionNotif() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  // Numéro WhatsApp du gérant (rapports auto soir 20h / matin 8h) — setting TENANT ; vide = désactivé
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerPhoneSaved, setOwnerPhoneSaved] = useState('')
  // Évite le flicker états par défaut → états serveur : skeleton tant que le tenant n'est pas chargé
  const [tenantLoaded, setTenantLoaded] = useState(false)

  // Charge depuis le tenant au mount
  useEffect(() => {
    tenantApi.get().then((t: any) => {
      if (!t) return
      setOwnerPhone(t.ownerPhone ?? '')
      setOwnerPhoneSaved(t.ownerPhone ?? '')
      cfg.updateConfig({
        notifEmailSales:   t.notifEmailSales   ?? true,
        notifEmailStock:   t.notifEmailStock   ?? true,
        notifEmailPayroll: t.notifEmailPayroll ?? false,
        notifSmsSales:     t.notifSmsSales     ?? false,
        notifSmsStock:     t.notifSmsStock     ?? true,
        notifPushAll:      t.notifPushAll      ?? true,
      } as any)
    }).catch(() => {}).finally(() => setTenantLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <Head icon={<Bell size={16} />} tint="rgba(255,59,92,.04)"
        title={i('Notifications', 'Notifications', 'Notificaciones', 'Notifiche')}
        sub={i('Gérez vos alertes et rapports automatiques', 'Manage your alerts and automatic reports', 'Gestiona tus alertas y reportes automáticos', 'Gestisci i tuoi avvisi e report automatici')} />
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!tenantLoaded ? (
          <Skeleton height={58} count={6} radius={12} />
        ) : (
        <>
        {NOTIFS.map(n => (
          <ToggleCard key={n.key} icon={n.icon} color={n.color} label={pick(lang, n.label)} desc={pick(lang, n.desc)}
            on={!!(cfg as any)[n.key]}
            onChange={() => {
              const newVal = !(cfg as any)[n.key]
              cfg.updateConfig({ [n.key]: newVal } as any)
              tenantApi.update({ [n.key]: newVal } as any).catch(() => {
                // Échec serveur : revert du toggle + feedback (le toggle restait « activé » à tort)
                cfg.updateConfig({ [n.key]: !newVal } as any)
                toast.error(i("Échec de l'enregistrement", 'Save failed', 'Error al guardar', 'Salvataggio non riuscito'))
              })
            }} />
        ))}
        </>
        )}

        {/* Rapports WhatsApp auto (résumé du soir + alerte stock du matin) */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MessageCircle size={14} color="var(--acc2)" />
            <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)' as any, color: 'var(--text)' }}>
              {i('Rapports WhatsApp du gérant', "Owner's WhatsApp reports", 'Informes WhatsApp del gerente', 'Report WhatsApp del gestore')}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>
            {i('Résumé des ventes (20h) et alerte stock (8h) envoyés à ce numéro. Laissez vide pour désactiver.',
               'Sales summary (8pm) and stock alert (8am) sent to this number. Leave empty to disable.',
               'Resumen de ventas (20h) y alerta de stock (8h) enviados a este número. Deje vacío para desactivar.',
               'Riepilogo vendite (20) e avviso scorte (8) inviati a questo numero. Lasciare vuoto per disattivare.')}
          </div>
          <input className="input" type="tel" value={ownerPhone} placeholder="+221 77 123 45 67"
            style={{ maxWidth: 260 }}
            onChange={e => setOwnerPhone(e.target.value)}
            onBlur={() => {
              const v = ownerPhone.trim()
              if (v === ownerPhoneSaved.trim()) return
              tenantApi.update({ ownerPhone: v })
                .then(() => { setOwnerPhoneSaved(v); toast.success(i('Numéro enregistré', 'Number saved', 'Número guardado', 'Numero salvato')) })
                .catch(() => toast.error(i("Échec de l'enregistrement", 'Save failed', 'Error al guardar', 'Salvataggio non riuscito')))
            }} />
        </div>
      </div>
    </div>
  )
}
