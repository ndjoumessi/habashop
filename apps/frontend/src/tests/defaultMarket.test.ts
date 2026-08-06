import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve, relative } from 'path'
import { DEFAULT_MARKET, dialCodeFor, hasDialCode } from '@/lib/defaultMarket'

/**
 * VERROU — aucun pays, devise ou indicatif PAR DÉFAUT hors de la source unique.
 *
 * ─── POURQUOI CELUI-CI EST JUSTIFIÉ, ET PAS UN SCANNER D'ARITÉ ───────────────
 * Six jumeaux mesurés le 2026-08-06, dans trois workspaces : `auth.ts`, `tenant.ts`,
 * `admin.ts`, `SignupPage`, `Onboarding`, `AdminDashboard`, `SectionShops`, les deux
 * `appStore`, `POS.tsx` et les deux composants téléphone écrivaient chacun leur propre
 * « Sénégal ». Le rapport est l'inverse de celui de l'arité des ternaires — là-bas
 * 1 211 chaînes sur 1 268 étaient CORRECTES et un scanner aurait crié au loup ; ici la
 * quasi-totalité des occurrences était à corriger.
 *
 * ─── CE QU'IL DISTINGUE ──────────────────────────────────────────────────────
 * Un DÉFAUT (« ce qu'on obtient quand personne n'a choisi ») d'un MEMBRE DE LISTE
 * (`countryList.ts` contient légitimement `'SN'`) et d'un REPLI D'AFFICHAGE
 * (`tenant.currency ?? 'XOF'` rend une devise absente, il ne décide d'aucun marché —
 * décision explicite du 2026-08-06 : on les laisse, ils sont donc exemptés NOMMÉMENT).
 *
 * Il vise la FORME, jamais l'identifiant : le défaut peut s'appeler `country`, `pays`,
 * `iso`, `defaultCountry`. C'est la leçon de `normalizeOrangePhone`, qui vivait sous un
 * autre nom dans un fichier déjà surveillé.
 */

const SRC = resolve(__dirname, '..')
const ROOT = resolve(SRC, '..', '..', '..')
const ROOTS = ['apps/frontend/src', 'apps/backend/src', 'mobile/src', 'mobile/app']
  .map(r => join(ROOT, r)).filter(existsSync)
const SKIP_DIR = /(^|\/)(tests?|__tests__|e2e|node_modules|dist|fixtures)(\/|$)/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const full = join(dir, e)
    if (SKIP_DIR.test(full)) return []
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(e) && !/\.test\./.test(e) ? [full] : []
  })
}
const FILES = ROOTS.flatMap(walk)

const code = (p: string): string => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))

/** Le marché d'AVANT — ce que le verrou interdit en position de défaut. */
const PREVIOUS = String.raw`'(SN|\+221|XOF)'`

/**
 * FORMES de défaut. Chacune a été VUE dans le dépôt avant correction — aucune n'est
 * hypothétique. Le calibrage (0 après / 19 avant) est asserté plus bas.
 */
const FORMS: { key: string; re: RegExp }[] = [
  { key: 'repli ??',            re: new RegExp(String.raw`\?\?\s*${PREVIOUS}`, 'g') },
  { key: 'repli ||',            re: new RegExp(String.raw`\|\|\s*${PREVIOUS}`, 'g') },
  { key: 'useState initial',    re: new RegExp(String.raw`useState(?:<[^>]*>)?\(\s*${PREVIOUS}`, 'g') },
  { key: 'champ de formulaire', re: new RegExp(String.raw`\b(country|pays|iso|currency|devise|dial|indicatif|prefix)\w*\s*:\s*${PREVIOUS}`, 'gi') },
  { key: 'const nommée défaut', re: new RegExp(String.raw`\b(DEFAULT|FALLBACK|BASE)\w*\s*(?::[^=]+)?=\s*${PREVIOUS}`, 'gi') },
]

/**
 * ⚠️ EXEMPTIONS PAR RAISON NOMMÉE, pas par fichier — chacune a été LUE, aucune supposée.
 * Elles s'évaluent sur une FENÊTRE de ±3 lignes : la raison vit souvent une ligne plus
 * haut que le littéral (l'appel de fonction, la clé de la fixture).
 */
