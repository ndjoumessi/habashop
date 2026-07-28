import AsyncStorage from '@react-native-async-storage/async-storage'
import { replayQueuedSale, REPLAY_TOTAL_TOLERANCE } from '@/services/saleReplay'
import { getFailedSales, isRecorded } from '@/services/failedSales'
import type { SalePayload } from '@/types'

/**
 * REJEU HORS-LIGNE (option A) — ce que ces tests empêchent de revenir.
 *
 * `useOfflineSync` faisait `await salesApi.create(payload)` et JETAIT la réponse. Or le
 * serveur est autoritaire sur le prix : au rejeu il peut facturer autre chose que ce qui a
 * été encaissé au comptoir, et le rejeu se produit hors de la présence du client. Personne
 * n'était prévenu — le tiroir était court à la clôture, sans cause explicable. C'est le trou
 * que `reconcileSaleTotal` a fermé côté web et qui restait ouvert côté mobile.
 *
 * Deux invariants, et ils tirent en sens opposés :
 *   · le drapeau `offlineReplay` doit être posé au rejeu (sinon le serveur re-tarife
 *     systématiquement, et l'option A n'existe pas) ;
 *   · la réponse doit être LUE (sinon l'écart hors bornes redevient silencieux).
 */

const payload = (total: number, key = `k-${total}`): SalePayload => ({
  items: [{ productId: 'p1', qty: 1, price: total }],
  total, paymentMode: 'cash', idempotencyKey: key,
})
const action = (total: number, id = 'a1') => ({ id, payload: payload(total) })

beforeEach(async () => { await AsyncStorage.clear() })

describe('rejeu hors-ligne — drapeau', () => {
  it('pose offlineReplay:true sur le payload rejoué', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1000 })
    await replayQueuedSale(action(1000), { create })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ offlineReplay: true }))
  })

  it('ne touche à RIEN d’autre dans le payload (montant, items, clé d’idempotence)', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1000 })
    await replayQueuedSale(action(1000), { create })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      total: 1000, paymentMode: 'cash', idempotencyKey: 'k-1000',
      items: [{ productId: 'p1', qty: 1, price: 1000 }],
    }))
  })
})

describe('rejeu hors-ligne — la réponse serveur n’est plus jetée', () => {
  it('HONORÉ (facturé = encaissé) : aucune entrée durable, rien à signaler', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1000 })
    const out = await replayQueuedSale(action(1000), { create })
    expect(out).toEqual({ serverTotal: 1000, repriced: false })
    expect(await getFailedSales()).toHaveLength(0)
  })

  // LE cas qui justifie l'option A : hors bornes, le serveur re-tarife et l'argent manque.
  it('HORS BORNES (facturé ≠ encaissé) : entrée durable `repriced` avec les DEUX montants', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1200 })
    const out = await replayQueuedSale(action(1000), { create })
    expect(out).toEqual({ serverTotal: 1200, repriced: true })
    const [entry] = await getFailedSales()
    expect(entry).toMatchObject({ reason: 'repriced', total: 1000, serverTotal: 1200 })
  })

  it('`repriced` est DISTINCT de `rejected` : la vente existe → à vérifier, pas à ressaisir', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1200 })
    await replayQueuedSale(action(1000), { create })
    const [entry] = await getFailedSales()
    // Confondre les deux ferait ressaisir une vente déjà enregistrée, donc la compter deux fois.
    expect(entry.reason).not.toBe('rejected')
    expect(isRecorded(entry.reason)).toBe(true)
  })

  it('tolérance d’arrondi : un écart de 1 ne déclenche rien', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1000 + REPLAY_TOTAL_TOLERANCE })
    const out = await replayQueuedSale(action(1000), { create })
    expect(out.repriced).toBe(false)
    expect(await getFailedSales()).toHaveLength(0)
  })

  it('au-delà de la tolérance : signalé', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1000 + REPLAY_TOTAL_TOLERANCE + 1 })
    expect((await replayQueuedSale(action(1000), { create })).repriced).toBe(true)
  })

  // ⚠️ `Number(null) === 0` : le piège qui a produit « rendre 1 000 F » côté web.
  it('réponse SANS total : absence traitée comme absence, jamais comme 0', async () => {
    for (const rep of [{}, null, undefined, { total: null }]) {
      await AsyncStorage.clear()
      const create = jest.fn().mockResolvedValue(rep)
      const out = await replayQueuedSale(action(1000), { create })
      expect(out).toEqual({ serverTotal: null, repriced: false })
      expect(await getFailedSales()).toHaveLength(0)
    }
  })

  it('l’erreur réseau REMONTE : la file garde la main sur retries / rejected / exhausted', async () => {
    const create = jest.fn().mockRejectedValue(new Error('network'))
    await expect(replayQueuedSale(action(1000), { create })).rejects.toThrow('network')
    // Aucune entrée `repriced` : ce n'est pas un écart de prix, c'est un échec d'envoi.
    expect(await getFailedSales()).toHaveLength(0)
  })

  it('idempotent : deux cycles de sync sur la même action ne créent qu’une entrée', async () => {
    const create = jest.fn().mockResolvedValue({ total: 1200 })
    await replayQueuedSale(action(1000), { create })
    await replayQueuedSale(action(1000), { create })
    expect(await getFailedSales()).toHaveLength(1)
  })
})
