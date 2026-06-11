import { useRef, useEffect, useState } from 'react'

interface AddressDetails {
  lat?: number
  lng?: number
  city?: string
  country?: string
  postalCode?: string
  formatted?: string
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
  const [ready, setReady] = useState(false)
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

  // Charge Google Maps en background — n'affecte pas la saisie manuelle
  useEffect(() => {
    if (!apiKey) return
    if ((window as any).google?.maps?.places) { setReady(true); return }
    // Évite de charger le script deux fois
    if (document.querySelector('script[data-gm]')) {
      const check = setInterval(() => {
        if ((window as any).google?.maps?.places) {
          setReady(true)
          clearInterval(check)
        }
      }, 200)
      return () => clearInterval(check)
    }
    const script = document.createElement('script')
    script.setAttribute('data-gm', '1')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${lang}`
    script.async = true
    script.onload = () => setReady(true)
    script.onerror = () => {}
    document.head.appendChild(script)
  }, [])

  // Autocomplete via AutocompleteService (pas de widget)
  useEffect(() => {
    if (!ready || !inputRef.current) return
    const google = (window as any).google
    if (!google?.maps?.places?.AutocompleteService) return

    const service = new google.maps.places.AutocompleteService()
    let timer: ReturnType<typeof setTimeout>

    const handleInput = () => {
      const val = inputRef.current?.value ?? ''
      clearTimeout(timer)
      if (val.length < 3) { setSuggestions([]); return }
      timer = setTimeout(() => {
        service.getPlacePredictions(
          { input: val, types: ['address'], language: lang },
          (preds: any[] | null) => setSuggestions(preds ?? [])
        )
      }, 350)
    }

    const input = inputRef.current
    input.addEventListener('input', handleInput)
    return () => { input.removeEventListener('input', handleInput); clearTimeout(timer) }
  }, [ready])

  const pickSuggestion = (s: any) => {
    const google = (window as any).google
    if (!google?.maps?.places) {
      onChange(s.description)
      setSuggestions([])
      return
    }
    const svc = new google.maps.places.PlacesService(document.createElement('div'))
    svc.getDetails(
      { placeId: s.place_id, fields: ['formatted_address', 'geometry', 'address_components'] },
      (place: any) => {
        if (!place) { onChange(s.description); setSuggestions([]); return }
        const getComp = (type: string) => {
          const c = place.address_components?.find((c: any) => c.types.includes(type))
          return c?.long_name ?? ''
        }
        onChange(place.formatted_address ?? s.description, {
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
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
    <div style={{ position: 'relative' }}>
      {/* Input principal — TOUJOURS éditable */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg4)',
        border: `1.5px solid ${focused ? 'var(--p)' : 'var(--border)'}`,
        borderRadius: 12,
        transition: 'border-color .15s',
      }}>
        <span style={{
          padding: '0 4px 0 12px', fontSize: 15, flexShrink: 0,
          color: focused ? 'var(--p2)' : 'var(--text3)',
          pointerEvents: 'none', transition: 'color .15s',
        }}>📍</span>
        <input
          ref={inputRef}
          style={{
            flex: 1, background: 'transparent',
            border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 13,
            padding: '11px 12px 11px 6px',
            fontFamily: 'var(--font)',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? .5 : 1,
          }}
          placeholder={placeholder ?? (lang === 'en' ? 'Address...' : lang === 'es' ? 'Dirección...' : lang === 'it' ? 'Indirizzo...' : 'Adresse...')}
          value={value}
          disabled={!!disabled}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => { setTimeout(() => setFocused(false), 200) }}
          onChange={e => {
            onChange(e.target.value)
            if (!e.target.value) setSuggestions([])
          }}
        />
        {value && !disabled && (
          <button type="button"
            onMouseDown={e => { e.preventDefault(); onChange(''); setSuggestions([]) }}
            style={{
              padding: '0 10px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 12, color: 'var(--text3)', flexShrink: 0,
            }}>✕</button>
        )}
      </div>

      {/* Dropdown suggestions Google Maps */}
      {suggestions.length > 0 && focused && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          left: 0, right: 0, zIndex: 9999,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: 'var(--sh-lg)',
        }}>
          {suggestions.slice(0, 5).map((s, i) => (
            <button key={s.place_id ?? i} type="button"
              onMouseDown={() => pickSuggestion(s)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                width: '100%', padding: '10px 14px',
                background: 'transparent', border: 'none',
                borderBottom: i < Math.min(suggestions.length, 5) - 1
                  ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font)', transition: 'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.structured_formatting?.main_text ?? s.description.split(',')[0]}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text3)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.structured_formatting?.secondary_text ?? s.description.split(',').slice(1).join(',')}
                </div>
              </div>
            </button>
          ))}
          <div style={{
            padding: '5px 14px', fontSize: 11, color: 'var(--text4)',
            textAlign: 'right', background: 'var(--bg3)',
          }}>
            Powered by Google
          </div>
        </div>
      )}
    </div>
  )
}
