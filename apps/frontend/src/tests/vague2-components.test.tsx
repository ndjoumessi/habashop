import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import Tabs from '@/components/ui/TabBar'
import Button from '@/components/ui/AppButton'
import FocusTooltip from '@/components/ui/FocusTooltip'

/**
 * Ancrage des composants unifiés de la Vague 2 : fige le contrat de comportement
 * (accessibilité + interactions) avant toute migration de masse ultérieure.
 */
describe('Vague 2 — composants unifiés', () => {
  it('ResponsiveGrid : grille auto-fit (1 colonne → N) + rend les enfants', () => {
    const { container } = render(<ResponsiveGrid min={260}><span>A</span><span>B</span></ResponsiveGrid>)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.display).toBe('grid')
    expect(grid.style.gridTemplateColumns).toContain('auto-fit')
    expect(grid.style.gridTemplateColumns).toContain('260px')
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
  })

  /**
   * ⚠️ `auto-fit` ÉTIRE, `auto-fill` NON — et ça ne se voit qu'avec PEU d'éléments.
   * OBSERVÉ le 2026-08-12 : la caisse filtrée sur deux produits rendait deux tuiles
   * larges de 900 px avec un émoji de 38 px flottant dedans. Le commentaire de
   * `POSProductGrid` annonçait « auto-fill » depuis l'origine ; `ResponsiveGrid`
   * posait `auto-fit`. Le commentaire disait l'intention, le code faisait l'inverse.
   *
   * ⚠️ Ce test juge la RÈGLE CSS, pas le rendu : jsdom ne fait aucune mise en page,
   * il ne peut pas mesurer une tuile. C'est la limite, et elle est assumée — c'est
   * exactement pourquoi le défaut a été trouvé sur une capture et non par un test.
   */
  it('⚠️ ResponsiveGrid — `mode="fill"` n’étire pas, et le défaut reste `fit`', () => {
    const { container: parDefaut } = render(<ResponsiveGrid min={112}><span>A</span></ResponsiveGrid>)
    expect((parDefaut.firstChild as HTMLElement).style.gridTemplateColumns).toContain('auto-fit')

    const { container: enFill } = render(<ResponsiveGrid min={112} mode="fill"><span>A</span></ResponsiveGrid>)
    const regle = (enFill.firstChild as HTMLElement).style.gridTemplateColumns
    expect(regle).toContain('auto-fill')
    expect(regle, 'et surtout PAS auto-fit').not.toContain('auto-fit')
    // La largeur mini est bien conservée dans les deux modes.
    expect(regle).toContain('112px')
  })

  it('IconButton : aria-label OBLIGATOIRE exposé + hit-area 44px + onClick', () => {
    const onClick = vi.fn()
    render(<IconButton label="Supprimer" icon={<svg data-testid="ic" />} danger onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Supprimer' })
    expect(btn.style.minWidth).toBe('44px')
    expect(btn.style.minHeight).toBe('44px')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Tabs : clic change d’onglet + navigation clavier ←/→ (role tablist/tab)', () => {
    const onChange = vi.fn()
    render(
      <Tabs
        value="a"
        onChange={onChange}
        tabs={[{ id: 'a', label: 'Un' }, { id: 'b', label: 'Deux' }, { id: 'c', label: 'Trois' }]}
      />
    )
    expect(screen.getByRole('tablist')).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    // onglet actif = aria-selected
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    // clic
    fireEvent.click(screen.getByRole('tab', { name: 'Deux' }))
    expect(onChange).toHaveBeenCalledWith('b')
    // clavier : flèche droite depuis l'actif (index 0) → 'b'
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('b')
    // flèche gauche depuis l'actif → wrap vers le dernier 'c'
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('Button : loading désactive + aria-busy + spinner', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Enregistrer</Button>)
    const btn = screen.getByRole('button', { name: 'Enregistrer' })
    expect(btn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<Button loading onClick={onClick}>Enregistrer</Button>)
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(btn) // ignoré car disabled
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('FocusTooltip : s’affiche au FOCUS clavier (pas souris-only) et se cache au blur', () => {
    render(<FocusTooltip label="Info devise"><button type="button">EUR</button></FocusTooltip>)
    const trigger = screen.getByRole('button', { name: 'EUR' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(trigger)
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toBe('Info devise')
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id)
    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
