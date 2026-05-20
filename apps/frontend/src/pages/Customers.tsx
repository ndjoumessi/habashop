import { useState, useEffect, useCallback } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { customersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, generateInvoice } from '@/utils/export'
import LoyaltyCard from '@/components/ui/LoyaltyCard'
import PhoneInput from '@/components/ui/PhoneInput'

type ClientType = 'Grossiste' | 'Semi-gros' | 'Fidèle' | 'Détail'

interface Purchase { ref: string; date: string; total: number; items: number }

interface Customer {
  id: string; name: string; type: ClientType; phone: string; email: string
  address: string; purchasesPerMonth: number; totalCA: number
  loyaltyPoints: number; maxLoyalty: number; since: string; lastPurchase: string
  purchases: Purchase[]; notes: string
}

const TYPE_CFG: Record<ClientType, { cls: string }> = {
  Grossiste: { cls: 'badge-violet' },
  'Semi-gros':{ cls: 'badge-blue'   },
  Fidèle:    { cls: 'badge-green'  },
  Détail:    { cls: 'badge-gray'   },
}

const CUSTOMERS_INIT: Customer[] = [
  {
    id: '1', name: 'Marché Central Sandaga', type: 'Grossiste',
    phone: '+221 77 100 20 30', email: 'sandaga@gmail.com',
    address: 'Marché Sandaga, Dakar', purchasesPerMonth: 8, totalCA: 4200000,
    loyaltyPoints: 840, maxLoyalty: 1000, since: '2024-01-15', lastPurchase: '2026-05-10',
    purchases: [
      { ref: 'VNT-2026-148', date: '2026-05-10', total: 520000, items: 6 },
      { ref: 'VNT-2026-130', date: '2026-04-28', total: 480000, items: 5 },
      { ref: 'VNT-2026-112', date: '2026-04-15', total: 610000, items: 8 },
    ],
    notes: 'Client prioritaire — livraison à domicile',
  },
  {
    id: '2', name: 'Boutique Awa Diallo', type: 'Fidèle',
    phone: '+221 76 234 56 78', email: 'awa.diallo@yahoo.fr',
    address: 'HLM, Dakar', purchasesPerMonth: 4, totalCA: 980000,
    loyaltyPoints: 420, maxLoyalty: 500, since: '2024-06-01', lastPurchase: '2026-05-08',
    purchases: [
      { ref: 'VNT-2026-145', date: '2026-05-08', total: 87000, items: 3 },
      { ref: 'VNT-2026-128', date: '2026-04-22', total: 95000, items: 4 },
    ],
    notes: '',
  },
  {
    id: '3', name: 'Super Épicerie du Plateau', type: 'Semi-gros',
    phone: '+221 33 456 78 90', email: 'epicerie.plateau@sn.com',
    address: 'Plateau, Dakar', purchasesPerMonth: 6, totalCA: 2100000,
    loyaltyPoints: 380, maxLoyalty: 500, since: '2024-03-20', lastPurchase: '2026-05-09',
    purchases: [
      { ref: 'VNT-2026-147', date: '2026-05-09', total: 215000, items: 7 },
      { ref: 'VNT-2026-132', date: '2026-04-30', total: 198000, items: 6 },
    ],
    notes: 'Paiement par virement bancaire',
  },
  {
    id: '4', name: 'Moussa Traoré', type: 'Détail',
    phone: '+221 70 567 89 01', email: '',
    address: 'Parcelles Assainies, Dakar', purchasesPerMonth: 2, totalCA: 145000,
    loyaltyPoints: 80, maxLoyalty: 200, since: '2025-02-10', lastPurchase: '2026-05-05',
    purchases: [
      { ref: 'VNT-2026-140', date: '2026-05-05', total: 18500, items: 2 },
    ],
    notes: '',
  },
  {
    id: '5', name: 'Distribution Thiès Nord', type: 'Grossiste',
    phone: '+221 77 678 90 12', email: 'distribution.thies@gmail.com',
    address: 'Thiès', purchasesPerMonth: 5, totalCA: 3400000,
    loyaltyPoints: 700, maxLoyalty: 1000, since: '2023-11-05', lastPurchase: '2026-05-07',
    purchases: [
      { ref: 'VNT-2026-143', date: '2026-05-07', total: 380000, items: 9 },
      { ref: 'VNT-2026-125', date: '2026-04-18', total: 420000, items: 10 },
    ],
    notes: 'Commandes hebdomadaires',
  },
  {
    id: '6', name: 'Fatou Seck Commerce', type: 'Semi-gros',
    phone: '+221 76 789 01 23', email: 'fatou.seck@gmail.com',
    address: 'Pikine, Dakar', purchasesPerMonth: 3, totalCA: 680000,
    loyaltyPoints: 150, maxLoyalty: 300, since: '2025-05-20', lastPurchase: '2026-05-03',
    purchases: [
      { ref: 'VNT-2026-138', date: '2026-05-03', total: 126000, items: 5 },
    ],
    notes: '',
  },
]

