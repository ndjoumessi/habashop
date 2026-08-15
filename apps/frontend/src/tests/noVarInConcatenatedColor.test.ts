import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// ⚠️ PAS DE var(--…) DANS UN CHAMP CONCATÉNÉ AVEC UNE ALPHA — garde-fou, via AST (surtout PAS regex).
//
// Le bug (2026-08-01, trouvé à l'écran, invisible aux 765 tests + tsc) : `${k.hex}28` où `k.hex`
// vaut la CHAÎNE 'var(--p)'. La substitution rend `var(--p)28` — deux jetons, couleur INVALIDE.
// Comme la déclaration contient un var(), le navigateur la valide au parsing puis la déclare
// « invalid at computed-value time » : la propriété retombe à sa valeur INITIALE (border-style:none,
// background:transparent) et NE retombe PAS sur la règle de classe. D'où des cards KPI sans bord ni
// dégradé — sur Stock, RH, CustomersModals, ResendMonitor, APIDocs. On ne peut pas suffixer une
// alpha hexa (`28`, `1F`…) à un var() ; ces champs DOIVENT rester des #hex littéraux.
//
// ⚠️ POURQUOI UN AST — un grep confond « usage direct » (`color:k.color`, valide avec un var) et
// « concaténation » (`${k.color}28`, mort avec un var) : le même nom de champ, deux verdicts
// opposés selon le SITE d'usage. Seul un vrai parseur relie chaque `${obj.champ}NN` au tableau
// que `obj` parcourt (.map) et lit la valeur RÉELLE de `champ`. La revue manuelle avait raté
// APIDocs ; ce scan l'a trouvé. Un commentaire explique le piège — il n'échoue pas ; ce test si.
//
// ⚠️ COUVERTURE — on ASSERTE que le scan a vu des fichiers ET des sites de concaténation, sinon un
// dossier renommé rendrait un scan vide resté vert en ne vérifiant rien.
//
// ⚠️ LIMITE CONNUE (assumée) — ce guard ne suit QUE les champs d'objets littéraux parcourus par
// .map/.forEach/.flatMap — le motif où vivaient les 5 bugs (Stock, RH, CustomersModals,
// ResendMonitor, APIDocs). Une couleur concaténée depuis une variable simple, un paramètre de
// fonction, ou un objet importé d'un autre module passe AU TRAVERS. Les ~8 sites alimentés par un
// vrai #hex hors-.map sont corrects aujourd'hui mais NON gardés ; les fermer exigerait un suivi
// d'alias inter-fichiers (coût élevé, risque de faux positifs — et un guard qui crie au loup finit
// désactivé). Choix : couvrir sans bruit le motif réel plutôt que tout, mal. Le seul chemin qui
// casserait ces 8 sites est une re-tokenisation hex, déjà écartée.

const SRC = join(__dirname, '..')

function srcFiles(rel: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(p)
    }
  }
  walk(join(SRC, rel))
  return out
}

const unwrap = (e: ts.Expression): ts.Expression => {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) e = e.expression
  return e
}

function findArrayConst(sf: ts.SourceFile, name: string): ts.ArrayLiteralExpression | null {
  let found: ts.ArrayLiteralExpression | null = null
  const visit = (n: ts.Node) => {
    if (!found && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) {
      const init = unwrap(n.initializer)
      if (ts.isArrayLiteralExpression(init)) found = init
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

/** Le tableau que `objName` parcourt via .map/.forEach/.flatMap, résolu en littéraux d'objet — ou null. */
function resolveMapArray(node: ts.Node, objName: string, sf: ts.SourceFile): ts.ObjectLiteralExpression[] | null {
  let cur: ts.Node | undefined = node
  while (cur) {
    if ((ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) &&
        cur.parameters.some(p => ts.isIdentifier(p.name) && p.name.text === objName)) {
      const call = cur.parent
      if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) &&
          /^(map|forEach|flatMap)$/.test(call.expression.name.text)) {
        const arr = unwrap(call.expression.expression)
        if (ts.isArrayLiteralExpression(arr)) return arr.elements.filter(ts.isObjectLiteralExpression)
        if (ts.isIdentifier(arr)) {
          const decl = findArrayConst(sf, arr.text)
          return decl ? decl.elements.filter(ts.isObjectLiteralExpression) : null
        }
        return null
      }
    }
    cur = cur.parent
  }
  return null
}

/** `champ` d'un objet vaut-il une chaîne 'var(--…)' (y compris via une branche de ternaire) ? */
function fieldVarValue(obj: ts.ObjectLiteralExpression, field: string): string | null {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === field) {
      const branches = ts.isConditionalExpression(p.initializer)
        ? [p.initializer.whenTrue, p.initializer.whenFalse]
        : [p.initializer]
      for (const b of branches) if (ts.isStringLiteral(b) && /^var\(--/.test(b.text)) return b.text
    }
  }
  return null
}

