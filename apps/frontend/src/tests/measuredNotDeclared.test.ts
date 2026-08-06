import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * VERROU — un écran ne doit pas affirmer une MESURE à partir d'une CONSTANTE.
 *
 * ─── LE DÉFAUT QU'ON FERME ───────────────────────────────────────────────────
 * MESURÉ le 2026-08-06 sur `pages/Integrations.tsx` : le catalogue d'intégrations portait
 * `status:'connected'` sur 11 entrées sur 12, plus `uptime:'99.9%'`, `calls:1847` et
 * `lastCall:'Il y a 2 min'`. Le commerçant lisait « 4/5 connectées » en vert, bande de
 * statut verte comprise, sur des prestataires dont AUCUN secret n'est posé en production.
 * Rien de tout cela n'avait jamais été observé : c'était du texte dans un fichier.
 *
 * C'est la même famille que la pastille de santé de la console Ops (§ Console Ops) et que
 * `lastLoginAt`, colonne déclarée et jamais écrite : **un signal qui ne peut pas être faux
 * ne prouve rien**, et il coûte plus cher que l'absence de signal, parce qu'on s'y fie.
 *
 * ─── LA RÈGLE, ET POURQUOI CELLE-CI ──────────────────────────────────────────
 * Le premier critère essayé — « une clé dont toutes les entrées portent la MÊME valeur » —
 * a été CALIBRÉ et REJETÉ : il ne trouvait pas le défaut. `status` valait `'connected'`
 * onze fois et `'disconnected'` une fois (PayDunya), donc deux valeurs distinctes, donc
 * invisible pour lui. Un critère qui laisse passer le cas qui l'a motivé est un critère
 * faux, pas un critère prudent.
 *
 * La règle retenue vise le VOCABULAIRE : une clé qui nomme une observation du monde
 * (`status`, `uptime`, `calls`, `latency`, `online`…) ne doit pas porter de valeur
 * littérale à l'intérieur d'un catalogue. Elle est mesurée, ou elle est renommée pour dire
 * qu'elle est déclarée — c'est ce qu'on a fait : `status` → `declared`.
 *
 * CALIBRAGE (254 fichiers de `apps/frontend/src`, hors tests) :
 *   avant correctif : 64 correspondances, concentrées sur DEUX fichiers
 *   après correctif : 16, toutes dans l'exemption nommée ci-dessous
 * Zéro faux positif ailleurs — la règle est assez spécifique pour ne pas crier au loup.
 *
 * ─── LES QUATRE ANGLES MORTS (§ Le JUMEAU NON TRAITÉ) ────────────────────────
 *  1. PROFONDEUR — assertion de couverture : on vérifie qu'on a bien lu ≥ 200 fichiers.
 *     Le premier scanner écrit pour ce chantier rendait 2 correspondances sur 254 fichiers
 *     et semblait donc rassurant : il ne trouvait simplement RIEN, sa regex de tableau
 *     s'arrêtant au premier `]` d'un sous-tableau `features:[…]`. D'où l'analyse par
 *     appariement de délimiteurs, et non par expression régulière.
 *  2. PÉRIMÈTRE — DÉRIVÉ de l'arborescence (`walk` sur `src/`), jamais une liste écrite à
 *     la main : une liste est fausse dès qu'on ajoute un fichier, et l'assertion de
 *     couverture ne le dira pas.
 *  3. FORME — le sabotage est COPIÉ depuis la production, extrait par
 *     `git show HEAD:…` avant correctif (`fixtures/integrations-declared-status.avant.txt`).
 *     Un sabotage retapé de mémoire hérite des hypothèses du détecteur et tombe avec lui.
 *  4. ARITÉ — sans parade automatique. Ce verrou ne voit pas une branche MANQUANTE.
 *
 * ─── CE QU'IL NE VOIT PAS, ÉCRIT PLUTÔT QUE SOUS-ENTENDU ─────────────────────
 *  · une colonne de base DÉCLARÉE ET JAMAIS ÉCRITE (`lastLoginAt`) — c'est un fait sur le
 *    serveur, pas une forme dans le source ; couvert par `lastLoginWritten.test.ts` côté back ;
 *  · une constante hors catalogue (moins de trois entrées) ;
 *  · une valeur inventée sous un nom neutre (`desc:'99,9 % de disponibilité'`).
 */

