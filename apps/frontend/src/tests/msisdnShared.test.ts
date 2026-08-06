import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { normalizeMsisdn } from '@/lib/msisdn'
import type { MsisdnPolicy } from '@/lib/msisdn'
import { POS_MSISDN_POLICY, msisdnErrorText, msisdnFormatLabel } from '@/lib/posMsisdnPolicy'

const POS = resolve(__dirname, '..', 'pages', 'POS.tsx')

/** Code EXÉCUTÉ : commentaires et imports retirés (ils citent les formes interdites). */
const code = (p: string): string => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  .replace(/^\s*import[^\n]*$/gm, ' ')

/**
 * Cas PARTAGÉS front ↔ back — `docs/shared-fixtures/msisdn-cases.json`.
 *
 * ⚠️ Lus à l'EXÉCUTION (`readFileSync`), jamais importés : le contexte de build Docker du
 * backend est `apps/backend` seul, et un import hors de cette frontière casserait le
 * déploiement en TS2307 sans que tsc local ne le voie.
 *
 * Remplace `mtn-normalize.test.ts`, qui validait une COPIE manuelle de la fonction.
 */
const FIXTURE = resolve(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'msisdn-cases.json')

interface Case { in: string; cmOnly: string | null; international: string | null; why: string }
const cases: Case[] = JSON.parse(readFileSync(FIXTURE, 'utf8')).cases

describe('couverture (une fixture déplacée rendrait ce test vert et vide)', () => {
  it('lit la fixture partagée', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20)
    expect(cases.every(c => typeof c.in === 'string' && typeof c.why === 'string')).toBe(true)
  })
  it('la fixture couvre les DEUX politiques, pas une seule', () => {
    // Sans cas où les deux diffèrent, on ne prouverait rien du paramètre `policy`.
    const divergents = cases.filter(c => c.cmOnly !== c.international)
    expect(divergents.length, 'aucun cas divergent : la fixture ne teste pas la politique').toBeGreaterThanOrEqual(6)
  })
})

describe.each(['cm-only', 'international'] as MsisdnPolicy[])('normalizeMsisdn — %s', (policy) => {
  const key = policy === 'cm-only' ? 'cmOnly' : 'international'
  for (const c of cases) {
    it(`${JSON.stringify(c.in)} → ${JSON.stringify(c[key as 'cmOnly' | 'international'])} · ${c.why}`, () => {
      expect(normalizeMsisdn(c.in, policy)).toBe(c[key as 'cmOnly' | 'international'])
    })
  }
})

describe('le jumeau backend n’a pas dérivé', () => {
  const body = (p: string) => {
    const s = readFileSync(p, 'utf8')
    return s.slice(s.indexOf('export type MsisdnPolicy'))
  }
  const FRONT = resolve(__dirname, '..', 'lib', 'msisdn.ts')
  const BACK = join(resolve(__dirname, '..', '..', '..', '..'), 'apps', 'backend', 'src', 'lib', 'msisdn.ts')

  it('les deux fichiers ont un corps IDENTIQUE', () => {
    expect(body(BACK)).toBe(body(FRONT))
  })
  it('… et le corps comparé est non vide', () => {
    expect(body(FRONT).length).toBeGreaterThan(400)
    expect(body(FRONT)).toContain('cm-only')
  })
})

/**
 * ⚠️ LA POLITIQUE EST VERROUILLÉE AU POINT D'APPEL, pas seulement dans le module.
 * Sabotage S20 : basculer `POS.tsx` de `'international'` à `'cm-only'` laissait TOUTE la
 * suite verte — le bac à sable MTN (numéros suédois) serait mort en silence. Un invariant
 * garanti sur le module ne dit rien de ce que l'appelant en demande.
 */
