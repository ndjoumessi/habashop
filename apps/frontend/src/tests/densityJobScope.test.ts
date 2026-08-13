import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fichiersAtteignables } from '../../scripts/classAudit.mjs'

/**
 * VERROU — le filtre de chemin du workflow « Densité » couvre bien ce qui est MESURÉ.
 *
 * ─── CE VERROU A CHANGÉ D'OBJET LE 2026-08-13, ET IL FAUT LE DIRE ────────────
 * Il réconciliait une liste de 50 chemins écrite à la main avec la fermeture d'imports
 * du harnais. Cette liste n'existe plus : depuis que la mesure ouvre des ÉCRANS
 * COMPLETS (`/app/stock`, `/app/pos`), le périmètre réel est de 224 fichiers sur les
 * 240 joignables depuis `App.tsx` — mesuré — et le filtre est devenu
 * `apps/frontend/src/**`. Réconcilier une liste avec un graphe n'avait plus d'objet.
 *
 * ⚠️ UN VERROU DONT L'OBJET DISPARAÎT NE SE GARDE PAS « AU CAS OÙ » : il se réécrit
 * ou il se supprime. Gardé tel quel, il serait devenu trivialement vert — il aurait
 * vérifié que `src/**` couvre des fichiers de `src/`, ce qui est vrai par construction.
 * Ce qu'il garde maintenant est plus étroit mais RÉEL :
 *   1. les points d'ENTRÉE des deux mesures sont bien déclenchés ;
 *   2. la feuille de style l'est aussi — invisible de tout graphe d'imports ;
 *   3. le filtre EXCLUT toujours ce qui n'est pas mesuré (backend, mobile, docs) ;
 *   4. les fichiers de mesure eux-mêmes se déclenchent.
 */

const FRONT = resolve(__dirname, '..', '..')
const RACINE = resolve(FRONT, '..', '..')
const WORKFLOW = join(RACINE, '.github', 'workflows', 'density.yml')

/** Motifs `paths:` du workflow — LUS, jamais recopiés ici (sinon ils se périment). */
function motifs(): string[] {
  const src = readFileSync(WORKFLOW, 'utf8')
  const bloc = /paths:\s*&perimetre\n([\s\S]*?)\n {2}pull_request:/.exec(src)?.[1] ?? ''
  return [...bloc.matchAll(/^\s*-\s*'([^']+)'/gm)].map(m => m[1])
}

/** `dir/**` = préfixe ; sinon égalité stricte. */
function couvert(chemin: string, pats: string[]): boolean {
  return pats.some(p => (p.endsWith('/**') ? chemin.startsWith(p.slice(0, -2)) : chemin === p))
}

