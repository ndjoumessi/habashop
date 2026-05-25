import { useState } from 'react'
import { Search, Download, Eye, ShoppingCart, Grid3X3, LayoutList, Pencil, Gift, FileText, Phone, Mail, MapPin, Star, Trash2 } from 'lucide-react'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

        {/* Vue grille — cartes clients interactives */}
        {viewMode === 'grid' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:12, padding:'2px' }}>
            {pg.paginated.map(c => {
              const cfg = CARD_TYPE[c.type] ?? CARD_TYPE['Détail']
              const initials = c.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
              const isSel = selectedId === c.id
              const openDetail = () => { setSelectedId(c.id); setDetailCustomer(c); setShowDetailModal(true) }
              return (
                <div key={c.id}
                  role="button" tabIndex={0}
                  onClick={openDetail}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail() } }}
                  aria-label={`${i('Client', 'Customer', 'Cliente', 'Cliente')} ${c.name}`}
                  aria-pressed={isSel}
                  style={{
                    background: isSel ? 'linear-gradient(135deg,rgba(108,71,255,.08),rgba(108,71,255,.03))' : 'var(--card)',
                    border: isSel ? '1.5px solid var(--p2)' : '1px solid var(--border)',
                    borderRadius:16, overflow:'hidden', cursor:'pointer', transition:'all .2s ease',
                    display:'flex', flexDirection:'column', position:'relative',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 16px 40px rgba(0,0,0,.35)'; el.style.borderColor = isSel ? 'var(--p)' : 'var(--border3)'; const f = el.querySelector('.card-footer') as HTMLElement; if (f) f.style.maxHeight = '52px' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderColor = isSel ? 'var(--p2)' : 'var(--border)'; const f = el.querySelector('.card-footer') as HTMLElement; if (f) f.style.maxHeight = '0' }}
                >
                  {/* Bande couleur type */}
                  <div style={{ height:3, flexShrink:0, background: cfg.grad }} />

                  {/* Corps */}
                  <div style={{ padding:'14px 16px 12px', flex:1 }}>
                    {/* Avatar + Nom + Type + Points */}
                    <div style={{ display:'flex', gap:11, alignItems:'flex-start', marginBottom:11 }}>
                      <div style={{
                        width:42, height:42, borderRadius:12, flexShrink:0, background: cfg.avatar,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.5px', boxShadow:'0 4px 10px rgba(0,0,0,.2)',
                      }}>{initials}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:5, lineHeight:1.3 }}>{c.name}</div>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:99,
                          fontSize:9, fontWeight:800, letterSpacing:'.4px', textTransform:'uppercase',
                          background: cfg.badgeBg, color: cfg.badgeColor, border: cfg.badgeBorder,
                        }}>{typeLabel(c.type, lang)}</span>
                      </div>
                      {(c.loyaltyPoints ?? 0) > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background:'rgba(255,184,0,.1)', border:'1px solid rgba(255,184,0,.2)', borderRadius:8, padding:'4px 7px', flexShrink:0 }}>
                          <Star size={12} fill="#FFB800" stroke="#FFB800" />
                          <span style={{ fontSize:9, fontWeight:800, color:'#FFB800', fontFamily:'var(--mono)', marginTop:1 }}>{c.loyaltyPoints}</span>
                        </div>
                      )}
                    </div>

                    {/* Séparateur */}
                    <div style={{ height:1, background:'var(--border)', margin:'0 0 10px' }} />

                    {/* CA + Achats */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:10 }}>
                      <div style={{ background:'var(--bg3)', borderRadius:9, padding:'7px 10px' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{i('CA Total', 'Revenue', 'Ingresos', 'Fatturato')}</div>
                        <div style={{ fontSize:12, fontWeight:900, color:'var(--acc)', fontFamily:'var(--mono)', letterSpacing:'-0.3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fmt(c.totalCA ?? 0)}</div>
                      </div>
                      <div style={{ background:'var(--bg3)', borderRadius:9, padding:'7px 10px' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{i('Achats', 'Orders', 'Compras', 'Acquisti')}</div>
                        <div style={{ fontSize:12, fontWeight:900, color:'var(--text2)', fontFamily:'var(--mono)' }}>{c.purchasesPerMonth ?? 0}<span style={{ fontSize:9, color:'var(--text4)', fontWeight:400, marginLeft:3 }}>{i('cmd.', 'ord.', 'ped.', 'ord.')}</span></div>
                      </div>
                    </div>

                    {/* Téléphone */}
                    {c.phone && (
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'var(--text2)', marginBottom:5 }}>
                        <Phone size={11} style={{ color:'var(--text4)', flexShrink:0 }} />
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.phone}</span>
                      </div>
                    )}

                    {/* Adresse */}
                    {c.address && (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:7, padding:'7px 9px', background:'rgba(255,255,255,.03)', border:'1px solid var(--border)', borderRadius:8, marginTop: c.phone ? 5 : 0 }}>
                        <MapPin size={11} style={{ color:'var(--text4)', flexShrink:0, marginTop:1 }} />
                        <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5, flex:1, minWidth:0 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>{c.address}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer révélé au hover */}
                  <div className="card-footer" style={{ maxHeight:0, overflow:'hidden', transition:'max-height .2s ease', borderTop:'1px solid var(--border)', background:'var(--bg3)' }}>
                    <div style={{ padding:'10px 14px', display:'flex', gap:7 }}>
                      <button type="button" onClick={e => { e.stopPropagation(); openDetail() }}
                        aria-label={`${i('Voir', 'View', 'Ver', 'Vedi')} ${c.name}`}
                        style={{ flex:1, height:32, borderRadius:8, background:'rgba(108,71,255,.1)', border:'1px solid rgba(108,71,255,.2)', color:'var(--p3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                        <Eye size={11} /> {lang === 'fr' ? 'Détails' : lang === 'en' ? 'Details' : lang === 'es' ? 'Detalles' : 'Dettagli'}
                      </button>
                      <button type="button" onClick={e => { e.stopPropagation(); onDelete(c.id) }}
                        aria-label={`${i('Supprimer', 'Delete', 'Eliminar', 'Elimina')} ${c.name}`}
                        style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:'rgba(255,59,92,.08)', border:'1px solid rgba(255,59,92,.2)', color:'var(--danger)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px 0', color:'var(--text3)', fontSize:14 }}>{i('Aucun client trouvé', 'No customer found', 'Ningún cliente encontrado', 'Nessun cliente trovato')}</div>
            )}
          </div>
        )}
                <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
    </div>
  )
}
