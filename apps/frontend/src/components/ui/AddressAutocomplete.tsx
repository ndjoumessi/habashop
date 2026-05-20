import { useRef, useEffect, useState } from 'react'

interface AddressDetails {
  lat: number
  lng: number
  city: string
  country: string
  postalCode: string
  formatted: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, details?: AddressDetails) => void
  placeholder?: string
  lang?: string
  disabled?: boolean
}

export default function AddressAutocomplete({
  value, onChange, placeholder, lang = 'fr', disabled,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

  // Charge le script Google Maps
  useEffect(() => {
    if (!apiKey) return
    if ((window as any).google?.maps?.places) { setReady(true); return }
    if ((window as any)._gmLoading) {
      const check = setInterval(() => {
        if ((window as any).google?.maps?.places) {
          setReady(true); clearInterval(check)
        }
      }, 100)
      return () => clearInterval(check)
    }
    (window as any)._gmLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${lang}`
    script.async = true
    script.onload = () => { setReady(true); (window as any)._gmLoading = false }
    script.onerror = () => { (window as any)._gmLoading = false }
    document.head.appendChild(script)
  }, [apiKey, lang])

  useEffect(() => {
    if (!ready || !inputRef.current) return
    const google = (window as any).google

    const service = new google.maps.places.AutocompleteService()
    let debounceTimer: any

    const handleInput = (val: string) => {
      clearTimeout(debounceTimer)
      if (!val || val.length < 3) { setSuggestions([]); return }
      debounceTimer = setTimeout(() => {
        service.getPlacePredictions(
          { input: val, types: ['address'], language: lang },
          (predictions: any[] | null) => { setSuggestions(predictions ?? []) }
        )
      }, 300)
    }

    const input = inputRef.current
    const handler = () => handleInput(input.value)
    input.addEventListener('input', handler)
    return () => { input.removeEventListener('input', handler); clearTimeout(debounceTimer) }
  }, [ready, lang])

  const selectSuggestion = (suggestion: any) => {
    const google = (window as any).google
    if (!google) return

    const service = new google.maps.places.PlacesService(document.createElement('div'))
    service.getDetails(
      { placeId: suggestion.place_id, fields: ['formatted_address', 'geometry', 'address_components'] },
      (place: any) => {
        if (!place) return
        const getComp = (type: string) => {
          const c = place.address_components?.find((c: any) => c.types.includes(type))
          return c?.long_name ?? ''
        }
        onChange(place.formatted_address ?? suggestion.description, {
          lat: place.geometry?.location.lat(),
          lng: place.geometry?.location.lng(),
          city: getComp('locality'),
          country: getComp('country'),
          postalCode: getComp('postal_code'),
          formatted: place.formatted_address ?? '',
        })
        setSuggestions([])
      }
    )
  }

  return (
    <div style={{ position:'relative' }}>
      {/* Input */}
      <div style={{
        display:'flex', alignItems:'center',
        background:'var(--bg4)',
        border:`1.5px solid ${focused ? 'var(--p)' : 'var(--border)'}`,
        borderRadius:12,
        transition:'border-color .15s',
        overflow:'hidden',
      }}>
        <div style={{
          padding:'0 10px 0 12px',
          fontSize:16, color:'var(--text3)', flexShrink:0,
          display:'flex', alignItems:'center',
        }}>📍</div>
        <input
          ref={inputRef}
          className="input"
          style={{
            border:'none', background:'transparent',
            padding:'10px 12px 10px 0',
            flex:1, outline:'none',
          }}
          placeholder={placeholder ?? (lang === 'fr' ? 'Adresse...' : 'Address...')}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setTimeout(() => setFocused(false), 200) }}
          disabled={disabled}
          autoComplete="off"
        />
        {value && (
          <button type="button"
            onClick={() => { onChange(''); setSuggestions([]) }}
            style={{
              padding:'0 12px', background:'none', border:'none',
              cursor:'pointer', fontSize:12, color:'var(--text3)',
            }}>✕</button>
        )}
      </div>

      {!apiKey && (
        <div style={{ fontSize:9, color:'var(--text4)', marginTop:3, paddingLeft:4 }}>
          {lang === 'fr' ? '⚠️ Clé Google Maps non configurée' : '⚠️ Google Maps key not configured'}
        </div>
      )}

      {/* Dropdown suggestions */}
      {suggestions.length > 0 && focused && (
        <div ref={dropdownRef} style={{
          position:'absolute', top:'calc(100% + 6px)',
          left:0, right:0, zIndex:1000,
          background:'#0D0D1C',
          border:'1px solid rgba(255,255,255,.1)',
          borderRadius:14, overflow:'hidden',
          boxShadow:'0 12px 36px rgba(0,0,0,.7)',
          animation:'slideDown .15s ease',
        }}>
          {suggestions.map((s, i) => (
            <button key={s.place_id} type="button"
              onMouseDown={() => selectSuggestion(s)}
              style={{
                display:'flex', alignItems:'flex-start',
                gap:10, width:'100%', padding:'10px 14px',
                background: i === 0 ? 'rgba(108,71,255,.05)' : 'transparent',
                border:'none',
                borderBottom: i < suggestions.length - 1
                  ? '1px solid rgba(255,255,255,.04)' : 'none',
                cursor:'pointer', textAlign:'left',
                fontFamily:'var(--font)',
                transition:'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i === 0 ? 'rgba(108,71,255,.05)' : 'transparent'}
            >
              <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>📍</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>
                  {s.structured_formatting?.main_text ?? s.description.split(',')[0]}
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                  {s.structured_formatting?.secondary_text ?? s.description.split(',').slice(1).join(',')}
                </div>
              </div>
            </button>
          ))}
          <div style={{
            padding:'6px 14px', fontSize:9,
            color:'var(--text4)', textAlign:'right',
            background:'rgba(0,0,0,.2)',
          }}>
            Powered by Google
          </div>
        </div>
      )}
    </div>
  )
}
