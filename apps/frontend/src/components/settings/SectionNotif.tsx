import type React from 'react'
import { useEffect, useState } from 'react'
import { Bell, BellRing, MessageCircle, Mail, Smartphone, AlertTriangle, BarChart3, ShoppingCart, Package, Briefcase } from 'lucide-react'
import Skeleton from '@/components/ui/skeleton'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { tenantApi } from '@/lib/api'
import { type L4, makeI, pick, panel, Head, ToggleCard, GroupLabel } from '@/components/settings/settingsShared'
import { isWebPushSupported, getWebPushSubscription, enableWebPush, disableWebPush } from '@/utils/webPush'

export default function SectionNotif() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  // Numéro WhatsApp du gérant (rapports auto soir 20h / matin 8h) — setting TENANT ; vide = désactivé
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerPhoneSaved, setOwnerPhoneSaved] = useState('')
  // Évite le flicker états par défaut → états serveur : skeleton tant que le tenant n'est pas chargé
  const [tenantLoaded, setTenantLoaded] = useState(false)
  // Abonnement Web Push PAR NAVIGATEUR (distinct de l'opt-in tenant notifPushAll) : source de
  // vérité = la PushSubscription du SW, relue au montage.
  const pushSupported = isWebPushSupported()
  const [devicePushOn, setDevicePushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  useEffect(() => {
    if (!pushSupported) return
    getWebPushSubscription().then(sub => setDevicePushOn(!!sub)).catch(() => undefined)
  }, [pushSupported])

  const toggleDevicePush = async () => {
    if (pushBusy) return
    setPushBusy(true)
    try {
      if (devicePushOn) {
        await disableWebPush()
        setDevicePushOn(false)
        toast.success(i('Notifications désactivées sur cet appareil', 'Notifications disabled on this device', 'Notificaciones desactivadas en este dispositivo', 'Notifiche disattivate su questo dispositivo'))
      } else {
        const r = await enableWebPush()
        if (r === 'ok') { setDevicePushOn(true); toast.success(i('Notifications activées sur cet appareil', 'Notifications enabled on this device', 'Notificaciones activadas en este dispositivo', 'Notifiche attivate su questo dispositivo')) }
        else if (r === 'denied') toast.error(i('Permission refusée par le navigateur', 'Permission denied by the browser', 'Permiso denegado por el navegador', 'Permesso negato dal browser'))
        else if (r === 'not-configured') toast.error(i('Push non configuré côté serveur', 'Push not configured on the server', 'Push no configurado en el servidor', 'Push non configurato sul server'))
        else toast.error(i("Échec de l'activation", 'Enable failed', 'Error al activar', 'Attivazione non riuscita'))
      }
    } finally {
      setPushBusy(false)
    }
  }

  // Charge depuis le tenant au mount
  useEffect(() => {
    tenantApi.get().then((t) => {
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

  type Notif = { key: any; icon: React.ReactNode; color: string; label: Record<L4, string>; desc: Record<L4, string> }
  // Groupes Email / SMS / Push (intertitres GroupLabel) — mêmes clés/toggles qu'avant, juste regroupés visuellement.
  const GROUPS: { id: string; icon: React.ReactNode; title: string; items: Notif[] }[] = [
    {
      id: 'email', icon: <Mail size={12} />, title: 'Email',
      items: [
        { key: 'notifEmailStock', icon: <AlertTriangle size={18} />, color: 'var(--danger)', label: { fr: 'Alertes rupture stock', en: 'Stock shortage alerts', es: 'Alertas de stock', it: 'Avvisi scorte' }, desc: { fr: 'Email quand un produit est en rupture', en: 'Email when a product runs out', es: 'Email cuando un producto se agota', it: 'Email quando un prodotto si esaurisce' } },
        { key: 'notifEmailSales', icon: <BarChart3 size={18} />, color: 'var(--p2)', label: { fr: 'Rapport ventes par email', en: 'Sales report by email', es: 'Reporte de ventas por email', it: 'Report vendite via email' }, desc: { fr: 'Résumé des ventes par email', en: 'Sales summary by email', es: 'Resumen de ventas por email', it: 'Riepilogo vendite via email' } },
        { key: 'notifEmailPayroll', icon: <Briefcase size={18} />, color: 'var(--warn)', label: { fr: 'Email paie', en: 'Payroll email', es: 'Email de nómina', it: 'Email stipendi' }, desc: { fr: 'Notifie la génération des bulletins', en: 'Notify payslip generation', es: 'Notificar generación de nóminas', it: 'Notifica generazione buste paga' } },
      ],
    },
    {
      id: 'sms', icon: <Smartphone size={12} />, title: 'SMS',
      items: [
        { key: 'notifSmsSales', icon: <ShoppingCart size={18} />, color: 'var(--acc2)', label: { fr: 'SMS ventes', en: 'Sales SMS', es: 'SMS de ventas', it: 'SMS vendite' }, desc: { fr: 'SMS pour les nouvelles ventes', en: 'SMS on new sales', es: 'SMS en nuevas ventas', it: 'SMS sulle nuove vendite' } },
        { key: 'notifSmsStock', icon: <Package size={18} />, color: 'var(--acc)', label: { fr: 'SMS stock', en: 'Stock SMS', es: 'SMS de stock', it: 'SMS magazzino' }, desc: { fr: 'SMS pour les alertes stock', en: 'SMS for stock alerts', es: 'SMS para alertas de stock', it: 'SMS per avvisi scorte' } },
      ],
    },
    {
      id: 'push', icon: <BellRing size={12} />, title: 'Push',
      items: [
        { key: 'notifPushAll', icon: <Bell size={18} />, color: 'var(--p3)', label: { fr: 'Notifications push', en: 'Push notifications', es: 'Notificaciones push', it: 'Notifiche push' }, desc: { fr: 'Toutes les notifications dans l\'app', en: 'All in-app notifications', es: 'Todas las notificaciones en la app', it: 'Tutte le notifiche in-app' } },
      ],
    },
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
        {GROUPS.map(g => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <GroupLabel icon={g.icon} label={g.title} />
            {g.items.map(n => (
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
          </div>
        ))}
        {/* Abonnement Web Push de CE navigateur — sépare l'opt-in tenant (ce qu'on ENVOIE)
            de l'abonnement appareil (ce navigateur REÇOIT-il ?). Masqué si non supporté. */}
        {pushSupported && (
          <ToggleCard icon={<BellRing size={18} />} color="var(--p2)"
            label={i('Recevoir sur cet appareil', 'Receive on this device', 'Recibir en este dispositivo', 'Ricevi su questo dispositivo')}
            desc={i('Notifications push dans ce navigateur (demande la permission)', 'Push notifications in this browser (asks permission)', 'Notificaciones push en este navegador (pide permiso)', 'Notifiche push in questo browser (chiede il permesso)')}
            on={devicePushOn}
            onChange={toggleDevicePush} />
        )}
        </>
        )}

        {/* Rapports WhatsApp auto (résumé du soir + alerte stock du matin) */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MessageCircle size={14} color="var(--acc2)" />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' as any, color: 'var(--text)' }}>
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
            aria-label={i('Numéro WhatsApp du gérant', "Owner's WhatsApp number", 'Número WhatsApp del gerente', 'Numero WhatsApp del gestore')}
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
