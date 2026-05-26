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
    if (!n) return currency === 'XOF' ? '0 F' : `0 ${currency}`
    switch (currency) {
      case 'XOF':
      case 'XAF':
        return `${Math.round(n).toLocaleString('fr-FR')} F`
      case 'EUR':
        return `${n.toFixed(2)} €`
      case 'USD':
        return `$${n.toFixed(2)}`
      case 'GBP':
        return `£${n.toFixed(2)}`
      default:
        return `${n.toFixed(2)} ${currency}`
    }
  }
  return { fmt, currency }
}
