import { renderHook, act } from '@testing-library/react-native'

/**
 * L'ENVOI DE PHOTO DEPUIS LE TÉLÉPHONE — ce qui part, et ce qui ne part pas.
 *
 * ⚠️ CE QUI EST SIMULÉ, ET POURQUOI. `expo-image-picker` et
 * `expo-image-manipulator` sont des modules NATIFS : jest ne peut ni ouvrir un
 * appareil photo ni décoder une image. Ils sont donc remplacés. Ce fichier garde
 * la DÉCISION — permission, annulation, ce qu'on envoie et à qui — jamais les
 * pixels ni le dispatch natif.
 *
 * ⚠️ LES SIMULACRES APPLIQUENT LEURS ARGUMENTS. `manipulateAsync` vérifie qu'on
 * lui passe bien l'action et la qualité attendues ; `uploadImage` retient l'URI
 * reçue. Un `mockResolvedValue` qui ignore ses arguments resterait vert même si
 * le hook envoyait l'image d'ORIGINE, non redimensionnée — c'est-à-dire le défaut
 * que tout ce lot existe pour éviter.
 */

const etatPicker = { permission: 'granted' as string, annule: false, asset: { uri: 'file:///orig.jpg', width: 4000, height: 3000 } }
const appels = { manipulate: [] as unknown[][], upload: [] as unknown[][], remove: [] as unknown[][] }

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: etatPicker.permission })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: etatPicker.permission })),
  launchCameraAsync: jest.fn(async () => (etatPicker.annule ? { canceled: true } : { canceled: false, assets: [etatPicker.asset] })),
  launchImageLibraryAsync: jest.fn(async () => (etatPicker.annule ? { canceled: true } : { canceled: false, assets: [etatPicker.asset] })),
}))

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(async (...args: unknown[]) => {
    appels.manipulate.push(args)
    return { uri: 'file:///redimensionne.jpg' }
  }),
}))

const echec = { upload: null as string | null, remove: null as string | null }
jest.mock('@/services/api', () => ({
  apiErrorMessage: (e: unknown) => (e as Error)?.message ?? null,
  productsApi: {
    uploadImage: jest.fn(async (...args: unknown[]) => {
      appels.upload.push(args)
      if (echec.upload) throw new Error(echec.upload)
      return { image: 'https://img.test/tenants/T/products/P/abc.jpg' }
    }),
    removeImage: jest.fn(async (...args: unknown[]) => {
      appels.remove.push(args)
      if (echec.remove) throw new Error(echec.remove)
      return { image: null }
    }),
  },
}))

import { useProductPhoto } from '../hooks/useProductPhoto'

beforeEach(() => {
  etatPicker.permission = 'granted'
  etatPicker.annule = false
  etatPicker.asset = { uri: 'file:///orig.jpg', width: 4000, height: 3000 }
  echec.upload = null
  echec.remove = null
  appels.manipulate.length = 0
  appels.upload.length = 0
  appels.remove.length = 0
})

describe('envoi nominal', () => {
  it('⚠️ envoie l’image REDIMENSIONNÉE, jamais l’originale', async () => {
    const { result } = await renderHook(() => useProductPhoto())
    let r: unknown
    await act(async () => { r = await result.current.envoyer('P1', 'camera') })

    expect(r).toEqual({ etat: 'ok', url: 'https://img.test/tenants/T/products/P/abc.jpg' })

    // La compression a bien eu lieu, sur l'URI d'origine, avec NOS réglages.
    expect(appels.manipulate).toHaveLength(1)
    const [uri, actions, options] = appels.manipulate[0] as [string, unknown[], Record<string, unknown>]
    expect(uri).toBe('file:///orig.jpg')
    expect(actions).toEqual([{ resize: { width: 512 } }])   // 4000×3000 → paysage
    expect(options.compress).toBe(0.82)
    expect(options.format).toBe('jpeg')

    // ⚠️ Et c'est bien le RÉSULTAT de la compression qui part, pas l'original.
    expect(appels.upload).toHaveLength(1)
    expect(appels.upload[0]).toEqual(['P1', 'file:///redimensionne.jpg'])
  })

  it('une photo PORTRAIT est bornée en hauteur', async () => {
    etatPicker.asset = { uri: 'file:///portrait.jpg', width: 3000, height: 4000 }
    const { result } = await renderHook(() => useProductPhoto())
    await act(async () => { await result.current.envoyer('P1', 'gallery') })

    const [, actions] = appels.manipulate[0] as [string, unknown[]]
    expect(actions).toEqual([{ resize: { height: 512 } }])
  })
})

describe('⚠️ les issues qui ne sont PAS des échecs', () => {
  it('annulation du picker : rien n’est envoyé, aucune erreur', async () => {
    // Fermer le sélecteur est une décision de l'utilisateur, pas une panne.
    etatPicker.annule = true
    const { result } = await renderHook(() => useProductPhoto())
    let r: unknown
    await act(async () => { r = await result.current.envoyer('P1', 'camera') })

    expect(r).toEqual({ etat: 'annule' })
    expect(appels.manipulate).toHaveLength(0)   // aucune compression inutile
    expect(appels.upload).toHaveLength(0)       // aucun envoi
  })

  it('⚠️ permission refusée : NOMMÉE, et la source est rendue', async () => {
    // Le geste correctif est dans les réglages du téléphone, pas dans l'app :
    // un « échec » générique enverrait chercher au mauvais endroit.
    etatPicker.permission = 'denied'
    const { result } = await renderHook(() => useProductPhoto())
    let r: unknown
    await act(async () => { r = await result.current.envoyer('P1', 'gallery') })

    expect(r).toEqual({ etat: 'permission', source: 'gallery' })
    expect(appels.upload).toHaveLength(0)
  })
})

describe('échecs', () => {
  it('un refus du serveur remonte SON message', async () => {
    // 415 format, 403 quota, 503 stockage absent : seul le serveur les distingue.
    echec.upload = 'Format non accepté — JPEG, PNG ou WebP.'
    const { result } = await renderHook(() => useProductPhoto())
    let r: unknown
    await act(async () => { r = await result.current.envoyer('P1', 'camera') })

    expect(r).toEqual({ etat: 'echec', message: 'Format non accepté — JPEG, PNG ou WebP.' })
  })

  it('le retrait rend ok, ou l’échec — deux issues, pas quatre', async () => {
    const { result } = await renderHook(() => useProductPhoto())
    let r: unknown
    await act(async () => { r = await result.current.retirer('P1') })
    expect(r).toEqual({ etat: 'ok' })
    expect(appels.remove[0]).toEqual(['P1'])

    echec.remove = 'Produit introuvable.'
    await act(async () => { r = await result.current.retirer('P1') })
    expect(r).toEqual({ etat: 'echec', message: 'Produit introuvable.' })
  })
})