/**
 * ⚠️ SECOND AXE — la VARIABLE LOCALE, ajoutée le 2026-08-15 après un défaut RÉEL.
 *
 * Le scanner ne connaissait que la forme `${objet.champ}NN`. Or `HREmployeeGrid` écrivait
 *   `const deptColor = DEPT_COLORS[emp.dept] ?? 'var(--p)'`   puis   `${deptColor}0D`
 * — tous les membres de `DEPT_COLORS` sont des `#hex`, c'est le REPLI qui était un `var()`.
 * Résultat : `var(--p)0D`, couleur invalide, fond ET bordure disparus dès qu'un employé n'a
 * pas de département. Invisible pour `tsc`, pour la suite, et pour la revue — vu à l'écran.
 *
 * On résout donc aussi l'IDENTIFIANT : on cherche sa déclaration dans le même fichier et on
 * regarde si une chaîne `var(--` s'y trouve, y compris dans un `??` ou un ternaire.
 */
function identifierVarValue(name: string, sf: ts.SourceFile): string | null {
  let trouve: string | null = null
  const chercheChaine = (n: ts.Node) => {
    if (trouve) return
    if (ts.isStringLiteral(n) && n.text.includes('var(--')) { trouve = n.text; return }
    ts.forEachChild(n, chercheChaine)
  }
  const visit = (n: ts.Node) => {
    if (trouve) return
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) {
      chercheChaine(n.initializer)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return trouve
}

function scan(file: string): { viol: string[]; sites: number } {
  const src = readFileSync(file, 'utf-8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const viol = new Set<string>()
  let sites = 0
  const visit = (n: ts.Node) => {
    if (ts.isTemplateExpression(n)) {
      for (const span of n.templateSpans) {
        // `${expr}NN` : le segment qui SUIT l'expression commence par 2 chiffres hexa = ajout d'alpha
        if (/^[0-9A-Fa-f]{2}/.test(span.literal.text)) {
          const expr = span.expression
          if (ts.isIdentifier(expr)) {
            sites++
            const v = identifierVarValue(expr.text, sf)
            if (v) {
              const { line } = sf.getLineAndCharacterOfPosition(expr.getStart(sf))
              viol.add(`${file.slice(file.indexOf('/src/') + 5)}:${line + 1} — ${expr.text} peut valoir '${v}'`)
            }
          }
          if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
            sites++
            const arr = resolveMapArray(expr, expr.expression.text, sf)
            if (arr) for (const obj of arr) {
              const v = fieldVarValue(obj, expr.name.text)
              if (v) {
                const { line } = sf.getLineAndCharacterOfPosition(obj.getStart(sf))
                viol.add(`${file.slice(file.indexOf('/src/') + 5)}:${line + 1} — ${expr.expression.text}.${expr.name.text} = '${v}'`)
              }
            }
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return { viol: [...viol], sites }
}

describe('CSS — aucun var(--) dans un champ couleur concaténé avec une alpha (AST TypeScript)', () => {
  const files = [...srcFiles('pages'), ...srcFiles('components')]
  const results = files.map(scan)
  const violations = [...new Set(results.flatMap(r => r.viol))]
  const sites = results.reduce((s, r) => s + r.sites, 0)

  it('couvre bien des fichiers et des sites de concaténation (garde anti-scan-vide)', () => {
    expect(files.length).toBeGreaterThan(150)
    expect(sites).toBeGreaterThan(60)
  })

  it('DISCRIMINANT — le second axe résout VRAIMENT un identifiant local', () => {
    // Sans ce cas, `identifierVarValue` pourrait rendre `null` partout et le verrou
    // resterait vert en ne gardant que la moitié qu'il gardait déjà.
    const faux = ts.createSourceFile('t.tsx',
      "const c = X[k] ?? 'var(--p)'\nconst s = `${c}0D`", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    expect(identifierVarValue('c', faux)).toBe('var(--p)')
    const bon = ts.createSourceFile('t.tsx',
      "const c = X[k] ?? '#8E96AA'\nconst s = `${c}0D`", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    expect(identifierVarValue('c', bon)).toBeNull()
  })

  it('aucun champ var(--) suffixé d’une alpha hexa (→ CSS invalide, propriété à sa valeur initiale)', () => {
    expect(
      violations,
      `Champs 'var(--…)' concaténés avec une alpha (rend invalide, border→none / fond→transparent).\n`
      + `Repasser en #hex littéral (PAS color-mix : compat WebView) :\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
