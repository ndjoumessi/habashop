#!/usr/bin/env node
/**
 * GARDE D'ARTEFACT MOBILE — inspecte le bundle LIVRÉ, pas la source.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * Le web a QUATRE gardes d'artefact en CI (`verify:sw-routes`, `verify:classes`,
 * `verify:demo-flag`, `verify:seo-urls`), tous nés du même constat : *la source est
 * valide, l'artefact est nul*. Le mobile n'en avait AUCUNE. Les seules mesures sur
 * son bundle ont été faites à la main le 2026-08-09 et n'étaient reproduites par
 * personne — donc périmées dès le commit suivant.
 *
 * ⚠️ CE QUE CETTE GARDE NE PEUT PAS FAIRE, et il faut le savoir avant de la lire :
 * elle ne peut PAS vérifier l'absence du mot de passe démo, contrairement à
 * `verify:demo-flag` côté web. MESURÉ : Metro n'élimine pas la branche morte comme
 * Rollup — `demo1234` est présent dans le bundle que le drapeau soit éteint ou
 * allumé. Le drapeau masque à l'exécution, il n'allège pas l'artefact. Écrire ici
 * un contrôle d'absence serait écrire un contrôle qui échoue toujours.
 *
 * ─── CE QU'ELLE GARDE ────────────────────────────────────────────────────────
 * 1. COUVERTURE — un bundle existe, il est gros, et il contient un témoin connu.
 *    Sans ça, tout ce qui suit serait vrai du vide : « aucun EXPO_PUBLIC_ ne
 *    survit » est trivialement vrai d'un fichier absent.
 * 2. SUBSTITUTION — aucun identifiant `EXPO_PUBLIC_*` ne survit dans l'artefact.
 *    Expo les inline TEXTUELLEMENT ; un accès calculé (`process.env[clef]`) n'est
 *    jamais remplacé et laisse l'identifiant en clair. La variable devient alors
 *    impossible à régler — un drapeau qui ne peut pas s'allumer, en silence.
 * 3. JOIGNABILITÉ — l'URL de l'API est dans le bundle. `EXPO_PUBLIC_API_URL` n'est
 *    posée dans AUCUN environnement EAS : tout build tourne sur le repli littéral
 *    d'`api.ts`. Si ce repli disparaissait, l'app se lancerait sans backend.
 *
 * Usage :  node scripts/verify-bundle.mjs
 * (≈ 20 s : il construit réellement le bundle Android.)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SORTIE = join(tmpdir(), `habashop-verify-bundle-${process.pid}`)

/** Témoin POSITIF : une chaîne qu'on sait présente. Si elle manque, la sonde ment. */
const TEMOIN = 'Se connecter'
/** Repli littéral de l'URL d'API — cf. `src/services/api.ts`. */
const API = 'habashop-production'

let echecs = 0
const echec = (msg) => { console.error(`❌ ${msg}`); echecs++ }
const ok = (msg) => console.log(`✅ ${msg}`)

try {
  console.log('· export du bundle Android…')
  execFileSync('npx', ['expo', 'export', '--platform', 'android', '--output-dir', SORTIE], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })

  // ── trouver le bundle ──────────────────────────────────────────────────────
  const bundles = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(hbc|js)$/.test(e)) bundles.push(p)
    }
  }
  walk(SORTIE)
  bundles.sort((a, b) => statSync(b).size - statSync(a).size)
  const bundle = bundles[0]

  // ── 1. COUVERTURE ──────────────────────────────────────────────────────────
  if (!bundle) {
    echec('aucun bundle produit — tout contrôle en aval serait vrai du vide')
  } else {
    const taille = statSync(bundle).size
    const src = readFileSync(bundle, 'latin1') // octets bruts : le .hbc est binaire
    if (taille < 1_000_000) echec(`bundle suspect de ${taille} octets (< 1 Mo)`)
    else if (!src.includes(TEMOIN)) echec(`témoin « ${TEMOIN} » absent — la sonde ne lit pas ce qu'elle croit`)
    else ok(`couverture : ${(taille / 1e6).toFixed(1)} Mo, témoin présent`)

    // ── 2. SUBSTITUTION ──────────────────────────────────────────────────────
    // ⚠️ Le .hbc concatène ses chaînes SANS séparateur : un `+` gourmand déborde sur la
    // chaîne voisine et rend un nom qui n'existe pas (mesuré : « EXPO_PUBLIC_DEMO_MODE »
    // ressorti collé à « DEFAULT_SILVER_DISCOUNT »). On borne la longueur et on DIT que le
    // nom est indicatif — un garde qui nomme un symbole inexistant envoie chercher du vent.
    const survivants = [...new Set(src.match(/EXPO_PUBLIC_[A-Z0-9_]{1,40}/g) ?? [])]
    if (survivants.length) {
      echec(
        `${survivants.length} identifiant(s) EXPO_PUBLIC_* SURVIVENT dans l'artefact.\n`
        + `   Noms INDICATIFS (possiblement collés à la chaîne suivante) : ${survivants.join(', ')}\n`
        + "   Expo inline ces variables TEXTUELLEMENT. Un identifiant qui survit signale un accès\n"
        + "   calculé (`process.env[clef]`, destructuration) que le bundler n'a pas pu remplacer :\n"
        + '   la variable est alors impossible à régler, dans TOUS les builds, sans que rien ne le dise.',
      )
    } else ok('substitution : aucun EXPO_PUBLIC_* ne survit')

    // ── 3. JOIGNABILITÉ ──────────────────────────────────────────────────────
    // ⚠️ CE CONTRÔLE A DÉJÀ PASSÉ POUR LA MAUVAISE RAISON. Il matchait un LIBELLÉ
    // d'écran — `settings.tsx` affichait l'URL en dur sous « Backend » — et non le repli
    // d'`api.ts` : retirer le repli le laissait VERT. L'écran dérive désormais l'hôte réel
    // (`apiHost()`), et le sabotage a été rejoué. ⚠️ Il reste masqué en LOCAL quand un
    // `mobile/.env` pose `EXPO_PUBLIC_API_URL` (la même chaîne est alors inlinée) ; il
    // discrimine en CI, où aucun `.env` n'existe. Limite assumée, écrite plutôt que tue.
    if (!src.includes(API)) {
      echec(
        `l'URL de l'API (« ${API} ») est ABSENTE du bundle.\n`
        + "   EXPO_PUBLIC_API_URL n'est posée dans AUCUN environnement EAS : chaque build dépend\n"
        + "   du repli littéral de src/services/api.ts. Sans lui, l'app se lance sans backend.",
      )
    } else ok('joignabilité : URL de l\'API présente')
  }
} catch (e) {
  echec(`export impossible : ${e.message?.split('\n')[0] ?? e}`)
} finally {
  rmSync(SORTIE, { recursive: true, force: true })
}

if (echecs) {
  console.error(`\n${echecs} contrôle(s) en échec sur le bundle LIVRÉ.`)
  process.exit(1)
}
console.log('\nBundle mobile conforme.')