describe('les points d’appel déclarent la BONNE politique', () => {
  it('POS.tsx déclare une politique par flux, et elle vient de la source unique', () => {
    const src = code(POS)
    const calls = [...src.matchAll(/normalizeMsisdn\([^)]*\)/g)].map(m => m[0])
    expect(calls.length, 'aucun appel trouvé : le scan ou le fichier a bougé').toBe(2)
    // ⚠️ Plus aucun littéral de politique au point d'appel : les deux flux la lisent dans
    // `POS_MSISDN_POLICY`, qui porte la mesure faite sur la route serveur.
    for (const c of calls) {
      expect(c).toMatch(/POS_MSISDN_POLICY\.(orange|mtn)/)
      expect(c).not.toMatch(/'cm-only'|'international'/)
    }
    expect(calls.join(' ')).toContain('POS_MSISDN_POLICY.orange')
    expect(calls.join(' ')).toContain('POS_MSISDN_POLICY.mtn')
  })

  it("MTN garde 'international' — le bac à sable MTN utilise des numéros étrangers", () => {
    expect(POS_MSISDN_POLICY.mtn).toBe('international')
  })

  /**
   * ⚠️ MESURÉ le 2026-08-06, 9 saisies passées dans les deux implémentations : le champ
   * Orange appliquait le repli international puis envoyait à `POST /api/payments/campay/
   * request`, dont la politique EFFECTIVE est `cm-only`. **6 divergences sur 9** — dont
   * cinq où le front acceptait un numéro (sénégalais, français, suédois…) que le serveur
   * refusait en 400, le caissier ne voyant qu'« Échec de la demande ».
   */
  it("Orange suit la route qu'il atteint RÉELLEMENT : Campay, donc 'cm-only'", () => {
    expect(POS_MSISDN_POLICY.orange).toBe('cm-only')
    // Contre-preuve : la politique choisie refuse bien ce que la route refuse.
    for (const étranger of ['+221771234567', '0612345678', '46733123453', '799000001']) {
      expect(normalizeMsisdn(étranger, POS_MSISDN_POLICY.orange), étranger).toBeNull()
    }
    // …et accepte ce que la route accepte.
    expect(normalizeMsisdn('699000001', POS_MSISDN_POLICY.orange)).toBe('237699000001')
  })

  it("le texte montré au caissier est DÉRIVÉ de la politique, pas recopié", () => {
    // Une réserve écrite deux fois diverge : c'est déjà arrivé aux corps de refus de
    // Campay et MTN, alignés le même jour sur `phoneInvalidBody(policy)` côté serveur.
    for (const lang of ['fr', 'en', 'es', 'it'] as const) {
      expect(msisdnErrorText('orange', lang)).not.toBe(msisdnErrorText('mtn', lang))
      expect(msisdnFormatLabel('orange', lang)).not.toBe(msisdnFormatLabel('mtn', lang))
      // Le flux borné au Cameroun ne doit pas promettre « 8–15 chiffres ».
      expect(msisdnFormatLabel('orange', lang)).not.toMatch(/8\s*[–-]\s*15/)
      expect(msisdnFormatLabel('mtn', lang)).toMatch(/8\s*[–-]\s*15/)
    }
  })
})

/**
 * ⚠️ LE VERROU JUGE LA FORME, PLUS L'IDENTIFIANT — et c'est la leçon de ce chantier.
 *
 * La version précédente assertait `calls.length === 1` : elle PROUVAIT un site d'appel et
 * ne voyait rien du second, parce que celui-ci s'appelait `normalizeOrangePhone`. Une
 * troisième implémentation de la même règle vivait quarante lignes plus haut, dans le
 * fichier même que le verrou surveillait, et la suite entière restait verte.
 *
 * On interdit donc les FORMES qui fabriquent ou jugent un numéro, quel que soit le nom
 * qu'on leur donne. Calibrage MESURÉ : 0 correspondance sur le fichier corrigé, 7 sur la
 * version d'avant (4 × R1, 2 × R2, 1 × R3).
 */
