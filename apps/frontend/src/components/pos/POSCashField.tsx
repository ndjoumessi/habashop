import { AlertCircle } from 'lucide-react'

/**
 * Champ « Montant reçu du client » (mode Espèces) + monnaie à rendre / montant
 * insuffisant. Vit dans la feuille d'encaissement (POSModals) depuis l'item 11 —
 * extrait pour rester testable unitairement (clamp négatif, états).
 */
interface Props {
  lang: string
  cashGiven: string
  setCashGiven: (v: string) => void
  monnaie: number
  currencySymbol: string
  fmt: (n: number) => string
}

export default function POSCashField({ lang, cashGiven, setCashGiven, monnaie, currencySymbol, fmt }: Props) {
  // Montant reçu : jamais négatif. Vide → '' (traité comme 0 en aval). Négatif (collé/contournement) → 0.
  const onCashChange = (raw: string) => {
    if (raw === '') { setCashGiven(''); return }
    const n = parseFloat(raw)
    setCashGiven(!Number.isFinite(n) || n < 0 ? '0' : raw)
  }
  const cashEntered      = cashGiven.trim() !== '' && (parseFloat(cashGiven) || 0) > 0
  const cashSufficient   = cashEntered && monnaie >= 0
  const cashInsufficient = cashEntered && monnaie < 0

  return (
    <div>
      <label htmlFor="pos-cash-given" style={{
        display:'block', marginBottom:5, fontSize:11, fontWeight:'var(--fw-semibold)',
        color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px',
      }}>
        {lang === 'en' ? 'Amount received from customer' : lang === 'es' ? 'Importe recibido del cliente' : lang === 'it' ? 'Importo ricevuto dal cliente' : 'Montant reçu du client'}
      </label>
      <div style={{ position:'relative' }}>
        <input id="pos-cash-given" className="input" type="number" min={0} step="any" inputMode="decimal"
          placeholder={lang === 'en' ? 'Amount received...' : lang === 'es' ? 'Importe recibido...' : lang === 'it' ? 'Importo ricevuto...' : 'Montant reçu...'}
          value={cashGiven}
          onKeyDown={e => { if (e.key === '-') e.preventDefault() }}
          onChange={e => onCashChange(e.target.value)}
          style={{
            textAlign:'right', paddingRight:50, fontSize:13, width:'100%', boxSizing:'border-box',
            borderColor: cashInsufficient ? 'var(--danger)' : cashSufficient ? 'var(--acc2)' : undefined,
            boxShadow: cashInsufficient ? '0 0 0 1px var(--danger)' : cashSufficient ? '0 0 0 1px var(--acc2)' : undefined,
            transition:'border-color .2s ease, box-shadow .2s ease',
          }}
        />
        <span style={{
          position:'absolute', right:12, top:'50%',
          transform:'translateY(-50%)',
          fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text3)',
          pointerEvents:'none',
        }}>{currencySymbol}</span>
      </div>

      {cashInsufficient && (
        <div role="status" style={{
          marginTop:6, display:'flex', alignItems:'center', gap:5,
          fontSize:12, fontWeight:'var(--fw-regular)', color:'var(--danger)', transition:'opacity .2s ease',
        }}>
          <AlertCircle size={13} style={{ flexShrink:0 }} />
          {lang === 'en' ? 'Insufficient amount' : lang === 'es' ? 'Importe insuficiente' : lang === 'it' ? 'Importo insufficiente' : 'Montant insuffisant'}
        </div>
      )}

      {cashSufficient && (
        <div style={{
          marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'10px 12px', background:'var(--c-green-bg)', border:'1px solid var(--c-green-border)',
          borderRadius:10, transition:'all .2s ease',
        }}>
          <span style={{ color:'var(--text2)', fontWeight:'var(--fw-regular)', fontSize:13 }}>
            {lang === 'en' ? 'Change to return' : lang === 'es' ? 'Cambio a devolver' : lang === 'it' ? 'Resto da dare' : 'Monnaie à rendre'}
          </span>
          <span style={{ fontWeight:'var(--fw-semibold)', fontFamily:'var(--mono)', fontSize:18, color:'var(--acc2)' }}>
            {fmt(monnaie)}
          </span>
        </div>
      )}
    </div>
  )
}
