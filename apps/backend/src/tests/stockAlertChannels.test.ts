import { describe, it, expect, beforeEach, vi } from 'vitest'

// ⚠️ ALERTES STOCK — CHAQUE CANAL PORTE SA PROPRE GARDE (#154).
//
// Ce corps de boucle a absorbé TROIS canaux en deux mois, chacun ajouté SOUS un garde écrit
// pour le précédent :
//   25/05  9f78d765  les gardes `if (!admin?.email) continue`      → écrites pour l'E-MAIL seul
//   29/05  7336bd60  `notifEmailStock: true` dans le where tenant  → écrite pour l'E-MAIL seul
//   14/06  464c7260  + sendStockAlertBatch (PUSH)                  → posé SOUS ces gardes
//   24/07  cd1250b3  + notifyStockAlertSms (SMS)                   → posé SOUS ces gardes
//
// Résultat : couper les alertes stock PAR E-MAIL, ou n'avoir aucun admin actif avec e-mail,
// supprimait AUSSI le push et le SMS — en silence. L'UI (`SectionNotif`) présente pourtant
// « Alertes rupture stock » (e-mail) et « SMS stock » comme deux bascules INDÉPENDANTES, et
// `sms.ts` annonce le SMS gardé par `notifSmsStock` + `ownerPhone` seulement.
//
// Ces tests sont écrits pour que le PROCHAIN canal (notifSmsSales est annoncé) hérite du
// filet et non du piège : ils n'assertent pas une implémentation, ils assertent qu'un canal
// non-e-mail reste atteignable quand l'e-mail, lui, ne l'est pas.

const { db, email, push, sms } = vi.hoisted(() => ({
  db: {
    tenant: { findMany: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn() },
    product: { findMany: vi.fn(), fields: { stockMin: 'stockMin' } },
    sale: { aggregate: vi.fn() },
    saleItem: { groupBy: vi.fn() },
  },
  email: { sendStockAlertEmail: vi.fn(), sendTrialReminder7Days: vi.fn(), sendTrialReminder3Days: vi.fn(), sendTrialExpired: vi.fn() },
  push: { sendStockAlertBatch: vi.fn(), sendTrialExpiring: vi.fn() },
  sms: { notifyStockAlertSms: vi.fn() },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => email)
vi.mock('../services/pushService', () => push)
vi.mock('../services/sms', () => sms)

import { runDailyStockAlerts, runTrialReminders } from '../services/notificationCrons'

const PRODUITS_BAS = [{ name: 'Riz parfumé 5kg', stockQty: 0, stockMin: 5 }]
const ADMIN_OK = { email: 'admin@boutique.sn', name: 'Awa' }

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findMany.mockResolvedValue(PRODUITS_BAS)
  db.user.findFirst.mockResolvedValue(ADMIN_OK)
  email.sendStockAlertEmail.mockResolvedValue(true)
  db.tenant.update.mockResolvedValue({})
  db.sale.aggregate.mockResolvedValue({ _sum: { total: 0 }, _count: { id: 0 } })
})

const tenant = (over: Record<string, unknown> = {}) => ({
  id: 'T1', name: 'Boutique Test', isActive: true, status: 'active',
  notifEmailStock: false, notifSmsStock: true, ...over,
})

/**
 * ⚠️ Le mock APPLIQUE réellement le `where` reçu, au lieu de rendre une liste figée.
 * Sans cela, un `where` qui exclut le tenant (la faute d'origine) resterait invisible : le
 * test recevrait quand même son tenant et passerait au vert en décrivant un monde qui
 * n'existe pas. C'est ce filtre qui rend les échecs ci-dessous RÉELS.
 */
const servirTenants = (rows: Record<string, unknown>[]) => {
  db.tenant.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
    const w = args?.where ?? {}
    return Promise.resolve(rows.filter(r => Object.entries(w).every(([k, v]) => {
      if (v === null || typeof v !== 'object') return r[k] === v
      if ('in' in (v as Record<string, unknown>)) return (v as { in: unknown[] }).in.includes(r[k])
      return true
    })))
  })
}

