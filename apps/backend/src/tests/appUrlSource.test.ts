import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { appUrl, appBaseUrl, appHost, DEFAULT_APP_URL } from '../lib/appUrl'

// ⚠️ URL DE L'APP — SOURCE UNIQUE (`lib/appUrl.ts`, adossée à `FRONTEND_URL`).
//
// Le littéral vivait à 17 endroits : logo et pied de page de chaque e-mail transactionnel,
// liens login/upgrade/stock/dashboard, redirections de paiement Campay et PayDunya. Le jour
// d'un domaine propre, il aurait fallu tous les retrouver — et les oubliés auraient continué
// d'envoyer les commerçants vers l'ancien hôte, depuis des e-mails DÉJÀ PARTIS.
//
// Même famille de garde que le méta-test « version littérale » et que celui des codes-barres :
// ce n'est pas le comportement d'aujourd'hui qu'on protège, c'est la RÉAPPARITION silencieuse
// de la dette. Sans lui, le prochain e-mail ajouté recopiera l'URL et personne ne le verra.

describe('appUrl — la lecture', () => {
  const ORIG = process.env.FRONTEND_URL
  beforeEach(() => { delete process.env.FRONTEND_URL })
  afterEach(() => { if (ORIG === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = ORIG })

  it('sans env → repli sur l’URL servant l’app aujourd’hui (additif, comportement inchangé)', () => {
    expect(appBaseUrl()).toBe(DEFAULT_APP_URL)
    expect(appUrl('/login')).toBe(`${DEFAULT_APP_URL}/login`)
  })

  it('avec env → tout suit, sans redéploiement du code', () => {
    process.env.FRONTEND_URL = 'https://app.habashop.com'
    expect(appBaseUrl()).toBe('https://app.habashop.com')
    expect(appUrl('/app/upgrade')).toBe('https://app.habashop.com/app/upgrade')
    expect(appHost()).toBe('app.habashop.com')
  })

  it('lit l’env À L’APPEL, pas au chargement du module', () => {
    // Figer la valeur à l'import rendrait la variable inopérante sans redéploiement, et
    // surtout intestable : c'est la convention des plafonds de la garde de dépense.
    process.env.FRONTEND_URL = 'https://un.example'
    expect(appBaseUrl()).toBe('https://un.example')
    process.env.FRONTEND_URL = 'https://deux.example'
    expect(appBaseUrl()).toBe('https://deux.example')
  })

  it('barre oblique finale normalisée — jamais de « //login » dans un e-mail', () => {
    process.env.FRONTEND_URL = 'https://app.habashop.com///'
    expect(appUrl('/login')).toBe('https://app.habashop.com/login')
    expect(appUrl('login')).toBe('https://app.habashop.com/login')
  })

  it('env VIDE traitée comme absente — un lien sans hôte est mort dans un e-mail', () => {
    // `FRONTEND_URL=` dans un .env ne doit pas produire "/login" : un client de messagerie
    // n'a aucune origine à laquelle rattacher un chemin relatif.
    for (const v of ['', '   ']) {
      process.env.FRONTEND_URL = v
      expect(appBaseUrl()).toBe(DEFAULT_APP_URL)
    }
  })
})

// ── LE VERROU ───────────────────────────────────────────────────────────────────
const ROOTS = ['src/services', 'src/routes']
/**
 * Matche la forme URL — `https://habashop.vercel.app`, ou le domaine employé comme lien
 * (`href="habashop.vercel.app"`, `//habashop.vercel.app`). ⚠️ NE DOIT PAS matcher
 * `test@habashop.vercel.app` (adresse e-mail FACTICE d'`admin.ts`, pas une URL) : un verrou
 * qui crie au loup sur une non-violation se fait désarmer, et c'est ainsi qu'on les perd.
 */
const URL_LITERAL = /(?<!@)\bhttps?:\/\/habashop\.vercel\.app|(?<![@\w.])habashop\.vercel\.app\/(?!\s)/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('méta-test — l’URL de l’app ne se recopie plus en dur', () => {
  const fichiers = ROOTS.flatMap(r => walk(r))

  it('aucun littéral d’URL dans src/services ni src/routes', () => {
    const fautifs: string[] = []
    for (const f of fichiers) {
      readFileSync(f, 'utf-8').split('\n').forEach((ligne, i) => {
        if (URL_LITERAL.test(ligne)) fautifs.push(`${f}:${i + 1}  ${ligne.trim().slice(0, 100)}`)
      })
    }
    expect(fautifs, `URL codée en dur — passer par lib/appUrl (appUrl/appBaseUrl/appHost) :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('l’adresse e-mail FACTICE d’admin.ts n’est PAS un faux positif', () => {
    // Contre-preuve : le motif doit rester muet sur une adresse, sinon le verrou serait
    // désarmé au premier signalement injustifié.
    expect(URL_LITERAL.test("      to: 'test@habashop.vercel.app',")).toBe(false)
    // …et bruyant sur les vraies formes.
    expect(URL_LITERAL.test("const u = 'https://habashop.vercel.app/login'")).toBe(true)
    expect(URL_LITERAL.test('<a href="https://habashop.vercel.app">')).toBe(true)
    expect(URL_LITERAL.test("img src='https://habashop.vercel.app/pwa-192x192.png'")).toBe(true)
  })

  it('le scan couvre bien les fichiers attendus (un scan vide passerait au vert pour rien)', () => {
    expect(fichiers.length).toBeGreaterThan(20)
    expect(fichiers.some(f => f.includes('email.ts'))).toBe(true)
    expect(fichiers.some(f => f.includes('campay.ts'))).toBe(true)
  })
})
