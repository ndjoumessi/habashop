import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, useAbbrevAmount, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { customersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X, Users, UserCheck, ShoppingCart, TrendingUp, MapPin, Grid3X3, LayoutList, Pencil, Gift, FileText, BarChart3, Building2, ShoppingBag, Star, Phone, Mail, Crown, Navigation2, Globe, Flame, AlertTriangle, DollarSign, StickyNote, UserPlus, CheckCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, generateInvoice } from '@/utils/export'
import LoyaltyCard from '@/components/ui/LoyaltyCard'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import ViewField from '@/components/ui/ViewField'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

type ClientType = 'Grossiste' | 'Semi-gros' | 'Fidèle' | 'Détail'

interface Purchase { ref: string; date: string; total: number; items: number }

interface Customer {
  id: string; name: string; type: ClientType; phone: string; email: string
  address: string; purchasesPerMonth: number; totalCA: number
  loyaltyPoints: number; maxLoyalty: number; since: string; lastPurchase: string
  purchases: Purchase[]; notes: string
}

const TYPE_CFG: Record<ClientType, { cls: string; color: string; bg: string }> = {
  Grossiste:   { cls: 'badge-violet', color: '#7C6FF0', bg: 'rgba(124,111,240,.15)' },
  'Semi-gros': { cls: 'badge-blue',   color: '#F59E0B', bg: 'rgba(245,158,11,.15)'  },
  Fidèle:      { cls: 'badge-green',  color: '#10B981', bg: 'rgba(16,185,129,.15)'  },
  Détail:      { cls: 'badge-gray',   color: '#3B82F6', bg: 'rgba(59,130,246,.15)'  },
}

const BENTO_CFG: Record<ClientType, {
  grad: string; glow: string; soft: string
  color: string; border: string; icon: JSX.Element; label: string
}> = {
  Grossiste:   { grad: 'linear-gradient(135deg,#6C47FF22,#6C47FF08)', glow: 'rgba(108,71,255,.35)', soft: 'rgba(108,71,255,.1)',  color: '#A991FF', border: 'rgba(108,71,255,.28)', icon: <Building2 size={12} />, label: 'Grossiste'   },
  'Semi-gros': { grad: 'linear-gradient(135deg,#FFB80022,#FFB80008)', glow: 'rgba(255,184,0,.35)',  soft: 'rgba(255,184,0,.1)',   color: '#FFB800', border: 'rgba(255,184,0,.28)',  icon: <ShoppingBag size={12} />, label: 'Semi-gros' },
  Fidèle:      { grad: 'linear-gradient(135deg,#00D08422,#00D08408)', glow: 'rgba(0,208,132,.35)',  soft: 'rgba(0,208,132,.1)',   color: '#00D084', border: 'rgba(0,208,132,.28)',  icon: <Star size={12} />,        label: 'Fidèle'    },
  Détail:      { grad: 'linear-gradient(135deg,#00B8FF22,#00B8FF08)', glow: 'rgba(0,184,255,.35)',  soft: 'rgba(0,184,255,.1)',   color: '#00B8FF', border: 'rgba(0,184,255,.28)',  icon: <ShoppingCart size={12} />, label: 'Détail'   },
}

const SENEGAL_CITIES = [
  { id: 'dakar',       name: 'Dakar',       x: 76,  y: 292 },
  { id: 'thies',       name: 'Thiès',        x: 172, y: 250 },
  { id: 'stlouis',     name: 'Saint-Louis',  x: 127, y: 78  },
  { id: 'louga',       name: 'Louga',        x: 248, y: 145 },
  { id: 'diourbel',    name: 'Diourbel',     x: 228, y: 245 },
  { id: 'kaolack',     name: 'Kaolack',      x: 255, y: 318 },
  { id: 'fatick',      name: 'Fatick',       x: 178, y: 308 },
  { id: 'ziguinchor',  name: 'Ziguinchor',   x: 158, y: 418 },
  { id: 'kolda',       name: 'Kolda',        x: 362, y: 392 },
  { id: 'kaffrine',    name: 'Kaffrine',     x: 318, y: 285 },
  { id: 'tambacounda', name: 'Tambacounda',  x: 502, y: 332 },
  { id: 'matam',       name: 'Matam',        x: 558, y: 122 },
]

