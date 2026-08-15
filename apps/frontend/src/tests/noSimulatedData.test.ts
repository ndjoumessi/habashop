import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UN ÉCRAN NE TIRE PAS AU SORT CE QU'IL AFFICHE.
 *
 * ── LE DÉFAUT QU'ON FERME ────────────────────────────────────────────────────────────
 * MESURÉ en production le 2026-08-15, sur `/app/integrations`. Le panneau « Monitoring
 * temps réel », badge **LIVE** vert et pastille pulsée, était intégralement FABRIQUÉ :
 *
 *   • `DEFAULT_STATS` — 1 284 envoyés · 23 échoués · 342 ms, littéraux ;
 *   • un `setInterval` de 5 s qui faisait DÉRIVER la jauge de rate-limit
 *     (`Math.random() > .5 ? +1 : -1`) ;
 *   • un flux d'événements webhook inventé au tirage (`Math.random() > .7`), avec des
 *     adresses de commerçants qui n'existent pas — `user@senegal.sn`, `shop@mali.ml` ;
 *   • une alerte « taux de rebond élevé : 1.8 % » DÉRIVÉE de ces faux chiffres.
 *
 * Zéro appel réseau. C'est la famille « le champ déclaré qui se fait passer pour une
 * mesure », dans sa forme la plus convaincante : **le mouvement se lit comme une preuve**.
 * Un chiffre figé finit par éveiller le soupçon ; un flux qui défile, non.
 *
 * ── POURQUOI `Math.random` EST LE BON MARQUEUR, ET POURQUOI ICI SEULEMENT ─────────────
 * Mesuré avant d'écrire la règle — un scanner qui crie au loup se fait désarmer :
 * TOUT le front ne portait que CINQ `Math.random`, dont quatre dans le moniteur supprimé.
 * Les deux survivants sont légitimes ET vivent naturellement hors du périmètre :
 *
 *   stores/notificationStore.ts   suffixe d'identifiant unique
 *   lib/barcode.ts                `generateEAN13(rnd = Math.random)` — source INJECTABLE
 *
 * Le périmètre est donc `components/` + `pages/` : les surfaces de RENDU. Le hasard y est
 * du décor ; ailleurs c'est un outil. La règle ferme la porte à coût nul et sans un seul
 * faux positif — c'est ce qui la rend tenable.
 *
 * ⚠️ RÉSIDU ASSUMÉ, à ne pas laisser croire couvert : ceci attrape la fabrication EN
 * MOUVEMENT, pas le littéral immobile. Un `const STATS = { sent: 1284 }` rendu tel quel
 * passerait — c'était d'ailleurs la moitié du défaut d'origine. Contre celui-là il n'y a
 * pas de parade automatique : seulement la question à poser en revue, « d'où vient ce
 * nombre ? ». La même limite que l'ARITÉ des ternaires (§ CLAUDE.md).
 */

const SRC = join(__dirname, '..')
const CIBLES = ['components', 'pages']

/** Fichiers source des surfaces de rendu — périmètre DÉRIVÉ de l'arborescence. */
function balayer(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) balayer(p, acc)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p)
  }
  return acc
}

const FICHIERS = CIBLES.flatMap(c => balayer(join(SRC, c)))

/** Source débarrassée des commentaires : sinon la règle interdit d'expliquer ce qu'elle interdit. */
const nu = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const violations = FICHIERS.flatMap(f => {
  const lignes = nu(readFileSync(f, 'utf8')).split('\n')
  return lignes
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /Math\s*\.\s*random/.test(l))
    .map(({ l, i }) => `${f.slice(SRC.length + 1)}:${i + 1} → ${l.trim().slice(0, 80)}`)
})

describe('aucune donnée simulée sur une surface de rendu', () => {
  it('COUVERTURE — le balayage lit vraiment des fichiers', () => {
    // Un `balayer()` cassé rend une liste vide, donc « zéro violation » : la vérité vacante.
    // Sans ce cas, un dossier renommé désarmerait le verrou en se déclarant vert.
    expect(FICHIERS.length).toBeGreaterThan(150)
    expect(FICHIERS.some(f => f.endsWith('pages/Integrations.tsx'))).toBe(true)
    expect(FICHIERS.some(f => f.endsWith('pages/POS.tsx'))).toBe(true)
  })

  it('DISCRIMINANT — le détecteur reconnaît bien la forme qu’il cherche', () => {
    // Témoin positif OBLIGATOIRE : sans lui, une regex cassée rendrait « 0 violation »,
    // exactement le résultat qu'on espère — et le zéro aurait l'air d'une preuve.
    const motif = /Math\s*\.\s*random/
    expect(motif.test('const x = Math.random()')).toBe(true)
    expect(motif.test('const x = Math . random ()')).toBe(true)
    expect(motif.test('const x = crypto.randomUUID()')).toBe(false)
  })

  it('DISCRIMINANT — un commentaire qui NOMME la règle ne la déclenche pas', () => {
    // Sinon ce fichier-ci, et tout bloc d'explication, s'épinglerait lui-même.
    // Un scanneur doit survivre à son propre scan.
    expect(nu('// on évite Math.random ici\nconst a = 1').includes('random')).toBe(false)
    expect(nu('/* pas de Math.random */\nconst a = 1').includes('random')).toBe(false)
  })

  it('⚠️ aucun `Math.random` sous `components/` ni `pages/`', () => {
    expect(violations).toEqual([])
  })

  it('les usages LÉGITIMES restent possibles hors des surfaces de rendu', () => {
    // La règle ne doit pas pousser à contourner : elle borne un lieu, pas un outil.
    // Ces deux-là sont vivants et volontairement hors périmètre — si l'un disparaît,
    // ce cas rougit et force à relire le raisonnement plutôt qu'à le supposer encore vrai.
    const store = readFileSync(join(SRC, 'stores', 'notificationStore.ts'), 'utf8')
    const codeBarre = readFileSync(join(SRC, 'lib', 'barcode.ts'), 'utf8')
    expect(store).toMatch(/Math\.random/)
    expect(codeBarre).toMatch(/rnd:\s*\(\)\s*=>\s*number\s*=\s*Math\.random/)
  })
})
