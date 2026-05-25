import { useState, useEffect, useRef } from 'react'
import { Search, Eye, X, ShoppingCart, MapPin, Navigation2, Globe, Flame } from 'lucide-react'
import { type GeoCustomer, DARK_STYLE, createMarkerIcon, getMapCfg, typeLabel, GMAPS_KEY } from '@/components/customers/customersShared'

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
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}><Search size={28} style={{ color: 'var(--text4)' }} /></div>Aucun client trouvé
            </div>
          ) : visibleList.map(({ customer }) => {
            const cfg     = getMapCfg(customer.type ?? 'Détail')
            const totalCA = Number(customer.totalRevenue ?? customer.totalCA ?? 0)
            const initials = (customer.name ?? '?').split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
            const isSel   = selected?.id === customer.id
            return (
              <button type="button" key={customer.id}
                aria-label={(lang === 'fr' ? 'Voir ' : 'View ') + customer.name}
                onClick={() => {
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
                  width: '100%', textAlign: 'left', font: 'inherit',
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
                    { l: 'Pts',  v: String(loyalty), c: 'var(--warn)' },
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
                    <span>Fidélité</span><span style={{ color: 'var(--warn)' }}>{loyaltyPct}%</span>
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
                    style={{ flex: 1, padding: '8px 6px', background: 'rgba(0,208,132,.1)', border: '1px solid var(--c-green-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--acc2)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'opacity .15s' }}
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
              { l: 'VIP',          v: String(vipCount),                              c: 'var(--warn)'      },
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
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(108,71,255,.2)', borderTopColor: 'var(--p)', animation: 'spin 1s linear infinite' }} />
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

