import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from '@/i18n'

export type Currency = 'XOF' | 'XAF' | 'EUR' | 'USD' | 'CAD' | 'GBP' | 'MAD' | 'DZD' | 'TND' | 'CHF'
export type Lang     = 'fr' | 'en' | 'es' | 'it'
export type Theme    = 'dark' | 'light'

// ─── Taux par rapport à XOF (devise de base) ──────────────────────────────────
// 1 unité de devise = X XOF
const TO_XOF_RATES: Record<string, number> = {
  XOF: 1,
  XAF: 1,           // CFA Centrale = CFA Ouest
  EUR: 655.957,     // 1 EUR = 655.957 XOF (taux fixe légal)
  USD: 602,         // 1 USD ≈ 602 XOF
  CAD: 443,         // 1 CAD ≈ 443 XOF
  GBP: 763,         // 1 GBP ≈ 763 XOF
  MAD: 60.7,        // 1 MAD ≈ 60.7 XOF
  DZD: 4.45,        // 1 DZD ≈ 4.45 XOF
  TND: 195.8,       // 1 TND ≈ 195.8 XOF
  CHF: 676,         // 1 CHF ≈ 676 XOF
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$',
  CAD: 'CA$',  GBP: '£',    MAD: 'MAD', DZD: 'DA', TND: 'TND', CHF: 'CHF',
}

const CURRENCY_LOCALES: Record<Currency, string> = {
  XOF: 'fr-FR', XAF: 'fr-FR', EUR: 'fr-FR', USD: 'en-US',
  CAD: 'fr-CA', GBP: 'en-GB', MAD: 'fr-MA', DZD: 'fr-DZ', TND: 'fr-TN', CHF: 'de-CH',
}

export const CURRENCY_DECIMALS: Record<Currency, number> = {
  XOF: 0, XAF: 0, MAD: 2, DZD: 0, TND: 3,
  EUR: 2, USD: 2, CAD: 2, GBP: 2, CHF: 2,
}

// ─── Conversion ────────────────────────────────────────────────────────────────

// Convertit entre deux devises via XOF comme pivot universel
export function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  if (!amount || amount === 0) return 0
  if (fromCurrency === toCurrency) return amount
  const rateFrom = TO_XOF_RATES[fromCurrency] ?? 1
  const rateTo   = TO_XOF_RATES[toCurrency]   ?? 1
  return (amount * rateFrom) / rateTo
}
export const convertCurrency = convertAmount // backward-compat

// Convertit un montant XOF vers la devise cible
export function convertFromXOF(amountXOF: number, toCurrency: string): number {
  return convertAmount(amountXOF, 'XOF', toCurrency)
}

// Convertit vers XOF depuis une devise source
export function convertToXOF(amount: number, fromCurrency: string): number {
  return convertAmount(amount, fromCurrency, 'XOF')
}

// Formate un montant XOF dans la devise d'affichage (conversion incluse)
export function formatAmount(amountXOF: number, displayCurrency: string): string {
  return formatInCurrency(convertFromXOF(amountXOF, displayCurrency), displayCurrency)
}

// ─── AppConfig ─────────────────────────────────────────────────────────────────

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

