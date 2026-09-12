import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * L'ÉDITEUR EST DÉCLARÉ UNE FOIS, ET LES QUATRE SURFACES PUBLIQUES S'ACCORDENT.
 *
 * ── La divergence, mesurée le 2026-08-15 ─────────────────────────────────────────────
 *   `legal/privacy-policy.html`  → « Éditeur : HabaShop »      · privacy@habashop.com
 *   `pages/Privacy.tsx`          → « édité par Nelson Djoumessi » · romel.djoumessi@gmail.com
 * Deux documents publics qui se contredisent sur QUI s'engage. Et « HabaShop » est un nom
 * de PRODUIT : un produit ne peut pas être l'éditeur de lui-même.
 *
 * ── Le défaut PLUS GRAVE trouvé en mesurant ──────────────────────────────────────────
 * `habashop.com` est ENREGISTRÉ (A 193.158.2.130, page de parking) mais n'a AUCUN
 * enregistrement MX — vérifié sur deux résolveurs, avec témoin positif (gmail.com rend
 * bien ses MX). `contact@`, `support@` et `privacy@` ne recevaient donc RIEN.
 *
 * Ce n'était pas cosmétique :
 *   · `legal/account-deletion.html` est la page RÉFÉRENCÉE DANS GOOGLE PLAY CONSOLE, et
 *     son « Option 2 — Par email » donnait cette adresse comme voie de suppression de
 *     compte. Une voie de recours qui ne reçoit rien est un manquement, pas un détail ;
 *   · les CGU rédigées le matin même y renvoyaient aussi, en articles 2, 11 et 15.
 *
 * Un document légal qui donne une adresse injoignable, c'est un lien mort — sur la voie de
 * recours cette fois. Même famille que `noDeadLinks.test.ts`, conséquences plus lourdes.
 *
 * ⚠️ POURQUOI UNE FIXTURE ET PAS UN MODULE PARTAGÉ : deux des quatre surfaces sont des
 * pages HTML STATIQUES (`legal/`), publiées par GitHub Pages, hors du bundle React. Elles
 * ne peuvent rien importer. La fixture est donc la source de vérité du VERROU ; chaque
 * surface porte la valeur en dur, et ce fichier échoue si l'une dérive. C'est le motif des
 * jumeaux du dépôt (`barcode-cases.json`, `payroll-net-cases.json`).
 *
 * ⚠️ Le jour où `habashop.com` aura ses MX, on change `publisher.json` et on repropage —
 * c'est toute la raison d'être de la fixture.
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const FIXTURE = JSON.parse(
  readFileSync(join(RACINE, 'docs', 'shared-fixtures', 'publisher.json'), 'utf8'),
) as {
  editeur: string; contact: string; surfaces: string[]
  formeJuridique: string; registre: string; siren: string; siret: string; ape: string
  siege: string; surfacesImmatriculation: string[]
}

const lire = (rel: string) => readFileSync(join(RACINE, rel), 'utf8')

