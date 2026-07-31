interface PaginationProps {
  page:        number
  totalPages:  number
  total:       number
  pageSize:    number
  onPage:      (p: number) => void
  onPageSize?: (s: number) => void
  lang?:       string
}

export default function Pagination({
  page, totalPages, total, pageSize, onPage, onPageSize, lang = 'fr',
}: PaginationProps) {
  if (totalPages <= 1) return null

  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, n) => n + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const navBtn = (disabled: boolean): React.CSSProperties => ({
    width: 44, height: 44, borderRadius: 9,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--text4)' : 'var(--text2)',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .15s', opacity: disabled ? .4 : 1,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
        {i(`${start}–${end} sur ${total} résultats`, `${start}–${end} of ${total} results`, `${start}–${end} de ${total} resultados`, `${start}–${end} di ${total} risultati`)}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={navBtn(page <= 1)} aria-label="Previous">←</button>
        {getPages().map((p, idx) =>
          p === '...' ? (
            <div key={`dots-${idx}`} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text4)', fontSize: 'var(--fs-sm)' }}>…</div>
          ) : (
            <button key={p} type="button" onClick={() => onPage(p as number)}
              style={{
                width: 44, height: 44, borderRadius: 9,
                background: page === p ? 'var(--grad-p)' : 'var(--bg3)',
                border: `1px solid ${page === p ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer', color: page === p ? '#fff' : 'var(--text2)',
                fontSize: 'var(--fs-sm)', fontWeight: page === p ? 800 : 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s', boxShadow: page === p ? 'var(--sh-p)' : 'none',
              }}>{p}</button>
          )
        )}
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} style={navBtn(page >= totalPages)} aria-label="Next">→</button>
      </div>

      {onPageSize && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
          <span>{i('Par page', 'Per page', 'Por página', 'Per pagina')} :</span>
          <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', color: 'var(--text2)', fontSize: 'var(--fs-label)', fontFamily: 'var(--font)', cursor: 'pointer' }}>
            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