// ─── Store interface ───────────────────────────────────────────────────────────

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
  // Taux de change live (runtime only, non persisté)
  currencyRates: Record<string, number>
  fetchExchangeRates: () => Promise<void>
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

      // Taux de change live
      currencyRates: { ...TO_XOF_RATES },

      fetchExchangeRates: async () => {
        try {
          const res  = await fetch('https://api.exchangerate-api.com/v4/latest/XOF')
          const data = await res.json()
          if (data?.rates) {
            const newRates: Partial<Record<Currency, number>> = {}
            ;(['EUR', 'USD', 'CAD', 'GBP', 'MAD', 'DZD', 'TND', 'CHF'] as Currency[]).forEach(c => {
              if (data.rates[c] && data.rates[c] > 0) newRates[c] = 1 / data.rates[c]
            })
            set(state => ({
              currencyRates: { ...state.currencyRates, ...newRates },
            }))
          }
        } catch {
          // Silencieux — utilise les taux par défaut
        }
      },
    }),
    {
      name: 'habashop-config',
      partialize: (state) => {
        // Ne pas persister les taux live (recalculés au démarrage)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { currencyRates, fetchExchangeRates, ...rest } = state
        return rest
      },
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

// ─── Formatage ─────────────────────────────────────────────────────────────────

// Formate un montant directement dans une devise SANS conversion
export function formatInCurrency(amount: number, currency: string): string {
  const n = Number(amount) || 0
  const configs: Record<string, { locale: string; minimumFractionDigits: number; suffix?: string; prefix?: string }> = {
    XOF: { locale: 'fr-FR', minimumFractionDigits: 0, suffix: ' FCFA' },
    XAF: { locale: 'fr-FR', minimumFractionDigits: 0, suffix: ' FCFA' },
    EUR: { locale: 'fr-FR', minimumFractionDigits: 2, suffix: ' €'    },
    USD: { locale: 'en-US', minimumFractionDigits: 2, prefix: '$'     },
    CAD: { locale: 'fr-CA', minimumFractionDigits: 2, suffix: ' CA$'  },
    GBP: { locale: 'en-GB', minimumFractionDigits: 2, prefix: '£'     },
    MAD: { locale: 'fr-MA', minimumFractionDigits: 2, suffix: ' MAD'  },
    DZD: { locale: 'fr-DZ', minimumFractionDigits: 0, suffix: ' DA'   },
    TND: { locale: 'fr-TN', minimumFractionDigits: 3, suffix: ' TND'  },
    CHF: { locale: 'de-CH', minimumFractionDigits: 2, suffix: ' CHF'  },
  }
  const cfg = configs[currency] ?? configs.XOF
  try {
    const str = new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: cfg.minimumFractionDigits,
      maximumFractionDigits: cfg.minimumFractionDigits,
    }).format(n)
    return `${cfg.prefix ?? ''}${str}${cfg.suffix ?? ''}`
  } catch {
    return `${n.toFixed(cfg.minimumFractionDigits)} ${currency}`
  }
}

// Hook React — montants stockés en XOF, convertis + formatés à l'affichage
export function useFormatAmount() {
  const currency = useAppStore(s => s.currency)
  return (amountInXOF: number): string => {
    const converted = convertAmount(amountInXOF, 'XOF', currency)
    return formatInCurrency(converted, currency)
  }
}

// Hook — convertit XOF → devise affichée
export function useConvertFromXOF() {
  const currency = useAppStore(s => s.currency)
  return (xof: number): number => convertAmount(xof, 'XOF', currency)
}

// Hook — convertit devise affichée → XOF (pour stocker une saisie utilisateur)
export function useConvertToXOF() {
  const currency = useAppStore(s => s.currency)
  return (amount: number): number => convertAmount(amount, currency, 'XOF')
}

// Hook — infos sur la devise courante
export function useCurrencyInfo() {
  const currency = useAppStore(s => s.currency) as Currency
  return {
    currency,
    symbol:   CURRENCY_SYMBOLS[currency]  ?? currency,
    decimals: CURRENCY_DECIMALS[currency] ?? 2,
    locale:   CURRENCY_LOCALES[currency]  ?? 'fr-FR',
  }
}

// Hook pour conversion avec infos devise (backward-compat)
export function useConvertAmount() {
  const currency = useAppStore(s => s.currency) as Currency
  return {
    toDisplay:  (xof: number)    => convertAmount(xof, 'XOF', currency),
    toXOF:      (amount: number) => convertAmount(amount, currency, 'XOF'),
    currency,
    symbol:   CURRENCY_SYMBOLS[currency]  ?? currency,
    decimals: CURRENCY_DECIMALS[currency] ?? 2,
  }
}

// Backward-compat (non-hook, éviter dans les composants)
export function formatCurrency(amount: number, currency?: Currency): string {
  const curr = currency ?? useAppStore.getState().currency
  return formatAmount(amount, curr)
}

// ─── i18n ──────────────────────────────────────────────────────────────────────

export function t(key: string): string {
  const { lang } = useAppStore.getState()
  return translations[lang]?.[key] ?? translations.fr[key] ?? key
}

export function useT() {
  const { lang } = useAppStore()
  void lang
  return t
}
