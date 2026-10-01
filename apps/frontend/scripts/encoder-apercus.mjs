#!/usr/bin/env node
/**
 * ENCODE LES APERÇUS DU MANUEL — de la capture brute au fichier livré.
 *
 * `npm run capture:demo` écrit un VP8 de ~1,8 Mo par langue : c'est ce que Playwright produit,
 * pas ce qu'on met en ligne. Ce script ré-encode en VP9 960×540 (~415 Ko, MESURÉ) et extrait
 * une affiche, dans `public/guide/`.
 *
 * ⚠️ LES PARAMÈTRES VIVENT ICI, PAS DANS UNE TÊTE. Une commande ffmpeg tapée à la main une
 * fois est irreproductible : le prochain réenregistrement sortirait un poids et une qualité
 * différents sans que rien ne le signale.
 *
 * ⚠️ 960×540 EST UN CHOIX MESURÉ, pas un réglage par défaut. Vérifié sur une image extraite :
 * « 4 articles en rupture ou stock faible » et ses quatre produits restent lisibles. Plus bas,
 * les tableaux de l'inventaire deviennent illisibles ; plus haut, le poids double sans gain
 * pour un lecteur qui regarde dans une colonne de 820 px.
 *
 * ⚠️ `-an` : la capture n'a PAS de son. Laisser une piste audio vide ferait croire à un lecteur
 * qu'il a coupé le son.
 *
 * ⚠️ ffmpeg est une dépendance SYSTÈME, absente de `package.json`. Son absence ARRÊTE le
 * script avec le message qui dit quoi faire — un garde qui réussit en silence quand son outil
 * manque n'est pas un garde, et c'est la leçon du `notify-failure` qui sortait en `exit 0`.
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ICI = dirname(fileURLToPath(import.meta.url))
const FRONT = join(ICI, '..')

/** ⚠️ Le domaine du manuel, recopié nulle part ailleurs : `GuideLang` en est la source. */
const LANGUES = ['fr', 'en', 'es', 'it']

const SOURCE = (l) => join(FRONT, 'test-results', `parcours-demo-parcours-${l}`, 'video.webm')
const SORTIE = join(FRONT, 'public', 'guide')

function exigeFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  } catch {
    console.error(
      '[apercus] ffmpeg est introuvable.\n'
      + "         Il n'est pas une dépendance npm : installez-le (macOS : `brew install ffmpeg`),\n"
      + '         puis relancez. Aucun fichier n\'a été écrit.')
    process.exit(1)
  }
}

function encoder(l) {
  const src = SOURCE(l)
  if (!existsSync(src)) {
    console.error(`[apercus] capture manquante pour « ${l} » : ${src}`)
    console.error('          Lancez d\'abord `npm run capture:demo`.')
    process.exit(1)
  }
  const video = join(SORTIE, `apercu-${l}.webm`)
  const affiche = join(SORTIE, `apercu-${l}.jpg`)

  execFileSync('ffmpeg', [
    '-nostdin', '-v', 'error', '-i', src,
    '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0',
    '-vf', 'scale=960:-2', '-an', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
    video, '-y',
  ])
  /**
   * ⚠️ L'AFFICHE EST PRISE DANS L'APPLICATION (seconde 6, le tableau de bord rendu), pas sur la
   * vitrine des deux premières secondes. C'est un MANUEL : l'image fixe qui le représente ne
   * peut pas être une page de vente. Vérifié à 6 s sur deux langues — le tableau de bord y est
   * complet, KPI et graphiques compris.
   *
   * ⚠️ JPEG ET NON WEBP, par MESURE et non par préférence : l'ffmpeg de ce poste est compilé
   * sans encodeur WebP (« Default encoder for format webp is probably disabled »). Le PNG
   * pèserait 293 Ko contre 50 — pour une affiche de 960 px, l'écart ne se justifie pas.
   */
  execFileSync('ffmpeg', [
    '-nostdin', '-v', 'error', '-ss', '6', '-i', src,
    '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', affiche, '-y',
  ])

  const ko = (p) => Math.round(statSync(p).size / 1024)
  console.log(`[apercus] ${l} : ${ko(video)} Ko (vidéo) + ${ko(affiche)} Ko (affiche)`)
  return statSync(video).size + statSync(affiche).size
}

exigeFfmpeg()
mkdirSync(SORTIE, { recursive: true })
let total = 0
for (const l of LANGUES) total += encoder(l)
console.log(`[apercus] ${LANGUES.length} langues — ${Math.round(total / 1024)} Ko au total, dans public/guide/`)
