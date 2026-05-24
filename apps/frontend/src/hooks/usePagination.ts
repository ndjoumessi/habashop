import { useState, useMemo, useEffect } from 'react'

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)

  const total = items.length
  const totalPages = Math.ceil(total / size)

  // Clamp page when the list shrinks (e.g. after filtering)
  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages))
  }, [totalPages, page])

  const paginated = useMemo(() => {
    const start = (page - 1) * size
    return items.slice(start, start + size)
  }, [items, page, size])

  const onPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages || 1)))
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* jsdom / no-op */ }
  }

  const onSize = (s: number) => {
    setSize(s)
    setPage(1)
  }

  const reset = () => setPage(1)

  return { page, totalPages, total, pageSize: size, paginated, onPage, onSize, reset }
}
