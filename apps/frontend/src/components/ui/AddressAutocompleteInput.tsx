import { useState, useEffect, useRef, useId } from 'react'
import { MapPin, X } from 'lucide-react'
import { rechercherAdresses, MIN_CARACTERES, type Suggestion } from '@/lib/geo'

/**
 * Saisie d'adresse avec suggestions OpenStreetMap (Photon) — remplace Google Places.
 *
 * ⚠️ LE CONTRAT `{ value, onChange, placeholder, label, lang, disabled }` EST INCHANGÉ : six
 * formulaires l'appellent et trois tests le moquent par son chemin. On change le fournisseur,
 * pas l'interface.
 *
 * ⚠️ CE QUI A CHANGÉ DANS LA CADENCE, et pourquoi. Google était interrogé à CHAQUE frappe dès
 * deux caractères, sans temporisation ni annulation : chaque touche partait, et une réponse
 * lente pouvait écraser une réponse plus récente. Sur un fournisseur communautaire en « fair
 * use », c'est un blocage assuré. Désormais : trois caractères minimum, 350 ms de pause, et
 * la requête précédente est ANNULÉE — seule la dernière saisie peut peupler la liste.
 *
 * ⚠️ La saisie reste LIBRE. Une suggestion est une aide : le commerçant peut toujours écrire
 * une adresse que la carte ne connaît pas (quartier sans nom de rue, repère local), et c'est
 * fréquent là où ce produit est vendu. Rien ne bloque l'enregistrement.
 */
interface AddressAutocompleteInputProps {
  value:        string
  onChange:     (address: string) => void
  placeholder?: string
  label?:       string
  lang?:        string
  disabled?:    boolean
}

const PAUSE_MS = 350

export default function AddressAutocompleteInput({
  value, onChange, placeholder,
  label, lang = 'fr', disabled,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [ouvert,      setOuvert]      = useState(false)
  const [focused,     setFocused]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [actif,       setActif]       = useState(-1)
  const [saisi,       setSaisi]       = useState(false)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const idChamp  = useId()
  const idListe  = useId()

  const t = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  // Ferme si clic en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ⚠️ Recherche SEULEMENT après une saisie réelle : ouvrir un formulaire d'édition pré-rempli
  // ne doit émettre aucune requête pour une adresse que personne n'a touchée.
  useEffect(() => {
    if (!saisi || value.trim().length < MIN_CARACTERES) { setSuggestions([]); setLoading(false); return }
    const ctrl = new AbortController()
    const minuteur = setTimeout(() => {
      setLoading(true)
      rechercherAdresses(value, lang, ctrl.signal)
        .then(liste => {
          if (ctrl.signal.aborted) return
          setSuggestions(liste); setActif(-1)
          setOuvert(liste.length > 0)
        })
        // Échec réseau ou fournisseur indisponible : la saisie manuelle continue, sans bruit.
        .catch(() => { if (!ctrl.signal.aborted) setSuggestions([]) })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    }, PAUSE_MS)
    return () => { clearTimeout(minuteur); ctrl.abort() }
  }, [value, lang, saisi])

  const choisir = (s: Suggestion) => {
    onChange(s.label)
    setSaisi(false)
    setSuggestions([])
    setOuvert(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOuvert(false); return }
    if (!ouvert || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif(i => (i + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(i => (i <= 0 ? suggestions.length - 1 : i - 1)) }
    else if (e.key === 'Enter' && actif >= 0) { e.preventDefault(); choisir(suggestions[actif]) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && (
        <label htmlFor={idChamp} style={{
          display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
          textTransform: 'uppercase', letterSpacing: '.6px',
          color: 'var(--text3)', marginBottom: 6,
        }}>{label}</label>
      )}

      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg4)',
        border: `1.5px solid ${focused ? 'var(--p2)' : 'var(--border)'}`,
        borderRadius: 10,
        boxShadow: focused ? '0 0 0 3px rgba(124,111,240,.15)' : 'none',
        transition: 'all .15s',
        opacity: disabled ? 0.5 : 1,
      }}>
        <MapPin size={15} aria-hidden="true" style={{
          margin: '0 4px 0 12px', flexShrink: 0,
          color: focused ? 'var(--p2)' : 'var(--text3)', transition: 'color .15s',
        }} />

        <input
          id={idChamp}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={ouvert && suggestions.length > 0}
          aria-controls={idListe}
          aria-activedescendant={actif >= 0 ? `${idListe}-${actif}` : undefined}
          disabled={disabled}
          placeholder={placeholder ?? t('Adresse complète…', 'Full address…', 'Dirección completa…', 'Indirizzo completo…')}
          value={value}
          autoComplete="off"
          onChange={e => { setSaisi(true); onChange(e.target.value) }}
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setOuvert(true) }}
          onBlur={() => { setFocused(false); setTimeout(() => setOuvert(false), 200) }}
          onKeyDown={onKeyDown}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            outline: 'none', padding: '10px 8px',
            color: 'var(--text)', fontSize: 'var(--fs-sm)', fontFamily: 'var(--font)',
          }}
        />

        <div style={{ paddingRight: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading && (
            <span aria-hidden="true" style={{
              width: 13, height: 13, borderRadius: '50%',
              border: '2px solid var(--border)',
              borderTopColor: 'var(--p2)',
              animation: 'spin 1s linear infinite',
              display: 'inline-block', flexShrink: 0,
            }} />
          )}
          {value && !disabled && (
            <button type="button"
              aria-label={t('Effacer l’adresse', 'Clear address', 'Borrar la dirección', 'Cancella indirizzo')}
              onClick={() => { onChange(''); setSuggestions([]); setSaisi(false) }}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'var(--bg4)', border: 'none',
                cursor: 'pointer', color: 'var(--text3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><X size={11} /></button>
          )}
        </div>
      </div>

      {ouvert && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 11, overflow: 'hidden', boxShadow: 'var(--sh-lg)',
        }}>
          <div id={idListe} role="listbox" aria-label={t('Suggestions d’adresse', 'Address suggestions', 'Sugerencias de dirección', 'Suggerimenti di indirizzo')}>
            {suggestions.map((s, i) => (
              <div key={`${s.lat},${s.lng},${i}`} id={`${idListe}-${i}`} role="option" aria-selected={i === actif}
                onMouseDown={e => { e.preventDefault(); choisir(s) }}
                onMouseEnter={() => setActif(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 14px',
                  background: i === actif ? 'rgba(108,71,255,.08)' : 'transparent',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .1s',
                }}
              >
                <MapPin size={13} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text3)' }} />
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            ))}
          </div>
          {/* ⚠️ Attribution des données (licence ODbL) — la liste est une vue de la base OSM. */}
          <div style={{ padding: '4px 12px', fontSize: 'var(--fs-caption)', color: 'var(--text4)', borderTop: '1px solid var(--border)' }}>
            {t('Données', 'Data', 'Datos', 'Dati')} © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  )
}
