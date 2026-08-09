import { render, fireEvent, screen } from '@testing-library/react-native'
import DemoAccountsRow from '../components/DemoAccountsRow'

/**
 * LE RENDU RÉEL — ce que les autres verrous ne pouvaient pas prouver.
 *
 * ─── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 * `demoAccounts.test.ts` prouve la RÈGLE (`resolveDemoMode`) et lit le TEXTE
 * SOURCE de l'écran. Aucun des deux ne dit ce qui s'AFFICHE : un test qui grep la
 * source passe au rouge sur un reformatage et reste vert si le bloc devient
 * inatteignable — ou, ici, s'il devient atteignable alors qu'il ne devrait pas.
 *
 * ⚠️ CE QUI RESTE NON PROUVÉ, ET IL FAUT LE DIRE. Ceci monte le composant dans
 * jest, pas dans un build livré sur un appareil. La voie simulateur est FERMÉE
 * sur cette machine (Xcode complet absent — `xcode-select` pointe sur les seuls
 * outils en ligne de commande) et aucun build iOS n'a jamais été fait sur ce
 * projet. Ce qui manque encore est la régression d'ENVIRONNEMENT : que le
 * bundler d'un build EAS substitue bien le drapeau absent en valeur fausse. On
 * en a une preuve PARTIELLE — le nom `EXPO_PUBLIC_DEMO_MODE` est absent des deux
 * `.hbc` exportés, donc la substitution a lieu — mais pas la preuve visuelle.
 * *Un test unitaire ne voit pas une régression d'environnement runtime.*
 */

/**
 * Remonte le composant sous un drapeau donné.
 *
 * ⚠️ AUCUN `jest.resetModules()` ICI, et c'est la raison d'être de
 * `demoModeEnabled()` : réinitialiser le registre chargeait un SECOND React pour
 * le composant pendant que la bibliothèque de rendu gardait le premier — « Invalid
 * hook call » sur les cinq cas, pour une raison étrangère au sujet. Le drapeau se
 * lisant à l'APPEL, poser `process.env` suffit.
 */
async function monter(drapeau: string | undefined, onPick = jest.fn()) {
  if (drapeau === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE
  else process.env.EXPO_PUBLIC_DEMO_MODE = drapeau
  // ⚠️ `await` OBLIGATOIRE : en RTL 14 `render` est asynchrone (React concurrent).
  // Sans lui, `screen` n'est pas lié et rend « render function has not been called »
  // sur les cinq cas — un échec qui ressemble à un composant cassé alors que c'est
  // la sonde qui n'a pas attendu.
  await render(<DemoAccountsRow onPick={onPick} />)
  // On ne renvoie pas le résultat de `render` : les requêtes passent par `screen`.
  return onPick
}

const APRES = process.env.EXPO_PUBLIC_DEMO_MODE
afterAll(() => {
  if (APRES === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE
  else process.env.EXPO_PUBLIC_DEMO_MODE = APRES
})

describe('rangée de raccourcis démo — ce qui est RENDU', () => {
  it('⚠️ drapeau ABSENT : AUCUN bouton démo à l’écran', async () => {
    await monter(undefined)

    // Rien du tout : pas de conteneur vide, pas de libellé, pas de bouton.
    expect(screen.toJSON()).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('Admin')).toBeNull()
    expect(screen.queryByText(/Comptes démo/)).toBeNull()
  })

  it('drapeau à une AUTRE valeur que « 1 » : toujours rien', async () => {
    // Le défaut ne doit pas s'allumer sur « true », « 0 » ou une chaîne vide —
    // sinon une variable posée à l'aveugle rallume les boutons en production.
    for (const valeur of ['', '0', 'true', 'yes']) {
      await monter(valeur)
      expect(screen.toJSON()).toBeNull()
    }
  })

  it('⚠️ drapeau à « 1 » : les 5 boutons SONT rendus — sinon ce fichier ne discrimine rien', async () => {
    /**
     * Contrôle positif. Sans lui, un composant qui rendrait `null` en toute
     * circonstance (import cassé, erreur avalée) ferait passer les cas ci-dessus
     * au vert en ne prouvant rien.
     */
    await monter('1')
    expect(screen.getAllByRole('button')).toHaveLength(5)
    for (const label of ['Admin', 'Manager', 'Caissier', 'Comptable', 'RH']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('un tap prérempli l’adresse ET le mot de passe du compte choisi', async () => {
    const onPick = await monter('1')
    fireEvent.press(screen.getByText('Caissier'))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('cashier@habashop.com', 'demo1234')
  })

  it('chaque bouton porte un libellé d’accessibilité distinct', async () => {
    // Cinq boutons au même nom accessible seraient indiscernables au lecteur
    // d'écran — et pour un test de rendu, indiscernables tout court.
    await monter('1')
    const noms = screen.getAllByRole('button').map(b => b.props.accessibilityLabel)
    expect(new Set(noms).size).toBe(5)
  })
})
