import axios from 'axios'
import { submitSaleResilient } from '@/services/saleSubmit'
import { isRetryableApiError } from '@/services/api'
import * as api from '@/services/api'
import * as queue from '@/services/offlineQueue'
import type { SalePayload } from '@/types'

const payload: SalePayload = {
  items: [{ productId: 'p1', qty: 1, price: 1000 }],
  total: 1000, paymentMode: 'cash', idempotencyKey: 'KEY-123',
}

// Erreur axios réaliste : sans status = timeout/réseau ; avec status = réponse serveur.
const axiosErr = (status?: number) =>
  new axios.AxiosError(
    status ? `HTTP ${status}` : 'timeout',
    status ? 'ERR_BAD_RESPONSE' : 'ECONNABORTED',
    undefined, undefined,
    status ? ({ status } as never) : undefined,
  )

const sale = (id: string) => ({ id, total: 1000, paymentMode: 'cash' }) as never

describe('isRetryableApiError', () => {
  it('retry sur timeout/réseau (pas de response) et 5xx', () => {
    expect(isRetryableApiError(axiosErr())).toBe(true)
    expect(isRetryableApiError(axiosErr(500))).toBe(true)
    expect(isRetryableApiError(axiosErr(503))).toBe(true)
  })
  it('PAS de retry sur 4xx ni erreur non-axios', () => {
    expect(isRetryableApiError(axiosErr(400))).toBe(false)
    expect(isRetryableApiError(axiosErr(401))).toBe(false)
    expect(isRetryableApiError(axiosErr(409))).toBe(false)
    expect(isRetryableApiError(new Error('boom'))).toBe(false)
  })
})

describe('submitSaleResilient', () => {
  afterEach(() => jest.restoreAllMocks())

  it('created dès le 1er succès, sans toucher la file', async () => {
    const create = jest.spyOn(api.salesApi, 'create').mockResolvedValue(sale('s1'))
    const enq = jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    const r = await submitSaleResilient(payload, [0, 0])
    expect(r).toEqual({ status: 'created', sale: expect.objectContaining({ id: 's1' }) })
    expect(create).toHaveBeenCalledTimes(1)
    expect(enq).not.toHaveBeenCalled()
  })

  it('retry sur timeout puis succès → created', async () => {
    const create = jest.spyOn(api.salesApi, 'create')
      .mockRejectedValueOnce(axiosErr())
      .mockResolvedValueOnce(sale('s2'))
    const enq = jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    const r = await submitSaleResilient(payload, [0, 0])
    expect(r.status).toBe('created')
    expect(create).toHaveBeenCalledTimes(2)
    expect(enq).not.toHaveBeenCalled()
  })

  it('timeout persistant → bascule en file offline (queued)', async () => {
    const create = jest.spyOn(api.salesApi, 'create').mockRejectedValue(axiosErr())
    const enq = jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    const r = await submitSaleResilient(payload, [0, 0])
    expect(r).toEqual({ status: 'queued' })
    expect(create).toHaveBeenCalledTimes(3) // 1 tentative + 2 retries
    expect(enq).toHaveBeenCalledWith('SALE', payload)
  })

  it('5xx persistant → queued', async () => {
    jest.spyOn(api.salesApi, 'create').mockRejectedValue(axiosErr(503))
    const enq = jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    const r = await submitSaleResilient(payload, [0])
    expect(r.status).toBe('queued')
    expect(enq).toHaveBeenCalledTimes(1)
  })

  it('4xx (validation/auth) → throw, JAMAIS mis en file', async () => {
    jest.spyOn(api.salesApi, 'create').mockRejectedValue(axiosErr(400))
    const enq = jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    await expect(submitSaleResilient(payload, [0, 0])).rejects.toBeTruthy()
    expect(enq).not.toHaveBeenCalled()
  })

  it('réutilise la MÊME clé d’idempotence à chaque tentative (jamais régénérée)', async () => {
    const create = jest.spyOn(api.salesApi, 'create')
      .mockRejectedValueOnce(axiosErr())
      .mockRejectedValueOnce(axiosErr())
      .mockResolvedValueOnce(sale('s3'))
    jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    await submitSaleResilient(payload, [0, 0])
    const keys = create.mock.calls.map(c => (c[0] as SalePayload).idempotencyKey)
    expect(keys).toEqual(['KEY-123', 'KEY-123', 'KEY-123'])
  })

  it('la clé envoyée en file = celle du payload (resync dédup côté backend)', async () => {
    jest.spyOn(api.salesApi, 'create').mockRejectedValue(axiosErr())
    const enq = jest.spyOn(queue, 'enqueueAction').mockResolvedValue()
    await submitSaleResilient(payload, [0])
    const queued = enq.mock.calls[0][1] as SalePayload
    expect(queued.idempotencyKey).toBe('KEY-123')
  })
})