const RACINE = join(__dirname, '..')

/**
 * Vocabulaire de MESURE : des clés qui affirment un fait observé.
 * ⚠️ Volontairement COURT. L'élargir à tout nom de champ noierait le défaut sous les
 * catalogues d'affichage légitimes — c'est la leçon de l'arité des ternaires : à 95 % de
 * justes, un scanner crie au loup et finit désarmé.
 */
const MOTS_DE_MESURE = [
  'status', 'uptime', 'calls', 'lastCall', 'latency', 'health',
  'connected', 'errorRate', 'responseTime', 'online', 'ping',
]

/**
 * EXEMPTIONS — par RAISON NOMMÉE, jamais par commodité.
 *
 * `utils/export.ts` `generateCDC()` : document de projet (cahier des charges PDF) où
 * `status:'Livré'` est une DÉCLARATION D'INTENTION de l'équipe sur son propre périmètre,
 * pas une observation d'un système. Rien n'est sondé et rien ne prétend l'être.
 * ⚠️ Réserve consignée : la fonction n'a AUCUN appelant (vérifié le 2026-08-06) et annonce
 * 16 modules « Livré », dont Push et SMS qui sont livrés mais INERTES faute de variables
 * d'environnement. C'est une dette de contenu, distincte de ce que ce verrou juge.
 */
const EXEMPTS = new Map<string, string>([
  ['utils/export.ts', 'cahier des charges PDF — déclaration d’intention, aucun système sondé'],
])

/** Masque : 1 là où le caractère est du CODE (hors chaîne, hors commentaire). */
function masqueDeCode(src: string): Uint8Array {
  const n = src.length
  const code = new Uint8Array(n)
  let i = 0
  while (i < n) {
    const c = src[i], d = src[i + 1]
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i++
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++ }
      i++; continue
    }
    code[i] = 1; i++
  }
  return code
}

export interface Trouvaille { ligne: number; cle: string; valeur: string; entrees: number }

/**
 * Cherche, dans les CATALOGUES (tableaux d'au moins trois objets littéraux), les clés du
 * vocabulaire de mesure portant une valeur littérale.
 *
 * ⚠️ Appariement de délimiteurs, PAS d'expression régulière sur la structure : une regex
 * `\[[\s\S]*?\]` s'arrête au premier `]` rencontré, donc au premier sous-tableau — c'est
 * ainsi que la première version de ce scanner ne voyait rien tout en paraissant propre.
 */
