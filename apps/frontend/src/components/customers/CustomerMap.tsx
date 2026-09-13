import { useState, useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, Eye, X, ShoppingCart, MapPin, Navigation2, Globe, Flame } from 'lucide-react'
import { type GeoCustomer, MAP_BG, markerIconSvg, getMapCfg, typeLabel } from '@/components/customers/customersShared'
import { useAppStore, isThemeLight } from '@/stores/appStore'
import { escHtml } from '@/lib/html'
import { TILE_URL, TILE_ATTRIBUTION, lienCarte } from '@/lib/geo'

/**
 * CARTE DES CLIENTS — OpenStreetMap via Leaflet (remplace Google Maps le 2026-09-13).
 *
 * ⚠️ CHARGÉE PARESSEUSEMENT par `Customers.tsx` : Leaflet n'entre dans le bundle que pour
 * l'onglet Carte. Google chargeait son script à CHAQUE ouverture de la page Clients.
 *
 * ⚠️ Ce qui change par nature, pas par choix :
 *   · THÈME — les tuiles OSM ne se restylent pas comme le JSON de Google. Le sombre est un
 *     filtre CSS sur le SEUL panneau de tuiles (`.hs-map-dark .leaflet-tile-pane`) : marqueurs
 *     et popups gardent leurs vraies couleurs. Plus aucune réinitialisation au changement de
 *     thème — le compteur `mapVersion` qui détruisait et recréait la carte disparaît.
 *   · CARTE DE CHALEUR — `HeatmapLayer` était une bibliothèque Google. Le seul équivalent
 *     Leaflet (`leaflet.heat`) n'est plus maintenu depuis 2015 et patche l'objet global : on
 *     rend la densité par des cercles translucides superposés — plus foncé là où les clients
 *     se concentrent. Honnête, sans dépendance, mais ce n'est pas un dégradé flouté.
 *   · ATTRIBUTION — OBLIGATOIRE (licence ODbL), en bas à droite, jamais sous un contrôle.
 */

/**
 * Centre de repli quand aucun client n'est localisé. ⚠️ C'est DAKAR, repris tel quel de
 * l'implémentation Google : le marché par défaut du produit est désormais le Cameroun
 * (`defaultMarket.ts`). Laissé en l'état pour ne changer QU'UNE chose dans cette migration —
 * à dériver du pays de la boutique, dette écrite plutôt que masquée.
 */
const CENTRE_REPLI: [number, number] = [14.6928, -17.4467]

// Échappe le contenu utilisateur injecté dans le HTML du popup (anti-XSS).
// ⚠️ CETTE COPIE ÉTAIT LA DIVERGENTE : elle couvrait `& < > "` mais PAS l'apostrophe,
// celle qui permet de sortir d'un attribut en guillemets simples. Sept copies de la
// même règle, une qui dérive, et rien pour le dire — d'où le module partagé.
const esc = escHtml