describe('identité de l’éditeur — une seule, sur les quatre surfaces publiques', () => {
  it('COUVERTURE — la fixture nomme ses surfaces, et elles sont toutes lisibles', () => {
    // ⚠️ Sans ce cas, un chemin renommé ferait passer les assertions suivantes en ne
    // lisant rien : le `readFileSync` lèverait, certes, mais une liste VIDE ne lèverait
    // pas. On exige donc un plancher ET une lecture réussie de chacune.
    expect(FIXTURE.surfaces.length).toBeGreaterThanOrEqual(4)
    for (const s of FIXTURE.surfaces) {
      expect({ s, octets: lire(s).length > 200 }).toEqual({ s, octets: true })
    }
  })

  it('la fixture ne déclare pas un nom de PRODUIT comme éditeur', () => {
    // C'était la moitié du défaut : « Éditeur : HabaShop ».
    expect(FIXTURE.editeur.toLowerCase()).not.toContain('habashop')
    expect(FIXTURE.editeur.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2)
  })

  it('chaque surface porte l’adresse de contact de la fixture', () => {
    const manquantes = FIXTURE.surfaces.filter(s => !lire(s).includes(FIXTURE.contact))
    expect(manquantes).toEqual([])
  })

  it('⚠️ aucune surface publique ne renvoie plus vers une boîte @habashop.com', () => {
    // Le domaine n'a AUCUN MX : ces adresses ne reçoivent rien. Elles reviendront le jour
    // où le courrier sera configuré — par la fixture, pas à la main.
    const AUTRES = [
      'apps/frontend/src/components/landing/LandingFooter.tsx',
      'apps/frontend/src/components/landing/LandingPricing.tsx',
      'apps/frontend/src/pages/LoginPage.tsx',
    ]
    const fautives: string[] = []
    for (const s of [...FIXTURE.surfaces, ...AUTRES]) {
      // Les commentaires expliquent le défaut en le CITANT : on les retire, sinon le
      // verrou s'attrape lui-même (leçon déjà payée dans `noDeadLinks.test.ts`).
      const nu = lire(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '')
      for (const m of nu.matchAll(/[\w.-]+@habashop\.com/g)) fautives.push(`${s} → ${m[0]}`)
    }
    expect([...new Set(fautives)]).toEqual([])
  })

  it('les deux pages `legal/` déclarent le MÊME éditeur que la page in-app', () => {
    // ⚠️ `legal/` est publié par GitHub Pages et n'est PAS dans le bundle : aucun test de
    // rendu ne le couvre, aucune vérification d'artefact non plus. Ce cas est la seule
    // chose qui empêche les deux moitiés du site public de se contredire.
    expect(lire('legal/privacy-policy.html')).toContain(FIXTURE.editeur)
    expect(lire('apps/frontend/src/pages/Privacy.tsx')).toContain(FIXTURE.editeur)
    expect(lire('apps/frontend/src/pages/Terms.tsx')).toContain(FIXTURE.editeur)
  })

  it('DISCRIMINANT — le scan SAIT reconnaître une adresse @habashop.com', () => {
    // Sans ce cas, une regex cassée rendrait « 0 fautive » et se lirait comme une victoire.
    const motif = /[\w.-]+@habashop\.com/g
    expect('écrire à support@habashop.com svp'.match(motif)).toEqual(['support@habashop.com'])
    expect('écrire à romel.djoumessi@gmail.com svp'.match(motif)).toBeNull()
  })
})

