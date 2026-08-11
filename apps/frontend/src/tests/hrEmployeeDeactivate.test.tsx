import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * DÉSACTIVER, PAS SUPPRIMER — et surtout : ATTEINDRE LE SERVEUR.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * Le bouton disait « Supprimer », confirmait par « Cette action est irréversible »,
 * et ne faisait qu'un `setEmployees(prev => prev.filter(...))`. `employeesApi.delete`
 * n'avait AUCUN site d'appel : rien ne partait, et la personne revenait au
 * rechargement. Un mot qui promet la destruction sur une action qui n'agit pas est
 * pire qu'un bouton absent — on lui fait confiance.
 *
 * ⚠️ DÉCISION PRODUIT (Nelson, 2026-08-11) : on DÉSACTIVE. Le backend le disait déjà
 * à sa façon — sa route `DELETE` fait un `prisma.employee.delete()` DUR et refuse en
 * `409 EMPLOYEE_HAS_PAYROLL` dès qu'un bulletin existe. Effacer quelqu'un qui a été
 * payé rendrait la paie passée irrécupérable, ce que l'instantané gelé des bulletins
 * existe précisément pour empêcher.
 */

const MAJ = vi.fn()
vi.mock('@/lib/api', () => ({ employeesApi: { update: (...a: unknown[]) => MAJ(...a) } }))
vi.mock('@/lib/confirm', () => ({ confirm: (...a: unknown[]) => CONFIRME(...a) }))
const CONFIRME = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...a: unknown[]) => TOAST(...a), error: vi.fn() },
  __esModule: true,
}))
const TOAST = vi.fn()

import EditEmployeeModal from '@/components/hr/modals/EditEmployeeModal'
import { empFormVide } from '@/components/hr/hrShared'

const EMP = {
  id: 'emp-cuid' as unknown as number, name: 'Aminata Touré', role: 'Vendeuse',
  dept: 'Ventes', type: 'CDD', salary: 120000, hiredAt: '2026-01-15',
  avatar: 'AT', color: '#10B981', active: true, phone: '', email: '',
  perf: 4, address: '', photoUrl: undefined,
}

function monter(emp = EMP) {
  const setEmployees = vi.fn()
  const setShow = vi.fn()
  render(
    <EditEmployeeModal
      lang="fr" fmt={(n: number) => String(n)}
      selectedEmp={emp as never}
      editEmpForm={{ ...empFormVide(), name: emp.name, isActive: emp.active }}
      setEditEmpForm={vi.fn()}
      // ⚠️ Le bouton vit dans la branche ÉDITION, aux côtés de Sauvegarder/Annuler —
      // vérifié en sondant les boutons réellement rendus, après m'être trompé de branche.
      empEditMode setEmpEditMode={vi.fn()}
      salaryInput="120000" setSalaryInput={vi.fn()}
      toXOF={(n: number) => n}
      currency="XOF" currencySymbol="FCFA"
      setEmployees={setEmployees}
      setShowEditEmpModal={setShow}
      openEditModal={vi.fn()}
    />,
  )
  return { setEmployees, setShow }
}

beforeEach(() => {
  vi.clearAllMocks()
  CONFIRME.mockResolvedValue(true)
  MAJ.mockResolvedValue({ id: 'emp-cuid', isActive: false })
})

describe('bouton de désactivation', () => {
  it('⚠️ ATTEINT LE SERVEUR — c’est tout le défaut d’origine', async () => {
    monter()
    fireEvent.click(screen.getByLabelText(/Désactiver l’employé|Désactiver l'employé/))
    await waitFor(() => expect(MAJ).toHaveBeenCalledTimes(1))
    expect(MAJ.mock.calls[0][0]).toBe('emp-cuid')
    expect(MAJ.mock.calls[0][1]).toEqual({ isActive: false })
  })

  it('⚠️ le corps est MINIMAL — la fiche peut être ouverte sans avoir été modifiée', async () => {
    // Envoyer tout le formulaire écraserait des champs que personne n'a touchés :
    // la modale s'ouvre en LECTURE, `editEmpForm` y est un instantané, pas une saisie.
    monter()
    fireEvent.click(screen.getByLabelText(/Désactiver l/))
    await waitFor(() => expect(MAJ).toHaveBeenCalled())
    expect(Object.keys(MAJ.mock.calls[0][1] as object)).toEqual(['isActive'])
  })

  it('⚠️ la personne RESTE dans la liste, marquée inactive', async () => {
    // La retirer ferait lire « désactivé » comme « supprimé ». Le filtre de statut vaut
    // « all » par défaut : elle reste visible, avec sa pastille rouge.
    const { setEmployees } = monter()
    fireEvent.click(screen.getByLabelText(/Désactiver l/))
    await waitFor(() => expect(setEmployees).toHaveBeenCalled())
    const maj = setEmployees.mock.calls[0][0] as (p: unknown[]) => unknown[]
    const apres = maj([{ ...EMP }]) as { active: boolean }[]
    expect(apres, 'la liste ne doit pas rétrécir').toHaveLength(1)
    expect(apres[0].active).toBe(false)
  })

  it('⚠️ REFUS SERVEUR : liste inchangée, modale ouverte, aucun succès annoncé', async () => {
    MAJ.mockRejectedValue(new Error('Erreur serveur'))
    const { setEmployees, setShow } = monter()
    fireEvent.click(screen.getByLabelText(/Désactiver l/))
    await waitFor(() => expect(MAJ).toHaveBeenCalled())
    await waitFor(() => expect(setEmployees).not.toHaveBeenCalled())
    expect(setShow).not.toHaveBeenCalledWith(false)
    expect(TOAST).not.toHaveBeenCalled()
  })

  it('un refus de la CONFIRMATION n’envoie rien', async () => {
    CONFIRME.mockResolvedValue(false)
    monter()
    fireEvent.click(screen.getByLabelText(/Désactiver l/))
    await new Promise(r => setTimeout(r, 10))
    expect(MAJ).not.toHaveBeenCalled()
  })

  it('⚠️ la confirmation ne promet plus l’IRRÉVERSIBLE, et n’est pas peinte en rouge', async () => {
    /**
     * Le texte d'origine annonçait « Cette action est irréversible » sur une action
     * qui n'agissait pas. Elle agit désormais — et elle est RÉVERSIBLE (la pastille de
     * statut réactive). Peindre en rouge ce qui se défait d'un clic use l'alarme.
     */
    monter()
    fireEvent.click(screen.getByLabelText(/Désactiver l/))
    await waitFor(() => expect(CONFIRME).toHaveBeenCalled())
    const arg = CONFIRME.mock.calls[0][0] as { title: string; message: string; danger?: boolean }
    expect(arg.message).not.toMatch(/irréversible/i)
    expect(arg.message, 'la réversibilité doit être DITE, pas devinée').toMatch(/réactiver/i)
    expect(arg.title).toMatch(/Désactiver/i)
    expect(arg.danger).toBe(false)
  })

  it('⚠️ le bouton DISPARAÎT sur une personne déjà inactive', async () => {
    // Un bouton qui ne peut rien faire est un bouton qui ment sur sa disponibilité.
    monter({ ...EMP, active: false })
    expect(screen.queryByLabelText(/Désactiver l/)).toBeNull()
  })
})
