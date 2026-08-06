import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * VERROU — aucun libellé de navigation ne peut tronquer, dans aucune des 4 langues.
 *
 * ─── POURQUOI CE VERROU EXISTE ───────────────────────────────────────────────
 * DEUX occurrences dans la même session : « Marketing WhatsApp », puis
 * « Paiements & cana… ». Les deux fois le correctif a porté sur l'ÉTIQUETTE — on a
 * raccourci la chaîne. Deux occurrences, ce n'est plus deux accidents, c'est un motif :
 * la contrainte était trop étroite et personne ne l'avait mesurée.
 *
 * ─── LA CAUSE, MESURÉE ───────────────────────────────────────────────────────
 * L'état ACTIF ne change ni le padding ni la largeur. Il change la GRAISSE :
 *   `.nav-item`        font-weight: var(--fw-regular)  = 500
 *   `.nav-item.active` font-weight: var(--fw-bold)     = 800
 * Le même texte est donc plus large une fois actif, dans un conteneur identique — d'où une
 * troncature qui n'apparaît QUE sur l'élément sélectionné, et qu'on ne voit donc jamais en
 * relisant le code.
 *
 * Largeur utile d'un libellé = sidebar − marge 16 − padding 20 − icône 30 − gap 8.
 *   avant : 220 − 74 = 146 px  → 21 caractères impossibles à toute graisse utilisable
 *   après : 248 − 74 = 174 px, libellé ramené à 13 px
 *
 * ─── CE QUE CE TEST PROUVE, ET CE QU'IL NE PROUVE PAS ────────────────────────
 * ⚠️ jsdom ne mesure pas de texte : il n'y a ni police chargée ni moteur de rendu. Ce test
 * est donc un BUDGET DE CARACTÈRES, pas une mesure en pixels — l'hypothèse est écrite
 * ci-dessous et volontairement PESSIMISTE. La vérification en pixels reste la capture.
 * Un budget conservateur qui rougit trop tôt est acceptable ; un budget optimiste qui laisse
 * passer une troncature ne l'est pas.
 */

const SRC = join(__dirname, '..')

/** Géométrie LUE dans `index.css` — jamais recopiée, sinon elle se périme en silence. */
function geometrie() {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8')
  const px = (re: RegExp): number => {
    const m = re.exec(css)
    if (!m) throw new Error(`token introuvable dans index.css : ${re}`)
    return Number(m[1])
  }
  return {
    sidebar: px(/--sidebar:\s*(\d+)px/),
    gap: px(/--sp-2:\s*(\d+)px/),
    // `.nav-item` : width calc(100% - 16px), padding 8px 10px → 16 + 20 consommés.
    marge: 16,
    padding: 20,
    icone: 30,
    labelPx: px(/--fs-sm:\s*(\d+)px/),
  }
}

/**
 * Largeur moyenne d'un caractère, en fraction de la taille de police, pour du latin
 * mixte en graisse 800.
 *
 * ⚠️ HYPOTHÈSE, pas une mesure — et délibérément haute. Geist en 800 tourne autour de
 * 0,58 em sur du texte courant ; on prend 0,64 pour absorber les majuscules, les
 * esperluettes et une police de repli plus large si Geist n'est pas encore chargée au
 * premier rendu. Si la capture montre malgré tout une troncature, c'est CE nombre qu'il
 * faut relever — pas le libellé qu'il faut raccourcir.
 */
const EM_PAR_CARACTERE = 0.64

/** Les 4 langues du produit. Un ternaire binaire FR/EN est un défaut ici comme ailleurs. */
const LANGUES = ['fr', 'en', 'es', 'it'] as const

/**
 * Libellés de navigation, DÉRIVÉS de `Sidebar.tsx` — jamais une liste écrite à la main :
 * une liste est fausse dès qu'on ajoute une entrée, et l'assertion de couverture ne le dit
 * pas. On prend aussi les en-têtes de section, qui vivent dans la même colonne.
 */
function clesDeNavigation(): string[] {
  const src = readFileSync(join(SRC, 'components/layout/Sidebar.tsx'), 'utf8')
  const cles = [
    ...[...src.matchAll(/key:\s*'([a-z0-9_]+)'/g)].map(m => m[1]),
    ...[...src.matchAll(/sectionKey:\s*'([a-z0-9_]+)'/g)].map(m => m[1]),
  ]
  return [...new Set(cles)]
}

