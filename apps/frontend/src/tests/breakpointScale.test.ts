import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * LOT 3 — L'ÉCHELLE DES POINTS DE RUPTURE EST CLOSE.
 *
 * ── Le défaut ────────────────────────────────────────────────────────────────────────
 * ONZE valeurs distinctes pour 27 requêtes : 380 · 480 · 560 · 600 · 640 · 760 · 768 ·
 * 880 · 900 · 1024 · 1200. Deux paires étaient à 8 px et 20 px l'une de l'autre — deux
 * échelles superposées, pas un choix. Un auteur qui ajoutait une règle ne pouvait pas
 * savoir laquelle employer, et chaque hésitation ajoutait une douzième valeur.
 *
 * ⚠️ Et l'inventaire ne se lit PAS dans `index.css` seul : 19 des 27 requêtes vivaient dans
 * des blocs `<style>` de composants. Un audit qui ne regarde que la feuille en compte 9 et
 * se croit exhaustif — c'est ce que le mien a fait au premier passage.
 *
 * ── Ce qui a été consolidé, et POURQUOI ces trois-là ──────────────────────────────────
 * Uniquement les paires dont l'INTENTION était identique et l'écart petit :
 *   · 760 → 768  (8 px)  « sous la tablette »
 *   · 880 → 900  (20 px) « la coquille passe en une colonne » — direction choisie vers 900
 *                        parce que 900 pilote déjà le repli de la BARRE LATÉRALE, la plus
 *                        structurante ; ramener la barre à 880 l'aurait laissée visible
 *                        dans [881,900] avec 617 px de contenu utile.
 *   · 600 → 560  (40 px) taille de titre uniquement, aucun changement de mise en page.
 * 380 / 480 / 640 / 1024 / 1200 sont CONSERVÉS : les rapprocher demandait des décalages de
 * 40 à 100 px sur de vraies mises en page, que rien ne justifiait.
 *
 * ⚠️ AUCUNE migration vers une échelle « propre » 640/768/1024. Y amener le repli de la
 * barre latérale (900) aurait été un changement de comportement de 124 ou 132 px que je ne
 * pouvais pas valider. Le défaut réparé est l'AMBIGUÏTÉ, pas le nombre de marches : c'est
 * ce fichier qui la ferme, en refusant toute valeur hors liste.
 *
 * ── Ce qui a été SUPPRIMÉ, et prouvé mort ─────────────────────────────────────────────
 * `index.css` portait un `@media (max-width:880px)` sur `.login-grid` / `.login-brand`,
 * entièrement OCCULTÉ par le bloc de `LoginPage.tsx` : mêmes déclarations, spécificité
 * supérieure (`body .login-grid`), seuil plus large (900 > 880). MESURÉ dans un vrai
 * moteur sur 246 largeurs de 320 à 1300 px : ZÉRO différence sur `/login` après
 * suppression. Ce n'était pas un point de rupture, c'était un reliquat.
 *
 * ⚠️ MÉTHODE — le relevé avant/après a produit DEUX faux positifs, tous deux de ma sonde :
 *   · `topbar-btn.padding` variait de 14.32 px à 14.13 px — une valeur INTERMÉDIAIRE de
 *     `transition: all .15s`, lue juste après le redimensionnement. Le banc mesurait sa
 *     propre latence. Corrigé en neutralisant les animations.
 *   · `.login-grid` semblait changer sur landing et signup — mon banc y injectait des
 *     classes qui n'existent que dans `LoginPage.tsx` (vérifié : 1 seul fichier les porte,
 *     contre 12 pour `.page-title`).
 * Une sonde qui ne se met pas elle-même en cause invente des régressions.
 */

const SRC = join(__dirname, '..')

/**
 * ÉCHELLE CLOSE. Chaque marche porte sa raison — une valeur sans raison est une valeur que
 * le prochain auteur dupliquera à 8 px près.
 */
