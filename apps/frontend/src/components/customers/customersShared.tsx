import { useState, useEffect } from 'react'
import { Building2, ShoppingBag, Star, ShoppingCart } from 'lucide-react'

export type ClientType = 'Grossiste' | 'Semi-gros' | 'Fidèle' | 'Détail'

export interface Purchase { ref: string; date: string; total: number; items: number }

export interface Customer {
  id: string; name: string; type: ClientType; phone: string; email: string
  address: string; purchasesPerMonth: number; totalCA: number
  loyaltyPoints: number; maxLoyalty: number; since: string; lastPurchase: string
  purchases: Purchase[]; notes: string
}

export const TYPE_CFG: Record<ClientType, { cls: string; color: string; bg: string }> = {
  Grossiste:   { cls: 'badge-violet', color: '#7C6FF0', bg: 'rgba(124,111,240,.15)' },
  'Semi-gros': { cls: 'badge-blue',   color: '#F59E0B', bg: 'rgba(245,158,11,.15)'  },
  Fidèle:      { cls: 'badge-green',  color: '#10B981', bg: 'rgba(16,185,129,.15)'  },
  Détail:      { cls: 'badge-gray',   color: '#3B82F6', bg: 'rgba(59,130,246,.15)'  },
}

export const BENTO_CFG: Record<ClientType, {
  grad: string; glow: string; soft: string
  color: string; border: string; icon: JSX.Element; label: string
}> = {
  Grossiste:   { grad: 'linear-gradient(135deg,#6C47FF22,#6C47FF08)', glow: 'rgba(108,71,255,.35)', soft: 'rgba(108,71,255,.1)',  color: 'var(--p3)', border: 'rgba(108,71,255,.28)', icon: <Building2 size={12} />, label: 'Grossiste'   },
  'Semi-gros': { grad: 'linear-gradient(135deg,#FFB80022,#FFB80008)', glow: 'rgba(255,184,0,.35)',  soft: 'rgba(255,184,0,.1)',   color: 'var(--warn)', border: 'rgba(255,184,0,.28)',  icon: <ShoppingBag size={12} />, label: 'Semi-gros' },
  Fidèle:      { grad: 'linear-gradient(135deg,#00D08422,#00D08408)', glow: 'rgba(0,208,132,.35)',  soft: 'rgba(0,208,132,.1)',   color: 'var(--acc2)', border: 'rgba(0,208,132,.28)',  icon: <Star size={12} />,        label: 'Fidèle'    },
  Détail:      { grad: 'linear-gradient(135deg,#00B8FF22,#00B8FF08)', glow: 'rgba(0,184,255,.35)',  soft: 'rgba(0,184,255,.1)',   color: 'var(--acc3)', border: 'rgba(0,184,255,.28)',  icon: <ShoppingCart size={12} />, label: 'Détail'   },
}

export const SENEGAL_CITIES = [
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

export function getCustomerCityId(address: string): string {
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

export const CUSTOMERS_INIT: Customer[] = [
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


export function LoyaltyBar({ points, max }: { points: number; max: number }) {
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

export function mapApiCustomer(c: any): Customer {
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

export const GMAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string

export function useGoogleMaps(apiKey: string) {
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

export interface GeoCustomer {
  customer: any
  pos:      { lat: number; lng: number }
}

export const TYPE_CFG_MAP: Record<string, { color: string; soft: string; icon: JSX.Element; label: string }> = {
  Grossiste:   { color: 'var(--p)', soft: 'rgba(108,71,255,.15)', icon: <Building2 size={10} />, label: 'Grossiste'   },
  'Semi-gros': { color: 'var(--acc)', soft: 'rgba(255,149,0,.15)',  icon: <ShoppingBag size={10} />, label: 'Semi-gros'   },
  Fidèle:      { color: 'var(--acc2)', soft: 'rgba(0,208,132,.15)',  icon: <Star size={10} />, label: 'Fidèle'      },
  Détail:      { color: 'var(--acc3)', soft: 'var(--c-blue-bg)',  icon: <ShoppingCart size={10} />, label: 'Détail'      },
}
export const TYPE_LABELS: Record<string, Record<string, string>> = {
  Grossiste:   { fr: 'Grossiste',  en: 'Wholesaler',     es: 'Mayorista',  it: 'Grossista' },
  'Semi-gros': { fr: 'Semi-gros',  en: 'Semi-wholesale', es: 'Semi-mayor', it: 'Semi-ingrosso' },
  Fidèle:      { fr: 'Fidèle',     en: 'Loyal',          es: 'Fiel',       it: 'Fedele' },
  Détail:      { fr: 'Détail',     en: 'Retail',         es: 'Minorista',  it: 'Dettaglio' },
}
export const typeLabel = (t: string | undefined, lang: string) => TYPE_LABELS[t ?? 'Détail']?.[lang] ?? t ?? 'Détail'

export const getMapCfg = (tp: string) => TYPE_CFG_MAP[tp] ?? TYPE_CFG_MAP.Détail

export const DARK_STYLE = [
  { elementType: 'geometry',                                                        stylers: [{ color: '#0A0A16' }] },
  { elementType: 'labels.text.stroke',                                              stylers: [{ color: '#0A0A16' }] },
  { elementType: 'labels.text.fill',                                                stylers: [{ color: '#6666AA' }] },
  { featureType: 'administrative',          elementType: 'geometry.stroke',         stylers: [{ color: '#1A1A38' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',        stylers: [{ color: '#8888CC' }] },
  { featureType: 'administrative.country',  elementType: 'labels.text.fill',        stylers: [{ color: 'var(--p3)' }] },
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

export function createMarkerIcon(google: any, color: string, size: number, text: string) {
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
