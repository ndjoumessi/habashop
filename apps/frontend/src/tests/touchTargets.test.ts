import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * LOT 1 — CIBLES TACTILES ET PLANCHER TYPOGRAPHIQUE (audit UI/UX du 2026-08-14).
 *
 * Deux règles, un seul fichier, parce qu'elles ont la même CAUSE : une décision d'ergonomie
 * écrite quelque part (« touch target ≥44px » en commentaire ; « plancher 11px » dans
 * l'échelle typo) et appliquée à une PARTIE seulement des points d'appel.
 *
 * ── Ce qui a été MESURÉ avant d'écrire ce verrou ──
 * Cibles : .btn-icon / .icon-btn / .footer-btn faisaient déjà 44×44 et portaient le
 * commentaire. .btn (36), .btn-primary (38), .btn-ghost/.mini-btn (~35) et .btn-sm (30)
 * ne l'avaient jamais reçu — 220+ points d'appel contre 7 pour les icônes.
 * Typo : l'échelle déclare « plancher 11px (fini 8/9/10px — a11y lisibilité) » et 55 sites
 * inline étaient à 9 / 9.5 / 10 / 10.5, sur des écrans vivants (POS, Stock, Marketing,
 * SelectShop, PublicCatalog, Login, Signup).
 *
 * ⚠️ 44 vient d'iOS HIG / Android 48dp, PAS de WCAG — le critère AA 2.5.8 se contente de
 * 24px et les anciennes valeurs le passaient. Ne pas justifier ce verrou par « conformité
 * WCAG » : c'est une décision d'ergonomie pour un marché Android bas de gamme, et une
 * justification fausse se fait désarmer à la première revue qui la vérifie.
 *
 * ⚠️ La géométrie est LUE dans index.css, jamais recopiée ici — un miroir se périme en
 * silence (leçon de navLabelWidth.test.ts). jsdom ne fait AUCUNE mise en page : ce verrou
 * juge des VALEURS DÉCLARÉES, pas des pixels rendus. La géométrie réelle se mesure avec
 * `npm run e2e:density`, seul juge du rendu.
 */

const SRC = join(__dirname, '..')
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')
/**
 * ⚠️ Les commentaires sont RETIRÉS avant toute analyse de structure. Sans ça, le texte
 * entre deux règles — commentaires compris — se retrouve collé au sélecteur suivant, et
 * `.btn-sm` devenait « /* ⚠️ .btn-sm DOIT rester APRÈS … *\/ .btn-sm ». Le verrou
 * annonçait alors « aucune déclaration min-height » sur une valeur pourtant posée.
 * Corollaire déjà connu du dépôt : un scanneur qui ne retire pas les commentaires
 * s'interdit d'EXPLIQUER ce qu'il interdit.
 */
const CSS_INDEX = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * ⚠️ LA FEUILLE N'EST PAS QUE `index.css`. Deux contrôles du LOGIN — l'œil du mot de passe
 * (32×32) et « Mot de passe oublié ? » (135×21, SOUS le minimum WCAG AA 2.5.8) — vivaient
 * dans un bloc `<style>` à l'intérieur de `LoginPage.tsx`. Un verrou qui ne lit qu'index.css
 * les déclarait conformes en ne les ayant jamais lus, sur le premier écran que touche un
 * commerçant. Ces blocs partent bien dans le bundle (c'est déjà ce que `verify:classes`
 * inspecte dans le `dist/`) : ils font partie de la feuille livrée, donc du périmètre.
 * ⚠️ Le test d'ORDRE, lui, reste borné à `index.css` : la cascade entre un fichier et un
 * bloc injecté par React ne se déduit pas d'une position dans un texte.
 */
const STYLES_TSX = (() => {
  let out = ''
  for (const f of fichiersTsx(SRC)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<style[^>]*>\{?`([\s\S]*?)`\}?<\/style>/g)) out += '\n' + m[1]
  }
  return out.replace(/\/\*[\s\S]*?\*\//g, '')
})()
const CSS_NU = CSS_INDEX + '\n' + STYLES_TSX

