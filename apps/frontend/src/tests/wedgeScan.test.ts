import { describe, it, expect, vi } from 'vitest'
import {
  looksLikeScannedInput, looksLikeScannerBurst, typingElapsed,
  WEDGE_MAX_MS_PER_CHAR, WEDGE_MIN_LENGTH, WEDGE_IDLE_MS,
} from '@/components/pos/wedgeScan'
import { resolveScannedCode } from '@/components/pos/scanResolve'

/**
 * Douchette USB/Bluetooth (keyboard wedge) — chemin de scan PRIMAIRE en boutique.
 *
 * Elle tape le code puis envoie Entrée. Avant, ce chemin ne passait pas par la
 * résolution de scan : la saisie filtrait la grille et, sur cache périmé, le caissier
 * se retrouvait devant une grille VIDE sans explication. Ces tests verrouillent les
 * deux côtés : la douchette est reconnue et résolue comme la caméra, et la recherche
 * par nom continue de filtrer.
 */

const scanSpeed = (len: number) => len * 5     // ~5 ms/caractère : cadence douchette
const humanSpeed = (len: number) => len * 180  // ~180 ms/caractère : frappe humaine

describe('looksLikeScannedInput — douchette vs recherche', () => {
  it('code-barres VALIDE → scan, même tapé lentement à la main', () => {
    // Un caissier qui recopie un code doit obtenir la même explication qu'un scan,
    // pas une grille vide.
    expect(looksLikeScannedInput('4006381333931', humanSpeed(13))).toBe(true)
  })

  it('UPC-A (12 chiffres) → scan (canonicalisé par la brique partagée)', () => {
    expect(looksLikeScannedInput('036000291452', humanSpeed(12))).toBe(true)
  })

  it('étiquette CODE128-sur-SKU à cadence machine → scan', () => {
    expect(looksLikeScannedInput('PRD-0009', scanSpeed(8))).toBe(true)
  })

  it('« lait » tapé à la main → RECHERCHE (la grille filtre comme avant)', () => {
    expect(looksLikeScannedInput('lait', humanSpeed(4))).toBe(false)
  })

  it('« riz 5kg » tapé à la main → RECHERCHE', () => {
    expect(looksLikeScannedInput('riz 5kg', humanSpeed(7))).toBe(false)
  })

  it('saisie trop courte à cadence rapide → pas de scan (« ok », « 12 »)', () => {
    expect(looksLikeScannedInput('ok', 10)).toBe(false)
    expect('ok'.length).toBeLessThan(WEDGE_MIN_LENGTH)
  })

  it('champ vide → rien', () => {
    expect(looksLikeScannedInput('', 0)).toBe(false)
    expect(looksLikeScannedInput('   ', 0)).toBe(false)
  })

  it('durée non mesurable (collé) → seule la FORME peut trancher', () => {
    expect(looksLikeScannedInput('4006381333931', null)).toBe(true)
    expect(looksLikeScannedInput('lait', null)).toBe(false)
  })

  it('la frontière de cadence est celle qui est documentée', () => {
    const v = 'ABCDEFGH' // 8 caractères, pas un code-barres
    expect(looksLikeScannedInput(v, WEDGE_MAX_MS_PER_CHAR * v.length)).toBe(true)
    expect(looksLikeScannedInput(v, WEDGE_MAX_MS_PER_CHAR * v.length + 1)).toBe(false)
  })
})

describe('typingElapsed', () => {
  it('mesure la durée depuis la première touche', () => {
    expect(typingElapsed({ firstKeyAt: 1000, at: 1065 })).toBe(65)
  })
  it('aucune première touche → non mesurable', () => {
    expect(typingElapsed({ firstKeyAt: null, at: 1065 })).toBeNull()
  })
  it('horloge qui recule → 0, jamais négatif', () => {
    expect(typingElapsed({ firstKeyAt: 2000, at: 1000 })).toBe(0)
  })
})

/**
 * Bout en bout : la douchette emprunte EXACTEMENT la résolution de la caméra (#146).
 * On rejoue ici la décision complète, du code tapé jusqu'à l'issue.
 */
type P = { id: string; barcode: string; name: string }
const matches = (p: P, raw: string) => p.barcode === raw
const CACHE: P[] = [{ id: 'p1', barcode: '4006381333931', name: 'Riz' }]
const NEUF: P = { id: 'p9', barcode: '5901234123457', name: 'Produit créé ce matin' }

/** `speed` : cadence de frappe simulée — douchette par défaut, humaine pour la recherche. */
async function wedge(code: string, lookup: (c: string) => Promise<P | null>, speed = scanSpeed) {
  const elapsed = speed(code.length)
  if (!looksLikeScannedInput(code, elapsed)) return { route: 'search' as const }
  const res = await resolveScannedCode<P>(code, CACHE, matches, lookup)
  return { route: 'scan' as const, res }
}

