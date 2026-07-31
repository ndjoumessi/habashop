import { useState, useEffect, useRef } from 'react'

const COUNTRY_CODES = [
  { code:'+221', flag:'🇸🇳', country:'Sénégal',          region:'Afrique Ouest'    },
  { code:'+225', flag:'🇨🇮', country:"Côte d'Ivoire",    region:'Afrique Ouest'    },
  { code:'+223', flag:'🇲🇱', country:'Mali',              region:'Afrique Ouest'    },
  { code:'+226', flag:'🇧🇫', country:'Burkina Faso',      region:'Afrique Ouest'    },
  { code:'+227', flag:'🇳🇪', country:'Niger',             region:'Afrique Ouest'    },
  { code:'+228', flag:'🇹🇬', country:'Togo',              region:'Afrique Ouest'    },
  { code:'+229', flag:'🇧🇯', country:'Bénin',             region:'Afrique Ouest'    },
  { code:'+224', flag:'🇬🇳', country:'Guinée',            region:'Afrique Ouest'    },
  { code:'+220', flag:'🇬🇲', country:'Gambie',            region:'Afrique Ouest'    },
  { code:'+232', flag:'🇸🇱', country:'Sierra Leone',      region:'Afrique Ouest'    },
  { code:'+231', flag:'🇱🇷', country:'Liberia',           region:'Afrique Ouest'    },
  { code:'+245', flag:'🇬🇼', country:'Guinée-Bissau',     region:'Afrique Ouest'    },
  { code:'+238', flag:'🇨🇻', country:'Cap-Vert',          region:'Afrique Ouest'    },
  { code:'+234', flag:'🇳🇬', country:'Nigeria',           region:'Afrique Ouest'    },
  { code:'+233', flag:'🇬🇭', country:'Ghana',             region:'Afrique Ouest'    },
  { code:'+237', flag:'🇨🇲', country:'Cameroun',          region:'Afrique Centrale' },
  { code:'+241', flag:'🇬🇦', country:'Gabon',             region:'Afrique Centrale' },
  { code:'+242', flag:'🇨🇬', country:'Congo',             region:'Afrique Centrale' },
  { code:'+243', flag:'🇨🇩', country:'RD Congo',          region:'Afrique Centrale' },
  { code:'+236', flag:'🇨🇫', country:'Centrafrique',      region:'Afrique Centrale' },
  { code:'+235', flag:'🇹🇩', country:'Tchad',             region:'Afrique Centrale' },
  { code:'+212', flag:'🇲🇦', country:'Maroc',             region:'Afrique Nord'     },
  { code:'+213', flag:'🇩🇿', country:'Algérie',           region:'Afrique Nord'     },
  { code:'+216', flag:'🇹🇳', country:'Tunisie',           region:'Afrique Nord'     },
  { code:'+20',  flag:'🇪🇬', country:'Égypte',            region:'Afrique Nord'     },
  { code:'+254', flag:'🇰🇪', country:'Kenya',             region:'Afrique Est'      },
  { code:'+255', flag:'🇹🇿', country:'Tanzanie',          region:'Afrique Est'      },
  { code:'+33',  flag:'🇫🇷', country:'France',            region:'Europe'           },
  { code:'+32',  flag:'🇧🇪', country:'Belgique',          region:'Europe'           },
  { code:'+41',  flag:'🇨🇭', country:'Suisse',            region:'Europe'           },
  { code:'+44',  flag:'🇬🇧', country:'Royaume-Uni',       region:'Europe'           },
  { code:'+39',  flag:'🇮🇹', country:'Italie',            region:'Europe'           },
  { code:'+34',  flag:'🇪🇸', country:'Espagne',           region:'Europe'           },
  { code:'+1',   flag:'🇺🇸', country:'USA / Canada',      region:'Amériques'        },
]

const REGIONS = [
  'Afrique Ouest', 'Afrique Centrale',
  'Afrique Nord',  'Afrique Est',
  'Europe',        'Amériques',
]

