#!/usr/bin/env node
/**
 * Dérive `apps/backend/package-lock.json` DU lockfile racine — l'image installe ce que la CI teste.
 *
 *   npm run lock:backend            # régénère le lockfile de l'image
 *   npm run lock:backend -- --check # échoue s'il n'est plus à jour (sans rien écrire)
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Le contexte Docker est `apps/backend` seul : le lockfile vivait à
 * la racine du monorepo, HORS de l'image. `RUN npm install` y résolvait donc chaque plage contre le
 * registre DU JOUR. Mesuré le 2026-09-12 :
 *   · vite 8.3.0 (publié le 10) a fait planter npm à `npm install` → déploiement 2.22.53 échoué ;
 *   · l'image tournait avec twilio 6.1.1 et africastalking 0.8.3 quand la CI testait 6.0.2 et 0.8.0.
 * Le code livré n'était donc PAS le code testé — et rien ne le montrait.
 *
 * ⚠️ POURQUOI DÉRIVER, ET NE PAS RÉSOUDRE À NEUF. Un `npm install --package-lock-only` dans un
 * dossier isolé produirait un lockfile valide… figé sur le registre du jour de génération : des
 * versions qu'aucun test n'a vues. On part donc des versions du lockfile RACINE (celles de la CI),
 * et npm n'a plus qu'à ÉLAGUER ce qui n'appartient pas au backend (tout le frontend) et à
 * recalculer les drapeaux dev/optional. Le script vérifie ensuite qu'AUCUNE version n'a bougé.
 *
 * ⚠️ LES OVERRIDES DE SÉCURITÉ DE LA RACINE DOIVENT ÊTRE DANS `apps/backend/package.json`.
 * `overrides` n'est honoré qu'à la racine d'une installation : dans l'image, c'est `apps/backend`.
 * `africastalking` épingle `axios@1.15.0` (CVE high, #135) et `joi@18.1.2` (CVE moderate, #136) ;
 * sans le miroir, le lockfile dérivé réintroduirait les versions vulnérables. Le script REFUSE de
 * générer si un override racine manque au backend.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = join(RACINE, 'apps', 'backend')
const CIBLE = join(BACKEND, 'package-lock.json')
const CHECK = process.argv.includes('--check')

const lire = (p) => JSON.parse(readFileSync(p, 'utf8'))
const pkgRacine = lire(join(RACINE, 'package.json'))
const pkgBackend = lire(join(BACKEND, 'package.json'))
const lockRacine = lire(join(RACINE, 'package-lock.json'))

// ── 0. Les overrides de sécurité doivent être recopiés ────────────────────────────────
const manquants = Object.entries(pkgRacine.overrides ?? {})
  .filter(([nom, spec]) => JSON.stringify(pkgBackend.overrides?.[nom]) !== JSON.stringify(spec))
if (manquants.length) {
  console.error('❌ Overrides de la RACINE absents ou différents dans apps/backend/package.json :')
  for (const [nom, spec] of manquants) console.error(`   ${nom}: ${JSON.stringify(spec)}`)
  console.error('   `overrides` ne s’applique qu’à la racine d’une installation — dans l’image, c’est apps/backend.')
  process.exit(1)
}

// ── 1. Projection du lockfile racine sur le seul backend ──────────────────────────────
/** Nom du paquet de premier niveau d'un chemin `node_modules/…` (gère les @scopes). */
function premierNiveau(chemin) {
  const s = chemin.slice('node_modules/'.length).split('/')
  return s[0].startsWith('@') ? `${s[0]}/${s[1]}` : s[0]
}

const P = lockRacine.packages
const projete = {}
// Paquets que le backend installe EN PROPRE (version différente de celle hissée à la racine) :
// leur sous-arbre hissé appartient à une AUTRE version, il ne doit pas être repris.
const propres = new Set()
for (const k of Object.keys(P)) {
  if (!k.startsWith('apps/backend/node_modules/')) continue
  const local = k.slice('apps/backend/'.length)
  projete[local] = P[k]
  propres.add(premierNiveau(local))
}
for (const [k, v] of Object.entries(P)) {
  if (!k.startsWith('node_modules/') || v.link) continue
  if (propres.has(premierNiveau(k))) continue
  projete[k] = v
}
const { dependencies, devDependencies, optionalDependencies, peerDependencies } = pkgBackend
const lockDerive = {
  name: pkgBackend.name, version: pkgBackend.version, lockfileVersion: 3, requires: true,
  packages: {
    '': Object.fromEntries(Object.entries({
      name: pkgBackend.name, version: pkgBackend.version,
      dependencies, devDependencies, optionalDependencies, peerDependencies,
    }).filter(([, x]) => x !== undefined)),
    ...projete,
  },
}