export function mesuresDeclarees(src: string): Trouvaille[] {
  const n = src.length
  const code = masqueDeCode(src)
  const fin = (depuis: number, ouvre: string, ferme: string): number => {
    let prof = 0
    for (let p = depuis; p < n; p++) {
      if (!code[p]) continue
      if (src[p] === ouvre) prof++
      else if (src[p] === ferme) { prof--; if (prof === 0) return p }
    }
    return -1
  }

  const trouve: Trouvaille[] = []
  for (let p = 0; p < n; p++) {
    if (code[p] !== 1 || src[p] !== '[') continue
    const q = fin(p, '[', ']')
    if (q < 0) continue

    // Objets de PREMIER niveau dans ce tableau.
    const objs: [number, number][] = []
    for (let r = p + 1; r < q; r++) {
      if (code[r] !== 1 || src[r] !== '{') continue
      const s = fin(r, '{', '}')
      if (s < 0 || s > q) break
      objs.push([r, s]); r = s
    }
    if (objs.length < 3) continue

    for (const [a, b] of objs) {
      for (let r = a + 1; r < b; r++) {
        if (code[r] !== 1) continue
        const m = /^(\w+)\s*:\s*(?:(['"])((?:\\.|[^\\])*?)\2|(\d[\d.]*))/.exec(src.slice(r, b))
        if (!m) continue
        // La clé doit débuter un membre : début d'objet, ou précédée d'une virgule/espace.
        if (r !== a + 1 && !/[,{\s]/.test(src[r - 1])) continue
        if (MOTS_DE_MESURE.includes(m[1])) {
          trouve.push({
            ligne: src.slice(0, r).split('\n').length,
            cle: m[1],
            valeur: m[3] ?? m[4],
            entrees: objs.length,
          })
        }
        r += m[0].length - 1
      }
    }
    p = q
  }
  return trouve
}

/** Périmètre DÉRIVÉ : toute l'arborescence `src/`, hors tests. */
function fichiersDuFront(): string[] {
  const out: string[] = []
  const marche = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { if (e !== 'tests') marche(p); continue }
      if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
    }
  }
  marche(RACINE)
  return out
}

describe('un écran n’affirme pas une mesure depuis une constante', () => {
  const fichiers = fichiersDuFront()

  it('COUVERTURE — le balayage lit réellement l’arborescence', () => {
    // ⚠️ Angle mort n°1 : un `walk()` cassé rend une liste vide, donc un vert qui ne garde
    // rien. Ce test échoue AVANT les autres si le périmètre s'effondre.
    expect(fichiers.length).toBeGreaterThan(200)
    expect(fichiers.some(f => f.endsWith('pages/Integrations.tsx'))).toBe(true)
    expect(fichiers.some(f => f.endsWith('components/integrations/OpsInfrastructure.tsx'))).toBe(true)
  })

  it('aucun littéral de MESURE dans un catalogue, hors exemptions nommées', () => {
    const fautes: string[] = []
    for (const f of fichiers) {
      const rel = relative(RACINE, f).replace(/\\/g, '/')
      if (EXEMPTS.has(rel)) continue
      for (const t of mesuresDeclarees(readFileSync(f, 'utf8'))) {
        fautes.push(`${rel}:${t.ligne} — ${t.cle} = ${JSON.stringify(t.valeur)} (catalogue de ${t.entrees})`)
      }
    }
    expect(fautes, [
      'Un champ qui NOMME une observation du monde porte une valeur écrite dans le dépôt.',
      'Soit il est mesuré (sonde, appel serveur), soit il est RENOMMÉ pour dire qu’il est',
      'déclaré — c’est ce qui a été fait pour `status` → `declared` d’INTEGRATIONS_LIST.',
    ].join('\n') + '\n' + fautes.join('\n')).toEqual([])
  })

  it('SABOTAGE — la forme réellement commise est bien détectée', () => {
    // ⚠️ Angle mort n°3 : la forme est COPIÉE depuis la production (extraite par
    // `git show HEAD:apps/frontend/src/pages/Integrations.tsx` avant correctif), jamais
    // retapée. Un sabotage écrit de mémoire hérite des hypothèses du détecteur.
    const avant = readFileSync(join(__dirname, 'fixtures/integrations-declared-status.avant.txt'), 'utf8')
    // La fixture n'est qu'un extrait : on la complète pour en faire un catalogue de 3.
    const bloc = avant.slice(avant.indexOf('['), avant.lastIndexOf('},') + 2)
    const catalogue = `const X = ${bloc}${bloc.slice(bloc.indexOf('{'))}${bloc.slice(bloc.indexOf('{'))}]`

    const t = mesuresDeclarees(catalogue)
    const cles = new Set(t.map(x => x.cle))
    expect(cles.has('status')).toBe(true)
    expect(cles.has('uptime')).toBe(true)
    expect(cles.has('calls')).toBe(true)
    expect(cles.has('lastCall')).toBe(true)
  })

  it('CONTRE-ÉPREUVE — un catalogue d’affichage légitime ne déclenche RIEN', () => {
    // Un scanner qui rougit sur tout se fait désarmer. Ni les libellés, ni les couleurs,
    // ni les icônes ne sont des affirmations sur le monde.
    const sain = `const NAV = [
      { id: 'a', label: 'Ventes',   color: '#fff', declared: 'configured' },
      { id: 'b', label: 'Stock',    color: '#000', declared: 'configured' },
      { id: 'c', label: 'Clients',  color: '#123', declared: 'absent' },
    ]`
    expect(mesuresDeclarees(sain)).toEqual([])
  })

  it('le catalogue d’intégrations ne porte plus AUCUN de ces champs', () => {
    // Assertion nominative : la régression exacte qu'on vient de corriger.
    const src = readFileSync(join(RACINE, 'pages/Integrations.tsx'), 'utf8')
    expect(mesuresDeclarees(src)).toEqual([])
    expect(src).not.toMatch(/\buptime\s*:/)
    expect(src).not.toMatch(/\blastCall\s*:/)
    // …et le champ déclaratif porte un nom qui dit sa nature.
    expect(src).toMatch(/declared:\s*'configured'/)
  })
})
