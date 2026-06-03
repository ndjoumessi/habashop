import type { Dispatch, SetStateAction } from 'react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import { ClipboardList, X, Users, Truck, User, CheckCircle, Phone, Plus, Package, Clock, Star } from 'lucide-react'
import { useConfig, useFormatAmount } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'

interface NewOrderItem { id: string; name: string; price: number; qty: number; emoji: string }
export interface NewOrderForm { clientName: string; clientPhone: string; items: NewOrderItem[]; note: string }

interface Props {
  onClose: () => void
  orderType: 'client' | 'supplier'
  setOrderType: Dispatch<SetStateAction<'client' | 'supplier'>>
  newOrderForm: NewOrderForm
  setNewOrderForm: Dispatch<SetStateAction<NewOrderForm>>
  selectedClient: any
  setSelectedClient: Dispatch<SetStateAction<any>>
  clientSuggestions: any[]
  setClientSuggestions: Dispatch<SetStateAction<any[]>>
  showClientDropdown: boolean
  setShowClientDropdown: Dispatch<SetStateAction<boolean>>
  customers: any[]
  suppliersList: any[]
  selectedSupplierId: string
  setSelectedSupplierId: Dispatch<SetStateAction<string>>
  availableProducts: any[]
  productSearch: string
  setProductSearch: Dispatch<SetStateAction<string>>
  handleCreateOrder: () => void
}

