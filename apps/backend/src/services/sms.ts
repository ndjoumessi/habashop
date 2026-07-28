import { prisma } from '../db'
import { sendSms } from '../lib/spend/smsClient'

// ── SMS métier (Africa's Talking) — fire-and-forget, fail-silent ───────────────────────
// Le SMS coûte de l'argent → il passe par sendSms (garde de dépense) + resolveRecipient
// (sécurité téléphonique). Ici on résout la CONFIG tenant (opt-in + numéro + pays) et on
// délègue. Le numéro cible est celui du GÉRANT (ownerPhone) → flux commerçant, normalisable
// avec tenant.country (resolveRecipient refuse si le pays n'est pas supporté).

// Digest QUOTIDIEN d'alerte stock au gérant (appelé depuis `services/notificationCrons.ts`,
// pas par vente →
// un seul SMS/jour, pas un par vente). Gardé par l'opt-in tenant `notifSmsStock`.
export async function notifyStockAlertSms(
  tenantId: string,
  products: Array<{ name: string; stockQty: number }>,
): Promise<void> {
  if (products.length === 0) return
  try {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerPhone: true, country: true, notifSmsStock: true },
    })
    if (!t?.notifSmsStock || !t.ownerPhone) return // opt-in désactivé ou pas de numéro → rien
    const worst = products[0]
    const message = products.length === 1
      ? `HabaShop — stock bas : ${worst.name} (${worst.stockQty}).`
      : `HabaShop — ${products.length} produits en stock bas (dont ${worst.name}). Vérifiez votre inventaire.`
    // owner=merchant → resolveRecipient normalise avec le pays SI supporté, sinon refuse (pas
    // de numéro deviné). Résultat ignoré (fire-and-forget) : le refus est déjà tracé sans PII.
    await sendSms({ tenantId, to: t.ownerPhone, message, owner: { kind: 'merchant', country: t.country } })
  } catch { /* fail silent — une alerte SMS ne doit jamais casser le cron */ }
}
