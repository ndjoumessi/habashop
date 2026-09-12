import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * L'IMAGE BACKEND INSTALLE L'ARBRE QUE LA CI TESTE — et ce fichier le garde.
 *
 * ⚠️ L'INCIDENT DU 2026-09-12. Le contexte Docker est `apps/backend` seul ; le lockfile vivait à la
 * racine du monorepo, HORS de l'image. `RUN npm install` résolvait donc chaque plage contre le
 * registre DU JOUR : vite 8.3.0 (publié le 10) a fait planter npm et bloqué le déploiement 2.22.53,
 * et l'image tournait avec twilio 6.1.1 / africastalking 0.8.3 quand la CI testait 6.0.2 / 0.8.0.
 *
 * LA PARADE : `apps/backend/package-lock.json`, DÉRIVÉ du lockfile racine par
 * `npm run lock:backend`, et `RUN npm ci` dans le Dockerfile. Build Docker réel vérifié : versions
 * de l'image = versions de la CI, les 53 entrées non installées sont TOUTES des binaires optionnels
 * d'autres plateformes.
 *
 * CE QUE CE VERROU GARDE, sans lancer npm (il tourne dans la suite unitaire, en CI, AVANT tout
 * déploiement) :
 *   1. le Dockerfile installe par `npm ci`, et copie bien le lockfile ;
 *   2. le lockfile correspond au `package.json` — sinon `npm ci` REFUSE de construire, et le
 *      déploiement échoue au lieu de dériver (c'est voulu, mais on préfère l'apprendre ici) ;
 *   3. CHAQUE `nom@version` de l'image existe dans le lockfile racine. C'est lui qui attrape la
 *      dérive la plus probable : quelqu'un monte une dépendance à la racine, oublie de régénérer —
 *      l'ancienne version disparaît de la racine, ce cas rougit, le message dit quoi lancer ;
 *   4. les overrides de SÉCURITÉ de la racine sont recopiés : `overrides` n'est honoré qu'à la
 *      racine d'une installation, et dans l'image c'est `apps/backend`. `africastalking` épingle
 *      `axios@1.15.0` (CVE high, #135) et `joi@18.1.2` (CVE moderate, #136).
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const BACKEND = join(__dirname, '..', '..')
const lireJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'))

type Entree = { version?: string; integrity?: string; link?: boolean }
type Lock = { packages: Record<string, Entree & Record<string, unknown>> }

const pkgRacine = lireJson(join(RACINE, 'package.json')) as { overrides?: Record<string, unknown> }
const pkgBackend = lireJson(join(BACKEND, 'package.json')) as Record<string, unknown> & { overrides?: Record<string, unknown> }
const lockRacine = lireJson(join(RACINE, 'package-lock.json')) as Lock
const lockBackend = lireJson(join(BACKEND, 'package-lock.json')) as Lock
const REGENERER = 'régénérer : `npm run lock:backend` (à la racine du dépôt)'

/** Nom du paquet d'un chemin de lockfile — le dernier segment `node_modules/<nom>` (gère les @scopes). */
function nomDe(chemin: string): string {
  const i = chemin.lastIndexOf('node_modules/')
  const s = (i < 0 ? chemin : chemin.slice(i + 'node_modules/'.length)).split('/')
  return s[0].startsWith('@') ? `${s[0]}/${s[1]}` : s[0]
}

/** `nom@version` absents de `reference` — ce que l'image installerait sans que la CI l'ait testé. */
function inedits(image: Lock, reference: Lock): string[] {
  const connus = new Set<string>()
  for (const [k, v] of Object.entries(reference.packages)) {
    if (k.includes('node_modules/') && v.version) connus.add(`${nomDe(k)}@${v.version}`)
  }
  return Object.entries(image.packages)
    .filter(([k, v]) => k !== '' && !v.link && !connus.has(`${nomDe(k)}@${v.version}`))
    .map(([k, v]) => `${k} → ${nomDe(k)}@${v.version}`)
}

describe('image backend — `npm ci` depuis un lockfile dérivé de la racine', () => {
  it('COUVERTURE — les deux lockfiles sont lus et portent un arbre réel', () => {
    // Un lockfile vide rendrait « 0 inédit » et se lirait comme une victoire.
    expect(Object.keys(lockRacine.packages).length).toBeGreaterThan(500)
    expect(Object.keys(lockBackend.packages).length).toBeGreaterThan(300)
    expect(lockBackend.packages['node_modules/fastify']?.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('1. le Dockerfile installe par `npm ci`, jamais `npm install`, et copie le lockfile', () => {
    // ⚠️ Lecture de SOURCE, assumée : aucun test unitaire ne peut exécuter un Dockerfile. Le build
    // réel a été vérifié à la main ; ce cas empêche seulement le RETOUR silencieux d'`npm install`.
    const nu = readFileSync(join(BACKEND, 'Dockerfile'), 'utf8').replace(/^\s*#.*$/gm, '')
    expect(nu).toMatch(/^RUN npm ci\b/m)
    expect(nu).not.toMatch(/^RUN npm install\b/m)
    expect(nu).toMatch(/^COPY package\*\.json \.\/$/m) // le glob copie package-lock.json
  })

  it('2. le lockfile correspond au package.json — sinon `npm ci` refuse de construire', () => {
    const racineLock = lockBackend.packages['']
    for (const champ of ['dependencies', 'devDependencies', 'optionalDependencies'] as const) {
      expect({ champ, lock: racineLock[champ] ?? {} }, REGENERER).toEqual({ champ, lock: pkgBackend[champ] ?? {} })
    }
  })

  it('3. CHAQUE paquet de l’image existe, à la même version, dans le lockfile racine (arbre testé)', () => {
    expect(inedits(lockBackend, lockRacine), REGENERER).toEqual([])
  })

  it('3 bis. les dépendances DIRECTES ont la version de la racine (celle que la CI installe)', () => {
    const P = lockRacine.packages
    const ecarts: string[] = []
    for (const champ of ['dependencies', 'devDependencies'] as const) {
      for (const nom of Object.keys((pkgBackend[champ] ?? {}) as Record<string, string>)) {
        const racine = (P[`apps/backend/node_modules/${nom}`] ?? P[`node_modules/${nom}`])?.version
        const image = lockBackend.packages[`node_modules/${nom}`]?.version
        if (racine !== image) ecarts.push(`${nom} : racine ${racine} · image ${image}`)
      }
    }
    expect(ecarts, REGENERER).toEqual([])
  })

  it('4. ⚠️ les overrides de SÉCURITÉ de la racine sont dans le package.json du backend', () => {
    const racine = pkgRacine.overrides ?? {}
    expect(Object.keys(racine).length).toBeGreaterThan(0) // sinon ce cas ne garde rien
    for (const [nom, spec] of Object.entries(racine)) {
      expect({ nom, backend: pkgBackend.overrides?.[nom] }).toEqual({ nom, backend: spec })
    }
  })

  it('4 bis. aucune version VULNÉRABLE épinglée par africastalking n’entre dans l’image', () => {
    const versions = (nom: string) => Object.entries(lockBackend.packages)
      .filter(([k]) => k !== '' && nomDe(k) === nom).map(([, v]) => v.version)
    expect(versions('axios')).not.toContain('1.15.0')
    expect(versions('joi')).not.toContain('18.1.2')
    expect(versions('axios').length).toBeGreaterThan(0) // le paquet est bien là : le cas n'est pas vacant
  })

  it('DISCRIMINANT — le détecteur attrape une version inédite, et accepte un simple déplacement', () => {
    const ref: Lock = { packages: { '': {}, 'node_modules/picomatch': { version: '2.3.2' } } }
    // Déplacement (vécu : picomatch 2.3.2 relogé sous anymatch dans l'image) → accepté.
    expect(inedits({ packages: { '': {}, 'node_modules/anymatch/node_modules/picomatch': { version: '2.3.2' } } }, ref)).toEqual([])
    // Version jamais testée → refusée, et nommée.
    expect(inedits({ packages: { '': {}, 'node_modules/picomatch': { version: '2.3.3' } } }, ref))
      .toEqual(['node_modules/picomatch → picomatch@2.3.3'])
    expect(nomDe('node_modules/@prisma/client')).toBe('@prisma/client')
    expect(nomDe('node_modules/a/node_modules/@s/b')).toBe('@s/b')
  })
})
