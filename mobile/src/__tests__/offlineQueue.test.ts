import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  enqueueAction, getQueue, getPendingCount,
  removeAction, incrementRetries, MAX_QUEUE_RETRIES,
} from '@/services/offlineQueue'
import type { SalePayload } from '@/types'

const QUEUE_KEY = 'habashop_offline_queue'
const payload = (total: number): SalePayload => ({
  items: [{ productId: 'p1', qty: 1, price: total }],
  total,
  paymentMode: 'cash',
  idempotencyKey: `key-${total}`,
})

beforeEach(async () => { await AsyncStorage.clear() })

describe('offlineQueue', () => {
  it('enqueue → action en attente avec retries initialisé à 0', async () => {
    await enqueueAction('SALE', payload(100))
    const q = await getQueue()
    expect(q).toHaveLength(1)
    expect(q[0]).toMatchObject({ type: 'SALE', retries: 0 })
    expect(q[0].payload.idempotencyKey).toBe('key-100')
    expect(await getPendingCount()).toBe(1)
  })

  it('préserve l’ordre FIFO d’insertion', async () => {
    await enqueueAction('SALE', payload(1))
    await enqueueAction('SALE', payload(2))
    await enqueueAction('SALE', payload(3))
    const totals = (await getQueue()).map(a => a.payload.total)
    expect(totals).toEqual([1, 2, 3])
  })

  it('incrementRetries incrémente uniquement l’action ciblée', async () => {
    await enqueueAction('SALE', payload(10))
    await enqueueAction('SALE', payload(20))
    const [a, b] = await getQueue()
    await incrementRetries(a.id)
    await incrementRetries(a.id)
    const q = await getQueue()
    expect(q.find(x => x.id === a.id)?.retries).toBe(2)
    expect(q.find(x => x.id === b.id)?.retries).toBe(0)
  })

  it('removeAction retire l’action (dequeue après succès/abandon)', async () => {
    await enqueueAction('SALE', payload(10))
    await enqueueAction('SALE', payload(20))
    const [a] = await getQueue()
    await removeAction(a.id)
    const q = await getQueue()
    expect(q).toHaveLength(1)
    expect(q[0].payload.total).toBe(20)
    expect(await getPendingCount()).toBe(1)
  })

  it('normalise l’ancien format sans champ retries → 0', async () => {
    // File écrite par une version antérieure (pas de `retries`).
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([
      { id: 'legacy', type: 'SALE', payload: payload(5), createdAt: '2026-01-01T00:00:00Z' },
    ]))
    const q = await getQueue()
    expect(q[0].retries).toBe(0)
  })

  it('MAX_QUEUE_RETRIES borne le nombre de tentatives', () => {
    expect(MAX_QUEUE_RETRIES).toBeGreaterThanOrEqual(1)
  })
})
