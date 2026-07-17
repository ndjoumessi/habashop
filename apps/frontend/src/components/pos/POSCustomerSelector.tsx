import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Search, QrCode, X, Check, UserPlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { customersApi } from '@/lib/api'

// Scanner caméra @zxing (BrowserMultiFormatReader lit le QR nativement) — lazy (114 kB gz).
const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))

export interface LinkedCustomer { id: string; name: string }

interface Props {
  lang: string
  linkedCustomer: LinkedCustomer | null
  setLinkedCustomer: (c: LinkedCustomer | null) => void
  enableLoyalty: boolean
  loyaltyPct?: number
  loyaltyTier?: string
  loyaltyPoints?: number | null
}

const TIER_NAME: Record<string, [string, string, string, string]> = {
  Bronze: ['Bronze', 'Bronze', 'Bronce', 'Bronzo'],
  Silver: ['Argent', 'Silver', 'Plata', 'Argento'],
  Gold:   ['Or', 'Gold', 'Oro', 'Oro'],
}

// Extrait l'ID client d'un texte QR : accepte le préfixe `HABA-CUST:` (carte fidélité) ou un ID brut.
function parseScannedCustomerId(text: string): string {
  const t = text.trim()
  if (t.startsWith('HABA-CUST:')) return t.slice('HABA-CUST:'.length).trim()
  return t
}

export default function POSCustomerSelector({ lang, linkedCustomer, setLinkedCustomer, enableLoyalty, loyaltyPct = 0, loyaltyTier = '', loyaltyPoints = null }: Props) {
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<any[]>([])
  const [open, setOpen]         = useState(false)
  const [searching, setSearching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [resolving, setResolving] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Recherche debouncée (300 ms, min 2 chars).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setSearching(true)
    const h = setTimeout(() => {
      customersApi.search(q)
        .then(r => { setResults(r ?? []); setOpen(true) })
        .catch(() => { setResults([]); setOpen(false) })
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(h)
  }, [query])

  // Fermeture du dropdown au clic extérieur.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const tierLabel = (t: string) => { const n = TIER_NAME[t]; return n ? i(n[0], n[1], n[2], n[3]) : t }

  const select = (c: { id: string; name: string }) => {
    setLinkedCustomer({ id: c.id, name: c.name })
    setQuery(''); setResults([]); setOpen(false)
  }

  const handleScan = async (raw: string) => {
    setShowScanner(false)
    const id = parseScannedCustomerId(raw)
    if (!id) return
    setResolving(true)
    try {
      const c = await customersApi.get(id)
      if (c?.id) {
        select({ id: c.id, name: c.name })
        toast.success(i('Client lié', 'Customer linked', 'Cliente vinculado', 'Cliente collegato'))
      } else {
        toast.error(i('QR non reconnu', 'QR not recognized', 'QR no reconocido', 'QR non riconosciuto'))
      }
    } catch {
      toast.error(i('QR non reconnu', 'QR not recognized', 'QR no reconocido', 'QR non riconosciuto'))
    } finally {
      setResolving(false)
    }
  }

  return (
    <div style={{ flexShrink: 0, padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
      {linkedCustomer ? (
        // ── Puce client lié (spec item 11) : avatar initiales + nom + palier + points, bordure --border3 ──
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '8px 10px', background: 'var(--card2)', border: '1px solid var(--border3)', borderRadius: 10,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span aria-hidden="true" style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--p), var(--p2))', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 'var(--fw-bold)', letterSpacing: '.5px',
            }}>
              {linkedCustomer.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {linkedCustomer.name}
              </span>
              {enableLoyalty && loyaltyTier && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
                  <Check size={11} style={{ color: 'var(--acc2)', flexShrink: 0 }} />
                  {/* ⚠️ E2E matche /Bronze · −5%/ — garder ce format, les points s'ajoutent APRÈS */}
                  <span>· {tierLabel(loyaltyTier)}{loyaltyPct > 0 ? ` · −${loyaltyPct}%` : ''}{loyaltyPoints != null ? ` · ${loyaltyPoints} pts` : ''}</span>
                </span>
              )}
            </span>
          </span>
          <button type="button" onClick={() => setLinkedCustomer(null)}
            aria-label={i('Retirer le client', 'Remove customer', 'Quitar cliente', 'Rimuovi cliente')}
            style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--text3)', display: 'flex', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      ) : (
        // ── Champ recherche + bouton scan ──
        <div ref={boxRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input
              className="input"
              style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
              aria-label={i('Ajouter un client (nom, téléphone…)', 'Add a customer (name, phone…)', 'Añadir cliente (nombre, teléfono…)', 'Aggiungi cliente (nome, telefono…)')}
              placeholder={i('Ajouter un client (nom, téléphone…)', 'Add a customer (name, phone…)', 'Añadir cliente (nombre, teléfono…)', 'Aggiungi cliente (nome, telefono…)')}
              aria-expanded={open}
              aria-haspopup="listbox"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => { if (results.length) setOpen(true) }}
            />
            {searching && <Loader2 size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', animation: 'spin .7s linear infinite' }} />}
          </div>
          <button type="button" onClick={() => setShowScanner(true)} disabled={resolving}
            title={i('Scanner la carte fidélité', 'Scan loyalty card', 'Escanear tarjeta', 'Scansiona carta')}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10,
              cursor: resolving ? 'default' : 'pointer', color: 'var(--text2)', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 'var(--fw-semibold)',
            }}>
            {resolving ? <Loader2 size={15} style={{ animation: 'spin .7s linear infinite' }} /> : <QrCode size={15} />}
            <span>{i('Scanner', 'Scan', 'Escanear', 'Scansiona')}</span>
          </button>

          {/* Dropdown résultats */}
          {open && (
            <div role="listbox" style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: 'var(--sh-xl, 0 10px 40px rgba(0,0,0,.3))', overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
            }}>
              {results.length === 0 ? (
                <div role="status" style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={13} aria-hidden="true" /> {i('Aucun client trouvé', 'No customer found', 'Ningún cliente', 'Nessun cliente')}
                </div>
              ) : results.map(c => (
                <button key={c.id} type="button" role="option" aria-selected={false} onClick={() => select(c)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '9px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.phone && <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{c.phone}</span>}
                  </span>
                  {enableLoyalty && c.tier && (
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 'var(--fw-bold)', padding: '2px 8px', borderRadius: 99, background: 'var(--bg4)', color: 'var(--text2)' }}>{tierLabel(c.tier)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
        </Suspense>
      )}
    </div>
  )
}
