import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from '@/i18n'
import type { CartItem } from '@/components/pos/posShared'

export type Currency = 'XOF' | 'XAF' | 'EUR' | 'USD' | 'CAD' | 'GBP'
export type Lang     = 'fr' | 'en' | 'es' | 'it'
export type Theme    = 'dark' | 'darker' | 'midnight' | 'forest' | 'ocean' | 'sunset' | 'light' | 'gold' | 'soleil'
export type AppTheme = Theme

// ─── Taux par rapport à XOF (devise de base) ──────────────────────────────────
// 1 unité de devise = X XOF
const TO_XOF_RATES: Record<string, number> = {
  XOF: 1,
  XAF: 1,           // CFA Centrale = CFA Ouest
  EUR: 655.957,     // 1 EUR = 655.957 XOF (taux fixe légal)
  USD: 602,         // 1 USD ≈ 602 XOF
  CAD: 443,         // 1 CAD ≈ 443 XOF
  GBP: 763,         // 1 GBP ≈ 763 XOF
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', CAD: 'CA$', GBP: '£',
}

const CURRENCY_LOCALES: Record<Currency, string> = {
  XOF: 'fr-FR', XAF: 'fr-FR', EUR: 'fr-FR', USD: 'en-US', CAD: 'fr-CA', GBP: 'en-GB',
}

export const CURRENCY_DECIMALS: Record<Currency, number> = {
  XOF: 0, XAF: 0, EUR: 2, USD: 2, CAD: 2, GBP: 2,
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

/**
 * Convertit un montant stocké en XOF (devise pivot) vers la devise d'affichage.
 * @param amountXOF montant en francs CFA · @param toCurrency code devise cible (EUR/USD/…)
 * @returns montant converti dans la devise cible
 */
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
  langManuallySet: boolean      // l'utilisateur a choisi la langue → ne pas écraser via tenant
  theme: Theme
  sidebarCollapsed: boolean

  // Devises
  currency: Currency
  currencyManuallySet: boolean   // l'utilisateur a choisi la devise d'affichage → ne pas écraser
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
  enableAutoWhatsApp: boolean

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
  langManuallySet: false,
  theme: 'gold',
  sidebarCollapsed: false,

  currency: 'XOF',
  currencyManuallySet: false,
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
  enableAutoWhatsApp: false,

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
  const root = document.documentElement
  // Thème "gold" : on force le violet premium, indépendamment de l'accent choisi
  // (l'or vit dans --acc2). applyTheme() pose body.className='theme-gold' AVANT chaque
  // appel à applyAccentColor() → couvre tous les chemins (updateConfig UI, setTheme,
  // rehydrate, reset) sans devoir patcher chacun.
  if (document.body.className === 'theme-gold') {
    root.style.setProperty('--p',  '#7C3AED')
    root.style.setProperty('--p2', '#6D28D9')
    root.style.setProperty('--p3', '#8B5CF6')
    return
  }
  // Mode soleil : primaire violet profond verrouillé (AA sur blanc), indépendant de l'accent.
  if (document.body.className === 'theme-soleil') {
    root.style.setProperty('--p',  '#5B21B6')
    root.style.setProperty('--p2', '#6D28D9')
    root.style.setProperty('--p3', '#7C3AED')
    return
  }
  const pair = ACCENT_PAIRS[color]
  if (!pair) return
  root.style.setProperty('--p',  pair.p)
  root.style.setProperty('--p2', pair.p2)
  root.style.setProperty('--p3', pair.p3)
}

