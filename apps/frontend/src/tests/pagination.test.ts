import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '../hooks/usePagination'

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }))

describe('usePagination', () => {
  it('Initialise page 1', () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 10))
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(5)
    expect(result.current.paginated.length).toBe(10)
  })

  it('Navigation page 2', () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 10))
    act(() => result.current.onPage(2))
    expect(result.current.page).toBe(2)
    expect(result.current.paginated[0].id).toBe(11)
  })

  it('Dernière page partielle', () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 10))
    act(() => result.current.onPage(3))
    expect(result.current.paginated.length).toBe(5)
  })

  it('Ne dépasse pas totalPages', () => {
    const { result } = renderHook(() => usePagination(makeItems(10), 10))
    act(() => result.current.onPage(99))
    expect(result.current.page).toBe(1)
  })

  it('Reset revient à page 1', () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 10))
    act(() => result.current.onPage(3))
    act(() => result.current.reset())
    expect(result.current.page).toBe(1)
  })

  it('onSize change la taille et revient page 1', () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 10))
    act(() => result.current.onPage(3))
    act(() => result.current.onSize(25))
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
    expect(result.current.paginated.length).toBe(25)
  })

  it('Liste vide — totalPages 0', () => {
    const { result } = renderHook(() => usePagination<{ id: number }>([], 10))
    expect(result.current.totalPages).toBe(0)
    expect(result.current.paginated.length).toBe(0)
  })
})