function SmartAddressInput({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSugg, setShowSugg] = useState(false)

  const fetchSuggestions = useCallback((input: string) => {
    if (!input || input.length < 3) { setSuggestions([]); return }
    const google = (window as any).google
    if (!google?.maps?.places?.AutocompleteService) return
    const svc = new google.maps.places.AutocompleteService()
    svc.getPlacePredictions(
      { input, types: ['address'], language: lang },
      (preds: any[] | null) => {
        setSuggestions((preds ?? []).slice(0, 4).map((p: any) => p.description))
      }
    )
  }, [lang])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg4)',
        border: '1.5px solid var(--border)',
        borderRadius: 12, overflow: 'visible',
      }}>
        <span style={{ padding: '0 6px 0 12px', fontSize: 14, flexShrink: 0, color: 'var(--text3)' }}>📍</span>
        <input
          type="text"
          className="input"
          style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 12px 10px 4px', outline: 'none' }}
          placeholder={lang === 'fr' ? 'Adresse du client...' : 'Customer address...'}
          value={value}
          autoComplete="off"
          onChange={e => {
            onChange(e.target.value)
            fetchSuggestions(e.target.value)
            setShowSugg(true)
          }}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
        />
        {value && (
          <button type="button"
            onClick={() => { onChange(''); setSuggestions([]) }}
            style={{ padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)' }}>✕</button>
        )}
      </div>
      {showSugg && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: '#0D0D1C', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.8)',
        }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={() => { onChange(s); setSuggestions([]); setShowSugg(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '9px 14px', background: 'transparent', border: 'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                fontSize: 12, color: 'var(--text)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <span style={{ fontSize: 12, flexShrink: 0 }}>📍</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LoyaltyBar({ points, max }: { points: number; max: number }) {
  const pct = Math.min(100, Math.round((points / max) * 100))
  const color = pct >= 80 ? 'var(--acc2)' : pct >= 50 ? 'var(--acc)' : 'var(--p2)'
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

function mapApiCustomer(c: any): Customer {
  return {
    id: c.id,
    name: c.name,
    type: (c.type === 'wholesale' ? 'Grossiste' : c.type === 'semi-wholesale' ? 'Semi-gros' : c.type === 'loyal' ? 'Fidèle' : 'Détail') as ClientType,
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    purchasesPerMonth: 0,
    totalCA: c.totalRevenue ?? 0,
    loyaltyPoints: c.loyaltyPoints ?? 0,
    maxLoyalty: 1000,
    since: c.createdAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    lastPurchase: c.updatedAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    purchases: [],
    notes: c.notes || '',
  }
}

export default function Customers() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const [customers, setCustomers] = useState(CUSTOMERS_INIT)

  useEffect(() => {
    customersApi.list()
      .then(data => setCustomers(data.map(mapApiCustomer)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => setShowCreate(true)
    window.addEventListener('habashop:new-customer', handler)
    return () => window.removeEventListener('habashop:new-customer', handler)
  }, [])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | ''>('')
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const defaultCustForm = {
    name: '', type: 'Détail' as ClientType,
    phoneCode: '+221', phoneNumber: '', phone: '',
    email: '', address: '',
  }
  const [form, setForm] = useState(defaultCustForm)
  const resetCustForm = () => setForm(defaultCustForm)
  const [editCustomer,     setEditCustomer]     = useState<Customer | null>(null)
  const [showEditCustModal, setShowEditCustModal] = useState(false)
  const [editCustForm,     setEditCustForm]     = useState({
    name: '', type: 'Détail' as ClientType, phone: '', email: '', address: '', notes: '',
  })
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null)
  const [customersTab, setCustomersTab] = useState<'list' | 'map' | 'stats'>('list')

  const filtered = customers.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) &&
    (!typeFilter || c.type === typeFilter)
  )

  const now = new Date()
  const activeThisMonth = customers.filter(c => {
    const d = new Date(c.lastPurchase)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const avgCart = customers.length > 0
    ? Math.round(customers.reduce((s, c) => s + c.totalCA / Math.max(1, c.purchasesPerMonth * 12), 0) / customers.length)
    : 0
  const retentionRate = customers.length > 0
    ? Math.round((customers.filter(c => c.purchasesPerMonth >= 3).length / customers.length) * 100)
    : 0

  const printCustomersPDF = () => {
    const body = `
      <h2>${t('customers_pdf_title')}</h2>
      ${htmlTable(
        [t('col_name'), t('col_type'), t('col_phone'), t('customers_purchases'), t('customers_total_revenue'), t('col_loyalty')],
        customers.map(c => [
          c.name,
          `<span class="badge badge-purple">${c.type}</span>`,
          c.phone,
          String(c.purchasesPerMonth),
          fmt(c.totalCA),
          c.loyaltyPoints + ' pts',
        ])
      )}
    `
    openPDF(t('customers_pdf_title'), body)
  }

  const handleCreateCustomer = async () => {
    if (!form.name?.trim()) {
      toast.error(lang === 'fr' ? 'Nom requis' : 'Name required')
      return
    }
    const fullPhone = form.phoneCode && form.phoneNumber
      ? `${form.phoneCode}${form.phoneNumber.replace(/\s/g, '')}`
      : form.phone ?? ''
    const data = {
      name:    form.name.trim(),
      type:    form.type    ?? 'retail',
      phone:   fullPhone,
      email:   form.email   ?? '',
      address: form.address ?? '',
    }
    try {
      const created = await customersApi.create(data)
      setCustomers(prev => [...prev, mapApiCustomer(created)])
      toast.success('✅ ' + (lang === 'fr' ? 'Client créé !' : 'Customer created!'))
      setShowCreate(false)
      resetCustForm()
    } catch {
      setCustomers(prev => [...prev, {
        id: Date.now().toString(),
        name:    data.name,
        type:    data.type as ClientType,
        phone:   data.phone,
        email:   data.email,
        address: data.address,
        purchasesPerMonth: 0, totalCA: 0,
        loyaltyPoints: 0, maxLoyalty: 200,
        since:        new Date().toISOString().split('T')[0],
        lastPurchase: new Date().toISOString().split('T')[0],
        purchases: [],
        notes: '',
      }])
      toast.success('✅ ' + (lang === 'fr' ? 'Client créé (local)' : 'Customer created (local)'))
      setShowCreate(false)
      resetCustForm()
    }
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('customers_total'),       value: customers.length.toString(), color: 'var(--p2)',   icon: '👥' },
          { label: t('customers_active'),    value: activeThisMonth.toString(),  color: 'var(--acc2)', icon: '🟢' },
          { label: t('customers_avg_cart'),  value: fmt(avgCart),                color: 'var(--acc)',  icon: '🛒' },
          { label: t('customers_retention'), value: `${retentionRate}%`,         color: 'var(--p3)',   icon: '🔄' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--bg3)', borderRadius: 10, padding: 4,
      }}>
        {[
          { id: 'list',  label: lang === 'fr' ? '📋 Liste'        : '📋 List'       },
          { id: 'map',   label: lang === 'fr' ? '🗺️ Carte'        : '🗺️ Map'        },
          { id: 'stats', label: lang === 'fr' ? '📊 Statistiques' : '📊 Statistics'  },
        ].map(tab => (
          <button key={tab.id} type="button"
            onClick={() => setCustomersTab(tab.id as any)}
            style={{
              flex: 1, padding: '8px', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font)',
              background: customersTab === tab.id
                ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
              color: customersTab === tab.id ? '#fff' : 'var(--text2)',
              border: 'none', transition: 'all .15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {customersTab === 'list' && <div className="panel">
        <div className="panel-head">
          <span className="panel-title">👥 {t('customers_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_clients',
                ['Nom','Type','Téléphone','Email','Achats/mois','CA total','Points fidélité'],
                customers.map(c => [c.name, c.type, c.phone, c.email ?? '', c.purchasesPerMonth, c.totalCA, c.loyaltyPoints])
              )
              toast.success('📊 Export CSV téléchargé !')
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printCustomersPDF(); toast.success('📄 PDF ouvert !') }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> {t('btn_new')} client
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Nom, téléphone…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_type').toLowerCase()}</option>
            <option>Grossiste</option><option>Semi-gros</option><option>Fidèle</option><option>Détail</option>
          </select>
        </div>

        {/* Tableau */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('col_client')}</th><th>{t('col_type')}</th><th>{t('col_phone')}</th>
                <th>{t('customers_purchases')}</th><th>{t('customers_total_revenue')}</th><th>{t('col_loyalty')}</th><th>{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="td-bold">{c.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      Depuis {new Date(c.since).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td><span className={`badge ${TYPE_CFG[c.type].cls}`}>{c.type}</span></td>
                  <td className="td-mono">{c.phone}</td>
                  <td className="td-num" style={{ color: 'var(--text2)' }}>{c.purchasesPerMonth}×</td>
                  <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(c.totalCA)}</td>
                  <td style={{ minWidth: 120 }}><LoyaltyBar points={c.loyaltyPoints} max={c.maxLoyalty} /></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-sm btn-ghost" title="Voir fiche" onClick={() => setViewCustomer(c)}>
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-sm btn-ghost" title="Modifier" onClick={() => {
                        setEditCustomer(c)
                        setEditCustForm({ name:c.name, type:c.type, phone:c.phone, email:c.email??'', address:c.address??'', notes:c.notes??'' })
                        setShowEditCustModal(true)
                      }}>✏️</button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(14,196,126,0.12)', color: 'var(--acc2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        onClick={() => toast.success(`🛒 Vente pour ${c.name}`)}>
                        🛒 Vente
                      </button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(255,215,0,0.12)', color: '#B8860B', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        title="Carte fidélité"
                        onClick={() => setLoyaltyCustomer(c)}>
                        🎁
                      </button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(91,78,232,0.12)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        title="Générer un devis PDF"
                        onClick={() => generateInvoice({
                          type: 'devis',
                          lang: 'fr',
                          customer: { name: c.name, phone: c.phone },
                          items: [{ name: 'Article', qty: 1, price: 0 }],
                        })}>
                        📄
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
      </div>}

      {/* ── Onglet Carte ── */}
      {customersTab === 'map' && (
        <div className="panel">
          <div className="panel-h">
            <span className="panel-t">🗺️ {lang === 'fr' ? 'Carte des clients' : 'Customer map'}</span>
          </div>
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg,rgba(59,130,246,.05),rgba(91,78,232,.05))',
            border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            height: 400,
          }}>
            <svg viewBox="0 0 800 400" style={{ width: '100%', height: '100%' }}>
              <rect width="800" height="400" fill="var(--bg3)" rx="12"/>
              <ellipse cx="200" cy="200" rx="150" ry="120" fill="rgba(59,130,246,.08)" stroke="rgba(59,130,246,.2)" strokeWidth="1"/>
              <ellipse cx="500" cy="150" rx="120" ry="90" fill="rgba(91,78,232,.08)" stroke="rgba(91,78,232,.2)" strokeWidth="1"/>
              <ellipse cx="600" cy="300" rx="100" ry="80" fill="rgba(14,196,126,.08)" stroke="rgba(14,196,126,.2)" strokeWidth="1"/>
              <ellipse cx="350" cy="320" rx="80" ry="60" fill="rgba(240,165,0,.08)" stroke="rgba(240,165,0,.2)" strokeWidth="1"/>
              <text x="200" y="180" textAnchor="middle" fontSize="12" fill="#3B82F6" fontWeight="600">Zone Centre</text>
              <text x="500" y="130" textAnchor="middle" fontSize="12" fill="#5B4EE8" fontWeight="600">Zone Nord</text>
              <text x="600" y="280" textAnchor="middle" fontSize="12" fill="#10B981" fontWeight="600">Zone Est</text>
              <text x="350" y="310" textAnchor="middle" fontSize="12" fill="#F59E0B" fontWeight="600">Zone Sud</text>
              {customers.slice(0, 20).map((customer, i) => {
                const zones = [
                  { cx: 200, cy: 200, r: 120 },
                  { cx: 500, cy: 150, r: 90 },
                  { cx: 600, cy: 300, r: 80 },
                  { cx: 350, cy: 320, r: 60 },
                ]
                const zone = zones[i % 4]
                const angle = (i / 5) * Math.PI * 2
                const radius = (i % 3 + 1) * (zone.r / 3)
                const x = zone.cx + Math.cos(angle) * radius
                const y = zone.cy + Math.sin(angle) * radius
                const colorMap: Record<string, string> = {
                  'Grossiste': '#5B4EE8', 'Semi-gros': '#F59E0B',
                  'Fidèle': '#10B981', 'Détail': '#3B82F6',
                }
                const color = colorMap[customer.type] ?? '#3B82F6'
                return (
                  <g key={customer.id}>
                    <circle cx={x} cy={y} r={14} fill={color} opacity={0.15}/>
                    <circle cx={x} cy={y} r={8} fill={color} opacity={0.85} style={{ cursor: 'pointer' }}>
                      <title>{customer.name} — {customer.type}</title>
                    </circle>
                  </g>
                )
              })}
              {[
                { color: '#5B4EE8', label: 'Grossiste' },
                { color: '#F59E0B', label: 'Semi-gros' },
                { color: '#10B981', label: 'Fidèle' },
                { color: '#3B82F6', label: 'Détail' },
              ].map((l, i) => (
                <g key={l.label}>
                  <circle cx={20} cy={20 + i * 22} r={6} fill={l.color}/>
                  <text x={32} y={25 + i * 22} fontSize="11" fill="var(--text3)">{l.label}</text>
                </g>
              ))}
            </svg>
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'rgba(255,255,255,.9)',
              backdropFilter: 'blur(10px)',
              borderRadius: 10, padding: '10px 14px',
              fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a1a2e' }}>
                📍 {customers.length} {lang === 'fr' ? 'clients au total' : 'total customers'}
              </div>
              {[
                { type: 'Grossiste', color: '#5B4EE8' },
                { type: 'Semi-gros', color: '#F59E0B' },
                { type: 'Fidèle',    color: '#10B981' },
              ].map(t => (
                <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#666', marginBottom: 2 }}>
                  <span style={{ color: t.color, fontWeight: 600 }}>● {t.type}</span>
                  <span>{customers.filter(c => c.type === t.type).length}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
              📋 {lang === 'fr' ? 'Clients par zone' : 'Customers by zone'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {['Zone Centre', 'Zone Nord', 'Zone Est', 'Zone Sud'].map((zone, i) => {
                const zoneCustomers = customers.filter((_, idx) => idx % 4 === i)
                const zoneCA = zoneCustomers.reduce((s, c) => s + (c.totalCA ?? 0), 0)
                return (
                  <div key={zone} style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>📍 {zone}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {zoneCustomers.length} {lang === 'fr' ? 'clients' : 'customers'}
                      {' · '}
                      <span style={{ color: 'var(--p2)', fontWeight: 600 }}>{fmt(zoneCA)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Onglet Stats ── */}
      {customersTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-h">
              <span className="panel-t">📊 {lang === 'fr' ? 'Répartition par type' : 'Distribution by type'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['Grossiste', 'Semi-gros', 'Fidèle', 'Détail'] as const).map(type => {
                const count = customers.filter(c => c.type === type).length
                const ca = customers.filter(c => c.type === type).reduce((s, c) => s + (c.totalCA ?? 0), 0)
                const pct = customers.length > 0 ? Math.round(count / customers.length * 100) : 0
                const colors: Record<string, string> = {
                  'Grossiste': 'var(--p2)', 'Semi-gros': 'var(--acc)',
                  'Fidèle': 'var(--acc2)', 'Détail': '#60A5FA',
                }
                const color = colors[type] ?? 'var(--p2)'
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{type}</span>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <span style={{ color: 'var(--text3)' }}>{count} clients</span>
                        <span style={{ color, fontWeight: 700 }}>{fmt(ca)}</span>
                        <span style={{ color: 'var(--text3)' }}>{pct} %</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">
              <span className="panel-t">🏆 {lang === 'fr' ? 'Top 5 clients' : 'Top 5 customers'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...customers]
                .sort((a, b) => (b.totalCA ?? 0) - (a.totalCA ?? 0))
                .slice(0, 5)
                .map((c, i) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px', background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? 'linear-gradient(135deg,#F59E0B,#FCD34D)'
                      : i === 1 ? 'linear-gradient(135deg,#9CA3AF,#D1D5DB)'
                      : i === 2 ? 'linear-gradient(135deg,#D97706,#F59E0B)'
                      : 'var(--bg4)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff',
                  }}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.type} · {c.loyaltyPoints} pts</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--p2)', fontFamily: 'var(--mono)' }}>
                    {fmt(c.totalCA ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal fiche client ── */}
      {viewCustomer && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewCustomer(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>👤 {viewCustomer.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  Depuis {new Date(viewCustomer.since).toLocaleDateString('fr-FR')} · Dernière visite {new Date(viewCustomer.lastPurchase).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${TYPE_CFG[viewCustomer.type].cls}`}>{viewCustomer.type}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewCustomer(null)}><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Téléphone',    value: viewCustomer.phone || '—' },
                { label: 'Email',        value: viewCustomer.email || '—' },
                { label: 'CA total',     value: fmt(viewCustomer.totalCA) },
                { label: 'Achats/mois',  value: `${viewCustomer.purchasesPerMonth} commandes` },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--bg3)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>Solde fidélité</span>
                <span className="text-sm font-black" style={{ color: 'var(--acc)' }}>{viewCustomer.loyaltyPoints} pts</span>
              </div>
              <LoyaltyBar points={viewCustomer.loyaltyPoints} max={viewCustomer.maxLoyalty} />
              <p className="text-xs mt-2" style={{ color: 'var(--text3)' }}>
                Objectif : {viewCustomer.maxLoyalty} pts · Reste {Math.max(0, viewCustomer.maxLoyalty - viewCustomer.loyaltyPoints)} pts
              </p>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>Historique achats</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Référence</th><th>Date</th><th>Articles</th><th>Montant</th></tr></thead>
                  <tbody>
                    {viewCustomer.purchases.map(p => (
                      <tr key={p.ref}>
                        <td className="td-mono text-xs">{p.ref}</td>
                        <td className="td-mono text-xs">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                        <td className="text-xs" style={{ color: 'var(--text2)' }}>{p.items} art.</td>
                        <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(p.total)}</td>
                      </tr>
                    ))}
                    {viewCustomer.purchases.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }}>Aucun achat</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {viewCustomer.notes && (
              <div className="p-3 rounded-xl text-xs mb-4"
                style={{ background: 'rgba(91,78,232,0.08)', border: '1px solid rgba(91,78,232,0.2)', color: 'var(--p3)' }}>
                📝 {viewCustomer.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                onClick={() => { toast.success(`🛒 Vente pour ${viewCustomer.name}`); setViewCustomer(null) }}>
                🛒 Nouvelle vente
              </button>
              <button className="btn btn-ghost" onClick={() => setViewCustomer(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal modifier client ── */}
      {showEditCustModal && editCustomer && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditCustModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>✏️ Modifier — {editCustomer.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditCustModal(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Nom / Enseigne</label>
                <input className="input text-sm" value={editCustForm.name}
                  onChange={e => setEditCustForm(f => ({...f, name:e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Type</label>
                <select className="input text-sm" value={editCustForm.type}
                  onChange={e => setEditCustForm(f => ({...f, type:e.target.value as ClientType}))}>
                  <option>Grossiste</option><option>Semi-gros</option><option>Fidèle</option><option>Détail</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Téléphone</label>
                <PhoneInput value={editCustForm.phone} onChange={v => setEditCustForm(f => ({...f, phone:v}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Email</label>
                <input className="input text-sm" type="email" value={editCustForm.email}
                  onChange={e => setEditCustForm(f => ({...f, email:e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Adresse</label>
                <SmartAddressInput value={editCustForm.address}
                  onChange={v => setEditCustForm(f => ({...f, address:v}))} lang={lang} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
                <textarea className="input text-sm" rows={2} value={editCustForm.notes}
                  onChange={e => setEditCustForm(f => ({...f, notes:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => setShowEditCustModal(false)}>{t('btn_cancel')}</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={async () => {
                if (!editCustForm.name) { toast.error('Nom requis'); return }
                try { await customersApi.update(editCustomer.id, { name: editCustForm.name, phone: editCustForm.phone, email: editCustForm.email, address: editCustForm.address, notes: editCustForm.notes, type: editCustForm.type }) } catch {}
                setCustomers(prev => prev.map(c =>
                  c.id === editCustomer.id ? { ...c, ...editCustForm } : c
                ))
                setShowEditCustModal(false)
                toast.success(`✅ ${editCustForm.name} mis à jour`)
              }}>✅ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouveau client ── */}
      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{
            background:'#0D0D1C',
            border:'1px solid rgba(255,255,255,.1)',
            borderRadius:24, width:'100%', maxWidth:480,
            maxHeight:'90vh', overflow:'hidden',
            display:'flex', flexDirection:'column',
            boxShadow:'0 24px 80px rgba(0,0,0,.8)',
            position:'relative',
          }}>
            <div style={{
              position:'absolute', top:0, left:'50%',
              transform:'translateX(-50%)',
              width:'40%', height:1,
              background:'linear-gradient(90deg,transparent,#F472B6,transparent)',
            }} />
            <div style={{
              padding:'20px 24px 16px',
              borderBottom:'1px solid rgba(255,255,255,.06)',
              flexShrink:0, display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{
                width:44, height:44, borderRadius:13,
                background:'linear-gradient(135deg,#F472B6,#EC4899)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, boxShadow:'0 4px 14px rgba(244,114,182,.4)',
              }}>👤</div>
              <div style={{flex:1}}>
                <h3 style={{ fontSize:17, fontWeight:900, color:'var(--text)', margin:0, letterSpacing:'-.3px' }}>
                  {lang==='fr'?'+ Nouveau client':'+ New customer'}
                </h3>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                  {lang==='fr'?'Ajoutez un client à votre CRM':'Add a customer to your CRM'}
                </div>
              </div>
              <button type="button" onClick={()=>setShowCreate(false)} style={{
                width:30, height:30, borderRadius:9,
                background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)',
                cursor:'pointer', fontSize:14, color:'var(--text3)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>✕</button>
            </div>

            <div style={{
              flex:1, overflowY:'auto', minHeight:0,
              padding:'20px 24px', display:'flex', flexDirection:'column', gap:14,
            }}>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                  {lang==='fr'?'NOM / ENSEIGNE *':'NAME / COMPANY *'}
                </label>
                <input className="input" autoFocus
                  placeholder={lang==='fr'?'Nom du client...':'Customer name...'}
                  value={form.name}
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>TYPE</label>
                  <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as ClientType}))}>
                    <option value="Détail">👤 {lang==='fr'?'Détail':'Retail'}</option>
                    <option value="Grossiste">🏭 {lang==='fr'?'Grossiste':'Wholesale'}</option>
                    <option value="Semi-gros">📦 {lang==='fr'?'Semi-gros':'Semi-wholesale'}</option>
                    <option value="Fidèle">⭐ {lang==='fr'?'Fidèle':'Loyal'}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                    {lang==='fr'?'TÉLÉPHONE':'PHONE'}
                  </label>
                  <div style={{
                    display:'flex', background:'var(--bg4)',
                    border:'1.5px solid var(--border)', borderRadius:12, overflow:'hidden',
                  }}
                    onFocusCapture={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--p)'}}
                    onBlurCapture={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)'}}
                  >
                    <select value={form.phoneCode??'+221'} onChange={e=>setForm(f=>({...f,phoneCode:e.target.value}))}
                      style={{ background:'rgba(108,71,255,.08)', border:'none', borderRight:'1px solid var(--border)', color:'var(--text)', fontSize:12, fontWeight:600, padding:'0 8px', cursor:'pointer', outline:'none', fontFamily:'var(--font)', width:80 }}>
                      {[
                        {code:'+221',flag:'🇸🇳'},{code:'+225',flag:'🇨🇮'},{code:'+223',flag:'🇲🇱'},
                        {code:'+237',flag:'🇨🇲'},{code:'+242',flag:'🇨🇬'},{code:'+241',flag:'🇬🇦'},
                        {code:'+226',flag:'🇧🇫'},{code:'+229',flag:'🇧🇯'},{code:'+228',flag:'🇹🇬'},
                        {code:'+224',flag:'🇬🇳'},{code:'+227',flag:'🇳🇪'},{code:'+212',flag:'🇲🇦'},
                        {code:'+213',flag:'🇩🇿'},{code:'+216',flag:'🇹🇳'},{code:'+33',flag:'🇫🇷'},
                        {code:'+39',flag:'🇮🇹'},{code:'+32',flag:'🇧🇪'},{code:'+41',flag:'🇨🇭'},
                        {code:'+34',flag:'🇪🇸'},{code:'+44',flag:'🇬🇧'},{code:'+1',flag:'🇺🇸'},
                      ].map(c=>(
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input type="tel" placeholder="77 000 00 00"
                      value={form.phoneNumber??''}
                      onChange={e=>setForm(f=>({...f, phoneNumber:e.target.value, phone:`${f.phoneCode??'+221'}${e.target.value.replace(/\s/g,'')}`}))}
                      style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13, padding:'10px 12px', fontFamily:'var(--font)' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>EMAIL</label>
                <input className="input" type="email" placeholder="email@exemple.com"
                  value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                  {lang==='fr'?'ADRESSE':'ADDRESS'}
                </label>
                <SmartAddressInput value={form.address} onChange={v=>setForm(f=>({...f,address:v}))} lang={lang} />
              </div>
            </div>

            <div style={{
              padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,.06)',
              flexShrink:0, display:'flex', gap:8,
            }}>
              <button onClick={handleCreateCustomer} style={{
                flex:1, padding:'13px',
                background:'linear-gradient(135deg,#F472B6,#EC4899)',
                border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:800,
                cursor:'pointer', fontFamily:'var(--font)',
                boxShadow:'0 4px 16px rgba(244,114,182,.4)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
                ✅ {lang==='fr'?'Ajouter le client':'Add customer'}
              </button>
              <button onClick={()=>{setShowCreate(false);resetCustForm()}} style={{
                padding:'13px 18px', background:'rgba(255,255,255,.05)',
                border:'1px solid rgba(255,255,255,.08)', borderRadius:12,
                cursor:'pointer', color:'var(--text2)', fontSize:13,
                fontFamily:'var(--font)', fontWeight:600,
              }}>
                {lang==='fr'?'Annuler':'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loyaltyCustomer && (
        <LoyaltyCard customer={loyaltyCustomer} onClose={() => setLoyaltyCustomer(null)} />
      )}
    </div>
  )
}