// ── 2. npm élague (frontend) et recalcule les drapeaux — dans un dossier ISOLÉ ─────────
// Isolé, sinon npm remonte jusqu'au workspace racine et réécrit le lockfile RACINE.
const tmp = mkdtempSync(join(tmpdir(), 'habashop-lock-backend-'))
let resultat
try {
  writeFileSync(join(tmp, 'package.json'), JSON.stringify(pkgBackend, null, 2))
  writeFileSync(join(tmp, 'package-lock.json'), JSON.stringify(lockDerive, null, 2))
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: tmp, stdio: ['ignore', 'ignore', 'pipe'] })
  resultat = lire(join(tmp, 'package-lock.json'))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

// ── 3. AUCUNE version nouvelle — sinon l'image n'installerait pas ce qui est testé ─────
// ⚠️ On compare des `nom@version`, PAS des CHEMINS. Mesuré à la première exécution : le backend a
// son propre `picomatch 4.0.4`, qui prend dans l'image la place de premier niveau occupée à la
// racine par `picomatch 2.3.2` ; npm reloge alors 2.3.2 sous `anymatch` et `readdirp`. Même paquet,
// même version, même intégrité — c'est l'arbre TESTÉ, simplement rangé autrement. Un contrôle par
// chemin le refusait ; un contrôle par version l'accepte, et refuse toujours une version inédite.
/** Nom du paquet d'un chemin de lockfile : le dernier segment `node_modules/<nom>`. */
const nomDe = (chemin) => {
  const i = chemin.lastIndexOf('node_modules/')
  return i < 0 ? chemin : premierNiveau(chemin.slice(i))
}
const connus = new Map() // `nom@version` → intégrité, dans le lockfile RACINE
for (const [k, v] of Object.entries(P)) {
  if (k.includes('node_modules/') && v.version) connus.set(`${nomDe(k)}@${v.version}`, v.integrity)
}
const ecarts = []
for (const [k, v] of Object.entries(resultat.packages)) {
  if (k === '' || v.link) continue
  const cle = `${nomDe(k)}@${v.version}`
  if (!connus.has(cle)) ecarts.push(`${k} : ${cle} — ABSENT du lockfile racine, donc jamais testé`)
  else if (v.integrity && connus.get(cle) && connus.get(cle) !== v.integrity) ecarts.push(`${k} : ${cle} — intégrité DIFFÉRENTE`)
}
if (ecarts.length) {
  console.error('❌ La dérivation a CHANGÉ des versions — l’image ne serait plus l’arbre testé :')
  for (const e of ecarts.slice(0, 20)) console.error('   ' + e)
  if (ecarts.length > 20) console.error(`   … et ${ecarts.length - 20} autres`)
  console.error('   Mettre à jour le lockfile RACINE d’abord (npm install à la racine), puis relancer.')
  process.exit(1)
}

const texte = JSON.stringify(resultat, null, 2) + '\n'
const n = Object.keys(resultat.packages).length - 1
if (CHECK) {
  const actuel = existsSync(CIBLE) ? readFileSync(CIBLE, 'utf8') : ''
  if (actuel !== texte) {
    console.error('❌ apps/backend/package-lock.json n’est plus à jour avec le lockfile racine.')
    console.error('   → npm run lock:backend')
    process.exit(1)
  }
  console.log(`✅ apps/backend/package-lock.json à jour (${n} paquets, versions = lockfile racine).`)
} else {
  writeFileSync(CIBLE, texte)
  console.log(`✅ apps/backend/package-lock.json écrit — ${n} paquets, toutes versions identiques au lockfile racine.`)
}
