import { render, screen, act } from '@testing-library/react-native'
import ProductThumb from '../components/ui/ProductThumb'

/**
 * LA VIGNETTE PRODUIT NATIVE — la même décision que le jumeau web, exercée ICI.
 *
 * ─── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 * `apps/frontend/src/tests/productThumb.test.tsx` prouve la décision côté WEB, et
 * rien d'autre. Le jumeau natif est né le 2026-08-11 sans un seul test : la règle
 * « la photo l'emporte, une photo qui casse revient à l'émoji » n'était donc
 * garantie que d'un côté, sur deux implémentations qui n'ont AUCUN code commun
 * (React Native n'a ni `<img>` ni `objectFit`). C'est la définition même du
 * JUMEAU NON TRAITÉ : une correction qui s'arrête au premier fichier.
 *
 * ⚠️ LE CHARGEMENT PÈSE PLUS LOURD ICI QUE SUR LE WEB. `<Image>` n'a aucun
 * placeholder natif, et le POS mobile sert des boutiques dont le réseau est le
 * facteur limitant — c'est la raison d'être de la file de rejeu hors ligne. Une
 * grille vide pendant le chargement était donc le cas NORMAL, pas le cas dégradé,
 * et aucun `onError` ne pouvait la signaler : rien n'échouait.
 *
 * ─── CE QUE CE FICHIER NE PROUVE PAS ─────────────────────────────────────────
 * ⚠️ Il monte le composant dans jest — pas sur un appareil, pas sur un vrai
 * réseau. Il garde la DÉCISION (quel élément est rendu, à quel moment) ; il ne
 * voit ni la GÉOMÉTRIE (recouvrement absolu, rognage par le conteneur) ni la
 * latence réelle. Aucune capture n'a été prise avec de vraies photos.
 *
 * ⚠️ Et il n'exerce pas le DISPATCH natif : `fireEvent(el, 'load')` ne déclenche
 * RIEN sur une `<Image>` dans cette version de RNTL — MESURÉ, sous les trois
 * formes (`'load'`, `'error'`, `'onLoad'`), gestionnaires pourtant bien présents
 * sur l'élément. On appelle donc le gestionnaire du composant directement, sous
 * `act()`. C'est notre logique qui est jugée ; que React Native émette bien
 * `onLoad` quand une image se peint est la responsabilité de la plateforme, pas
 * une propriété que ce dépôt peut garder.
 */

const PHOTO = { image: 'https://exemple.test/riz.jpg', emoji: '🌾' }

/**
 * ⚠️ POIGNÉE PAR `testID`, ET NON PAR TYPE. Dans cette version de RNTL, ni le
 * résultat de `render` ni `screen` n'exposent les requêtes `UNSAFE_*ByType` —
 * MESURÉ : les deux ne portent que `{ rerender, root }`. Il n'existe donc aucun
 * sélecteur de structure côté natif, contrairement au `document.querySelector`
 * du jumeau web.
 */
const POIGNEE = 'product-thumb-image'
const photos = () => screen.queryAllByTestId(POIGNEE)

/** Déclenche le gestionnaire de l'image — voir l'en-tête pour la raison. */
async function signaler(evenement: 'onLoad' | 'onError') {
  const el = screen.getByTestId(POIGNEE)
  // ⚠️ Contrôle : si le gestionnaire disparaissait du composant, l'appel muet
  // rendrait un test VERT qui n'a rien exercé.
  expect(typeof el.props[evenement]).toBe('function')
  await act(async () => {
    el.props[evenement]()
  })
}

describe('ProductThumb natif — photo, chargement, échec', () => {
  it('sans photo, l’émoji est rendu', async () => {
    await render(<ProductThumb p={{ emoji: '🌾' }} />)
    expect(photos()).toHaveLength(0)
    expect(screen.getByText('🌾')).toBeTruthy()
  })

  it('⚠️ PENDANT le chargement, la vignette n’est JAMAIS vide', async () => {
    await render(<ProductThumb p={PHOTO} />)
    // L'image est demandée ET l'émoji tient la place : aucun instant muet.
    expect(photos()).toHaveLength(1)
    expect(screen.getByText('🌾')).toBeTruthy()
  })

  it('une photo PEINTE remplace l’émoji', async () => {
    await render(<ProductThumb p={PHOTO} />)
    await signaler('onLoad')
    // L'émoji cède : sinon une photo à fond transparent le laisserait voir.
    expect(screen.queryByText('🌾')).toBeNull()
    expect(photos()).toHaveLength(1)
  })

  it('⚠️ une photo qui NE CHARGE PAS revient à l’émoji', async () => {
    /**
     * Le POS mobile vend HORS LIGNE — `PERSISTED_KEYS` garde le catalogue dans
     * AsyncStorage précisément pour ça. Toutes les URL sont alors injoignables :
     * sans ce repli, la grille entière serait muette. L'émoji, lui, est DANS la
     * donnée persistée, il survit à la coupure.
     */
    await render(<ProductThumb p={PHOTO} />)
    await signaler('onError')
    expect(photos()).toHaveLength(0)
    expect(screen.getByText('🌾')).toBeTruthy()
  })

  it('⚠️ un échec ne se TRANSMET PAS au produit suivant dans une ligne recyclée', async () => {
    /**
     * `FlatList` recycle ses lignes : React réutilise l'instance du composant, et
     * seule la `key` de l'`<Image>` remonte l'élément — jamais l'état. Un booléen
     * `casse` ferait donc hériter le produit suivant de l'échec du précédent, qui
     * n'afficherait PLUS JAMAIS sa photo. C'est le mode de fonctionnement normal
     * d'une liste native, pas un cas limite.
     */
    await render(<ProductThumb p={{ image: 'https://exemple.test/a.jpg', emoji: '🅰️' }} />)
    await signaler('onError')
    expect(photos()).toHaveLength(0)

    await screen.rerender(<ProductThumb p={{ image: 'https://exemple.test/b.jpg', emoji: '🅱️' }} />)
    // B doit avoir sa chance malgré l'échec de A, émoji en attente.
    expect(photos()).toHaveLength(1)
    expect(screen.getByText('🅱️')).toBeTruthy()
  })

  it('ni photo ni émoji : 📦, jamais une vignette vide', async () => {
    await render(<ProductThumb p={{}} />)
    expect(screen.getByText('📦')).toBeTruthy()
  })
})
