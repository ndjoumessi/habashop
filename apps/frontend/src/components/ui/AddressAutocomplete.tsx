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

declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

let googleMapsLoaded = false
let googleMapsLoading = false
const callbacks: (() => void)[] = []

function loadGoogleMaps(apiKey: string, language = 'fr'): Promise<void> {
  return new Promise((resolve) => {
    if (googleMapsLoaded) { resolve(); return }
    callbacks.push(resolve)
    if (googleMapsLoading) return

    googleMapsLoading = true
    window.initGoogleMaps = () => {
      googleMapsLoaded = true
      googleMapsLoading = false
      callbacks.forEach(cb => cb())
      callbacks.length = 0
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${language}&callback=initGoogleMaps`
    script.async = true
    script.defer = true
    script.onerror = () => {
      googleMapsLoading = false
      resolve()
    }
    document.head.appendChild(script)
  })
}

export default function AddressAutocomplete({
  value, onChange, placeholder, lang = 'fr', disabled,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

  useEffect(() => {
    if (!apiKey) return
    loadGoogleMaps(apiKey, lang).then(() => setReady(true))
  }, [apiKey, lang])

  useEffect(() => {
    if (!ready || !inputRef.current || !window.google?.maps?.places) return

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'address_components'],
      }
    )

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (!place?.geometry) return

      const getComp = (type: string) => {
        const c = place.address_components?.find(
          (c: any) => c.types.includes(type)
        )
        return c?.long_name ?? ''
      }

      const details: AddressDetails = {
        lat:        place.geometry.location.lat(),
        lng:        place.geometry.location.lng(),
        city:       getComp('locality') || getComp('administrative_area_level_2'),
        country:    getComp('country'),
        postalCode: getComp('postal_code'),
        formatted:  place.formatted_address ?? '',
      }
      onChange(place.formatted_address ?? '', details)
    })

    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(
          autocompleteRef.current
        )
      }
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 10, top: '50%',
        transform: 'translateY(-50%)',
        fontSize: 14, pointerEvents: 'none',
        color: 'var(--text3)', zIndex: 1,
      }}>📍</span>
      <input
        ref={inputRef}
        className="input"
        style={{
          paddingLeft: 34,
          opacity: disabled ? .5 : 1,
        }}
        placeholder={placeholder ?? (lang === 'fr' ? 'Adresse...' : 'Address...')}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      {!apiKey && (
        <div style={{
          fontSize: 9, color: 'var(--text4)',
          marginTop: 3, paddingLeft: 4,
        }}>
          {lang === 'fr'
            ? '⚠️ Clé Google Maps non configurée'
            : '⚠️ Google Maps key not configured'}
        </div>
      )}
    </div>
  )
}
