import { Search, Download, Eye, ShoppingCart, Grid3X3, LayoutList, Pencil, Gift, FileText, Phone, Mail, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { t } from '@/stores/appStore'
import { exportCSV, generateInvoice } from '@/utils/export'
import Pagination from '@/components/ui/Pagination'
import { type Customer, type ClientType, TYPE_CFG, typeLabel, LoyaltyBar } from '@/components/customers/customersShared'

// Config couleur par type client — UI/UX Pro Max
const CARD_TYPE: Record<string, { grad: string; avatar: string; badgeBg: string; badgeColor: string; badgeBorder: string }> = {
  'Grossiste': { grad: 'linear-gradient(90deg,var(--p),var(--p2))',    avatar: 'linear-gradient(135deg,var(--p),var(--p2))',    badgeBg: 'rgba(108,71,255,.12)', badgeColor: 'var(--p3)',   badgeBorder: '1px solid rgba(108,71,255,.25)' },
  'Semi-gros': { grad: 'linear-gradient(90deg,var(--acc3),#0066CC)',   avatar: 'linear-gradient(135deg,var(--acc3),#0066CC)',   badgeBg: 'rgba(0,184,255,.12)',  badgeColor: 'var(--acc3)', badgeBorder: '1px solid rgba(0,184,255,.25)'  },
  'Fidèle':    { grad: 'linear-gradient(90deg,var(--acc2),#00B574)',   avatar: 'linear-gradient(135deg,var(--acc2),#00B574)',   badgeBg: 'rgba(0,208,132,.12)',  badgeColor: 'var(--acc2)', badgeBorder: '1px solid rgba(0,208,132,.25)'  },
  'Détail':    { grad: 'linear-gradient(90deg,var(--acc),#E08000)',    avatar: 'linear-gradient(135deg,var(--acc),#E08000)',    badgeBg: 'rgba(255,149,0,.12)',  badgeColor: 'var(--acc)',  badgeBorder: '1px solid rgba(255,149,0,.25)'  },
}

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
  return (
    <div className="panel">
        <div className="panel-head">
          <span className="panel-title">{t('customers_title')}</span>
          <div className="flex items-center gap-2">
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button title="Vue tableau" onClick={() => setViewMode('table')} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s', background: viewMode === 'table' ? 'var(--bg)' : 'transparent', color: viewMode === 'table' ? 'var(--p2)' : 'var(--text3)' }}>
                <LayoutList size={14} />
              </button>
              <button title="Vue grille" onClick={() => setViewMode('grid')} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s', background: viewMode === 'grid' ? 'var(--bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--p2)' : 'var(--text3)' }}>
                <Grid3X3 size={14} />
              </button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              exportCSV('habashop_clients',
                ['Nom','Type','Téléphone','Email','Achats/mois','CA total','Points fidélité'],
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
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder={lang === 'fr' ? '🔍 Nom, téléphone…' : lang === 'en' ? '🔍 Name, phone…' : lang === 'es' ? '🔍 Nombre, teléfono…' : '🔍 Nome, telefono…'}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_type').toLowerCase()}</option>
            <option value="Grossiste">{typeLabel('Grossiste', lang)}</option>
            <option value="Semi-gros">{typeLabel('Semi-gros', lang)}</option>
            <option value="Fidèle">{typeLabel('Fidèle', lang)}</option>
            <option value="Détail">{typeLabel('Détail', lang)}</option>
          </select>
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
                        <button className="btn btn-sm btn-ghost" title="Voir fiche" style={{ cursor: 'pointer' }} onClick={() => setViewCustomer(c)}>
                          <Eye size={12} />
                        </button>
                        <button className="btn btn-sm btn-ghost" title="Modifier" style={{ cursor: 'pointer' }} onClick={() => {
                          setEditCustomer(c)
                          setEditCustForm({ name:c.name, type:c.type, phone:c.phone, email:c.email??'', address:c.address??'', notes:c.notes??'' })
                          setCustEditMode(false)
                          setShowEditCustModal(true)
                        }}><Pencil size={12} /></button>
                        <button className="btn btn-sm" title="Nouvelle vente"
                          style={{ background: TYPE_CFG['Fidèle'].bg, color: 'var(--acc2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit', transition: 'background .15s' }}
                          onClick={() => navigate('/app/pos', { state: { customer: c } })}>
                          <ShoppingCart size={11} />
                        </button>
                        <button className="btn btn-sm" title="Carte fidélité"
                          style={{ background: 'rgba(255,215,0,.12)', color: '#B8860B', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit', transition: 'background .15s' }}
                          onClick={() => setLoyaltyCustomer(c)}>
                          <Gift size={11} />
                        </button>
                        <button className="btn btn-sm" title="Générer un devis PDF"
                          style={{ background: TYPE_CFG['Grossiste'].bg, color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit', transition: 'background .15s' }}
                          onClick={() => generateInvoice({
                            type: 'devis', lang: 'fr',
                            customer: { name: c.name, phone: c.phone },
                            items: [{ name: 'Article', qty: 1, price: 0 }],
                          })}>
                          <FileText size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>Aucun client trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Vue grille — cartes clients UI/UX Pro Max */}
        {viewMode === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, padding: '4px 2px' }}>
            {pg.paginated.map(c => {
              const cfg      = CARD_TYPE[c.type] ?? CARD_TYPE['Détail']
              const initials = c.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
              const totalCA  = c.totalCA ?? 0
              const points   = c.loyaltyPoints ?? 0
              return (
                <div key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setDetailCustomer(c); setShowDetailModal(true) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailCustomer(c); setShowDetailModal(true) }
                  }}
                  aria-label={`${i('Client', 'Customer', 'Cliente', 'Cliente')} ${c.name}`}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16, cursor: 'pointer',
                    transition: 'all .18s ease', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', position: 'relative',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(-3px)'
                    el.style.boxShadow = '0 12px 32px rgba(0,0,0,.4)'
                    el.style.borderColor = 'var(--border3)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = ''
                    el.style.boxShadow = ''
                    el.style.borderColor = 'var(--border)'
                  }}
                >
                  {/* Bande couleur type client */}
                  <div style={{ height: 4, background: cfg.grad, flexShrink: 0 }} />

                  {/* Corps */}
                  <div style={{ padding: '16px 16px 14px', flex: 1 }}>
                    {/* Avatar + Nom + Badge type */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: cfg.avatar,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px',
                        boxShadow: '0 4px 12px rgba(0,0,0,.25)',
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                          {c.name}
                        </div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 99,
                          fontSize: 10, fontWeight: 700, letterSpacing: '.3px',
                          background: cfg.badgeBg, color: cfg.badgeColor, border: cfg.badgeBorder,
                        }}>
                          {typeLabel(c.type, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Séparateur */}
                    <div style={{ height: 1, background: 'var(--border)', margin: '0 0 12px' }} />

                    {/* Métriques */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{i('CA Total', 'Revenue', 'Ingresos', 'Fatturato')}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fmt(totalCA)}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{i('Fidélité', 'Loyalty', 'Fidelidad', 'Fedeltà')}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--acc2)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Star size={12} fill="#FFB800" stroke="#FFB800" style={{ flexShrink: 0 }} /> {points}
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)' }}>pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Téléphone + Email */}
                    {c.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)', marginBottom: c.email ? 5 : 0 }}>
                        <Phone size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)' }}>
                        <Mail size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text3)' }}>{c.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer — Actions */}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setDetailCustomer(c); setShowDetailModal(true) }}
                      aria-label={`${i('Voir détails de', 'View details of', 'Ver detalles de', 'Vedi dettagli di')} ${c.name}`}
                      style={{
                        flex: 1, padding: '7px 0',
                        background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.2)',
                        borderRadius: 8, fontSize: 11, fontWeight: 700, color: 'var(--p3)',
                        cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 32,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,.2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,.1)' }}
                    >
                      <Eye size={12} /> {lang === 'fr' ? 'Détails' : lang === 'es' ? 'Detalles' : lang === 'it' ? 'Dettagli' : 'Details'}
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onDelete(c.id) }}
                      aria-label={`${i('Supprimer', 'Delete', 'Eliminar', 'Elimina')} ${c.name}`}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'rgba(255,59,92,.08)', border: '1px solid rgba(255,59,92,.2)',
                        color: 'var(--danger)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .15s ease', flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,59,92,.18)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,59,92,.08)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 14 }}>{i('Aucun client trouvé', 'No customer found', 'Ningún cliente encontrado', 'Nessun cliente trovato')}</div>
            )}
          </div>
        )}
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
    </div>
  )
}