export default function CustomerMap({
  customers, geoPositions, geocoding, fmt, lang, navigate, onOpenDetail,
}: {
  customers:    any[]
  geoPositions: Record<string, { lat: number; lng: number }>
  geocoding:    boolean
  fmt:          (v: number) => string
  lang:         string
  navigate:     any
  onOpenDetail: (c: any) => void
}) {
  const theme       = useAppStore(s => s.theme)
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapObj      = useRef<L.Map | null>(null)
  const marqueurs   = useRef<L.LayerGroup | null>(null)
  const chaleur     = useRef<L.LayerGroup | null>(null)
  // ⚠️ Par IDENTIFIANT. L'ancien code retrouvait le marqueur par `getTitle() === customer.name` :
  // deux clients homonymes, et le clic sur le second ouvrait la fiche du premier.
  const parId       = useRef(new Map<string, L.Marker>())
  // Dernier `onOpenDetail` : le bouton du popup est câblé une fois, la prop peut changer.
  const ouvrirFiche = useRef(onOpenDetail)
  ouvrirFiche.current = onOpenDetail
  const [mapReady,  setMapReady]  = useState(false)
  const [selected,  setSelected]  = useState<any>(null)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [showHeat,  setShowHeat]  = useState(false)

  /**
   * ⚠️ MÉMORISÉES — et c'est un défaut vu à l'ÉCRAN, pas en relisant.
   * `visibleList` était recalculée à chaque rendu (un tableau NEUF), donc l'effet qui place les
   * marqueurs, qui en dépend, se REJOUAIT à chaque rendu. Cliquer un marqueur appelle
   * `setSelected` → nouveau rendu → tous les marqueurs détruits et recréés → le popup tout juste
   * ouvert se FERMAIT et la vue se recadrait. Le test d'écran passait pourtant : il lisait le
   * popup dans la milliseconde qui précédait ce rendu. C'est la capture qui l'a montré.
   */
  const geoCustomers: GeoCustomer[] = useMemo(() => customers
    .filter(c => geoPositions[c.id])
    .map(c => ({ customer: c, pos: geoPositions[c.id] })), [customers, geoPositions])

  const visibleList = useMemo(() => geoCustomers.filter(gc => {
    const matchType   = filter === 'all' || gc.customer.type === filter
    const matchSearch = !search || (gc.customer.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  }), [geoCustomers, filter, search])

  // ⚠️ `tr`, PAS `L` : ce nom local masquait l'import Leaflet (tsc l'a signalé).
  const tr = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  // HTML du popup premium au clic sur un marqueur (popup Leaflet, DOM de la page).
  const buildPopupHtml = (c: any): string => {
    // ⚠️ La couleur du popup est CELLE DU MARQUEUR, lue dans la source unique des paliers.
    // Une table `POPUP_HEX` à part divergeait sur DEUX paliers sur quatre (Détail orange au
    // popup, bleu au marqueur ; Semi-gros bleu contre ambre) : on cliquait une punaise bleue et
    // un encart orange s'ouvrait. Vu sur une capture, le 2026-09-13. `CouleurTier` garantit un
    // #hex, donc l'alpha concaténée (`${color}40`) reste une couleur VALIDE.
    const color    = getMapCfg(c.type ?? 'Détail').color
    const initials = (c.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
    const totalCA  = Number(c.totalRevenue ?? c.totalCA ?? 0)
    const loyalty  = Number(c.loyaltyPoints ?? 0)
    const mapsUrl  = lienCarte(c.address ?? '')
    return `
  <div style="font-family:var(--font),-apple-system,BlinkMacSystemFont,sans-serif;background:var(--card);border:1px solid ${color}40;border-radius:14px;min-width:240px;max-width:280px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,${color},${color}CC);padding:14px 16px;display:flex;align-items:center;gap:10px;">
      <div style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:var(--fw-semibold);color:#fff;flex-shrink:0;">${esc(initials)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:var(--fw-semibold);color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.name)}</div>
        <div style="display:inline-flex;align-items:center;margin-top:3px;padding:1px 8px;background:rgba(255,255,255,.2);border-radius:99px;font-size:9px;font-weight:var(--fw-regular);color:#fff;text-transform:uppercase;letter-spacing:.4px;">${esc(typeLabel(c.type, lang))}</div>
      </div>
    </div>
    <div style="padding:12px 14px;">
      ${c.address ? `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:10px 11px;background:var(--bg3);border:1px solid ${color}30;border-radius:10px;margin-bottom:10px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" style="flex-shrink:0;margin-top:1px;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
        <div style="flex:1;min-width:0;font-size:12px;font-weight:var(--fw-regular);color:var(--text);line-height:1.4;">${esc(c.address)}</div>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 10px;">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${tr('CA Total', 'Total rev.', 'Ing. total', 'Fatt. tot.')}</div>
          <div style="font-size:13px;font-weight:var(--fw-semibold);color:#FF9500;font-family:var(--mono),monospace;">${esc(fmt(totalCA))}</div>
        </div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 10px;">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${tr('Fidélité', 'Loyalty', 'Fidelidad', 'Fedeltà')}</div>
          <div style="font-size:13px;font-weight:var(--fw-semibold);color:#00D084;font-family:var(--mono),monospace;">${loyalty} pts</div>
        </div>
      </div>
      ${c.phone ? `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text3);margin-bottom:10px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2.98 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        ${esc(c.phone)}
      </div>` : ''}
      <div style="display:flex;gap:6px;">
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;background:${color}20;border:1px solid ${color}40;border-radius:8px;font-size:11px;font-weight:var(--fw-regular);color:${color};text-decoration:none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          OpenStreetMap
        </a>
        <button data-iw-detail type="button" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;background:${color};border:none;border-radius:8px;font-size:11px;font-weight:var(--fw-semibold);color:#fff;cursor:pointer;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          ${tr('Voir fiche', 'View', 'Ver', 'Vedi')}
        </button>
      </div>
    </div>
  </div>`
  }

  const rebond = (m: L.Marker, ms: number) => {
    const img = m.getElement()?.querySelector('img')
    if (!img) return
    img.classList.remove('hs-marker-rebond'); void img.offsetWidth
    img.classList.add('hs-marker-rebond')
    setTimeout(() => img.classList.remove('hs-marker-rebond'), ms)
  }

  // Ouvre le popup premium sur un marqueur + relie le bouton "Voir fiche".
  const openInfoWindow = (customer: any, marker: L.Marker) => {
    marker.unbindPopup()
    marker.bindPopup(buildPopupHtml(customer), {
      className: 'hs-map-popup', minWidth: 240, maxWidth: 300, closeButton: true,
      autoPanPaddingTopLeft: L.point(20, 20),
    })
    marker.openPopup()
    // Le DOM du popup existe dès `openPopup` : câblage synchrone, pas d'événement à attendre.
    const btn = marker.getPopup()?.getElement()?.querySelector<HTMLButtonElement>('[data-iw-detail]')
    if (btn) btn.onclick = () => { mapObj.current?.closePopup(); ouvrirFiche.current(customer) }
  }

  // Init carte — UNE fois. Plus de réinitialisation au changement de thème (cf. en-tête).
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return
    const map = L.map(mapRef.current, { center: CENTRE_REPLI, zoom: 6, zoomControl: true, attributionControl: true })
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map)
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>')
    marqueurs.current = L.layerGroup().addTo(map)
    chaleur.current   = L.layerGroup().addTo(map)
    map.on('click', () => { setSelected(null); map.closePopup() })
    mapObj.current = map
    // Le conteneur peut être mesuré avant la fin de la mise en page de l'onglet.
    const t = setTimeout(() => map.invalidateSize(), 0)
    setMapReady(true)
    return () => { clearTimeout(t); map.remove(); mapObj.current = null; setMapReady(false) }
  }, [])

  // Place markers
  useEffect(() => {
    const map = mapObj.current
    if (!mapReady || !map || !marqueurs.current || !chaleur.current) return
    marqueurs.current.clearLayers()
    chaleur.current.clearLayers()
    parId.current.clear()

    const bounds = L.latLngBounds([])
    visibleList.forEach(({ customer, pos }) => {
      const cfg     = getMapCfg(customer.type ?? 'Détail')
      const totalCA = Number(customer.totalRevenue ?? customer.totalCA ?? 0)
      const isVIP   = totalCA >= 1_000_000
      const size    = isVIP ? 46 : totalCA > 500_000 ? 38 : 30
      const initials = (customer.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
      const ic = markerIconSvg(cfg.color, size, initials)
      // ⚠️ `ic.url` est une data-URI déjà encodée par `encodeURIComponent` : elle ne peut
      // contenir ni guillemet ni chevron, donc l'attribut `src` ne peut pas être rompu.
      const icon = L.divIcon({
        className: 'hs-marker',
        html: `<img src="${ic.url}" width="${ic.width}" height="${ic.height}" alt="" draggable="false">`,
        iconSize: [ic.width, ic.height], iconAnchor: [ic.width / 2, ic.height], popupAnchor: [0, -ic.height],
      })
      const marker = L.marker([pos.lat, pos.lng], {
        icon, title: customer.name ?? '', alt: customer.name ?? '', keyboard: true,
        zIndexOffset: isVIP ? 2000 : totalCA > 500_000 ? 1000 : 0,
      })
      marker.on('mouseover', () => rebond(marker, 400))
      marker.on('click', () => {
        setSelected(customer)
        rebond(marker, 600)
        openInfoWindow(customer, marker)
      })
      marker.addTo(marqueurs.current!)
      parId.current.set(customer.id, marker)
      bounds.extend([pos.lat, pos.lng])
    })

    // Densité : cercles translucides superposés (cf. en-tête — ce n'est pas un dégradé flouté).
    if (showHeat) {
      visibleList.forEach(({ pos }) => {
        L.circleMarker([pos.lat, pos.lng], {
          radius: 28, stroke: false, fillColor: '#6C47FF', fillOpacity: 0.18, interactive: false,
        }).addTo(chaleur.current!)
      })
    }

    if (bounds.isValid() && visibleList.length > 1) {
      map.fitBounds(bounds, { paddingTopLeft: [340, 60], paddingBottomRight: [60, 60] })
    }
  }, [mapReady, visibleList, showHeat]) // eslint-disable-line react-hooks/exhaustive-deps

  const centerOnMe = () => {
    if (!navigator.geolocation || !mapObj.current) return
    navigator.geolocation.getCurrentPosition(p => {
      mapObj.current?.setView([p.coords.latitude, p.coords.longitude], 12)
    })
  }

  // ⚠️ DEUX populations, jamais une. « Sans adresse » comptait tout client absent de la carte —
  // y compris ceux dont l'adresse EXISTE mais n'a pas été trouvée ou est encore en cours. Un
  // commerçant lisait « sans adresse » sur une fiche qu'il venait de remplir.
  const noAddr    = customers.filter(c => !(c.address ?? '').trim()).length
  const nonLocalis = customers.filter(c => (c.address ?? '').trim() && !geoPositions[c.id]).length
  const vipCount = customers.filter(c => Number(c.totalRevenue ?? c.totalCA ?? 0) >= 1_000_000).length

  return (
    <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 640, border: '1px solid var(--border)', boxShadow: 'var(--sh-xl)', display: 'flex' }}>

      {/* ══ SIDEBAR ══ */}
      <div style={{ width: 310, flexShrink: 0, background: 'var(--card)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 10, overflow: 'hidden' }}>

        {/* Sidebar header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', background: 'var(--grad-card)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} style={{ color: 'var(--p2)' }} />
            <span>{lang === 'en' ? 'Located customers' : lang === 'es' ? 'Clientes localizados' : lang === 'it' ? 'Clienti localizzati' : 'Clients localisés'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-caption)', background: 'rgba(108,71,255,.15)', color: 'var(--p3)', borderRadius: 99, padding: '1px 8px', fontWeight: 'var(--fw-bold)' }}>{visibleList.length}</span>
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px', marginBottom: 8 }}>
            <Search size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <input type="text" aria-label={lang === 'en' ? 'Search' : lang === 'es' ? 'Buscar' : lang === 'it' ? 'Cerca' : 'Rechercher'} placeholder={lang === 'fr' ? 'Rechercher…' : lang === 'en' ? 'Search…' : lang === 'es' ? 'Buscar…' : 'Cerca…'} value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 'var(--fs-label)', fontFamily: 'var(--font)' }} />
            {search && <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 'var(--fs-label)', lineHeight: 1 }}><X size={12} /></button>}
          </div>
          {/* Type filters */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['all', 'Grossiste', 'Semi-gros', 'Fidèle', 'Détail'].map(f => {
              const cfg = f !== 'all' ? getMapCfg(f) : null
              const active = filter === f
              return (
                <button key={f} type="button" onClick={() => setFilter(f)} style={{
                  padding: '3px 8px', borderRadius: 99, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.4px', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
                  border: `1px solid ${active ? (cfg?.color ?? 'var(--p2)') + '55' : 'var(--border)'}`,
                  background: active ? (cfg?.soft ?? 'var(--c-purple-bg)') : 'transparent',
                  color: active ? (cfg?.color ?? 'var(--p3)') : 'var(--text3)',
                }}>{f === 'all' ? (lang === 'fr' ? 'Tous' : lang === 'en' ? 'All' : lang === 'es' ? 'Todos' : 'Tutti') : typeLabel(f, lang)}</button>
              )
            })}
          </div>
        </div>

        {/* Client list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8 }}>
          {visibleList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text3)', fontSize: 'var(--fs-label)' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}><Search size={28} style={{ color: 'var(--text4)' }} /></div>{lang === 'en' ? 'No customer found' : lang === 'es' ? 'Sin clientes' : lang === 'it' ? 'Nessun cliente trovato' : 'Aucun client trouvé'}
            </div>
          ) : visibleList.map(({ customer }) => {
            const cfg     = getMapCfg(customer.type ?? 'Détail')
            const totalCA = Number(customer.totalRevenue ?? customer.totalCA ?? 0)
            const initials = (customer.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
            const isSel   = selected?.id === customer.id
            return (
              <button type="button" key={customer.id}
                aria-label={(lang === 'en' ? 'View ' : lang === 'es' ? ' Ver ' : lang === 'it' ? 'Vedi' : 'Voir ') + customer.name}
                onClick={() => {
                setSelected(customer)
                const pos = geoPositions[customer.id]
                if (pos && mapObj.current) {
                  mapObj.current.setView([pos.lat, pos.lng], 14)
                  const mk = parId.current.get(customer.id)
                  if (mk) { rebond(mk, 600); openInfoWindow(customer, mk) }
                }
              }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, marginBottom: 3, cursor: 'pointer', transition: 'all .15s',
                  width: '100%', textAlign: 'left', font: 'inherit',
                  background: isSel ? cfg.soft : 'transparent',
                  border: `1px solid ${isSel ? cfg.color + '44' : 'transparent'}`,
                }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', transition: 'all .2s',
                  background: isSel ? `linear-gradient(135deg,${cfg.color},${cfg.color}99)` : 'var(--bg3)',
                  color: isSel ? '#fff' : cfg.color,
                  boxShadow: isSel ? `0 4px 12px ${cfg.color}44` : 'none',
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: isSel ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{customer.name}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', display: 'flex', gap: 5 }}>
                    <span style={{ color: cfg.color, fontWeight: 'var(--fw-semibold)', display:'inline-flex', alignItems:'center', gap:3 }}>{cfg.icon} {typeLabel(customer.type, lang)}</span>
                    <span>·</span>
                    <span style={{ fontFamily: 'var(--mono)', color: isSel ? cfg.color : 'var(--text3)' }}>{totalCA >= 1000000 ? `${(totalCA / 1000000).toFixed(1)}M` : totalCA >= 1000 ? `${(totalCA / 1000).toFixed(0)}k` : fmt(totalCA)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 'var(--fs-label)', color: isSel ? cfg.color : 'var(--text4)', flexShrink: 0 }}>›</span>
              </button>
            )
          })}
        </div>

        {/* Selected customer card */}
        {selected && (() => {
          const cfg      = getMapCfg(selected.type ?? 'Détail')
          const totalCA  = Number(selected.totalRevenue ?? selected.totalCA ?? 0)
          const loyalty  = Number(selected.loyaltyPoints ?? 0)
          const orders   = selected.purchasesPerMonth ?? 0
          const loyaltyPct = Math.min(100, Math.round((loyalty / (selected.maxLoyalty || 1000)) * 100))
          const initials = (selected.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
          return (
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--grad-card)' }}>
              <div style={{ height: 3, background: `linear-gradient(90deg,${cfg.color},${cfg.color}44)` }} />
              <div style={{ padding: '13px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: '#fff', flexShrink: 0, boxShadow: `0 6px 18px ${cfg.color}44` }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{selected.name}</div>
                    <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '2px 8px', borderRadius: 99, background: cfg.soft, color: cfg.color, border: `1px solid ${cfg.color}33`, display:'inline-flex', alignItems:'center', gap:3 }}>{cfg.icon} {typeLabel(selected.type, lang)}</span>
                  </div>
                  <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} type="button" onClick={() => { setSelected(null); mapObj.current?.closePopup() }} style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text3)', fontSize: 'var(--fs-caption)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={11} /></button>
                </div>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
                  {[
                    { l: 'CA', v: totalCA >= 1000000 ? `${(totalCA / 1000000).toFixed(1)}M` : totalCA >= 1000 ? `${(totalCA / 1000).toFixed(0)}k` : fmt(totalCA), c: cfg.color },
                    { l: lang === 'en' ? 'Orders' : lang === 'es' ? 'Pedidos' : lang === 'it' ? 'Ordini' : 'Cmds', v: `${orders}×`, c: 'var(--text)' },
                    { l: 'Pts',  v: String(loyalty), c: 'var(--warn)' },
                  ].map(k => (
                    <div key={k.l} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: k.c, fontFamily: 'var(--mono)' }}>{k.v}</div>
                      <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginTop: 2 }}>{k.l}</div>
                    </div>
                  ))}
                </div>
                {/* Loyalty bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    <span>{lang === 'en' ? 'Loyalty' : lang === 'es' ? 'Fidelidad' : lang === 'it' ? 'Fedeltà' : 'Fidélité'}</span><span style={{ color: 'var(--warn)' }}>{loyaltyPct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${loyaltyPct}%`, height: '100%', background: 'linear-gradient(90deg,var(--warn),var(--acc))', borderRadius: 99, boxShadow: loyaltyPct > 0 ? '0 0 8px color-mix(in srgb, var(--warn) 50%, transparent)' : 'none' }} />
                  </div>
                </div>
                {selected.address && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 10 }}>
                    <MapPin size={10} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text4)' }} />
                    <span style={{ lineHeight: 1.5 }}>{selected.address}</span>
                  </div>
                )}
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => onOpenDetail(selected)}
                    style={{ flex: 1, padding: '8px 6px', background: cfg.soft, border: `1px solid ${cfg.color}44`, borderRadius: 9, cursor: 'pointer', color: cfg.color, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                    <Eye size={11} /> {lang === 'en' ? 'Details' : lang === 'es' ? 'Detalle' : lang === 'it' ? 'Dettaglio' : 'Détail'}
                  </button>
                  <button type="button" onClick={() => navigate('/app/pos', { state: { customer: selected } })}
                    style={{ flex: 1, padding: '8px 6px', background: 'rgba(0,208,132,.1)', border: '1px solid var(--c-green-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--acc2)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                    <ShoppingCart size={11} /> {lang === 'en' ? 'Sale' : lang === 'es' ? 'Venta' : lang === 'it' ? 'Vendita' : 'Vente'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Bottom stats */}
        {!selected && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 0, background: 'var(--bg2)' }}>
            {[
              { l: lang === 'en' ? 'Located' : lang === 'es' ? 'Localizados' : lang === 'it' ? 'Localizzati' : 'Localisés',    v: `${geoCustomers.length}/${customers.length}`, c: 'var(--acc2)' },
              { l: lang === 'en' ? 'No address' : lang === 'es' ? 'Sin dirección' : lang === 'it' ? 'Senza indirizzo' : 'Sans adresse', v: String(noAddr),                                c: 'var(--warn)' },
              { l: lang === 'en' ? 'Not located' : lang === 'es' ? 'No localizados' : lang === 'it' ? 'Non localizzati' : 'Non localisés', v: String(nonLocalis), c: 'var(--text3)' },
              { l: 'VIP',          v: String(vipCount),                              c: 'var(--warn)'      },
            ].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: 'center', paddingLeft: i > 0 ? 0 : 0, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)', color: s.c, fontFamily: 'var(--mono)' }}>{s.v}</div>
                <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text4)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ MAP ══ */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} data-testid="customer-map"
          className={isThemeLight(theme) ? 'hs-map' : 'hs-map hs-map-dark'}
          style={{ width: '100%', height: '100%', background: MAP_BG(theme) }} />

        {/* Overlay controls */}
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 1100 }}>
          {[
            { icon: <Navigation2 size={16} />, title: lang === 'en' ? 'My location' : lang === 'es' ? 'Mi ubicación' : lang === 'it' ? 'La mia posizione' : 'Ma position',  fn: centerOnMe },
            { icon: <Globe size={16} />, title: lang === 'en' ? 'Global view' : lang === 'es' ? 'Vista global' : lang === 'it' ? 'Vista globale' : 'Vue globale',  fn: () => { mapObj.current?.setView(CENTRE_REPLI, 6) } },
          ].map(btn => (
            <button key={btn.title} type="button" onClick={btn.fn} title={btn.title}
              style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border2)', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', boxShadow: 'var(--sh-sm)', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--card)'}>
              {btn.icon}
            </button>
          ))}
          <button type="button" onClick={() => setShowHeat(h => !h)} title={lang === 'en' ? 'Heatmap' : lang === 'es' ? 'Mapa de calor' : lang === 'it' ? 'Mappa di calore' : 'Carte de chaleur'}
            style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${showHeat ? 'rgba(108,71,255,.6)' : 'var(--border2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', boxShadow: 'var(--sh-sm)', transition: 'all .15s', background: showHeat ? 'rgba(108,71,255,.35)' : 'var(--card)', color: showHeat ? 'var(--p3)' : 'var(--text2)' }}>
            <Flame size={16} />
          </button>
        </div>

        {/* Localisation en cours — NON bloquante dès qu'un client est placé : les marqueurs
            apparaissent au fil des réponses, un par seconde au plus (règles d'usage OSM). */}
        {geocoding && (
          Object.keys(geoPositions).length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--bg2)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 1200 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(108,71,255,.2)', borderTopColor: 'var(--p)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-regular)', color: 'var(--text2)' }}>{lang === 'en' ? 'Locating customers…' : lang === 'es' ? 'Localizando clientes…' : lang === 'it' ? 'Localizzazione clienti…' : 'Localisation des clients…'}</div>
            </div>
          ) : (
            <div role="status" style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 1100, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--sh-sm)', fontSize: 'var(--fs-caption)', color: 'var(--text2)' }}>
              <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--p2)', animation: 'spin 1s linear infinite' }} />
              {lang === 'en' ? 'Locating…' : lang === 'es' ? 'Localizando…' : lang === 'it' ? 'Localizzazione…' : 'Localisation…'}
            </div>
          )
        )}
      </div>
    </div>
  )
}