describe('POS.tsx ne normalise plus aucun téléphone hors `normalizeMsisdn`', () => {
  interface Form { key: string; re: RegExp; why: string }
  const FORMS: Form[] = [
    { key: 'R1 quantificateur-de-chiffres', re: /(\[0-9\]|\\d)\{\d+(,\d+)?\}/,
      why: '/^[0-9]{8,15}$/ — juger la longueur d’un numéro, c’est le normaliser' },
    { key: 'R2 ancre-sur-plus-ou-zero',     re: /\/\^\\?\+|\/\^0/,
      why: "replace(/^\\+/,'') ou /^0/ — retirer un préfixe d’appel" },
    { key: 'R3 indicatif-en-dur-concatene', re: /`\+?\d{1,4}\$\{/,
      why: '`237${s}` — fabriquer un MSISDN à partir d’un indicatif SUPPOSÉ' },
  ]

  it('couverture : le fichier est lu, non vide, et appelle bien la source unique', () => {
    const src = code(POS)
    expect(src.length).toBeGreaterThan(20_000)
    expect(src).toContain('normalizeMsisdn(')
  })

  it.each(FORMS)('aucune occurrence de $key', ({ re, why }) => {
    const hits = code(POS).split('\n')
      .map((l, i) => ({ l: l.trim(), i: i + 1 }))
      .filter(({ l }) => re.test(l))
    expect(hits, why).toEqual([])
  })

  /**
   * ⚠️ LA CONTRE-ÉPREUVE UTILISE LA FORME RÉELLE, EXTRAITE DU DÉPÔT — jamais réécrite.
   * Un sabotage tapé de mémoire hérite des hypothèses du détecteur, et les deux tombent
   * ensemble : c'est exactement ce qui a laissé le verrou tarifaire vert sur `\b8000\b`
   * quand toute chaîne écrivait « 8 000 ».
   */
  it('… et les règles MORDENT sur l’implémentation réellement supprimée', () => {
    const supprimée = readFileSync(
      resolve(__dirname, 'fixtures', 'pos-normalizeOrangePhone.deleted.txt'), 'utf8')
    expect(supprimée, 'fixture vide : la contre-épreuve ne prouverait rien').toContain('normalizeOrangePhone')
    const déclenchées = FORMS.filter(f => f.re.test(supprimée)).map(f => f.key)
    expect(déclenchées).toEqual(FORMS.map(f => f.key))
  })

  it('un indicatif CHOISI par le caissier n’est pas une inférence (exemption raisonnée)', () => {
    // `POS.tsx` assemble encore le numéro du reçu WhatsApp :
    //     `${waCountryCode}${waNumber.replace(/[\s\-]/g,'')}`
    // R3 ne le vise PAS, et c'est délibéré : l'indicatif vient d'un sélecteur que
    // l'opérateur a manipulé, pas d'une constante que le code a supposée. Le serveur
    // reste seul juge (`resolveRecipient`, flux CLIENT : aucun pays inféré, `isValid()`).
    expect(FORMS[2].re.test('`${waCountryCode}${waNumber.replace(/[\\s\\-]/g, "")}`')).toBe(false)
    expect(FORMS[2].re.test('`237${s}`')).toBe(true)
  })
})

describe('limites assumées', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — Les règles visent POS.tsx. Une normalisation déplacée dans un module voisin
      //     y échapperait ; la couche solide reste `policy` sans valeur par défaut, qui
      //     force tout futur appelant à choisir.
      'regles-portees-sur-POS-tsx-seulement',
      // 2 — Le sélecteur d'indicatif du reçu WhatsApp démarre sur `+221` (Sénégal). Un
      //     caissier qui n'y touche pas préfixe un numéro local d'un indicatif étranger.
      //     `resolveRecipient` l'écarte côté serveur (`isValid()`), mais le défaut de
      //     conception — un défaut implicite de pays — n'est pas fermé ici.
      'indicatif-whatsapp-par-defaut-+221-non-traite',
      // 3 — Une forme INÉDITE de fabrication passerait : on interdit trois formes
      //     mesurées, pas l'ensemble des façons d'écrire un numéro.
      'forme-inedite-non-couverte',
    ]
    expect(LIMITES).toHaveLength(3)
  })
})