describe('bout en bout — douchette sur cache périmé', () => {
  it('code absent du cache mais connu du serveur → résolu, donc AJOUT (aucun message)', async () => {
    const lookup = vi.fn().mockResolvedValue(NEUF)
    const out = await wedge('5901234123457', lookup)
    expect(out.route).toBe('scan')
    expect(out.res).toEqual({ kind: 'remote', product: NEUF })
    expect(lookup).toHaveBeenCalledWith('5901234123457')
  })

  it('code dans le cache → ajout immédiat, aucun appel réseau', async () => {
    const lookup = vi.fn()
    const out = await wedge('4006381333931', lookup)
    expect(out.res).toEqual({ kind: 'local', product: CACHE[0] })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('lookup en échec → « unresolved » : message honnête, JAMAIS une grille vide muette', async () => {
    const out = await wedge('5901234123457', () => Promise.reject(new Error('offline')))
    expect(out.route).toBe('scan')            // la saisie a bien été traitée comme un scan
    expect(out.res).toEqual({ kind: 'unresolved' })  // → l'UI dit ce qu'elle sait
  })

  it('« lait » TAPÉ À LA MAIN n’emprunte pas le chemin scan → recherche intacte', async () => {
    const lookup = vi.fn()
    const out = await wedge('lait', lookup, humanSpeed)
    expect(out.route).toBe('search')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('⚠️ une douchette qui émettrait « lait » EST une douchette → chemin scan assumé', async () => {
    // Documente la frontière : la cadence machine tranche, quel que soit le contenu.
    // Aucune main ne tape 4 caractères en 20 ms — le faux positif humain est hors d'atteinte.
    const out = await wedge('lait', vi.fn().mockResolvedValue(null))
    expect(out.route).toBe('scan')
    expect(out.res).toEqual({ kind: 'unresolved' })
  })
})

/**
 * Douchette SANS terminateur : certaines n'envoient pas Entrée. Le champ POS tranche alors
 * sur l'INACTIVITÉ après la rafale. Le point verrouillé ici est PUR : la durée de frappe doit
 * s'arrêter à la dernière touche, jamais courir jusqu'au déclenchement — sinon le délai
 * d'inactivité diluerait la cadence sous le seuil et le scan serait manqué.
 */
describe('sans terminateur — la cadence se fige à la dernière touche', () => {
  it('durée mesurée à la dernière touche → rafale reconnue', () => {
    const first = 1000, last = 1065 // 13 car en 65 ms ≈ 5 ms/car : cadence douchette
    expect(looksLikeScannedInput('ABCDEFGHIJKLM', typingElapsed({ firstKeyAt: first, at: last }))).toBe(true)
  })

  it('durée courant jusqu’au déclenchement d’inactivité → cadence diluée, scan MANQUÉ', () => {
    // Le bug qu'on évite : l'appelant NE doit PAS mesurer jusqu'ici.
    const first = 1000, last = 1065
    const at = last + WEDGE_IDLE_MS + 300 // dernière touche + délai d'inactivité + temps réel
    expect(looksLikeScannedInput('ABCDEFGHIJKLM', typingElapsed({ firstKeyAt: first, at }))).toBe(false)
  })

  it('le délai d’inactivité reste au-dessus de l’écart inter-caractère d’une douchette (~10 ms)', () => {
    expect(WEDGE_IDLE_MS).toBeGreaterThan(10)
  })
})

/**
 * La VOIE VITESSE seule — le seul verdict admissible sur INACTIVITÉ.
 *
 * ⚠️ MESURÉ, pas raisonné : sur 10 000 EAN-13 à somme de contrôle correcte, **10,0 %** ont un
 * préfixe de 12 caractères qui est un UPC-A VALIDE (la collision tombe exactement à 12 — une
 * chance sur dix que la somme retombe juste). Si le tir sur inactivité s'autorisait de la
 * FORME, la pause d'un caissier qui recopie un code après le 12ᵉ chiffre viderait le champ et
 * ajouterait un AUTRE produit au panier. Une erreur d'ARGENT, silencieuse, une fois sur dix.
 */
describe('voie vitesse seule — ce qui a le droit de tirer sur inactivité', () => {
  const EAN_PIEGE = '5410492021592'
  const PREFIXE_PIEGE = EAN_PIEGE.slice(0, 12) // UPC-A valide

  it('la fixture porte bien la collision mesurée (sinon ce bloc ne prouve rien)', () => {
    // `looksLikeScannedInput` accepte le préfixe PAR LA FORME : c'est exactement le danger.
    expect(looksLikeScannedInput(PREFIXE_PIEGE, null)).toBe(true)
    expect(looksLikeScannedInput(EAN_PIEGE, null)).toBe(true)
    expect(EAN_PIEGE.startsWith(PREFIXE_PIEGE)).toBe(true)
  })

  it('un code VALIDE tapé à la main ne suffit PAS à la voie vitesse', () => {
    const lent = 200 * PREFIXE_PIEGE.length // cadence humaine
    expect(looksLikeScannerBurst(PREFIXE_PIEGE, lent)).toBe(false)
    // …là où le prédicat d'Entrée, lui, l'accepte : la différence est le cœur du correctif.
    expect(looksLikeScannedInput(PREFIXE_PIEGE, lent)).toBe(true)
  })

  it('une rafale à cadence machine passe, même sur un contenu non numérique (SKU CODE128)', () => {
    expect(looksLikeScannerBurst('ABCDEFGHIJKLM', 65)).toBe(true)
  })

  it('durée non mesurable (collé, autocomplété) → jamais un tir sur inactivité', () => {
    expect(looksLikeScannerBurst(EAN_PIEGE, null)).toBe(false)
  })

  it('trop court pour trancher sur la seule vitesse', () => {
    expect(looksLikeScannerBurst('ok', 2)).toBe(false)
    expect(WEDGE_MIN_LENGTH).toBe(4)
  })
})
