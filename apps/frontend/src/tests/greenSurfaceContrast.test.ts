import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * SURFACES VERTES — le texte posé dessus doit passer WCAG AA (4,5:1).
 *
 * ── Ce qui a été mesuré le 2026-08-15 ────────────────────────────────────────────────
 * CINQ boutons portaient du texte BLANC sur un fond vert, tous en échec :
 *   · BulletinModal « Marquer payé »          #22C77A→#17A866  2,21 → 3,07:1
 *   · AdminDashboard « Approuver »            #22C77A→#00875A  2,21 → 4,55:1
 *   · OrderDetailModal « Confirmer réception » #22C77A→#059669  2,21 → 3,77:1
 *   · PublicCatalog « Commander »             #25D366→#128C7E  1,98 → 4,14:1
 *   · Marketing « Envoyer la diffusion »      #25D366→#128C7E  1,98 → 4,14:1
 * Le seuil est bien 4,5:1 : le 3:1 « grand texte » exige ≥18,66px GRAS ou ≥24px, et le
 * plus gros de ces libellés fait 14px.
 *
 * ⚠️ LE VERT DE PREMIER PLAN N'EST PAS EN CAUSE. `--acc2` (#22C77A) reste INCHANGÉ : en
 * texte sur une carte il mesure 6,83:1. Ce qui manquait était un vert de SURFACE. Les
 * assombrir tous les deux aurait cassé une soixantaine d'indicateurs corrects.
 *
 * ⚠️ CE VERROU JUGE LE CONTRASTE, PAS LA PRÉSENCE D'UN NOM DE COULEUR. Interdire
 * « fond vert + texte blanc » crierait au loup sur un vert légitimement sombre — et un
 * garde qui crie au loup se fait désarmer. On résout les tokens, on calcule, on compare.
 *
 * ⚠️ MÉTHODE — mon premier comptage a rendu QUATRE au lieu de cinq. Le motif cherchait le
 * guillemet juste après `color:` et ne voyait pas
 * `color: a || b ? 'var(--text3)' : '#fff'`, où le blanc est au bout d'un ternaire.
 * Un scanneur qui présume de la FORME d'une déclaration en rate une sur cinq. Ici le blanc
 * est cherché n'importe où dans l'objet de style.
 */

