import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ROLE_LABELS, roleLabel as roleRh } from '@/components/hr/hrShared'
import { roleLabel as rolePaie } from '@/components/payroll/payrollShared'

/**
 * LE LIBELLÉ DE POSTE — UNE source, pas deux.
 *
 * ⚠️ TROUVÉ PAR LE VERROU DES SEEDS, PAS PAR UNE RELECTURE, et il contredit une mesure que
 * j'avais annoncée. En corrigeant les employés du jeu de démonstration j'avais déclaré les
 * seeds « mesurés corrects » — je n'avais regardé qu'UNE des deux tables de rôles.
 * `payrollShared` portait son propre `ROLE_T`, **sous-ensemble strict** de `ROLE_LABELS` :
 * 11 clés contre 16. Manquaient `Directrice`, `Magasinière`, `Responsable`, `RH`, `Admin`.
 *
 * ⚠️ CE QUE ÇA DONNAIT À L'ÉCRAN, ET SUR PAPIER. `roleLabel` replie en `?? r` : aucun crash,
 * le poste s'affichait simplement en FRANÇAIS dans les quatre langues. Et les deux formes
 * FÉMININES étaient parmi les absentes alors que les masculines y étaient : une magasinière
 * voyait son poste traduit sur l'écran RH et brut sur son BULLETIN IMPRIMÉ — le document qu'on
 * lui remet. `printBulletin` passe par cette table-là.
 *
 * ⚠️ *Corriger un jumeau ne ferme rien tant que la SOURCE n'existe pas.* Recopier les 5 clés
 * manquantes aurait rendu les tables égales aujourd'hui et les aurait laissées diverger demain.
 * `payrollShared` RÉ-EXPORTE maintenant celle de `hrShared` — et le méta-test ci-dessous
 * interdit qu'une seconde table réapparaisse, parce que c'est par là qu'elle est revenue.
 */

const LANGS = ['fr', 'en', 'es', 'it'] as const
const PAYROLL_SHARED = resolve(__dirname, '..', 'components', 'payroll', 'payrollShared.tsx')

describe('libellé de poste — source unique', () => {
  it('⚠️ la paie traduit TOUT ce que la RH traduit, dans les 4 langues', () => {
    const cles = Object.keys(ROLE_LABELS)
    // Couverture : une table vide rendrait ce test vert sans rien garder.
    expect(cles.length, 'ROLE_LABELS doit être peuplée').toBeGreaterThanOrEqual(10)
    for (const r of cles) {
      for (const l of LANGS) {
        expect(rolePaie(r, l), `« ${r} » en ${l} : la paie diverge de la RH`).toBe(roleRh(r, l))
      }
    }
  })

  it('⚠️ et elle TRADUIT vraiment — un repli sur la clé passerait le test précédent', () => {
    // Si les deux fonctions repliaient toutes deux en `?? r`, l'égalité ci-dessus serait
    // satisfaite sans qu'une seule traduction existe. On exige donc un écart RÉEL.
    expect(rolePaie('Magasinière', 'es')).toBe('Almacenera')
    expect(rolePaie('Responsable', 'en')).toBe('Supervisor')
    expect(rolePaie('Directrice', 'it')).toBe('Direttrice')
  })

  it('⚠️ une valeur hors domaine reste rendue TELLE QUELLE, des deux côtés', () => {
    // Neutre et VISIBLE : le commerçant doit voir ce qu'il a saisi pour pouvoir le corriger.
    expect(rolePaie('Soudeur', 'es')).toBe('Soudeur')
    expect(roleRh('Soudeur', 'es')).toBe('Soudeur')
  })

  it('⚠️ aucune SECONDE table de rôles dans le module de paie', () => {
    const src = readFileSync(PAYROLL_SHARED, 'utf-8')
    // Le jumeau est revenu par une table locale ; c'est cette FORME qu'on interdit, pas un nom.
    const tables = [...src.matchAll(/const\s+\w+\s*:\s*Record<string,\s*Record<string,\s*string>>/g)]
    expect(tables.length, `table de traduction locale rouverte dans payrollShared`).toBe(0)
    // Témoin positif : le fichier est bien lu.
    expect(src.length, 'le module doit être lu').toBeGreaterThan(1000)
    expect(src).toContain('roleLabel')
  })
})
