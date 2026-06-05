import { useState, useEffect } from 'react'
import { Building2, ShoppingBag, Star, ShoppingCart } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

export type ClientType = 'Grossiste' | 'Semi-gros' | 'Fidèle' | 'Détail'

export interface Purchase { ref: string; date: string; total: number; items: number }

export interface Customer {
  id: string; name: string; type: ClientType; phone: string; email: string
  address: string; purchasesPerMonth: number; totalCA: number
  loyaltyPoints: number; since: string; lastPurchase: string
  purchases: Purchase[]; notes: string
}

// Fidélité — paliers CONFIGURABLES par tenant (miroir backend lib/loyalty). STATUT seulement.
// Défauts = valeurs v1 (rétro-compat si les seuils du tenant ne sont pas encore chargés).
export const LOYALTY_BRONZE = 2000 // seuil Bronze → Silver
export const LOYALTY_SILVER = 5000 // seuil Silver → Gold
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'
export function loyaltyTier(points: number, bronze: number = LOYALTY_BRONZE, silver: number = LOYALTY_SILVER): LoyaltyTier {
  return points >= silver ? 'Gold' : points >= bronze ? 'Silver' : 'Bronze'
}
/** Prochain seuil de palier (null = Gold atteint, plus de palier au-dessus). */
export function loyaltyNextThreshold(points: number, bronze: number = LOYALTY_BRONZE, silver: number = LOYALTY_SILVER): number | null {
  return points < bronze ? bronze : points < silver ? silver : null
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


// Barre de progression vers le PROCHAIN palier (Gold = 100 %). Seuils = config du tenant.
export function LoyaltyBar({ points }: { points: number }) {
  const tenant = useAppStore(s => s.tenant)
  const bronze = tenant?.bronzeThreshold ?? LOYALTY_BRONZE
  const silver = tenant?.silverThreshold ?? LOYALTY_SILVER
  const next = loyaltyNextThreshold(points, bronze, silver)
  const pct = next ? Math.min(100, Math.round((points / next) * 100)) : 100
  const color = pct >= 80 ? 'var(--acc2)' : pct >= 50 ? 'var(--acc)' : 'var(--p2)'
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 28 }}>{pct}%</span>
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

// Style clair assorti à la charte (teintes violet/lilas) — utilisé quand le thème
// est en mode clair, sinon DARK_STYLE. Cf. getMapStyle() ci-dessous.
export const LIGHT_STYLE = [
  { elementType: 'geometry',                                                        stylers: [{ color: '#F4F5FF' }] },
  { elementType: 'labels.text.stroke',                                              stylers: [{ color: '#FFFFFF' }] },
  { elementType: 'labels.text.fill',                                                stylers: [{ color: '#6B7280' }] },
  { featureType: 'administrative',          elementType: 'geometry.stroke',         stylers: [{ color: '#D8D6F0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',        stylers: [{ color: '#5B4BD8' }] },
  { featureType: 'administrative.country',  elementType: 'labels.text.fill',        stylers: [{ color: '#6C47FF' }] },
  { featureType: 'poi',                     elementType: 'geometry',                stylers: [{ color: '#ECEAFE' }] },
  { featureType: 'poi',                     elementType: 'labels.text.fill',        stylers: [{ color: '#9893C4' }] },
  { featureType: 'poi.park',                elementType: 'geometry',                stylers: [{ color: '#E2F5EA' }] },
  { featureType: 'road',                    elementType: 'geometry',                stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road',                    elementType: 'geometry.stroke',         stylers: [{ color: '#E8EBFF' }] },
  { featureType: 'road',                    elementType: 'labels.text.fill',        stylers: [{ color: '#8E8AAE' }] },
  { featureType: 'road.highway',            elementType: 'geometry',                stylers: [{ color: '#EAE6FF' }] },
  { featureType: 'road.highway',            elementType: 'geometry.stroke',         stylers: [{ color: '#D5D0F5' }] },
  { featureType: 'road.highway',            elementType: 'labels.text.fill',        stylers: [{ color: '#6C5FB0' }] },
  { featureType: 'transit',                 elementType: 'geometry',                stylers: [{ color: '#ECEAFE' }] },
  { featureType: 'water',                   elementType: 'geometry',                stylers: [{ color: '#DCE4FF' }] },
  { featureType: 'water',                   elementType: 'labels.text.fill',        stylers: [{ color: '#8B6FFF' }] },
]

// Couleur de fond du conteneur carte selon le thème (affichée pendant le chargement des tuiles).
export const MAP_BG = (theme: string) => (theme === 'light' ? '#F4F5FF' : '#0A0A16')
// Sélectionne le style Google Maps selon le thème actif.
export const getMapStyle = (theme: string) => (theme === 'light' ? LIGHT_STYLE : DARK_STYLE)

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
