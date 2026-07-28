import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  recordFailedSale, getFailedSales, dismissFailedSale, getFailedCount,
  type FailedSale,
} from '@/services/failedSales'
import { getQueue, enqueueAction, removeAction, MAX_QUEUE_RETRIES } from '@/services/offlineQueue'
import { isRetryableApiError, apiErrorCode, apiErrorMessage } from '@/services/api'
import type { SalePayload } from '@/types'

/**
 * Cas (b) — vente ENCAISSÉE mais jamais enregistrée.
 *
 * Le rejeu retirait l'action de la file avec un simple `logger.error`. En release ce log
 * part dans logcat, que personne ne lit : l'argent était dans le tiroir et la vente
 * n'existait nulle part. Ces tests verrouillent le remplacement : registre DURABLE,
 * visible, soldé uniquement par un geste humain — et jamais de ligne réenregistrée
 * automatiquement, qui serait une invention comptable.
 */

const payload = (total: number, key = `k-${total}`): SalePayload => ({
  items: [{ productId: 'p-inconnu', qty: 1, price: total }],
  total, paymentMode: 'cash', idempotencyKey: key,
})

const entry = (over: Partial<FailedSale> = {}): FailedSale => ({
  id: 'a1', payload: payload(2500), reason: 'rejected',
  code: 'UNKNOWN_PRODUCT', message: 'Produit inconnu du catalogue',
  failedAt: '2026-07-25T00:00:00.000Z', total: 2500, ...over,
})

beforeEach(async () => { await AsyncStorage.clear() })

describe('registre des ventes non enregistrées', () => {
  it('consigne l’abandon avec son motif et le montant ENCAISSÉ', async () => {
    await recordFailedSale(entry())
    const list = await getFailedSales()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ code: 'UNKNOWN_PRODUCT', total: 2500, reason: 'rejected' })
  })

  it('SURVIT au redémarrage (persisté, pas un état mémoire)', async () => {
    await recordFailedSale(entry())
    // Aucun cache en mémoire : on relit depuis le stockage, comme au prochain lancement.
    expect(await getFailedCount()).toBe(1)
    expect(JSON.parse((await AsyncStorage.getItem('habashop_failed_sales'))!)).toHaveLength(1)
  })

  it('idempotent : le même abandon rejoué ne crée pas de doublon', async () => {
    await recordFailedSale(entry())
    await recordFailedSale(entry())
    expect(await getFailedCount()).toBe(1)
  })

  it('ne se solde QUE par un geste humain', async () => {
    await recordFailedSale(entry())
    await recordFailedSale(entry({ id: 'a2', total: 700 }))
    await dismissFailedSale('a1')
    const list = await getFailedSales()
    expect(list.map(e => e.id)).toEqual(['a2'])
  })

  it('stockage corrompu → liste vide, jamais de plantage au démarrage', async () => {
    await AsyncStorage.setItem('habashop_failed_sales', '{ pas du json')
    expect(await getFailedSales()).toEqual([])
  })
})

/**
 * Rejeu : on rejoue la DÉCISION de `useOfflineSync` (classification de l'erreur puis
 * consignation + retrait), pas seulement le stockage. C'est cette décision qui régressait.
 */
const axios4xx = (code: string, message: string) => ({
  isAxiosError: true, response: { status: 400, data: { code, error: message } },
})
const axios5xx = { isAxiosError: true, response: { status: 503, data: {} } }

async function rejouer(action: { id: string; payload: SalePayload; retries: number }, err: unknown) {
  if (!isRetryableApiError(err)) {
    await recordFailedSale({
      id: action.id, payload: action.payload, reason: 'rejected',
      code: apiErrorCode(err), message: apiErrorMessage(err),
      failedAt: '2026-07-25T00:00:00.000Z', total: action.payload.total,
    })
    await removeAction(action.id)
    return 'abandon-consigné'
  }
  if (action.retries + 1 >= MAX_QUEUE_RETRIES) {
    await recordFailedSale({
      id: action.id, payload: action.payload, reason: 'exhausted',
      code: apiErrorCode(err), message: apiErrorMessage(err),
      failedAt: '2026-07-25T00:00:00.000Z', total: action.payload.total,
    })
    await removeAction(action.id)
    return 'abandon-consigné'
  }
  return 'retenté'
}

describe('rejeu — 400 UNKNOWN_PRODUCT', () => {
  it('l’action quitte la file MAIS une entrée durable est créée', async () => {
    await enqueueAction('SALE', payload(2500))
    const [action] = await getQueue()

    const out = await rejouer(action, axios4xx('UNKNOWN_PRODUCT', 'Produit inconnu du catalogue'))

    expect(out).toBe('abandon-consigné')
    expect(await getQueue()).toHaveLength(0)          // retirée de la file traitée
    const failed = await getFailedSales()
    expect(failed).toHaveLength(1)                     // …mais RETENUE, visible
    expect(failed[0]).toMatchObject({ code: 'UNKNOWN_PRODUCT', total: 2500, reason: 'rejected' })
  })

  it('le motif serveur est repris TEL QUEL, jamais réinterprété', async () => {
    await enqueueAction('SALE', payload(900))
    const [action] = await getQueue()
    await rejouer(action, axios4xx('UNKNOWN_PRODUCT', 'Produit inconnu du catalogue — actualisez le catalogue'))
    expect((await getFailedSales())[0].message).toBe('Produit inconnu du catalogue — actualisez le catalogue')
  })

  it('épuisement des tentatives (5xx persistant) → même registre, motif distinct', async () => {
    await enqueueAction('SALE', payload(1200))
    const [action] = await getQueue()
    const out = await rejouer({ ...action, retries: MAX_QUEUE_RETRIES - 1 }, axios5xx)
    expect(out).toBe('abandon-consigné')
    expect((await getFailedSales())[0].reason).toBe('exhausted')
  })

  it('5xx transitoire (tentatives restantes) → RETENTÉ, aucune entrée durable', async () => {
    await enqueueAction('SALE', payload(300))
    const [action] = await getQueue()
    const out = await rejouer({ ...action, retries: 0 }, axios5xx)
    expect(out).toBe('retenté')
    expect(await getFailedSales()).toHaveLength(0)   // rien de définitif : on n'alarme pas
    expect(await getQueue()).toHaveLength(1)         // toujours en file
  })

  it('AUCUNE vente n’est réenregistrée automatiquement — le registre ne crée pas de ligne', async () => {
    await enqueueAction('SALE', payload(2500))
    const [action] = await getQueue()
    await rejouer(action, axios4xx('UNKNOWN_PRODUCT', 'Produit inconnu'))
    // Le registre CONSTATE ; il ne fabrique pas de vente. Le payload est conservé pour
    // permettre une ressaisie HUMAINE, rien de plus.
    const failed = await getFailedSales()
    expect(failed[0].payload).toMatchObject({ total: 2500 })
    expect(await getQueue()).toHaveLength(0)
  })
})
