import { logger } from '@/lib/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY = 'habashop_fx_rates'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 heures

// Taux de fallback (si API indisponible) — 1 XOF = ?
const FALLBACK_RATES: Record<string, number> = {
  XOF: 1,
  XAF: 1,         // parité fixe XOF/XAF
  EUR: 0.001524,  // 1 XOF ≈ 0.001524 EUR
  USD: 0.001639,  // 1 XOF ≈ 0.001639 USD
  GBP: 0.001295,  // 1 XOF ≈ 0.001295 GBP
  CAD: 0.002237,  // 1 XOF ≈ 0.002237 CAD
}

interface RatesCache {
  rates:     Record<string, number>
  fetchedAt: number
  base:      string
}

// Charge les taux depuis l'API ou le cache (base XOF)
export async function fetchRates(): Promise<Record<string, number>> {
  try {
    // Vérifie le cache AsyncStorage
    const cached = await AsyncStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed: RatesCache = JSON.parse(cached)
      const age = Date.now() - parsed.fetchedAt
      if (age < CACHE_TTL) {
        return parsed.rates
      }
    }

    // Fetch nouveaux taux (base XOF)
    const res = await fetch('https://open.er-api.com/v6/latest/XOF')
    if (!res.ok) throw new Error('HTTP ' + res.status)

    const data = await res.json()
    if (data.result !== 'success') throw new Error('API error')

    const rates = data.rates as Record<string, number>

    // Sauvegarde en cache
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      rates,
      fetchedAt: Date.now(),
      base: 'XOF',
    } as RatesCache))

    return rates
  } catch (err) {
    logger.warn('FX rates fetch failed, using fallback:', err)

    // Essaie le cache même périmé
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed: RatesCache = JSON.parse(cached)
        return parsed.rates
      }
    } catch {}

    return FALLBACK_RATES
  }
}

// Convertit un montant XOF → devise cible
export function convertFromXOF(
  amountXOF: number,
  targetCurrency: string,
  rates: Record<string, number>,
): number {
  if (targetCurrency === 'XOF') return amountXOF
  if (targetCurrency === 'XAF') return amountXOF // parité fixe
  const rate = rates[targetCurrency]
  if (!rate) return amountXOF
  return amountXOF * rate
}
