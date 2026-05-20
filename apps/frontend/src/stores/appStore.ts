import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from '@/i18n'

export type Currency = 'XOF' | 'XAF' | 'EUR' | 'USD' | 'CAD'
export type Lang     = 'fr' | 'en' | 'es' | 'it'
export type Theme    = 'dark' | 'light'

export interface AppConfig {
  // Identité boutique
  shopName: string
  shopSlogan: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  shopLogo: string | null
  shopCountry: string
  shopCurrency: Currency
  shopVatRate: number
  shopSiret: string

  // Interface
  lang: Lang
  theme: Theme
  sidebarCollapsed: boolean

  // Devises
  currency: Currency
  showCurrencyConverter: boolean

  // POS
  posDefaultPayment: 'cash' | 'card' | 'mobile'
  posShowStockOnTile: boolean
  posAutoprint: boolean
  posVatIncluded: boolean
  posTaxRate: number
  enableLoyalty: boolean
  requireCashier: boolean
  priceMode: 'TTC' | 'HT'
  defaultCashier: number
  posDefaultFund: number
  enableScanner: boolean
  autoWhatsApp: boolean

  // Stock
  stockLowThreshold: number
  stockAutoOrder: boolean
  stockShowSKU: boolean

  // Notifications
  notifEmailSales: boolean
  notifEmailStock: boolean
  notifEmailPayroll: boolean
  notifSmsSales: boolean
  notifSmsStock: boolean
  notifPushAll: boolean
  notifStockEmail: string

  // Sécurité
  twoFAEnabled: boolean
  sessionTimeout: number
  maxLoginAttempts: number

  // Apparence avancée
  accentColor: string
  compactMode: boolean
  showAnimations: boolean
  tableRowsPerPage: number
}

export const DEFAULT_CONFIG: AppConfig = {
  shopName: 'HabaShop — Dakar Central',
  shopSlogan: 'Votre commerce, géré simplement',
  shopAddress: 'Rue 10 × 23, Dakar, Sénégal',
  shopPhone: '+221 77 000 00 00',
  shopEmail: 'contact@habashop.com',
  shopLogo: null,
  shopCountry: 'Sénégal',
  shopCurrency: 'XOF',
  shopVatRate: 18,
  shopSiret: 'SN-2026-001234',

  lang: 'fr',
  theme: 'dark',
  sidebarCollapsed: false,

  currency: 'XOF',
  showCurrencyConverter: true,

  posDefaultPayment: 'cash',
  posShowStockOnTile: true,
  posAutoprint: false,
  posVatIncluded: true,
  posTaxRate: 18,
  enableLoyalty: false,
  requireCashier: false,
  priceMode: 'TTC',
  defaultCashier: 0,
  posDefaultFund: 0,
  enableScanner: false,
  autoWhatsApp: false,

  stockLowThreshold: 10,
  stockAutoOrder: false,
  stockShowSKU: true,

  notifEmailSales: true,
  notifEmailStock: true,
  notifEmailPayroll: false,
  notifSmsSales: false,
  notifSmsStock: true,
  notifPushAll: true,
  notifStockEmail: 'contact@habashop.com',

  twoFAEnabled: false,
  sessionTimeout: 30,
  maxLoginAttempts: 5,

  accentColor: '#5B4EE8',
  compactMode: false,
  showAnimations: true,
  tableRowsPerPage: 25,
}

export const ACCENT_PAIRS: Record<string, { p: string; p2: string; p3: string }> = {
  '#5B4EE8': { p: '#5B4EE8', p2: '#7C6FF0', p3: '#A89CF5' },
  '#3B82F6': { p: '#3B82F6', p2: '#60A5FA', p3: '#93C5FD' },
  '#10B981': { p: '#10B981', p2: '#34D399', p3: '#6EE7B7' },
  '#F59E0B': { p: '#F59E0B', p2: '#FCD34D', p3: '#FDE68A' },
  '#EF4444': { p: '#EF4444', p2: '#F87171', p3: '#FCA5A5' },
  '#EC4899': { p: '#EC4899', p2: '#F472B6', p3: '#F9A8D4' },
}

function applyAccentColor(color: string) {
  const pair = ACCENT_PAIRS[color]
  if (!pair) return
  const root = document.documentElement
  root.style.setProperty('--p',  pair.p)
  root.style.setProperty('--p2', pair.p2)
  root.style.setProperty('--p3', pair.p3)
}

interface AppStore extends AppConfig {
  updateConfig: (partial: Partial<AppConfig>) => void
  resetConfig:  () => void
  exportConfig: () => string
  importConfig: (json: string) => void
  // backward-compat setters
  setTheme:    (t: Theme)    => void
  setLang:     (l: Lang)     => void
  setCurrency: (c: Currency) => void
  // Settings lock
  settingsLocked: boolean
  lockSettings:   () => void
  unlockSettings: () => void
  // Caisse persistante
  cashierOpen: boolean
  cashierOpenedAt: string | null
  cashierOpeningFund: number
  cashierSessionTx: number
  cashierSessionCA: number
  openCashier: (fund: number) => void
  closeCashier: () => void
  addCashierSale: (amount: number) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CONFIG,

