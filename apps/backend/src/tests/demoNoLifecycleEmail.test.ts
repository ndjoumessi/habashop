import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * AUCUN E-MAIL DE CYCLE DE VIE VERS UNE DÉMO JETABLE.
 *
 * ⚠️ DÉFAUT RÉEL, trouvé en revue. La route de démo posait `status: 'trial'` ET
 * `trialEnds = maintenant + 7 jours`. Or `runTrialReminders` sélectionne
 * `{ status:'trial', trialEnds ∈ [maintenant+7j ± 30 min] }` et tourne TOUTES LES HEURES,
 * sans garde de minute. Une démo créée dans les 30 minutes précédant un tick tombait donc
 * dans la fenêtre du rappel « 7 jours » AU MOMENT MÊME DE SA CRÉATION, et l'e-mail partait
 * vers `demo-<uuid>@demo.local` — un TLD inexistant, donc un rejet dur qui abîme la
 * réputation d'expédition du domaine. Au plafond de 200 démos/jour : jusqu'à ~300 rejets
 * durs par jour.
 *
 * ⚠️ Ces e-mails passent par `sendPlatformEmail`, EXEMPTÉ du garde de dépense (exemption
 * délibérée : l'e-mail « votre essai est terminé » doit partir au moment où le tenant
 * devient échu). Le garde de dépense ne pouvait donc pas les arrêter.
 *
 * ⚠️ Et mon propre commentaire de `routes/demo.ts` affirmait « aucun e-mail ne PEUT
 * partir ». C'était une garantie de sûreté posée par RAISONNEMENT, jamais exercée, et
 * fausse. D'où ce fichier : deux gardes, chacun exercé.
 */
const { db, emails, push, sms, sentry } = vi.hoisted(() => ({
  // ⚠️ Paramètres TYPÉS : un `vi.fn(async () => [])` sans paramètres donne un `mock.calls`
  // de type tuple VIDE — `calls[0][0]` ne compile pas sous le `strict: true` du dépôt.
  db: {
    tenant: {
      findMany: vi.fn(async (_args: { where: Record<string, unknown> }): Promise<unknown[]> => []),
      update: vi.fn(async (_args: Record<string, unknown>): Promise<unknown> => ({})),
    },
  },
  emails: {
    sendTrialReminder7Days: vi.fn(), sendTrialReminder3Days: vi.fn(),
    sendTrialExpired: vi.fn(), sendStockAlertEmail: vi.fn(),
  },
  push: { sendTrialExpiring: vi.fn(), sendStockAlertBatch: vi.fn() },
  sms: { notifyStockAlertSms: vi.fn() },
  sentry: { captureMessage: vi.fn(), captureException: vi.fn() },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => emails)
vi.mock('../services/pushService', () => push)
vi.mock('../services/sms', () => sms)
vi.mock('@sentry/node', () => sentry)

import { runTrialReminders } from '../services/notificationCrons'

beforeEach(() => { vi.clearAllMocks(); db.tenant.findMany.mockResolvedValue([]) })

describe('garde 1 — la sélection du cron exclut les démos', () => {
  it('⚠️ CHAQUE requête de rappel d’essai porte `isDemo: false`', async () => {
    await runTrialReminders()
    expect(db.tenant.findMany.mock.calls.length).toBeGreaterThanOrEqual(3)
    for (const [args] of db.tenant.findMany.mock.calls) {
      const where = args.where
      expect(where.isDemo, `une requête de rappel d’essai sans \`isDemo: false\` : ${JSON.stringify(where)}`).toBe(false)
    }
  })

  it('une démo qui franchirait la sélection ne reçoit RIEN — contrôle par le haut', async () => {
    // Si un jour le `where` régressait, ceci resterait la dernière ligne : on simule une
    // base qui rend une démo malgré le filtre.
    db.tenant.findMany.mockResolvedValue([
      { id: 'demo-tmp-1', name: 'Démo', isDemo: true, trialEnds: new Date(), users: [{ email: 'demo-x@demo.local', name: 'Visiteur démo' }] },
    ] as never)
    await runTrialReminders()
    const destinataires = [
      ...emails.sendTrialReminder7Days.mock.calls,
      ...emails.sendTrialReminder3Days.mock.calls,
      ...emails.sendTrialExpired.mock.calls,
    ].map(c => (c[0] as { to?: string })?.to)
    expect(destinataires.filter(d => String(d).endsWith('@demo.local'))).toEqual([])
  })
})
