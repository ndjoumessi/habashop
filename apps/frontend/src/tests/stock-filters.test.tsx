import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FilterSelect, { type FilterOption } from '@/components/ui/FilterSelect'
import { normCat } from '@/utils/normCat'

/**
 * Ancrage des filtres Stock : la primitive FilterSelect (remplace les <select>
 * natifs) + la dédup par nom normalisé. Purement présentationnel — la VALEUR
 * émise reste la chaîne d'origine (le filtrage en amont est inchangé).
 */
describe('normCat — clé de regroupement catégorie', () => {
  it('fusionne les variantes emoji / casse / espaces', () => {
    expect(normCat('Épicerie')).toBe(normCat('épicerie'))
    expect(normCat('🥥 Épicerie')).toBe(normCat('Épicerie'))
    expect(normCat('  Épicerie  ')).toBe(normCat('Épicerie'))
  })
  it('garde distinctes les catégories réellement différentes', () => {
    expect(normCat('Épicerie')).not.toBe(normCat('Boissons'))
  })
})

describe('FilterSelect', () => {
  const OPTS: FilterOption[] = [
    { value: '', label: 'Toutes les catégories' },
    { value: 'Épicerie', label: 'Épicerie' },
    { value: 'Boissons', label: 'Boissons' },
  ]

  it("affiche le label sélectionné et ouvre le menu au clic", () => {
    render(<FilterSelect value="Épicerie" onChange={() => {}} options={OPTS} ariaLabel="Catégorie" />)
    const trigger = screen.getByRole('button', { name: 'Catégorie' })
    // Label sélectionné visible sur le trigger
    expect(trigger).toHaveTextContent('Épicerie')
    // Menu fermé au départ
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeTruthy()
    // L'option sélectionnée est marquée aria-selected
    const selected = screen.getByRole('option', { selected: true })
    expect(selected).toHaveTextContent('Épicerie')
  })

  it("émet la VALEUR d'origine au choix d'une option (logique filtre inchangée)", () => {
    const onChange = vi.fn()
    render(<FilterSelect value="" onChange={onChange} options={OPTS} ariaLabel="Catégorie" />)
    fireEvent.click(screen.getByRole('button', { name: 'Catégorie' }))
    fireEvent.click(screen.getByRole('option', { name: 'Boissons' }))
    expect(onChange).toHaveBeenCalledWith('Boissons')
    // Menu refermé après sélection
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('dédup affichée : une seule entrée par nom normalisé', () => {
    // Reproduit la construction des options du composant Stock
    const cats = ['', '🥥 Épicerie', 'Épicerie', 'Boissons']
    const seen = new Set<string>()
    const options: FilterOption[] = [{ value: '', label: 'Toutes les catégories' }]
    for (const c of cats) {
      if (!c) continue
      const k = normCat(c)
      if (seen.has(k)) continue
      seen.add(k)
      options.push({ value: c, label: c })
    }
    // 🥥 Épicerie + Épicerie fusionnés → 1 entrée ; + Boissons + "Toutes" = 3
    expect(options).toHaveLength(3)
    expect(options.map(o => o.label)).toEqual(['Toutes les catégories', '🥥 Épicerie', 'Boissons'])
  })
})