      updateConfig: (partial) => {
        set(partial as Partial<AppStore>)
        if (partial.theme)       document.documentElement.setAttribute('data-theme', partial.theme)
        if (partial.accentColor) applyAccentColor(partial.accentColor)
      },

      resetConfig: () => {
        set({ ...(DEFAULT_CONFIG as Partial<AppStore>) })
        document.documentElement.setAttribute('data-theme', DEFAULT_CONFIG.theme)
        applyAccentColor(DEFAULT_CONFIG.accentColor)
      },

      exportConfig: () => {
        const s = get()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { updateConfig, resetConfig, exportConfig, importConfig, setTheme, setLang, setCurrency, ...cfg } = s
        return JSON.stringify(cfg, null, 2)
      },

      importConfig: (json: string) => {
        try {
          const cfg = JSON.parse(json) as Partial<AppConfig>
          set(cfg as Partial<AppStore>)
          if (cfg.theme)       document.documentElement.setAttribute('data-theme', cfg.theme)
          if (cfg.accentColor) applyAccentColor(cfg.accentColor)
        } catch {
          // silently fail — caller should show error
        }
      },

      setTheme:    (theme)    => { set({ theme });    document.documentElement.setAttribute('data-theme', theme) },
      setLang:     (lang)     => set({ lang }),
      setCurrency: (currency) => set({ currency }),

      // Settings lock
      settingsLocked: false,
      lockSettings:   () => set({ settingsLocked: true }),
      unlockSettings: () => set({ settingsLocked: false }),

      // Caisse persistante
      cashierOpen:        false,
      cashierOpenedAt:    null,
      cashierOpeningFund: 0,
      cashierSessionTx:   0,
      cashierSessionCA:   0,

      openCashier: (fund) => set({
        cashierOpen:        true,
        cashierOpenedAt:    new Date().toISOString(),
        cashierOpeningFund: fund,
        cashierSessionTx:   0,
        cashierSessionCA:   0,
      }),

      closeCashier: () => set({
        cashierOpen:        false,
        cashierOpenedAt:    null,
        cashierOpeningFund: 0,
        cashierSessionTx:   0,
        cashierSessionCA:   0,
      }),

      addCashierSale: (amount) => set(state => ({
        cashierSessionTx: state.cashierSessionTx + 1,
        cashierSessionCA: state.cashierSessionCA + amount,
      })),
    }),
    {
      name: 'habashop-config',
      onRehydrateStorage: () => (state) => {
        if (state?.theme)       document.documentElement.setAttribute('data-theme', state.theme)
        if (state?.accentColor) applyAccentColor(state.accentColor)
      },
    }
  )
)

export function useConfig() {
  return useAppStore()
}

export function formatCurrency(amount: number, currency?: Currency): string {
  const curr = currency ?? useAppStore.getState().currency
  if (curr === 'XOF' || curr === 'XAF') {
    return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
  }
  if (curr === 'EUR') {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  }
  if (curr === 'USD') {
    return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `CA$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function t(key: string): string {
  const { lang } = useAppStore.getState()
  return translations[lang]?.[key] ?? translations.fr[key] ?? key
}

export function useT() {
  const { lang } = useAppStore()
  void lang
  return t
}

const RATES_TO_XOF: Record<Currency, number> = {
  XOF: 1, XAF: 1, EUR: 655.957, USD: 600, CAD: 440,
}

export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount
  const inXOF = from === 'XOF' ? amount : amount * RATES_TO_XOF[from]
  return to === 'XOF' ? inXOF : inXOF / RATES_TO_XOF[to]
}

export const convertAmount = convertCurrency

export function useFormatAmount() {
  const { currency } = useAppStore()

  return (amount: number): string => {
    const n = Number(amount) || 0

    const FORMATS: Record<string, { locale: string; options: Intl.NumberFormatOptions }> = {
      XOF: { locale:'fr-FR', options:{ style:'decimal', minimumFractionDigits:0, maximumFractionDigits:0 } },
      XAF: { locale:'fr-FR', options:{ style:'decimal', minimumFractionDigits:0, maximumFractionDigits:0 } },
      EUR: { locale:'fr-FR', options:{ style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2 } },
      USD: { locale:'en-US', options:{ style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 } },
      CAD: { locale:'fr-CA', options:{ style:'currency', currency:'CAD', minimumFractionDigits:2, maximumFractionDigits:2 } },
      GBP: { locale:'en-GB', options:{ style:'currency', currency:'GBP', minimumFractionDigits:2, maximumFractionDigits:2 } },
    }

    const converted = convertCurrency(n, 'XOF', currency)
    const fmt = FORMATS[currency] ?? FORMATS.XOF

    try {
      const formatted = new Intl.NumberFormat(fmt.locale, fmt.options).format(converted)
      if (currency === 'XOF') return `${formatted} FCFA`
      if (currency === 'XAF') return `${formatted} FCFA`
      return formatted
    } catch {
      return `${converted.toLocaleString()} ${currency}`
    }
  }
}