function getCustomerCityId(address: string): string {
  const a = (address ?? '').toLowerCase()
  if (a.includes('saint-louis') || a.includes('saint louis')) return 'stlouis'
  if (a.includes('thiès') || a.includes('thies'))             return 'thies'
  if (a.includes('kaolack'))                                  return 'kaolack'
  if (a.includes('ziguinchor'))                               return 'ziguinchor'
  if (a.includes('tambacounda'))                              return 'tambacounda'
  if (a.includes('matam'))                                    return 'matam'
  if (a.includes('louga'))                                    return 'louga'
  if (a.includes('kolda'))                                    return 'kolda'
  if (a.includes('kaffrine'))                                 return 'kaffrine'
  if (a.includes('fatick'))                                   return 'fatick'
  if (a.includes('diourbel'))                                 return 'diourbel'
  return 'dakar'
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

const GMAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string

function useGoogleMaps(apiKey: string) {
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState(false)
  useEffect(() => {
    if (!apiKey) { setError(true); return }
    if ((window as any).google?.maps) { setLoaded(true); return }
    if (document.querySelector('[data-gm]')) {
      const check = setInterval(() => {
        if ((window as any).google?.maps) { setLoaded(true); clearInterval(check) }
      }, 100)
      return () => clearInterval(check)
    }
    const script = document.createElement('script')
    script.setAttribute('data-gm', '1')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,visualization&language=fr`
    script.async = true
    script.defer = true
    script.onload  = () => setLoaded(true)
    script.onerror = () => setError(true)
    document.head.appendChild(script)
  }, [apiKey])
  return { loaded, error }
}

interface GeoCustomer {
  customer: any
  pos:      { lat: number; lng: number }
}

const TYPE_CFG_MAP: Record<string, { color: string; soft: string; icon: JSX.Element; label: string }> = {
  Grossiste:   { color: '#6C47FF', soft: 'rgba(108,71,255,.15)', icon: <Building2 size={10} />, label: 'Grossiste'   },
  'Semi-gros': { color: '#FF9500', soft: 'rgba(255,149,0,.15)',  icon: <ShoppingBag size={10} />, label: 'Semi-gros'   },
  Fidèle:      { color: '#00D084', soft: 'rgba(0,208,132,.15)',  icon: <Star size={10} />, label: 'Fidèle'      },
  Détail:      { color: '#00B8FF', soft: 'rgba(0,184,255,.12)',  icon: <ShoppingCart size={10} />, label: 'Détail'      },
}
const TYPE_LABELS: Record<string, Record<string, string>> = {
  Grossiste:   { fr: 'Grossiste',  en: 'Wholesaler',     es: 'Mayorista',  it: 'Grossista' },
  'Semi-gros': { fr: 'Semi-gros',  en: 'Semi-wholesale', es: 'Semi-mayor', it: 'Semi-ingrosso' },
  Fidèle:      { fr: 'Fidèle',     en: 'Loyal',          es: 'Fiel',       it: 'Fedele' },
  Détail:      { fr: 'Détail',     en: 'Retail',         es: 'Minorista',  it: 'Dettaglio' },
}
const typeLabel = (t: string | undefined, lang: string) => TYPE_LABELS[t ?? 'Détail']?.[lang] ?? t ?? 'Détail'

const getMapCfg = (tp: string) => TYPE_CFG_MAP[tp] ?? TYPE_CFG_MAP.Détail

const DARK_STYLE = [
  { elementType: 'geometry',                                                        stylers: [{ color: '#0A0A16' }] },
  { elementType: 'labels.text.stroke',                                              stylers: [{ color: '#0A0A16' }] },
  { elementType: 'labels.text.fill',                                                stylers: [{ color: '#6666AA' }] },
  { featureType: 'administrative',          elementType: 'geometry.stroke',         stylers: [{ color: '#1A1A38' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',        stylers: [{ color: '#8888CC' }] },
  { featureType: 'administrative.country',  elementType: 'labels.text.fill',        stylers: [{ color: '#A991FF' }] },
  { featureType: 'poi',                     elementType: 'geometry',                stylers: [{ color: '#0D0D20' }] },
  { featureType: 'poi',                     elementType: 'labels.text.fill',        stylers: [{ color: '#4A4A70' }] },
  { featureType: 'poi.park',                elementType: 'geometry',                stylers: [{ color: '#0D0D1C' }] },
  { featureType: 'road',                    elementType: 'geometry',                stylers: [{ color: '#1A1A38' }] },
  { featureType: 'road',                    elementType: 'geometry.stroke',         stylers: [{ color: '#0D0D24' }] },
  { featureType: 'road',                    elementType: 'labels.text.fill',        stylers: [{ color: '#5A5A8A' }] },
  { featureType: 'road.highway',            elementType: 'geometry',                stylers: [{ color: '#222244' }] },
  { featureType: 'road.highway',            elementType: 'geometry.stroke',         stylers: [{ color: '#1A1A38' }] },
  { featureType: 'road.highway',            elementType: 'labels.text.fill',        stylers: [{ color: '#7777AA' }] },
  { featureType: 'transit',                 elementType: 'geometry',                stylers: [{ color: '#0D0D1C' }] },
  { featureType: 'water',                   elementType: 'geometry',                stylers: [{ color: '#050510' }] },
  { featureType: 'water',                   elementType: 'labels.text.fill',        stylers: [{ color: '#2A2A5A' }] },
]

function createMarkerIcon(google: any, color: string, size: number, text: string) {
  const s = size
  const svg = `<svg width="${s}" height="${s + 10}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="sh${s}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${color}" flood-opacity="0.55"/>
      </filter>
      <radialGradient id="gr${s}" cx="38%" cy="32%">
        <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${color}" stop-opacity=".7"/>
      </radialGradient>
    </defs>
    <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 2}" fill="url(#gr${s})" stroke="white" stroke-width="2" filter="url(#sh${s})"/>
    <text x="${s / 2}" y="${s / 2 + 4}" text-anchor="middle" font-family="system-ui" font-size="${Math.round(s / 3)}" font-weight="900" fill="white">${text}</text>
    <polygon points="${s / 2 - 5},${s - 3} ${s / 2 + 5},${s - 3} ${s / 2},${s + 8}" fill="${color}" opacity="0.9"/>
  </svg>`
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(s, s + 10),
    anchor:     new google.maps.Point(s / 2, s + 10),
  }
}

function CustomerMap({
  customers, geoPositions, geocoding, mapsLoaded, fmt, lang, navigate, onOpenDetail,
}: {
  customers:    any[]
  geoPositions: Record<string, { lat: number; lng: number }>
  geocoding:    boolean
  mapsLoaded:   boolean
  fmt:          (v: number) => string
  lang:         string
  navigate:     any
  onOpenDetail: (c: any) => void
}) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapObj      = useRef<any>(null)
  const markersRef  = useRef<any[]>([])
  const heatLayer   = useRef<any>(null)
  const [mapReady,  setMapReady]  = useState(false)
  const [selected,  setSelected]  = useState<any>(null)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [showHeat,  setShowHeat]  = useState(false)

  const geoCustomers: GeoCustomer[] = customers
    .filter(c => geoPositions[c.id])
    .map(c => ({ customer: c, pos: geoPositions[c.id] }))

  const visibleList = geoCustomers.filter(gc => {
    const matchType   = filter === 'all' || gc.customer.type === filter
    const matchSearch = !search || (gc.customer.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  // Init map
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapObj.current) return
    const google = (window as any).google
    if (!google?.maps) return
    const map = new google.maps.Map(mapRef.current, {
      zoom: 6, center: { lat: 14.6928, lng: -17.4467 },
      mapTypeId: 'roadmap', styles: DARK_STYLE,
      disableDefaultUI: true, zoomControl: true, fullscreenControl: true,
      backgroundColor: '#0A0A16',
    })
    mapObj.current = map
    map.addListener('click', () => setSelected(null))
    setMapReady(true)
  }, [mapsLoaded])

  // Place markers
  useEffect(() => {
    if (!mapReady || !mapObj.current) return
    const google = (window as any).google
    if (!google?.maps) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let hasAny = false

    visibleList.forEach(({ customer, pos }) => {
      const cfg     = getMapCfg(customer.type ?? 'Détail')
      const totalCA = Number(customer.totalRevenue ?? customer.totalCA ?? 0)
      const isVIP   = totalCA >= 1_000_000
      const size    = isVIP ? 46 : totalCA > 500_000 ? 38 : 30
      const initials = (customer.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
      const icon = createMarkerIcon(google, cfg.color, size, initials)

      const marker = new google.maps.Marker({
        position: pos, map: mapObj.current, icon,
        title: customer.name,
        zIndex: isVIP ? 20 : totalCA > 500_000 ? 10 : 1,
      })

      marker.addListener('mouseover', () => {
        marker.setAnimation(google.maps.Animation.BOUNCE)
        setTimeout(() => marker.setAnimation(null), 400)
      })

      marker.addListener('click', () => {
        setSelected(customer)
        marker.setAnimation(google.maps.Animation.BOUNCE)
        setTimeout(() => marker.setAnimation(null), 600)
        mapObj.current.panTo(pos)
        mapObj.current.panBy(160, 0)
      })

      markersRef.current.push(marker)
      bounds.extend(pos)
      hasAny = true
    })

    // Heatmap
    heatLayer.current?.setMap(null)
    if (showHeat && (window as any).google?.maps?.visualization) {
      heatLayer.current = new google.maps.visualization.HeatmapLayer({
        data: visibleList.map(({ pos }) => new google.maps.LatLng(pos.lat, pos.lng)),
        map: mapObj.current, radius: 50, opacity: 0.7,
        gradient: ['rgba(0,0,0,0)', 'rgba(108,71,255,.3)', 'rgba(108,71,255,.6)', 'rgba(139,111,255,.8)', 'rgba(169,145,255,1)'],
      })
    }

    if (hasAny && visibleList.length > 1) {
      mapObj.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 340 })
    }
  }, [mapReady, visibleList, showHeat]) // eslint-disable-line react-hooks/exhaustive-deps

  const centerOnMe = () => {
    if (!navigator.geolocation || !mapObj.current) return
    navigator.geolocation.getCurrentPosition(p => {
      mapObj.current.panTo({ lat: p.coords.latitude, lng: p.coords.longitude })
      mapObj.current.setZoom(12)
    })
  }

  const noAddr = customers.filter(c => !geoPositions[c.id]).length
  const vipCount = customers.filter(c => Number(c.totalRevenue ?? c.totalCA ?? 0) >= 1_000_000).length

  return (
    <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 640, border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 20px 60px rgba(0,0,0,.6)', display: 'flex' }}>

      {/* ══ SIDEBAR ══ */}
      <div style={{ width: 310, flexShrink: 0, background: 'rgba(7,7,15,.96)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column', zIndex: 10, overflow: 'hidden' }}>

        {/* Sidebar header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(160deg,#0D0D1C,#111128)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} style={{ color: 'var(--p2)' }} />
            <span>Clients localisés</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(108,71,255,.15)', color: 'var(--p3)', borderRadius: 99, padding: '1px 8px', fontWeight: 800 }}>{visibleList.length}</span>
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '7px 11px', marginBottom: 8 }}>
            <Search size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <input type="text" aria-label="Rechercher" placeholder={lang === 'fr' ? 'Rechercher…' : lang === 'en' ? 'Search…' : lang === 'es' ? 'Buscar…' : 'Cerca…'} value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font)' }} />
            {search && <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, lineHeight: 1 }}><X size={12} /></button>}
          </div>
          {/* Type filters */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['all', 'Grossiste', 'Semi-gros', 'Fidèle', 'Détail'].map(f => {
              const cfg = f !== 'all' ? getMapCfg(f) : null
              const active = filter === f
              return (
                <button key={f} type="button" onClick={() => setFilter(f)} style={{
                  padding: '3px 8px', borderRadius: 99, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
                  border: `1px solid ${active ? (cfg?.color ?? 'var(--p2)') + '55' : 'rgba(255,255,255,.08)'}`,
                  background: active ? (cfg?.soft ?? 'rgba(108,71,255,.12)') : 'transparent',
                  color: active ? (cfg?.color ?? 'var(--p3)') : 'var(--text3)',
                }}>{f === 'all' ? (lang === 'fr' ? 'Tous' : lang === 'en' ? 'All' : lang === 'es' ? 'Todos' : 'Tutti') : typeLabel(f, lang)}</button>
              )
            })}
          </div>
        </div>

        {/* Client list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8 }}>
          {visibleList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text3)', fontSize: 12 }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}><Search size={28} style={{ color: 'var(--text4)' }} /></div>Aucun client trouvé
            </div>
          ) : visibleList.map(({ customer }) => {
            const cfg     = getMapCfg(customer.type ?? 'Détail')
            const totalCA = Number(customer.totalRevenue ?? customer.totalCA ?? 0)
            const initials = (customer.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
            const isSel   = selected?.id === customer.id
            return (
              <div key={customer.id} onClick={() => {
                setSelected(customer)
                const pos = geoPositions[customer.id]
                if (pos && mapObj.current) {
                  mapObj.current.panTo(pos); mapObj.current.setZoom(14); mapObj.current.panBy(160, 0)
                  const google = (window as any).google
                  const mk = markersRef.current.find(m => m.getTitle?.() === customer.name)
                  if (mk) { mk.setAnimation(google.maps.Animation.BOUNCE); setTimeout(() => mk.setAnimation(null), 600) }
                }
              }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, marginBottom: 3, cursor: 'pointer', transition: 'all .15s',
                  background: isSel ? cfg.soft : 'transparent',
                  border: `1px solid ${isSel ? cfg.color + '44' : 'transparent'}`,
                }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, transition: 'all .2s',
                  background: isSel ? `linear-gradient(135deg,${cfg.color},${cfg.color}99)` : 'rgba(255,255,255,.07)',
                  color: isSel ? '#fff' : cfg.color,
                  boxShadow: isSel ? `0 4px 12px ${cfg.color}44` : 'none',
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? '#F0F0FF' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{customer.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 5 }}>
                    <span style={{ color: cfg.color, fontWeight: 700, display:'inline-flex', alignItems:'center', gap:3 }}>{cfg.icon} {typeLabel(customer.type, lang)}</span>
                    <span>·</span>
                    <span style={{ fontFamily: 'var(--mono)', color: isSel ? cfg.color : 'var(--text3)' }}>{totalCA >= 1000000 ? `${(totalCA / 1000000).toFixed(1)}M` : totalCA >= 1000 ? `${(totalCA / 1000).toFixed(0)}k` : fmt(totalCA)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: isSel ? cfg.color : 'var(--text4)', flexShrink: 0 }}>›</span>
              </div>
            )
          })}
        </div>

        {/* Selected customer card */}
        {selected && (() => {
          const cfg      = getMapCfg(selected.type ?? 'Détail')
          const totalCA  = Number(selected.totalRevenue ?? selected.totalCA ?? 0)
          const loyalty  = Number(selected.loyaltyPoints ?? 0)
          const orders   = selected.purchasesPerMonth ?? selected.purchases?.length ?? 0
          const loyaltyPct = Math.min(100, Math.round((loyalty / (selected.maxLoyalty || 1000)) * 100))
          const initials = (selected.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
          return (
            <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,.07)', background: 'linear-gradient(160deg,#0D0D1C,#111128)' }}>
              <div style={{ height: 3, background: `linear-gradient(90deg,${cfg.color},${cfg.color}44)` }} />
              <div style={{ padding: '13px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 6px 18px ${cfg.color}44` }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#F0F0FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{selected.name}</div>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', padding: '2px 8px', borderRadius: 99, background: cfg.soft, color: cfg.color, border: `1px solid ${cfg.color}33`, display:'inline-flex', alignItems:'center', gap:3 }}>{cfg.icon} {typeLabel(selected.type, lang)}</span>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={11} /></button>
                </div>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
                  {[
                    { l: 'CA', v: totalCA >= 1000000 ? `${(totalCA / 1000000).toFixed(1)}M` : totalCA >= 1000 ? `${(totalCA / 1000).toFixed(0)}k` : fmt(totalCA), c: cfg.color },
                    { l: 'Cmds', v: `${orders}×`, c: '#F0F0FF' },
                    { l: 'Pts',  v: String(loyalty), c: '#FFB800' },
                  ].map(k => (
                    <div key={k.l} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '6px 5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: k.c, fontFamily: 'var(--mono)' }}>{k.v}</div>
                      <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginTop: 2 }}>{k.l}</div>
                    </div>
                  ))}
                </div>
                {/* Loyalty bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    <span>Fidélité</span><span style={{ color: '#FFB800' }}>{loyaltyPct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${loyaltyPct}%`, height: '100%', background: 'linear-gradient(90deg,#FFB800,#FF9500)', borderRadius: 99, boxShadow: loyaltyPct > 0 ? '0 0 8px rgba(255,184,0,.5)' : 'none' }} />
                  </div>
                </div>
                {selected.address && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 10 }}>
                    <MapPin size={10} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text4)' }} />
                    <span style={{ lineHeight: 1.5 }}>{selected.address}</span>
                  </div>
                )}
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => onOpenDetail(selected)}
                    style={{ flex: 1, padding: '8px 6px', background: cfg.soft, border: `1px solid ${cfg.color}44`, borderRadius: 9, cursor: 'pointer', color: cfg.color, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                    <Eye size={11} /> Détail
                  </button>
                  <button type="button" onClick={() => navigate('/app/pos', { state: { customer: selected } })}
                    style={{ flex: 1, padding: '8px 6px', background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.25)', borderRadius: 9, cursor: 'pointer', color: 'var(--acc2)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                    <ShoppingCart size={11} /> Vente
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Bottom stats */}
        {!selected && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0, display: 'flex', gap: 0, background: 'rgba(0,0,0,.2)' }}>
            {[
              { l: 'Localisés',    v: `${geoCustomers.length}/${customers.length}`, c: 'var(--acc2)' },
              { l: 'Sans adresse', v: String(noAddr),                                c: 'var(--warn)' },
              { l: 'VIP',          v: String(vipCount),                              c: '#FFB800'      },
            ].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: 'center', paddingLeft: i > 0 ? 0 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: s.c, fontFamily: 'var(--mono)' }}>{s.v}</div>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text4)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ MAP ══ */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#0A0A16' }} />

        {/* Overlay controls */}
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
          {[
            { icon: <Navigation2 size={16} />, title: 'Ma position',  fn: centerOnMe },
            { icon: <Globe size={16} />, title: 'Vue globale',  fn: () => { if (mapObj.current) { mapObj.current.setCenter({ lat: 14.6928, lng: -17.4467 }); mapObj.current.setZoom(6) } } },
          ].map(btn => (
            <button key={btn.title} type="button" onClick={btn.fn} title={btn.title}
              style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(7,7,15,.9)', border: '1px solid rgba(255,255,255,.12)', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 4px 16px rgba(0,0,0,.5)', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(7,7,15,.9)'}>
              {btn.icon}
            </button>
          ))}
          <button type="button" onClick={() => setShowHeat(h => !h)} title="Carte de chaleur"
            style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${showHeat ? 'rgba(108,71,255,.6)' : 'rgba(255,255,255,.12)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 4px 16px rgba(0,0,0,.5)', transition: 'all .15s', background: showHeat ? 'rgba(108,71,255,.35)' : 'rgba(7,7,15,.9)', color: showHeat ? 'var(--p3)' : 'var(--text2)' }}>
            <Flame size={16} />
          </button>
        </div>

        {/* Loading overlay */}
        {(!mapsLoaded || geocoding) && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,7,15,.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(108,71,255,.2)', borderTopColor: '#6C47FF', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{!mapsLoaded ? 'Chargement Google Maps…' : 'Localisation des clients…'}</div>
          </div>
        )}

        {/* No key overlay */}
        {!GMAPS_KEY && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,7,15,.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 20 }}>
            <MapPin size={44} style={{ color: 'var(--p2)' }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Google Maps non configuré</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', maxWidth: 260 }}>Ajoutez VITE_GOOGLE_MAPS_KEY dans Vercel → Settings → Env Variables</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Customers() {
  const { lang } = useConfig()
  const { i } = useI18n()
  void lang
  const fmt = useFormatAmount()
  const abbr = useAbbrevAmount()
  const navigate = useNavigate()
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
          { label: t('customers_total'),     value: customers.length.toString(), hex: '#6C47FF', icon: <Users size={18} /> },
          { label: t('customers_active'),    value: activeThisMonth.toString(),  hex: '#00D084', icon: <UserCheck size={18} /> },
          { label: t('customers_avg_cart'),  value: fmt(avgCart),                hex: '#FF9500', icon: <ShoppingCart size={18} /> },
          { label: t('customers_retention'), value: `${retentionRate}%`,         hex: '#00B8FF', icon: <TrendingUp size={18} /> },
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
      {customersTab === 'list' && <div className="panel">
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
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#FFB800', fontFamily: 'var(--mono)', lineHeight: 1 }}>{points}</div>
                      </div>
                    </div>

                    {/* Gold loyalty bar */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        <span>Fidélité</span>
                        <span style={{ color: '#FFB800' }}>{loyaltyPct}%</span>
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
      </div>}

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
                {Object.keys(geoPositions).length} client(s) localisé(s) sur {customers.length}
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
              {geocoding ? 'Localisation…' : 'Actualiser'}
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
                <AlertTriangle size={13} style={{flexShrink:0}} /> Clients sans adresse ({customers.filter(c => !geoPositions[c.id]).length}) — non affichés sur la carte
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

      {/* ── Onglet Stats ── */}
      {customersTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={16} style={{ color: 'var(--p2)' }} />
                <span className="panel-title">{i('Répartition par type', 'Distribution by type', 'Distribución por tipo', 'Distribuzione per tipo')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(['Grossiste', 'Semi-gros', 'Fidèle', 'Détail'] as const).map(type => {
                const count = customers.filter(c => c.type === type).length
                const ca = customers.filter(c => c.type === type).reduce((s, c) => s + (c.totalCA ?? 0), 0)
                const pct = customers.length > 0 ? Math.round(count / customers.length * 100) : 0
                const { color } = TYPE_CFG[type]
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{typeLabel(type, lang)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <span style={{ color: 'var(--text3)' }}>{count} client{count > 1 ? 's' : ''}</span>
                        <span style={{ color, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(ca)}</span>
                        <span style={{ color: 'var(--text2)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: `linear-gradient(90deg,${color},${color}99)`,
                        borderRadius: 99, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
                        boxShadow: `0 0 8px ${color}55`,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} style={{ color: 'var(--acc)' }} />
                <span className="panel-title">{i('Top 5 clients', 'Top 5 customers', 'Top 5 clientes', 'Top 5 clienti')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...customers]
                .sort((a, b) => (b.totalCA ?? 0) - (a.totalCA ?? 0))
                .slice(0, 5)
                .map((c, i) => {
                  const cfg = TYPE_CFG[c.type]
                  const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  const medalColors = ['linear-gradient(135deg,#F59E0B,#FCD34D)', 'linear-gradient(135deg,#9CA3AF,#D1D5DB)', 'linear-gradient(135deg,#D97706,#B45309)']
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
                      background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12,
                      cursor: 'pointer', transition: 'border-color .15s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = cfg.color}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                      onClick={() => setViewCustomer(c)}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: i < 3 ? medalColors[i] : 'var(--bg4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 900, color: i < 3 ? '#fff' : 'var(--text3)',
                      }}>
                        {i < 3 ? (i + 1) : i + 1}
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{typeLabel(c.type, lang)} · {c.loyaltyPoints} pts</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color, fontFamily: 'var(--mono)', flexShrink: 0 }}>
                        {fmt(c.totalCA ?? 0)}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal fiche client ── */}
      {viewCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setViewCustomer(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Users size={15} style={{color:'var(--p2)',flexShrink:0}} /> {viewCustomer.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  Depuis {new Date(viewCustomer.since).toLocaleDateString('fr-FR')} · Dernière visite {new Date(viewCustomer.lastPurchase).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${TYPE_CFG[viewCustomer.type].cls}`}>{typeLabel(viewCustomer.type, lang)}</span>
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
                style={{ background: 'rgba(91,78,232,0.08)', border: '1px solid rgba(91,78,232,0.2)', color: 'var(--p3)', display:'flex', alignItems:'flex-start', gap:6 }}>
                <StickyNote size={12} style={{flexShrink:0,marginTop:1}} /> {viewCustomer.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                onClick={() => { setViewCustomer(null); navigate('/app/pos', { state: { customer: viewCustomer } }) }}
                style={{ cursor: 'pointer' }}>
                <ShoppingCart size={14} /> {i('Nouvelle vente', 'New sale', 'Nueva venta', 'Nuova vendita')}
              </button>
              <button className="btn btn-sm"
                onClick={() => { setDetailCustomer(viewCustomer); setShowDetailModal(true); setViewCustomer(null) }}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  background: 'linear-gradient(135deg,var(--p),var(--p2))',
                  border: 'none', cursor: 'pointer',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  fontFamily: 'var(--font)',
                  boxShadow: 'var(--sh-p)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <FileText size={13} /> {i('Détail', 'Detail', 'Detalle', 'Dettaglio')}
              </button>
              <button className="btn btn-ghost" onClick={() => setViewCustomer(null)}>{i('Fermer', 'Close', 'Cerrar', 'Chiudi')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal modifier client ── */}
      {showEditCustModal && editCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowEditCustModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>👤 {editCustomer.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditCustModal(false)}><X size={14} /></button>
            </div>

            {/* Mode banner */}
            {!custEditMode
              ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                  <Eye size={13} style={{ color:'var(--acc3)', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>
                    {lang==='fr' ? 'Mode visualisation — cliquez sur Modifier pour éditer' : 'View mode — click Edit to make changes'}
                  </span>
                </div>
              : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                  <Pencil size={13} style={{ color:'var(--warn)', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>
                    {lang==='fr' ? 'Mode édition — modifications non sauvegardées' : 'Edit mode — unsaved changes'}
                  </span>
                </div>
            }

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <ViewField label="NOM / ENSEIGNE" value={editCustForm.name} fullWidth editing={custEditMode}>
                <input className="input text-sm" value={editCustForm.name}
                  onChange={e => setEditCustForm(f => ({...f, name:e.target.value}))} />
              </ViewField>
              <ViewField label="TYPE" value={typeLabel(editCustForm.type, lang)} editing={custEditMode}>
                <select className="input text-sm" value={editCustForm.type}
                  onChange={e => setEditCustForm(f => ({...f, type:e.target.value as ClientType}))}>
                  <option value="Grossiste">{typeLabel('Grossiste', lang)}</option>
                  <option value="Semi-gros">{typeLabel('Semi-gros', lang)}</option>
                  <option value="Fidèle">{typeLabel('Fidèle', lang)}</option>
                  <option value="Détail">{typeLabel('Détail', lang)}</option>
                </select>
              </ViewField>
              <ViewField label="TÉLÉPHONE" value={editCustForm.phone||''} icon="📞" editing={custEditMode}>
                <PhoneInputWithCountry value={editCustForm.phone} onChange={v => setEditCustForm(f => ({...f, phone:v}))} lang={lang} />
              </ViewField>
              <ViewField label="EMAIL" value={editCustForm.email||''} fullWidth editing={custEditMode}>
                <input className="input text-sm" type="email" placeholder="email@exemple.com"
                  value={editCustForm.email}
                  onChange={e => setEditCustForm(f => ({...f, email:e.target.value}))} />
              </ViewField>
              <ViewField label="ADRESSE" value={editCustForm.address||''} fullWidth editing={custEditMode}>
                <AddressAutocompleteInput value={editCustForm.address}
                  onChange={v => setEditCustForm(f => ({...f, address:v}))} lang={lang} />
              </ViewField>
              <ViewField label="NOTES" value={editCustForm.notes||''} fullWidth editing={custEditMode}>
                <textarea className="input text-sm" rows={2} value={editCustForm.notes}
                  onChange={e => setEditCustForm(f => ({...f, notes:e.target.value}))} />
              </ViewField>
            </div>

            <div className="flex gap-2 mt-5">
              {!custEditMode ? (
                <>
                  <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:6 }} onClick={() => setCustEditMode(true)}><Pencil size={13} /> {lang==='fr'?'Modifier':'Edit'}</button>
                  <button className="btn btn-ghost" style={{ color:'var(--danger)', display:'flex', alignItems:'center', gap:6 }}
                    aria-label={i('Supprimer le client', 'Delete customer', 'Eliminar cliente', 'Elimina cliente')}
                    onClick={async () => {
                      if (!window.confirm(i('Supprimer ce client ?', 'Delete this customer?', '¿Eliminar este cliente?', 'Eliminare questo cliente?'))) return
                      try {
                        await customersApi.delete(editCustomer.id)
                        setCustomers(prev => prev.filter(c => c.id !== editCustomer.id))
                        setShowEditCustModal(false)
                        toast.success(i('Client supprimé', 'Customer deleted', 'Cliente eliminado', 'Cliente eliminato'))
                      } catch (e: any) { toast.error(e?.message ?? 'Erreur') }
                    }}><Trash2 size={13} /> {i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}</button>
                  <button className="btn btn-ghost" onClick={() => setShowEditCustModal(false)}>{lang==='fr'?'Fermer':'Close'}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => {
                    setEditCustForm({ name:editCustomer.name, type:editCustomer.type, phone:editCustomer.phone, email:editCustomer.email??'', address:editCustomer.address??'', notes:editCustomer.notes??'' })
                    setCustEditMode(false)
                  }}>{t('btn_cancel')}</button>
                  <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer' }} onClick={async () => {
                    if (!editCustForm.name) { toast.error('Nom requis'); return }
                    try { await customersApi.update(editCustomer.id, { name: editCustForm.name, phone: editCustForm.phone, email: editCustForm.email, address: editCustForm.address, notes: editCustForm.notes, type: editCustForm.type }) } catch {}
                    setCustomers(prev => prev.map(c =>
                      c.id === editCustomer.id ? { ...c, ...editCustForm } : c
                    ))
                    setShowEditCustModal(false)
                    toast.success(`${editCustForm.name} mis à jour`)
                  }}>Enregistrer</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouveau client ── */}
      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
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
                boxShadow:'0 4px 14px rgba(244,114,182,.4)',
              }}><UserPlus size={22} color="#fff" /></div>
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
                  <select aria-label="TYPE" className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as ClientType}))}>
                    <option value="Détail">{lang==='fr'?'Détail':'Retail'}</option>
                    <option value="Grossiste">{lang==='fr'?'Grossiste':'Wholesale'}</option>
                    <option value="Semi-gros">{lang==='fr'?'Semi-gros':'Semi-wholesale'}</option>
                    <option value="Fidèle">{lang==='fr'?'Fidèle':'Loyal'}</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <PhoneInputWithCountry
                    label={lang==='fr'?'TÉLÉPHONE':'PHONE'}
                    value={form.phone}
                    onChange={v=>setForm(f=>({...f, phone:v}))}
                    lang={lang}
                  />
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>EMAIL</label>
                <input aria-label="EMAIL" className="input" type="email" placeholder="email@exemple.com"
                  value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>

              <div>
                <AddressAutocompleteInput
                  label={lang==='fr'?'ADRESSE':'ADDRESS'}
                  value={form.address}
                  onChange={v=>setForm(f=>({...f,address:v}))}
                  lang={lang}
                />
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
                <CheckCircle size={15} style={{flexShrink:0}} /> {lang==='fr'?'Ajouter le client':'Add customer'}
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

      {/* ── Modal détail client ── */}
      {showDetailModal && detailCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowDetailModal(false)}>
          <div style={{
            background: '#0D0D1C',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 24, width: '100%', maxWidth: 600,
            maxHeight: '92vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,.85)',
            position: 'relative',
          }}>
            {/* Bande déco */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: (() => {
                const colors: Record<string, string> = {
                  Grossiste: 'linear-gradient(90deg,#6C47FF,#A991FF)',
                  'Semi-gros': 'linear-gradient(90deg,#FF9500,#FFB800)',
                  Fidèle: 'linear-gradient(90deg,#00D084,#00B8A9)',
                  Détail: 'linear-gradient(90deg,#00B8FF,#6C47FF)',
                }
                return colors[detailCustomer.type] ?? 'linear-gradient(90deg,var(--p),var(--p2))'
              })(),
            }} />

            {/* Header */}
            <div style={{
              padding: '24px 24px 20px',
              borderBottom: '1px solid rgba(255,255,255,.06)',
              flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(108,71,255,.06),transparent)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                  background: (() => {
                    const colors: Record<string, string> = {
                      Grossiste: 'linear-gradient(135deg,#6C47FF,#A991FF)',
                      'Semi-gros': 'linear-gradient(135deg,#FF9500,#FFB800)',
                      Fidèle: 'linear-gradient(135deg,#00D084,#00B8A9)',
                      Détail: 'linear-gradient(135deg,#00B8FF,#6C47FF)',
                    }
                    return colors[detailCustomer.type] ?? 'linear-gradient(135deg,#6C47FF,#A991FF)'
                  })(),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900, color: '#fff',
                  boxShadow: '0 6px 20px rgba(108,71,255,.35)',
                }}>
                  {(detailCustomer.name ?? '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>
                      {detailCustomer.name}
                    </h2>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                      padding: '3px 10px', borderRadius: 99,
                      background: ({ Grossiste: 'rgba(108,71,255,.15)', 'Semi-gros': 'rgba(255,149,0,.15)', Fidèle: 'rgba(0,208,132,.15)', Détail: 'rgba(0,184,255,.15)' } as Record<string,string>)[detailCustomer.type] ?? 'rgba(108,71,255,.15)',
                      color: ({ Grossiste: 'var(--p3)', 'Semi-gros': 'var(--acc)', Fidèle: 'var(--acc2)', Détail: 'var(--info)' } as Record<string,string>)[detailCustomer.type] ?? 'var(--p3)',
                    }}>
                      {typeLabel(detailCustomer.type, lang)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    {i('Depuis le', 'Since', 'Desde el', 'Dal')}{' '}
                    {new Date(detailCustomer.since).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'), { day: 'numeric', month: 'long', year: 'numeric' })}
                    {detailCustomer.lastPurchase && (
                      <span style={{ marginLeft: 10 }}>
                        · {i('Dernière visite', 'Last visit', 'Última visita', 'Ultima visita')}{' '}
                        {new Date(detailCustomer.lastPurchase).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setShowDetailModal(false)} style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)',
                  cursor: 'pointer', color: 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0,
                }}>✕</button>
              </div>
            </div>

            {/* Corps scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: i('CA Total', 'Total Revenue', 'Ingresos totales', 'Fatturato totale'), value: fmt(detailCustomer.totalCA), icon: <DollarSign size={20} />, color: 'var(--acc)', hex: '#FF9500' },
                  { label: i('Commandes/mois', 'Orders/month', 'Pedidos/mes', 'Ordini/mese'), value: `${detailCustomer.purchasesPerMonth}`, icon: <ShoppingCart size={20} />, color: 'var(--p2)', hex: '#6C47FF' },
                  { label: i('Points fidélité', 'Loyalty pts', 'Puntos fidelidad', 'Punti fedeltà'), value: `${detailCustomer.loyaltyPoints} pts`, icon: <Star size={20} />, color: 'var(--warn)', hex: '#FFB800' },
                ].map(k => (
                  <div key={k.label} style={{ background: `linear-gradient(135deg,${k.hex}15,${k.hex}05)`, border: `1px solid ${k.hex}25`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom: 6, color: k.color }}>{k.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>{k.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginTop: 4 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Coordonnées */}
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} style={{color:'var(--text3)'}} />{i('COORDONNÉES', 'CONTACT INFO', 'CONTACTO', 'CONTATTI')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: i('Téléphone', 'Phone', 'Teléfono', 'Telefono'), value: detailCustomer.phone || '—', icon: <Phone size={10} />, full: false },
                    { label: 'Email', value: detailCustomer.email || '—', icon: <Mail size={10} />, full: false },
                    { label: i('Adresse', 'Address', 'Dirección', 'Indirizzo'), value: detailCustomer.address || '—', icon: <MapPin size={10} />, full: true },
                  ].map(item => (
                    <div key={item.label} style={{
                      gridColumn: item.full ? '1 / -1' : 'auto',
                      background: 'var(--bg3)', border: '1px solid rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text3)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {item.icon}{item.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {detailCustomer.notes && (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(91,78,232,.08)', border: '1px solid rgba(91,78,232,.2)', fontSize: 12, color: 'var(--p3)', display:'flex', alignItems:'flex-start', gap:6 }}>
                    <StickyNote size={12} style={{flexShrink:0,marginTop:1}} /> {detailCustomer.notes}
                  </div>
                )}
              </div>

              {/* Programme fidélité */}
              <div style={{ background: 'linear-gradient(135deg,rgba(255,184,0,.06),rgba(255,184,0,.02))', border: '1px solid rgba(255,184,0,.15)', borderRadius: 14, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={12} style={{color:'var(--warn)'}} /> {i('PROGRAMME FIDÉLITÉ', 'LOYALTY PROGRAM', 'PROGRAMA FIDELIDAD', 'PROGRAMMA FEDELTÀ')}
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--warn)', fontFamily: 'var(--mono)' }}>
                    {detailCustomer.loyaltyPoints} pts
                  </span>
                </div>
                {(() => {
                  const pts = detailCustomer.loyaltyPoints
                  const levels = [
                    { name: 'Bronze',   min: 0,    max: 499,  color: '#CD7F32' },
                    { name: 'Silver',   min: 500,  max: 999,  color: '#C0C0C0' },
                    { name: 'Gold',     min: 1000, max: 2499, color: '#FFD700' },
                    { name: 'Platinum', min: 2500, max: 9999, color: '#E5E4E2' },
                  ]
                  const current = [...levels].reverse().find(l => pts >= l.min) ?? levels[0]
                  const next    = levels.find(l => l.min > pts)
                  const pct     = next ? Math.round(((pts - current.min) / (next.min - current.min)) * 100) : 100
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: current.color, display:'inline-flex', alignItems:'center', gap:4 }}><Star size={11} style={{color:current.color}} /> {current.name}</span>
                        {next && <span style={{ color: 'var(--text3)' }}>{next.min - pts} pts → {next.name}</span>}
                      </div>
                      <div style={{ height: 8, background: 'var(--bg5,var(--bg4))', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg,${current.color},${next?.color ?? current.color})`, borderRadius: 99, transition: 'width .5s ease' }} />
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{pct}%</div>
                    </div>
                  )
                })()}
              </div>

              {/* Historique achats */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={12} style={{color:'var(--text3)'}} /> {i('HISTORIQUE DES ACHATS', 'PURCHASE HISTORY', 'HISTORIAL DE COMPRAS', 'STORICO ACQUISTI')}
                </div>
                {detailCustomer.purchases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)', fontSize: 13 }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}><ShoppingCart size={28} style={{color:'var(--text4)'}} /></div>
                    {i('Aucun achat enregistré', 'No purchases recorded', 'Sin compras registradas', 'Nessun acquisto registrato')}
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{i('RÉFÉRENCE', 'REF', 'REF', 'RIF')}</th>
                          <th>DATE</th>
                          <th>{i('ARTICLES', 'ITEMS', 'ARTÍCULOS', 'ARTICOLI')}</th>
                          <th>{i('MONTANT', 'AMOUNT', 'IMPORTE', 'IMPORTO')}</th>
                          <th>STATUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailCustomer.purchases.map(p => (
                          <tr key={p.ref}>
                            <td className="td-mono" style={{ fontSize: 11, color: 'var(--p3)' }}>{p.ref}</td>
                            <td style={{ fontSize: 11, color: 'var(--text2)' }}>
                              {new Date(p.date).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text2)' }}>{p.items} art.</td>
                            <td className="td-mono" style={{ color: 'var(--acc2)', fontWeight: 700 }}>{fmt(p.total)}</td>
                            <td><span className="badge badge-ok">✓ {i('Payé', 'Paid', 'Pagado', 'Pagato')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0, display: 'flex', gap: 8, background: 'rgba(0,0,0,.15)' }}>
              <button onClick={() => { setShowDetailModal(false); navigate('/app/pos', { state: { customer: detailCustomer } }) }} style={{
                flex: 1, padding: '12px',
                background: 'linear-gradient(135deg,var(--p),var(--p2))',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'var(--font)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: 'var(--sh-p)',
              }}>
                <ShoppingCart size={14} /> {i('Nouvelle vente', 'New sale', 'Nueva venta', 'Nuova vendita')}
              </button>
              <button onClick={() => {
                setShowDetailModal(false)
                setEditCustomer(detailCustomer)
                setEditCustForm({ name: detailCustomer.name, type: detailCustomer.type, phone: detailCustomer.phone, email: detailCustomer.email ?? '', address: detailCustomer.address ?? '', notes: detailCustomer.notes ?? '' })
                setCustEditMode(false)
                setShowEditCustModal(true)
              }} style={{
                padding: '12px 16px', background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.08)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                fontFamily: 'var(--font)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}
              </button>
              <button onClick={() => setShowDetailModal(false)} style={{
                padding: '12px 16px', background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.08)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                fontFamily: 'var(--font)', fontWeight: 600,
              }}>
                {i('Fermer', 'Close', 'Cerrar', 'Chiudi')}
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
