import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * PLAFOND DE `CLAUDE.md` — le garde qui manquait.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `CLAUDE.md` déclare un plafond de 160 000 caractères, et explique pourquoi il
 * coûte : ce fichier se charge à CHAQUE démarrage de session, donc +10 000
 * caractères ≈ +3 300 jetons payés à chaque fois. La règle existait depuis des
 * mois. RIEN ne l'appliquait.
 *
 * Une règle que rien n'applique est un vœu — c'est exactement ce que ce dépôt
 * reproche au `sanitizeCsv` qui vivait en `const` locale avant #173, et à
 * l'alarme `notify-failure` qui sortait en `exit 0` sur un secret absent.
 *
 * ⚠️ CE GARDE NE JUGE QUE `CLAUDE.md`. C'est délibéré, et c'est ce que dit la
 * règle : le plafond mesure la CONCENTRATION (ce qui se charge à chaque session),
 * pas le volume total de documentation. Extraire une page vers `docs/lessons/`
 * REDISTRIBUE — mesuré le 2026-08-07 : −7 722 ici, +6 584 là-bas, −1 138 au
 * total. Étendre ce garde à `docs/lessons/` mesurerait autre chose que la règle.
 */

/** Racine du monorepo, depuis `apps/frontend/src/tests/`. */
const CLAUDE_MD = join(__dirname, '../../../../CLAUDE.md')

/**
 * ⚠️ CE NOMBRE EST ÉCRIT DEUX FOIS, ET C'EST VOULU — ici et dans `CLAUDE.md`.
 *
 * Le relever exige donc DEUX éditions, dans deux fichiers, visibles dans le même
 * diff. C'est la forme du cliquet de lint : on peut le bouger, jamais par accident.
 * Un plafond DÉRIVÉ du fichier mesuré serait sans valeur — le commit qui déborde
 * relèverait la limite dans le même geste, et le garde resterait vert.
 */
const PLAFOND = 160_000

/** Forme littérale du plafond telle qu'elle est ÉCRITE dans la règle. */
const PLAFOND_ECRIT = '160 000' // U+0020 — MESURÉ, pas supposé (cf. les 4 séparateurs, § Jumeau non traité)

/**
 * ⚠️ COMPTER EN POINTS DE CODE, PAS EN UNITÉS UTF-16.
 *
 * `String.length` compte des unités UTF-16 : chaque émoji hors du plan de base
 * (📖 🔴 🧪 🏪 …) en vaut DEUX. Mesuré sur le fichier réel : `.length` rend
 * 151 365 là où `wc -m` rend 151 324 — 41 de trop.
 *
 * L'écart va dans le sens SÛR (le garde crierait trop tôt, jamais trop tard),
 * mais il ferait diverger notre chiffre de celui de `wc -m`, que la règle donne
 * comme la commande de référence. Un garde dont la mesure contredit la commande
 * qu'on demande aux gens de lancer se fait désarmer au premier désaccord.
 */
function compterCaracteres(s: string): number {
  return [...s].length
}

describe('plafond de CLAUDE.md', () => {
  const src = readFileSync(CLAUDE_MD, 'utf8')

  it('⚠️ COUVERTURE — on a bien lu CLAUDE.md, pas un fichier vide ni un autre', () => {
    /**
     * Angle mort n°1 : un garde qui ne lit RIEN passe au vert. Si `CLAUDE.md`
     * était déplacé ou vidé, tout ce qui suit deviendrait vacant — « 0 ≤ 160 000 »
     * est vrai et ne garde rien. On épingle donc l'IDENTITÉ du fichier lu.
     */
    expect(src.length, 'CLAUDE.md illisible ou vide').toBeGreaterThan(50_000)
    expect(src, 'ce n’est pas le CLAUDE.md du dépôt').toContain('# HabaShop — Guide Claude Code')
  })

  it('la RÈGLE et son GARDE nomment le même nombre', () => {
    /**
     * Si quelqu'un relève le plafond dans `CLAUDE.md` sans toucher ici, les deux
     * divergent en silence et le garde applique l'ancienne limite — un garde qui
     * mesure autre chose que ce que la règle annonce est pire qu'aucun garde.
     *
     * ⚠️ L'assertion porte sur le CONTENU DU FICHIER, pas sur deux constantes de
     * ce test. La première version comparait `PLAFOND_ECRIT` à `PLAFOND` — deux
     * littéraux écrits dix lignes plus haut : elle ne pouvait échouer que sur une
     * faute de frappe, et n'ouvrait `CLAUDE.md` à aucun moment. Un test qui décrit
     * le test au lieu du monde n'affirme rien.
     */
    expect(
      src,
      `ce garde applique un plafond de ${PLAFOND}, et « ${PLAFOND_ECRIT} » n’apparaît plus dans\n`
      + 'CLAUDE.md. Soit la règle a été relevée sans toucher ici, soit elle a disparu.\n'
      + 'Décider lequel est juste, puis aligner les DEUX — le relever exige deux éditions, par construction.',
    ).toContain(PLAFOND_ECRIT)
  })

  it('⚠️ CLAUDE.md tient sous son plafond', () => {
    const n = compterCaracteres(src)
    const marge = PLAFOND - n

    expect(
      n,
      `CLAUDE.md pèse ${n} caractères, soit ${-marge} DE TROP (plafond ${PLAFOND}).\n`
      + 'Le critère du tri est dans le fichier lui-même : reste ce qui CHANGE UN COMPORTEMENT\n'
      + 'sans qu’on l’ait demandé ; part dans docs/lessons/ ce qu’on consulte une fois déjà\n'
      + 'sur le sujet. ⚠️ Vérifier un allègement, c’est vérifier ce qui a QUITTÉ le fichier —\n'
      + 'une compression conforme a déjà supprimé CINQ règles, dont une trace d’audit.\n'
      + '⚠️ Si le plafond est inatteignable sans sacrifier une protection : s’ARRÊTER et le dire.',
    ).toBeLessThanOrEqual(PLAFOND)
  })

  it('⚠️ compte des CARACTÈRES, pas des unités UTF-16', () => {
    /**
     * Sabotage figé : si quelqu'un « simplifie » `[...s].length` en `s.length`,
     * ce cas rougit. Le fichier réel porte des émojis hors plan de base — cette
     * propriété n'est donc pas théorique, elle vaut 41 caractères aujourd'hui.
     */
    expect(compterCaracteres('📖'), 'un émoji hors BMP est UN caractère').toBe(1)
    expect('📖'.length, 'témoin : String.length en compte deux').toBe(2)
    expect(
      compterCaracteres(src),
      'la mesure doit coïncider avec `wc -m`, la commande que la règle donne',
    ).toBeLessThan(src.length)
  })
})
