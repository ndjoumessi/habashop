import { useState } from 'react'
import { Search, Download, Eye, ShoppingCart, Grid3X3, LayoutList, Pencil, Gift, FileText, Phone, Mail, MapPin, Star, Trash2, ExternalLink, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { t } from '@/stores/appStore'
import { exportCSV, generateInvoice } from '@/utils/export'
import Pagination from '@/components/ui/Pagination'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import FilterSelect from '@/components/ui/FilterSelect'
import { type Customer, type ClientType, TYPE_CFG, typeLabel, LoyaltyBar } from '@/components/customers/customersShared'

interface CustomersListProps {
  customers: Customer[]
  search: string; setSearch: (v: string) => void
  typeFilter: ClientType | ''; setTypeFilter: (v: any) => void
  viewMode: 'table' | 'grid'; setViewMode: (v: any) => void
  pg: any
  filtered: Customer[]
  fmt: (n: number) => string
  abbr: (n: number) => string
  lang: string
  i: (...a: string[]) => string
  navigate: (path: string, opts?: any) => void
  printCustomersPDF: () => void
  setViewCustomer: (c: any) => void
  setEditCustomer: (c: any) => void
  setEditCustForm: (v: any) => void
  setCustEditMode: (b: boolean) => void
  setShowEditCustModal: (b: boolean) => void
  setLoyaltyCustomer: (c: any) => void
  setDetailCustomer: (c: any) => void
  setShowDetailModal: (b: boolean) => void
  onDelete: (id: string) => void
}

export default function CustomersList({ customers, search, setSearch, typeFilter, setTypeFilter, viewMode, setViewMode, pg, filtered, fmt, abbr, lang, i, navigate, printCustomersPDF, setViewCustomer, setEditCustomer, setEditCustForm, setCustEditMode, setShowEditCustModal, setLoyaltyCustomer, setDetailCustomer, setShowDetailModal, onDelete }: CustomersListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <div className="panel">
        <div className="panel-head">
          <span className="panel-title">{t('customers_title')}</span>
          <div className="flex items-center gap-2">
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button title={i('Vue tableau', 'Table view', 'Vista tabla', 'Vista tabella')} onClick={() => setViewMode('table')} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s', background: viewMode === 'table' ? 'var(--bg)' : 'transparent', color: viewMode === 'table' ? 'var(--p2)' : 'var(--text3)' }}>
                <LayoutList size={14} />
              </button>
              <button title={i('Vue grille', 'Grid view', 'Vista cuadrícula', 'Vista griglia')} onClick={() => setViewMode('grid')} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s', background: viewMode === 'grid' ? 'var(--bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--p2)' : 'var(--text3)' }}>
                <Grid3X3 size={14} />
              </button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              exportCSV('habashop_clients',
                [i('Nom','Name','Nombre','Nome'), i('Type','Type','Tipo','Tipo'), i('Téléphone','Phone','Teléfono','Telefono'), 'Email', i('Achats/mois','Purchases/month','Compras/mes','Acquisti/mese'), i('CA total','Total revenue','Ingresos totales','Ricavi totali'), i('Points fidélité','Loyalty points','Puntos fidelidad','Punti fedeltà')],
                customers.map(c => [c.name, c.type, c.phone, c.email ?? '', c.purchasesPerMonth, c.totalCA, c.loyaltyPoints])
              )
              toast.success(i('Export CSV téléchargé', 'CSV exported', 'CSV exportado', 'CSV esportato'))
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { printCustomersPDF(); toast.success(i('PDF ouvert', 'PDF opened', 'PDF abierto', 'PDF aperto')) }}>
              <Download size={13} /> PDF
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-wrap flex-1 min-w-40">
            <span className="search-icon"><Search size={13} /></span>
            <input className="input pl-8 py-2 text-sm w-full"
              aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')}
              placeholder={i('Nom, téléphone', 'Name, phone', 'Nombre, teléfono', 'Nome, telefono') + '…'}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <FilterSelect
            value={typeFilter} onChange={v => setTypeFilter(v as any)}
            ariaLabel={t('col_type')}
            minWidth={150}
            icon={<Tag size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
            options={[
              { value: '', label: i('Tous les types', 'All types', 'Todos los tipos', 'Tutti i tipi') },
              { value: 'Grossiste', label: typeLabel('Grossiste', lang) },
              { value: 'Semi-gros', label: typeLabel('Semi-gros', lang) },
              { value: 'Fidèle', label: typeLabel('Fidèle', lang) },
              { value: 'Détail', label: typeLabel('Détail', lang) },
            ]}
          />
        </div>

        {/* Vue tableau */}
        {viewMode === 'table' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('col_client')}</th><th scope="col">{t('col_type')}</th><th scope="col">{t('col_phone')}</th>
                  <th scope="col">{t('customers_purchases')}</th><th scope="col">{t('customers_total_revenue')}</th><th scope="col">{t('col_loyalty')}</th><th scope="col">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pg.paginated.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="td-bold">{c.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                        Depuis {new Date(c.since).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td><span className={`badge ${TYPE_CFG[c.type].cls}`}>{typeLabel(c.type, lang)}</span></td>
                    <td className="td-mono">{c.phone}</td>
                    <td className="td-num" style={{ color: 'var(--text2)' }}>{c.purchasesPerMonth}×</td>
                    <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(c.totalCA)}</td>
                    <td style={{ minWidth: 120 }}><LoyaltyBar points={c.loyaltyPoints} max={c.maxLoyalty} /></td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn btn-sm btn-ghost" title={i('Voir fiche', 'View profile', 'Ver ficha', 'Vedi scheda')} style={{ cursor: 'pointer' }} onClick={() => setViewCustomer(c)}>
                          <Eye size={12} />
                        </button>
                        <button className="btn btn-sm btn-ghost" title={i('Modifier', 'Edit', 'Editar', 'Modifica')} style={{ cursor: 'pointer' }} onClick={() => {
                          setEditCustomer(c)
                          setEditCustForm({ name:c.name, type:c.type, phone:c.phone, email:c.email??'', address:c.address??'', notes:c.notes??'' })
                          setCustEditMode(false)
                          setShowEditCustModal(true)
                        }}><Pencil size={12} /></button>
                        <button className="btn btn-sm" title={i('Nouvelle vente', 'New sale', 'Nueva venta', 'Nuova vendita')}
                          style={{ background: TYPE_CFG['Fidèle'].bg, color: 'var(--acc2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit', transition: 'background .15s' }}
                          onClick={() => navigate('/app/pos', { state: { customer: c } })}>
                          <ShoppingCart size={11} />
                        </button>
                        <button className="btn btn-sm" title={i('Carte fidélité', 'Loyalty card', 'Tarjeta fidelidad', 'Carta fedeltà')}
                          style={{ background: 'rgba(255,215,0,.12)', color: '#B8860B', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit', transition: 'background .15s' }}
                          onClick={() => setLoyaltyCustomer(c)}>
                          <Gift size={11} />
                        </button>
                        <button className="btn btn-sm" title={i('Générer un devis PDF', 'Generate PDF quote', 'Generar presupuesto PDF', 'Genera preventivo PDF')}
                          style={{ background: TYPE_CFG['Grossiste'].bg, color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit', transition: 'background .15s' }}
                          onClick={() => generateInvoice({
                            type: 'devis', lang,
                            customer: { name: c.name, phone: c.phone },
                            items: [{ name: i('Article', 'Item', 'Artículo', 'Articolo'), qty: 1, price: 0 }],
                          })}>
                          <FileText size={11} />
                        </button>
                        <button className="btn btn-sm btn-ghost"
                          title={i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}
                          aria-label={i(`Supprimer ${c.name}`, `Delete ${c.name}`, `Eliminar ${c.name}`, `Elimina ${c.name}`)}
                          style={{ color: 'var(--danger)', cursor: 'pointer' }}
                          onClick={e => { e.stopPropagation(); onDelete(c.id) }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>{i('Aucun client trouvé', 'No customer found', 'Sin clientes', 'Nessun cliente trovato')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Vue grille — cartes clients (Bento premium) */}
        {viewMode === 'grid' && (
          <ResponsiveGrid min={250} gap={12}>
            {pg.paginated.map(c => {
              const isSel = selectedId === c.id
              const initials = c.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
              const tc = c.type === 'Grossiste' ? { h: '#6C47FF', rgb: '108,71,255' }
                : c.type === 'Semi-gros' ? { h: '#00B8FF', rgb: '0,184,255' }
                : c.type === 'Fidèle' ? { h: '#00D084', rgb: '0,208,132' }
                : { h: '#FF9500', rgb: '255,149,0' }
              const openDetail = () => { setSelectedId(c.id); setDetailCustomer(c); setShowDetailModal(true) }
              return (
                <div key={c.id}
                  role="button" tabIndex={0}
                  onClick={openDetail}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail() } }}
                  aria-label={`${i('Client', 'Customer', 'Cliente', 'Cliente')} ${c.name}`}
                  aria-pressed={isSel}
                  style={{
                    background: isSel ? `linear-gradient(135deg,rgba(${tc.rgb},.1),rgba(${tc.rgb},.04))` : 'var(--card)',
                    border: `1px solid ${isSel ? tc.h : 'var(--border)'}`,
                    borderRadius: 14, cursor: 'pointer', transition: 'all .15s ease', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 12px 32px rgba(0,0,0,.3)'; el.style.borderColor = tc.h; const a = el.querySelector('.customer-actions') as HTMLElement; if (a) { a.style.opacity = '1'; a.style.maxHeight = '48px' } }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderColor = isSel ? tc.h : 'var(--border)'; const a = el.querySelector('.customer-actions') as HTMLElement; if (a) { a.style.opacity = '0'; a.style.maxHeight = '0' } }}
                >
                  {/* Bande dégradée par type */}
                  <div style={{ height: 3, background: `linear-gradient(135deg,${tc.h},${tc.h}CC)`, flexShrink: 0 }} />
                  {/* TOP : avatar + nom + badge + points */}
                  <div style={{ padding: '16px 16px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg,${tc.h},${tc.h}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', boxShadow: `0 4px 14px rgba(${tc.rgb},.35)`, position: 'relative' }}>
                      {initials}
                      {(c.loyaltyPoints ?? 0) > 100 && (
                        <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#00D084', border: '2px solid var(--card)', boxShadow: '0 0 6px #00D084' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{c.name}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', letterSpacing: '.3px', background: `rgba(${tc.rgb},.1)`, color: tc.h, border: `1px solid rgba(${tc.rgb},.25)` }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: tc.h }} />
                        {typeLabel(c.type, lang)}
                      </div>
                    </div>
                    {(c.loyaltyPoints ?? 0) > 0 && (
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Star size={13} fill="#FFB800" stroke="#FFB800" />
                        <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', color: '#FFB800', fontFamily: 'var(--mono)' }}>{c.loyaltyPoints}</div>
                      </div>
                    )}
                  </div>

                  {/* MÉTRIQUES : 3 blocs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', borderTop: '1px solid var(--border)' }}>
                    {[
                      { label: i('CA', 'Rev.', 'Ing.', 'Fatt.'), value: fmt(c.totalCA ?? 0), color: '#FF9500' },
                      { label: i('Cmds', 'Orders', 'Ped.', 'Ord.'), value: String(c.purchasesPerMonth ?? 0), color: tc.h },
                      { label: 'Pts', value: String(c.loyaltyPoints ?? 0), color: '#00D084' },
                    ].map((m, idx) => (
                      <div key={idx} style={{ background: 'var(--card)', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: m.color, fontFamily: 'var(--mono)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 2, fontWeight: 600 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* CONTACT */}
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    {c.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text2)' }}>
                        <Phone size={11} style={{ color: 'var(--text4)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone}</span>
                      </div>
                    )}
                    {c.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: `rgba(${tc.rgb},.05)`, border: `1px solid rgba(${tc.rgb},.12)`, borderRadius: 8 }}>
                        <MapPin size={10} style={{ color: tc.h, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</div>
                        <a
                          href={`https://maps.google.com/maps?q=${encodeURIComponent(c.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title={i('Ouvrir dans Google Maps', 'Open in Google Maps', 'Abrir en Google Maps', 'Apri in Google Maps')}
                          aria-label={i('Ouvrir dans Google Maps', 'Open in Google Maps', 'Abrir en Google Maps', 'Apri in Google Maps')}
                          style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: `rgba(${tc.rgb},.12)`, border: `1px solid rgba(${tc.rgb},.2)`, color: tc.h, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* ACTIONS — révélées au hover */}
                  <div className="customer-actions" style={{ maxHeight: 0, opacity: 0, overflow: 'hidden', transition: 'all .2s ease', borderTop: '1px solid var(--border)', background: 'var(--bg3)' }}>
                    <div style={{ padding: '9px 12px', display: 'flex', gap: 7 }}>
                      <button type="button" onClick={e => { e.stopPropagation(); openDetail() }} aria-label={`${i('Voir', 'View', 'Ver', 'Vedi')} ${c.name}`}
                        style={{ flex: 1, height: 30, borderRadius: 7, background: `rgba(${tc.rgb},.1)`, border: `1px solid rgba(${tc.rgb},.2)`, color: tc.h, fontSize: 11, fontWeight: 'var(--fw-semibold)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <Eye size={11} /> {lang === 'fr' ? 'Voir' : lang === 'en' ? 'View' : lang === 'es' ? 'Ver' : 'Vedi'}
                      </button>
                      <button type="button" onClick={e => { e.stopPropagation(); onDelete(c.id) }} aria-label={`${i('Supprimer', 'Delete', 'Eliminar', 'Elimina')} ${c.name}`}
                        style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: 'rgba(255,59,92,.08)', border: '1px solid rgba(255,59,92,.15)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 14 }}>{i('Aucun client trouvé', 'No customer found', 'Ningún cliente encontrado', 'Nessun cliente trovato')}</div>
            )}
          </ResponsiveGrid>
        )}
                <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
    </div>
  )
}