export default function NewOrderModal({
  onClose, orderType, setOrderType, newOrderForm, setNewOrderForm,
  selectedClient, setSelectedClient, clientSuggestions, setClientSuggestions,
  showClientDropdown, setShowClientDropdown, customers, suppliersList,
  selectedSupplierId, setSelectedSupplierId, availableProducts, productSearch, setProductSearch,
  handleCreateOrder,
}: Props) {
  const { lang } = useConfig()
  const { i } = useI18n()
  const fmt = useFormatAmount()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', margin: 0, display:'flex', alignItems:'center', gap:8 }}>
            <ClipboardList size={18}/> {lang === 'fr' ? 'Nouvelle commande' : lang === 'en' ? 'New order' : lang === 'es' ? 'Nueva orden' : 'Nuovo ordine'}
          </h2>
          <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={15}/>} onClick={onClose} variant="surface" />
        </div>

        {/* Corps scrollable */}
        <div style={{
          flex: 1, overflowY: 'auto', minHeight: 0,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          {/* Toggle type commande */}
          <ResponsiveGrid min={160} gap={8}>
            <button type="button" onClick={() => { setOrderType('client'); setSelectedSupplierId('') }}
              style={{
                padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                fontFamily: 'var(--font)', transition: 'all .15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: orderType === 'client' ? 'rgba(108,71,255,.15)' : 'var(--bg4)',
                border: `2px solid ${orderType === 'client' ? 'rgba(108,71,255,.4)' : 'var(--border)'}`,
              }}>
              <Users size={22} style={{ color: orderType === 'client' ? 'var(--p3)' : 'var(--text3)' }}/>
              <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: orderType === 'client' ? 'var(--p3)' : 'var(--text2)' }}>
                {i('Commande client', 'Customer order', 'Pedido cliente', 'Ordine cliente')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {i('Vente à un client', 'Sale to customer', 'Venta a un cliente', 'Vendita a un cliente')}
              </span>
            </button>
            <button type="button" onClick={() => { setOrderType('supplier'); setNewOrderForm(f => ({ ...f, clientName: '', clientPhone: '' })) }}
              style={{
                padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                fontFamily: 'var(--font)', transition: 'all .15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: orderType === 'supplier' ? 'rgba(240,165,0,.12)' : 'var(--bg4)',
                border: `2px solid ${orderType === 'supplier' ? 'rgba(240,165,0,.35)' : 'var(--border)'}`,
              }}>
              <Truck size={22} style={{ color: orderType === 'supplier' ? 'var(--acc)' : 'var(--text3)' }}/>
              <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: orderType === 'supplier' ? 'var(--acc)' : 'var(--text2)' }}>
                {i('Bon de commande', 'Purchase order', 'Orden de compra', 'Ordine acquisto')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {i('Achat chez fournisseur', 'Order from supplier', 'Compra a proveedor', 'Acquisto da fornitore')}
              </span>
            </button>
          </ResponsiveGrid>

          {/* Formulaire client OU sélecteur fournisseur */}
          {orderType === 'client' ? (
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
                {i('NOM CLIENT *', 'CLIENT NAME *', 'NOMBRE CLIENTE *', 'NOME CLIENTE *')}
              </label>

              {/* Input avec icône */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={15} style={{ position: 'absolute', left: 12, color: 'var(--text3)', pointerEvents: 'none', zIndex: 1 }}/>
                <input className="input" style={{ paddingLeft: 38 }} autoComplete="off"
                  aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={i('Rechercher ou saisir un client…', 'Search or enter a client…', 'Buscar o ingresar un cliente…', 'Cerca o inserisci un cliente…')}
                  value={newOrderForm.clientName}
                  onChange={e => {
                    const val = e.target.value
                    setNewOrderForm(f => ({ ...f, clientName: val }))
                    setSelectedClient(null)
                    const matches = val.trim().length >= 1
                      ? customers.filter(c => c.name.toLowerCase().includes(val.toLowerCase()) || (c.phone && c.phone.includes(val)))
                      : customers
                    setClientSuggestions(matches.slice(0, 6))
                    setShowClientDropdown(true)
                  }}
                  onFocus={() => {
                    const matches = newOrderForm.clientName.trim()
                      ? customers.filter(c => c.name.toLowerCase().includes(newOrderForm.clientName.toLowerCase()))
                      : customers
                    setClientSuggestions(matches.slice(0, 6))
                    setShowClientDropdown(true)
                  }}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                />
                {(newOrderForm.clientName || selectedClient) && (
                  <button aria-label={i('Effacer', 'Clear', 'Borrar', 'Cancella')} type="button" tabIndex={-1}
                    onClick={() => {
                      setNewOrderForm(f => ({ ...f, clientName: '', clientPhone: '' }))
                      setSelectedClient(null)
                      setClientSuggestions(customers.slice(0, 6))
                      setShowClientDropdown(true)
                    }}
                    style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, display: 'flex', alignItems: 'center' }}><X size={14}/></button>
                )}
              </div>

              {/* Badge client sélectionné */}
              {selectedClient && (() => {
                const color = selectedClient.type === 'Grossiste' ? '#6C47FF' : selectedClient.type === 'Semi-gros' ? '#FF9500' : selectedClient.type === 'Fidèle' ? '#00D084' : '#00B8FF'
                return (
                  <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,208,132,.08)', border: '1px solid rgba(0,208,132,.2)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, background: `${color}22`, border: `1px solid ${color}44`, color }}>
                      {selectedClient.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--acc2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/> {selectedClient.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8 }}>
                        {selectedClient.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10}/> {selectedClient.phone}</span>}
                        {selectedClient.type && <span>· {selectedClient.type}</span>}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Dropdown suggestions */}
              {showClientDropdown && clientSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.6)' }}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{i('CLIENTS EXISTANTS', 'EXISTING CLIENTS', 'CLIENTES EXISTENTES', 'CLIENTI ESISTENTI')}</span>
                    <span>{clientSuggestions.length} {i('résultat', 'result', 'resultado', 'risultato')}{clientSuggestions.length > 1 ? 's' : ''}</span>
                  </div>
                  {clientSuggestions.map((customer, i) => {
                    const color = customer.type === 'Grossiste' ? '#6C47FF' : customer.type === 'Semi-gros' ? '#FF9500' : customer.type === 'Fidèle' ? '#00D084' : '#00B8FF'
                    const bgAlpha = customer.type === 'Grossiste' ? 'rgba(108,71,255,.15)' : customer.type === 'Semi-gros' ? 'rgba(255,149,0,.15)' : customer.type === 'Fidèle' ? 'rgba(0,208,132,.15)' : 'rgba(0,184,255,.15)'
                    return (
                      <button key={customer.id} type="button"
                        onMouseDown={() => {
                          setSelectedClient(customer)
                          setNewOrderForm(f => ({ ...f, clientName: customer.name, clientPhone: customer.phone ?? '' }))
                          setShowClientDropdown(false)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < clientSuggestions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.08)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, background: bgAlpha, color }}>
                          {customer.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, marginTop: 1, alignItems: 'center' }}>
                            {customer.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10}/> {customer.phone}</span>}
                            {customer.type && <span style={{ padding: '1px 6px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: bgAlpha, color }}>{customer.type}</span>}
                          </div>
                        </div>
                        {customer.totalCA > 0 && <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--acc)', fontWeight: 'var(--fw-semibold)', flexShrink: 0 }}>{fmt(customer.totalCA)}</div>}
                      </button>
                    )
                  })}
                  {/* Option "Nouveau client" */}
                  <button type="button"
                    onMouseDown={() => setShowClientDropdown(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'rgba(108,71,255,.06)', borderTop: '1px solid rgba(108,71,255,.1)', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.12)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.06)'}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(108,71,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={16} style={{ color:'var(--p3)' }}/></div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--p3)' }}>
                        {i(`Nouveau client "${newOrderForm.clientName || '…'}"`, `New client "${newOrderForm.clientName || '…'}"`, `Nuevo cliente "${newOrderForm.clientName || '…'}"`, `Nuovo cliente "${newOrderForm.clientName || '…'}"`)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Créer et continuer', 'Create and continue', 'Crear y continuar', 'Crea e continua')}</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Aucun résultat */}
              {showClientDropdown && clientSuggestions.length === 0 && newOrderForm.clientName.trim().length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.6)' }}>
                  <button type="button" onMouseDown={() => setShowClientDropdown(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    <Plus size={20} style={{ color:'var(--p3)' }}/>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--p3)' }}>{i(`Créer "${newOrderForm.clientName}"`, `Create "${newOrderForm.clientName}"`, `Crear "${newOrderForm.clientName}"`, `Creare "${newOrderForm.clientName}"`)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Nouveau client — pas encore enregistré', 'New client — not yet registered', 'Nuevo cliente — aún no registrado', 'Nuovo cliente — non ancora registrato')}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
                {i('FOURNISSEUR *', 'SUPPLIER *', 'PROVEEDOR *', 'FORNITORE *')}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {suppliersList.filter(s => s.status !== 'inactive').map(supplier => {
                  const isSel = selectedSupplierId === supplier.id
                  return (
                    <button key={supplier.id} type="button" onClick={() => setSelectedSupplierId(supplier.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 11, cursor: 'pointer',
                        fontFamily: 'var(--font)', textAlign: 'left', transition: 'all .15s',
                        background: isSel ? 'rgba(240,165,0,.1)' : 'var(--bg4)',
                        border: `1.5px solid ${isSel ? 'rgba(240,165,0,.35)' : 'var(--border)'}`,
                      }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: isSel ? 'rgba(240,165,0,.15)' : 'var(--bg3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><Truck size={18} style={{ color: isSel ? 'var(--acc)' : 'var(--text3)' }}/></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: isSel ? 'var(--acc)' : 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {supplier.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8 }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Package size={10}/> {supplier.specialty}</span>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Clock size={10}/> {supplier.leadTime}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <div style={{ display:'flex', gap:2 }}>{Array.from({ length: supplier.rating ?? 0 }, (_, i) => <Star key={i} size={10} style={{ fill:'var(--acc)', color:'var(--acc)' }}/>)}</div>
                        {supplier.phone && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{supplier.phone}</div>}
                      </div>
                      {isSel && (
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#000', fontWeight: 900, flexShrink: 0 }}>✓</div>
                      )}
                    </button>
                  )
                })}
                {suppliersList.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                    <Truck size={28} style={{ color:'var(--text3)', marginBottom: 8 }}/>
                    {i('Aucun fournisseur disponible', 'No suppliers available', 'Ningún proveedor disponible', 'Nessun fornitore disponibile')}
                  </div>
                )}
              </div>
              {selectedSupplierId && (() => {
                const s = suppliersList.find(x => x.id === selectedSupplierId)
                if (!s) return null
                return (
                  <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, display: 'flex', gap: 14, alignItems: 'center', background: 'rgba(240,165,0,.06)', border: '1px solid rgba(240,165,0,.15)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--acc)', marginBottom: 4, display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/> {s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Package size={10}/> {s.specialty}</span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Clock size={10}/> {i('Délai', 'Lead time', 'Plazo', 'Tempo')} : {s.leadTime}</span>
                        {s.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10}/> {s.phone}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedSupplierId('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, padding: '4px' }}>✕</button>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Recherche + grille produits */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
              {i('ARTICLES', 'ITEMS', 'ARTÍCULOS', 'ARTICOLI')}
            </label>
            <input className="input" type="search"
              aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={i('🔍 Rechercher un produit…', '🔍 Search product…', '🔍 Buscar un producto…', '🔍 Cerca un prodotto…')}
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <ResponsiveGrid min={130} gap={8} style={{ maxHeight: 200, overflowY: 'auto', padding: '2px' }}>
              {availableProducts
                .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                .map(product => {
                  const inCart = newOrderForm.items.find(i => i.id === product.id)
                  return (
                    <button key={product.id} type="button"
                      onClick={() => {
                        if (inCart) {
                          setNewOrderForm(f => ({ ...f, items: f.items.filter(i => i.id !== product.id) }))
                        } else {
                          setNewOrderForm(f => ({ ...f, items: [...f.items, { id: product.id, name: product.name, price: product.price, qty: 1, emoji: product.emoji ?? '📦' }] }))
                        }
                      }}
                      style={{
                        background: inCart ? 'rgba(108,71,255,.12)' : 'var(--bg3)',
                        border: `1px solid ${inCart ? 'rgba(108,71,255,.35)' : 'var(--border)'}`,
                        borderRadius: 10, padding: '10px 8px', cursor: 'pointer',
                        textAlign: 'center', transition: 'all .15s',
                        fontFamily: 'var(--font)', position: 'relative',
                      }}>
                      {inCart && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 16, height: 16, borderRadius: '50%',
                          background: 'var(--p)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: '#fff', fontWeight: 900,
                        }}>✓</div>
                      )}
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{product.emoji ?? '📦'}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{fmt(product.price)}</div>
                    </button>
                  )
                })
              }
            </ResponsiveGrid>
          </div>

          {/* Récapitulatif avec contrôle quantités */}
          {newOrderForm.items.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 8 }}>
                {i('RÉCAPITULATIF', 'SUMMARY', 'RESUMEN', 'RIEPILOGO')} ({newOrderForm.items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newOrderForm.items.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 16 }}>{item.emoji}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button"
                        onClick={() => setNewOrderForm(f => ({ ...f, items: f.items.map(i => i.id === item.id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i) }))}
                        style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 'var(--fw-semibold)' }}>{item.qty}</span>
                      <button type="button"
                        onClick={() => setNewOrderForm(f => ({ ...f, items: f.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) }))}
                        style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)', fontSize: 12, color: 'var(--acc)', minWidth: 70, textAlign: 'right' }}>{fmt(item.price * item.qty)}</span>
                    <button aria-label={i('Retirer', 'Remove', 'Quitar', 'Rimuovi')} type="button"
                      onClick={() => setNewOrderForm(f => ({ ...f, items: f.items.filter(i => i.id !== item.id) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 15, padding: '2px 4px', display:'flex', alignItems:'center' }}><X size={13}/></button>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                  background: 'rgba(108,71,255,.06)', border: '1px solid rgba(108,71,255,.12)', borderRadius: 10,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
                    TOTAL ({newOrderForm.items.reduce((s, i) => s + i.qty, 0)} {i('art.', 'items', 'art.', 'art.')})
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>
                    {fmt(newOrderForm.items.reduce((s, i) => s + i.price * i.qty, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
              {i('NOTE (optionnel)', 'NOTE (optional)', 'NOTA (opcional)', 'NOTA (opzionale)')}
            </label>
            <textarea className="input" rows={2} style={{ resize: 'vertical' }}
              placeholder={i('Instructions livraison, conditions…', 'Delivery instructions, conditions…', 'Instrucciones de entrega, condiciones…', 'Istruzioni di consegna, condizioni…')}
              value={newOrderForm.note}
              onChange={e => setNewOrderForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          flexShrink: 0, display: 'flex', gap: 8, background: 'var(--bg2)',
        }}>
          {(() => {
            const canCreate = orderType === 'client'
              ? newOrderForm.clientName.trim() !== '' && newOrderForm.items.length > 0
              : selectedSupplierId !== '' && newOrderForm.items.length > 0
            return (
              <button disabled={!canCreate} onClick={handleCreateOrder}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 12,
                  background: canCreate ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg4)',
                  color: canCreate ? '#fff' : 'var(--text3)',
                  fontSize: 14, fontWeight: 'var(--fw-bold)', fontFamily: 'var(--font)',
                  cursor: canCreate ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all .15s',
                }}>
                {orderType === 'client' ? <ClipboardList size={14}/> : <Package size={14}/>}
                {orderType === 'client'
                  ? (i('Créer la commande', 'Create order', 'Crear el pedido', 'Crea ordine'))
                  : (i('Créer le bon de commande', 'Create PO', 'Crear orden de compra', 'Crea ordine acquisto'))}
                {newOrderForm.items.length > 0 && (
                  <span style={{ fontSize: 12, opacity: .8 }}>— {newOrderForm.items.reduce((s, i) => s + i.qty, 0)} art.</span>
                )}
              </button>
            )
          })()}
          <button onClick={onClose} style={{
            padding: '12px 18px', background: 'var(--bg3)',
            border: '1px solid var(--border)', borderRadius: 12,
            cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
            fontFamily: 'var(--font)', fontWeight: 600,
          }}>
            {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
          </button>
        </div>
      </div>
    </div>
  )
}
