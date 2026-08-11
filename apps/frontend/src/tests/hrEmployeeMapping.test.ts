import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { employeeFromApi, toEmployeeWrite, empFormVide, type ApiEmployee } from '@/components/hr/hrShared'

/**
 * FRONTIÈRE EMPLOYÉ — le fil ne parle pas la langue de l'écran.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `HR.tsx` construisait ses employés avec `data.map((e: any) => …)`, et la modale
 * recevait `editEmpForm: any`. Ces `any` n'ont pas laissé passer des fautes de
 * frappe : ils ont laissé passer une **API imaginaire**. MESURÉ en production le
 * 2026-08-09, trois conséquences vivantes :
 *
 *   • `e.photo` jamais lu, `photoUrl` jamais envoyé → 5 employés, 0 photo, alors
 *     que la colonne, l'interface et le `bodyLimit` de 4 Mo existent depuis des mois ;
 *   • `e.contractType` n'existe pas sur le fil → le repli `?? 'CDI'` s'appliquait
 *     TOUJOURS, et Aminata Touré (CDD en base) s'affichait « CDI » ;
 *   • `COLORS[i % n]` inconditionnel → les 4 couleurs enregistrées étaient jetées
 *     à chaque chargement.
 *
 * Ce fichier garde les DEUX sens de la conversion. `tsc` garde le reste : les
 * adaptateurs sont typés `ApiEmployee` → `Employee` → `EmployeeWrite`.
 */

/**
 * Forme EXACTE renvoyée par `GET /api/employees` en production (2026-08-09).
 * ⚠️ Relevée sur la vraie réponse, pas recopiée du schéma Prisma : c'est le FIL
 * qui fait autorité, et c'est justement là que le code s'était trompé.
 */
const DEPUIS_LA_PROD: ApiEmployee = {
  id: 'cmc1abc000', tenantId: 'demo-tenant-001',
  name: 'Aminata Touré', role: 'Vendeuse', dept: 'Ventes',
  type: 'CDD', salary: 120000,
  phone: '+221771234567', email: 'a@x.com', address: 'Dakar',
  photo: 'data:image/jpeg;base64,ZZZ',
  hiredAt: '2026-01-15T00:00:00.000Z', endAt: null,
  isActive: true, perf: 4, avatar: 'AT', color: '#10B981',
  createdAt: '2026-01-15T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z',
  deletedAt: null,
} as ApiEmployee