// ─── Thèmes (palettes CSS appliquées sur :root) ────────────────────────────────
export const THEMES: Record<Theme, { label: Record<string, string>; emoji: string; vars: Record<string, string> }> = {
  dark:     { label: { fr: 'Sombre', en: 'Dark', es: 'Oscuro', it: 'Scuro' }, emoji: '🌑',
    vars: { '--bg': '#07070F', '--bg2': '#0A0A16', '--bg3': '#0D0D1C', '--bg4': '#111128', '--bg5': '#161630', '--p': '#6C47FF', '--p2': '#8B6FFF', '--p3': '#A991FF', '--acc2': '#00D084', '--text': '#F0F0FF', '--text2': '#C4C4D4', '--text3': '#8888A8', '--card': '#0D0D1C', '--border': 'rgba(255,255,255,.07)' } },
  darker:   { label: { fr: 'Très sombre', en: 'Darker', es: 'Muy oscuro', it: 'Molto scuro' }, emoji: '⬛',
    vars: { '--bg': '#020208', '--bg2': '#050510', '--bg3': '#080814', '--bg4': '#0C0C1E', '--bg5': '#101025', '--p': '#7C57FF', '--p2': '#9B7FFF', '--p3': '#B9A1FF', '--acc2': '#00E090', '--text': '#F5F5FF', '--text2': '#CCCCDD', '--text3': '#7777AA', '--card': '#080814', '--card2': '#0C0C1E', '--grad-card': 'linear-gradient(160deg,#080814,#0C0C1E)', '--border': 'rgba(255,255,255,.05)', '--border2': 'rgba(255,255,255,.10)', '--text4': '#787891', '--header-bg': 'rgba(2,2,8,.88)' } },
  midnight: { label: { fr: 'Minuit', en: 'Midnight', es: 'Medianoche', it: 'Mezzanotte' }, emoji: '🌌',
    vars: { '--bg': '#020B18', '--bg2': '#041525', '--bg3': '#061C30', '--bg4': '#0A2540', '--bg5': '#0E2E4E', '--p': '#3B82F6', '--p2': '#60A5FA', '--p3': '#93C5FD', '--acc2': '#10B981', '--text': '#F0F9FF', '--text2': '#BAE6FD', '--text3': '#7CB9D8', '--card': '#061C30', '--card2': '#0A2540', '--grad-card': 'linear-gradient(160deg,#061C30,#0A2540)', '--border': 'rgba(59,130,246,.15)', '--border2': 'rgba(59,130,246,.28)', '--text4': '#6788A6', '--header-bg': 'rgba(2,11,24,.88)' } },
  forest:   { label: { fr: 'Forêt', en: 'Forest', es: 'Bosque', it: 'Foresta' }, emoji: '🌲',
    vars: { '--bg': '#030D08', '--bg2': '#051408', '--bg3': '#071A0C', '--bg4': '#0A2212', '--bg5': '#0E2C18', '--p': '#22C55E', '--p2': '#4ADE80', '--p3': '#86EFAC', '--acc2': '#34D399', '--text': '#F0FDF4', '--text2': '#BBF7D0', '--text3': '#6EE7B7', '--card': '#071A0C', '--card2': '#0A2212', '--grad-card': 'linear-gradient(160deg,#071A0C,#0A2212)', '--border': 'rgba(34,197,94,.15)', '--border2': 'rgba(34,197,94,.28)', '--text4': '#558C70', '--header-bg': 'rgba(3,13,8,.88)' } },
  ocean:    { label: { fr: 'Océan', en: 'Ocean', es: 'Océano', it: 'Oceano' }, emoji: '🌊',
    vars: { '--bg': '#020A14', '--bg2': '#041220', '--bg3': '#061A2E', '--bg4': '#0A2440', '--bg5': '#0E2E52', '--p': '#06B6D4', '--p2': '#22D3EE', '--p3': '#67E8F9', '--acc2': '#2DD4BF', '--text': '#ECFEFF', '--text2': '#A5F3FC', '--text3': '#67C8D8', '--card': '#061A2E', '--card2': '#0A2440', '--grad-card': 'linear-gradient(160deg,#061A2E,#0A2440)', '--border': 'rgba(6,182,212,.15)', '--border2': 'rgba(6,182,212,.28)', '--text4': '#5A8A9C', '--header-bg': 'rgba(2,10,20,.88)' } },
  sunset:   { label: { fr: 'Coucher de soleil', en: 'Sunset', es: 'Atardecer', it: 'Tramonto' }, emoji: '🌅',
    vars: { '--bg': '#140A02', '--bg2': '#200F04', '--bg3': '#2C1506', '--bg4': '#3C1E0A', '--bg5': '#4A2610', '--p': '#F97316', '--p2': '#FB923C', '--p3': '#FDBA74', '--acc2': '#FCD34D', '--text': '#FFF7ED', '--text2': '#FED7AA', '--text3': '#F8A96B', '--card': '#2C1506', '--card2': '#3C1E0A', '--grad-card': 'linear-gradient(160deg,#2C1506,#3C1E0A)', '--border': 'rgba(249,115,22,.15)', '--border2': 'rgba(249,115,22,.28)', '--text4': '#9E7E65', '--header-bg': 'rgba(20,10,2,.88)' } },
  light:    { label: { fr: 'Clair', en: 'Light', es: 'Claro', it: 'Chiaro' }, emoji: '☀️',
    vars: { '--bg': '#F8F9FF', '--bg2': '#F0F2FF', '--bg3': '#E8EBFF', '--bg4': '#FFFFFF', '--bg5': '#F4F5FF', '--p': '#6C47FF', '--p2': '#8B6FFF', '--p3': '#6C47FF', '--acc2': '#059669', '--text': '#1A1A2E', '--text2': '#374151', '--text3': '#626976', '--card': '#FFFFFF', '--border': 'rgba(0,0,0,.1)' } },
  gold:     { label: { fr: 'Violet & Or', en: 'Violet & Gold', es: 'Violeta & Oro', it: 'Viola & Oro' }, emoji: '✨',
    vars: { '--bg': '#0A0A0F', '--bg2': '#0F0F1A', '--bg3': '#141428', '--bg4': '#1A1A35', '--bg5': '#1F1F40', '--p': '#7C3AED', '--p2': '#6D28D9', '--p3': '#8B5CF6', '--acc2': '#EAB308', '--acc3': '#FCD34D', '--text': '#F8FAFC', '--text2': '#CBD5E1', '--text3': '#94A3B8', '--text4': '#748297', '--card': '#0F0F1A', '--card2': '#141428', '--border': 'rgba(139,92,246,0.2)', '--border2': 'rgba(234,179,8,0.2)', '--grad-card': 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(234,179,8,0.04) 100%)', '--header-bg': 'rgba(10,10,15,0.85)', '--shadow': 'rgba(0,0,0,0.6)', '--danger': '#EF4444', '--warn': '#F59E0B', '--acc': '#10B981' } },
  // « Mode soleil » : thème clair HAUT-CONTRASTE pour usage en étal extérieur (plein soleil).
  // Texte quasi-noir, surfaces blanches pures, bordures fortes, accents profonds AA sur blanc.
  // Activable d'un tap via le bouton ☀️ du header (SunModeToggle) ; primaire violet verrouillé
  // (applyAccentColor) pour garantir l'AA quelle que soit la couleur d'accent choisie.
  soleil:   { label: { fr: 'Mode soleil', en: 'Sun mode', es: 'Modo sol', it: 'Modalità sole' }, emoji: '🔆',
    vars: { '--bg': '#FFFFFF', '--bg2': '#FFFFFF', '--bg3': '#EFEFF2', '--bg4': '#FFFFFF', '--bg5': '#F6F6F8', '--bg6': '#FFFFFF', '--p': '#5B21B6', '--p2': '#6D28D9', '--p3': '#7C3AED', '--acc': '#047857', '--acc2': '#047857', '--text': '#000000', '--text2': '#1A1A22', '--text3': '#3A3A45', '--text4': '#55555F', '--card': '#FFFFFF', '--card2': '#F6F6F8', '--card3': '#EFEFF2', '--border': 'rgba(0,0,0,.30)', '--border2': 'rgba(0,0,0,.45)', '--grad-card': 'linear-gradient(160deg,#FFFFFF,#F6F6F8)', '--header-bg': 'rgba(255,255,255,.95)', '--danger': '#C81E1E', '--warn': '#B45309', '--success': '#047857', '--info': '#1D4ED8' } },
}

// Vars de surface NON couvertes par THEMES[*].vars (sinon issues du :root sombre d'index.css).
// Injectées en mode CLAIR ; retirées sinon → le :root (sombre) reprend (pas de valeur claire "collée").
const LIGHT_EXTRA_VARS: Record<string, string> = {
  '--card2':     '#F0EEFF',
  '--card3':     '#EBE8FF',
  '--bg6':       '#FAFAFE',
  '--grad-card': 'linear-gradient(135deg,#F7F5FF,#EEEAFF)',
  '--text4':     '#686677', /* éclairci → AA small-text sur surfaces claires (était #B0ADCA, ratio 1.8) */
  '--border2':   'rgba(0,0,0,0.14)',
  '--c-amber-bg':     'rgba(255,184,0,.08)',  /* ambre légèrement plus visible en clair */
  '--c-amber-border': 'rgba(255,184,0,.20)',
  '--header-bg':      'rgba(248,249,255,.85)',  /* barre du haut translucide claire */
}

export function applyTheme(theme: Theme) {
  const t = THEMES[theme] ?? THEMES.dark
  const root = document.documentElement
  // 'soleil' est un thème clair haut-contraste → même traitement light que 'light'.
  const isLight = theme === 'light' || theme === 'soleil'
  Object.entries(t.vars).forEach(([k, val]) => root.style.setProperty(k, val))
  // Surfaces manquantes : valeurs claires en mode clair (sauf si le thème les définit déjà
  // dans ses vars → soleil garde ses surfaces blanches pures) ; sinon retrait → :root sombre.
  Object.entries(LIGHT_EXTRA_VARS).forEach(([k, val]) => {
    if (isLight) { if (!(k in t.vars)) root.style.setProperty(k, val) }
    else if (!(k in t.vars)) root.style.removeProperty(k)
  })
  // Rendu natif des contrôles (popup <select>, autofill Chrome, scrollbars).
  root.style.setProperty('color-scheme', isLight ? 'light' : 'dark')
  root.setAttribute('data-theme', isLight ? 'light' : 'dark')
  document.body.className = `theme-${theme}`
}

// ─── Tenant ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  plan: string
  currency: string
  country: string
  vatRate: number
  address?: string | null
  phone?: string | null
  email?: string | null
  logo?: string | null
  createdAt?: string
  // Fidélité configurable (défauts v1 si absents)
  pointsPerAmount?: number
  bronzeThreshold?: number
  silverThreshold?: number
  // Loyalty v2 : remises par palier (0 = désactivées)
  bronzeDiscount?: number
  silverDiscount?: number
  goldDiscount?: number
  enableLoyalty?: boolean
}

