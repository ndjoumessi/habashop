import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { GUIDE_SECTIONS } from '@/content/guide'

/**
 * LE MANUEL NE DOCUMENTE QUE CE QUI EST ✅.
 *
 * ⚠️ Le périmètre est DÉRIVÉ du CDC, jamais recopié : le jour où une capacité passe de ✅ à
 * ⚠️ (une clé expire, un prestataire tombe), ce verrou rougit tout seul. Une liste écrite à
 * la main resterait verte et le manuel continuerait d'affirmer.
 *
 * ⚠️ Lecture à l'EXÉCUTION (`readFileSync`), pas par `import` : le CDC vit dans `docs/`, hors
 * du périmètre de compilation — c'est la convention des fixtures partagées du dépôt. Et si le
 * chemin est faux, on ÉCHOUE bruyamment plutôt que de rendre une liste vide : un verrou qui
 * ne lit rien est vert et ne garde rien.
 */

function cheminCdc(): string {
  // Le répertoire de lancement de vitest est `apps/frontend`. On remonte à la racine du
  // monorepo. Aucun `try/catch` : un chemin faux doit faire ÉCHOUER le fichier de test.
  const candidats = [
    join(process.cwd(), '..', '..', 'docs', 'HabaShop_CDC_v4.md'),
    join(process.cwd(), 'docs', 'HabaShop_CDC_v4.md'),
  ]
  const trouve = candidats.find(c => existsSync(c))
  if (!trouve) throw new Error(`[guideClaims] CDC introuvable. Essayés : ${candidats.join(' | ')}`)
  return trouve
}

const CDC = readFileSync(cheminCdc(), 'utf-8')

/** Libellés des lignes de tableau du CDC dont l'état n'est PAS ✅. */
function capacitesNonAtteignables(): string[] {
  const out: string[] = []
  for (const ligne of CDC.split('\n')) {
    if (!ligne.startsWith('|')) continue
    const cellules = ligne.split('|').map(c => c.trim())
    if (cellules.length < 3) continue
    const libelle = cellules[1].replace(/\*\*/g, '').trim()
    const reste = cellules.slice(2).join(' ')
    if (!libelle || libelle.startsWith('---') || /^[\u{2705}\u{26A0}\u{1F9EA}\u{2B1C}]/u.test(libelle)) continue
    const nonOk = /[\u{26A0}\u{1F9EA}\u{2B1C}]/u.test(reste) && !/\u{2705}/u.test(reste)
    if (nonOk && libelle.length > 3) out.push(libelle)
  }
  return out
}

/**
 * Exemptions NOMMÉES, une par une et justifiées — jamais une liste fourre-tout.
 * Un libellé de CDC trop générique produirait des faux positifs.
 */
const EXEMPTIONS_NOMMEES = new Map<string, string>([
  ['Enterprise', 'un palier tarifaire, pas une capacité que le manuel décrirait'],
])

const texteDuManuel = GUIDE_SECTIONS.flatMap(s => [
  ...Object.values(s.titre), ...Object.values(s.intro),
  ...s.etapes.flatMap(e => [...Object.values(e.titre), ...Object.values(e.corps)]),
]).join(' \n ').toLowerCase()

describe('guideClaims', () => {
  it('COUVERTURE : le scan trouve des capacités non atteignables dans le CDC', () => {
    // Un parseur cassé rendrait une liste vide, donc un vert qui ne garde rien.
    expect(capacitesNonAtteignables().length).toBeGreaterThanOrEqual(5)
  })

  it('TÉMOIN POSITIF : le scan voit bien les capacités inertes connues', () => {
    const noms = capacitesNonAtteignables().join(' | ')
    expect(noms).toMatch(/hors-ligne/i)
    expect(noms).toMatch(/Import de produits/i)
  })

  it('⚠️ le manuel ne mentionne AUCUNE capacité non atteignable', () => {
    const fautes = capacitesNonAtteignables()
      .filter(c => !EXEMPTIONS_NOMMEES.has(c))
      .filter(c => texteDuManuel.includes(c.toLowerCase()))
    expect(fautes, `capacités non atteignables citées par le manuel : ${fautes.join(', ')}`).toEqual([])
  })

  it('⚠️ ni les prestataires de paiement en bac à sable ou sans clés', () => {
    for (const p of ['wave', 'orange money', 'paydunya', 'campay', 'mtn momo']) {
      expect(texteDuManuel, `« ${p} » n'est pas encaissable aujourd'hui`).not.toContain(p)
    }
  })

  it('⚠️ ni les canaux inertes faute de clés (SMS, push)', () => {
    expect(texteDuManuel).not.toMatch(/\bpar sms\b/)
    expect(texteDuManuel).not.toMatch(/notification[s]? push/)
  })

  it('les HUIT sections attendues sont présentes', () => {
    expect([...GUIDE_SECTIONS].map(s => s.id).sort()).toEqual(
      ['caisse', 'clients', 'codes-barres', 'depenses', 'rapports', 'reglages', 'stock', 'utilisateurs'],
    )
  })
})