describe('alertes stock — un canal coupé n’en coupe pas un autre (#154)', () => {
  // ── ÉCHEC 1 : la garde 1 (notifEmailStock dans le where) excluait le tenant de la boucle ──
  it('e-mail stock COUPÉ, SMS souscrit → le SMS part quand même', async () => {
    servirTenants([tenant({ notifEmailStock: false, notifSmsStock: true })])
    await runDailyStockAlerts()
    expect(sms.notifyStockAlertSms).toHaveBeenCalledWith('T1', PRODUITS_BAS)
    // …et l'e-mail, lui, ne part PAS : la préférence est respectée, pas ignorée.
    expect(email.sendStockAlertEmail).not.toHaveBeenCalled()
  })

  // ── ÉCHEC 2 : la garde 2 (`if (!admin?.email) continue`) coupait tout ──
  it('aucun admin actif avec e-mail → SMS et push partent quand même', async () => {
    servirTenants([tenant({ notifEmailStock: true })])
    db.user.findFirst.mockResolvedValue(null)          // pas d'admin joignable
    await runDailyStockAlerts()
    expect(sms.notifyStockAlertSms).toHaveBeenCalledWith('T1', PRODUITS_BAS)
    expect(push.sendStockAlertBatch).toHaveBeenCalledWith('T1', PRODUITS_BAS)
    expect(email.sendStockAlertEmail).not.toHaveBeenCalled()   // rien à quoi envoyer
  })

  // ── ÉCHEC 3 : le push subissait la même exclusion que le SMS ──
  it('e-mail stock COUPÉ → le push part quand même', async () => {
    servirTenants([tenant({ notifEmailStock: false })])
    await runDailyStockAlerts()
    expect(push.sendStockAlertBatch).toHaveBeenCalledWith('T1', PRODUITS_BAS)
  })

  // ── Le chemin nominal ne doit pas régresser ──
  it('tout activé → les TROIS canaux partent', async () => {
    servirTenants([tenant({ notifEmailStock: true })])
    await runDailyStockAlerts()
    expect(email.sendStockAlertEmail).toHaveBeenCalled()
    expect(push.sendStockAlertBatch).toHaveBeenCalled()
    expect(sms.notifyStockAlertSms).toHaveBeenCalled()
  })

  it('aucun produit en stock bas → AUCUN canal (la boucle passe au tenant suivant)', async () => {
    servirTenants([tenant({ notifEmailStock: true })])
    db.product.findMany.mockResolvedValue([])
    await runDailyStockAlerts()
    expect(email.sendStockAlertEmail).not.toHaveBeenCalled()
    expect(push.sendStockAlertBatch).not.toHaveBeenCalled()
    expect(sms.notifyStockAlertSms).not.toHaveBeenCalled()
  })

  // ⚠️ LE VERROU STRUCTUREL, formulé pour le PROCHAIN canal (notifSmsSales est annoncé) :
  // la requête tenant ne doit filtrer QUE sur l'activité du tenant. Toute préférence de canal
  // qui remonte dans le `where` ré-exclut d'office tous les autres canaux — la faute d'origine.
  it('la sélection des tenants ne filtre sur AUCUNE préférence de canal', async () => {
    servirTenants([tenant({ notifEmailStock: true })])
    await runDailyStockAlerts()
    const where = db.tenant.findMany.mock.calls.at(-1)![0].where
    expect(where).toMatchObject({ isActive: true })
    for (const pref of ['notifEmailStock', 'notifSmsStock', 'notifPushAll', 'notifSmsSales', 'notifEmailSales']) {
      expect(where[pref], `« ${pref} » ne doit pas filtrer la boucle : il gate UN canal, pas tous`).toBeUndefined()
    }
  })
})

describe('rappels d’essai — le jumeau (server.ts:362 avant extraction)', () => {
  // Même faute, même commit push : `sendTrialExpiring` était sous le garde e-mail.
  it('essai à 3 jours, aucun admin avec e-mail → le push part quand même', async () => {
    db.tenant.findMany.mockImplementation((args: { where?: { status?: string; trialEnds?: unknown } }) =>
      // seule la fenêtre « 3 jours » renvoie un tenant ; les deux autres requêtes sont vides
      Promise.resolve(args?.where?.trialEnds && !args.where.status?.includes('x') ? [] : []))
    // fenêtre 3 j : 2e appel de findMany dans runTrialReminders
    let appel = 0
    db.tenant.findMany.mockImplementation(() => {
      appel++
      return Promise.resolve(appel === 2 ? [{ id: 'T1', name: 'Boutique Test', users: [{ email: null, name: null }] }] : [])
    })
    await runTrialReminders()
    expect(push.sendTrialExpiring).toHaveBeenCalledWith('T1', 3)
    expect(email.sendTrialReminder3Days).not.toHaveBeenCalled()
  })
})