// ── Tokens LUS dans la feuille (pas recopiés) ────────────────────────────────────────
function token(nom: string): number {
  const m = CSS_NU.match(new RegExp(`--${nom}\\s*:\\s*(\\d+)px`))
  if (!m) throw new Error(`token --${nom} introuvable dans index.css`)
  return Number(m[1])
}

/**
 * Règles de PREMIER NIVEAU (sélecteur, corps, position), par appariement de crochets —
 * pas une regex sur la structure : une regex se ferait berner par la première `}` venue
 * (leçon de paymentBreakdown, où un sabotage est passé vert parce que la règle scrutait
 * une ligne que la correction avait éclatée en six). Les blocs `@media` sont ignorés :
 * ils contiennent des règles imbriquées, et les avaler ferait passer leur contenu pour
 * un unique sélecteur aberrant.
 */
function reglesTopLevel(): { sel: string; corps: string; pos: number }[] {
  const out: { sel: string; corps: string; pos: number }[] = []
  let i = 0
  while (i < CSS_NU.length) {
    const ouvre = CSS_NU.indexOf('{', i)
    if (ouvre === -1) break
    const sel = CSS_NU.slice(i, ouvre).split('}').pop()!.trim()
    let profondeur = 0, fin = ouvre
    for (let k = ouvre; k < CSS_NU.length; k++) {
      if (CSS_NU[k] === '{') profondeur++
      else if (CSS_NU[k] === '}') { profondeur--; if (profondeur === 0) { fin = k; break } }
    }
    if (!sel.startsWith('@')) out.push({ sel, corps: CSS_NU.slice(ouvre + 1, fin), pos: ouvre })
    i = fin + 1
  }
  return out
}
const REGLES = reglesTopLevel()

/**
 * `min-height` EFFECTIVE d'un sélecteur, tokens résolus. `null` = non déclarée.
 *
 * ⚠️ Le sélecteur est apparié EXACTEMENT dans la liste, pas par sous-chaîne : `.btn` est
 * préfixe de `.btn-sm`, et un `indexOf('.btn')` tombait sur le groupe `.btn,.topbar-btn,…`
 * qui n'en déclare aucune — le verrou rendait `null` sur une valeur pourtant posée.
 * ⚠️ On garde la DERNIÈRE déclaration : à spécificité égale, c'est l'ordre qui gagne.
 */
function minHeight(selecteur: string): number | null {
  const blocs = REGLES.filter(r => r.sel.split(',').some(s => s.trim() === selecteur))
  if (!blocs.length) throw new Error(`sélecteur ${selecteur} absent d'index.css`)
  let valeur: number | null = null
  for (const b of blocs) {
    const m = b.corps.match(/min-height:\s*(?:var\(--([\w-]+)\)|(\d+)px)/)
    if (m) valeur = m[1] ? token(m[1]) : Number(m[2])
  }
  return valeur
}

