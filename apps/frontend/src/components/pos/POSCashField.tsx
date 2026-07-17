import { AlertCircle } from 'lucide-react'

/**
 * Bloc « MONTANT REÇU » (mode Espèces) — 1:1 maquette 02-encaissement.view.html :
 * grand champ aligné à droite + suffixe devise, raccourcis (Exact / arrondis),
 * « Rendu monnaie » vert / montant insuffisant rouge.
 * Extrait en composant pour rester testable unitairement (clamp négatif, états).
 */
interface Props {
  lang: string
  cashGiven: string
  setCashGiven: (v: string) => void
  monnaie: number
  currencySymbol: string
  fmt: (n: number) => string
  /** Total à payer en devise d'AFFICHAGE (raccourcis Exact/arrondis) — optionnel. */
  totalDisplay?: number
  /** Décimales de la devise d'affichage (0 = XOF/XAF) — pilote les pas des raccourcis. */
  currencyDecimals?: number
}

export default function POSCashField({ lang, cashGiven, setCashGiven, monnaie, currencySymbol, fmt, totalDisplay, currencyDecimals = 0 }: Props) {
  // Montant reçu : jamais négatif. Vide → '' (traité comme 0 en aval). Négatif (collé/contournement) → 0.
  const onCashChange = (raw: string) => {
    if (raw === '') { setCashGiven(''); return }
    const n = parseFloat(raw)
    setCashGiven(!Number.isFinite(n) || n < 0 ? '0' : raw)
  }
  const cashEntered      = cashGiven.trim() !== '' && (parseFloat(cashGiven) || 0) > 0
  const cashSufficient   = cashEntered && monnaie >= 0
  const cashInsufficient = cashEntered && monnaie < 0

  // Raccourcis : Exact + arrondis supérieurs, dédupliqués. Pas adaptés à la devise :
  // sans décimales (XOF/XAF) → coupures franc CFA ; avec décimales (EUR/USD…) → billets usuels.
  const quicks: { label: string; value: number }[] = []
  if (totalDisplay && totalDisplay > 0) {
    const exact = Math.ceil(totalDisplay * 100) / 100
    const steps = currencyDecimals > 0 ? [5, 10, 50] : [1000, 5000, 10000]
    const ups = steps
      .map(step => Math.ceil(totalDisplay / step) * step)
      .filter(v => v > exact)
    const seen = new Set<number>()
    quicks.push({ label: lang === 'en' ? 'Exact' : lang === 'es' ? 'Exacto' : lang === 'it' ? 'Esatto' : 'Exact', value: exact })
    seen.add(exact)
    for (const v of ups) {
      if (!seen.has(v)) { seen.add(v); quicks.push({ label: v.toLocaleString('fr-FR'), value: v }) }
    }
  }
  const current = parseFloat(cashGiven) || 0

  return (
    <div>
      {/* Libellé visible façon maquette ; le nom accessible complet reste sur l'input */}
      <div aria-hidden="true" style={{
        marginBottom: 9, fontSize: 11, letterSpacing: '.5px',
        color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)',
      }}>
        {lang === 'en' ? 'Amount received' : lang === 'es' ? 'Importe recibido' : lang === 'it' ? 'Importo ricevuto' : 'Montant reçu'}
      </div>

      {/* Grand champ aligné à droite + suffixe devise (maquette) */}
      <div style={{
        background: 'var(--bg)', borderRadius: 11, padding: '6px 15px',
        border: `1px solid ${cashInsufficient ? 'var(--danger)' : cashSufficient ? 'var(--acc2)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6,
        transition: 'border-color .2s ease',
      }}>
        <input id="pos-cash-given" className="no-spin" type="number" min={0} step="any" inputMode="decimal"
          aria-label={lang === 'en' ? 'Amount received from customer' : lang === 'es' ? 'Importe recibido del cliente' : lang === 'it' ? 'Importo ricevuto dal cliente' : 'Montant reçu du client'}
          placeholder={lang === 'en' ? 'Amount received...' : lang === 'es' ? 'Importe recibido...' : lang === 'it' ? 'Importo ricevuto...' : 'Montant reçu...'}
          value={cashGiven}
          onKeyDown={e => { if (e.key === '-') e.preventDefault() }}
          onChange={e => onCashChange(e.target.value)}
          style={{
            flex: 1, minWidth: 0, textAlign: 'right',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 24, fontWeight: 'var(--fw-semibold)',
            fontFamily: 'var(--mono)', padding: '7px 0', boxSizing: 'border-box',
          }}
        />
        <span aria-hidden="true" style={{ color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}>{currencySymbol}</span>
      </div>

      {/* Raccourcis Exact / arrondis */}
      {quicks.length > 0 && (
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          {quicks.slice(0, 4).map(q => {
            const active = cashEntered && Math.abs(current - q.value) < 0.005
            return (
              <button key={q.label} type="button" onClick={() => setCashGiven(String(q.value))}
                style={{
                  flex: 1, textAlign: 'center', padding: 8, minHeight: 36,
                  background: 'var(--card2)',
                  border: `1px solid ${active ? 'var(--p)' : 'var(--border2)'}`,
                  borderRadius: 9, color: active ? 'var(--text)' : 'var(--text2)',
                  fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all .15s',
                }}>{q.label}</button>
            )
          })}
        </div>
      )}

      {cashInsufficient && (
        <div role="status" style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--danger)', transition: 'opacity .2s ease',
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {lang === 'en' ? 'Insufficient amount' : lang === 'es' ? 'Importe insuficiente' : lang === 'it' ? 'Importo insufficiente' : 'Montant insuffisant'}
        </div>
      )}

      {cashSufficient && (
        <div style={{
          marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'color-mix(in srgb, var(--acc2) 10%, transparent)',
          borderRadius: 11, padding: '12px 15px', transition: 'all .2s ease',
        }}>
          <span style={{ color: 'var(--text2)', fontSize: 13 }}>
            {lang === 'en' ? 'Change due' : lang === 'es' ? 'Cambio' : lang === 'it' ? 'Resto' : 'Rendu monnaie'}
          </span>
          <span style={{ fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--acc2)' }}>
            {fmt(monnaie)}
          </span>
        </div>
      )}
    </div>
  )
}
