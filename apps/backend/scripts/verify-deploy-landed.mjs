#!/usr/bin/env node
/**
 * LE DÉPLOIEMENT A-T-IL RÉELLEMENT ATTERRI ?
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * MESURÉ le 2026-08-11 : le déploiement Railway du commit `513f1619` a ÉCHOUÉ, et
 * personne n'en a rien su. Nelson l'a vu en ouvrant la console par hasard. Sur les
 * deux mois précédents, **DIX déploiements ont échoué** de la même façon — aucun
 * n'a déclenché le moindre signal.
 *
 * C'est `notify-failure` sortant en `exit 0`, transposé au déploiement : la
 * production s'en est toujours remise (l'ancien conteneur reste servi), donc rien
 * ne casse — et c'est précisément ce qui rend le silence coûteux. Le jour où un
 * correctif urgent n'atterrit pas, on le croira déployé.
 *
 * ─── POURQUOI PAS `smoke:version` ────────────────────────────────────────────
 * ⚠️ `smoke-deployed-version.mjs` compare la VERSION. Il reste donc VERT quand le
 * déploiement n'a pas eu lieu et que la version n'a pas bougé — c'est écrit dans
 * `CLAUDE.md`, et c'est arrivé deux fois. Or un commit qui ne touche qu'un test ne
 * bump rien : c'est exactement le cas du 2026-08-11.
 *
 * ─── LA PREUVE UTILISÉE ──────────────────────────────────────────────────────
 * L'instant de DÉMARRAGE du conteneur : `boot = serverTime − uptime`.
 *
 * ⚠️ LES DEUX VALEURS VIENNENT DU SERVEUR, donc `boot` est calculé entièrement sur
 * l'horloge serveur — l'horloge du runner CI n'entre jamais dans la comparaison, et
 * aucune dérive d'horloge ne peut fausser le verdict. On capture d'abord un
 * `serverTime` de référence (T0), puis on attend un `boot` POSTÉRIEUR à T0.
 * (`serverTime` s'appelait `buildTime` jusqu'à ce matin, et ne portait pas un temps
 * de build : c'est en le renommant qu'il est devenu utilisable pour ceci.)
 *
 * Usage :  node scripts/verify-deploy-landed.mjs
 *   DEPLOY_BASE      URL de l'API           (défaut : la prod)
 *   DEPLOY_TIMEOUT_S fenêtre d'attente en s (défaut : 720, soit 12 min)
 */
/**
 * LA DÉCISION, PURE ET EXPORTÉE — un nouveau conteneur sert-il ?
 *
 * ⚠️ Extraite pour être exerçable SANS provoquer un vrai déploiement. Sans elle, ce
 * garde ne serait vérifiable que dans un sens (l'échec), et un garde qu'on n'a pas vu
 * réussir pour la bonne raison ne garde rien. Même découpage que
 * `normalizeAppUrl` / `appUrl()` ou `resolveDemoMode` / `demoModeEnabled()`.
 *
 * ⚠️ `serverTime` ET `uptime` viennent tous deux du SERVEUR : `boot` est donc calculé
 * sur une seule horloge, et l'horloge du runner CI n'entre jamais dans la comparaison.
 */
export function aAtterri(t0Ms, serverTimeMs, uptimeS) {
  if (![t0Ms, serverTimeMs, uptimeS].every(Number.isFinite)) return false
  if (uptimeS < 0) return false
  return serverTimeMs - uptimeS * 1000 > t0Ms
}

const BASE = process.env.DEPLOY_BASE || 'https://habashop-production.up.railway.app'
const FENETRE_S = Number(process.env.DEPLOY_TIMEOUT_S || 720)
const INTERVALLE_MS = 15_000

/**
 * ⚠️ FENÊTRE GÉNÉREUSE, ET C'EST DÉLIBÉRÉ. Un déploiement réussi prend ~60 s
 * (mesuré : 18:12:36 → 18:13:36). Douze minutes laissent douze fois la marge. Un
 * garde qui rougit sur une lenteur normale se fait désarmer, et on perdrait
 * justement l'alarme qu'on installe.
 */

const sortie = (code, msg) => { console[code ? 'error' : 'log'](msg); process.exit(code) }

