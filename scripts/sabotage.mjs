#!/usr/bin/env node
/**
 * SABOTAGE — instantané / restauration d'un fichier pendant la vérification d'un verrou.
 *
 * ─── POURQUOI CE SCRIPT EXISTE ───────────────────────────────────────────────
 * Vérifier un verrou impose de le casser puis de restaurer. La restauration par
 * `git checkout <fichier>` repart de HEAD : si le correctif n'est pas encore commité — et il
 * ne l'est jamais, puisqu'on est en train de le vérifier — elle l'EFFACE.
 *
 * Ce piège est écrit DEUX fois dans `CLAUDE.md`, et il a été commis TROIS fois dans la même
 * session par l'auteur de ces deux avertissements. Quand une règle documentée est violée
 * trois fois par le même acteur, ce n'est plus la règle qu'il faut corriger : c'est l'outil.
 * Ce script rend la bonne procédure la SEULE disponible.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *   npm run sabotage -- <fichier…>   instantané, puis on casse librement
 *   npm run sabotage:status          y a-t-il un sabotage en cours ?
 *   npm run sabotage:restore         restauration DEPUIS LA COPIE + vérification
 *
 * ─── TROIS GARANTIES ─────────────────────────────────────────────────────────
 * 1. L'instantané vit HORS du dépôt (`os.tmpdir()`) : impossible à commiter par mégarde,
 *    impossible à écraser par un `git checkout`, invisible pour `git status`.
 * 2. Un instantané EXISTANT n'est jamais écrasé. Un sabotage interrompu dont on restaurerait
 *    la copie plus tard écraserait du travail plus récent — on refuse, bruyamment.
 * 3. La restauration se VÉRIFIE octet par octet et le DIT. Une restauration silencieuse est
 *    une restauration non prouvée : c'est précisément ce qui a laissé passer les trois
 *    effacements.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Emplacement de l'instantané — HORS du dépôt, et propre à ce dépôt (plusieurs copies de
 * travail ne se marchent pas dessus). `SABOTAGE_DIR` n'existe que pour les tests.
 */
const DEPOT_ID = createHash('sha256').update(RACINE).digest('hex').slice(0, 12)
const DOSSIER = process.env.SABOTAGE_DIR ?? join(tmpdir(), 'habashop-sabotage', DEPOT_ID)
const MANIFESTE = join(DOSSIER, 'manifeste.json')

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const vert = (s) => `\x1b[32m${s}\x1b[0m`
const rouge = (s) => `\x1b[31m${s}\x1b[0m`

function lireManifeste() {
  if (!existsSync(MANIFESTE)) return null
  return JSON.parse(readFileSync(MANIFESTE, 'utf8'))
}

/* ═══ snapshot ═══════════════════════════════════════════════════════════════ */
function instantane(cibles) {
  if (cibles.length === 0) {
    console.error('Usage : npm run sabotage -- <fichier…>')
    process.exit(1)
  }

  // ⚠️ GARANTIE 2 — on n'écrase JAMAIS un instantané existant.
  const dejaLa = lireManifeste()
  if (dejaLa) {
    console.error(rouge('❌ Un sabotage est DÉJÀ en cours — instantané non écrasé.'))
    console.error(`   Pris le ${dejaLa.pris} sur ${dejaLa.fichiers.length} fichier(s) :`)
    for (const f of dejaLa.fichiers) console.error(`     ${f.rel}`)
    console.error('')
    console.error('   Restaurer d\'abord :  npm run sabotage:restore')
    console.error('   Écraser cet instantané effacerait un travail plus ancien que le vôtre,')
    console.error('   ou plus récent — dans les deux cas en silence. C\'est le défaut qu\'on ferme.')
    process.exit(1)
  }

  const fichiers = []
  for (const c of cibles) {
    const abs = isAbsolute(c) ? c : resolve(process.cwd(), c)
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      console.error(rouge(`❌ Fichier introuvable : ${c}`))
      process.exit(1)
    }
    const rel = relative(RACINE, abs)
    if (rel.startsWith('..')) {
      console.error(rouge(`❌ Hors du dépôt : ${c}`))
      process.exit(1)
    }
    const dest = join(DOSSIER, 'copie', rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(abs, dest)
    fichiers.push({ rel, sha: sha(abs) })
  }

  mkdirSync(DOSSIER, { recursive: true })
  writeFileSync(MANIFESTE, JSON.stringify({ pris: new Date().toISOString(), racine: RACINE, fichiers }, null, 2))

  console.log(vert(`✅ Instantané pris — ${fichiers.length} fichier(s), HORS du dépôt.`))
  for (const f of fichiers) console.log(`   ${f.rel}  (${f.sha.slice(0, 12)}…)`)
  console.log('')
  console.log('   Cassez librement. Puis :   npm run sabotage:restore')
  console.log(`   (instantané : ${DOSSIER})`)
}