const TRIAL_DAYS = 14
const FREE_PLANS = ['starter', 'trial', 'free']

// Calcule l'état d'essai d'un tenant (essai = createdAt + 14j sur les plans gratuits)
export function getTrialInfo(tenant: Tenant | null): { isTrial: boolean; daysLeft: number } {
  if (!tenant?.createdAt || !FREE_PLANS.includes(tenant.plan?.toLowerCase())) {
    return { isTrial: false, daysLeft: 0 }
  }
  const end = new Date(tenant.createdAt).getTime() + TRIAL_DAYS * 86_400_000
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86_400_000))
  return { isTrial: true, daysLeft }
}

// ─── Store interface ───────────────────────────────────────────────────────────

interface AppStore extends AppConfig {
  // Tenant courant
  tenant: Tenant | null
  setTenant: (t: Tenant | null) => void
  clearTenant: () => void
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
  // Panier POS persisté (survit nav + refresh)
  cart: CartItem[]
  addCartItem:    (item: CartItem) => void
  updateCartQty:  (id: number | string, delta: number, newPrice?: number, tierLabel?: string) => void
  removeCartItem: (id: number | string) => void
  setCart:        (cart: CartItem[]) => void
  clearCart:      () => void
  // Taux de change live (runtime only, non persisté)
  currencyRates: Record<string, number>
  fetchExchangeRates: () => Promise<void>
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CONFIG,

