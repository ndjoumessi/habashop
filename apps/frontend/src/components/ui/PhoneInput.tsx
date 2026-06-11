import { useState, useEffect } from 'react'

const COUNTRY_CODES = [
  { code:'+39',  flag:'🇮🇹', country:'Italia',          iso:'IT' },
  { code:'+33',  flag:'🇫🇷', country:'France',          iso:'FR' },
  { code:'+221', flag:'🇸🇳', country:'Sénégal',         iso:'SN' },
  { code:'+225', flag:'🇨🇮', country:"Côte d'Ivoire",   iso:'CI' },
  { code:'+237', flag:'🇨🇲', country:'Cameroun',        iso:'CM' },
  { code:'+223', flag:'🇲🇱', country:'Mali',            iso:'ML' },
  { code:'+242', flag:'🇨🇬', country:'Congo',           iso:'CG' },
  { code:'+243', flag:'🇨🇩', country:'RD Congo',        iso:'CD' },
  { code:'+241', flag:'🇬🇦', country:'Gabon',           iso:'GA' },
  { code:'+226', flag:'🇧🇫', country:'Burkina Faso',    iso:'BF' },
  { code:'+227', flag:'🇳🇪', country:'Niger',           iso:'NE' },
  { code:'+228', flag:'🇹🇬', country:'Togo',            iso:'TG' },
  { code:'+229', flag:'🇧🇯', country:'Bénin',           iso:'BJ' },
  { code:'+224', flag:'🇬🇳', country:'Guinée',          iso:'GN' },
  { code:'+233', flag:'🇬🇭', country:'Ghana',           iso:'GH' },
  { code:'+234', flag:'🇳🇬', country:'Nigeria',         iso:'NG' },
  { code:'+212', flag:'🇲🇦', country:'Maroc',           iso:'MA' },
  { code:'+213', flag:'🇩🇿', country:'Algérie',         iso:'DZ' },
  { code:'+216', flag:'🇹🇳', country:'Tunisie',         iso:'TN' },
  { code:'+32',  flag:'🇧🇪', country:'Belgique',        iso:'BE' },
  { code:'+41',  flag:'🇨🇭', country:'Suisse',          iso:'CH' },
  { code:'+34',  flag:'🇪🇸', country:'Espagne',         iso:'ES' },
  { code:'+44',  flag:'🇬🇧', country:'Royaume-Uni',     iso:'GB' },
  { code:'+49',  flag:'🇩🇪', country:'Allemagne',       iso:'DE' },
  { code:'+351', flag:'🇵🇹', country:'Portugal',        iso:'PT' },
  { code:'+352', flag:'🇱🇺', country:'Luxembourg',      iso:'LU' },
  { code:'+1',   flag:'🇺🇸', country:'États-Unis',      iso:'US' },
  { code:'+1',   flag:'🇨🇦', country:'Canada',          iso:'CA' },
]

interface PhoneInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  defaultCountry?: string
  className?: string
  readOnly?: boolean
}

export default function PhoneInput({
  value, onChange, placeholder = '77 000 00 00', defaultCountry, readOnly,
}: PhoneInputProps) {
  const getDefaultCode = () => {
    if (defaultCountry) {
      const found = COUNTRY_CODES.find(c => c.iso === defaultCountry)
      if (found) return found
    }
    return COUNTRY_CODES[0]
  }

  const [selectedCode, setSelectedCode] = useState(getDefaultCode)
  const [number, setNumber] = useState(() => {
    if (value.startsWith('+')) {
      const match = [...COUNTRY_CODES]
        .sort((a, b) => b.code.length - a.code.length)
        .find(c => value.startsWith(c.code))
      if (match) return value.slice(match.code.length).trim()
    }
    return value
  })
  const [showDropdown, setShowDropdown] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!value) return
    if (value.startsWith('+')) {
      const match = [...COUNTRY_CODES]
        .sort((a, b) => b.code.length - a.code.length)
        .find(c => value.startsWith(c.code))
      if (match) {
        setSelectedCode(match)
        setNumber(value.slice(match.code.length).trim())
      }
    }
  }, [value])

  // Mode lecture seule : rendu simple (placé après les hooks pour respecter les Rules of Hooks)
  if (readOnly) {
    return (
      <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
        {value || '—'}
      </span>
    )
  }

  const filtered = COUNTRY_CODES.filter(c =>
    c.country.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search)
  )

  return (
    <div style={{ position:'relative', display:'flex', gap:0 }}>

      {/* Sélecteur indicatif */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'10px 10px',
          background:'var(--bg3)',
          border:'1.5px solid var(--border)',
          borderRight:'none',
          borderRadius:'10px 0 0 10px',
          cursor:'pointer', fontFamily:'var(--font)',
          fontSize:13, color:'var(--text)',
          whiteSpace:'nowrap', flexShrink:0,
          transition:'border-color .15s',
        }}
      >
        <span style={{ fontSize:16 }}>{selectedCode.flag}</span>
        <span style={{ fontWeight:600 }}>{selectedCode.code}</span>
        <span style={{ fontSize:11, color:'var(--text3)' }}>▼</span>
      </button>

      {/* Input numéro */}
      <input
        type="tel"
        placeholder={placeholder}
        value={number}
        onChange={e => {
          setNumber(e.target.value)
          onChange(`${selectedCode.code} ${e.target.value}`)
        }}
        style={{
          flex:1, minWidth:0,
          padding:'11px 14px',
          background:'var(--bg3)',
          border:'1.5px solid var(--border)',
          borderLeft:'1px solid var(--border)',
          borderRadius:'0 10px 10px 0',
          fontSize:14, color:'var(--text)',
          fontFamily:'var(--font)',
          outline:'none',
          transition:'border-color .15s',
        }}
        onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--p2)'}
        onBlur={e  => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
      />

      {/* Dropdown pays */}
      {showDropdown && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0,
          background:'var(--card)',
          border:'1px solid var(--border2)',
          borderRadius:12,
          boxShadow:'var(--sh-lg)',
          width:280, zIndex:999,
          overflow:'hidden',
        }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
            <input
              autoFocus
              type="text"
              placeholder="🔍 Pays ou indicatif..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width:'100%', padding:'7px 10px',
                background:'var(--bg3)',
                border:'1px solid var(--border)',
                borderRadius:8, fontSize:12,
                color:'var(--text)', fontFamily:'var(--font)',
                outline:'none',
              }}
            />
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {filtered.map((c, i) => (
              <button key={i}
                type="button"
                onClick={() => {
                  setSelectedCode(c)
                  setShowDropdown(false)
                  setSearch('')
                  onChange(`${c.code} ${number}`)
                }}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  width:'100%', padding:'9px 14px',
                  background: selectedCode.code === c.code && selectedCode.iso === c.iso
                    ? 'rgba(91,78,232,.1)' : 'none',
                  border:'none',
                  borderBottom:'1px solid var(--border)',
                  cursor:'pointer', fontFamily:'var(--font)',
                  fontSize:13, color:'var(--text)',
                  textAlign:'left',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background =
                  selectedCode.code === c.code && selectedCode.iso === c.iso
                    ? 'rgba(91,78,232,.1)' : 'none'
                }
              >
                <span style={{ fontSize:18, flexShrink:0 }}>{c.flag}</span>
                <span style={{ flex:1 }}>{c.country}</span>
                <span style={{
                  fontSize:12, fontWeight:'var(--fw-semibold)',
                  color:'var(--p2)', fontFamily:'var(--mono)',
                }}>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overlay pour fermer */}
      {showDropdown && (
        <div
          style={{ position:'fixed', inset:0, zIndex:998 }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}