const ECHELLE: Record<number, string> = {
  380:  'très petit téléphone — grilles de démo/CTA qui ne tiennent plus à 2 colonnes',
  480:  'téléphone — KPI en 1 colonne, bouton de barre resserré',
  560:  'grand téléphone — titres réduits, sélecteur de dates et lignes d’abonnement empilés',
  640:  'tailwind `sm` — implémente les utilitaires .sm\\:grid-cols-*, et la nav publique',
  768:  'tailwind `md` — sous la tablette : tiroir de barre latérale, grilles en 1 colonne',
  900:  'la coquille passe en une colonne — barre latérale, modales, héros, formulaires 2 volets',
  1024: 'tailwind `lg` — utilitaires .lg\\:grid-cols-* de la grille responsive maison',
  1200: 'grand écran — catalogue public en 4 colonnes',
}

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersTsx(p, acc) }
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/** Toutes les sources CSS LIVRÉES : les feuilles ET les blocs `<style>` des composants. */
function sourcesCss(): { nom: string; css: string }[] {
  const out = [
    { nom: 'index.css', css: readFileSync(join(SRC, 'index.css'), 'utf8') },
    { nom: 'styles/public.css', css: readFileSync(join(SRC, 'styles', 'public.css'), 'utf8') },
  ]
  for (const f of fichiersTsx(SRC)) {
    const t = readFileSync(f, 'utf8')
    for (const m of t.matchAll(/<style[^>]*>\{?`([\s\S]*?)`\}?<\/style>/g)) {
      out.push({ nom: f.replace(SRC, 'src'), css: m[1] })
    }
  }
  return out
}

const SOURCES = sourcesCss()
const REQUETES = SOURCES.flatMap(({ nom, css }) =>
  [...css.matchAll(/@media\s*\((max|min)-width:\s*(\d+)px\)/g)]
    .map(m => ({ nom, sens: m[1], px: Number(m[2]) })))

describe('points de rupture — une échelle close, et elle couvre TOUTES les sources', () => {
  it('COUVERTURE — le balayage lit les feuilles ET les blocs <style>', () => {
    // ⚠️ Sans la seconde source, ce verrou garderait 8 requêtes sur 26 en se croyant complet :
    // c'est exactement l'erreur de l'audit initial.
    expect(SOURCES.length).toBeGreaterThan(6)
    expect(SOURCES.some(s => s.nom.endsWith('index.css'))).toBe(true)
    expect(SOURCES.some(s => s.nom.includes('landing'))).toBe(true)
    expect(REQUETES.length).toBeGreaterThan(20)
  })

  it('aucune requête en largeur hors de l’échelle', () => {
    const hors = REQUETES
      .filter(r => !(r.px in ECHELLE))
      .map(r => `${r.nom} → ${r.sens}-width:${r.px}px`)
    expect(hors).toEqual([])
  })

  it('⚠️ aucune paire de marches à moins de 60 px — c’était le défaut d’origine', () => {
    // 760/768 (8 px) et 880/900 (20 px) coexistaient. Le seuil n'est pas une esthétique :
    // en dessous, deux marches ne se distinguent plus à l'usage et l'une devient un doublon
    // de l'autre. 560→640 fait 80, 380→480 fait 100 : la contrainte tient avec de la marge.
    const v = Object.keys(ECHELLE).map(Number).sort((a, b) => a - b)
    const trop = v.slice(1).map((x, i) => ({ a: v[i], b: x, d: x - v[i] })).filter(p => p.d < 60)
    expect(trop).toEqual([])
  })

  it('chaque marche de l’échelle est RÉELLEMENT employée', () => {
    // Une marche déclarée que personne n'utilise est une invitation à s'en servir au hasard.
    const utilisees = new Set(REQUETES.map(r => r.px))
    const orphelines = Object.keys(ECHELLE).map(Number).filter(px => !utilisees.has(px))
    expect(orphelines).toEqual([])
  })

  it('chaque marche porte une raison NON VIDE', () => {
    const muettes = Object.entries(ECHELLE).filter(([, r]) => r.trim().length < 20).map(([px]) => px)
    expect(muettes).toEqual([])
  })

  it('DISCRIMINANT — l’échelle refuse bien une valeur voisine', () => {
    // Sans ce cas, une échelle qui contiendrait toutes les valeurs possibles passerait les
    // tests ci-dessus en n'interdisant rien.
    for (const px of [760, 880, 600, 375, 1440]) expect(px in ECHELLE).toBe(false)
  })

  it('le reliquat `.login-grid` d’index.css n’est pas revenu', () => {
    // Il était OCCULTÉ par le bloc de LoginPage (spécificité `body .login-grid`, seuil 900).
    // Mesuré : 0 différence sur 246 largeurs après suppression. Le remettre reconstituerait
    // un point de rupture fantôme que rien ne signalerait.
    const index = SOURCES.find(s => s.nom.endsWith('index.css'))!.css
    expect(/\.login-grid|\.login-brand/.test(index)).toBe(false)
    // DISCRIMINANT : ces classes DOIVENT continuer d'exister dans LoginPage, sinon on aurait
    // supprimé la mise en page au lieu du doublon.
    const login = SOURCES.filter(s => s.nom.includes('LoginPage')).map(s => s.css).join('')
    expect(/\.login-grid/.test(login)).toBe(true)
  })
})
