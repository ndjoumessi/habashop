import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, useAbbrevAmount, useAppStore, convertFromXOF, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { customersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X, Users, UserCheck, ShoppingCart, TrendingUp, MapPin, Grid3X3, LayoutList, Pencil, Gift, FileText, BarChart3, Building2, ShoppingBag, Star, Phone, Mail, Crown, Navigation2, Globe, Flame, AlertTriangle, DollarSign, StickyNote, UserPlus, CheckCircle, Trash2, ChevronDown, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirm } from '@/lib/confirm'
import { announce } from '@/lib/announce'
import { exportCSV, openPDF, htmlTable, generateInvoice } from '@/utils/export'
import LoyaltyCard from '@/components/ui/LoyaltyCard'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import ViewField from '@/components/ui/ViewField'
import Pagination from '@/components/ui/Pagination'
import Skeleton from '@/components/ui/skeleton'
import { usePagination } from '@/hooks/usePagination'

import CustomerMap from '@/components/customers/CustomerMap'
import CustomersList from '@/components/customers/CustomersList'
import CustomersStats from '@/components/customers/CustomersStats'
import CustomersModals from '@/components/customers/CustomersModals'
import { type ClientType, type Customer, type CustomerForm, type EditCustomerForm, mapApiCustomer, useGoogleMaps, GMAPS_KEY, AmountCur } from '@/components/customers/customersShared'

