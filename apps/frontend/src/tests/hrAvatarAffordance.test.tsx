import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/**
 * L'AVATAR EST CLIQUABLE — ET ÇA DOIT SE VOIR SANS SURVOLER.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * La photo d'employé se changeait en cliquant l'avatar, et RIEN ne le montrait.
 * L'affordance tenait à deux signaux qui n'existent pas au TOUCHER :
 *   • `cursor: pointer` — aucun curseur sur un écran tactile ;
 *   • un attribut `title` — l'infobulle native n'apparaît qu'au SURVOL.
 * Sur mobile, le terrain de ce produit, la fonctionnalité était donc inatteignable
 * autrement qu'en la devinant. Même famille que le CTA éteint qui « n'affiche
 * aucune infobulle au toucher » (§ landingClaims) : le signal est là pour la souris
 * et absent pour tout le monde d'autre.
 *
 * ⚠️ ET CE N'ÉTAIT PAS UN BOUTON. Un `<div onClick>` n'est ni atteignable au clavier,
 * ni annoncé par un lecteur d'écran — l'action existait pour la souris seule.
 *
 * ⚠️ CE QUE CE FICHIER NE PROUVE PAS : que le badge soit VISIBLE à l'œil. jsdom ne
 * fait aucune mise en page — il prouve qu'un élément graphique est RENDU dans le
 * bouton, pas qu'il est à la bonne place ni qu'il contraste. La géométrie se mesure
 * avec un vrai moteur, et ce n'est pas fait ici.
 */

vi.mock('@/lib/api', () => ({ employeesApi: { update: vi.fn() } }))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn() }))

import EditEmployeeModal from '@/components/hr/modals/EditEmployeeModal'
import { empFormVide } from '@/components/hr/hrShared'

const EMP = {
  id: 'emp-cuid' as unknown as number, name: 'Kofi Diallo', role: 'Magasinier',
  dept: 'Stock', type: 'CDI', salary: 120000, hiredAt: '2023-01-01',
  avatar: 'KD', color: '#F59E0B', active: true, phone: '', email: '',
  perf: 4, address: '',
  // ⚠️ PORTE une photo : c'est de cet objet que « Annuler » réamorce, et sans elle
  // le cas de restauration serait vrai du vide.
  photoUrl: 'photo-origine',
}

function monter(edition: boolean, photoUrl?: string) {
  const setForm = vi.fn()
  const setEmployees = vi.fn()
  const ouvrirFiche = vi.fn()
  render(
    <EditEmployeeModal
      lang="fr" fmt={(n: number) => String(n)}
      selectedEmp={EMP as never}
      editEmpForm={{ ...empFormVide(), name: EMP.name, color: EMP.color, isActive: true, photoUrl }}
      setEditEmpForm={setForm}
      empEditMode={edition} setEmpEditMode={vi.fn()}
      salaryInput="120000" setSalaryInput={vi.fn()}
      toXOF={(n: number) => n}
      currency="XOF" currencySymbol="FCFA"
      setEmployees={setEmployees} setShowEditEmpModal={vi.fn()} openEditModal={ouvrirFiche}
    />,
  )
  return { setForm, setEmployees, ouvrirFiche }
}

// ⚠️ DEUX boutons portent « photo » depuis l'ajout du retrait : un sélecteur sur
// `/photo/i` en matchait deux et levait. On vise l'INTENTION, pas le mot.
const bouton = () => screen.queryByRole('button', { name: /Changer la photo/i })
const boutonRetrait = () => screen.queryByRole('button', { name: /Retirer la photo/i })

beforeEach(() => vi.clearAllMocks())

