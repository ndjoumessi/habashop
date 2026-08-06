import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  jetonsDeClasse, codeSeul, estDefini, fichiersAtteignables, fichiersDeProduction, poigneesE2E,
} from '../../scripts/classAudit.mjs'

/**
 * VERROU — la LOGIQUE de `verify:classes`.
 *
 * ─── PARTAGE DES RÔLES, ET POURQUOI ──────────────────────────────────────────
 * La vérification qui compte porte sur l'ARTEFACT : `npm run verify:classes` lit le `dist/`
 * livré. Elle NE PEUT PAS vivre ici — la CI lance `vitest` AVANT `build`, donc `dist/`
 * n'existe pas encore au moment où ce fichier s'exécute. C'est le même partage que pour le
 * service worker : `verify:sw-routes` juge le `sw.js` livré, la suite juge la règle.
 *
 * Ce fichier garde donc le MOTEUR : périmètre dérivé, extraction, appariement — et surtout
 * il REJOUE l'état d'avant le chantier pour prouver que la règle rougit sur les défauts qui
 * l'ont motivée. Les entrées de ce rejeu sont des fixtures EXTRAITES par `git show`
 * (`fixtures/classes-avant.css`, `fixtures/classes-avant.jsx.txt`), jamais retapées : un
 * sabotage écrit de mémoire hérite des hypothèses du détecteur, et les deux tombent ensemble.
 *
 * ⚠️ Et il ne peut pas lire `git show HEAD:…` à l'exécution : une fois ce chantier commité,
 * HEAD porterait le code CORRIGÉ et le rejeu deviendrait vert pour la mauvaise raison.
 *
 * ─── LE DÉFAUT GARDÉ ─────────────────────────────────────────────────────────
 * Tailwind est configuré dans ce dépôt mais n'émet RIEN (`index.css` ne porte aucune
 * directive `@tailwind`). Toute classe utilitaire écrite dans un `className` est donc MORTE
 * tant qu'elle n'est pas écrite à la main. Ni tsc, ni la suite, ni la revue ne le voient :
 * la source est valide, c'est l'artefact qui est nul.
 *
 * ─── LIMITES CONNUES ─────────────────────────────────────────────────────────
 * Elles sont détaillées dans `scripts/classAudit.mjs` et exercées plus bas. En résumé, ce
 * verrou NE VOIT PAS : (1) les jetons construits à l'exécution (105 `className=` dynamiques
 * mesurés), (2) les classes stockées hors d'un `className=` puis passées plus loin,
 * (3) un `className` reçu en prop, (4) rien de ce qui vit hors du graphe depuis `main.tsx`.
 */

const SRC = join(__dirname, '..')
const RACINE = join(SRC, '..')
const FIX = join(__dirname, 'fixtures')

/** Feuille `index.css` d'avant le chantier. */
const cssAvant = readFileSync(join(FIX, 'classes-avant.css'), 'utf8')
/** Blocs `<style>{`…`}</style>` d'avant le chantier — ils partent dans le BUNDLE JS. */
const styleAvant = readFileSync(join(FIX, 'classes-avant.styleblocks.txt'), 'utf8')
/** Lignes de PRODUCTION d'avant portant les jetons fautifs. */
const jsxAvant = readFileSync(join(FIX, 'classes-avant.jsx.txt'), 'utf8')

/** Le corpus tel que le verrou le lit : feuille + styles embarqués. */
const corpusAvant = cssAvant + '\n' + styleAvant

/* ══════════════════════════════════════════════════════════════════════════════
   1. LE CAS DÉCLENCHEUR — la règle DOIT rougir sur l'état d'avant
   ══════════════════════════════════════════════════════════════════════════════ */
