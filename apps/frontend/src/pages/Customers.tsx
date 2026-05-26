import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, useAbbrevAmount, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { customersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X, Users, UserCheck, ShoppingCart, TrendingUp, MapPin, Grid3X3, LayoutList, Pencil, Gift, FileText, BarChart3, Building2, ShoppingBag, Star, Phone, Mail, Crown, Navigation2, Globe, Flame, AlertTriangle, DollarSign, StickyNote, UserPlus, CheckCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirm } from '@/lib/confirm'
import { exportCSV, openPDF, htmlTable, generateInvoice } from '@/utils/export'
import LoyaltyCard from '@/components/ui/LoyaltyCard'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import ViewField from '@/components/ui/ViewField'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

import CustomerMap from '@/components/customers/CustomerMap'
import CustomersList from '@/components/customers/CustomersList'
import CustomersStats from '@/components/customers/CustomersStats'
import CustomersModals from '@/components/customers/CustomersModals'
import { type ClientType, type Customer, mapApiCustomer, useGoogleMaps, GMAPS_KEY } from '@/components/customers/customersShared'

export default function Customers() {
  const { lang } = useConfig()
  const { i } = useI18n()
  void lang
  const fmt = useFormatAmount()
  const abbr = useAbbrevAmount()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])

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
    phone: '', email: '', address: '',
  }
  const [form, setForm] = useState(defaultCustForm)
  const resetCustForm = () => setForm(defaultCustForm)
  const [editCustomer,     setEditCustomer]     = useState<Customer | null>(null)
  const [showEditCustModal, setShowEditCustModal] = useState(false)
  const [custEditMode,     setCustEditMode]     = useState(false)
  const [editCustForm,     setEditCustForm]     = useState({
    name: '', type: 'Détail' as ClientType, phone: '', email: '', address: '', notes: '',
  })
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null)
  const [customersTab, setCustomersTab] = useState<'list' | 'map' | 'stats'>('list')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailCustomer, setDetailCustomer]   = useState<Customer | null>(null)
  const [viewMode, setViewMode]               = useState<'table' | 'grid'>('table')
  const [mapHover, setMapHover]               = useState<string | null>(null)
  const [mapTypeFilter, setMapTypeFilter]     = useState<ClientType | ''>('')
  const [geoPositions, setGeoPositions] = useState<Record<string, { lat: number; lng: number }>>({})
  const [geocoding, setGeocoding]       = useState(false)

  const { loaded: mapsLoaded } = useGoogleMaps(GMAPS_KEY)

  const geocodeCustomers = useCallback(async (customerList: any[]) => {
    const google = (window as any).google
    if (!google?.maps?.Geocoder) return
    setGeocoding(true)
    const geocoder = new google.maps.Geocoder()
    const results: Record<string, { lat: number; lng: number }> = {}
    const withAddress = customerList.filter(c => c.address && c.address.trim().length > 3)
    const batchSize = 5
    for (let i = 0; i < withAddress.length; i += batchSize) {
      const batch = withAddress.slice(i, i + batchSize)
      await Promise.all(batch.map(async (c) => {
        try {
          const res = await new Promise<any>((resolve, reject) => {
            geocoder.geocode({ address: c.address }, (r: any[], status: string) => {
              if (status === 'OK' && r[0]) resolve(r[0])
              else reject(new Error(status))
            })
          })
          results[c.id] = { lat: res.geometry.location.lat(), lng: res.geometry.location.lng() }
        } catch {}
      }))
      if (i + batchSize < withAddress.length) await new Promise(r => setTimeout(r, 300))
    }
    setGeoPositions(results)
    setGeocoding(false)
  }, [])

  useEffect(() => {
    if (mapsLoaded && customers.length > 0 && customersTab === 'map') {
      geocodeCustomers(customers)
    }
  }, [mapsLoaded, customers, customersTab, geocodeCustomers])

  const filtered = customers.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) &&
    (!typeFilter || c.type === typeFilter)
  )
  const pg = usePagination(filtered, 12)
  useEffect(() => { pg.reset() }, [search, typeFilter])

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

  const handleDeleteCustomer = async (id: string) => {
    const c = customers.find(x => x.id === id)
    const ok = await confirm({
      title: i('Supprimer ce client ?', 'Delete this customer?', '¿Eliminar este cliente?', 'Eliminare questo cliente?'),
      message: c?.name ?? '',
    })
    if (!ok) return
    try { await customersApi.delete(id) } catch {}
    setCustomers(prev => prev.filter(x => x.id !== id))
    toast.success(i('Client supprimé', 'Customer deleted', 'Cliente eliminado', 'Cliente eliminato'))
  }

  const handleCreateCustomer = async () => {
    if (!form.name?.trim()) {
      toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto'))
      return
    }
    const fullPhone = form.phone ?? ''
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
      toast.success(i('Client créé', 'Customer created', 'Cliente creado', 'Cliente creato'))
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
      toast.success(i('Client créé (local)', 'Customer created (local)', 'Cliente creado (local)', 'Cliente creato (locale)'))
      setShowCreate(false)
      resetCustForm()
    }
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_customers')}</h1>
          <p className="page-subtitle">{customers.length} {i('clients enregistrés', 'registered customers', 'clientes registrados', 'clienti registrati')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { printCustomersPDF(); toast.success(i('PDF ouvert', 'PDF opened', 'PDF abierto', 'PDF aperto')) }}>
            <Download size={14} /> Export
          </button>
          <button className="topbar-btn" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> {i('Nouveau client', 'New customer', 'Nuevo cliente', 'Nuovo cliente')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('customers_total'),     value: customers.length.toString(), hex: 'var(--p)', icon: <Users size={18} /> },
          { label: t('customers_active'),    value: activeThisMonth.toString(),  hex: 'var(--acc2)', icon: <UserCheck size={18} /> },
          { label: t('customers_avg_cart'),  value: fmt(avgCart),                hex: 'var(--acc)', icon: <ShoppingCart size={18} /> },
          { label: t('customers_retention'), value: `${retentionRate}%`,         hex: 'var(--acc3)', icon: <TrendingUp size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position:'relative', overflow:'hidden', background:`linear-gradient(135deg,${k.hex}18,${k.hex}06)`, border:`1px solid ${k.hex}28`, transition:'transform .2s,box-shadow .2s', cursor:'default' }}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform='translateY(-2px)';el.style.boxShadow=`0 8px 24px ${k.hex}20`}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform='';el.style.boxShadow=''}}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div className="kpi-icon-w" style={{ color: k.hex, background:`${k.hex}20` }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.hex }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--bg3)', borderRadius: 10, padding: 4,
      }}>
        {[
          { id: 'list',  label: i('Liste', 'List', 'Lista', 'Elenco')       },
          { id: 'map',   label: i('Carte', 'Map', 'Mapa', 'Mappa')        },
          { id: 'stats', label: i('Statistiques', 'Statistics', 'Estadísticas', 'Statistiche')  },
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
      {customersTab === 'list' && (
        <CustomersList
          customers={customers}
          search={search} setSearch={setSearch}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          viewMode={viewMode} setViewMode={setViewMode}
          pg={pg} filtered={filtered}
          fmt={fmt} abbr={abbr} lang={lang} i={i}
          navigate={navigate}
          printCustomersPDF={printCustomersPDF}
          setViewCustomer={setViewCustomer}
          setEditCustomer={setEditCustomer} setEditCustForm={setEditCustForm}
          setCustEditMode={setCustEditMode} setShowEditCustModal={setShowEditCustModal}
          setLoyaltyCustomer={setLoyaltyCustomer}
          setDetailCustomer={setDetailCustomer} setShowDetailModal={setShowDetailModal}
          onDelete={handleDeleteCustomer}
        />
      )}

      {/* ── Onglet Carte — Google Maps ── */}
      {customersTab === 'map' && (
        <div className="animate-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} style={{ color: 'var(--p2)' }} />
                {i('Carte des clients', 'Customer map', 'Mapa de clientes', 'Mappa clienti')}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                {Object.keys(geoPositions).length} {i('client(s) localisé(s) sur', 'customer(s) located out of', 'cliente(s) localizado(s) de', 'cliente/i localizzato/i su')} {customers.length}
              </p>
            </div>
            <button
              onClick={() => geocodeCustomers(customers)}
              disabled={geocoding || !mapsLoaded}
              style={{
                padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, fontWeight: 700,
                cursor: geocoding || !mapsLoaded ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6,
                opacity: geocoding || !mapsLoaded ? .6 : 1, transition: 'opacity .15s',
              }}>
              <MapPin size={12} />
              {geocoding ? i('Localisation…', 'Locating…', 'Localizando…', 'Localizzazione…') : i('Actualiser', 'Refresh', 'Actualizar', 'Aggiorna')}
            </button>
          </div>

          <CustomerMap
            customers={customers}
            geoPositions={geoPositions}
            geocoding={geocoding}
            mapsLoaded={mapsLoaded}
            fmt={fmt}
            lang={lang}
            navigate={navigate}
            onOpenDetail={c => { setDetailCustomer(c); setShowDetailModal(true) }}
          />

          {customers.filter(c => !geoPositions[c.id]).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertTriangle size={13} style={{flexShrink:0}} /> {i('Clients sans adresse', 'Customers without address', 'Clientes sin dirección', 'Clienti senza indirizzo')} ({customers.filter(c => !geoPositions[c.id]).length}) — {i('non affichés sur la carte', 'not shown on the map', 'no mostrados en el mapa', 'non mostrati sulla mappa')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {customers.filter(c => !geoPositions[c.id]).map(c => (
                  <span key={c.id} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: 'rgba(255,184,0,.08)', border: '1px solid rgba(255,184,0,.2)', color: 'var(--warn)' }}>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {customersTab === 'stats' && (
        <CustomersStats customers={customers} fmt={fmt} lang={lang} i={i} setViewCustomer={setViewCustomer} />
      )}
      <CustomersModals
        viewCustomer={viewCustomer} setViewCustomer={setViewCustomer}
        fmt={fmt} lang={lang} i={i} navigate={navigate}
        setDetailCustomer={setDetailCustomer} setShowDetailModal={setShowDetailModal}
        showEditCustModal={showEditCustModal} editCustomer={editCustomer} setShowEditCustModal={setShowEditCustModal}
        custEditMode={custEditMode} setCustEditMode={setCustEditMode}
        editCustForm={editCustForm} setEditCustForm={setEditCustForm}
        setCustomers={setCustomers}
        showCreate={showCreate} setShowCreate={setShowCreate}
        form={form} setForm={setForm}
        handleCreateCustomer={handleCreateCustomer} resetCustForm={resetCustForm}
        showDetailModal={showDetailModal} detailCustomer={detailCustomer}
        setEditCustomer={setEditCustomer}
        loyaltyCustomer={loyaltyCustomer} setLoyaltyCustomer={setLoyaltyCustomer}
      />
    </div>
  )
}
