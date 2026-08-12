import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProductPhotoField from '@/components/stock/ProductPhotoField'

/**
 * LE CHAMP PHOTO — ce qui part vers le serveur, et ce qui n'en part pas.
 *
 * ⚠️ CE QUI N'EST PAS EXERÇABLE ICI, ET POURQUOI. `resizeToBlob` dessine sur un
 * `<canvas>` : jsdom n'a ni canvas ni décodeur d'image, donc le redimensionnement
 * RÉEL ne peut pas être testé — `imageResize.ts` le dit déjà de son côté pur. Il
 * est donc simulé. Ce fichier garde la DÉCISION (qu'envoie-t-on, quand, et que
 * dit-on quand ça rate), jamais les pixels. Écrire un test qui « vérifie » le
 * dessin sous jsdom rendrait un vert qui ne prouve rien.
 *
 * ⚠️ LE PIÈGE QUE CE FICHIER GARDE VRAIMENT : `StockForm.image` est l'ÉMOJI du
 * produit, `Product.image` est une URL de photo. Deux champs homonymes de sens
 * opposés, manipulés dans les mêmes fichiers. Les confondre enverrait un émoji
 * comme URL — d'où le dernier bloc.
 */

const { api, resize } = vi.hoisted(() => ({
  api: { uploadImage: vi.fn(), removeImage: vi.fn() },
  resize: { resizeToBlob: vi.fn() },
}))
vi.mock('@/lib/api', () => ({ productsApi: api }))
vi.mock('@/lib/imageResize', () => ({
  resizeToBlob: resize.resizeToBlob,
  PRODUIT_MAX_PX: 512,
}))
vi.mock('@/lib/announce', () => ({ announce: vi.fn() }))

const FICHIER = new File([new Uint8Array([1, 2, 3])], 'riz.jpg', { type: 'image/jpeg' })
const OCTETS = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

function poser(props: Partial<Parameters<typeof ProductPhotoField>[0]> = {}) {
  const onImage = vi.fn()
  const onEnAttente = vi.fn()
  render(
    <ProductPhotoField
      productId={null}
      image={null}
      emoji="🌾"
      lang="fr"
      onImage={onImage}
      onEnAttente={onEnAttente}
      {...props}
    />,
  )
  return { onImage, onEnAttente }
}

function choisirUnFichier() {
  const champ = screen.getByLabelText(/Choisir une photo/i)
  fireEvent.change(champ, { target: { files: [FICHIER] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  resize.resizeToBlob.mockResolvedValue(OCTETS)
  // ⚠️ jsdom n'implémente pas `createObjectURL` — sans ça, l'aperçu local jette.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:apercu')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('produit EXISTANT — l’envoi part tout de suite', () => {
  it('envoie la photo et remonte l’URL', async () => {
    api.uploadImage.mockResolvedValue({ image: 'https://img.test/a.jpg' })
    const { onImage, onEnAttente } = poser({ productId: 'p1' })

    choisirUnFichier()

    await waitFor(() => expect(api.uploadImage).toHaveBeenCalledTimes(1))
    // ⚠️ On vérifie CE QUI est envoyé : l'identifiant du produit et les octets
    // REDIMENSIONNÉS, pas le fichier d'origine. Un mock qui ignore ses arguments
    // resterait vert si le composant envoyait la photo brute de 4000 px.
    expect(api.uploadImage).toHaveBeenCalledWith('p1', OCTETS)
    expect(resize.resizeToBlob).toHaveBeenCalledWith(FICHIER, 512)
    await waitFor(() => expect(onImage).toHaveBeenCalledWith('https://img.test/a.jpg'))
    expect(onEnAttente, 'rien ne doit être mis en attente').not.toHaveBeenCalled()
  })

  it('⚠️ un envoi REFUSÉ ne remonte AUCUNE URL', async () => {
    // Le message du serveur est affiché par `saved()` ; ce qui compte ici est
    // qu'on n'affirme PAS un enregistrement qui n'a pas eu lieu.
    api.uploadImage.mockRejectedValue(new Error('Format non accepté — JPEG, PNG ou WebP.'))
    const { onImage } = poser({ productId: 'p1' })

    choisirUnFichier()

    await waitFor(() => expect(api.uploadImage).toHaveBeenCalled())
    await waitFor(() => expect(onImage).not.toHaveBeenCalled())
  })

  it('le retrait appelle le serveur et remonte null', async () => {
    api.removeImage.mockResolvedValue({ image: null })
    const { onImage } = poser({ productId: 'p1', image: 'https://img.test/a.jpg' })

    fireEvent.click(screen.getByText(/Retirer/i))

    await waitFor(() => expect(api.removeImage).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(onImage).toHaveBeenCalledWith(null))
  })
})

describe('produit EN CRÉATION — rien ne peut partir, et on le DIT', () => {
  it('⚠️ met le fichier en attente au lieu de l’envoyer', async () => {
    const { onImage, onEnAttente } = poser({ productId: null })

    choisirUnFichier()

    await waitFor(() => expect(onEnAttente).toHaveBeenCalledWith(OCTETS))
    // Le produit n'a pas d'identifiant : l'appel serait un 404 garanti.
    expect(api.uploadImage, 'aucun envoi possible sans identifiant').not.toHaveBeenCalled()
    expect(onImage).not.toHaveBeenCalled()
  })

  it('⚠️ ANNONCE que la photo n’est pas encore envoyée', async () => {
    /**
     * Taire ce délai ferait croire à un enregistrement qui n'a pas eu lieu —
     * la famille du toast de succès sur un PATCH refusé.
     */
    poser({ productId: null })
    choisirUnFichier()
    await waitFor(() => expect(screen.getByText(/Envoyée à la création/i)).toBeTruthy())
  })

  it('retirer un fichier en attente ne touche PAS le serveur', async () => {
    const { onEnAttente } = poser({ productId: null })
    choisirUnFichier()
    await waitFor(() => expect(screen.getByText(/Retirer/i)).toBeTruthy())

    fireEvent.click(screen.getByText(/Retirer/i))

    expect(api.removeImage, 'rien n’a jamais été envoyé').not.toHaveBeenCalled()
    await waitFor(() => expect(onEnAttente).toHaveBeenLastCalledWith(null))
  })
})

describe('⚠️ l’ÉMOJI n’est pas une photo — la collision de noms', () => {
  it('un produit sans photo affiche son émoji, et AUCUN <img>', async () => {
    /**
     * `StockForm.image` porte l'émoji ('🌾') et `Product.image` une URL. Si le
     * champ passait l'émoji en `p.image` au lieu de `p.emoji`, on obtiendrait un
     * `<img src="🌾">` : une requête vers une adresse absurde, et une vignette
     * cassée. Le contrôle porte sur le DOM rendu, pas sur la source.
     */
    poser({ productId: 'p1', image: null, emoji: '🌾' })

    expect(document.querySelector('img'), 'aucune image ne doit être demandée').toBeNull()
    expect(screen.getByText('🌾')).toBeTruthy()
  })

  it('témoin POSITIF — avec une vraie URL, un <img> apparaît bien', async () => {
    // Sans ce sens, un composant qui n'affiche JAMAIS d'image passerait le cas
    // ci-dessus. C'est le couple qui discrimine.
    poser({ productId: 'p1', image: 'https://img.test/a.jpg', emoji: '🌾' })

    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img.test/a.jpg')
  })
})
