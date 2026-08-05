import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * VERROU — pas d'annotation `any` EXPLICITE dans un callback de `.then()`/`.catch()`
 * posé sur un appel `*Api.*`.
 *
 * ⚠️ Le motif fermé ici s'est produit TROIS FOIS en trois lots de #185. On type la frontière
 * (`productsApi.list(): Promise<ApiProduct[]>`), et l'appelant écrit
 * `.then((rows: any[]) => …)` — une annotation explicite ÉCRASE le type inféré. La frontière
 * devient alors purement décorative : `tsc` reste vert, la suite reste verte, et le code
 * consomme de l'`any` exactement comme avant. Sites réels corrigés : `Planning.tsx`,
 * `HR.tsx` (×2).
 *
 * ⚠️ AST, pas regex. Une regex sur `any` rougirait sur `Company`, `anywhere`, une chaîne, un
 * commentaire, ou le mot dans une phrase française ; et elle raterait `any[]`,
 * `Array<any>`, `Record<string, any>`. On lit les nœuds de TYPE des paramètres, donc on juge
 * la structure, pas le texte.
 *
 * PORTÉE : uniquement les callbacks attachés à une chaîne qui PART d'un identifiant en
 * `…Api`. Un `.then()` sur autre chose (fetch nu, promesse maison) n'est pas concerné — le
 * verrou garde la frontière API, il ne légifère pas sur tout le dépôt.
 */

const SRC = join(__dirname, '..')

function walkFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full))
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

/** Vrai si le sous-arbre de type contient un `any` — couvre `any`, `any[]`, `Array<any>`, … */
function containsAny(node: ts.TypeNode | undefined): boolean {
  if (!node) return false
  let found = false
  const visit = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.AnyKeyword) found = true
    if (!found) ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/**
 * Remonte la chaîne d'appels jusqu'à l'identifiant racine.
 * `productsApi.list().then(x).catch(y)` → « productsApi » depuis le `.catch` comme le `.then`.
 */
function rootIdentifier(node: ts.Expression): string | null {
  let cur: ts.Node = node
  for (;;) {
    if (ts.isCallExpression(cur)) { cur = cur.expression; continue }
    if (ts.isPropertyAccessExpression(cur)) { cur = cur.expression; continue }
    if (ts.isNonNullExpression(cur) || ts.isParenthesizedExpression(cur)) { cur = cur.expression; continue }
    break
  }
  return ts.isIdentifier(cur) ? cur.text : null
}

type Hit = { file: string; line: number; text: string }
type Scan = { violations: Hit[]; callbacks: number }

/** Scanne UN fichier : rend les violations ET le nombre de callbacks examinés. */
export function scanSource(fileName: string, source: string): Scan {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const violations: Hit[] = []
  let callbacks = 0

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (method === 'then' || method === 'catch') {
        const root = rootIdentifier(node.expression.expression)
        if (root && /Api$/.test(root)) {
          for (const arg of node.arguments) {
            if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) continue
            callbacks++
            for (const param of arg.parameters) {
              if (containsAny(param.type)) {
                const { line } = sf.getLineAndCharacterOfPosition(param.getStart(sf))
                violations.push({ file: fileName, line: line + 1, text: param.getText(sf) })
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { violations, callbacks }
}

describe('frontière API — aucun `any` explicite dans un callback .then()/.catch()', () => {
  const files = walkFiles(SRC)
  const scans = files.map(f => ({ f, scan: scanSource(f, readFileSync(f, 'utf-8')) }))
  const callbacks = scans.reduce((n, s) => n + s.scan.callbacks, 0)

  it('le scan couvre des fichiers ET trouve des callbacks à examiner', () => {
    // ⚠️ ASSERTION DE COUVERTURE — la vraie garde de ce test. Un `walkFiles` cassé, un
    // `rootIdentifier` qui ne remonte plus la chaîne, ou un changement d'API TypeScript
    // rendraient ZÉRO callback : la règle suivante serait alors verte en ne regardant RIEN.
    // On exige donc de voir passer des callbacks réels avant de conclure quoi que ce soit.
    expect(files.length).toBeGreaterThan(200)
    expect(callbacks, 'aucun callback .then()/.catch() sur un *Api trouvé — le scanner est cassé')
      .toBeGreaterThan(20)
  })

  it('aucun callback de frontière API n\'annote ses paramètres en `any`', () => {
    const violations = scans.flatMap(s => s.scan.violations)
      .map(v => `${relative(SRC, v.file)}:${v.line} → (${v.text})`)
    expect(violations, `annotation \`any\` sur un callback d'API :\n  ${violations.join('\n  ')}`)
      .toEqual([])
  })

  // ── Contre-preuves : le détecteur doit détecter, et NE PAS sur-détecter ──
  it('détecte les formes réelles d\'`any`', () => {
    const cas = [
      'productsApi.list().then((rows: any[]) => rows)',            // le site réel de Planning.tsx
      'customersApi.list().then((d: any) => d)',
      'salesApi.list().then((r: Array<any>) => r)',
      'goalsApi.list().then((r: Record<string, any>) => r)',
      'productsApi.list().then(ok).catch((e: any) => e)',          // sur `.catch` aussi
      'productsApi.list().then(a).then((rows: any[]) => rows)',    // chaîne : racine remontée
    ]
    for (const src of cas) {
      expect(scanSource('t.ts', src).violations.length, `non détecté : ${src}`).toBe(1)
    }
  })

  it('ne rougit PAS sur ce qui est légitime', () => {
    // Un verrou qui crie au loup se fait désarmer : il doit laisser passer le code correct.
    const cas = [
      'productsApi.list().then((rows: ApiProduct[]) => rows)',     // annotation JUSTE
      'productsApi.list().then(rows => rows)',                     // inférence — le cas nominal
      'fetch(u).then((r: any) => r)',                              // pas une frontière *Api
      'const anyway = 1; const company: any = anyway',             // `any` hors callback d'API
      'productsApi.list().then(function (rows) { return rows })',
    ]
    for (const src of cas) {
      expect(scanSource('t.ts', src).violations.length, `faux positif : ${src}`).toBe(0)
    }
  })

  it('juge la STRUCTURE, pas le texte — là où une regex se tromperait', () => {
    // Ces trois sources contiennent le mot « any » sans qu'aucune annotation ne soit un `any`.
    const pieges = [
      'productsApi.list().then((rows: Company[]) => rows)',
      'productsApi.list().then(rows => { /* any comment mentioning any */ return rows })',
      'productsApi.list().then(rows => "anywhere any anyway")',
    ]
    for (const src of pieges) {
      expect(scanSource('t.ts', src).violations.length, `faux positif textuel : ${src}`).toBe(0)
    }
    // …et à l'inverse, une regex naïve sur « : any » raterait celle-ci, pas l'AST :
    expect(scanSource('t.ts', 'productsApi.list().then((rows:\n  any[]\n) => rows)').violations.length).toBe(1)
  })
})
