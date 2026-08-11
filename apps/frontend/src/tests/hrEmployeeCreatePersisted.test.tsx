import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HRModals from '@/components/hr/HRModals'

/**
 * VERROU — la création d'employé ATTEINT LE SERVEUR, et un refus ne se déguise pas en succès.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `employeesApi.create` existait dans `lib/api.ts` (ligne 361) sans AUCUN site d'appel. Les
 * deux modales de création — « Ajouter un employé » (`EmpModal` via `HRModals`) et « Nouveau
 * contrat » (`NewContractModal`) — construisaient un `Employee` avec `id: Date.now()`,
 * l'empilaient dans l'état local et affichaient « Employé ajouté ». Rien ne partait au
 * serveur : la fiche disparaissait au rechargement.
 *
 * ⚠️ Et l'id inventé était pire que la disparition — il n'était l'id d'AUCUNE ligne, donc
 * toute écriture ultérieure sur cette personne (modification, suppression, bulletin de paie)
 * visait un enregistrement inexistant. Le seul chemin d'écriture réel était
 * `EditEmployeeModal` → `toEmployeeWrite` → `employeesApi.update`.
 *
 * ⚠️ CE QUE CE FICHIER DISCRIMINE, et que l'ancien test d'ancrage ne discriminait pas :
 * celui-ci n'assertait que `setEmployees`, donc il restait VERT sur un écran qui n'écrivait
 * nulle part — il décrivait ce que le code FAISAIT au lieu d'affirmer ce qu'il DOIT faire.
 * L'assertion qui tranche est `employeesApi.create`, et l'id qui atterrit dans la liste.
 *
 * ⚠️ LE MOCK APPLIQUE SON ARGUMENT. `create` DÉRIVE sa réponse du corps reçu au lieu de rendre
 * un objet fixe : sans cela le test resterait vert si le code cessait d'envoyer le payload
 * (cf. règle « mock qui ignore ses arguments »). L'id rendu est un cuid, jamais un nombre —
 * c'est lui qu'on retrouve dans la liste, et c'est ainsi qu'on prouve que `Date.now()` est mort.
 */

const CREE = vi.fn()
const MAJ = vi.fn()