type CountryEntry = typeof COUNTRY_CODES[0]

interface PhoneInputWithCountryProps {
  value:        string
  onChange:     (full: string) => void
  placeholder?: string
  label?:       string
  lang?:        string
  disabled?:    boolean
}

function parsePhone(v: string): { code: string; flag: string; number: string } {
  if (!v) return { code: '+221', flag: '🇸🇳', number: '' }
  // Tri par longueur décroissante pour matcher le plus long en premier
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  const match = sorted.find(c => v.startsWith(c.code))
  if (match) return { code: match.code, flag: match.flag, number: v.slice(match.code.length).trim() }
  return { code: '+221', flag: '🇸🇳', number: v }
}

export default function PhoneInputWithCountry({
  value, onChange, placeholder,
  label, lang = 'fr', disabled,
}: PhoneInputWithCountryProps) {
  const parsed = parsePhone(value)
  const [code,    setCode]    = useState(parsed.code)
  const [flag,    setFlag]    = useState(parsed.flag)
  const [number,  setNumber]  = useState(parsed.number)
  const [open,    setOpen]    = useState(false)
  const [search,  setSearch]  = useState('')
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p = parsePhone(value)
    setCode(p.code)
    setFlag(p.flag)
    setNumber(p.number)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (c: CountryEntry) => {
    setCode(c.code)
    setFlag(c.flag)
    setOpen(false)
    setSearch('')
    onChange(`${c.code}${number.replace(/\s/g, '')}`)
  }

  const handleNumber = (v: string) => {
    const clean = v.replace(/[^0-9\s\-]/g, '')
    setNumber(clean)
    onChange(`${code}${clean.replace(/\s/g, '')}`)
  }

  const filtered = COUNTRY_CODES.filter(c =>
    !search ||
    c.country.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search) ||
    c.region.toLowerCase().includes(search.toLowerCase())
  )

  const isValid = number.replace(/\s/g, '').length >= 6

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
          textTransform: 'uppercase', letterSpacing: '.6px',
          color: 'var(--text3)', marginBottom: 6,
        }}>{label}</label>
      )}

      {/* Input principal */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--bg4)',
        border: `1.5px solid ${focused ? 'var(--p2)' : 'var(--border)'}`,
        borderRadius: 10, overflow: 'hidden',
        boxShadow: focused ? 'var(--sh-glow)' : 'none',
        transition: 'all .15s',
        opacity: disabled ? 0.5 : 1,
      }}>
        {/* Bouton indicatif */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(!open); setSearch('') }}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={lang === 'en' ? 'Choose country dial code' : lang === 'es' ? 'Elegir prefijo del país' : lang === 'it' ? 'Scegli prefisso paese' : "Choisir l'indicatif pays"}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 10px',
            background: 'var(--bg3)',
            border: 'none',
            borderRight: '1px solid var(--border)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0, minWidth: 85,
            transition: 'background .12s',
          }}
          onMouseEnter={e => !disabled &&
            ((e.currentTarget as HTMLElement).style.background = 'var(--bg4)')}
          onMouseLeave={e =>
            ((e.currentTarget as HTMLElement).style.background = 'var(--bg3)')}
        >
          <span style={{ fontSize: 'var(--fs-lg)' }}>{flag}</span>
          <span style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{code}</span>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▾</span>
        </button>

        {/* Input numéro */}
        <input
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          placeholder={placeholder ?? '77 000 00 00'}
          value={number}
          onChange={e => handleNumber(e.target.value)}
          onKeyDown={e => {
            const ok = ['Backspace','Delete','Tab','Enter','Escape','ArrowLeft','ArrowRight',' ','-']
            if (ok.includes(e.key)) return
            if (/^\d$/.test(e.key)) return
            if (e.ctrlKey || e.metaKey) return
            e.preventDefault()
          }}
          onPaste={e => {
            e.preventDefault()
            const clean = e.clipboardData.getData('text').replace(/[^0-9\s\-]/g, '')
            handleNumber(clean.slice(0, 15))
          }}
          onFocus={() => { setFocused(true); setOpen(false) }}
          onBlur={() => setFocused(false)}
          maxLength={15}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            outline: 'none', padding: '10px 12px',
            color: 'var(--text)', fontSize: 'var(--fs-body)',
            fontFamily: 'var(--mono)', letterSpacing: '.5px',
          }}
        />

        {/* Indicateur validité + clear */}
        {number.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', paddingRight: 10, gap: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isValid ? 'var(--acc2)' : 'var(--danger)',
              flexShrink: 0,
            }} />
            {!disabled && (
              <button type="button" onClick={() => { setNumber(''); onChange(code) }} style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'var(--bg4)', border: 'none',
                cursor: 'pointer', color: 'var(--text3)', fontSize: 'var(--fs-caption)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            )}
          </div>
        )}
      </div>

      {/* Aperçu numéro complet */}
      {isValid && (
        <div style={{ marginTop: 4, fontSize: 'var(--fs-caption)', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 'var(--fs-sm)' }}>{flag}</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--acc2)' }}>
            {code} {number}
          </span>
        </div>
      )}

      {/* Dropdown pays */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)',
          left: 0, right: 0, zIndex: 9999,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: 'var(--sh-lg)',
        }}>
          {/* Recherche */}
          <div style={{
            padding: '8px 10px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)', position: 'sticky', top: 0, zIndex: 1,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 10px',
            }}>
              <span style={{ color: 'var(--text3)', fontSize: 'var(--fs-label)' }}>🔍</span>
              <input
                autoFocus
                type="text"
                placeholder={lang === 'en' ? 'Country, code…' : lang === 'es' ? 'País, código…' : lang === 'it' ? 'Paese, prefisso…' : 'Pays, indicatif…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch('') } }}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  outline: 'none', color: 'var(--text)', fontSize: 'var(--fs-label)',
                  fontFamily: 'var(--font)',
                }}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', fontSize: 'var(--fs-label)',
                }}>✕</button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div role="listbox" style={{ maxHeight: 250, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--fs-label)' }}>
                {lang === 'en' ? 'No results' : lang === 'es' ? 'Sin resultados' : lang === 'it' ? 'Nessun risultato' : 'Aucun résultat'}
              </div>
            ) : search ? (
              filtered.map((c, i) => (
                <CountryRow key={i} c={c} selected={code === c.code && flag === c.flag} onSelect={() => select(c)} />
              ))
            ) : (
              REGIONS.map(region => {
                const items = filtered.filter(c => c.region === region)
                if (!items.length) return null
                return (
                  <div key={region}>
                    <div style={{
                      padding: '6px 12px 3px', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
                      textTransform: 'uppercase', letterSpacing: '.7px',
                      color: 'var(--text4)', background: 'var(--bg3)',
                    }}>{region}</div>
                    {items.map((c, i) => (
                      <CountryRow key={i} c={c} selected={code === c.code && flag === c.flag} onSelect={() => select(c)} />
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CountryRow({ c, selected, onSelect }: { c: CountryEntry; selected: boolean; onSelect: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseDown={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px',
        background: selected ? 'rgba(108,71,255,.12)' : hov ? 'var(--bg3)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
      }}
    >
      <span style={{ fontSize: 'var(--fs-lg)', width: 26, textAlign: 'center' }}>{c.flag}</span>
      <span style={{
        flex: 1, fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-regular)',
        color: selected ? 'var(--p3)' : 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{c.country}</span>
      <span style={{
        fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)',
        color: selected ? 'var(--p3)' : 'var(--text3)',
        background: selected ? 'rgba(108,71,255,.15)' : 'var(--bg3)',
        padding: '2px 7px', borderRadius: 6, flexShrink: 0,
      }}>{c.code}</span>
      {selected && <span style={{ color: 'var(--p3)', fontSize: 'var(--fs-caption)' }}>✓</span>}
    </button>
  )
}