/** Blocs de langue d'`i18n/index.ts`, découpés sur leurs déclarations. */
function traductions(): Record<string, Record<string, string>> {
  const src = readFileSync(join(SRC, 'i18n/index.ts'), 'utf8')
  const bornes = [...src.matchAll(/^(?:export )?const (fr|en|es|it)\b[^=]*=\s*\{/gm)]
  const out: Record<string, Record<string, string>> = {}
  bornes.forEach((b, k) => {
    const bloc = src.slice(b.index!, bornes[k + 1]?.index ?? src.length)
    const table: Record<string, string> = {}
    for (const m of bloc.matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) table[m[1]] = m[2].replace(/\\'/g, "'")
    out[b[1]] = table
  })
  return out
}

describe('aucun libellé de navigation ne tronque, dans aucune langue', () => {
  const g = geometrie()
  const utile = g.sidebar - g.marge - g.padding - g.icone - g.gap
  const budget = Math.floor(utile / (g.labelPx * EM_PAR_CARACTERE))
  const cles = clesDeNavigation()
  const T = traductions()

  it('COUVERTURE — la géométrie et les libellés sont bien LUS, pas supposés', () => {
    // ⚠️ Angle mort n°1 : un découpage cassé rend des tables vides, donc un vert qui ne
    // garde rien. On exige des ordres de grandeur, pas des valeurs exactes.
    expect(g.sidebar).toBeGreaterThan(150)
    expect(utile).toBeGreaterThan(100)
    expect(cles.length).toBeGreaterThan(10)
    for (const l of LANGUES) expect(Object.keys(T[l] ?? {}).length).toBeGreaterThan(300)
  })

  it(`chaque libellé tient dans le budget de la barre, en état ACTIF`, () => {
    const trop: string[] = []
    for (const k of cles) {
      for (const l of LANGUES) {
        const texte = T[l]?.[k]
        if (!texte) continue   // une clé absente d'une langue est le sujet d'un autre verrou
        if (texte.length > budget) trop.push(`${l} · ${k} · « ${texte} » = ${texte.length} car > ${budget}`)
      }
    }
    expect(trop, [
      `Budget : ${utile} px utiles ÷ (${g.labelPx} px × ${EM_PAR_CARACTERE}) = ${budget} caractères.`,
      'Corriger la CONTRAINTE (--sidebar, --fs-sm de .nav-label), pas le libellé :',
      'raccourcir la chaîne déplace le défaut vers la prochaine traduction un peu plus longue.',
      '',
      ...trop,
    ].join('\n')).toEqual([])
  })

  it('le budget couvre RÉELLEMENT les libellés les plus longs du produit', () => {
    // ⚠️ Sans ceci, élargir la sidebar à 2 000 px rendrait le test vert sans rien prouver,
    // et le réduire à 60 px le rendrait rouge pour la mauvaise raison. On ancre sur les
    // chaînes réellement présentes : « Pannello di controllo », « Registro de actividad ».
    const plusLong = Math.max(...cles.flatMap(k => LANGUES.map(l => (T[l]?.[k] ?? '').length)))
    expect(plusLong).toBeGreaterThanOrEqual(21)
    expect(budget).toBeGreaterThanOrEqual(plusLong)
  })

  it('l’état ACTIF ne rétrécit pas le conteneur — seule la graisse change', () => {
    // La cause EXACTE, figée : si quelqu'un ajoute du padding ou une bordure épaisse à
    // `.nav-item.active`, la largeur utile change sans que le budget bouge.
    const css = readFileSync(join(SRC, 'index.css'), 'utf8')
    const regleActive = /\.nav-item\.active,[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(regleActive).toBeTruthy()
    expect(regleActive).not.toMatch(/\bpadding\b/)
    expect(regleActive).not.toMatch(/\bwidth\b/)
    // `border-color` est admis (la bordure existe déjà, transparente, à l'état inactif) ;
    // `border-width` ne l'est pas — il décalerait le contenu.
    expect(regleActive).not.toMatch(/border-width|border:\s/)
  })
})
