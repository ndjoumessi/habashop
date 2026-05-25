import { Search, Download, Eye, ShoppingCart, Grid3X3, LayoutList, Pencil, Gift, FileText, Phone, Mail, Crown } from 'lucide-react'
import toast from 'react-hot-toast'
import { t } from '@/stores/appStore'
import { exportCSV, generateInvoice } from '@/utils/export'
import Pagination from '@/components/ui/Pagination'
import { type Customer, type ClientType, TYPE_CFG, BENTO_CFG, typeLabel, LoyaltyBar } from '@/components/customers/customersShared'

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
}

export default function CustomersList({ customers, search, setSearch, typeFilter, setTypeFilter, viewMode, setViewMode, pg, filtered, fmt, abbr, lang, i, navigate, printCustomersPDF, setViewCustomer, setEditCustomer, setEditCustForm, setCustEditMode, setShowEditCustModal, setLoyaltyCustomer, setDetailCustomer, setShowDetailModal }: CustomersListProps) {
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

        {/* Vue grille — bento premium */}
        {viewMode === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 16 }}>
            {pg.paginated.map(c => {
              const cfg       = BENTO_CFG[c.type] ?? BENTO_CFG['Détail']
              const initials  = c.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              const totalCA   = c.totalCA ?? 0
              const points    = c.loyaltyPoints ?? 0
              const loyaltyPct = Math.min(100, Math.round((points / (c.maxLoyalty || 1000)) * 100))
              const isVIP     = totalCA >= 1_000_000
              return (
                <div key={c.id}
                  style={{
                    background: 'linear-gradient(160deg,#0D0D1E 0%,#111228 100%)',
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 22, overflow: 'hidden',
                    position: 'relative', cursor: 'pointer',
                    transition: 'transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-5px) scale(1.01)'; el.style.boxShadow = `0 20px 60px ${cfg.glow}, 0 0 0 1px ${cfg.border}` }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '' }}
                  onClick={() => { setDetailCustomer(c); setShowDetailModal(true) }}
                >
                  {/* Top gradient band */}
                  <div style={{ height: 5, background: cfg.grad, borderBottom: `1px solid ${cfg.border}`, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,${cfg.color}88,transparent)` }}/>
                  </div>

                  {/* Radial orb */}
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle,${cfg.glow} 0%,transparent 70%)`, pointerEvents: 'none' }}/>

                  <div style={{ padding: '15px 18px 18px' }}>
                    {/* Avatar + name + badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 13 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: 50, height: 50, borderRadius: 16,
                          background: cfg.soft, border: `1.5px solid ${cfg.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 900, color: cfg.color, fontFamily: 'var(--mono)',
                        }}>{initials}</div>
                        {isVIP && (
                          <div style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 18, height: 18, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#FFB800,#FF9500)',
                            border: '2px solid #0D0D1E',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Crown size={9} color="#fff" />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>{c.name}</div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px',
                          padding: '3px 8px', borderRadius: 99,
                          background: cfg.soft, color: cfg.color, border: `1px solid ${cfg.border}`,
                        }}>
                          {cfg.icon}{typeLabel(c.type, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Contact */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
                      {c.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                          <Phone size={11} color={cfg.color} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontFamily: 'var(--mono)' }}>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden' }}>
                          <Mail size={11} color={cfg.color} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>
                        </div>
                      )}
                    </div>

                    {/* KPI 3 cols */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                      <div style={{ background: cfg.soft, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: '7px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: 'rgba(255,255,255,.4)', marginBottom: 3 }}>CA</div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: cfg.color, fontFamily: 'var(--mono)', lineHeight: 1 }}>
                          {abbr(totalCA)}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: 'rgba(255,255,255,.4)', marginBottom: 3 }}>Cmds</div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#fff', fontFamily: 'var(--mono)', lineHeight: 1 }}>{c.purchasesPerMonth}×</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: 'rgba(255,255,255,.4)', marginBottom: 3 }}>Pts</div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--warn)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{points}</div>
                      </div>
                    </div>

                    {/* Gold loyalty bar */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        <span>Fidélité</span>
                        <span style={{ color: 'var(--warn)' }}>{loyaltyPct}%</span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${loyaltyPct}%`, background: 'linear-gradient(90deg,#FFB800,#FF9500)', borderRadius: 99, transition: 'width .4s', boxShadow: '0 0 10px rgba(255,184,0,.5)' }} />
                      </div>
                    </div>

                    {/* Footer buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigate('/app/pos', { state: { customer: c } }) }}
                        style={{
                          flex: 1, padding: '9px', borderRadius: 10,
                          background: `linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
                          border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 800,
                          fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          transition: 'opacity .15s', boxShadow: `0 4px 16px ${cfg.glow}`,
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.82'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      >
                        <ShoppingCart size={11} /> Vente
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDetailCustomer(c); setShowDetailModal(true) }}
                        style={{
                          flex: 1, padding: '9px', borderRadius: 10,
                          background: cfg.soft, border: `1px solid ${cfg.border}`,
                          cursor: 'pointer', color: cfg.color, fontSize: 11, fontWeight: 800,
                          fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          transition: 'opacity .15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.82'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      >
                        <Eye size={11} /> Détail
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 14 }}>Aucun client trouvé</div>
            )}
          </div>
        )}
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
    </div>
  )
}
