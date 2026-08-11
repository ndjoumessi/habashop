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
  perf: 4, address: '', photoUrl: undefined,
}

function monter(edition: boolean, photoUrl?: string) {
  render(
    <EditEmployeeModal
      lang="fr" fmt={(n: number) => String(n)}
      selectedEmp={EMP as never}
      editEmpForm={{ ...empFormVide(), name: EMP.name, color: EMP.color, isActive: true, photoUrl }}
      setEditEmpForm={vi.fn()}
      empEditMode={edition} setEmpEditMode={vi.fn()}
      salaryInput="120000" setSalaryInput={vi.fn()}
      toXOF={(n: number) => n}
      currency="XOF" currencySymbol="FCFA"
      setEmployees={vi.fn()} setShowEditEmpModal={vi.fn()} openEditModal={vi.fn()}
    />,
  )
}

const bouton = () => screen.queryByRole('button', { name: /photo/i })

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

  it('⚠️ le `title` RESTE — en supplément, jamais comme seule voie', () => {
    // Le retirer punirait l'utilisateur souris pour un défaut qui concernait le tactile.
    monter(true)
    expect(bouton()!.getAttribute('title')).toMatch(/photo/i)
  })
})