describe('employeeFromApi — sens API → écran', () => {
  it('⚠️ la PHOTO traverse : `photo` sur le fil devient `photoUrl` à l’écran', () => {
    // Le défaut d'origine : ce champ n'était pas mappé, donc l'aperçu restait vide
    // même avec une photo en base — et le formulaire repartait de rien.
    expect(employeeFromApi(DEPUIS_LA_PROD, 0).photoUrl).toBe('data:image/jpeg;base64,ZZZ')
  })

  it('⚠️ le TYPE DE CONTRAT est celui de la base, pas le repli', () => {
    // `e.contractType` n'existe pas sur le fil : le repli `?? 'CDI'` gagnait toujours.
    // Un CDD affiché « CDI », c'est une information de contrat fausse à l'écran.
    expect(employeeFromApi(DEPUIS_LA_PROD, 0).type).toBe('CDD')
  })

  it('⚠️ la COULEUR enregistrée prime sur la palette', () => {
    expect(employeeFromApi(DEPUIS_LA_PROD, 0).color).toBe('#10B981')
  })

  it('la palette ne sert QUE de repli, et elle varie avec l’index', () => {
    // Contrôle positif du repli : sans lui, « la couleur enregistrée prime » serait
    // vrai d'un code qui aurait simplement supprimé toute couleur par défaut.
    const sansCouleur = { ...DEPUIS_LA_PROD, color: '' } as ApiEmployee
    const a = employeeFromApi(sansCouleur, 0).color
    const b = employeeFromApi(sansCouleur, 1).color
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('`isActive` du fil devient `active` à l’écran', () => {
    expect(employeeFromApi(DEPUIS_LA_PROD, 0).active).toBe(true)
    expect(employeeFromApi({ ...DEPUIS_LA_PROD, isActive: false } as ApiEmployee, 0).active).toBe(false)
  })

  it('une photo absente rend `undefined`, jamais la chaîne « null »', () => {
    // `String(null)` imprimerait « null » dans un `<img src>` — une requête vers
    // une image nommée « null », et un carré cassé à l'écran.
    expect(employeeFromApi({ ...DEPUIS_LA_PROD, photo: null } as ApiEmployee, 0).photoUrl).toBeUndefined()
  })
})

describe('toEmployeeWrite — sens écran → API', () => {
  const form = { ...empFormVide(), name: 'Aminata', role: 'Vendeuse', type: 'CDD',
                 photoUrl: 'data:image/jpeg;base64,ZZZ', isActive: false, color: '#10B981' }

  it('⚠️ le corps porte `photo`, JAMAIS `photoUrl`', () => {
    const w = toEmployeeWrite(form) as Record<string, unknown>
    expect(w.photo).toBe('data:image/jpeg;base64,ZZZ')
    expect('photoUrl' in w, 'la clé d’écran partirait sur le fil et serait strippée').toBe(false)
  })

  it('⚠️ AUCUNE clé du corps n’est inconnue de la liste blanche zod du SERVEUR', () => {
    /**
     * C'EST LE VERROU QUI REND LE DÉFAUT IMPOSSIBLE. La liste blanche est lue à
     * l'EXÉCUTION dans `apps/backend/src/schemas/writesB.ts` : une clé que le
     * serveur n'accepte pas est STRIPPÉE en silence, l'écran affiche « Sauvegardé ! »
     * et rien n'est enregistré. C'est exactement ce qui est arrivé à la photo.
     *
     * ⚠️ Ce n'est pas une recopie de la liste — la recopier créerait un second
     * endroit qui diverge, ce qui est le défaut qu'on ferme.
     */
    const src = readFileSync(
      join(__dirname, '../../../backend/src/schemas/writesB.ts'), 'utf8',
    )
    const bloc = /const EMPLOYEE_FIELDS = \{([\s\S]*?)\n\}/.exec(src)
    expect(bloc, 'EMPLOYEE_FIELDS introuvable — le chemin ou le nom a changé').toBeTruthy()
    const acceptees = new Set([...bloc![1].matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]))

    // ⚠️ COUVERTURE : une regex qui ne matche rien rendrait un ensemble VIDE, et
    // « aucune clé inconnue » serait vrai par vacuité. Angle mort n°1.
    expect(acceptees.size).toBeGreaterThanOrEqual(10)
    expect(acceptees.has('photo'), 'témoin positif').toBe(true)
    expect(acceptees.has('endAt'), 'témoin positif — la date de fin est persistable').toBe(true)
    expect(acceptees.has('photoUrl'), 'témoin négatif — le serveur ne connaît PAS ce nom').toBe(false)
    expect(acceptees.has('contractEnd'), 'témoin négatif — nom d’ÉCRAN, absent du fil').toBe(false)

    const envoyees = Object.keys(toEmployeeWrite(form, { salary: 1, avatar: 'AT' }))
    const inconnues = envoyees.filter(k => !acceptees.has(k))
    expect(
      inconnues,
      'ces clés seront STRIPPÉES par le serveur sans un mot, et l’écran dira « Sauvegardé ! »',
    ).toEqual([])
  })

  it('`salary` et `avatar` ne sont envoyés que s’ils sont fournis', () => {
    // Envoyer `salary: undefined` sur une modale qui ne touche pas au salaire
    // écraserait la valeur en base au premier handler moins prudent.
    expect('salary' in toEmployeeWrite(form)).toBe(false)
    expect(toEmployeeWrite(form, { salary: 42 }).salary).toBe(42)
  })

  it('⚠️ la DATE DE FIN traverse : `contractEnd` à l’écran devient `endAt` sur le fil', () => {
    /**
     * ⚠️ CE CAS DISAIT L'INVERSE JUSQU'AU 2026-08-11, et il avait raison : le champ était
     * saisi par la modale puis JETÉ, faute d'`endAt` dans `EMPLOYEE_FIELDS` et dans le
     * handler. C'est ainsi qu'Aminata Touré était en CDD avec `endAt: null` en production.
     * Le test décrivait donc fidèlement le défaut — et, ce faisant, le PROTÉGEAIT.
     */
    const w = toEmployeeWrite({ ...form, contractEnd: '2026-12-31' }) as Record<string, unknown>
    expect(w.endAt).toBe('2026-12-31T00:00:00.000Z')
    expect('contractEnd' in w, 'la clé d’écran partirait sur le fil et serait strippée').toBe(false)
  })

  it('⚠️ un champ VIDÉ envoie `null` — effacer une échéance est une intention', () => {
    // `undefined` laisserait le serveur ne rien faire (`endAt !== undefined` est faux) :
    // un CDD requalifié en CDI garderait son échéance pour toujours. `''` produirait une
    // date invalide côté serveur. Seul `null` efface, et c'est ce qui doit partir.
    const w = toEmployeeWrite({ ...form, contractEnd: '' }) as Record<string, unknown>
    expect(w.endAt).toBeNull()
    expect('endAt' in w, 'la clé doit PARTIR, sinon rien n’est effacé').toBe(true)

    // Contrôle positif : le formulaire vide (aucune date jamais saisie) se comporte pareil.
    expect(toEmployeeWrite(empFormVide()).endAt).toBeNull()
  })

  it('la date de fin fait l’aller-retour sans dériver d’un jour', () => {
    // `new Date('2026-12-31')` est parsé en UTC — pas de décalage de fuseau qui ferait
    // afficher le 30. C'est la même famille que `fmtDate` (§ Dates AFFICHÉES).
    const aller = toEmployeeWrite({ ...form, contractEnd: '2026-12-31' }).endAt
    const retour = employeeFromApi({ ...DEPUIS_LA_PROD, endAt: aller } as ApiEmployee, 0).endAt
    expect(retour).toBe('2026-12-31')
  })

  it('un aller-retour préserve ce qui compte', () => {
    const ecran = employeeFromApi(DEPUIS_LA_PROD, 0)
    const w = toEmployeeWrite({ ...empFormVide(), name: ecran.name, role: ecran.role,
      dept: ecran.dept, type: ecran.type, hiredAt: ecran.hiredAt, color: ecran.color,
      isActive: ecran.active, phone: ecran.phone, email: ecran.email,
      perf: ecran.perf, address: ecran.address, photoUrl: ecran.photoUrl })
    expect(w.photo).toBe(DEPUIS_LA_PROD.photo)
    expect(w.type).toBe('CDD')
    expect(w.color).toBe('#10B981')
    expect(w.isActive).toBe(true)
  })
})
