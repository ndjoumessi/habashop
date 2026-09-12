import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * L'IMAGE BACKEND S'INSTALLE SANS LOCKFILE — et ce fichier garde l'épinglage qui la protège.
 *
 * ⚠️ L'INCIDENT, mesuré le 2026-09-12. Le contexte Docker est `apps/backend` seul, qui ne porte
 * AUCUN `package-lock.json` (le lockfile vit à la racine du monorepo). `RUN npm install` y
 * résout donc chaque plage À NEUF, contre le registre DU JOUR. Le 10 septembre, **vite 8.3.0**
 * a déclaré un peer optionnel `@vitejs/devtools ^0.7.1` → `@vitejs/devtools-vitest` → `vitest@*`
 * → 5.0.0, et npm 10.9.8 (celui de `node:22-slim`) plante sur cette boucle :
 * « Cannot read properties of null (reading 'edgesOut') ». Le déploiement de f2f2ad38 a échoué
 * à `npm install`, AVANT tout `tsc` — avec un `apps/backend/package.json` IDENTIQUE à celui du
 * dernier déploiement réussi (15 août). La CI unitaire, elle, restait verte : elle installe
 * depuis le lockfile racine, qui verrouille vite 8.0.16.
 *
 * Reproduit dans `node:22-slim`, puis corrigé par `overrides.vite` dans `apps/backend/package.json`
 * — build Docker RÉEL passé de bout en bout (install, prisma generate, tsc). ⚠️ Un premier
 * correctif supposé (épingler vitest à 4.1.10) a été TESTÉ et a ÉCHOUÉ : le coupable n'était
 * pas vitest mais vite, que vitest tire.
 *
 * ⚠️ `overrides` n'est honoré que dans le package.json RACINE d'une installation. Dans le
 * monorepo, `apps/backend` est un workspace : npm l'ignore (lockfile racine vérifié IDENTIQUE).
 * Dans l'image, `apps/backend` EST la racine : il s'applique. C'est exactement le périmètre voulu.
 *
 * CE QUE CE VERROU GARDE : l'épinglage de l'image doit valoir la version que les TESTS utilisent
 * (celle du lockfile racine). Sinon, le jour où le lockfile monte vite, l'image resterait sur une
 * version que plus personne ne teste — ou l'inverse, et la divergence serait silencieuse.
 *
 * DÉCLENCHEUR DE RETRAIT : un lockfile dans le contexte Docker (`npm ci`), ou un npm qui ne plante
 * plus sur la boucle de peers. Retirer alors l'override ET ce fichier, dans le même commit.
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const backendPkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  overrides?: Record<string, string>
}
const lock = JSON.parse(readFileSync(join(RACINE, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, { version?: string }>
}

/** Version de `nom` verrouillée à la racine — là où la CI et les tests locaux l'installent. */
function versionVerrouillee(nom: string): string | undefined {
  return lock.packages[`node_modules/${nom}`]?.version
}

describe('image backend — installation sans lockfile, épinglage gardé', () => {
  it('COUVERTURE — le lockfile racine est lu et verrouille bien vite', () => {
    // Sans ce cas, un lockfile illisible rendrait `undefined` des deux côtés… et `toBe` passerait.
    expect(Object.keys(lock.packages).length).toBeGreaterThan(100)
    expect(versionVerrouillee('vite')).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('overrides.vite existe, et vaut EXACTEMENT la version du lockfile racine', () => {
    const epingle = backendPkg.overrides?.vite
    expect(epingle, 'apps/backend/package.json doit épingler vite (image sans lockfile)').toBeDefined()
    // Une plage (`^8.0.16`) laisserait l'image reprendre 8.3.0 : on exige une version EXACTE.
    expect(epingle).toMatch(/^\d+\.\d+\.\d+$/)
    expect(epingle).toBe(versionVerrouillee('vite'))
  })
})
