import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme    = 'dark' | 'light'
type Lang     = 'fr' | 'en'
type Currency = 'XOF' | 'EUR' | 'USD' | 'CAD'

interface AppState {
  theme: Theme; lang: Lang; currency: Currency;
  setTheme: (t: Theme) => void
  setLang:  (l: Lang)  => void
  setCurrency: (c: Currency) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark', lang: 'fr', currency: 'XOF',
      setTheme: (theme) => { set({ theme }); document.documentElement.setAttribute('data-theme', theme) },
      setLang:  (lang)  => set({ lang }),
      setCurrency: (currency) => set({ currency }),
    }),
    { name: 'habashop-app' }
  )
)

const SYMBOLS: Record<Currency, string> = { XOF: 'F CFA', EUR: '€', USD: '$', CAD: 'CA$' }

export function formatCurrency(amount: number, currency: Currency): string {
  const sym = SYMBOLS[currency]
  if (currency === 'XOF') return `${Math.round(amount).toLocaleString('fr-FR')} ${sym}`
  return `${sym}${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