/* ═══ restore ════════════════════════════════════════════════════════════════ */
function restaurer() {
  const m = lireManifeste()
  if (!m) {
    console.error(rouge('❌ Aucun sabotage en cours — rien à restaurer.'))
    console.error('   (Si vous attendiez un instantané, il n\'a jamais été pris : ne restaurez')
    console.error('    SURTOUT PAS par `git checkout`, vous perdriez le travail non commité.)')
    process.exit(1)
  }

  const echecs = []
  console.log(`Restauration de l'instantané du ${m.pris} :`)
  for (const f of m.fichiers) {
    const src = join(DOSSIER, 'copie', f.rel)
    const dest = join(m.racine, f.rel)
    if (!existsSync(src)) { echecs.push(`${f.rel} — copie introuvable`); continue }
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)

    // ⚠️ GARANTIE 3 — on VÉRIFIE, et on le DIT. Le fichier restauré doit être octet pour
    // octet celui de l'instantané ; sinon la restauration n'a pas eu lieu.
    const apres = sha(dest)
    if (apres !== f.sha) { echecs.push(`${f.rel} — ${apres.slice(0, 12)} ≠ ${f.sha.slice(0, 12)}`); continue }
    console.log(vert(`   ✓ ${f.rel}  identique à l'instantané (${f.sha.slice(0, 12)}…)`))
  }

  if (echecs.length > 0) {
    console.error(rouge(`\n❌ ${echecs.length} restauration(s) NON vérifiée(s) — instantané CONSERVÉ :`))
    for (const e of echecs) console.error(`   ${e}`)
    console.error('\n   L\'instantané n\'est pas supprimé : il reste votre seule copie.')
    process.exit(1)
  }

  // Suppression SEULEMENT après vérification complète.
  rmSync(DOSSIER, { recursive: true, force: true })
  console.log(vert(`\n✅ ${m.fichiers.length} fichier(s) restauré(s) et vérifié(s). Instantané supprimé.`))
}

/* ═══ status ═════════════════════════════════════════════════════════════════ */
function statut() {
  const m = lireManifeste()
  if (!m) { console.log('Aucun sabotage en cours.'); return }
  // ⚠️ Un instantané OUBLIÉ est un piège de plus : on le rend visible, avec l'écart.
  console.log(rouge(`⚠️  SABOTAGE EN COURS depuis le ${m.pris}`))
  for (const f of m.fichiers) {
    const dest = join(m.racine, f.rel)
    const etat = !existsSync(dest) ? 'SUPPRIMÉ'
      : sha(dest) === f.sha ? 'identique à l\'instantané'
      : rouge('MODIFIÉ — sabotage encore en place')
    console.log(`   ${f.rel}  ${etat}`)
  }
  console.log(`\n   Restaurer : npm run sabotage:restore`)
  console.log(`   (instantané : ${DOSSIER})`)
  process.exitCode = 2   // ⚠️ non nul : un sabotage en cours n'est pas un état normal.
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'restore') restaurer()
else if (cmd === 'status') statut()
else instantane(cmd ? [cmd, ...args] : [])