describe('cibles tactiles — la famille entière, pas la forme qu’on regardait', () => {
  it('les tokens existent et valent ce que la décision dit', () => {
    expect(token('touch-min')).toBe(44)  // iOS HIG
    expect(token('touch-sm')).toBe(40)   // concession de densité, bornée à .btn-sm
  })

  /**
   * Périmètre DÉRIVÉ, par DEUX voies — et il en faut deux.
   *
   * ⚠️ La première version ne dérivait que du NOM (`*btn*`). Elle a laissé passer
   * `.stock-action` : un bouton d'action carré de la colonne Actions du Stock, déclaré
   * APRÈS `.btn-sm`, qui écrasait donc la famille vers 36px sur 51 éléments rendus.
   * Le verrou était VERT, la mesure `e2e:density` rouge. C'est l'angle mort de PÉRIMÈTRE :
   * il lisait les bonnes règles, pas TOUTES les bonnes.
   *
   * Voie 2 : les classes réellement posées sur un `<button>` dans `src/`. Un futur bouton
   * nommé `.machin-truc` entre donc dans le périmètre sans qu'on ait à y penser — ce qu'une
   * liste écrite à la main n'aurait jamais fait.
   */
  const CLASSES_SUR_BOUTON = (() => {
    const out = new Set<string>()
    for (const f of fichiersTsx(SRC)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/<button[^>]*?className="([^"]+)"/gs)) {
        for (const j of m[1].split(/\s+/)) if (j && !j.includes('{')) out.add(`.${j}`)
      }
    }
    return out
  })()

  const CLASSES_BOUTON = [
    ...[...CSS_NU.matchAll(/^\.([\w-]*btn[\w-]*)\s*[,{]/gm)].map(m => `.${m[1]}`),
    // …plus toute classe posée sur un <button> ET qui déclare une hauteur dans la feuille.
    // Sans ce second filtre on ramasserait `.flex-1`, `.gap-1.5` et les utilitaires, qui ne
    // décident d'aucune cible tactile.
    ...[...CLASSES_SUR_BOUTON].filter(c =>
      REGLES.some(r => r.sel.split(',').some(s => s.trim() === c) && /min-height:/.test(r.corps))),
  ].filter((v, i, a) => a.indexOf(v) === i)
    // `dp-nav-btn` (flèches du calendrier) et `att-seg-btn` (segments de présence) sont des
    // contrôles DENSES à l'intérieur d'un panneau, hors du périmètre de ce lot — exemptés
    // NOMMÉMENT, un par un, jamais par motif.
    // ⚠️ `.tab-btn` a QUITTÉ cette liste : la règle a été supprimée (0 rendu, TabBar stylait
    // tout en ligne). Une exemption dont on n'a plus besoin est un trou — elle laisserait
    // rentrer une future classe qui reprendrait ce nom.
    .filter(c => !['.dp-nav-btn', '.att-seg-btn'].includes(c))

  it('COUVERTURE — le scan trouve bien les classes de bouton', () => {
    // Sans ce cas, un `matchAll` cassé rendrait une liste vide et TOUTES les assertions
    // ci-dessous passeraient sur le néant (vérité vacante).
    expect(CLASSES_BOUTON.length).toBeGreaterThanOrEqual(8)
    expect(CLASSES_BOUTON).toContain('.btn')
    expect(CLASSES_BOUTON).toContain('.btn-sm')
    // DISCRIMINANT de la voie 2 : `.stock-action` ne contient pas « btn ». Sa présence ici
    // prouve que le périmètre ne se réduit plus au motif du NOM — c'est exactement la classe
    // que la première version du verrou avait laissée à 36px.
    expect(CLASSES_BOUTON).toContain('.stock-action')
    // DISCRIMINANT de la source élargie : `.login-link` n'est PAS dans index.css — elle vit
    // dans un bloc <style> de LoginPage.tsx. Sa présence prouve que le verrou lit bien la
    // feuille LIVRÉE, pas seulement le fichier qu'on avait en tête.
    expect(CLASSES_BOUTON).toContain('.login-link')
  })

  it('aucune classe de bouton ne descend sous 40px', () => {
    const fautives = CLASSES_BOUTON
      .map(c => ({ c, h: minHeight(c) }))
      .filter(({ h }) => h !== null && (h as number) < 40)
    expect(fautives).toEqual([])
  })

  it('les boutons TEXTE atteignent 44 — c’est eux qui manquaient', () => {
    for (const c of ['.btn', '.btn-primary', '.btn-ghost', '.btn-danger', '.btn-success']) {
      expect({ c, h: minHeight(c) }).toEqual({ c, h: 44 })
    }
  })

  it('.btn-sm reste à 40 — la concession est BORNÉE, elle ne fuit pas', () => {
    // DISCRIMINANT : sans ce cas, poser 44 partout passerait le test précédent et ferait
    // sauter une ligne de la table dense d'AdminDashboard sans qu'aucun verrou ne parle.
    expect(minHeight('.btn-sm')).toBe(40)
  })

  it('⚠️ .btn-sm est déclarée APRÈS les variantes qu’elle doit écraser', () => {
    // Même spécificité → c'est l'ORDRE qui décide. `btn btn-ghost btn-sm` (30 usages) doit
    // retomber sur 40. Déplacer le bloc plus haut le rendrait muet, et aucune assertion de
    // VALEUR ne le verrait : la feuille resterait juste, le rendu non.
    // Position de la règle qui DÉCLARE le min-height du sélecteur (la dernière).
    const posDecl = (sel: string) => {
      const b = REGLES.filter(r =>
        r.pos < CSS_INDEX.length &&
        r.sel.split(',').some(s => s.trim() === sel) && /min-height:/.test(r.corps))
      if (!b.length) throw new Error(`aucune déclaration min-height pour ${sel}`)
      return b[b.length - 1].pos
    }
    for (const avant of ['.btn', '.btn-primary', '.btn-ghost', '.btn-danger']) {
      expect({ avant, apres: posDecl('.btn-sm') > posDecl(avant) }).toEqual({ avant, apres: true })
    }
  })

  it('les boutons ICÔNE n’ont pas régressé', () => {
    // Ils étaient déjà conformes : le lot ne doit rien leur retirer.
    for (const c of ['.btn-icon', '.icon-btn', '.footer-btn']) {
      expect(new RegExp(`${c.slice(1)}[^}]*(min-height|height):\\s*44px`).test(CSS_NU)).toBe(true)
    }
  })

  it('.btn-ghost peut CENTRER son libellé — un min-height seul ne suffit pas', () => {
    // Employée seule 5 fois (`className="btn-ghost"`), elle n'héritait d'aucun display.
    // Sans flex + align-items, min-height colle le texte en haut du bouton.
    const groupe = CSS_NU.match(/\n\.btn,[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(groupe).toContain('.btn-ghost')
    expect(groupe).toMatch(/align-items:\s*center/)
  })
})

// ── Plancher typographique ────────────────────────────────────────────────────────────
function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersTsx(p, acc) }
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

