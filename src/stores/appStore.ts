import { useState, useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchRates, convertFromXOF } from '@/services/exchangeRate'

export type Lang = 'fr' | 'en' | 'es' | 'it'

interface AppState {
  lang:        Lang
  currency:    string
  setLang:     (l: Lang) => void
  setCurrency: (c: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang:        'fr',
      currency:    'XOF',
      setLang:     (lang) => set({ lang }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name:    'habashop-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)

// Helper i18n — sélectionne `lang` (primitive) → re-render garanti au changement.
export function useI18n() {
  const lang = useAppStore(s => s.lang)
  const i = (fr: string, en: string, es: string, it: string): string => {
    switch (lang) {
      case 'en': return en
      case 'es': return es
      case 'it': return it
      default:   return fr
    }
  }
  return { i, lang }
}

// Cache global des taux (en mémoire) — chargé au démarrage du module.
let cachedRates: Record<string, number> = {
  XOF: 1, XAF: 1,
  EUR: 0.001524, USD: 0.001639,
  GBP: 0.001295, CAD: 0.002237,
}
fetchRates().then(rates => { cachedRates = rates }).catch(() => {})

// Helper devise — sélectionne `currency` + convertit XOF → devise cible.
// Les montants backend sont en XOF ; la conversion est UNIQUEMENT à l'affichage.
export function useFmt() {
  const currency = useAppStore(s => s.currency)
  const [rates, setRates] = useState(cachedRates)

  useEffect(() => {
    fetchRates().then(r => {
      cachedRates = r
      setRates(r)
    }).catch(() => {})
  }, [])

  const fmt = useCallback((amountXOF: number): string => {
    const n = amountXOF ?? 0
    const converted = convertFromXOF(n, currency, rates)

    switch (currency) {
      case 'XOF':
      case 'XAF':
        // Franc CFA — pas de décimales, symbole F
        return `${Math.round(converted).toLocaleString('fr-FR')} F`
      case 'EUR':
        return `${converted.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      case 'USD':
        return `$${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'GBP':
        return `£${converted.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'CAD':
        return `CA$${converted.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      default:
        return `${Math.round(converted).toLocaleString('fr-FR')} ${currency}`
    }
  }, [currency, rates])

  return { fmt, currency, rates }
}
