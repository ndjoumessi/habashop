import { prisma } from '../db'
import {
  sendTrialReminder7Days,
  sendTrialReminder3Days,
  sendTrialExpired,
  sendStockAlertEmail,
} from './email'
import { sendTrialExpiring, sendStockAlertBatch } from './pushService'
import { notifyStockAlertSms } from './sms'
import * as Sentry from '@sentry/node'

/**
 * CRONS DE NOTIFICATION — extraits de `server.ts` pour être TESTABLES.
 *
 * `server.ts` appelle `start()` au chargement du module : toute tentative de l'importer
 * depuis un test démarrait le serveur. Ces deux boucles étaient donc hors de portée de
 * tout verrou, et c'est ce qui a permis au bug de #154 de s'installer sans être vu :
 * trois canaux ajoutés en deux mois sous un garde écrit pour un seul.
 *
 * ⚠️ CHAQUE canal porte sa PROPRE garde. Ne jamais conditionner un canal à la garde d'un
 * autre — c'est exactement la faute que `stockAlertChannels.test.ts` verrouille.
 */

/**
 * BALAYAGE HEBDOMADAIRE — coordonnées réelles dans un tenant de DÉMONSTRATION.
 *
 * ⚠️ Il RAPPORTE, il n'empêche pas. Motif : `demo-tenant-001` a porté un nom réel, un mobile
 * personnel, une adresse postale et un e-mail personnel pendant TROIS SEMAINES, dans un tenant
 * dont le mot de passe est public. Empêcher supposerait de refuser des saisies dans une démo
 * dont l'intérêt est qu'on puisse tout y faire ; regarder coûte moins et vaut mieux.
 *
 * ⚠️ La sortie ne reproduit AUCUNE valeur — identifiants et NOMS DE CHAMPS seulement (§ PII).
 * Un rapport qui recopierait le numéro pour le signaler l'écrirait dans les logs Railway :
 * il déplacerait la fuite au lieu de la fermer.
 */
export async function runDemoPiiSweep(): Promise<void> {
  const { balayerDemos, rapporter } = await import('../lib/piiSweep')
  const signalements = await balayerDemos(prisma as never)
  const texte = rapporter(signalements)
  if (signalements.length === 0) { console.log(texte); return }
  console.warn(texte)
  // Sentry : le seul canal qui atteint quelqu'un sans dépenser. Un `console.warn` seul
  // serait un signal que personne ne reçoit — cf. § « L'ALARME QUI NE PEUT PAS SONNER ».
  Sentry.captureMessage(`[pii-sweep] ${signalements.length} ligne(s) hors fixture en démo`, {
    level: 'warning',
    extra: { signalements },
  })
}

export async function runTrialReminders(): Promise<void> {
  const now     = new Date()
  const in7days = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const in3days = new Date(now.getTime() + 3 * 24 * 3600 * 1000)
  const window30 = 30 * 60 * 1000 // ±30 min pour éviter les doublons

  // Essai expirant dans ~7 jours
  const remind7 = await prisma.tenant.findMany({
    where: { status: 'trial', trialEnds: { gte: new Date(in7days.getTime() - window30), lte: new Date(in7days.getTime() + window30) } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })
  for (const tenant of remind7) {
    const admin = tenant.users[0]
    if (!admin?.email) continue
    const sales = await prisma.sale.aggregate({ where: { tenantId: tenant.id }, _sum: { total: true }, _count: { id: true } })
    await sendTrialReminder7Days({
      to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name,
      caToday: sales._sum.total ?? 0, txCount: sales._count.id ?? 0, currency: 'XOF',
    }).catch(() => {})
  }

  // Essai expirant dans ~3 jours
  const remind3 = await prisma.tenant.findMany({
    where: { status: 'trial', trialEnds: { gte: new Date(in3days.getTime() - window30), lte: new Date(in3days.getTime() + window30) } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })
  for (const tenant of remind3) {
    const admin = tenant.users[0]
    // Même règle que les alertes stock : le garde e-mail reste LOCAL à l'e-mail, sinon il
    // emporte le push (#154 — `sendTrialExpiring` a été ajouté sous ce `continue` en juin).
    if (admin?.email) {
      await sendTrialReminder3Days({ to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name }).catch(() => {})
    }
    void sendTrialExpiring(tenant.id, 3)
  }

  // Essai venant d'expirer (dernière fenêtre) → suspension + email
  const expired = await prisma.tenant.findMany({
    where: { status: 'trial', trialEnds: { gte: new Date(now.getTime() - window30), lte: now } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })
  for (const tenant of expired) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'suspended', isActive: false, suspendedAt: new Date(), suspendReason: 'trial_expired' } }).catch(() => {})
    const admin = tenant.users[0]
    if (!admin?.email) continue
    await sendTrialExpired({ to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name }).catch(() => {})
  }

  if (remind7.length + remind3.length + expired.length > 0) {
    console.log('📧 Cron emails:', { remind7: remind7.length, remind3: remind3.length, expired: expired.length })
  }
}

export async function runDailyStockAlerts(): Promise<void> {
  // Tenants ACTIFS — et rien de plus. ⚠️ `notifEmailStock` NE DOIT PAS filtrer ici : cette
  // boucle sert TROIS canaux (e-mail, push, SMS), et une préférence de canal dans le `where`
  // les exclut tous d'un coup. C'était la faute d'origine (#154) : couper l'e-mail coupait
  // aussi le SMS et le push, en silence, alors que l'UI les présente comme indépendants.
  // La préférence est lue ici et appliquée AU SEUL appel e-mail, plus bas.
  const tenants = await prisma.tenant.findMany({
    where: {
      isActive: true,
      status: { in: ['trial', 'active'] },
    },
    select: { id: true, name: true, notifEmailStock: true },
  })

  let sent = 0
  for (const tenant of tenants) {
    try {
      // Produits actifs en rupture (stockQty = 0) ou stock bas (stockQty <= stockMin)
      const lowStockProducts = await prisma.product.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          deletedAt: null,
          stockQty: { lte: prisma.product.fields.stockMin },
        },
        select: { name: true, stockQty: true, stockMin: true },
        orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
      })

      if (lowStockProducts.length === 0) continue

      // Email admin du tenant
      const admin = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          isActive: true,
          deletedAt: null,
        },
        select: { email: true, name: true },
      })

      // ── CHAQUE CANAL SOUS SA PROPRE GARDE ──────────────────────────────────────
      // ⚠️ Ne JAMAIS remettre ici un `continue` : il couperait tous les canaux suivants.
      //    Un garde qui ne concerne qu'un canal reste LOCAL à ce canal.

      // E-MAIL : exige une adresse ET l'opt-in e-mail du tenant.
      if (admin?.email && tenant.notifEmailStock !== false) {
        const ok = await sendStockAlertEmail({
          tenantId: tenant.id,
          to: admin.email,
          shopName: tenant.name,
          products: lowStockProducts,
        })
        if (ok) sent++
      }
      // PUSH : gardé en aval par pushService (rôles destinataires + tokens enregistrés).
      void sendStockAlertBatch(tenant.id, lowStockProducts)
      // SMS : gardé en aval par sms.ts (opt-in `notifSmsStock` + `ownerPhone`) + garde de dépense.
      void notifyStockAlertSms(tenant.id, lowStockProducts)
    } catch (err: any) {
      console.warn(`⚠️ Stock alert failed for tenant ${tenant.id}:`, err?.message)
    }
  }

  console.log(`📦 Alertes stock envoyées: ${sent}/${tenants.length} tenants`)
}
