import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { appUrl, appUrlHost, normalizeAppUrl, DEFAULT_APP_URL } from '@/lib/appUrl'

// ⚠️ URL PUBLIQUE DE L'APP WEB — SOURCE UNIQUE côté MOBILE (#156).
//
// Jumeau des méta-tests `appUrlSource.test.ts` (backend) et `appUrlStatic.test.ts` (front).
// Trois occurrences vivaient en dur ici, dont DEUX imprimées sur des artefacts qui partent
// chez le CLIENT (pied du ticket d'impression, ticket WhatsApp) : sur un domaine propre,
// elles auraient annoncé l'ancien hôte à des gens sans moyen de deviner le nouveau.
//
// ⚠️ Ce fichier scanne `src/` ET `app/`. Le méta-test `versionSource.test.ts` ne couvre que
// `src/` — or l'un des trois sites vivait dans `app/(app)/(tabs)/settings.tsx`. Un scan qui
// s'arrête à `src/` laisserait rentrer la régression par la porte d'à côté.

const MOBILE = join(__dirname, '..', '..')
const LITERAL = /habashop\.vercel\.app/

describe('appUrl — la normalisation', () => {
  it('absente, vide ou blanche → repli sur l’URL servant l’app (comportement inchangé)', () => {
    for (const v of [undefined, null, '', '   ']) {
      expect(normalizeAppUrl(v)).toBe(DEFAULT_APP_URL)
    }
  })

  it('valeur posée → tout suit', () => {
    expect(normalizeAppUrl('https://app.habashop.com')).toBe('https://app.habashop.com')
  })

  it('barre oblique finale retirée — jamais de « //privacy » sur un ticket', () => {
    expect(normalizeAppUrl('https://app.habashop.com///')).toBe('https://app.habashop.com')
  })

  it('l’hôte imprimé est SANS protocole — c’est ce qu’un client lit sur un ticket', () => {
    expect(appUrlHost()).toBe(appUrl().replace(/^https?:\/\//, ''))
    expect(appUrlHost()).not.toMatch(/^https?:/)
  })

  it('sans EXPO_PUBLIC_APP_URL posée, l’app rend exactement l’ancien littéral', () => {
    // Neutralité : tant que la variable n'est pas posée dans l'environnement EAS, les tickets
    // impriment ce qu'ils imprimaient hier. La centralisation ne change rien aujourd'hui ;
    // elle rend le changement POSSIBLE demain, en un seul endroit.
    expect(appUrl()).toBe('https://habashop.vercel.app')
    expect(appUrlHost()).toBe('habashop.vercel.app')
  })
})

// ── LE VERROU ───────────────────────────────────────────────────────────────────
function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out.push(...walk(p))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

describe('méta-test — l’URL ne se recopie plus en dur dans le code mobile', () => {
  const fichiers = [...walk(join(MOBILE, 'src')), ...walk(join(MOBILE, 'app'))]
    // Le module de source unique porte légitimement le défaut : c'est SA raison d'être.
    .filter(f => !f.endsWith(join('src', 'lib', 'appUrl.ts')))

  it('le scan couvre bien src/ ET app/ (un walk cassé rendrait une liste vide, verte pour rien)', () => {
    expect(fichiers.length).toBeGreaterThan(50)
    expect(fichiers.some(f => f.endsWith(join('services', 'printReceipt.ts')))).toBe(true)
    expect(fichiers.some(f => f.endsWith(join('services', 'whatsappTicket.ts')))).toBe(true)
    // La porte d'à côté : sans cette assertion, un scan limité à src/ passerait au vert.
    expect(fichiers.some(f => f.endsWith('settings.tsx'))).toBe(true)
  })

  it('aucun littéral d’URL dans src/ ni app/', () => {
    const fautifs = fichiers
      .filter(f => LITERAL.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(MOBILE, '.'))
    expect(fautifs).toEqual([])
  })

  it('le défaut mobile coïncide avec celui des autres plateformes (une valeur, pas trois)', () => {
    // Backend `lib/appUrl.ts`, front `scripts/gen-seo.mjs` + `src/lib/appUrl.ts`, et ici :
    // quatre lectures, parce que quatre environnements d'exécution. Une seule valeur.
    const front = readFileSync(join(MOBILE, '..', 'apps', 'frontend', 'src', 'lib', 'appUrl.ts'), 'utf8')
    const back = readFileSync(join(MOBILE, '..', 'apps', 'backend', 'src', 'lib', 'appUrl.ts'), 'utf8')
    for (const src of [front, back]) {
      const m = src.match(/DEFAULT_APP_URL = '([^']+)'/)
      expect(m).not.toBeNull()
      expect(m![1]).toBe(DEFAULT_APP_URL)
    }
  })
})
