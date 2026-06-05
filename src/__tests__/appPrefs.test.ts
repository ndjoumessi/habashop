// Évite l'appel réseau au chargement du module appStore (fetchRates) en test.
jest.mock('@/services/exchangeRate', () => ({
  fetchRates: jest.fn(() => Promise.resolve({ XOF: 1, XAF: 1 })),
  convertFromXOF: (n: number) => n,
  convertToXOF: (n: number) => n,
}))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAppStore, whenAppStoreHydrated } from '@/stores/appStore'
import { shouldApplyTenantCurrency } from '@/lib/prefs'

const STORE_KEY = 'habashop-settings'
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('shouldApplyTenantCurrency (devise tenant ignorée si choix manuel)', () => {
  it('applique la devise tenant uniquement si AUCUN choix manuel', () => {
    expect(shouldApplyTenantCurrency(false, 'EUR')).toBe(true)
  })
  it('IGNORE la devise tenant si l’utilisateur a choisi manuellement', () => {
    expect(shouldApplyTenantCurrency(true, 'EUR')).toBe(false)
  })
  it('n’applique rien sans devise tenant', () => {
    expect(shouldApplyTenantCurrency(false, undefined)).toBe(false)
    expect(shouldApplyTenantCurrency(false, null)).toBe(false)
    expect(shouldApplyTenantCurrency(false, '')).toBe(false)
  })
})

describe('persistance des préférences', () => {
  it('écrit langue + devise manuelle dans AsyncStorage (→ survit au restart)', async () => {
    await whenAppStoreHydrated()
    useAppStore.getState().setLang('en')
    useAppStore.getState().setCurrency('USD')
    useAppStore.getState().setCurrencyManuallySet(true)
    await flush() // laisse le persist écrire dans AsyncStorage (durable, survit au redémarrage)

    const raw = await AsyncStorage.getItem(STORE_KEY)
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw as string).state
    expect(persisted.lang).toBe('en')
    expect(persisted.currency).toBe('USD')
    expect(persisted.currencyManuallySet).toBe(true)
  })

  it('réhydrate les prefs depuis AsyncStorage au boot (≠ valeurs par défaut)', async () => {
    // Simule un device déjà configuré (install précédente) : prefs en storage durable.
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({
      state: { lang: 'es', currency: 'GBP', currencyManuallySet: true, theme: 'dark', previousTheme: 'dark', kioskMode: false },
      version: 0,
    }))
    // Ce que fait le persist au lancement de l'app.
    await useAppStore.persist.rehydrate()

    const s = useAppStore.getState()
    expect(s.lang).toBe('es')                 // langue restaurée (≠ défaut 'fr')
    expect(s.currency).toBe('GBP')            // devise restaurée (≠ défaut 'XOF')
    expect(s.currencyManuallySet).toBe(true)  // flag restauré → la devise tenant sera ignorée
  })
})
