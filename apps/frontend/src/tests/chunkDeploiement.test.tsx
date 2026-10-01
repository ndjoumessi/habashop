import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { lazyRoute } from '@/lib/lazyRoute'
import { useAppStore } from '@/stores/appStore'

/**
 * LE CHUNK QUI DISPARAÎT SOUS LES PIEDS DU COMMERÇANT.
 *
 * ⚠️ MESURÉ en production le 2026-10-01, pendant une vérification : un `GET` sur
 * `POS-WA0amkoA.js` rendait 404 — le chunk du build PRÉCÉDENT. Vercel sert des noms HASHÉS :
 * au déploiement suivant, l'`index.js` déjà chargé dans l'onglet d'un commerçant référence des
 * fichiers qui n'existent plus. Le prochain `React.lazy()` rejette.
 *
 * ⚠️ ET C'EST TOUTE L'APPLICATION QUI TOMBE, pas la route. `Sentry.ErrorBoundary` enveloppe
 * l'app entière (`main.tsx`) : le rejet remonte jusqu'à elle, et le commerçant perd la barre
 * latérale, l'en-tête et son écran — jusqu'à un rechargement forcé qu'il n'a aucune raison de
 * deviner. « L'écran suivant » est souvent la CAISSE.
 *
 * ⚠️ LA CONTRAINTE QUI INTERDIT LA SOLUTION ÉVIDENTE. Recharger automatiquement est le réflexe,
 * et il est DESTRUCTEUR ici : `cart` est exclu de `partialize` (`appStore`), donc un
 * rechargement VIDE le panier. Un caissier au milieu d'une vente perdrait ses lignes sans avoir
 * rien demandé. On NE RECHARGE JAMAIS seul — on explique, on propose, et on prévient quand un
 * panier est en cours.
 *
 * ⚠️ Pourquoi au niveau de `lazy()` et pas dans une frontière d'erreur : résolu ICI, le rejet
 * n'atteint jamais la frontière, donc la coquille de l'application RESTE EN VIE — et avec elle
 * le panier en mémoire. Une frontière, elle, remplace tout.
 */

const APP = resolve(__dirname, '..', 'App.tsx')

/** Monte un composant paresseux et attend qu'il se résolve. */
function monter(C: React.ComponentType) {
  return render(<Suspense fallback={<span>chargement</span>}><C /></Suspense>)
}

beforeEach(() => {
  useAppStore.setState({ lang: 'fr', cart: [] } as never)
  vi.restoreAllMocks()
})
afterEach(() => { vi.useRealTimers() })

describe('chunk introuvable après déploiement', () => {
  it('⚠️ un échec DÉFINITIF rend l’écran de reprise, il ne propage pas', async () => {
    const C = lazyRoute(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    monter(C)
    // Rien ne remonte : pas de rejet non capturé, et un écran qui DIT quoi faire.
    await waitFor(() => expect(screen.getByRole('button', { name: /recharger/i })).toBeTruthy())
  })

  it('⚠️ mais il RÉESSAIE d’abord — une coupure réseau n’est pas un déploiement', async () => {
    let appels = 0
    const C = lazyRoute(() => {
      appels++
      return appels === 1
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ default: () => <span>écran chargé</span> })
    })
    monter(C)
    await waitFor(() => expect(screen.getByText('écran chargé')).toBeTruthy())
    expect(appels, 'un seul essai ne distingue pas une coupure d’un 404').toBe(2)
  })

  it('⚠️ JAMAIS de rechargement automatique — le panier ne survit pas à un refresh', async () => {
    const recharger = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload: recharger } as Location)
    const C = lazyRoute(() => Promise.reject(new Error('boom')))
    monter(C)
    await waitFor(() => expect(screen.getByRole('button', { name: /recharger/i })).toBeTruthy())
    expect(recharger, 'un rechargement non demandé viderait le panier').not.toHaveBeenCalled()
  })

  it('⚠️ un panier en cours est ANNONCÉ — perdre des lignes sans prévenir est pire que l’écran cassé', async () => {
    useAppStore.setState({ cart: [{ id: 'p1', name: 'Riz', price: 1000, qty: 2 }] } as never)
    const C = lazyRoute(() => Promise.reject(new Error('boom')))
    const { container } = monter(C)
    await waitFor(() => expect(screen.getByRole('button', { name: /recharger/i })).toBeTruthy())
    expect(container.textContent, 'le panier en cours doit être nommé').toMatch(/panier/i)
  })

  it('⚠️ sans panier, pas d’avertissement inutile — une alerte qui crie toujours n’alerte plus', async () => {
    const C = lazyRoute(() => Promise.reject(new Error('boom')))
    const { container } = monter(C)
    await waitFor(() => expect(screen.getByRole('button', { name: /recharger/i })).toBeTruthy())
    expect(container.textContent).not.toMatch(/panier/i)
  })

  it('⚠️ TOUTES les routes passent par lazyRoute — un module que personne n’appelle ne garde rien', () => {
    const brut = readFileSync(APP, 'utf-8')
    /**
     * ⚠️ LES COMMENTAIRES SONT RETIRÉS AVANT DE CONCLURE. Sans ça, le verrou interdit
     * d'EXPLIQUER ce qu'il interdit : le commentaire d'`App.tsx` cite `lazy(` pour dire
     * pourquoi il est proscrit, et le scan le comptait comme une violation. Mesuré — ce test
     * a rougi sur sa propre documentation.
     */
    const src = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // Couverture : le fichier doit être lu et porter beaucoup de routes.
    expect(brut.length, 'App.tsx doit être lu').toBeGreaterThan(2000)
    const viaRoute = [...src.matchAll(/lazyRoute\(/g)].length
    expect(viaRoute, 'App.tsx doit déclarer ses routes via lazyRoute').toBeGreaterThanOrEqual(30)

    // ⚠️ La FORME interdite : un `lazy(` nu. Le méta-test de la règle ne prouve pas qui
    // l'APPELLE — c'est le défaut qui avait laissé `routes/export.ts` sans échappement HTML.
    const nus = [...src.matchAll(/(?<![A-Za-z])lazy\(/g)].length
    expect(nus, `${nus} appel(s) à lazy() hors de lazyRoute dans App.tsx`).toBe(0)
    expect(src).not.toMatch(/import \{[^}]*\blazy\b[^}]*\} from 'react'/)
  })
})