      // Tenant courant
      tenant: null,
      // Langue & devise = préférences d'AFFICHAGE per-device. tenant.currency/lang ne sert
      // que de DÉFAUT à la première visite (aucun choix manuel) ; dès que l'utilisateur a
      // choisi (`*ManuallySet`), setTenant NE l'écrase JAMAIS — la valeur persistée
      // localStorage est conservée au refresh / re-login / redéploiement.
      setTenant:   (tenant) => set((state) => {
        const tc = tenant?.currency
        const valid = tc && (['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP'] as const).includes(tc as Currency)
        const tl = (tenant as { lang?: string } | null)?.lang
        const validLang = tl && (['fr', 'en', 'es', 'it'] as const).includes(tl as Lang)
        return {
          tenant,
          currency: (!state.currencyManuallySet && valid) ? (tc as Currency) : state.currency,
          lang:     (!state.langManuallySet && validLang) ? (tl as Lang) : state.lang,
        }
      }),
      clearTenant: () => set({ tenant: null }),

      updateConfig: (partial) => {
        set(partial as Partial<AppStore>)
        const st = get()
        if (partial.theme) applyTheme(st.theme)
        if (partial.theme || partial.accentColor) applyAccentColor(st.accentColor)
      },

      resetConfig: () => {
        set({ ...(DEFAULT_CONFIG as Partial<AppStore>) })
        applyTheme(DEFAULT_CONFIG.theme)
        applyAccentColor(DEFAULT_CONFIG.accentColor)
      },

