import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { EMPLOYEES } = vi.hoisted(() => ({
  EMPLOYEES: [
    { id: 'emp1', name: 'Marie Bakayoko', role: 'Caissière', dept: 'Vente',   color: '#6C47FF', isActive: true },
    { id: 'emp2', name: 'Kofi Diallo',    role: 'Magasinier', dept: 'Stock',   color: '#00B8FF', isActive: true },
    { id: 'emp3', name: 'Aminata Touré',  role: 'Manager',    dept: 'Direction', color: '#FF9500', isActive: false },
  ],
}))
vi.mock('@/lib/api', () => ({
  employeesApi:     { list: vi.fn().mockResolvedValue(EMPLOYEES) },
  shiftsApi:        { list: vi.fn().mockResolvedValue([]), upsert: vi.fn().mockResolvedValue({ id: 's1' }), remove: vi.fn().mockResolvedValue({ success: true }) },
  leaveRequestsApi: { list: vi.fn().mockResolvedValue([]) },
}))

// Lundi de la semaine courante en "YYYY-MM-DD" (même calcul que Planning.weekDays[0]).
const mondayYmd = () => {
  const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// store : lang fr, en gardant les vraies fns
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel?: any) => sel ? sel(mockState) : mockState)
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Planning from '@/pages/Planning'
import { shiftsApi } from '@/lib/api'

// ⚠️ `shiftsApi.list(mois)` FILTRE PAR MOIS côté serveur : la requête « 2026-08 » ne renvoie PAS
// un shift daté du 27/07. Or `Planning.loadWeek` charge TOUS les mois couverts par la plage
// affichée — donc DEUX appels quand la semaine enjambe une fin de mois. Un mock qui rend le même
// shift à tous les mois le fait apparaître en DOUBLE dans la case (`results.flat()`), ce qui
// rendait ce fichier rouge ~78 jours par an. Le mock doit modéliser le filtre, pas l'ignorer.
const mockShifts = (rows: { id: string; employeeId: string; date: string; shiftTypeKey: string }[]) =>
  (shiftsApi.list as any).mockImplementation((month: string) =>
    Promise.resolve(rows.filter(r => r.date.slice(0, 7) === month)))

beforeEach(() => {
  // Horloge GELÉE sur un mardi dont la semaine (lun. 27/07 → dim. 02/08) enjambe deux mois : la
  // configuration qui a fait tomber le test reste ainsi exercée en PERMANENCE, au lieu de ne
  // l'être qu'une semaine par mois. Seul `Date` est simulé — `setTimeout` reste RÉEL, sinon les
  // `waitFor` de testing-library ne progresseraient plus.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-28T10:00:00Z'))
  vi.clearAllMocks()
  localStorage.clear()
  ;(shiftsApi.list as any).mockResolvedValue([]) // défaut : aucun shift (réinitialisé par test)
})

afterEach(() => { vi.useRealTimers() })