const EXEMPT_SITES: { match: RegExp; why: string }[] = [
  { match: /(\w|\.)currency\s*(\?\?|\|\|)\s*'XOF'/,
    why: "repli d'AFFICHAGE : rend une devise absente, ne décide d'aucun marché" },
  { match: /createWaveCheckout\(/,
    why: 'devise de RÈGLEMENT de Wave (prestataire sénégalais) — pas le marché du tenant' },
  { match: /convertAmount\(/,
    why: "unité de BASE de la conversion (`Sale.total` est stocké en XOF), pas la devise cible" },
  { match: /caToday:|_sum\.total/,
    why: "unité de BASE du KPI e-mail — le montant vient de `Sale.total`, en XOF" },
  { match: /'WV-TEST-|ref:\s*'WV/,
    why: "fixture d'e-mail de TEST (`admin.ts`), aucun tenant concerné" },
]
const EXEMPT_FILES = new Set([
  'apps/frontend/src/utils/countryList.ts',
  'apps/frontend/src/components/signup/signupShared.tsx',
  'apps/frontend/src/components/ui/PhoneInput.tsx',
  'apps/frontend/src/components/ui/PhoneInputWithCountry.tsx',
  'apps/frontend/src/components/pos/posShared.tsx',
  'apps/frontend/src/components/landing/LandingCurrencies.tsx',
  'apps/frontend/src/components/settings/SectionLang.tsx',
  'apps/frontend/src/components/ui/CurrencyBadge.tsx',
  'mobile/app/(app)/(tabs)/settings.tsx',
  'apps/frontend/src/utils/countryCurrency.ts',
  'apps/backend/src/lib/country.ts',
  'apps/frontend/src/lib/defaultMarket.ts',
  'apps/backend/src/lib/defaultMarket.ts',
  'mobile/src/lib/defaultMarket.ts',
])

interface Hit { file: string; line: number; form: string; txt: string }

function defaultsIn(file: string, source?: string): Hit[] {
  const rel = relative(ROOT, file)
  const src = source ?? code(file)
  const out: Hit[] = []
  for (const { key, re } of FORMS) {
    for (const m of src.matchAll(re)) {
      const lines = src.split('\n')
      const line = src.slice(0, m.index).split('\n').length
      // Fenêtre ±3 lignes : la raison de l'exemption vit souvent au-dessus du littéral.
      const fenetre = lines.slice(Math.max(0, line - 4), line + 3).join('\n')
      if (EXEMPT_SITES.some(e => e.match.test(fenetre))) continue
      out.push({ file: rel, line, form: key, txt: m[0].trim().slice(0, 60) })
    }
  }
  return out
}

const HITS = FILES.filter(f => !EXEMPT_FILES.has(relative(ROOT, f))).flatMap(f => defaultsIn(f))

describe('couverture (un walk cassé rendrait ce test vert et vide)', () => {
  it('les trois cibles sont marchées et le corpus est large', () => {
    expect(ROOTS.length).toBe(4)
    expect(FILES.length).toBeGreaterThanOrEqual(300)
    for (const f of FILES.slice(0, 40)) expect(code(f).length).toBeGreaterThan(0)
  })
  it('les fichiers qui PORTENT le défaut sont bien dans le corpus', () => {
    const rels = new Set(FILES.map(f => relative(ROOT, f)))
    for (const f of [
      'apps/backend/src/routes/auth.ts', 'apps/backend/src/routes/tenant.ts',
      'apps/frontend/src/pages/SignupPage.tsx', 'apps/frontend/src/pages/Onboarding.tsx',
      'apps/frontend/src/pages/POS.tsx', 'mobile/src/stores/appStore.ts',
    ]) expect(rels.has(f), f).toBe(true)
  })
})

describe('aucun défaut de marché hors de la source unique', () => {
  it('zéro occurrence dans le code de production', () => {
    expect(HITS.map(h => `${h.file}:${h.line} [${h.form}] ${h.txt}`)).toEqual([])
  })
})

/**
 * ⚠️ CALIBRAGE — la forme du sabotage est COPIÉE depuis la version d'avant correction,
 * lue dans le dépôt (`git show` figé en fixture), jamais retapée. Un sabotage écrit de
 * mémoire hérite des hypothèses du détecteur et les deux tombent ensemble.
 */
describe('le scan MORD — contre-épreuve sur les formes réellement supprimées', () => {
  const AVANT = readFileSync(join(__dirname, 'fixtures', 'default-market-avant.txt'), 'utf8')

  it('la fixture est non vide et contient bien les formes d’origine', () => {
    expect(AVANT.length).toBeGreaterThan(200)
    expect(AVANT).toContain("useState('+221')")
  })

  /**
   * ⚠️ TROIS formes sur cinq ont été VUES dans le dépôt ; les deux autres (`|| 'XOF'` et
   * `DEFAULT_x = 'SN'`) sont PRÉVENTIVES. Je le dis plutôt que de fabriquer une fixture
   * qui les contiendrait : un sabotage inventé prouverait que le détecteur détecte ce
   * qu'on lui a donné, pas qu'il attrape ce qui arrive.
   */
  it('les formes OBSERVÉES sont bien exercées par la fixture', () => {
    const vues = FORMS.filter(f => { f.re.lastIndex = 0; return f.re.test(AVANT) }).map(f => f.key)
    for (const f of FORMS) f.re.lastIndex = 0
    expect(vues.sort()).toEqual(['champ de formulaire', 'repli ??', 'useState initial'])
  })

  it('les deux formes PRÉVENTIVES mordent sur leur forme canonique', () => {
    const ou = FORMS.find(f => f.key === 'repli ||')!
    const cst = FORMS.find(f => f.key === 'const nommée défaut')!
    ou.re.lastIndex = 0; cst.re.lastIndex = 0
    expect(ou.re.test("const c = raw || 'XOF'")).toBe(true)
    expect(cst.re.test("const DEFAULT_COUNTRY = 'SN'")).toBe(true)
    ou.re.lastIndex = 0; cst.re.lastIndex = 0
  })

  it('le scan trouve les 12 défauts d’avant, et zéro aujourd’hui', () => {
    const avant = defaultsIn('<fixture>', AVANT)
    expect(avant.length).toBeGreaterThanOrEqual(12)
    expect(HITS.length).toBe(0)
  })

  it('… et il n’attrape PAS un membre de liste ni un repli d’affichage', () => {
    const sain = [
      "  { iso: 'SN', name: 'Sénégal',       flag: '🇸🇳' },",
      "  const cur = tenant.currency ?? 'XOF'",
      "  currency: cfg?.currency ?? 'XOF',",
    ].join('\n')
    expect(defaultsIn('<sain>', sain)).toEqual([])
  })
})

describe('auto-exclusion : le verrou survit à son propre scan', () => {
  it('ce fichier contient bien des motifs interdits (sinon la preuve est vide)', () => {
    const self = readFileSync(__filename, 'utf8')
    expect(self).toContain("useState('+221')")
  })
  it('… et il n’appartient PAS au corpus scanné', () => {
    expect(FILES.map(f => relative(ROOT, f))).not.toContain(relative(ROOT, __filename))
  })
})

describe('le marché par défaut lui-même', () => {
  it('Cameroun / XAF / +237 — la décision du 2026-08-06', () => {
    expect(DEFAULT_MARKET).toMatchObject({ country: 'CM', currency: 'XAF', dialCode: '+237' })
  })

  it('l’indicatif se DÉRIVE du pays, il n’est pas constant', () => {
    expect(dialCodeFor('CM')).toBe('+237')
    expect(dialCodeFor('SN')).toBe('+221')   // une boutique de Dakar garde le sien
    expect(dialCodeFor('CI')).toBe('+225')
    expect(dialCodeFor('FR')).toBe('+33')
  })

  it('un pays absent ou non servi retombe sur le défaut, jamais sur un tiers', () => {
    for (const v of [null, undefined, '', 'ZZ', 'XX']) expect(dialCodeFor(v)).toBe(DEFAULT_MARKET.dialCode)
    expect(hasDialCode('ZZ')).toBe(false)
    expect(hasDialCode('CM')).toBe(true)
  })

  it('le pays du tenant PRIME sur le défaut — sinon on aurait juste déplacé le problème', () => {
    expect(dialCodeFor('SN')).not.toBe(DEFAULT_MARKET.dialCode)
  })
})

describe('limites assumées', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — Les replis d'affichage `?? 'XOF'` sont EXEMPTÉS par décision produit. Une
      //     boutique camerounaise sans devise affichera « XOF » — sans effet sur les
      //     montants (parité 1, 0 décimale, même symbole « FCFA »).
      'replis-affichage-xof-exemptes-par-decision',
      // 2 — Le verrou interdit l'ANCIEN marché en position de défaut. Il ne dirait rien
      //     d'un TROISIÈME marché écrit en dur (`?? 'CI'`) : il garde une migration, pas
      //     une propriété générale.
      'un-troisieme-marche-en-dur-ne-serait-pas-vu',
      // 3 — Les LISTES de pays restent exemptées au FICHIER (elles sont faites de
      //     littéraux) : un vrai défaut ajouté dans l'un d'eux passerait. Les autres
      //     exemptions, elles, sont par RAISON nommée sur une fenêtre de ±3 lignes.
      'listes-exemptees-au-fichier-pas-a-la-ligne',
      // 4 — Deux des cinq formes sont PRÉVENTIVES : elles n'ont jamais été vues dans le
      //     dépôt, seulement exercées sur leur forme canonique.
      'deux-formes-preventives-non-observees',
    ]
    expect(LIMITES).toHaveLength(4)
  })
})
