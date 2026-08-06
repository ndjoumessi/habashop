import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fichiersAtteignables } from '../../scripts/classAudit.mjs'

/**
 * VERROU — le filtre de chemin du workflow « Densité » couvre bien le périmètre RÉEL.
 *
 * ─── LE PROBLÈME, ET POURQUOI IL N'A PAS DE SOLUTION PROPRE ──────────────────
 * `paths:` dans un workflow GitHub est une liste STATIQUE : elle ne peut pas être calculée
 * au déclenchement. C'est donc un **périmètre écrit à la main** — la classe de défaut qui a
 * coûté `signup/` (verrou qui listait ses fichiers et oubliait un dossier) puis `\b8000\b`
 * (motif qui ne pouvait pas exister). Il sera faux le jour où quelqu'un déplacera un fichier.
 *
 * On ne peut pas le dériver. On peut le RÉCONCILIER : ce test recalcule le graphe d'imports
 * et rougit si un fichier du périmètre propre de la console cesse d'être couvert par le YAML.
 * Le filtre reste écrit à la main ; il n'est plus écrit à l'aveugle.
 *
 * ─── POURQUOI PAS « TOUTE LA FERMETURE » — MESURÉ, dans les DEUX SENS ────────
 *   1. LE GRAPHE SUR-INCLUT. La fermeture de `DevTableHarness` compte 36 fichiers, dont 15
 *      ne viennent QUE de `lib/api.ts`, un hub de types qui importe `hrShared`, `posShared`,
 *      `stockShared`… Les inclure ferait tourner la mesure à chaque changement RH ou POS.
 *   2. LE GRAPHE SOUS-INCLUT. `src/index.css` n'est dans AUCUNE fermeture — la feuille est
 *      chargée par `main.tsx`. Or c'est là que vit `.table-wrap { overflow-x }`, dont le
 *      retrait fait rougir 3 cas sur 4. Le dérivé raterait le fichier le plus important.
 *
 * Le périmètre gardé est donc `fermeture(harnais) ∖ fermeture(api.ts)`, **plus la feuille**.
 */

const FRONT = resolve(__dirname, '..', '..')
const RACINE = resolve(FRONT, '..', '..')
const WORKFLOW = join(RACINE, '.github', 'workflows', 'density.yml')

/** Motifs `paths:` du workflow — lus, jamais recopiés ici (sinon ils se périment en silence). */
function motifs(): string[] {
  const src = readFileSync(WORKFLOW, 'utf8')
  const bloc = /paths:\s*&perimetre\n([\s\S]*?)\n {2}pull_request:/.exec(src)?.[1] ?? ''
  return [...bloc.matchAll(/^\s*-\s*'([^']+)'/gm)].map(m => m[1])
}

/** `dir/**` = préfixe ; sinon égalité stricte. Les motifs employés ici n'en demandent pas plus. */
function couvert(chemin: string, pats: string[]): boolean {
  return pats.some(p => (p.endsWith('/**') ? chemin.startsWith(p.slice(0, -2)) : chemin === p))
}

/** Chemins RELATIFS À LA RACINE du dépôt — c'est l'unité de `paths:`. */
function depuisRacine(entree: string): Set<string> {
  return new Set(
    fichiersAtteignables(join(FRONT, 'src'), join(FRONT, entree))
      .map(f => relative(RACINE, resolve(f))),
  )
}