describe('Planning — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge et affiche les employés actifs (inactifs exclus)', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    expect(screen.getByText('Kofi')).toBeInTheDocument()
    // Aminata est inactive → exclue
    expect(screen.queryByText('Aminata')).not.toBeInTheDocument()
  })

  it('affiche les 7 en-têtes de jour de la semaine', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Dim')).toBeInTheDocument()
  })

  it('le filtre par département réduit la liste', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    const deptSelect = screen.getByDisplayValue('Tous les départements')
    fireEvent.change(deptSelect, { target: { value: 'Stock' } })
    expect(screen.queryByText('Marie')).not.toBeInTheDocument()
    expect(screen.getByText('Kofi')).toBeInTheDocument()
  })

  it('le filtre par type de shift réduit la liste (employés sans ce shift exclus)', async () => {
    // Marie (emp1) a un shift "matin" lundi (via /api/shifts) ; Kofi (emp2) aucun.
    mockShifts([{ id: 's1', employeeId: 'emp1', date: mondayYmd(), shiftTypeKey: 'morning' }])
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    const shiftSelect = screen.getByDisplayValue('Tous les shifts')
    // Filtre "Matin" → seul Marie reste (waitFor : les shifts arrivent en async depuis l'API)
    fireEvent.change(shiftSelect, { target: { value: 'morning' } })
    await waitFor(() => {
      expect(screen.getByText('Marie')).toBeInTheDocument()
      expect(screen.queryByText('Kofi')).not.toBeInTheDocument()
    })
    // Filtre "Après-midi" → personne (aucun n'a ce shift)
    fireEvent.change(shiftSelect, { target: { value: 'afternoon' } })
    await waitFor(() => expect(screen.queryByText('Marie')).not.toBeInTheDocument())
    expect(screen.queryByText('Kofi')).not.toBeInTheDocument()
  })

  it('clic sur une case vide ouvre la modale d’assignation', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    // les cases vides affichent un "+"
    const plus = screen.getAllByText('+')
    fireEvent.click(plus[0])
    expect(await screen.findByText(/Assigner un shift/i)).toBeInTheDocument()
  })

  it('confirme l’assignation d’un shift → upsert /api/shifts et ferme la modale', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('+')[0])
    await screen.findByText(/Assigner un shift/i)
    fireEvent.click(screen.getByText(/Confirmer/i))
    await waitFor(() => expect(screen.queryByText(/Assigner un shift/i)).not.toBeInTheDocument())
    // le shift est persisté via l'API (plus de localStorage)
    expect(shiftsApi.upsert).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'emp1', shiftTypeKey: 'full' }))
  })

  it('affiche le résumé de stats après assignation', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('+')[0])
    await screen.findByText(/Assigner un shift/i)
    fireEvent.click(screen.getByText(/Confirmer/i))
    await waitFor(() => expect(screen.queryByText(/Assigner un shift/i)).not.toBeInTheDocument())
    // "Journée" (full = shift par défaut) apparaît dans la légende ET dans les stats
    await waitFor(() => expect(screen.getAllByText('Journée').length).toBeGreaterThan(1))
  })

  it('Phase 7 — "Copier → suiv." duplique les shifts à J+7 (upsert /api/shifts)', async () => {
    mockShifts([{ id: 's1', employeeId: 'emp1', date: mondayYmd(), shiftTypeKey: 'morning' }])
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    // attend que le shift source soit chargé dans la grille (cellule + légende = ≥2 occurrences)
    await waitFor(() => expect(screen.getAllByText('08:00-13:00').length).toBeGreaterThanOrEqual(2))
    fireEvent.click(screen.getByText(/Copier/i))
    // upsert du même shift au lundi suivant (mondayYmd + 7 j)
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) + 7)
    const nextMonday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await waitFor(() => expect(shiftsApi.upsert).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'emp1', date: nextMonday, shiftTypeKey: 'morning' })))
  })

  it('Phase 7 — drag&drop : déplace le shift (upsert cible + delete source)', async () => {
    // Marie (emp1) a un shift matin lundi (id s1) ; on le glisse vers la case lundi de Kofi (emp2).
    mockShifts([{ id: 's1', employeeId: 'emp1', date: mondayYmd(), shiftTypeKey: 'morning' }])
    const { container } = render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByText('08:00-13:00').length).toBeGreaterThanOrEqual(2))
    // lignes employés (Marie=0, Kofi=1). `td > div` = [div nom, div lundi, div mardi, …] →
    // la case du lundi (di=0) est à l'index 1 (index 0 = cellule nom/avatar).
    const rows = container.querySelectorAll('tbody tr')
    const marieMon = rows[0].querySelectorAll('td > div')[1] as HTMLElement
    const kofiMon  = rows[1].querySelectorAll('td > div')[1] as HTMLElement
    // Multi-shift : le SHIFT (chip draggable) porte son type ; on glisse le chip, on dépose sur la case cible.
    const marieMonChip = marieMon.querySelector('[draggable="true"]') as HTMLElement
    const store: Record<string, string> = {}
    const dataTransfer = { setData: (k: string, v: string) => { store[k] = v }, getData: (k: string) => store[k] ?? '', effectAllowed: '' }
    fireEvent.dragStart(marieMonChip, { dataTransfer })
    fireEvent.drop(kofiMon, { dataTransfer })
    // upsert du shift matin sur Kofi (cible) + suppression du shift source (id s1)
    await waitFor(() => expect(shiftsApi.upsert).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'emp2', date: mondayYmd(), shiftTypeKey: 'morning' })))
    expect(shiftsApi.remove).toHaveBeenCalledWith('s1')
  })

  it('multi-shift : cliquer une case déjà pleine AJOUTE le shift actif (les deux types coexistent)', async () => {
    // Marie a un shift matin lundi ; le shift actif par défaut = "full" (Journée).
    mockShifts([{ id: 's1', employeeId: 'emp1', date: mondayYmd(), shiftTypeKey: 'morning' }])
    const { container } = render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByText('08:00-13:00').length).toBeGreaterThanOrEqual(2))
    const rows = container.querySelectorAll('tbody tr')
    const marieMon = rows[0].querySelectorAll('td > div')[1] as HTMLElement
    fireEvent.click(marieMon) // case pleine → AJOUTE le type actif (full), n'écrase pas matin
    // upsert du 2ᵉ type (full) le même jour
    await waitFor(() => expect(shiftsApi.upsert).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'emp1', date: mondayYmd(), shiftTypeKey: 'full' })))
    // les DEUX types coexistent dans la case (2 chips draggables : matin + journée)
    await waitFor(() => expect(marieMon.querySelectorAll('[draggable="true"]').length).toBe(2))
  })

  it('vue Mois : la bascule affiche la grille calendaire et agrège les shifts en pastilles', async () => {
    const today = new Date()
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const mid = `${ym}-15` // 15 du mois courant
    // mock fidèle à l'API : ne renvoie le shift que pour le mois demandé (la grille mois interroge ≤3 mois).
    ;(shiftsApi.list as any).mockImplementation((m: string) => Promise.resolve(m === ym ? [{ id: 's1', employeeId: 'emp1', date: mid, shiftTypeKey: 'morning' }] : []))
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    // bascule vers la vue mois
    fireEvent.click(screen.getByRole('button', { name: 'Mois' }))
    // la grille du mois affiche le numéro de jour 15 (cellule avec title = date)
    await waitFor(() => expect(screen.getByText('15')).toBeInTheDocument())
    const cell15 = screen.getByText('15').closest('[title]') as HTMLElement
    // la cellule agrège le shift matin → compteur "1"
    await waitFor(() => expect(within(cell15).getByText('1')).toBeInTheDocument())
    // le bouton "Copier" (semaine uniquement) est masqué en vue mois
    expect(screen.queryByText(/Copier/)).not.toBeInTheDocument()
  })

  it('vue Mois : cliquer un jour ramène à la vue semaine (drill)', async () => {
    const today = new Date()
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const mid = `${ym}-15`
    ;(shiftsApi.list as any).mockImplementation((m: string) => Promise.resolve(m === ym ? [{ id: 's1', employeeId: 'emp1', date: mid, shiftTypeKey: 'morning' }] : []))
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Mois' }))
    await waitFor(() => expect(screen.queryByText(/Copier/)).not.toBeInTheDocument()) // confirme vue mois
    fireEvent.click(screen.getByText('15')) // drill sur le 15
    // retour vue semaine : le bouton "Copier" réapparaît
    await waitFor(() => expect(screen.getByText(/Copier/)).toBeInTheDocument())
  })
})
