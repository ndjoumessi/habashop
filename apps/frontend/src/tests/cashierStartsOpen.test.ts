import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useAppStore } from '@/stores/appStore'

/**
 * LA CAISSE DÉMARRE OUVERTE quand la boutique ne l'exige pas fermée.
 *
 * Défaut MESURÉ le 2026-08-14 sur `demo-tenant-001` (`requireCashier=false`) : navigateur
 * NEUF, juste après connexion, `cashierForcedClosed = true` — la caisse démarrait fermée,
 * l'exact contraire de ce que le mode promet dans le store lui-même (« ouverte par
 * défaut, fermable via cashierForcedClosed »). Le commerçant devait cliquer « Ouvrir la
 * caisse » à CHAQUE connexion, sur le réglage censé lui épargner la cérémonie.
 *
 * CAUSE : deux états confondus par une seule action. `authStore` appelait `closeCashier()`
 * à la connexion, au changement de boutique et à la déconnexion, avec l'intention
 * « pas de session héritée » — mais `closeCashier` pose aussi `cashierForcedClosed`, qui
 * signifie « le commerçant a fermé ». Ce n'est pas ce qui se passe à une connexion.
 */

const ETAT_OUVERTE = {
  cashierOpen: true, cashierOpenedAt: '2026-08-14T08:00:00.000Z', cashierOpeningFund: 50000,
  cashierSessionTx: 7, cashierSessionCA: 123456, cashierForcedClosed: false,
}

beforeEach(() => useAppStore.setState(ETAT_OUVERTE))

describe('resetCashierSession — vider la session sans fermer la caisse', () => {
  it('vide TOUS les champs de session', () => {
    useAppStore.getState().resetCashierSession()
    const s = useAppStore.getState()
    expect(s.cashierOpen).toBe(false)
    expect(s.cashierOpenedAt).toBeNull()
    expect(s.cashierOpeningFund).toBe(0)
    expect(s.cashierSessionTx).toBe(0)
    expect(s.cashierSessionCA).toBe(0)
  })

  it('⚠️ mais NE FERME PAS la caisse — c’est toute la différence avec `closeCashier`', () => {
    // Sur `requireCashier=false`, `useCashierIsOpen` lit `!cashierForcedClosed` : poser ce
    // drapeau ici, c'est fermer la caisse à chaque connexion.
    useAppStore.setState({ cashierForcedClosed: true })
    useAppStore.getState().resetCashierSession()
    expect(useAppStore.getState().cashierForcedClosed).toBe(false)
  })

  it('DISCRIMINANT — `closeCashier`, lui, ferme bel et bien', () => {
    // Sans ce cas, une action qui ne fermerait JAMAIS passerait le test ci-dessus, et le
    // bouton « Fermer la caisse » du commerçant serait devenu inopérant.
    useAppStore.getState().closeCashier()
    expect(useAppStore.getState().cashierForcedClosed).toBe(true)
    expect(useAppStore.getState().cashierOpen).toBe(false)
  })
})

describe('la règle d’ouverture effective, sur les deux modes', () => {
  const ouverte = () => {
    const s = useAppStore.getState()
    return s.requireCashier ? s.cashierOpen : !s.cashierForcedClosed
  }

  it('requireCashier=false : après une remise à zéro de session, la caisse est OUVERTE', () => {
    useAppStore.setState({ requireCashier: false })
    useAppStore.getState().resetCashierSession()
    expect(ouverte()).toBe(true)
  })

  it('requireCashier=false : le commerçant peut toujours la fermer', () => {
    useAppStore.setState({ requireCashier: false })
    useAppStore.getState().closeCashier()
    expect(ouverte()).toBe(false)
  })

  it('⚠️ requireCashier=true : RIEN ne change — c’est `cashierOpen` qui gouverne', () => {
    // La correction ne doit pas ouvrir de caisse là où une cérémonie est exigée.
    useAppStore.setState({ requireCashier: true })
    useAppStore.getState().resetCashierSession()
    expect(ouverte()).toBe(false)
    useAppStore.getState().openCashier(20000)
    expect(ouverte()).toBe(true)
  })
})

describe('CÂBLAGE — l’authentification n’a pas le droit de FERMER la caisse', () => {
  it('`authStore` n’appelle plus `closeCashier`', () => {
    // ⚠️ Règle de FORME, et c'est la seule qui garde la cause : les trois appels vivaient
    // dans `authStore` (connexion, changement de boutique, déconnexion). Un test de
    // comportement sur le store ne peut pas voir qui l'appelle.
    const src = readFileSync(join(__dirname, '..', 'stores', 'authStore.ts'), 'utf8')
    const utiles = src.split('\n').filter(l => !l.trim().startsWith('//'))
    expect(utiles.filter(l => l.includes('closeCashier('))).toEqual([])
    // COUVERTURE : sans ce compte, un fichier vide ou déplacé rendrait la règle vraie
    // sur du néant.
    expect(utiles.filter(l => l.includes('resetCashierSession(')).length).toBe(3)
  })

  it('et le geste EXPLICITE reste câblé, côté modale de caisse', () => {
    // Le corollaire : si plus personne n'appelle `closeCashier`, le commerçant ne peut
    // plus fermer sa caisse — on aurait déplacé le défaut.
    const modale = readFileSync(join(__dirname, '..', 'components', 'pos', 'POSModals.tsx'), 'utf8')
    expect(modale).toContain('closeCashier()')
  })
})
