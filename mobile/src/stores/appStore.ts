import { useState, useEffect, useCallback } from 'react'
import { useColorScheme } from 'react-native'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchRates, convertFromXOF } from '@/services/exchangeRate'
import { DarkColors, LightColors } from '@/constants/theme'

export type Lang = 'fr' | 'en' | 'es' | 'it'
export type ThemeMode = 'dark' | 'light' | 'system'
const VALID_THEMES: ThemeMode[] = ['dark', 'light', 'system']

interface AppState {
  lang:         Lang
  currency:     string
  currencyManuallySet: boolean // true dès que l'user choisit une devise → ne plus écraser depuis le tenant
  theme:        ThemeMode
  kioskMode:    boolean
  setLang:      (l: Lang) => void
  setCurrency:  (c: string) => void
  setCurrencyManuallySet: (v: boolean) => void
  setTheme:     (t: ThemeMode) => void
  setKioskMode: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang:         'fr',
      currency:     'XOF',
      currencyManuallySet: false,
      theme:        'dark',
      kioskMode:    false,
      setLang:      (lang) => set({ lang }),
      setCurrency:  (currency) => set({ currency }),
      setCurrencyManuallySet: (currencyManuallySet) => set({ currencyManuallySet }),
      setTheme:     (theme) => set({ theme }),
      setKioskMode: (kioskMode) => set({ kioskMode }),
    }),
    {
      name:    'habashop-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lang:      state.lang,
        currency:  state.currency,
        currencyManuallySet: state.currencyManuallySet,
        theme:     state.theme,
        kioskMode: state.kioskMode,
      }),
      // Fallback gracieux : un thème persisté retiré du set réduit (ancien 'soleil') → 'dark'.
      onRehydrateStorage: () => (state) => {
        if (state && !VALID_THEMES.includes(state.theme)) state.setTheme('dark')
      },
    },
  ),
)

/**
 * Résout quand le persist a fini de réhydrater les préférences depuis AsyncStorage.
 * ⚠️ À ATTENDRE avant d'appliquer une valeur par défaut (devise tenant) au démarrage :
 * sinon on lit l'état INITIAL (`currencyManuallySet=false`, `lang='fr'`) pendant la
 * fenêtre de hydration et on écrase le choix persisté de l'utilisateur (bug OTA/restart).
 * Résout immédiatement si déjà hydraté (et même si AsyncStorage est vide = 1re install).
 */
export function whenAppStoreHydrated(): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const unsub = useAppStore.persist.onFinishHydration(() => { unsub(); resolve() })
  })
}

// Hook thème — sélectionne la primitive `theme` (re-render garanti) + suit le
// schéma système si 'system'. Retourne la palette `C` à passer à makeStyles(C).
export function useTheme() {
  const theme = useAppStore(s => s.theme)
  const systemScheme = useColorScheme()
  const isDark =
    theme === 'dark'   ? true  :
    theme === 'light'  ? false :
    systemScheme !== 'light'     // 'system' : sombre par défaut si indéterminé
  const C = isDark ? DarkColors : LightColors
  return { isDark, theme, C }
}

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

// Hermes/Android peut ignorer les options de toLocaleString → on détecte une
// seule fois et on bascule sur un formatage manuel (toFixed + séparateurs) sinon.
const INTL_OK = (() => {
  try {
    return (1234.5).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) === '1,234.50'
  } catch {
    return false
  }
})()

// Formatage manuel robuste (identique iOS/Android) : groupe les milliers.
function manualFormat(value: number, decimals: number, thousandSep: string, decimalSep: string): string {
  const fixed = Math.abs(value).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep)
  const sign = value < 0 ? '-' : ''
  return decPart ? `${sign}${grouped}${decimalSep}${decPart}` : `${sign}${grouped}`
}

// Formate un nombre selon la locale, avec repli manuel si Intl indisponible.
function localeNumber(value: number, locale: string, decimals: number): string {
  if (INTL_OK) {
    return value.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  const useComma = locale === 'fr-FR' || locale === 'fr-CA'
  return useComma
    ? manualFormat(value, decimals, ' ', ',') // fr : 1 234,56
    : manualFormat(value, decimals, ',', '.') // en : 1,234.56
}

// Helper devise — sélectionne `currency` + convertit XOF → devise cible.
// Les montants backend sont en XOF ; la conversion est UNIQUEMENT à l'affichage.
// Formatteur devise PUR (hors React) — SOURCE UNIQUE de la logique symbole/décimales.
// Réutilisé par useFmt (écrans) ET les contextes sans hook (widget background, libellés
// de taux) → plus de « FCFA »/« F » codés en dur ailleurs. `rates` par défaut = cachedRates.
export function formatAmount(amountXOF: number, currency: string, rates: Record<string, number> = cachedRates): string {
  const n = amountXOF ?? 0
  const converted = convertFromXOF(n, currency, rates)

  switch (currency) {
    case 'XOF':
    case 'XAF':
      // Franc CFA — pas de décimales, symbole FCFA
      return `${localeNumber(Math.round(converted), 'fr-FR', 0)} FCFA`
    case 'EUR':
      return `${localeNumber(converted, 'fr-FR', 2)} €`
    case 'USD':
      return `$${localeNumber(converted, 'en-US', 2)}`
    case 'GBP':
      return `£${localeNumber(converted, 'en-GB', 2)}`
    case 'CAD':
      return `CA$${localeNumber(converted, 'fr-CA', 2)}`
    default:
      return `${localeNumber(Math.round(converted), 'fr-FR', 0)} ${currency}`
  }
}

export function useFmt() {
  const currency = useAppStore(s => s.currency)
  const [rates, setRates] = useState(cachedRates)

  useEffect(() => {
    fetchRates().then(r => {
      cachedRates = r
      setRates(r)
    }).catch(() => {})
  }, [])

  const fmt = useCallback((amountXOF: number): string => formatAmount(amountXOF, currency, rates), [currency, rates])

  return { fmt, currency, rates }
}
