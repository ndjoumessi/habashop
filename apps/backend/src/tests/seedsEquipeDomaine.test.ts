import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * LES ÉQUIPES DES SEEDS — mêmes règles que le jeu de démonstration jetable.
 *
 * ⚠️ POURQUOI CE VERROU N'EXISTAIT PAS, ET POURQUOI IL EXISTE MAINTENANT. En corrigeant les
 * employés du jeu jetable (« Caissier 1 », `role: 'Gérant'` hors des tables de traduction),
 * j'avais mesuré que `prisma/seed.ts` et `prisma/seed-demo.ts` étaient CORRECTS et j'avais
 * refusé de les verrouiller : « un scanner y confondrait `User.role` ('ADMIN') avec
 * `Employee.role` », et *un verrou qui crie au loup se fait désarmer*.
 *
 * L'objection était bonne, la conclusion non : elle laissait vivante une instance de la famille
 * que je venais de fermer ailleurs — et *une correction qui s'arrête au premier fichier n'est
 * pas une correction, c'est un déplacement*. Ce qui manquait n'était pas le courage, c'était le
 * DISCRIMINANT.
 *
 * ⚠️ LE DISCRIMINANT : un employé porte `role` ET `dept` sur la même ligne, un utilisateur porte
 * `role` SEUL. Mesuré — 8 objets d'un côté, 7 de l'autre. Le test l'exerce dans les deux sens :
 * il exige de trouver les employés, ET que les rôles d'utilisateur ('ADMIN', 'MANAGER') soient
 * ABSENTS de ce qu'il a extrait. Sans ce second contrôle, un scanner trop large passerait au
 * vert en « trouvant » des rôles qu'il n'aurait jamais dû lire.
 *
 * ⚠️ `prisma/` EST HORS DU RITUEL — `tsconfig.json` a `include: ["src/**\/*"]`, donc `tsc` ne
 * voit pas ces fichiers et le build Docker ne les compile pas. Annoncer « tsc 0 » ne dit RIEN
 * d'eux : c'est précisément pourquoi ils ont besoin d'un verrou qui, lui, les LIT.
 *
 * ⚠️ Lecture à l'EXÉCUTION des tables du front, jamais par `import` : le contexte Docker du
 * backend est `apps/backend` seul. Même mécanique que `msisdnShared.test.ts`.
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const SEEDS = [
  join(RACINE, 'apps', 'backend', 'prisma', 'seed.ts'),
  join(RACINE, 'apps', 'backend', 'prisma', 'seed-demo.ts'),
]
const FRONT = join(RACINE, 'apps', 'frontend', 'src', 'components')
const HR_SHARED = join(FRONT, 'hr', 'hrShared.tsx')

/**
 * Clés d'une table `Record<string, …>` du front, par appariement d'accolades.
 *
 * ⚠️ UNE SEULE table de rôles depuis le 2026-10-02 : `payrollShared` ré-exporte celle de
 * `hrShared`. Vérifier les deux ici n'aurait plus de sens — c'est
 * `roleLabelSourceUnique.test.ts` qui interdit qu'une seconde réapparaisse.
 */
function clesDeTable(src: string, nom: string): Set<string> {
  const debut = src.indexOf(`const ${nom}`)
  if (debut < 0) throw new Error(`table ${nom} introuvable`)
  const fin = src.indexOf('\n}', debut)
  const bloc = src.slice(debut, fin)
  return new Set([...bloc.matchAll(/^\s{2}'([^']+)':/gm)].map(m => m[1]))
}

/** Les employés littéraux des seeds — `role` ET `dept` sur la même ligne. */
interface Employe { fichier: string; name: string; role: string; dept: string }
function employesDesSeeds(): Employe[] {
  const out: Employe[] = []
  for (const f of SEEDS) {
    for (const ligne of readFileSync(f, 'utf-8').split('\n')) {
      const role = /\brole: *'([^']+)'/.exec(ligne)
      const dept = /\bdept: *'([^']+)'/.exec(ligne)
      if (!role || !dept) continue
      const nom = /\bname: *'([^']+)'/.exec(ligne)
      out.push({ fichier: f.split('/').pop() ?? f, name: nom?.[1] ?? '', role: role[1], dept: dept[1] })
    }
  }
  return out
}

describe('équipes des seeds — mêmes règles que la démo jetable', () => {
  it('⚠️ le discriminant LIT les employés et IGNORE les utilisateurs', () => {
    const emp = employesDesSeeds()
    // Couverture : un `readFileSync` qui échoue ou une regex cassée rend une liste vide,
    // donc un vert qui ne garde rien.
    expect(emp.length, 'les employés des seeds doivent être trouvés').toBeGreaterThanOrEqual(8)
    expect(new Set(emp.map(e => e.fichier)).size, 'les DEUX seeds doivent être lus').toBe(2)

    // Témoin POSITIF : un rôle d'employé qu'on sait présent.
    expect(emp.map(e => e.role)).toContain('Magasinier')

    // ⚠️ Témoin NÉGATIF — c'est LUI qui justifie le verrou. Les rôles d'UTILISATEUR
    // ('ADMIN', 'MANAGER', 'CASHIER'…) vivent dans les mêmes fichiers et n'ont RIEN à voir
    // avec `Employee.role` : s'ils apparaissaient ici, le scanner serait celui qui crie au
    // loup, et il finirait désarmé.
    for (const r of ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR']) {
      expect(emp.map(e => e.role), `« ${r} » est un rôle d'UTILISATEUR, pas d'employé`).not.toContain(r)
    }
  })

  it('⚠️ chaque rôle appartient aux DEUX tables de traduction, chaque dept aux siennes', () => {
    const hr = readFileSync(HR_SHARED, 'utf-8')
    const roles = clesDeTable(hr, 'ROLE_LABELS')
    const depts = clesDeTable(hr, 'DEPT_LABELS')
    const couleurs = clesDeTable(hr, 'DEPT_COLORS')
    expect(roles.size).toBeGreaterThanOrEqual(10)

    for (const e of employesDesSeeds()) {
      const ou = `${e.fichier} — ${e.name || '(sans nom)'}`
      expect(roles.has(e.role), `${ou} : rôle « ${e.role} » hors de ROLE_LABELS`).toBe(true)
      expect(depts.has(e.dept), `${ou} : dept « ${e.dept} » hors de DEPT_LABELS`).toBe(true)
      expect(couleurs.has(e.dept), `${ou} : dept « ${e.dept} » hors de DEPT_COLORS`).toBe(true)
    }
  })

  it('⚠️ aucun nom d’employé ne porte son métier ni son département', () => {
    for (const e of employesDesSeeds()) {
      expect(e.name.length, `${e.fichier} : un employé sans nom`).toBeGreaterThan(0)
      expect(e.name.includes(e.role), `« ${e.name} » porte son rôle`).toBe(false)
      expect(e.name.includes(e.dept), `« ${e.name} » porte son département`).toBe(false)
      expect(e.name.trim().split(/\s+/).length, `« ${e.name} » doit porter prénom ET nom`).toBeGreaterThanOrEqual(2)
    }
  })
})
