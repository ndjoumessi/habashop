import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// ⚠️ NOM ACCESSIBLE DES BOUTONS ICÔNE-SEULE — garde-fou, via AST (surtout PAS regex).
//
// Un <button> qui ne contient QU'UNE icône (aucun texte, aucune expression) est, pour un
// lecteur d'écran, un contrôle SANS NOM (WCAG 4.1.2).
//
// ⚠️ POURQUOI UN AST — leçon chère du 2026-07-31 : trois détecteurs texte-based ont rendu
// TROIS réponses différentes sur le même code (1, 2, 5 violations), ne se recoupant que sur un
// seul bouton. Le piège : `<button onClick={() => …}>` — le `>` de la flèche `=>` vit DANS la
// balise ouvrante ; un `/<button.*?>/` s'y arrête et mal-découpe ~75 % des boutons, ratant
// jusqu'à 4 vrais boutons muets. Seul un VRAI parseur (le compilateur TypeScript) tranche
// juste. Les 5 violations qu'il trouve ont toutes été lues à la main avant correction.
//
// ⚠️ COROLLAIRE (couverture) — un « vert qui garde le vide » est pire qu'aucun garde : on
// ASSERTE donc que le scan a bien vu des fichiers ET des boutons. Un dossier renommé rendrait
// un scan vide, et sans cette assertion le test resterait vert en ne vérifiant rien.

const SRC = join(__dirname, '..')

function tsxFiles(rel: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.tsx')) out.push(p)
    }
  }
  walk(join(SRC, rel))
  return out
}

/** Icône = élément JSX au nom Capitalisé portant une prop `size` (motif lucide). */
function isIcon(el: ts.JsxElement | ts.JsxSelfClosingElement): boolean {
  const open = ts.isJsxElement(el) ? el.openingElement : el
  if (!/^[A-Z]/.test(open.tagName.getText())) return false
  return open.attributes.properties.some(p => p.name?.getText() === 'size')
}

function scan(file: string): { viol: string[]; buttons: number } {
  const src = readFileSync(file, 'utf-8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const viol: string[] = []
  let buttons = 0
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'button') {
      buttons++
      const attrs = n.openingElement.attributes.properties.map(p => p.name?.getText())
      const hasName = attrs.includes('aria-label') || attrs.includes('title')
      let hasIcon = false
      let hasContent = false
      for (const c of n.children) {
        if (ts.isJsxText(c) && c.text.trim()) hasContent = true
        else if (ts.isJsxExpression(c) && c.expression) hasContent = true
        else if (ts.isJsxSelfClosingElement(c) || ts.isJsxElement(c)) isIcon(c) ? (hasIcon = true) : (hasContent = true)
      }
      if (hasIcon && !hasName && !hasContent) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf))
        viol.push(`${file.slice(file.indexOf('/src/') + 5)}:${line + 1}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return { viol, buttons }
}

describe('accessibilité — tout bouton icône-seule a un nom (AST TypeScript)', () => {
  const files = [...tsxFiles('pages'), ...tsxFiles('components')]
  const results = files.map(scan)
  const violations = results.flatMap(r => r.viol)
  const buttons = results.reduce((s, r) => s + r.buttons, 0)

  it('couvre bien des fichiers et des boutons (garde anti-scan-vide)', () => {
    expect(files.length).toBeGreaterThan(150)
    expect(buttons).toBeGreaterThan(400)
  })

  it('aucun <button> icône-seule sans aria-label/title', () => {
    expect(
      violations,
      `Boutons icône-seule sans nom accessible (WCAG 4.1.2) — ajouter un aria-label :\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
