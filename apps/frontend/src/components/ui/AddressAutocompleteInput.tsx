import { useState, useEffect, useRef, useCallback } from 'react'

// Charge Google Maps une seule fois (singleton)
let gmapsLoaded = false
let gmapsLoading = false
const gmapsCallbacks: Array<() => void> = []

function loadGoogleMaps(apiKey: string, lang: string): Promise<void> {
  return new Promise(resolve => {
    if (gmapsLoaded) { resolve(); return }
    gmapsCallbacks.push(resolve)
    if (gmapsLoading) return
    gmapsLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${lang}`
    script.async = true
    script.defer = true
    script.onload = () => {
      gmapsLoaded = true
      gmapsLoading = false
      gmapsCallbacks.forEach(cb => cb())
      gmapsCallbacks.length = 0
    }
    script.onerror = () => { gmapsLoading = false; resolve() }
    document.head.appendChild(script)
  })
}

interface AddressAutocompleteInputProps {
  value:        string
  onChange:     (address: string) => void
  placeholder?: string
  label?:       string
  lang?:        string
  disabled?:    boolean
}

export default function AddressAutocompleteInput({
  value, onChange, placeholder,
  label, lang = 'fr', disabled,
}: AddressAutocompleteInputProps) {
  const [suggestions,   setSuggestions]   = useState<string[]>([])
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [focused,       setFocused]       = useState(false)
  const [loading,       setLoading]       = useState(false)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const svcRef   = useRef<any>(null)
  const apiKey   = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY as string | undefined

  // Init Google Maps
  useEffect(() => {
    if (!apiKey) return
    loadGoogleMaps(apiKey, lang).then(() => {
      const google = (window as any).google
      if (google?.maps?.places?.AutocompleteService) {
        svcRef.current = new google.maps.places.AutocompleteService()
      }
    })
  }, [apiKey, lang])

  // Ferme si clic en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback((input: string) => {
    if (!input || input.length < 2 || !svcRef.current) { setSuggestions([]); return }
    setLoading(true)
    svcRef.current.getPlacePredictions(
      { input, types: ['address'], language: lang },
      (preds: any[] | null) => {
        setLoading(false)
        const list = (preds ?? []).slice(0, 5).map((p: any) => p.description)
        setSuggestions(list)
        if (list.length > 0) setShowDropdown(true)
      }
    )
  }, [lang])

  const handleChange = (v: string) => {
    onChange(v)
    if (v.length >= 2) fetchSuggestions(v)
    else { setSuggestions([]); setShowDropdown(false) }
  }

  const selectSuggestion = (s: string) => {
    onChange(s)
    setSuggestions([])
    setShowDropdown(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 10, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '.6px',
          color: 'var(--text3)', marginBottom: 6,
        }}>{label}</label>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg4)',
        border: `1.5px solid ${focused ? 'var(--p2)' : 'var(--border)'}`,
        borderRadius: 10,
        boxShadow: focused ? '0 0 0 3px rgba(124,111,240,.15)' : 'none',
        transition: 'all .15s',
        opacity: disabled ? 0.5 : 1,
      }}>
        <span style={{
          padding: '0 4px 0 12px', fontSize: 14, flexShrink: 0,
          color: focused ? 'var(--p2)' : 'var(--text3)',
          transition: 'color .15s', pointerEvents: 'none',
        }}>📍</span>

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder ?? (lang === 'fr' ? 'Adresse complète…' : 'Full address…')}
          value={value}
          autoComplete="off"
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); if (value.length >= 2) fetchSuggestions(value) }}
          onBlur={() => { setFocused(false); setTimeout(() => setShowDropdown(false), 200) }}
          onKeyDown={e => { if (e.key === 'Escape') { setShowDropdown(false); setSuggestions([]) } }}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            outline: 'none', padding: '10px 8px',
            color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)',
          }}
        />

        <div style={{ paddingRight: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading && (
            <span style={{
              width: 13, height: 13, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,.1)',
              borderTopColor: 'var(--p2)',
              animation: 'spin 1s linear infinite',
              display: 'inline-block', flexShrink: 0,
            }} />
          )}
          {value && !disabled && (
            <button type="button" onClick={() => { onChange(''); setSuggestions([]) }} style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'rgba(255,255,255,.08)', border: 'none',
              cursor: 'pointer', color: 'var(--text3)', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: '#0D0D1C', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 11, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.8)',
        }}>
          <div style={{ padding: '5px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text4)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            {lang === 'fr' ? 'Suggestions Google Maps' : 'Google Maps Suggestions'}
          </div>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => selectSuggestion(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 14px',
                background: 'transparent', border: 'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>📍</span>
              <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
            </button>
          ))}
        </div>
      )}

      {/* Message si Google Maps absent */}
      {!apiKey && focused && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          padding: '10px 14px', background: 'rgba(255,184,0,.08)',
          border: '1px solid rgba(255,184,0,.2)', borderRadius: 9,
          fontSize: 11, color: 'var(--warn)',
        }}>
          ⚠️ {lang === 'fr' ? 'Saisie manuelle (Google Maps non configuré)' : 'Manual input (Google Maps not configured)'}
        </div>
      )}
    </div>
  )
}
