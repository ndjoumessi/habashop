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
) as { editeur: string; contact: string; surfaces: string[] }

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