const SRC = join(__dirname, '..')
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// ── Contraste WCAG ────────────────────────────────────────────────────────────────────
const hex = (h: string) => { const m = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)) }
const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a: number[], b: number[]) => {
  const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

/** Valeur d'un token, LUE dans la feuille — jamais recopiée ici. */
function token(nom: string): string {
  const m = CSS.match(new RegExp(`--${nom}\\s*:\\s*([^;]+);`))
  if (!m) throw new Error(`token --${nom} introuvable`)
  return m[1].trim()
}
/** Tous les #hex d'une valeur (un dégradé en porte plusieurs — on juge chaque extrémité). */
const hexesDe = (v: string) => [...v.matchAll(/#[0-9A-Fa-f]{6}/g)].map(m => m[0])

describe('contraste WCAG — le calcul lui-même', () => {
  it('CONTRÔLE POSITIF ET NÉGATIF — sans quoi tout ce qui suit est décoratif', () => {
    expect(Math.round(ratio(hex('#000000'), hex('#FFFFFF')))).toBe(21)
    expect(Math.round(ratio(hex('#FFFFFF'), hex('#FFFFFF')))).toBe(1)
    // et il doit SAVOIR REFUSER : l'ancien vert de surface contre du blanc
    expect(ratio(hex('#FFFFFF'), hex('#22C77A'))).toBeLessThan(4.5)
  })
})

describe('les surfaces vertes à texte blanc passent AA', () => {
  it('`--grad-success` : le blanc passe sur TOUTE la longueur du dégradé', () => {
    // ⚠️ « à une extrémité » ne suffit pas — c'est ce qui rendait l'ancien acceptable en
    // apparence (4,55:1 tout au bout) alors qu'il échouait sur 4/5 de sa surface.
    const bornes = hexesDe(token('grad-success'))
    expect(bornes.length).toBeGreaterThanOrEqual(2)
    for (const c of bornes) {
      expect({ c, ok: ratio(hex('#FFFFFF'), hex(c)) >= 4.5 }).toEqual({ c, ok: true })
    }
  })

  it('`--brand-whatsapp-ink` passe sur la couleur de marque', () => {
    expect(ratio(hex(token('brand-whatsapp-ink')), hex(token('brand-whatsapp')))).toBeGreaterThanOrEqual(4.5)
  })

  it('⚠️ `--acc2` n’a PAS été assombri — c’est un vert de PREMIER PLAN', () => {
    // DISCRIMINANT : « corriger » --acc2 aurait fait passer les tests ci-dessus tout en
    // cassant les pastilles, points d'état et textes verts, tous corrects aujourd'hui.
    expect(token('acc2')).toBe('#22C77A')
    // et il reste lisible là où il sert VRAIMENT : en texte sur une carte
    expect(ratio(hex('#22C77A'), hex('#121724'))).toBeGreaterThanOrEqual(4.5)
  })
})

// ── Règle de FORME sur tout src/ ──────────────────────────────────────────────────────
function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersTsx(p, acc) }
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/** Objets `style={{…}}` par appariement d'accolades — une regex ligne à ligne rate tout
 *  objet multi-ligne, et c'est la forme majoritaire ici. */
function* objetsStyle(txt: string): Generator<[number, string]> {
  for (const m of txt.matchAll(/style=\{\{/g)) {
    let d = 0
    const i = m.index! + m[0].length - 2
    for (let k = i; k < txt.length; k++) {
      if (txt[k] === '{') d++
      else if (txt[k] === '}') { d--; if (d === 0) { yield [m.index!, txt.slice(i, k + 1)]; break } }
    }
  }
}

describe('aucun nouveau texte clair sur une surface verte trop claire', () => {
  const FICHIERS = fichiersTsx(SRC)

  it('COUVERTURE — le balayage lit src/ et trouve des objets de style', () => {
    expect(FICHIERS.length).toBeGreaterThan(150)
    const objets = FICHIERS.reduce((n, f) => n + [...objetsStyle(readFileSync(f, 'utf8'))].length, 0)
    expect(objets).toBeGreaterThan(500)
  })

  it('CONTRÔLE POSITIF — l’extracteur gère un objet multi-ligne imbriqué', () => {
    const ex = [...objetsStyle('<i style={{ a: 1,\n b: { c: 2 },\n d: 3 }} />')]
    expect(ex).toHaveLength(1)
    expect(ex[0][1]).toContain('d: 3')
  })

  it('⚠️ AUCUNE RÈGLE CSS ne pose du blanc sur un vert trop clair', () => {
    // ⚠️ Le cas suivant ne balaie que les objets `style={{…}}`. Il EMPÊCHAIT l'ajout sans
    // PROUVER l'absence : une règle de la feuille pouvait porter le même défaut sans qu'il
    // la voie. Inventaire fait le 2026-08-15 — 0 règle — et gardé ici.
    const nuCss = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const fautives: string[] = []
    for (const r of nuCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = r[1], corps = r[2]
      if (!/color\s*:\s*(#fff(fff)?|white)\b/i.test(corps)) continue
      for (const f of corps.matchAll(/(?:background|background-color|background-image)\s*:([^;]*)/gi)) {
        const couleurs = [...f[1].matchAll(/#[0-9A-Fa-f]{6}/g)].map(m => m[0])
        for (const v of f[1].matchAll(/var\(--([\w-]+)\)/g)) {
          try { couleurs.push(...hexesDe(token(v[1]))) } catch { /* hors feuille */ }
        }
        for (const c of couleurs) {
          const [rr, gg, bb] = hex(c)
          if (gg > rr && gg > bb && gg > 90 && ratio(hex('#FFFFFF'), hex(c)) < 4.5) {
            fautives.push(`${sel.trim().slice(0, 40)} → ${c}`)
          }
        }
      }
    }
    expect([...new Set(fautives)]).toEqual([])
  })
  it('chaque paire « fond vert + texte clair » atteint 4,5:1', () => {
    const FOND = /(?:background|backgroundColor|backgroundImage)\s*:/g
    // ⚠️ Le blanc est cherché PARTOUT dans l'objet, ternaire compris : c'est la forme qui
    // m'avait fait compter 4 boutons au lieu de 5.
    const CLAIR = /['"](#fff(?:fff)?|white)['"]/i
    const fautifs: string[] = []
    for (const f of FICHIERS) {
      const txt = readFileSync(f, 'utf8')
      for (const [pos, obj] of objetsStyle(txt)) {
        if (!CLAIR.test(obj)) continue
        // On résout les couleurs de fond : littéraux + tokens de la feuille.
        const fonds: string[] = []
        for (const m of obj.matchAll(FOND)) {
          const fen = obj.slice(m.index! + m[0].length, m.index! + m[0].length + 160)
          // ⚠️ `color-mix(… N%, transparent)` est une TEINTE translucide, pas une surface :
          // le contraste réel dépend du fond qu'elle laisse voir, qu'un scan statique ne
          // connaît pas. La juger comme un aplat crie au loup — mesuré sur Onboarding, où
          // les branches sont APPARIÉES (violet+blanc d'un côté, teinte verte+texte vert de
          // l'autre) et où le blanc ne touche jamais le vert. LIMITE ASSUMÉE : une teinte
          // verte portant du texte blanc passerait au travers ; ces surfaces-là portent du
          // texte vert dans tout le dépôt, et elles sont mesurées AA (6,83:1 sur carte).
          if (/color-mix/i.test(fen)) continue
          fonds.push(...hexesDe(fen))
          for (const t of fen.matchAll(/var\(--([\w-]+)\)/g)) {
            try { fonds.push(...hexesDe(token(t[1]))) } catch { /* token hors feuille */ }
          }
        }
        for (const c of fonds) {
          const r = ratio(hex('#FFFFFF'), hex(c))
          // Vert : composante verte dominante. On ne juge QUE les verts — le violet, le
          // rouge et le bleu ont leurs propres règles et ne sont pas le sujet de ce lot.
          const [rr, gg, bb] = hex(c)
          const estVert = gg > rr && gg > bb && gg > 90
          if (estVert && r < 4.5) {
            fautifs.push(`${f.replace(SRC, 'src')}:${txt.slice(0, pos).split('\n').length} — ${c} → ${r.toFixed(2)}:1`)
          }
        }
      }
    }
    expect([...new Set(fautifs)]).toEqual([])
  })
})