describe('affordance de la photo d’employé', () => {
  it('⚠️ en édition : c’est un BOUTON, avec un nom accessible qui dit quoi', async () => {
    // Un `<div onClick>` n'a ni rôle ni nom : il n'existe pas pour le clavier ni pour
    // un lecteur d'écran. `getByRole('button', { name })` échoue sur un div.
    monter(true)
    const b = bouton()
    expect(b, 'aucun bouton nommé « photo » — l’action est réservée à la souris').not.toBeNull()
    expect(b!.getAttribute('aria-label')).toMatch(/Kofi Diallo/)
  })

  it('⚠️ le SIGNAL VISUEL est rendu, pas seulement un `title` de survol', () => {
    /**
     * C'EST LE CŒUR DU DÉFAUT. Un `title` ne s'affiche qu'au survol : sur tactile il
     * n'existe pas. Le bouton doit donc porter un élément graphique — le badge
     * appareil photo — en plus de son contenu (initiales ou photo).
     */
    monter(true)
    const svg = bouton()!.querySelectorAll('svg')
    expect(svg.length, 'aucune icône dans le bouton : rien ne montre qu’il est cliquable').toBeGreaterThan(0)
  })

  it('le badge subsiste QUAND une photo est déjà posée', () => {
    // Sinon on ne pourrait plus la remplacer : l'affordance disparaîtrait au moment
    // précis où elle devient utile pour corriger un mauvais cliché.
    monter(true, 'data:image/jpeg;base64,ZZZ')
    expect(bouton()!.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(bouton()!.querySelector('img')).not.toBeNull()
  })

  it('un clic ouvre bien le sélecteur de fichier', () => {
    monter(true)
    const input = document.getElementById('emp-photo-input') as HTMLInputElement
    expect(input, 'le champ fichier doit exister').not.toBeNull()
    const clic = vi.spyOn(input, 'click')
    fireEvent.click(bouton()!)
    expect(clic).toHaveBeenCalledTimes(1)
  })

  it('⚠️ en LECTURE : aucun bouton — pas de cible clavier qui ne fait rien', () => {
    // Contrôle discriminant. Sans lui, les cas ci-dessus seraient verts d'un composant
    // qui rendrait le bouton en toute circonstance, y compris là où il n'agit pas.
    monter(false)
    expect(bouton()).toBeNull()
  })

  it('⚠️ ON PEUT RETIRER la photo — pas seulement la remplacer', () => {
    /**
     * Signalé sur capture : une fois la photo chargée, aucun chemin ne ramenait aux
     * initiales. Le serveur savait pourtant effacer (`photo: z.string().nullish()`) —
     * c'est l'écran qui n'offrait pas l'intention.
     */
    const { setForm } = monter(true, 'data:image/jpeg;base64,ZZZ')
    const b = boutonRetrait()
    expect(b, 'aucun bouton de retrait : la photo est définitive').not.toBeNull()
    fireEvent.click(b!)
    expect(setForm).toHaveBeenCalledTimes(1)
    const maj = setForm.mock.calls[0][0] as (f: Record<string, unknown>) => Record<string, unknown>
    // ⚠️ Chaîne VIDE et non `undefined` : `toEmployeeWrite` en fait un `photo: null`
    // EXPLICITE, seule valeur qui EFFACE côté serveur. `undefined` ne toucherait à rien.
    expect(maj({ photoUrl: 'x', name: 'A' }).photoUrl).toBe('')
  })

  it('⚠️ le bouton de retrait N’EXISTE PAS sans photo — rien à retirer', () => {
    // Contrôle discriminant : sans lui, le cas ci-dessus serait vert d'un composant qui
    // rendrait ce bouton en toute circonstance, y compris là où il ne fait rien.
    monter(true)
    expect(boutonRetrait()).toBeNull()
  })

  it('le retrait n’apparaît pas non plus en LECTURE', () => {
    monter(false, 'data:image/jpeg;base64,ZZZ')
    expect(boutonRetrait()).toBeNull()
  })

  it('⚠️ RÉVERSIBLE — le retrait ne quitte pas le formulaire avant « Sauvegarder »', () => {
    /**
     * C'EST CE QUI JUSTIFIE L'ABSENCE DE CONFIRMATION. Si un `X` cliqué par erreur était
     * définitif, il faudrait demander confirmation ; s'il se défait par « Annuler », la
     * demander userait l'alarme pour rien. La justification ne vaut que si elle est VRAIE
     * — je l'avais écrite avant de l'avoir prouvée.
     *
     * Le retrait ne doit toucher QUE `editEmpForm`. Rien vers la liste, rien vers le
     * serveur : `selectedEmp` conserve la photo, et c'est de LUI que « Annuler » réamorce.
     */
    const { setForm, setEmployees } = monter(true, 'data:image/jpeg;base64,ZZZ')
    fireEvent.click(boutonRetrait()!)
    expect(setForm).toHaveBeenCalledTimes(1)
    expect(setEmployees, 'la liste ne doit pas bouger tant qu’on n’a pas sauvegardé').not.toHaveBeenCalled()
  })

  it('⚠️ « Annuler » réamorce depuis l’employé D’ORIGINE, photo comprise', () => {
    // `openEditModal(selectedEmp)` relit `emp.photoUrl` (HR.tsx:103). Comme le retrait
    // n'a pas touché `selectedEmp`, la photo revient. Le chaînon testé ici est l'APPEL
    // avec le bon objet — celui qui porte encore la photo.
    const { ouvrirFiche } = monter(true, '')
    fireEvent.click(screen.getByText(/^Annuler$/))
    expect(ouvrirFiche).toHaveBeenCalledTimes(1)
    const arg = ouvrirFiche.mock.calls[0][0] as { photoUrl?: string; name: string }
    expect(arg.name).toBe('Kofi Diallo')
    expect(arg.photoUrl, 'on réamorce depuis un objet SANS photo : la restauration serait vide').toBe('photo-origine')
  })

  it('⚠️ le `title` RESTE — en supplément, jamais comme seule voie', () => {
    // Le retirer punirait l'utilisateur souris pour un défaut qui concernait le tactile.
    monter(true)
    expect(bouton()!.getAttribute('title')).toMatch(/photo/i)
  })
})
