import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/stores/appStore'

const reset = () => useAppStore.setState({
  currency: 'XOF', lang: 'fr', currencyManuallySet: false, langManuallySet: false, tenant: null,
} as any)

describe('Persistance devise + langue (per-device, pas d’écrasement tenant)', () => {
  beforeEach(reset)

  it('1ʳᵉ visite (aucun choix manuel) → setTenant adopte la devise + langue du tenant (défaut)', () => {
    useAppStore.getState().setTenant({ currency: 'EUR', lang: 'en' } as any)
    expect(useAppStore.getState().currency).toBe('EUR')
    expect(useAppStore.getState().lang).toBe('en')
  })

  it('setCurrency / setLang marquent le choix manuel', () => {
    useAppStore.getState().setCurrency('USD')
    useAppStore.getState().setLang('es')
    expect(useAppStore.getState().currencyManuallySet).toBe(true)
    expect(useAppStore.getState().langManuallySet).toBe(true)
  })

  it('choix manuel → setTenant N’ÉCRASE PAS (refresh / re-login / redéploiement)', () => {
    useAppStore.getState().setCurrency('USD')
    useAppStore.getState().setLang('es')
    // simulate /me ou changement de boutique renvoyant une autre devise/langue tenant
    useAppStore.getState().setTenant({ currency: 'EUR', lang: 'en' } as any)
    expect(useAppStore.getState().currency).toBe('USD') // conservé
    expect(useAppStore.getState().lang).toBe('es')      // conservé
  })

  it('le choix manuel est persisté dans localStorage (clé habashop-config)', () => {
    useAppStore.getState().setCurrency('GBP')
    const raw = JSON.parse(localStorage.getItem('habashop-config')!)
    expect(raw.state.currency).toBe('GBP')
    expect(raw.state.currencyManuallySet).toBe(true)
  })

  it('logout (clearTenant) ne touche pas currency / lang', () => {
    useAppStore.getState().setCurrency('CAD')
    useAppStore.getState().setLang('it')
    useAppStore.getState().clearTenant()
    expect(useAppStore.getState().currency).toBe('CAD')
    expect(useAppStore.getState().lang).toBe('it')
    expect(useAppStore.getState().tenant).toBeNull()
  })

  it('devise tenant invalide ignorée (garde la valeur courante)', () => {
    useAppStore.getState().setTenant({ currency: 'ZZZ', lang: 'xx' } as any)
    expect(useAppStore.getState().currency).toBe('XOF')
    expect(useAppStore.getState().lang).toBe('fr')
  })
})
