import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'

/**
 * MÉTA-TEST — aucun import STATIQUE ne doit sortir de `apps/backend`.
 *
 * ⚠️ Le contexte Docker du backend est `apps/backend` SEUL : le `Dockerfile` fait `COPY src`,
 * `COPY scripts`, `COPY prisma`, `COPY package*.json`, `COPY tsconfig.json` — et rien d'autre.
 * L'image lance ensuite `npm run build`, donc `tsc` sur TOUT `src/`, fichiers de test compris.
 * Un `import x from '../../../../docs/…'` compile parfaitement en local, où le monorepo entier
 * est là, puis fait ÉCHOUER LE DÉPLOIEMENT avec un TS2307 que ni `tsc` local, ni la suite, ni
 * la revue de code ne peuvent voir : la source est valide, c'est le CONTEXTE qui diffère.
 *
 * C'est arrivé le 2026-08-05 (`salesWindow.test.ts`, déploiement Railway rouge). Les sept
 * autres jumeaux du dépôt lisaient déjà leur fixture par `readFileSync` — la convention
 * existait, elle n'était écrite nulle part et rien ne la faisait respecter.
 *
 * Un chemin lu à l'EXÉCUTION (`readFileSync(join(__dirname, '..', …))`) n'est pas résolu par
 * tsc : le build passe, et le test ne s'exécute jamais dans l'image de production.
 */

const BACKEND_ROOT = resolve(__dirname, '..', '..')
const SRC = join(BACKEND_ROOT, 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** Retire commentaires de bloc et de ligne — sinon un exemple en commentaire ferait rougir. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Spécificateurs d'un `import … from '…'`, `export … from '…'` ou `import('…')`. */
function staticSpecifiers(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) out.push(m[1])
  return out
}

/** Un spécificateur relatif qui, résolu, sort de `apps/backend`. */
function escapesContext(file: string, spec: string): boolean {
  if (!spec.startsWith('.')) return false // paquet npm → présent dans l'image via npm install
  const target = resolve(dirname(file), spec)
  const rel = relative(BACKEND_ROOT, target)
  return rel.startsWith('..')
}

describe('contexte Docker — aucun import statique hors de apps/backend', () => {
  const files = walk(SRC)

  it('le scan couvre bien des fichiers', () => {
    // ⚠️ Un `walk()` cassé rend une liste vide, donc un test vert qui ne garde RIEN.
    expect(files.length).toBeGreaterThan(150)
    expect(files.some(f => f.endsWith('server.ts'))).toBe(true)
    expect(files.some(f => f.includes(join('src', 'tests')))).toBe(true)
  })

  it('aucun fichier n\'importe hors du contexte de build', () => {
    const violations: string[] = []
    for (const file of files) {
      for (const spec of staticSpecifiers(readFileSync(file, 'utf-8'))) {
        if (escapesContext(file, spec)) {
          violations.push(`${relative(BACKEND_ROOT, file)} → ${spec}`)
        }
      }
    }
    expect(violations, `import(s) hors contexte Docker :\n  ${violations.join('\n  ')}`).toEqual([])
  })

  it('le détecteur repère RÉELLEMENT une violation (contre-preuve)', () => {
    // Sans ceci, la règle précédente pourrait être verte parce qu'elle ne détecte rien.
    const fake = join(SRC, 'tests', 'faux.test.ts')
    expect(escapesContext(fake, '../../../../docs/shared-fixtures/x.json')).toBe(true)
    expect(escapesContext(fake, '../utils/salesWindow')).toBe(false)
    expect(escapesContext(fake, 'vitest')).toBe(false)
    expect(escapesContext(fake, 'node:fs')).toBe(false)

    // ⚠️ Spécificateur ASSEMBLÉ : écrit en toutes lettres, ce fichier se dénoncerait lui-même
    // (constaté — la règle ci-dessus l'a épinglé au premier tir). Le verrou se scanne aussi.
    const q = String.fromCharCode(39)
    const escaping = '../../../../docs/shared-fixtures/x.json'
    expect(staticSpecifiers(`import cases from ${q}${escaping}${q}`)).toContain(escaping)
  })

  it('un import en COMMENTAIRE ne fait pas rougir', () => {
    // Ce fichier-ci en contient un dans son en-tête : sans le strip, il s'auto-dénoncerait.
    const commented = `// import x from '../../../../docs/a.json'\n/* import y from '../../../../docs/b.json' */\n`
    expect(staticSpecifiers(commented)).toEqual([])
  })
})
