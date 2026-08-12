import { readFileSync } from 'fs'
import { join } from 'path'
import { actionRedimension, PRODUIT_MAX_PX, PRODUIT_QUALITE } from '../lib/productPhoto'

/**
 * PHOTO DE PRODUIT — la décision de redimensionnement, et l'anti-dérive avec le web.
 *
 * ⚠️ CE QUI N'EST PAS EXERÇABLE : la manipulation réelle. `expo-image-manipulator`
 * est natif, jest n'a ni décodeur d'image ni moteur de rendu. Ce fichier garde la
 * DÉCISION (faut-il redimensionner, et sur quel côté), jamais les pixels.
 */

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/product-photo.json'), 'utf8'),
) as { maxPx: number; qualite: number }

describe('⚠️ anti-dérive web ↔ mobile', () => {
  it('les constantes mobiles suivent la fixture partagée', () => {
    /**
     * Les deux plateformes redimensionnent CHEZ ELLES, avec des outils sans aucun
     * code commun. Rien d'autre que ce test n'empêche l'une de bouger seule — et
     * une divergence se paie au Go·MOIS, puisque R2 facture le stockage.
     */
    expect(PRODUIT_MAX_PX).toBe(FIXTURE.maxPx)
    expect(PRODUIT_QUALITE).toBe(FIXTURE.qualite)
  })

  it('⚠️ la fixture ne reprend PAS les réglages de l’OCR', () => {
    // `useSupplierOcr` compresse à 1920 px / 0,7 — c'est un réglage de lisibilité
    // de texte. Le copier ici rendrait chaque photo ~14× plus lourde. Ce test
    // existe parce que ce copier-coller est le geste naturel.
    expect(FIXTURE.maxPx).not.toBe(1920)
    expect(FIXTURE.qualite).not.toBe(0.7)
  })
})

describe('actionRedimension', () => {
  it('⚠️ borne le PLUS GRAND côté, pas la largeur', () => {
    /**
     * LE CŒUR DU FICHIER. `useSupplierOcr` ne contraint que la largeur. Sur une
     * photo PORTRAIT — le cas le plus courant au téléphone — la hauteur reste
     * alors libre et l'image dépasse le plafond qu'on croyait avoir posé.
     */
    expect(actionRedimension(3000, 4000, 512)).toEqual({ resize: { height: 512 } })
    expect(actionRedimension(4000, 3000, 512)).toEqual({ resize: { width: 512 } })
    // Carré : l'un ou l'autre, mais borné.
    expect(actionRedimension(2000, 2000, 512)).toEqual({ resize: { width: 512 } })
  })

  it('⚠️ n’AGRANDIT jamais', () => {
    // Agrandir ajoute des octets sans ajouter d'information — et ces octets se
    // paient tous les mois.
    expect(actionRedimension(80, 60, 512)).toBeNull()
    expect(actionRedimension(512, 512, 512)).toBeNull()
    // Témoin positif : un pixel de plus et l'action apparaît.
    expect(actionRedimension(513, 512, 512)).toEqual({ resize: { width: 512 } })
  })

  it('dimensions inconnues : on ne devine pas', () => {
    // Le picker les fournit presque toujours ; quand il ne le fait pas, envoyer
    // l'original vaut mieux que redimensionner au hasard.
    expect(actionRedimension(undefined, undefined, 512)).toBeNull()
    expect(actionRedimension(4000, undefined, 512)).toBeNull()
    expect(actionRedimension(0, 0, 512)).toBeNull()
  })
})
