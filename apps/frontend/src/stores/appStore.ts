import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'
type Lang = 'fr' | 'en'
type Currency = 'XOF' | 'EUR' | 'USD' | 'CAD'

interface AppState {
  theme: Theme
  lang: Lang
  currency: Currency
  sidebarOpen: boolean
  setTheme: (t: Theme) => void
  setLang: (l: Lang) => void
  setCurrency: (c: Currency) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      lang: 'fr',
      currency: 'XOF',
      sidebarOpen: true,
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute('data-theme', theme)
      },
      setLang: (lang) => set({ lang }),
      setCurrency: (currency) => set({ currency }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'habashop-app' }
  )
)

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  XOF: 'F CFA',
  EUR: '€',
  USD: '$',
  CAD: 'CA$',
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  if (currency === 'XOF') {
    return `${Math.round(amount).toLocaleString('fr-FR')} ${symbol}`
  }
  return `${symbol}${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