async function sante() {
  const res = await fetch(`${BASE}/api/health-extended`, { headers: { 'user-agent': 'verify-deploy-landed' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const b = await res.json()
  if (typeof b.uptime !== 'number' || !b.serverTime) {
    // ⚠️ Un garde qui ne peut pas échouer n'est pas un garde : si le contrat de la
    // réponse change, on ÉCHOUE bruyamment plutôt que de conclure au vert.
    throw new Error(`réponse inattendue : uptime=${b.uptime} serverTime=${b.serverTime}`)
  }
  return { version: b.version, uptime: b.uptime, serverTime: Date.parse(b.serverTime), status: b.status }
}

// ⚠️ Le corps ne s'exécute QUE si le fichier est lancé directement : un test qui
// l'importe pour exercer `aAtterri` ne doit pas déclencher douze minutes de sondage.
const { pathToFileURL } = await import('node:url')
if (import.meta.url !== pathToFileURL(process.argv[1] ?? '').href) {
  // importé comme module — on n'exécute rien.
} else {

// ── T0 : instant de référence, LU SUR LE SERVEUR ─────────────────────────────
let t0
try {
  const s = await sante()
  t0 = s.serverTime
  console.log(`· référence serveur T0 = ${new Date(t0).toISOString()} (version ${s.version}, uptime ${s.uptime} s)`)
} catch (e) {
  sortie(1, `❌ L'API est injoignable AVANT même d'attendre le déploiement : ${e.message}\n`
           + `   ${BASE}/api/health-extended\n`
           + `   Ce n'est pas un problème de déploiement — la production est DÉJÀ inaccessible.`)
}

// ── attente d'un conteneur démarré APRÈS T0 ──────────────────────────────────
const limite = Date.now() + FENETRE_S * 1000
let dernier = null
while (Date.now() < limite) {
  await new Promise(r => setTimeout(r, INTERVALLE_MS))
  try {
    const s = await sante()
    const boot = s.serverTime - s.uptime * 1000
    dernier = s
    const reste = Math.round((limite - Date.now()) / 1000)
    console.log(`· boot=${new Date(boot).toISOString()} uptime=${s.uptime}s version=${s.version} (reste ${reste} s)`)
    if (aAtterri(t0, s.serverTime, s.uptime)) {
      // ⚠️ La version n'est vérifiée QU'UNE FOIS le nouveau conteneur en place —
      // sinon on lirait celle de l'ancien et on conclurait juste par accident.
      console.log(`\n✅ Déploiement ATTERRI — conteneur démarré à ${new Date(boot).toISOString()}, postérieur à T0.`)
      console.log(`   version servie : ${s.version} · état : ${s.status}`)
      if (s.status !== 'ok') {
        sortie(1, `❌ Le conteneur est neuf mais son état est « ${s.status} » (base de données ?).`)
      }
      process.exit(0)
    }
  } catch (e) {
    // Une coupure PENDANT la bascule est normale : on continue jusqu'à la limite.
    console.log(`· indisponible (${e.message}) — la bascule est en cours, on continue`)
  }
}

// ── échec : dire QUOI faire, et ne PAS accuser le code ───────────────────────
sortie(1,
  `\n❌ AUCUN NOUVEAU CONTENEUR après ${FENETRE_S} s.\n`
  + `   Dernier état : version=${dernier?.version} uptime=${dernier?.uptime} s — c'est l'ANCIEN conteneur.\n`
  + `\n`
  + `   ⚠️ CE N'EST PROBABLEMENT PAS VOTRE CODE. Mesuré le 2026-08-11 : DIX déploiements\n`
  + `   Railway ont échoué en deux mois sur des commits sans rien en commun, sans aucune\n`
  + `   erreur dans les logs — conteneur sain, /health à 200, puis « Stopping Container ».\n`
  + `   Le MÊME commit relancé à la main a réussi sans qu'une ligne ne change.\n`
  + `\n`
  + `   REMÈDE : relancer le déploiement depuis la console Railway (service habashop,\n`
  + `   environnement production). Si la relance échoue AUSSI, alors seulement suspecter\n`
  + `   le code — et lire les logs de BUILD, pas ceux de déploiement.\n`
  + `\n`
  + `   ⚠️ La production n'est PAS tombée : l'ancien conteneur continue de servir. Ce qui\n`
  + `   manque, c'est votre changement — pas le service.`)
}