describe('rejeu de l’état d’avant le chantier', () => {
  it('COUVERTURE — les fixtures portent bien du code, pas des fichiers vides', () => {
    // Angle mort n°1 : une fixture tronquée rendrait tous les cas ci-dessous verts.
    expect(cssAvant.length).toBeGreaterThan(30_000)
    expect(styleAvant.length).toBeGreaterThan(1_000)
    expect(jsxAvant.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(15)
    expect(jsxAvant).toContain('className')
  })

  it('les 17 utilitaires écrits ce jour-là étaient ABSENTS de la feuille d’avant', () => {
    const ecrits = [
      'mb-1', 'mb-1.5', 'mb-2', 'mb-5', 'mt-1', 'mt-2', 'mt-4', 'mt-5', 'ml-auto',
      'py-4', 'items-start', 'space-y-1', 'space-y-4', 'transition-all',
      'cursor-pointer', 'animate-spin', 'form-label',
    ]
    const definisAvant = ecrits.filter(t => estDefini(t, cssAvant))
    expect(definisAvant, [
      'Ces jetons sont censés avoir été ABSENTS avant le chantier — s’ils remontent comme',
      'définis, c’est `estDefini` qui est trop laxiste, pas la feuille qui était complète.',
    ].join('\n')).toEqual([])
  })

  it('les deux classes mal NOMMÉES étaient absentes, leur vraie classe présente', () => {
    // `badge-ok` ne rendait rien : le « ✓ Payé » sortait en badge neutre à côté d’un
    // « Remboursé » rouge. `btn-secondary` non plus — et `cursor:pointer` vient de `.btn`.
    expect(estDefini('badge-ok', cssAvant)).toBe(false)
    expect(estDefini('btn-secondary', cssAvant)).toBe(false)
    expect(estDefini('badge-green', cssAvant)).toBe(true)
    expect(estDefini('btn-ghost', cssAvant)).toBe(true)
  })

  it('les trois POIGNÉES mortes étaient absentes, leur voisine de `index.css` présente', () => {
    // Une classe morte à côté d’un style inline complet se relit comme un style qui manque :
    // c’est ce qui a fait croire à un message de connexion non stylé (il l’était, inline —
    // vérifié sur le rendu réel, seul l’attribut `class` changeait).
    expect(estDefini('login-error', corpusAvant)).toBe(false)
    expect(estDefini('lp-btn-ghost', corpusAvant)).toBe(false)
    expect(estDefini('dashboard-chart-wide', corpusAvant)).toBe(false)
    expect(estDefini('dashboard-charts-grid', cssAvant)).toBe(true) // 2fr 1fr, réelle
  })

  it('LE CORPUS DOIT INCLURE LE JS — une classe peut n’exister que dans un `<style>`', () => {
    // ⚠️ La leçon qui a divisé le chiffre de l’audit par deux. `lp-nav-login` (masquage du
    // lien Connexion sous 640px) est ABSENTE d’`index.css` : elle vit dans le `<style>` de
    // `LandingNav.tsx`, compilé dans le BUNDLE JS et injecté à l’exécution. Idem `login-spin`
    // et les classes `sub-*`. En lisant les seuls `dist/assets/*.css`, l’audit comptait 89
    // jetons absents ; corpus élargi au JS livré, il en restait 44. Un corpus trop étroit rend
    // un chiffre faux avec l’air d’un fait.
    for (const j of ['lp-nav-login', 'login-spin', 'sub-line']) {
      expect(estDefini(j, cssAvant), `« ${j} » n’a rien à faire dans index.css`).toBe(false)
      expect(estDefini(j, corpusAvant), `« ${j} » doit être vu dès qu’on lit aussi le JS`).toBe(true)
    }
  })

  it('l’extraction retrouve ces jetons dans les lignes de PRODUCTION d’avant', () => {
    const t = jetonsDeClasse(jsxAvant)
    for (const j of ['mb-5', 'badge-ok', 'btn-secondary', 'form-label', 'cursor-pointer',
      'animate-spin', 'login-error', 'lp-btn-ghost', 'dashboard-chart-wide']) {
      expect(t.has(j), `« ${j} » n’est pas extrait des lignes de production d’avant`).toBe(true)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   2. LES ANGLES MORTS, exercés un par un — chacun a coûté un faux résultat
   ══════════════════════════════════════════════════════════════════════════════ */
describe('les parades des angles morts tiennent', () => {
  it('un OPÉRANDE DE COMPARAISON n’est pas une classe', () => {
    // `ReportsTabs.tsx` : `className={…s.mode === 'Mobile' ? …}`. Sans cette parade,
    // « Mobile » et « TRANSIT » remontaient comme deux classes manquantes.
    const t = jetonsDeClasse("<i className={`badge ${m === 'Mobile' ? 'badge-violet' : 'badge-blue'}`} />")
    expect(t.has('Mobile')).toBe(false)
    expect(t.has('badge')).toBe(true)
    expect(t.has('badge-violet')).toBe(true)   // les vraies classes restent vues
  })

  it('une INTERPOLATION de gabarit n’est pas une classe', () => {
    // Le `${` en fin de ligne faisait passer `o.status` pour un jeton (2 faux positifs).
    const t = jetonsDeClasse("<i className={`badge ${\n  o.status === 'REÇUE' ? 'badge-green' : 'badge-red'\n}`} />")
    expect(t.has('o.status')).toBe(false)
    expect(t.has('badge-green')).toBe(true)
  })

  it('un EXEMPLE en commentaire n’est pas du code', () => {
    // `skeleton.tsx` documente son usage par `<Skeleton className="h-4 w-20" />` en JSDoc :
    // le scan remontait `h-4` et `w-20` comme manquants. Un scanner qui lit les commentaires
    // accuse du code qui n’existe pas — et interdit d’expliquer ce qu’il interdit.
    expect(jetonsDeClasse('/** <X className="h-4 w-20" /> */\n<Y className="panel" />').has('h-4')).toBe(false)
    expect(jetonsDeClasse('// <X className="h-4" />\n<Y className="panel" />').has('h-4')).toBe(false)
    expect(codeSeul('a /* b */ c')).not.toContain('b')
  })

  it('un caractère ÉCHAPPÉ dans le sélecteur compte comme défini', () => {
    // En CSS, `lg:grid-cols-4` s’écrit `.lg\:grid-cols-4` et `mb-1.5` s’écrit `.mb-1\.5`.
    // Une première version n’échappait que le point : les 4 variantes responsives, pourtant
    // écrites à la main et bien livrées, remontaient comme manquantes sur 12 sites.
    expect(estDefini('lg:grid-cols-4', '@media(x){.lg\\:grid-cols-4 { grid-template-columns:repeat(4,1fr) }}')).toBe(true)
    expect(estDefini('mb-1.5', '.mb-1\\.5 { margin-bottom:6px }')).toBe(true)
  })

  it('une simple MENTION du jeton ne vaut pas une définition', () => {
    // Sans l’exigence d’une accolade ouvrante, `className="mb-5"` dans le bundle JS suffirait
    // à se déclarer défini — le verrou se prouverait lui-même.
    expect(estDefini('mb-5', 'const c = "mb-5"; el.mb-5')).toBe(false)
    expect(estDefini('mb-5', '.mb-5 { margin-bottom:20px }')).toBe(true)
  })

  it('un préfixe n’est pas le jeton — `mb-1` ne définit pas `mb-1.5`', () => {
    expect(estDefini('mb-1.5', '.mb-1 { margin-bottom:4px }')).toBe(false)
    expect(estDefini('badge', '.badge-green { color:red }')).toBe(false)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   3. LE PÉRIMÈTRE — dérivé, et il exclut le code mort
   ══════════════════════════════════════════════════════════════════════════════ */
describe('périmètre dérivé du graphe depuis main.tsx', () => {
  const atteignables = fichiersAtteignables(SRC, join(SRC, 'main.tsx'))
  const production = fichiersDeProduction(SRC)

  it('COUVERTURE — la marche lit réellement l’arborescence', () => {
    // Angle mort n°1 : un `walk()` cassé rend une liste vide, donc un vert qui ne garde rien.
    // Angle mort n°2 : le périmètre est DÉRIVÉ (graphe d’imports), jamais une liste écrite.
    expect(atteignables.length).toBeGreaterThan(150)
    expect(production.length).toBeGreaterThan(200)
    expect(atteignables.length).toBeLessThanOrEqual(production.length + 40) // + lib/, hooks/…
  })

  it('les écrans réels sont atteints', () => {
    const a = atteignables.join('\n')
    for (const f of ['pages/LoginPage.tsx', 'pages/POS.tsx', 'pages/AdminDashboard.tsx',
      'components/ui/skeleton.tsx', 'index.css'.replace('index.css', 'stores/appStore.ts')]) {
      expect(a, `« ${f} » devrait être atteignable`).toContain(f)
    }
  })

  it('le CODE MORT reste HORS périmètre — sinon le verrou crie au loup', () => {
    // 18 modules shadcn jamais importés portaient à eux seuls 253 jetons absents. Les faire
    // rougir aurait fait désarmer le verrou. Ils sont supprimés ; la règle qui les excluait
    // doit rester vraie pour le prochain fichier orphelin.
    const orphelin = join(SRC, 'components/ui/__inexistant.tsx')
    expect(atteignables).not.toContain(orphelin)
  })

  it('les POIGNÉES E2E sont dérivées des specs, jamais listées à la main', () => {
    // `.modal-box.sub-modal` et `.sub-body` sont des sélecteurs Playwright : les définir en
    // CSS inventerait une règle, les retirer casserait les captures.
    const p = poigneesE2E(join(RACINE, 'e2e'))
    expect(p.size).toBeGreaterThan(20)          // couverture : le scan lit bien les specs
    expect(p.has('sub-modal')).toBe(true)
    expect(p.has('sub-body')).toBe(true)
  })
})