vi.mock('@/lib/api', () => ({
  employeesApi: {
    create: (data: unknown) => CREE(data),
    update: (id: string, data: unknown) => MAJ(id, data),
  },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/announce', () => ({ announce: vi.fn() }))
vi.mock('@/stores/appStore', () => ({
  useConvertToXOF: () => (n: number) => n,
  useConvertFromXOF: () => (n: number) => n,
  useCurrencyInfo: () => ({ code: 'XOF', symbol: 'F', decimals: 0, currency: 'XOF' }),
  useAppStore: (sel: any) => sel({ lang: 'fr' }),
  useConfig: () => ({ lang: 'fr', currency: 'XOF' }),
  CURRENCY_SYMBOLS: { XOF: 'FCFA', EUR: '€' },
  CURRENCY_DECIMALS: { XOF: 0, EUR: 2 },
  convertFromXOF: (n: number) => n,
  convertAmount: (n: number) => n,
  formatInCurrency: (n: number) => `${n} FCFA`,
  formatAmount: (n: number) => `${n} FCFA`,
  t: (k: string) => k,
}))
vi.mock('@/components/ui/ValidatedInput', () => ({ default: ({ label, value, onChange, placeholder }: any) => <input aria-label={label || placeholder || 'vi'} value={value} onChange={e => onChange(e.target.value)} /> }))
vi.mock('@/components/ui/PhoneInputWithCountry', () => ({ default: ({ label, value, onChange }: any) => <input aria-label={label || 'phone'} value={value} onChange={e => onChange(e.target.value)} /> }))

/** Réponse serveur DÉRIVÉE du corps reçu — le mock applique son argument. */
function reponseDepuis(data: any) {
  return {
    id: 'emp-cuid-du-serveur', tenantId: 't1',
    name: data.name, role: data.role, dept: data.dept, type: data.type,
    salary: data.salary ?? 0, phone: data.phone ?? null, email: data.email ?? null,
    address: data.address ?? null, photo: data.photo ?? null,
    hiredAt: data.hiredAt || '2026-01-01', endAt: null,
    isActive: data.isActive, perf: data.perf ?? null,
    avatar: data.avatar, color: data.color,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null,
  }
}

const EMP_EXISTANT = {
  id: 'emp-cuid-marie', name: 'Marie Bakayoko', role: 'Caissière', dept: 'Ventes',
  salary: 200000, type: 'CDI', hiredAt: '2024-01-15', avatar: 'MB', color: '#6C3FD6',
  active: true, phone: '77', email: 'm@x.com', perf: 3,
}

function makeProps(overrides: any = {}) {
  return {
    showSalaryModal: false, setShowSalaryModal: vi.fn(), salaryTarget: null,
    lang: 'fr', fmt: (n: number) => `${n} F`,
    employees: [EMP_EXISTANT] as any, setEmployees: vi.fn(),
    handleConfirmRaise: vi.fn(), handleConfirmBonus: vi.fn(),
    showModal: false, setShowModal: vi.fn(),
    showEditEmpModal: false, setShowEditEmpModal: vi.fn(),
    selectedEmp: null, editEmpForm: {}, setEditEmpForm: vi.fn(),
    empEditMode: false, setEmpEditMode: vi.fn(),
    salaryInput: '', setSalaryInput: vi.fn(),
    toXOF: (n: number) => n, currency: 'XOF', currencySymbol: 'F',
    openEditModal: vi.fn(),
    showNewContractModal: false, setShowNewContractModal: vi.fn(),
    contractForm: { empId: '', role: '', dept: 'Ventes', type: 'CDI', hiredAt: '', contractEnd: '', salary: 0 }, setContractForm: vi.fn(),
    showContractDetailModal: false, setShowContractDetailModal: vi.fn(), selectedContract: null,
    showLeaveModal: false, setShowLeaveModal: vi.fn(),
    leaveForm: { empId: '', type: '', startDate: '', endDate: '', notes: '' }, setLeaveForm: vi.fn(),
    onSubmitLeave: vi.fn(),
    ...overrides,
  }
}

/** Déroule l'updater passé à `setEmployees` — c'est la LISTE qui compte, pas l'appel. */
function listeApres(setEmployees: any, avant: any[]) {
  const updater = setEmployees.mock.calls[0][0]
  return typeof updater === 'function' ? updater(avant) : updater
}

beforeEach(() => {
  vi.clearAllMocks()
  CREE.mockImplementation((data: any) => Promise.resolve(reponseDepuis(data)))
  MAJ.mockImplementation(() => Promise.resolve({}))
})

describe('Création employé — « Ajouter un employé » (EmpModal)', () => {
  async function remplirEtAjouter(p: any) {
    render(<HRModals {...p} />)
    fireEvent.change(screen.getByLabelText(/^Nom complet/), { target: { value: '  Jean Test  ' } })
    fireEvent.change(screen.getByLabelText(/^Poste/), { target: { value: 'Vendeur' } })
    fireEvent.click(screen.getByText(/^Ajouter$/))
  }

  it('envoie un corps conforme à EMPLOYEE_FIELDS — `isActive`, jamais `active`', async () => {
    const p = makeProps({ showModal: true })
    await remplirEtAjouter(p)
    await waitFor(() => expect(CREE).toHaveBeenCalledTimes(1))
    const corps = CREE.mock.calls[0][0] as Record<string, unknown>
    // ⚠️ LA clé du défaut : la modale émettait `active`, que la liste blanche zod STRIPPE en
    // silence — l'employé serait arrivé en base sans son statut, comme la photo avant #185.
    expect(corps).toHaveProperty('isActive', true)
    expect(corps).not.toHaveProperty('active')
    expect(corps.name).toBe('Jean Test')       // trimmé
    expect(corps.avatar).toBe('JT')            // `initialesDe`, source unique
    // ⚠️ Le corps doit être le MIROIR d'`EMPLOYEE_FIELDS`, pas le formulaire étalé : les noms
    // d'ÉCRAN n'existent pas sur le fil, et la liste blanche zod les strippe SANS RIEN DIRE.
    // Sans ces trois lignes, un `{ ...form, ...extra }` passerait ce test — vérifié (sabotage 2).
    expect(corps).not.toHaveProperty('photoUrl')     // le fil porte `photo`
    // ⚠️ `contractEnd` est un nom d'ÉCRAN : il serait STRIPPÉ par la liste blanche zod.
    // (Le commentaire d'origine disait « le fil ne l'accepte pas encore » — c'était vrai
    //  jusqu'au 2026-08-11 ; le fil accepte désormais `endAt`, mais toujours pas ce nom-là.)
    expect(corps).not.toHaveProperty('contractEnd')
    expect(corps).toHaveProperty('photo')
  })

  it('l’id vient du SERVEUR — plus jamais `Date.now()`', async () => {
    const p = makeProps({ showModal: true })
    await remplirEtAjouter(p)
    await waitFor(() => expect(p.setEmployees).toHaveBeenCalled())
    const [ajoute] = listeApres(p.setEmployees, []) as any[]
    expect(String(ajoute.id)).toBe('emp-cuid-du-serveur')
    // Un id fabriqué localement était un horodatage : un nombre à 13 chiffres, jamais un cuid.
    expect(String(ajoute.id)).not.toMatch(/^\d{10,}$/)
  })

  it('REFUS SERVEUR : rien dans la liste, modale ouverte, aucun succès annoncé', async () => {
    const toast = (await import('react-hot-toast')).default as any
    CREE.mockImplementation(() => Promise.reject(new Error('Nom requis')))
    const p = makeProps({ showModal: true })
    await remplirEtAjouter(p)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nom requis'))
    // ⚠️ Les trois assertions comptent ENSEMBLE : c'est la combinaison « liste inchangée +
    // modale ouverte + aucun succès » qui distingue un refus honnête d'un refus avalé.
    expect(p.setEmployees).not.toHaveBeenCalled()
    expect(p.setShowModal).not.toHaveBeenCalledWith(false)
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('Création employé — « Nouveau contrat » (NewContractModal)', () => {
  const CONTRAT = { empId: 'Awa Ndiaye', role: 'Vendeuse', dept: 'Ventes', type: 'CDD', hiredAt: '2026-05-01', contractEnd: '2026-11-30', salary: 150000 }

  it('personne inconnue → POST, et l’id vient du serveur', async () => {
    const p = makeProps({ showNewContractModal: true, contractForm: CONTRAT })
    render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Créer le contrat/))
    await waitFor(() => expect(CREE).toHaveBeenCalledTimes(1))
    const corps = CREE.mock.calls[0][0] as Record<string, unknown>
    expect(corps).toMatchObject({ name: 'Awa Ndiaye', role: 'Vendeuse', type: 'CDD', salary: 150000, isActive: true })
    // ⚠️ ISO `yyyy-mm-dd`, jamais `fr-FR` : ce bloc écrivait `toLocaleDateString('fr-FR')`, et
    // `new Date('05/01/2026')` est lu M/J/A côté serveur — le 5 janvier serait rangé au 1er mai.
    expect(corps.hiredAt).toBe('2026-05-01')
    expect(String(corps.hiredAt)).not.toMatch(/\//)
    const [ajoute] = listeApres(p.setEmployees, []) as any[]
    expect(String(ajoute.id)).toBe('emp-cuid-du-serveur')
  })

  it('personne DÉJÀ dans l’effectif → PUT, jamais un POST (pas d’homonyme)', async () => {
    const p = makeProps({
      showNewContractModal: true,
      contractForm: { ...CONTRAT, empId: 'Marie Bakayoko', role: 'Responsable' },
    })
    render(<HRModals {...p} />)
    // Sélection dans le combobox : c'est elle qui bascule sur le chemin « mise à jour ».
    // ⚠️ Le panneau s'ouvre au FOCUS et l'option se choisit au `mouseDown` (pas au `click`) —
    // sinon le `blur` fermerait la liste avant que la sélection n'aboutisse.
    // (Les `<select>` Département/Contrat portent aussi le rôle `combobox` — on vise le champ
    // de recherche par son placeholder, pas par un rôle qu'il partage.)
    fireEvent.focus(screen.getByPlaceholderText(/Rechercher ou saisir/))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Marie Bakayoko/ }))
    fireEvent.click(screen.getByText(/Créer le contrat/))
    await waitFor(() => expect(MAJ).toHaveBeenCalledTimes(1))
    expect(MAJ.mock.calls[0][0]).toBe('emp-cuid-marie')
    expect(MAJ.mock.calls[0][1]).toMatchObject({ role: 'Responsable', type: 'CDD', salary: 150000 })
    // ⚠️ Un POST ici dupliquerait la personne : bulletin de paie séparé, planning séparé.
    expect(CREE).not.toHaveBeenCalled()
  })

  it('⚠️ la DATE DE FIN part au serveur — chemin CRÉATION', async () => {
    /**
     * ⚠️ CE CAS MANQUAIT, et son absence a été trouvée par SABOTAGE, pas par relecture :
     * retirer l'envoi d'`endAt` laissait les 19 tests VERTS. Le champ avait déjà été « saisi
     * et jeté » une fois — c'est exactement ce qu'un verrou doit empêcher de recommencer.
     */
    const p = makeProps({ showNewContractModal: true, contractForm: CONTRAT })
    render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Créer le contrat/))
    await waitFor(() => expect(CREE).toHaveBeenCalledTimes(1))
    const corps = CREE.mock.calls[0][0] as Record<string, unknown>
    expect(corps.endAt, 'un CDD créé sans échéance est le défaut du 2026-08-11').toBe('2026-11-30T00:00:00.000Z')
  })

  it('⚠️ la DATE DE FIN part au serveur — chemin MISE À JOUR', async () => {
    // Le corps est PARTIEL ici (contrat seulement) : y passer tout le formulaire écraserait
    // téléphone, e-mail et photo. `endAt` doit malgré tout s'y trouver.
    const p = makeProps({
      showNewContractModal: true,
      contractForm: { ...CONTRAT, empId: 'Marie Bakayoko' },
    })
    render(<HRModals {...p} />)
    fireEvent.focus(screen.getByPlaceholderText(/Rechercher ou saisir/))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Marie Bakayoko/ }))
    fireEvent.click(screen.getByText(/Créer le contrat/))
    await waitFor(() => expect(MAJ).toHaveBeenCalledTimes(1))
    const corps = MAJ.mock.calls[0][1] as Record<string, unknown>
    expect(corps.endAt).toBe('2026-11-30T00:00:00.000Z')
    // ⚠️ Le corps reste PARTIEL : ces clés absentes prouvent qu'on n'écrase rien.
    expect(corps).not.toHaveProperty('phone')
    expect(corps).not.toHaveProperty('photo')
  })

  it('⚠️ une échéance EFFACÉE envoie `null`, pas `undefined` — requalifier un CDD en CDI', async () => {
    // `undefined` laisserait le serveur ne rien faire (`endAt !== undefined` est faux) : la
    // personne garderait son échéance pour toujours. Seul `null` efface.
    const p = makeProps({
      showNewContractModal: true,
      contractForm: { ...CONTRAT, empId: 'Marie Bakayoko', type: 'CDI', contractEnd: '' },
    })
    render(<HRModals {...p} />)
    fireEvent.focus(screen.getByPlaceholderText(/Rechercher ou saisir/))
    fireEvent.mouseDown(screen.getByRole('option', { name: /Marie Bakayoko/ }))
    fireEvent.click(screen.getByText(/Créer le contrat/))
    await waitFor(() => expect(MAJ).toHaveBeenCalledTimes(1))
    expect((MAJ.mock.calls[0][1] as Record<string, unknown>).endAt).toBeNull()
  })

  it('REFUS SERVEUR sur le contrat : liste inchangée, modale ouverte', async () => {
    CREE.mockImplementation(() => Promise.reject(new Error('Erreur création employé')))
    const p = makeProps({ showNewContractModal: true, contractForm: CONTRAT })
    render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Créer le contrat/))
    await waitFor(() => expect(CREE).toHaveBeenCalled())
    await waitFor(() => expect(p.setEmployees).not.toHaveBeenCalled())
    expect(p.setShowNewContractModal).not.toHaveBeenCalledWith(false)
  })
})