describe('filtre de chemin du workflow Densité', () => {
  const pats = motifs()
  const fermetureHarnais = depuisRacine('src/pages/DevTableHarness.tsx')
  const fermetureApi = depuisRacine('src/lib/api.ts')
  const perimetrePropre = [...fermetureHarnais].filter(f => !fermetureApi.has(f)).sort()

  it('COUVERTURE — le workflow et le graphe sont bien LUS', () => {
    // Angle mort n°1 : un regex qui ne matche rien rendrait toutes les assertions vides.
    expect(pats.length, 'aucun motif extrait du YAML').toBeGreaterThanOrEqual(10)
    expect(fermetureHarnais.size, 'graphe du harnais vide').toBeGreaterThanOrEqual(30)
    expect(fermetureApi.size, 'graphe d’api.ts vide').toBeGreaterThanOrEqual(10)
    expect(perimetrePropre.length, 'périmètre propre vide').toBeGreaterThanOrEqual(15)
  })

  it('CHAQUE fichier du périmètre propre est couvert par le filtre', () => {
    // C'est la réconciliation : le YAML est écrit à la main, ce test le confronte au graphe.
    const nus = perimetrePropre.filter(f => !couvert(f, pats))
    expect(nus, [
      'Ces fichiers sont dans le périmètre RÉEL de la console mais AUCUN motif',
      `de \`${relative(RACINE, WORKFLOW)}\` ne les couvre — la mesure de densité ne`,
      'tournerait pas si on les modifiait. Ajouter le chemin, ou dire pourquoi on l’exclut.',
    ].join('\n')).toEqual([])
  })

  it('⚠️ la FEUILLE est couverte — elle n’est dans aucun graphe d’imports', () => {
    // Le fichier que le sabotage vise (`overflow-x` de `.table-wrap`) et que la dérivation
    // rate : c'est la moitié « sous-inclut » de la mesure, figée ici.
    expect(fermetureHarnais.has('apps/frontend/src/index.css'), 'le CSS ne devrait PAS être dans le graphe').toBe(false)
    expect(couvert('apps/frontend/src/index.css', pats), 'la feuille doit être dans le filtre').toBe(true)
  })

  it('l’outillage de la mesure se déclenche lui-même', () => {
    for (const f of [
      'apps/frontend/e2e/dev/table-density.spec.ts',
      'apps/frontend/playwright.density.config.ts',
      'apps/frontend/src/pages/DevTableHarness.tsx',
      '.github/workflows/density.yml',
    ]) expect(couvert(f, pats), `« ${f} » doit déclencher la mesure`).toBe(true)
  })

  it('les modules tirés par le SEUL hub `api.ts` sont EXCLUS — exclusion délibérée', () => {
    // Sans cette exclusion, toute modification RH, POS ou stock lancerait un navigateur.
    // ⚠️ Si un `*Shared` se met un jour à porter de la mise en page de la console, il faudra
    // l'ajouter NOMMÉMENT : ce test fige l'exclusion pour qu'elle reste un CHOIX, pas un oubli.
    const tiresParLeHub = [...fermetureApi].filter(f => f !== 'apps/frontend/src/lib/api.ts')
    expect(tiresParLeHub.length).toBeGreaterThanOrEqual(10)
    const couverts = tiresParLeHub.filter(f => couvert(f, pats))
    // `hooks/**` et `components/ui/**` peuvent en recouper : on vérifie que les `*Shared`
    // de domaine, eux, restent dehors.
    const sharedDeDomaine = tiresParLeHub.filter(f => /components\/(customers|hr|orders|pos|stock|suppliers|dashboard)\//.test(f))
    expect(sharedDeDomaine.length, 'aucun *Shared de domaine trouvé — le scan ne garde rien').toBeGreaterThanOrEqual(5)
    expect(sharedDeDomaine.filter(f => couvert(f, pats)), 'un *Shared de domaine déclencherait la mesure').toEqual([])
    void couverts
  })

  it('le filtre ne ratisse pas TOUT le frontend', () => {
    // Un filtre qui matche tout n'est pas un filtre : il rend le workflow séparé inutile.
    for (const f of [
      'apps/frontend/src/pages/POS.tsx',
      'apps/frontend/src/pages/HR.tsx',
      'apps/backend/src/routes/sales.ts',
      'CLAUDE.md',
      'docs/modules.md',
    ]) expect(couvert(f, pats), `« ${f} » ne doit PAS déclencher la mesure`).toBe(false)
  })
})
