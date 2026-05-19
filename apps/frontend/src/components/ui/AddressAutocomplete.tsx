import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

declare global {
  interface Window {
    google: any
    _initGoogleMaps?: () => void
  }
}

export default function AddressAutocomplete({ value, onChange, placeholder = 'Adresse...', className = 'input', style }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string | undefined

  useEffect(() => {
    if (!apiKey) return
    if (window.google?.maps?.places) { setReady(true); return }
    const id = 'gmap-script'
    if (document.getElementById(id)) { return }
    window._initGoogleMaps = () => setReady(true)
    const s = document.createElement('script')
    s.id = id
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=_initGoogleMaps`
    s.async = true; s.defer = true
    document.head.appendChild(s)
  }, [apiKey])

  useEffect(() => {
    if (!ready || !inputRef.current || !window.google?.maps?.places) return
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      fields: ['formatted_address'],
    })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (place.formatted_address) onChange(place.formatted_address)
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={inputRef}
      className={className}
      style={style}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  )
}
