import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

/**
 * VERROU — l'outil de sabotage fait ce qu'il promet.
 *
 * ─── POURQUOI CET OUTIL, ET POURQUOI CE TEST ─────────────────────────────────
 * Restaurer un fichier par `git checkout` repart de HEAD : pendant la vérification d'un
 * verrou, le correctif n'est PAS commité — il est donc effacé. Le piège est écrit deux fois
 * dans `CLAUDE.md` et il a été commis **trois fois dans la même session par l'auteur de ces
 * deux avertissements**. Écrire la règle une quatrième fois n'y changerait rien : c'est
 * l'outil qu'on corrige, pas la consigne.
 *
 * Un script qu'on n'exerce pas est une consigne de plus, simplement écrite en JavaScript.
 * D'où ce fichier — il exécute le VRAI script, sur de VRAIS fichiers, et compare les octets.
 *
 * ⚠️ `SABOTAGE_DIR` isole chaque cas dans son propre dossier : sans lui, un test toucherait
 * l'instantané d'un sabotage réellement en cours sur la machine du développeur.
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const SCRIPT = join(RACINE, 'scripts', 'sabotage.mjs')

let dossierInstantane: string
let cible: string
let relCible: string

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

/** Lance le script et rend `{ code, sortie }` — jamais d'exception, on veut juger le code. */
function lancer(...args: string[]): { code: number; sortie: string } {
  try {
    const sortie = execFileSync('node', [SCRIPT, ...args], {
      cwd: RACINE,
      env: { ...process.env, SABOTAGE_DIR: dossierInstantane },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, sortie }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

beforeEach(() => {
  dossierInstantane = mkdtempSync(join(tmpdir(), 'sab-test-'))
  // Fichier jetable DANS le dépôt (le script refuse tout ce qui est dehors), nettoyé après.
  const bac = join(RACINE, 'apps', 'frontend', 'src', '__sabotage-bac')
  mkdirSync(bac, { recursive: true })
  cible = join(bac, 'cible.txt')
  relCible = 'apps/frontend/src/__sabotage-bac/cible.txt'
  writeFileSync(cible, 'CORRECTIF NON COMMITÉ\nligne 2\naccentué : é à ü\n')
})

afterEach(() => {
  rmSync(dossierInstantane, { recursive: true, force: true })
  rmSync(join(RACINE, 'apps', 'frontend', 'src', '__sabotage-bac'), { recursive: true, force: true })
})

describe('outil de sabotage', () => {
  it('COUVERTURE — le script existe et s’exécute', () => {
    expect(existsSync(SCRIPT)).toBe(true)
    expect(lancer('status').sortie).toContain('Aucun sabotage')
  })

  it('instantané → sabotage → restauration rend le fichier OCTET POUR OCTET', () => {
    const avant = sha(cible)
    const original = readFileSync(cible)

    expect(lancer(relCible).code).toBe(0)

    // On casse, franchement : contenu différent ET longueur différente.
    writeFileSync(cible, 'SABOTÉ\n')
    expect(sha(cible)).not.toBe(avant)

    const r = lancer('restore')
    expect(r.code).toBe(0)
    expect(sha(cible), 'le fichier restauré n’est pas identique à l’instantané').toBe(avant)
    expect(readFileSync(cible).equals(original), 'octets différents').toBe(true)
  })

  it('la restauration DIT ce qu’elle a vérifié — une restauration muette n’est pas prouvée', () => {
    lancer(relCible)
    writeFileSync(cible, 'SABOTÉ\n')
    const r = lancer('restore')
    expect(r.sortie).toContain(relCible)
    expect(r.sortie).toMatch(/identique à l['’]instantané/)
  })

  it('⚠️ un SECOND instantané est REFUSÉ, jamais écrasé', () => {
    // Le cas qui compte : un sabotage interrompu, puis un second pris par-dessus. Écraser
    // ferait perdre la seule copie du premier — en silence.
    expect(lancer(relCible).code).toBe(0)
    writeFileSync(cible, 'TRAVAIL PLUS RÉCENT, non instantané\n')
    const attendu = sha(cible)

    const r = lancer(relCible)
    expect(r.code, 'un second instantané doit ÉCHOUER').not.toBe(0)
    expect(r.sortie).toMatch(/DÉJÀ en cours/)

    // …et il n'a rien touché : le fichier de travail est intact.
    expect(sha(cible)).toBe(attendu)
    // …et l'instantané d'origine tient toujours : la restauration rend bien le PREMIER état.
    expect(lancer('restore').code).toBe(0)
    expect(readFileSync(cible, 'utf8')).toContain('CORRECTIF NON COMMITÉ')
  })

  it('`status` rend un code NON NUL et nomme le fichier encore sabotté', () => {
    // Un instantané oublié est un piège de plus : il doit être visible, y compris d'un script.
    lancer(relCible)
    writeFileSync(cible, 'SABOTÉ\n')
    const s = lancer('status')
    expect(s.code, 'un sabotage en cours n’est pas un état normal').not.toBe(0)
    expect(s.sortie).toContain(relCible)
    expect(s.sortie).toMatch(/MODIFIÉ|sabotage encore en place/)
    lancer('restore')
  })

  it('restaurer SANS instantané échoue — et ne suggère surtout pas `git checkout`', () => {
    const r = lancer('restore')
    expect(r.code).not.toBe(0)
    expect(r.sortie).toMatch(/Aucun sabotage/)
    // ⚠️ Le message doit mettre en garde contre le réflexe qui a coûté trois correctifs.
    expect(r.sortie).toContain('git checkout')
    expect(r.sortie).toMatch(/SURTOUT PAS/)
  })

  it('l’instantané vit HORS de l’arbre de travail — incommitable par construction', () => {
    lancer(relCible)
    // Rien n'a été créé dans le dépôt : c'est ce qui le rend invisible à `git status`,
    // donc impossible à commiter par mégarde et impossible à écraser par un `git checkout`.
    const dansLeDepot = join(RACINE, '.sabotage')
    expect(existsSync(dansLeDepot)).toBe(false)
    expect(existsSync(join(dossierInstantane, 'manifeste.json'))).toBe(true)
    expect(dossierInstantane.startsWith(RACINE)).toBe(false)
    lancer('restore')
  })

  it('un fichier HORS du dépôt est refusé', () => {
    const dehors = join(tmpdir(), 'sab-dehors.txt')
    writeFileSync(dehors, 'x')
    const r = lancer(dehors)
    expect(r.code).not.toBe(0)
    expect(r.sortie).toMatch(/Hors du dépôt/)
    rmSync(dehors, { force: true })
  })
})
