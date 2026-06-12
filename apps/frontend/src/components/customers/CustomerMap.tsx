import { useState, useEffect, useRef } from 'react'
import { Search, Eye, X, ShoppingCart, MapPin, Navigation2, Globe, Flame } from 'lucide-react'
import { type GeoCustomer, getMapStyle, MAP_BG, createMarkerIcon, getMapCfg, typeLabel, GMAPS_KEY } from '@/components/customers/customersShared'
import { useAppStore } from '@/stores/appStore'

// Couleurs (hex) par type — utilisées dans le HTML du popup InfoWindow,
// où les `var(--…)` ne peuvent pas servir au calcul d'alpha (`${color}40`).
const POPUP_HEX: Record<string, string> = {
  Grossiste: '#6C47FF', 'Semi-gros': '#00B8FF', 'Fidèle': '#00D084', 'Détail': '#FF9500',
}
// Échappe le contenu utilisateur injecté dans le HTML du popup (anti-XSS).
const esc = (s: any): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default function CustomerMap({
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
  const theme       = useAppStore(s => s.theme)
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapObj      = useRef<any>(null)
  const markersRef  = useRef<any[]>([])
  const heatLayer   = useRef<any>(null)
  const infoWin     = useRef<any>(null)
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

  const L = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  // HTML du popup premium (InfoWindow Google Maps) au clic sur un marqueur.
  const buildPopupHtml = (c: any): string => {
    const color    = POPUP_HEX[c.type] ?? '#6C47FF'
    const initials = (c.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
    const totalCA  = Number(c.totalRevenue ?? c.totalCA ?? 0)
    const loyalty  = Number(c.loyaltyPoints ?? 0)
    const mapsUrl  = `https://maps.google.com/maps?q=${encodeURIComponent(c.address ?? '')}`
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
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${L('CA Total', 'Total rev.', 'Ing. total', 'Fatt. tot.')}</div>
          <div style="font-size:13px;font-weight:var(--fw-semibold);color:#FF9500;font-family:var(--mono),monospace;">${esc(fmt(totalCA))}</div>
        </div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 10px;">
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${L('Fidélité', 'Loyalty', 'Fidelidad', 'Fedeltà')}</div>
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
          Google Maps
        </a>
        <button id="iw-detail-${esc(c.id)}" type="button" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;background:${color};border:none;border-radius:8px;font-size:11px;font-weight:var(--fw-semibold);color:#fff;cursor:pointer;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          ${L('Voir fiche', 'View', 'Ver', 'Vedi')}
        </button>
      </div>
    </div>
  </div>`
  }

  // Ouvre le popup premium sur un marqueur + relie le bouton "Voir fiche".
  const openInfoWindow = (customer: any, marker: any) => {
    const google = (window as any).google
    if (!google?.maps) return
    if (!infoWin.current) infoWin.current = new google.maps.InfoWindow()
    infoWin.current.setContent(buildPopupHtml(customer))
    infoWin.current.open({ map: mapObj.current, anchor: marker })
    google.maps.event.addListenerOnce(infoWin.current, 'domready', () => {
      const btn = document.getElementById(`iw-detail-${customer.id}`)
      if (btn) (btn as HTMLElement).onclick = () => { infoWin.current?.close(); onOpenDetail(customer) }
    })
  }

  // Init map
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapObj.current) return
    const google = (window as any).google
    if (!google?.maps) return
    const map = new google.maps.Map(mapRef.current, {
      zoom: 6, center: { lat: 14.6928, lng: -17.4467 },
      mapTypeId: 'roadmap', styles: getMapStyle(theme),
      disableDefaultUI: true, zoomControl: true, fullscreenControl: true,
      backgroundColor: MAP_BG(theme),
    })
    mapObj.current = map
    map.addListener('click', () => { setSelected(null); infoWin.current?.close() })
    setMapReady(true)
  }, [mapsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bascule le style des tuiles (clair/sombre) quand le thème change.
  useEffect(() => {
    if (!mapReady || !mapObj.current) return
    mapObj.current.setOptions({ styles: getMapStyle(theme), backgroundColor: MAP_BG(theme) })
  }, [theme, mapReady])

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
        openInfoWindow(customer, marker)
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
    <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 640, border: '1px solid var(--border)', boxShadow: 'var(--sh-xl)', display: 'flex' }}>

      {/* ══ SIDEBAR ══ */}
      <div style={{ width: 310, flexShrink: 0, background: 'var(--card)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 10, overflow: 'hidden' }}>

        {/* Sidebar header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', background: 'var(--grad-card)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} style={{ color: 'var(--p2)' }} />
            <span>{lang === 'en' ? 'Located customers' : lang === 'es' ? 'Clientes localizados' : lang === 'it' ? 'Clienti localizzati' : 'Clients localisés'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(108,71,255,.15)', color: 'var(--p3)', borderRadius: 99, padding: '1px 8px', fontWeight: 'var(--fw-bold)' }}>{visibleList.length}</span>
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px', marginBottom: 8 }}>
            <Search size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <input type="text" aria-label={lang === 'en' ? 'Search' : lang === 'es' ? 'Buscar' : lang === 'it' ? 'Cerca' : 'Rechercher'} placeholder={lang === 'fr' ? 'Rechercher…' : lang === 'en' ? 'Search…' : lang === 'es' ? 'Buscar…' : 'Cerca…'} value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font)' }} />
            {search && <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, lineHeight: 1 }}><X size={12} /></button>}
          </div>
          {/* Type filters */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['all', 'Grossiste', 'Semi-gros', 'Fidèle', 'Détail'].map(f => {
              const cfg = f !== 'all' ? getMapCfg(f) : null
              const active = filter === f
              return (
                <button key={f} type="button" onClick={() => setFilter(f)} style={{
                  padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.4px', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
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
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text3)', fontSize: 12 }}>
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
                  mapObj.current.panTo(pos); mapObj.current.setZoom(14); mapObj.current.panBy(160, 0)
                  const google = (window as any).google
                  const mk = markersRef.current.find(m => m.getTitle?.() === customer.name)
                  if (mk) { mk.setAnimation(google.maps.Animation.BOUNCE); setTimeout(() => mk.setAnimation(null), 600); openInfoWindow(customer, mk) }
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
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'var(--fw-semibold)', transition: 'all .2s',
                  background: isSel ? `linear-gradient(135deg,${cfg.color},${cfg.color}99)` : 'var(--bg3)',
                  color: isSel ? '#fff' : cfg.color,
                  boxShadow: isSel ? `0 4px 12px ${cfg.color}44` : 'none',
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: isSel ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{customer.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 5 }}>
                    <span style={{ color: cfg.color, fontWeight: 'var(--fw-semibold)', display:'inline-flex', alignItems:'center', gap:3 }}>{cfg.icon} {typeLabel(customer.type, lang)}</span>
                    <span>·</span>
                    <span style={{ fontFamily: 'var(--mono)', color: isSel ? cfg.color : 'var(--text3)' }}>{totalCA >= 1000000 ? `${(totalCA / 1000000).toFixed(1)}M` : totalCA >= 1000 ? `${(totalCA / 1000).toFixed(0)}k` : fmt(totalCA)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: isSel ? cfg.color : 'var(--text4)', flexShrink: 0 }}>›</span>
              </button>
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
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--grad-card)' }}>
              <div style={{ height: 3, background: `linear-gradient(90deg,${cfg.color},${cfg.color}44)` }} />
              <div style={{ padding: '13px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 'var(--fw-semibold)', color: '#fff', flexShrink: 0, boxShadow: `0 6px 18px ${cfg.color}44` }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{selected.name}</div>
                    <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '2px 8px', borderRadius: 99, background: cfg.soft, color: cfg.color, border: `1px solid ${cfg.color}33`, display:'inline-flex', alignItems:'center', gap:3 }}>{cfg.icon} {typeLabel(selected.type, lang)}</span>
                  </div>
                  <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} type="button" onClick={() => { setSelected(null); infoWin.current?.close() }} style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={11} /></button>
                </div>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
                  {[
                    { l: 'CA', v: totalCA >= 1000000 ? `${(totalCA / 1000000).toFixed(1)}M` : totalCA >= 1000 ? `${(totalCA / 1000).toFixed(0)}k` : fmt(totalCA), c: cfg.color },
                    { l: lang === 'en' ? 'Orders' : lang === 'es' ? 'Pedidos' : lang === 'it' ? 'Ordini' : 'Cmds', v: `${orders}×`, c: 'var(--text)' },
                    { l: 'Pts',  v: String(loyalty), c: 'var(--warn)' },
                  ].map(k => (
                    <div key={k.l} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: k.c, fontFamily: 'var(--mono)' }}>{k.v}</div>
                      <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginTop: 2 }}>{k.l}</div>
                    </div>
                  ))}
                </div>
                {/* Loyalty bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    <span>{lang === 'en' ? 'Loyalty' : lang === 'es' ? 'Fidelidad' : lang === 'it' ? 'Fedeltà' : 'Fidélité'}</span><span style={{ color: 'var(--warn)' }}>{loyaltyPct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${loyaltyPct}%`, height: '100%', background: 'linear-gradient(90deg,var(--warn),var(--acc))', borderRadius: 99, boxShadow: loyaltyPct > 0 ? '0 0 8px color-mix(in srgb, var(--warn) 50%, transparent)' : 'none' }} />
                  </div>
                </div>
                {selected.address && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 10 }}>
                    <MapPin size={10} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text4)' }} />
                    <span style={{ lineHeight: 1.5 }}>{selected.address}</span>
                  </div>
                )}
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => onOpenDetail(selected)}
                    style={{ flex: 1, padding: '8px 6px', background: cfg.soft, border: `1px solid ${cfg.color}44`, borderRadius: 9, cursor: 'pointer', color: cfg.color, fontSize: 11, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.8'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                    <Eye size={11} /> {lang === 'en' ? 'Details' : lang === 'es' ? 'Detalle' : lang === 'it' ? 'Dettaglio' : 'Détail'}
                  </button>
                  <button type="button" onClick={() => navigate('/app/pos', { state: { customer: selected } })}
                    style={{ flex: 1, padding: '8px 6px', background: 'rgba(0,208,132,.1)', border: '1px solid var(--c-green-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--acc2)', fontSize: 11, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
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
              { l: 'VIP',          v: String(vipCount),                              c: 'var(--warn)'      },
            ].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: 'center', paddingLeft: i > 0 ? 0 : 0, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 15, fontWeight: 'var(--fw-semibold)', color: s.c, fontFamily: 'var(--mono)' }}>{s.v}</div>
                <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text4)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ MAP ══ */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', background: MAP_BG(theme) }} />

        {/* Overlay controls */}
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
          {[
            { icon: <Navigation2 size={16} />, title: lang === 'en' ? 'My location' : lang === 'es' ? 'Mi ubicación' : lang === 'it' ? 'La mia posizione' : 'Ma position',  fn: centerOnMe },
            { icon: <Globe size={16} />, title: lang === 'en' ? 'Global view' : lang === 'es' ? 'Vista global' : lang === 'it' ? 'Vista globale' : 'Vue globale',  fn: () => { if (mapObj.current) { mapObj.current.setCenter({ lat: 14.6928, lng: -17.4467 }); mapObj.current.setZoom(6) } } },
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

        {/* Loading overlay */}
        {(!mapsLoaded || geocoding) && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg2)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(108,71,255,.2)', borderTopColor: 'var(--p)', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 14, fontWeight: 'var(--fw-regular)', color: 'var(--text2)' }}>{!mapsLoaded ? (lang === 'en' ? 'Loading Google Maps…' : lang === 'es' ? 'Cargando Google Maps…' : lang === 'it' ? 'Caricamento Google Maps…' : 'Chargement Google Maps…') : (lang === 'en' ? 'Locating customers…' : lang === 'es' ? 'Localizando clientes…' : lang === 'it' ? 'Localizzazione clienti…' : 'Localisation des clients…')}</div>
          </div>
        )}

        {/* No key overlay */}
        {!GMAPS_KEY && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 20 }}>
            <MapPin size={44} style={{ color: 'var(--p2)' }} />
            <div style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{lang === 'en' ? 'Google Maps not configured' : lang === 'es' ? 'Google Maps no configurado' : lang === 'it' ? 'Google Maps non configurato' : 'Google Maps non configuré'}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', maxWidth: 260 }}>{lang === 'en' ? 'Add VITE_GOOGLE_MAPS_KEY in Vercel → Settings → Env Variables' : lang === 'es' ? 'Agregue VITE_GOOGLE_MAPS_KEY en Vercel → Settings → Env Variables' : lang === 'it' ? 'Aggiungi VITE_GOOGLE_MAPS_KEY in Vercel → Settings → Env Variables' : 'Ajoutez VITE_GOOGLE_MAPS_KEY dans Vercel → Settings → Env Variables'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