// ── L'IMMATRICULATION ────────────────────────────────────────────────────────────────
//
// Ajoutée le 2026-09-12 depuis l'attestation RNE du 10/09/2026. L'article 2 des CGU disait
// « [À COMPLÉTER — forme juridique, numéro d'immatriculation et adresse du siège] » : des
// conditions de vente qui ne disent pas QUI vend n'engagent personne de façon vérifiable.
//
// ⚠️ Le verrou NORMALISE LES ESPACES avant de chercher. Un SIREN s'écrit « 109 761 023 »,
// et ce dépôt a déjà payé le prix de QUATRE séparateurs coexistants (U+0020, U+202F,
// U+00A0, U+002C) : une mise en forme par `toLocaleString`, un copier-coller depuis un PDF,
// et le verrou cherche une forme qui ne peut PAS exister. On normalise avant, jamais après.
describe('immatriculation de l’éditeur — les CGU disent QUI vend, et le disent juste', () => {
  const sansEspaces = (x: string) => x.replace(/[\s\u00a0\u202f]+/g, '')

  it('COUVERTURE — les deux surfaces d’immatriculation sont nommées et lisibles', () => {
    expect(FIXTURE.surfacesImmatriculation.length).toBeGreaterThanOrEqual(2)
    for (const s of FIXTURE.surfacesImmatriculation) {
      expect({ s, octets: lire(s).length > 200 }).toEqual({ s, octets: true })
    }
  })

  it('le SIRET COMMENCE par le SIREN — l’invariant de la fixture elle-même', () => {
    // SIRET = SIREN (9 chiffres) + NIC (5). Deux nombres saisis à la main qui se
    // contrediraient rendraient les deux verrous ci-dessous d'accord entre eux et faux
    // ensemble : on épingle d'abord la source.
    expect(sansEspaces(FIXTURE.siret).startsWith(sansEspaces(FIXTURE.siren))).toBe(true)
    expect(sansEspaces(FIXTURE.siret)).toHaveLength(14)
    expect(sansEspaces(FIXTURE.siren)).toHaveLength(9)
  })

  it('chaque surface porte SIREN, SIRET, forme juridique et siège — sans divergence', () => {
    // ⚠️ LE SIREN SE CHERCHE APRÈS AVOIR RETIRÉ LE SIRET. Mesuré : un sabotage qui met un
    // SIREN FAUX (…024) sur une surface passait VERT, parce que le SIRET voisin
    // (10976102300018) contient encore les neuf chiffres justes. C'est la sous-chaîne qui
    // satisfait la recherche — le défaut que `matchesScannedCode` refuse déjà côté
    // codes-barres. Un verrou qui ne détecte pas son propre cas ne garde rien.
    const manquants: string[] = []
    for (const s of FIXTURE.surfacesImmatriculation) {
      const nu = sansEspaces(lire(s))
      const horsSiret = nu.split(sansEspaces(FIXTURE.siret)).join('␟')
      for (const [nom, val, foin] of [
        ['siren', FIXTURE.siren, horsSiret],
        ['siret', FIXTURE.siret, nu],
        ['formeJuridique', FIXTURE.formeJuridique, nu],
        ['ape', FIXTURE.ape, nu],
        ['siege', FIXTURE.siege, nu],
      ] as [string, string, string][]) {
        if (!foin.includes(sansEspaces(val))) manquants.push(`${s} → ${nom}`)
      }
    }
    expect(manquants).toEqual([])
  })

  it('⚠️ « RCS » N’APPARAÎT PAS — l’activité est libérale, l’éditeur n’est pas commerçant', () => {
    // Une mention « RCS Marseille » serait FAUSSE sur un document contractuel : un libéral
    // non réglementé n'a aucune immatriculation au registre du commerce. C'est le piège du
    // modèle générique — il propose la mention que « tout le monde met ».
    for (const s of FIXTURE.surfacesImmatriculation) {
      const nu = lire(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '')
      expect({ s, rcs: /\bRCS\b/.test(nu) }).toEqual({ s, rcs: false })
    }
    expect(FIXTURE.registre).toContain('Registre national des entreprises')
  })

  it('⚠️ LA DATE DE NAISSANCE NE FUIT PAS — elle est sur l’attestation, pas dans les CGU', () => {
    // On publie ce que les mentions légales demandent, pas tout ce que la source contient.
    // Le mois et l'année de naissance figurent sur l'attestation RNE ; ils n'ont rien à
    // faire sur une page publique, et rien ne les y appelle.
    for (const s of [...FIXTURE.surfaces, ...FIXTURE.surfacesImmatriculation]) {
      expect({ s, naissance: /\b(0?7\/1990|07-1990)\b/.test(lire(s)) }).toEqual({ s, naissance: false })
    }
  })

  it('DISCRIMINANT — la normalisation d’espaces reconnaît bien les deux écritures', () => {
    // Sans ce cas, une normalisation cassée rendrait « 0 manquant » et se lirait en victoire.
    expect(sansEspaces('109 761 023')).toBe('109761023')
    expect(sansEspaces('109\u202f761\u202f023')).toBe('109761023')
    expect(sansEspaces('109 761 024')).not.toBe('109761023')
  })
})
