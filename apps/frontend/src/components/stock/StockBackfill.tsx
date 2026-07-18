import { lazy, Suspense, useState } from 'react'
import { X, Wand2, Camera, Check, Tag, AlertTriangle } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { normalizeBarcode, isValidBarcode, generateEAN13 } from '@/lib/barcode'
import type { ProductItem } from '@/components/stock/stockShared'

const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))

interface StockBackfillProps {
  products: ProductItem[]           // produits SANS code-barres valide
  lang: string
  onClose: () => void
  // Enregistre les codes saisis puis (optionnellement) ouvre la planche A4.
  onSave: (entries: { sku: string; barcode: string }[], print: boolean) => Promise<void> | void
  saving?: boolean
}

// Rattrapage guidé (Chantier A PR5) : « scanner d'abord, générer en second recours »
// appliqué en masse aux produits sans code. On complète, on enregistre, puis on
// imprime la planche A4 Avery (rattrapage en masse — coexiste avec le thermique unité).
export default function StockBackfill({ products, lang, onClose, onSave, saving }: StockBackfillProps) {
  const boxRef = useModalFocus<HTMLDivElement>()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  // Brouillon par SKU (vide = pas encore renseigné).
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [scanningSku, setScanningSku] = useState<string | null>(null)

  const setDraft = (sku: string, v: string) => setDrafts(d => ({ ...d, [sku]: v }))
  const genOne = (sku: string) => setDraft(sku, generateEAN13())
  const genAllEmpty = () => setDrafts(d => {
    const next = { ...d }
    for (const p of products) if (!next[p.sku]?.trim()) next[p.sku] = generateEAN13()
    return next
  })

  // Entrées valides (code canonique EAN-13/EAN-8) prêtes à enregistrer.
  const validEntries = products
    .map(p => ({ sku: p.sku, barcode: normalizeBarcode(drafts[p.sku] ?? '') }))
    .filter(e => e.barcode && isValidBarcode(e.barcode))
  const anyInvalid = products.some(p => {
    const raw = drafts[p.sku]
    return !!raw?.trim() && !isValidBarcode(normalizeBarcode(raw))
  })

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={i('Compléter les codes-barres manquants', 'Complete missing barcodes', 'Completar códigos de barras faltantes', 'Completa i codici a barre mancanti')}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={14} /> {i('Codes-barres manquants', 'Missing barcodes', 'Códigos faltantes', 'Codici mancanti')}
            <span style={{ color: 'var(--text3)', fontWeight: 'var(--fw-regular)' }}>({products.length})</span>
          </h3>
          <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={onClose}><X size={14} /></button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.4 }}>
          {i(
            'Scannez le code fabricant de chaque produit (recommandé) ou générez un code interne. Puis enregistrez et imprimez la planche d\'étiquettes.',
            'Scan each product\'s manufacturer code (recommended) or generate an internal one. Then save and print the label sheet.',
            'Escanee el código del fabricante de cada producto (recomendado) o genere uno interno. Luego guarde e imprima la hoja de etiquetas.',
            'Scansiona il codice produttore di ogni prodotto (consigliato) o generane uno interno. Poi salva e stampa il foglio di etichette.',
          )}
        </p>

        {products.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <Check size={22} style={{ color: 'var(--acc2)' }} /><br />
            {i('Tous les produits ont un code-barres.', 'All products have a barcode.', 'Todos los productos tienen código.', 'Tutti i prodotti hanno un codice.')}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" className="mini-btn" onClick={genAllEmpty}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wand2 size={13} /> {i('Tout générer (interne)', 'Generate all (internal)', 'Generar todo (interno)', 'Genera tutto (interno)')}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>
                {validEntries.length}/{products.length} {i('prêts', 'ready', 'listos', 'pronti')}
              </span>
            </div>

            <div style={{ overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 6, flex: 1 }}>
              {products.map(p => {
                const raw = drafts[p.sku] ?? ''
                const canonical = normalizeBarcode(raw)
                const invalid = !!raw.trim() && !isValidBarcode(canonical)
                const ok = !!canonical && isValidBarcode(canonical)
                return (
                  <div key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 16 }}>{p.name.match(/^\S+/)?.[0] ?? '📦'}</span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name.replace(/^\S+\s?/, '')}
                    </span>
                    <input className="input text-sm" style={{ width: 150, borderColor: invalid ? 'var(--danger)' : ok ? 'var(--acc2)' : undefined }}
                      placeholder={i('EAN-13 / EAN-8…', 'EAN-13 / EAN-8…', 'EAN-13 / EAN-8…', 'EAN-13 / EAN-8…')}
                      value={raw} onChange={e => setDraft(p.sku, e.target.value)}
                      aria-label={`${i('Code-barres', 'Barcode', 'Código', 'Codice')} ${p.name}`} />
                    <button type="button" className="mini-btn" title={i('Scanner', 'Scan', 'Escanear', 'Scansiona')}
                      aria-label={`${i('Scanner', 'Scan', 'Escanear', 'Scansiona')} ${p.name}`}
                      onClick={() => setScanningSku(p.sku)} style={{ padding: '6px 8px' }}><Camera size={15} /></button>
                    <button type="button" className="mini-btn" title={i('Générer', 'Generate', 'Generar', 'Genera')}
                      aria-label={`${i('Générer', 'Generate', 'Generar', 'Genera')} ${p.name}`}
                      onClick={() => genOne(p.sku)} style={{ padding: '6px 8px' }}><Wand2 size={15} /></button>
                    {ok && <Check size={15} style={{ color: 'var(--acc2)', flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>

            {anyInvalid && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warn)' }}>
                <AlertTriangle size={14} /> {i('Certains codes sont invalides (non enregistrés).', 'Some codes are invalid (not saved).', 'Algunos códigos son inválidos (no guardados).', 'Alcuni codici non sono validi (non salvati).')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary flex-1 justify-center" style={{ minHeight: 44 }}
                disabled={validEntries.length === 0 || saving}
                onClick={() => onSave(validEntries, true)}>
                {saving
                  ? i('Enregistrement…', 'Saving…', 'Guardando…', 'Salvataggio…')
                  : `${i('Enregistrer', 'Save', 'Guardar', 'Salva')} + ${i('planche A4', 'A4 sheet', 'hoja A4', 'foglio A4')} (${validEntries.length})`}
              </button>
              <button className="btn btn-ghost" style={{ minHeight: 44 }}
                disabled={validEntries.length === 0 || saving}
                onClick={() => onSave(validEntries, false)}>
                {i('Enregistrer seulement', 'Save only', 'Solo guardar', 'Solo salva')}
              </button>
            </div>
          </>
        )}
      </div>

      {scanningSku && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onScan={code => { setDraft(scanningSku, normalizeBarcode(code)); setScanningSku(null) }}
            onClose={() => setScanningSku(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
