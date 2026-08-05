import { useState, useEffect, useCallback, useMemo } from 'react'
import { Command } from 'cmdk'
import {
  Search, Package, Users, X,
  ClipboardList, Truck, ShoppingCart, Plus, BarChart2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productsApi, customersApi, ordersApi, suppliersApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'
import { useAuthStore, canAccess } from '@/stores/authStore'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

function SkeletonRow({ wide = 55 }: { wide?: number }) {
  const base: React.CSSProperties = { borderRadius: 3, background: 'var(--bg3)', animation: 'pulse 1.4s ease-in-out infinite' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
      <div style={{ ...base, width: 26, height: 26, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ ...base, height: 10, width: `${wide}%`, marginBottom: 5 }} />
        <div style={{ ...base, height: 8,  width: `${wide * 0.55}%` }} />
      </div>
    </div>
  )
}

function ItemIcon({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 26, height: 26, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
      {children}
    </div>
  )
}

const ENTER_HINT: React.CSSProperties = { marginLeft: 'auto', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }

const ORDER_STATUS: Record<string, { fr: string; en: string; es: string; it: string }> = {
  DRAFT:     { fr: 'Brouillon', en: 'Draft',     es: 'Borrador',  it: 'Bozza' },
  ORDERED:   { fr: 'Commandé',  en: 'Ordered',   es: 'Pedido',    it: 'Ordinato' },
  RECEIVED:  { fr: 'Reçu',      en: 'Received',  es: 'Recibido',  it: 'Ricevuto' },
  CANCELLED: { fr: 'Annulé',    en: 'Cancelled', es: 'Cancelado', it: 'Annullato' },
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { i, lang } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [query, setQuery]       = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [orders, setOrders]     = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)

  const role = user?.role

  const QUICK_ACTIONS = useMemo(() => [
    { id: 'new-sale',     Icon: ShoppingCart, color: 'var(--p)',            bg: 'rgba(108,71,255,.1)',  slug: 'pos',       path: '/app/pos',                   label: i('Nouvelle vente',        'New sale',          'Nueva venta',          'Nuova vendita') },
    { id: 'new-product',  Icon: Plus,         color: 'var(--p2)',           bg: 'rgba(108,71,255,.08)', slug: 'stock',     path: '/app/stock?new=true',        label: i('Ajouter un produit',    'Add a product',     'Agregar producto',     'Aggiungi prodotto') },
    { id: 'new-customer', Icon: Users,        color: 'var(--acc3,#00B8FF)', bg: 'rgba(0,184,255,.1)',   slug: 'customers', path: '/app/customers?new=true',    label: i('Nouveau client',        'New customer',      'Nuevo cliente',        'Nuovo cliente') },
    { id: 'vat-report',   Icon: BarChart2,    color: 'var(--warn)',         bg: 'rgba(251,146,60,.1)',  slug: 'reports',   path: '/app/reports?tab=vat',       label: i('Rapport TVA',           'VAT report',        'Informe IVA',          'Report IVA') },
    { id: 'export-acct',  Icon: BarChart2,    color: 'var(--text2)',        bg: 'var(--bg3)',            slug: 'reports',   path: '/app/reports?tab=accounting',label: i('Exporter comptabilité', 'Export accounting', 'Exportar contabilidad','Esporta contabilità') },
  ].filter(a => canAccess(role, a.slug)), [i, role])

  // Reset on close
  useEffect(() => {
    if (!open) { setQuery(''); setProducts([]); setCustomers([]); setOrders([]); setSuppliers([]) }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setProducts([]); setCustomers([]); setOrders([]); setSuppliers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query.toLowerCase()
    const tid = setTimeout(async () => {
      try {
        const [prods, custs, ords, sups] = await Promise.all([
          canAccess(role, 'stock')
            ? productsApi.list().then((all) =>
                all.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 4))
            : [],
          canAccess(role, 'customers')
            ? customersApi.search(query).then((all) => (all ?? []).slice(0, 4))
            : [],
          canAccess(role, 'orders')
            ? ordersApi.list().then((all) =>
                all.filter(o => o.ref?.toLowerCase().includes(q) || o.status?.toLowerCase().includes(q)).slice(0, 4))
            : [],
          canAccess(role, 'suppliers')
            ? suppliersApi.list().then((all) =>
                all.filter(s => s.name?.toLowerCase().includes(q) || s.categories?.toLowerCase().includes(q)).slice(0, 4))
            : [],
        ])
        setProducts(prods)
        setCustomers(custs)
        setOrders(ords)
        setSuppliers(sups)
      } catch { /* fail silently */ }
      setLoading(false)
    }, 220)
    return () => clearTimeout(tid)
  }, [query, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((path: string) => { navigate(path); onClose() }, [navigate, onClose])

  if (!open) return null

  const q = query.toLowerCase()
  const filteredActions = QUICK_ACTIONS.filter(a => !query || a.label.toLowerCase().includes(q))
  const hasSearchResults = products.length > 0 || customers.length > 0 || orders.length > 0 || suppliers.length > 0 || filteredActions.length > 0
  const noResults = query.length >= 2 && !loading && !hasSearchResults

  const orderStatusText = (s: string) => {
    const entry = ORDER_STATUS[s?.toUpperCase()]
    return entry ? entry[lang as keyof typeof entry] ?? s : s
  }

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

          {/* ── Input ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <Search size={15} color="var(--text3)" style={{ flexShrink: 0 }} />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={i(
                'Produits, clients, commandes, fournisseurs…',
                'Products, customers, orders, suppliers…',
                'Productos, clientes, pedidos, proveedores…',
                'Prodotti, clienti, ordini, fornitori…',
              )}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--fs-body)', color: 'var(--text)', fontFamily: 'var(--font)', caretColor: 'var(--p)' }}
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

          {/* ── List ── */}
          <Command.List style={{ maxHeight: 420, overflowY: 'auto', padding: '6px 8px' }}>

            {/* Loading skeleton */}
            {loading && (
              <div style={{ padding: '4px 0' }}>
                <SkeletonRow wide={62} />
                <SkeletonRow wide={48} />
                <SkeletonRow wide={70} />
              </div>
            )}

            {/* Default state — no query yet */}
            {!loading && query.length < 2 && (
              <>
                <div style={{ padding: '18px 12px 10px', textAlign: 'center' }}>
                  <Search size={26} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--border)' }} />
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', lineHeight: 1.55 }}>
                    {i('Tapez pour rechercher produits, clients,\ncommandes et fournisseurs…',
                       'Type to search products, customers,\norders and suppliers…',
                       'Escribe para buscar productos, clientes,\npedidos y proveedores…',
                       'Digita per cercare prodotti, clienti,\nordini e fornitori…')}
                  </div>
                </div>

                {/* Quick actions — always visible */}
                {QUICK_ACTIONS.length > 0 && (
                  <Command.Group heading={i('Actions rapides', 'Quick actions', 'Acciones rápidas', 'Azioni rapide')}>
                    {QUICK_ACTIONS.map(a => (
                      <Command.Item
                        key={a.id}
                        value={a.id}
                        onSelect={() => go(a.path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)', transition: 'background .1s' }}
                      >
                        <ItemIcon color={a.color} bg={a.bg}><a.Icon size={13} /></ItemIcon>
                        <span style={{ fontWeight: 'var(--fw-semibold)', flex: 1 }}>{a.label}</span>
                        <span style={ENTER_HINT}>↵</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}

            {/* No results */}
            {!loading && noResults && (
              <Command.Empty>
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text2)', marginBottom: 6 }}>
                    {i('Aucun résultat pour', 'No results for', 'Sin resultados para', 'Nessun risultato per')}{' '}
                    <span style={{ color: 'var(--p2)' }}>«{query}»</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
                    {i("Essayez un autre terme ou vérifiez l'orthographe.", 'Try a different term or check spelling.', 'Prueba otro término o verifica la ortografía.', 'Prova un altro termine o verifica l\'ortografia.')}
                  </div>
                </div>
              </Command.Empty>
            )}

            {/* ── Search results (query ≥ 2) ── */}
            {!loading && query.length >= 2 && (
              <>
                {products.length > 0 && (
                  <Command.Group heading={i('Produits', 'Products', 'Productos', 'Prodotti')}>
                    {products.map((p: any) => (
                      <Command.Item
                        key={p.id}
                        value={`product-${p.id}`}
                        onSelect={() => go('/app/stock')}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)', transition: 'background .1s' }}
                      >
                        <ItemIcon color="var(--p2)" bg="rgba(108,71,255,.1)"><Package size={13} /></ItemIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          {p.sku && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{p.sku}</div>}
                        </div>
                        <span style={ENTER_HINT}>↵</span>
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
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)', transition: 'background .1s' }}
                      >
                        <ItemIcon color="var(--acc3,#00B8FF)" bg="rgba(0,184,255,.1)"><Users size={13} /></ItemIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          {c.phone && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{c.phone}</div>}
                        </div>
                        <span style={ENTER_HINT}>↵</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {orders.length > 0 && (
                  <Command.Group heading={i('Commandes', 'Orders', 'Pedidos', 'Ordini')}>
                    {orders.map((o: any) => (
                      <Command.Item
                        key={o.id}
                        value={`order-${o.id}`}
                        onSelect={() => go('/app/orders')}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)', transition: 'background .1s' }}
                      >
                        <ItemIcon color="var(--warn)" bg="rgba(251,146,60,.1)"><ClipboardList size={13} /></ItemIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.ref}</div>
                          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{orderStatusText(o.status)}</div>
                        </div>
                        <span style={ENTER_HINT}>↵</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {suppliers.length > 0 && (
                  <Command.Group heading={i('Fournisseurs', 'Suppliers', 'Proveedores', 'Fornitori')}>
                    {suppliers.map((s: any) => (
                      <Command.Item
                        key={s.id}
                        value={`supplier-${s.id}`}
                        onSelect={() => go('/app/suppliers')}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)', transition: 'background .1s' }}
                      >
                        <ItemIcon color="var(--acc2)" bg="rgba(0,208,132,.1)"><Truck size={13} /></ItemIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                          {s.categories && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{s.categories}</div>}
                        </div>
                        <span style={ENTER_HINT}>↵</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Filtered quick actions */}
                {filteredActions.length > 0 && (
                  <Command.Group heading={i('Actions', 'Actions', 'Acciones', 'Azioni')}>
                    {filteredActions.map(a => (
                      <Command.Item
                        key={a.id}
                        value={a.id}
                        onSelect={() => go(a.path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)', transition: 'background .1s' }}
                      >
                        <ItemIcon color={a.color} bg={a.bg}><a.Icon size={13} /></ItemIcon>
                        <span style={{ fontWeight: 'var(--fw-semibold)', flex: 1 }}>{a.label}</span>
                        <span style={ENTER_HINT}>↵</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}
          </Command.List>

          {/* ── Footer hints ── */}
          <div style={{ display: 'flex', gap: 14, padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            {[
              { key: '↑↓', label: i('naviguer', 'navigate', 'navegar', 'naviga') },
              { key: '↵',  label: i('ouvrir',   'open',     'abrir',   'apri') },
              { key: 'Esc',label: i('fermer',   'close',    'cerrar',  'chiudi') },
            ].map(({ key, label }) => (
              <span key={key} style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