export default function Customers() {
  const { lang } = useConfig()
  const { i } = useI18n()
  void lang
  const fmt = useFormatAmount()
  const abbr = useAbbrevAmount()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)

  useEffect(() => {
    customersApi.list()
      .then(data => setCustomers(data.map(mapApiCustomer)))
      .catch(() => toast.error(i('Impossible de charger les clients — réessayer', 'Could not load customers — please retry', 'No se pudieron cargar los clientes — reintenta', 'Impossibile caricare i clienti — riprova')))
      .finally(() => setLoadingCustomers(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [form, setForm] = useState<CustomerForm>(defaultCustForm)
  const resetCustForm = () => setForm(defaultCustForm)
  const [editCustomer,     setEditCustomer]     = useState<Customer | null>(null)
  const [showEditCustModal, setShowEditCustModal] = useState(false)
  const [custEditMode,     setCustEditMode]     = useState(false)
  const [editCustForm,     setEditCustForm]     = useState<EditCustomerForm>({
    name: '', type: 'Détail' as ClientType, phone: '', email: '', address: '', notes: '',
  })
  const [digitalCardCustomerId, setDigitalCardCustomerId] = useState<string | null>(null)
  // P0 fidélité : le gate `tenant?.enableLoyalty` dans CustomersModals rendait le clic
  // MORT (aucun feedback) quand le programme est désactivé — cas du tenant démo réel
  // (enableLoyalty=false en base). Garde AU CLIC : toast explicite uniquement si le
  // tenant chargé dit explicitement false (tenant pas encore chargé → on ouvre, la
  // carte fetch la donnée serveur autoritaire — pas de faux négatif pendant le fetch).
  const tenant = useAppStore(s => s.tenant)
  const loyaltyKnownOff = tenant != null && tenant.enableLoyalty === false
  const openLoyaltyCard = (id: string | null) => {
    if (id !== null && loyaltyKnownOff) {
      toast(i(
        'Programme fidélité désactivé — activez-le dans Réglages → POS',
        'Loyalty program disabled — enable it in Settings → POS',
        'Programa de fidelidad desactivado — actívalo en Ajustes → TPV',
        'Programma fedeltà disattivato — attivalo in Impostazioni → POS',
      ), { icon: <Star size={16} style={{ color: 'var(--warn)' }} /> })
      return
    }
    setDigitalCardCustomerId(id)
  }
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
  // « — » plutôt que « 0 % / 0 € » quand AUCUNE vente : distingue « pas de donnée » de « mauvaise
  // perf ». Un écran de boutique neuve (1 client, 0 achat) ne doit pas se lire comme un échec.
  const hasSales = customers.some(c => (c.totalCA ?? 0) > 0)

  // Export : UN SEUL contrôle (menu CSV + PDF dans le header) — le doublon
  // barre-du-haut vs section (Exporter/PDF dans le panel) est supprimé.
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showExportMenu) return
    const onDoc = (e: MouseEvent) => { if (!exportMenuRef.current?.contains(e.target as Node)) setShowExportMenu(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowExportMenu(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [showExportMenu])

  const exportCustomersCSV = () => {
    // Montants stockés en base XOF → convertis vers la devise d'affichage (pattern reportsExport)
    const currency = useAppStore.getState().currency
    const cv = (xof: number) => Math.round(convertFromXOF(xof ?? 0, currency) * 100) / 100
    exportCSV('habashop_clients',
      [i('Nom', 'Name', 'Nombre', 'Nome'), i('Type', 'Type', 'Tipo', 'Tipo'), i('Téléphone', 'Phone', 'Teléfono', 'Telefono'), 'Email', i('Achats/mois', 'Purchases/month', 'Compras/mes', 'Acquisti/mese'), `${i('CA total', 'Total revenue', 'Ingresos totales', 'Ricavi totali')} (${currency})`, i('Points fidélité', 'Loyalty points', 'Puntos fidelidad', 'Punti fedeltà')],
      customers.map(c => [c.name, c.type, c.phone, c.email ?? '', c.purchasesPerMonth, cv(c.totalCA), c.loyaltyPoints]))
    toast.success(i('Export CSV téléchargé', 'CSV exported', 'CSV exportado', 'CSV esportato'))
  }

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
    try {
      await customersApi.delete(id)
      setCustomers(prev => prev.filter(x => x.id !== id))
      toast.success(i('Client supprimé', 'Customer deleted', 'Cliente eliminado', 'Cliente eliminato'))
      announce(i('Client supprimé', 'Customer deleted', 'Cliente eliminado', 'Cliente eliminato'))
    } catch {
      toast.error(i('Échec de la suppression — réessayer', 'Delete failed — please retry', 'Error al eliminar — reintenta', 'Eliminazione fallita — riprova'))
    }
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
      announce(i('Client créé', 'Customer created', 'Cliente creado', 'Cliente creato'))
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
      announce(i('Client créé', 'Customer created', 'Cliente creado', 'Cliente creato'))
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
          {/* Pluriel i18n : 1 → singulier dans les 4 langues */}
          <p className="page-subtitle">
            {customers.length}{' '}
            {customers.length === 1
              ? i('client enregistré', 'registered customer', 'cliente registrado', 'cliente registrato')
              : i('clients enregistrés', 'registered customers', 'clientes registrados', 'clienti registrati')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={showExportMenu}
              onClick={() => setShowExportMenu(v => !v)}>
              <Download size={14} /> {i('Exporter', 'Export', 'Exportar', 'Esporta')} <ChevronDown size={12} style={{ transition: 'transform .15s', transform: showExportMenu ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showExportMenu && (
              <div role="menu" aria-label={i('Exporter', 'Export', 'Exportar', 'Esporta')} className="menu-pop" style={{ right: 0, top: 'calc(100% + 6px)' }}>
                <button role="menuitem" className="menu-pop-item" onClick={() => { setShowExportMenu(false); exportCustomersCSV() }}>
                  <FileSpreadsheet size={13} /> CSV
                </button>
                <button role="menuitem" className="menu-pop-item" onClick={() => { setShowExportMenu(false); printCustomersPDF(); toast.success(i('PDF ouvert', 'PDF opened', 'PDF abierto', 'PDF aperto')) }}>
                  <FileText size={13} /> PDF
                </button>
              </div>
            )}
          </div>
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
          { label: t('customers_avg_cart'),  value: hasSales ? <AmountCur xof={avgCart} suffixSize={12} /> : '—', hex: 'var(--acc)', icon: <ShoppingCart size={18} /> },
          { label: t('customers_retention'), value: hasSales ? `${retentionRate}%` : '—',        hex: 'var(--acc3)', icon: <TrendingUp size={18} /> },
        ].map(k => (
          /* KPI compact (icône + label + valeur sur une ligne) — densité dashboard NKONI, sans espace mort */
          <div key={k.label} className="kpi-card" style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:12, padding:'12px 14px', cursor:'default' }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, color:k.hex, background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>{k.icon}</div>
            <div style={{ minWidth:0 }}>
              <div className="kpi-label" style={{ marginBottom:2 }}>{k.label}</div>
              <div className="kpi-value" style={{ color:k.hex, fontSize:'var(--fs-xl)', fontWeight:'var(--fw-bold)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Onglets — segmented control léger (même langage que le sélecteur de tarif POS),
          plus de barre pleine largeur au remplissage dégradé */}
      <div style={{
        display: 'inline-flex', gap: 2, width: 'fit-content',
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-full)', padding: 2,
      }}>
        {[
          { id: 'list',  icon: <LayoutList size={13} />, label: i('Liste', 'List', 'Lista', 'Elenco')       },
          { id: 'map',   icon: <MapPin size={13} />,     label: i('Carte', 'Map', 'Mapa', 'Mappa')        },
          { id: 'stats', icon: <BarChart3 size={13} />,  label: i('Statistiques', 'Statistics', 'Estadísticas', 'Statistiche')  },
        ].map(tab => (
          <button key={tab.id} type="button"
            onClick={() => setCustomersTab(tab.id as any)}
            aria-pressed={customersTab === tab.id}
            style={{
              padding: '7px 16px', minHeight: 36, borderRadius: 'var(--r-full)',
              fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
              cursor: 'pointer', fontFamily: 'var(--font)',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              background: customersTab === tab.id ? 'var(--p)' : 'transparent',
              color: customersTab === tab.id ? '#fff' : 'var(--text3)',
              border: 'none', transition: 'all .15s',
            }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {customersTab === 'list' && loadingCustomers && (
        /* État de chargement : la liste vide était indiscernable d'un vrai « aucun client » */
        <div className="panel" style={{ padding: 16 }}>
          <Skeleton height={44} count={6} radius={10} />
        </div>
      )}
      {customersTab === 'list' && !loadingCustomers && (
        <CustomersList
          customers={customers}
          search={search} setSearch={setSearch}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          viewMode={viewMode} setViewMode={setViewMode}
          pg={pg} filtered={filtered}
          fmt={fmt} abbr={abbr} lang={lang} i={i}
          navigate={navigate}
          setViewCustomer={setViewCustomer}
          setEditCustomer={setEditCustomer} setEditCustForm={setEditCustForm}
          setCustEditMode={setCustEditMode} setShowEditCustModal={setShowEditCustModal}
          setDigitalCardCustomerId={openLoyaltyCard}
          setDetailCustomer={setDetailCustomer} setShowDetailModal={setShowDetailModal}
          onDelete={handleDeleteCustomer}
        />
      )}

      {/* ── Onglet Carte — Google Maps ── */}
      {customersTab === 'map' && (
        <div className="animate-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} style={{ color: 'var(--p2)' }} />
                {i('Carte des clients', 'Customer map', 'Mapa de clientes', 'Mappa clienti')}
              </h2>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
                {Object.keys(geoPositions).length}{' '}
                {Object.keys(geoPositions).length === 1
                  ? i('client localisé sur', 'customer located out of', 'cliente localizado de', 'cliente localizzato su')
                  : i('clients localisés sur', 'customers located out of', 'clientes localizados de', 'clienti localizzati su')} {customers.length}
              </p>
            </div>
            <button
              onClick={() => geocodeCustomers(customers)}
              disabled={geocoding || !mapsLoaded}
              style={{
                padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text2)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
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
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertTriangle size={13} style={{flexShrink:0}} /> {i('Clients sans adresse', 'Customers without address', 'Clientes sin dirección', 'Clienti senza indirizzo')} ({customers.filter(c => !geoPositions[c.id]).length}) — {i('non affichés sur la carte', 'not shown on the map', 'no mostrados en el mapa', 'non mostrati sulla mappa')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {customers.filter(c => !geoPositions[c.id]).map(c => (
                  <span key={c.id} style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', padding: '4px 10px', borderRadius: 99, background: 'rgba(255,184,0,.08)', border: '1px solid rgba(255,184,0,.2)', color: 'var(--warn)' }}>
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
        digitalCardCustomerId={digitalCardCustomerId} setDigitalCardCustomerId={setDigitalCardCustomerId}
      />
    </div>
  )
}