describe('plancher typographique — 11px, la valeur que l’échelle DÉCLARE', () => {
  const FICHIERS = fichiersTsx(SRC)

  it('COUVERTURE — le balayage lit bien l’arborescence', () => {
    // Un walk() cassé rend une liste vide, donc un vert qui ne garde rien.
    expect(FICHIERS.length).toBeGreaterThan(150)
  })

  it('l’échelle déclare toujours 11 comme plus petite marche', () => {
    // Si --fs-caption bougeait, la règle ci-dessous garderait un plancher qui n'est plus
    // celui du système. On lit la valeur, on ne la suppose pas.
    expect(token('fs-caption')).toBe(11)
  })

  it('aucun fontSize littéral sous 11px dans src/', () => {
    const fautifs: string[] = []
    for (const f of FICHIERS) {
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\b/g)) {
          if (Number(m[1]) < 11) fautifs.push(`${f.replace(SRC, 'src')}:${i + 1} → ${m[1]}`)
        }
      })
    }
    expect(fautifs).toEqual([])
  })

  it('DISCRIMINANT — le scan voit encore les littéraux ≥ 11', () => {
    // Sans ce cas, une regex cassée rendrait « 0 fautif » et se lirait comme une victoire.
    // C'est le contrôle positif : la règle doit prouver qu'elle sait TROUVER.
    let vus = 0
    for (const f of FICHIERS) {
      for (const _ of readFileSync(f, 'utf8').matchAll(/fontSize:\s*(\d+)\b/g)) vus++
    }
    expect(vus).toBeGreaterThan(20)
  })
})