      exportConfig: () => {
        const s = get()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { updateConfig, resetConfig, exportConfig, importConfig, setTheme, setLang, setCurrency, tenant, setTenant, clearTenant, ...cfg } = s
        return JSON.stringify(cfg, null, 2)
      },

      importConfig: (json: string) => {
        try {
          const cfg = JSON.parse(json) as Partial<AppConfig>
          set(cfg as Partial<AppStore>)
          if (cfg.theme)       applyTheme(cfg.theme)
          if (cfg.accentColor) applyAccentColor(cfg.accentColor)
        } catch {
          // silently fail — caller should show error
        }
      },

      setTheme:    (theme)    => { set({ theme }); applyTheme(theme); applyAccentColor(get().accentColor) },
      // Choix EXPLICITE → on marque la préférence pour que setTenant ne l'écrase plus.
      setLang:     (lang)     => set({ lang, langManuallySet: true }),
      setCurrency: (currency) => set({ currency, currencyManuallySet: true }),

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

      // ── Panier POS persisté ──
      // Le price (et tierLabel) sont calculés par POS.tsx via resolveTierPrice
      // (logique métier qui dépend du tenant + clientType) et passés au store.
      cart: [],

      addCartItem: (item) => set(s => ({
        cart: s.cart.some(i => i.id === item.id)
          ? s.cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
          : [...s.cart, item],
      })),

      updateCartQty: (id, delta, newPrice, tierLabel) => set(s => ({
        cart: s.cart
          .map(i => i.id === id
            ? {
                ...i,
                qty: i.qty + delta,
                ...(newPrice !== undefined ? { price: newPrice } : {}),
                ...(tierLabel !== undefined ? { tierLabel } : {}),
              }
            : i)
          .filter(i => i.qty > 0),
      })),

      removeCartItem: (id) => set(s => ({
        cart: s.cart.filter(i => i.id !== id),
      })),

      setCart: (cart) => set({ cart }),

      clearCart: () => set({ cart: [] }),

      // Taux de change live
      currencyRates: { ...TO_XOF_RATES },

      fetchExchangeRates: async () => {
        try {
          const res  = await fetch('https://api.exchangerate-api.com/v4/latest/XOF')
          const data = await res.json()
          if (data?.rates) {
            const newRates: Partial<Record<Currency, number>> = {}
            ;(['EUR', 'USD', 'CAD', 'GBP'] as Currency[]).forEach(c => {
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
      // Fusion à la réhydratation (utilisateur de retour). Backfill des flags manuels
      // pour les états persistés AVANT leur introduction : une préférence devise/langue
      // déjà sauvegardée = un choix à CONSERVER (le spec : « défaut tenant uniquement en
      // 1ʳᵉ visite »). Sinon setTenant l'écraserait une fois au 1er chargement post-déploiement.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppConfig>
        return {
          ...current,
          ...p,
          currencyManuallySet: p.currencyManuallySet ?? (p.currency != null),
          langManuallySet:     p.langManuallySet     ?? (p.lang != null),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.theme)       applyTheme(state.theme)
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
/**
 * Hook de formatage des montants, réactif à la devise courante du store.
 * Convertit depuis XOF (devise de stockage) vers la devise d'affichage.
 * @returns une fonction `(amountXOF) => string` formatée dans la devise active
 */
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
    code:     currency,
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

// Hook — abrège un montant XOF dans la devise courante (axes de graphiques)
// Convertit puis abrège (k/M) pour rester correct quelle que soit la devise.
export function useAbbrevAmount() {
  const currency = useAppStore(s => s.currency)
  return (amountInXOF: number): string => {
    const c = convertAmount(amountInXOF, 'XOF', currency)
    const abs = Math.abs(c)
    if (abs >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)     return `${Math.round(c / 1_000)}k`
    return String(Math.round(c))
  }
}

// ─── Dates localisées ────────────────────────────────────────────────────────
const DATE_LOCALES: Record<string, string> = {
  fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT',
}

export function formatDate(date: string | Date, lang: string, options?: Intl.DateTimeFormatOptions): string {
  const locale = DATE_LOCALES[lang] ?? 'fr-FR'
  return new Date(date).toLocaleDateString(locale, options ?? { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(date: string | Date, lang: string): string {
  const locale = DATE_LOCALES[lang] ?? 'fr-FR'
  return new Date(date).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
