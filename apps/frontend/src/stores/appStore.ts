import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from '@/i18n'
import type { CartItem } from '@/components/pos/posShared'
import type { FreshnessMap, FreshnessKind } from '@/lib/dataFreshness'

export type Currency = 'XOF' | 'XAF' | 'EUR' | 'USD' | 'CAD' | 'GBP'
export type Lang     = 'fr' | 'en' | 'es' | 'it'
export type Theme    = 'dark' | 'light' | 'system'
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
  theme: 'dark',
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
  const pair = ACCENT_PAIRS[color]
  if (!pair) return
  root.style.setProperty('--p',  pair.p)
  root.style.setProperty('--p2', pair.p2)
  root.style.setProperty('--p3', pair.p3)
}

// ─── Thèmes (palettes CSS appliquées sur :root) ────────────────────────────────
// Set réduit à 3 options exposées : Sombre (NKONI, = :root d'index.css), Clair, Système.
// « Système » n'a pas de palette propre : il se résout en dark/light selon la préférence OS
// (resolveTheme + listener prefers-color-scheme plus bas). THEMES ne contient donc que les
// deux palettes concrètes.
export const THEMES: Record<'dark' | 'light', { label: Record<string, string>; emoji: string; vars: Record<string, string> }> = {
  dark:     { label: { fr: 'Sombre', en: 'Dark', es: 'Oscuro', it: 'Scuro' }, emoji: '🌑',
    vars: { '--bg': '#0A0C14', '--bg2': '#0D1019', '--bg3': '#11151F', '--bg4': '#161C2B', '--bg5': '#1B2233', '--p': '#6C47FF', '--p2': '#8B6FFF', '--p3': '#A991FF', '--acc2': '#22C77A', '--text': '#EAEEF6', '--text2': '#AAB2C4', '--text3': '#8E96AA', '--card': '#121724', '--border': 'rgba(255,255,255,.06)' } },
  light:    { label: { fr: 'Clair', en: 'Light', es: 'Claro', it: 'Chiaro' }, emoji: '☀️',
    vars: { '--bg': '#F8F9FF', '--bg2': '#F0F2FF', '--bg3': '#E8EBFF', '--bg4': '#FFFFFF', '--bg5': '#F4F5FF', '--p': '#6C47FF', '--p2': '#8B6FFF', '--p3': '#6C47FF', '--acc2': '#059669', '--text': '#1A1A2E', '--text2': '#374151', '--text3': '#626976', '--card': '#FFFFFF', '--border': 'rgba(0,0,0,.1)' } },
}

// Préférence OS (matchMedia) — défaut « sombre » si indisponible (SSR / jsdom sans matchMedia).
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Résout un thème (dont « system ») vers la palette concrète effective.
export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

// Le thème effectif est-il clair ? (comparaisons UI qui pilotent des rendus clair/sombre.)
export function isThemeLight(theme: string): boolean {
  return resolveTheme(theme as Theme) === 'light'
}

// Thèmes valides du set réduit — sert au fallback gracieux d'une préférence persistée obsolète.
export const VALID_THEMES = new Set<Theme>(['dark', 'light', 'system'])

