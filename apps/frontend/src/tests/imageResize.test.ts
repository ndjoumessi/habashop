import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dimensionsCibles, AVATAR_MAX_PX, PRODUIT_MAX_PX, AVATAR_QUALITE } from '@/lib/imageResize'

/**
 * REDIMENSIONNEMENT D'AVATAR — ce qui est exerçable, et ce qui ne l'est pas.
 *
 * ─── ⚠️ LIMITE, ÉCRITE D'ABORD ───────────────────────────────────────────────
 * jsdom n'a NI `<canvas>` NI décodeur d'image : `resizeToDataUrl` ne peut pas être
 * exercée ici. Un test qui la « vérifierait » sous jsdom rendrait un vert qui ne
 * prouve rien — c'est pourquoi le calcul est extrait en fonction PURE et testé
 * seul, comme `normalizeAppUrl` l'est séparément d'`appUrl()`.
 *
 * Ce qui reste NON prouvé : que le canvas produise bien un JPEG de la bonne taille
 * dans un navigateur réel. La preuve serait une capture Playwright ; elle n'est pas
 * faite.
 *
 * ─── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────
 * MESURÉ le 2026-08-09 sur `GET /api/employees` : 2 146 octets sans photo,
 * 13 983 156 (14 Mo) avec 5 photos de 2 Mo en base64, 139 812 246 (140 Mo) à 50
 * employés — rendus à chaque ouverture de la page RH, sans pagination.
 */

describe('dimensionsCibles', () => {
  it('⚠️ n’AGRANDIT jamais — une petite image reste petite', () => {
    // Agrandir ajoute des octets sans ajouter d'information : une photo de 80 px
    // portée à 256 pèserait 10 fois plus pour la même quantité de détail.
    expect(dimensionsCibles(80, 60)).toEqual({ largeur: 80, hauteur: 60 })
    expect(dimensionsCibles(AVATAR_MAX_PX, AVATAR_MAX_PX)).toEqual({ largeur: 256, hauteur: 256 })
  })

  it('borne le plus GRAND côté, pas la largeur', () => {
    // Borner la largeur laisserait passer un panorama vertical de 4000 px de haut.
    expect(dimensionsCibles(4000, 3000)).toEqual({ largeur: 256, hauteur: 192 })
    expect(dimensionsCibles(3000, 4000)).toEqual({ largeur: 192, hauteur: 256 })
  })

  it('préserve le rapport d’aspect — un visage ne s’étire pas', () => {
    const { largeur, hauteur } = dimensionsCibles(1600, 1200)
    expect(Math.abs(largeur / hauteur - 1600 / 1200)).toBeLessThan(0.02)
  })

  it('⚠️ une dimension ne tombe JAMAIS à zéro', () => {
    // Une image de 4000×3 donnerait une hauteur arrondie à 0 → canvas invalide,
    // et `toDataURL` sur un canvas de hauteur nulle rend une image vide.
    const r = dimensionsCibles(4000, 3)
    expect(r.hauteur).toBeGreaterThanOrEqual(1)
    expect(r.largeur).toBe(256)
  })

  it('refuse les dimensions absurdes plutôt que de rendre du NaN', () => {
    // `NaN` se propagerait jusqu'à `canvas.width` sans lever, et produirait une
    // image vide qu'on stockerait à la place de la photo.
    for (const [w, h] of [[0, 0], [-10, 20], [Number.NaN, 100], [Infinity, 100]]) {
      expect(dimensionsCibles(w, h)).toEqual({ largeur: 0, hauteur: 0 })
    }
  })

  it('le plafond est PARAMÉTRABLE — le jour où les photos produit arrivent', () => {
    // Une photo de produit ne se regarde pas comme un avatar : le même module
    // doit servir, avec un autre plafond, sans être réécrit.
    expect(dimensionsCibles(2000, 1000, 800)).toEqual({ largeur: 800, hauteur: 400 })
  })

  it('⚠️ le gain est de DEUX ordres de grandeur — la raison d’être du module', () => {
    // 2000×1500 → 256×192, soit 61 fois moins de pixels. À qualité JPEG égale
    // c'est le passage de ~2 Mo à ~20 Ko qui rend la colonne Postgres tenable.
    const avant = 2000 * 1500
    const { largeur, hauteur } = dimensionsCibles(2000, 1500)
    expect(avant / (largeur * hauteur)).toBeGreaterThan(50)
  })
})

// ── Anti-dérive avec le mobile ───────────────────────────────────────────────
describe('⚠️ photo de PRODUIT — valeurs partagées avec le mobile', () => {
  /**
   * Les deux plateformes redimensionnent CHEZ ELLES (le serveur n'a pas de
   * `sharp`) avec des outils sans aucun code commun : `canvas.toBlob` ici,
   * `expo-image-manipulator` là-bas. Rien d'autre que ce couple de tests
   * n'empêche l'une de bouger seule — et une divergence se paie au Go·MOIS,
   * puisque R2 facture le stockage.
   *
   * ⚠️ Le jumeau est `mobile/src/__tests__/productPhoto.test.ts`. Modifier la
   * fixture sans toucher les deux côtés fait rougir celui qu'on a oublié.
   */
  const FIXTURE = JSON.parse(
    readFileSync(join(process.cwd(), '../../docs/shared-fixtures/product-photo.json'), 'utf8'),
  ) as { maxPx: number; qualite: number }

  it('les constantes web suivent la fixture partagée', () => {
    expect(PRODUIT_MAX_PX).toBe(FIXTURE.maxPx)
    expect(AVATAR_QUALITE).toBe(FIXTURE.qualite)
  })

  it('⚠️ la photo de PRODUIT est plus grande que l’AVATAR — ce sont deux besoins', () => {
    // Un avatar s'affiche entre 40 et 100 px ; une photo de produit peut demain
    // remplir une carte de catalogue. Les aligner ferait perdre l'un des deux.
    expect(PRODUIT_MAX_PX).toBeGreaterThan(AVATAR_MAX_PX)
  })
})
