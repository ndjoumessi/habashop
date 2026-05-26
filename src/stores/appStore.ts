import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

// Helper devise — sélectionne `currency` → fmt se recalcule au changement.
export function useFmt() {
  const currency = useAppStore(s => s.currency)
  const fmt = (n: number): string => {
    const amount = n ?? 0
    switch (currency) {
      case 'XOF':
      case 'XAF':
        // Franc CFA — pas de décimales, symbole F
        return `${Math.round(amount).toLocaleString('fr-FR')} F`
      case 'EUR':
        return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      case 'USD':
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'GBP':
        return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'CAD':
        return `CA$${amount.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      default:
        return `${Math.round(amount).toLocaleString('fr-FR')} ${currency}`
    }
  }
  return { fmt, currency }
}