// Options du sélecteur d'apparence (Sombre / Clair / Système), dans l'ordre d'affichage.
export const THEME_OPTIONS: { key: Theme; emoji: string; label: Record<string, string> }[] = [
  { key: 'dark',   emoji: THEMES.dark.emoji,  label: THEMES.dark.label },
  { key: 'light',  emoji: THEMES.light.emoji, label: THEMES.light.label },
  { key: 'system', emoji: '🖥️', label: { fr: 'Système', en: 'System', es: 'Sistema', it: 'Sistema' } },
]

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
  // « system » → palette concrète selon la préférence OS ; body.className reflète l'effectif.
  const resolved = resolveTheme(theme)
  const t = THEMES[resolved] ?? THEMES.dark
  const root = document.documentElement
  const isLight = resolved === 'light'
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
  document.body.className = `theme-${resolved}`
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
  // Identifiants légaux (pied de facture/devis — generateInvoice)
  ninea?: string | null
  rccm?: string | null
  vatNumber?: string | null
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
  // Fermeture explicite quand requireCashier=false (session, non persisté) : permet de FERMER
  // une caisse qui serait sinon « toujours ouverte » par dérivation. Reset par openCashier().
  cashierForcedClosed: boolean
  openCashier: (fund: number) => void
  closeCashier: () => void
  addCashierSale: (amount: number) => void
  // Panier POS persisté (survit nav + refresh)
  cart: CartItem[]
  addCartItem:    (item: CartItem) => void
  updateCartQty:  (id: number | string, delta: number, newPrice?: number, tierLabel?: string, clientType?: CartItem['clientType']) => void
  removeCartItem: (id: number | string) => void
  setCart:        (cart: CartItem[]) => void
  clearCart:      () => void
  // Taux de change live (runtime only, non persisté)
  currencyRates: Record<string, number>
  fetchExchangeRates: () => Promise<void>
  // Fraîcheur des données à conséquence (Chantier B). Persisté : au rechargement,
  // « il y a 3 h » reste vrai — remettre le compteur à zéro serait un mensonge.
  freshness: FreshnessMap
  markFresh: (kind: FreshnessKind, at?: number) => void
  // Incrémenté par le rafraîchissement manuel : un POS monté recharge sa liste en
  // mémoire, sinon l'horodatage dirait « à jour » devant un écran resté périmé.
  catalogNonce: number
  requestCatalogRefresh: () => void
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
      cashierForcedClosed: false,

      openCashier: (fund) => set({
        cashierOpen:        true,
        cashierOpenedAt:    new Date().toISOString(),
        cashierOpeningFund: fund,
        cashierSessionTx:   0,
        cashierSessionCA:   0,
        cashierForcedClosed: false, // réouverture → annule la fermeture explicite
        cart:               [], // panier vide à l'ouverture de caisse (nouvelle session)
      }),

      closeCashier: () => set({
        cashierOpen:        false,
        cashierOpenedAt:    null,
        cashierOpeningFund: 0,
        cashierSessionTx:   0,
        cashierSessionCA:   0,
        cashierForcedClosed: true, // fermeture effective même quand requireCashier=false
      }),

      addCashierSale: (amount) => set(state => ({
        cashierSessionTx: state.cashierSessionTx + 1,
        cashierSessionCA: state.cashierSessionCA + amount,
      })),

      // ── Panier POS persisté ──
      // Le price (et tierLabel) sont calculés par POS.tsx via resolveTierPrice
      // (logique métier qui dépend du tenant + clientType) et passés au store.
      cart: [],
      freshness: {},
      catalogNonce: 0,

      addCartItem: (item) => set(s => ({
        cart: s.cart.some(i => i.id === item.id)
          ? s.cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
          : [...s.cart, item],
      })),

      // Horodate une classe de données qui vient d'être resynchronisée depuis le serveur.
      // `at` injectable (tests) ; défaut = maintenant.
      markFresh: (kind, at) => set(s => ({ freshness: { ...s.freshness, [kind]: at ?? Date.now() } })),
      requestCatalogRefresh: () => set(s => ({ catalogNonce: s.catalogNonce + 1 })),

      updateCartQty: (id, delta, newPrice, tierLabel, clientType) => set(s => ({
        cart: s.cart
          .map(i => i.id === id
            ? {
                ...i,
                qty: i.qty + delta,
                ...(newPrice !== undefined ? { price: newPrice } : {}),
                ...(tierLabel !== undefined ? { tierLabel } : {}),
                // Le tarif suit TOUJOURS le prix : recalculer l'un sans l'autre laisserait
                // la ligne déclarer un tarif dont son prix n'est plus issu.
                ...(clientType !== undefined ? { clientType } : {}),
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
        // Ne pas persister : les taux live (recalculés au démarrage), les états de session caisse
        // (cashierOpen/Fund/Tx/CA — réinitialisés à chaque connexion) ni le panier `cart`
        // (état de session, vidé à l'ouverture de caisse — jamais hérité d'un refresh/connexion).
        // NB : `cashierForcedClosed` EST persisté (dans ...rest) → un refresh conserve l'état
        // ouvert/fermé de la caisse ; closeCashier (login/logout/fermeture) le passe à true.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { currencyRates, fetchExchangeRates, cashierOpen, cashierOpenedAt, cashierOpeningFund, cashierSessionTx, cashierSessionCA, cart, ...rest } = state
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
          // Fallback gracieux : un thème persisté retiré du set réduit (darker/midnight/forest/
          // ocean/sunset/gold/soleil…) n'existe plus → on retombe sur « Sombre » plutôt que de
          // laisser un utilisateur bloqué sur un thème inconnu (sélecteur sans option active).
          theme: (p.theme && VALID_THEMES.has(p.theme)) ? p.theme : 'dark',
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

// Thème « Système » réactif : quand la préférence OS bascule ET que l'utilisateur est réglé sur
// « system », on ré-applique la palette effective sans qu'il ait à recharger la page.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onSchemeChange = () => { if (useAppStore.getState().theme === 'system') applyTheme('system') }
  if (mq.addEventListener) mq.addEventListener('change', onSchemeChange)
  else if ((mq as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener) {
    (mq as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onSchemeChange)
  }
}

/**
 * État d'ouverture effectif de la caisse (source unique de vérité, à utiliser partout :
 * POS, Sidebar, badges). `cashierOpen` est exclu de partialize (repart false au refresh) :
 * - requireCashier=true  → suit cashierOpen (cérémonie d'ouverture/fermeture).
 * - requireCashier=false → ouverte par défaut, fermable via cashierForcedClosed (persisté).
 */
export function useCashierIsOpen(): boolean {
  return useAppStore(s => s.requireCashier ? s.cashierOpen : !s.cashierForcedClosed)
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