describe('filtre de chemin du workflow Densité', () => {
  const pats = motifs()

  it('COUVERTURE — le workflow est bien LU', () => {
    // Angle mort n°1 : un regex qui ne matche rien rendrait toutes les assertions vides.
    expect(pats.length, 'aucun motif extrait du YAML').toBeGreaterThanOrEqual(4)
  })

  /**
   * ⚠️ Les points d'entrée sont DÉRIVÉS des specs, jamais recopiés : on lit les
   * `page.goto('/app/…')` et on remonte à la page qui sert cette route dans `App.tsx`.
   * Une liste écrite à la main ici serait fausse au premier écran ajouté — et muette.
   */
  const specs = ['e2e/dev/ecrans-density.spec.ts', 'e2e/dev/ecrans-tous.spec.ts', 'e2e/dev/table-density.spec.ts']
    .map(f => join(FRONT, f)).filter(existsSync)

  it('les specs de mesure existent et sont LUS', () => {
    expect(specs.length, 'aucun spec de densité trouvé — le verrou ne garde rien').toBe(3)
  })

  it('CHAQUE écran ouvert par les specs est servi par une page COUVERTE par le filtre', () => {
    const app = readFileSync(join(FRONT, 'src', 'App.tsx'), 'utf8')
    const routes = new Map<string, string>()
    for (const m of app.matchAll(/path="([^"]+)"[^>]*element=\{[^}]*?<(\w+)\s*\/?>/g)) routes.set(m[1], m[2])
    // `RoleRoute` enveloppe la page : on récupère le composant INTÉRIEUR.
    for (const m of app.matchAll(/path="([^"]+)"\s+element=\{<RoleRoute[^>]*>\s*<(\w+)\s*\/>/g)) routes.set(m[1], m[2])
    expect(routes.size, 'aucune route lue dans App.tsx — le scan ne garde rien').toBeGreaterThanOrEqual(10)

    const ouverts = new Set<string>()
    for (const f of specs) {
      const src = readFileSync(f, 'utf8')
      // Chemins LITTÉRAUX (`'/app/stock'`)…
      for (const m of src.matchAll(/ouvrirEcran\(page,\s*'\/app\/(\w+)'/g)) ouverts.add(m[1])
      // …ET la liste `ECRANS`, ouverte par GABARIT (`/app/${slug}`). ⚠️ Sans ce second
      // motif, le verrou ne voyait QUE 2 écrans sur 22 et se déclarait vert : il
      // affirmait couvrir « chaque écran ouvert par les specs » en n'en lisant que
      // ceux écrits en toutes lettres. Angle mort de FORME, dans le verrou lui-même.
      const bloc = /const ECRANS[^=]*=\s*\[([\s\S]*?)\n\]/.exec(src)?.[1] ?? ''
      for (const m of bloc.matchAll(/slug:\s*'([\w-]+)'/g)) ouverts.add(m[1])
    }
    expect(ouverts.size, 'moins de 20 écrans lus — le scan ne garde presque rien').toBeGreaterThanOrEqual(20)

    const nus: string[] = []
    for (const slug of ouverts) {
      const composant = routes.get(slug)
      expect(composant, `la route /app/${slug} n’existe pas dans App.tsx`).toBeTruthy()
      const chemin = `apps/frontend/src/pages/${composant}.tsx`
      if (!couvert(chemin, pats)) nus.push(chemin)
    }
    expect(nus, [
      'Ces écrans sont MESURÉS mais le filtre ne les déclenche pas :',
      ...nus, 'La mesure ne tournerait pas si on les modifiait.',
    ].join('\n')).toEqual([])
  })

  it('⚠️ la FEUILLE est couverte — elle n’est dans aucun graphe d’imports', () => {
    // Le fichier que les sabotages visent (`overflow-x` de `.table-wrap`, le `nowrap`
    // des cellules monétaires) et que toute dérivation par imports raterait.
    const feuille = 'apps/frontend/src/index.css'
    expect(fichiersAtteignables(join(FRONT, 'src'), join(FRONT, 'src/App.tsx'))
      .map(f => relative(RACINE, resolve(f))).includes(feuille),
      'le CSS ne devrait PAS être dans le graphe').toBe(false)
    expect(couvert(feuille, pats), 'la feuille doit être dans le filtre').toBe(true)
  })

  it('l’outillage de la mesure se déclenche lui-même', () => {
    for (const f of [
      'apps/frontend/e2e/dev/table-density.spec.ts',
      'apps/frontend/e2e/dev/ecrans-density.spec.ts',
      'apps/frontend/e2e/dev/ecrans.ts',
      'apps/frontend/playwright.density.config.ts',
      'apps/frontend/src/pages/DevTableHarness.tsx',
      'apps/frontend/src/pages/DevSurfacesHarness.tsx',
      '.github/workflows/density.yml',
    ]) expect(couvert(f, pats), `« ${f} » doit déclencher la mesure`).toBe(true)
  })

  it('le filtre ne ratisse pas TOUT le dépôt — c’est ce qui justifie le workflow séparé', () => {
    // Un filtre qui matche tout n'est pas un filtre : le fichier séparé n'aurait plus
    // d'objet. Dans ce monorepo, l'essentiel des commits touche ces chemins-là.
    for (const f of [
      'apps/backend/src/routes/sales.ts',
      'apps/backend/prisma/schema.prisma',
      'mobile/src/lib/api.ts',
      'apps/frontend/index.html',
      'apps/frontend/public/robots.txt',
      'CLAUDE.md',
      'docs/modules.md',
    ]) expect(couvert(f, pats), `« ${f} » ne doit PAS déclencher la mesure`).toBe(false)
  })
})
