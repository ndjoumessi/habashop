import { useState, useEffect, useCallback } from 'react'
import { Command } from 'cmdk'
import { Search, Package, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productsApi, customersApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { i } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) { setQuery(''); setProducts([]); setCustomers([]) }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setProducts([]); setCustomers([]); setLoading(false); return }
    setLoading(true)
    const tid = setTimeout(async () => {
      try {
        const [prods, custs] = await Promise.all([
          productsApi.list().then((all: any[]) =>
            all.filter(p =>
              p.name?.toLowerCase().includes(query.toLowerCase()) ||
              p.sku?.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 5)
          ),
          customersApi.search(query).then((all: any[]) => (all ?? []).slice(0, 5)),
        ])
        setProducts(prods)
        setCustomers(custs)
      } catch { /* fail silently */ }
      setLoading(false)
    }, 220)
    return () => clearTimeout(tid)
  }, [query])

  const go = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  if (!open) return null

  const noResults = query.length >= 2 && !loading && products.length === 0 && customers.length === 0

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={i('Recherche globale', 'Global search', 'Búsqueda global', 'Ricerca globale')}
        style={{
          width: '90%', maxWidth: 560,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,.28)',
          overflow: 'hidden',
          animation: 'slideUp .15s ease-out',
        }}
      >
        <Command shouldFilter={false} onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <Search size={15} color="var(--text3)" style={{ flexShrink: 0 }} />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={i('Rechercher produits, clients…', 'Search products, customers…', 'Buscar productos, clientes…', 'Cerca prodotti, clienti…')}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: 'var(--text)', fontFamily: 'var(--font)',
                caretColor: 'var(--p)',
              }}
            />
            {loading && (
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--p)', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />
            )}
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'color .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text3)'}
              aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}
            >
              <X size={14} />
            </button>
          </div>

          {/* Results */}
          <Command.List style={{ maxHeight: 400, overflowY: 'auto', padding: 8 }}>
            {query.length < 2 && (
              <Command.Empty>
                <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                  {i('Tapez au moins 2 caractères…', 'Type at least 2 characters…', 'Escribe 2 caracteres mínimo…', 'Digita almeno 2 caratteri…')}
                </div>
              </Command.Empty>
            )}
            {noResults && (
              <Command.Empty>
                <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                  {i('Aucun résultat', 'No results', 'Sin resultados', 'Nessun risultato')}
                </div>
              </Command.Empty>
            )}

            {products.length > 0 && (
              <Command.Group heading={i('Produits', 'Products', 'Productos', 'Prodotti')}>
                {products.map((p: any) => (
                  <Command.Item
                    key={p.id}
                    value={`product-${p.id}`}
                    onSelect={() => go('/app/products')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: 'var(--text)', transition: 'background .1s' }}
                  >
                    <Package size={14} color="var(--p2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {p.sku && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.sku}</div>}
                    </div>
                    {p.price != null && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{p.price}</div>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {customers.length > 0 && (
              <Command.Group heading={i('Clients', 'Customers', 'Clientes', 'Clienti')}>
                {customers.map((c: any) => (
                  <Command.Item
                    key={c.id}
                    value={`customer-${c.id}`}
                    onSelect={() => go('/app/customers')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: 'var(--text)', transition: 'background .1s' }}
                  >
                    <Users size={14} color="var(--acc3,#00B8FF)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.phone}</div>}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Keyboard hint footer */}
          <div style={{ display: 'flex', gap: 14, padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            {[
              { key: '↑↓', label: i('naviguer', 'navigate', 'navegar', 'naviga') },
              { key: '↵', label: i('sélectionner', 'select', 'seleccionar', 'seleziona') },
              { key: 'Esc', label: i('fermer', 'close', 'cerrar', 'chiudi') },
            ].map(({ key, label }) => (
              <span key={key} style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={{ padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, background: 'var(--bg3)', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{key}</kbd>
                {label}
              </span>
            ))}
          </div>
        </Command>
      </div>
    </div>
  )
}
