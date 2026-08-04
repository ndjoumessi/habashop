import { lazy, Suspense, useState } from 'react'
import { X, Wand2, Camera, Check, Tag, AlertTriangle } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { normalizeBarcode, isValidBarcode, generateEAN13 } from '@/lib/barcode'
import { confirm } from '@/lib/confirm'
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

// Rattrapage guidé (Chantier A PR5). Principe du chantier : SCANNER LE CODE
// FABRICANT est l'action principale (produits traités un par un, emballage en
// main). La génération d'un code INTERNE est un second recours RÉSERVÉ AU VRAC
// (produits sans code fabricant) → sélection explicite + confirmation nommée,
// jamais « tout générer » (coller une étiquette interne sur un produit qui a
// déjà un code fabricant = le geste qu'on veut éviter).
export default function StockBackfill({ products, lang, onClose, onSave, saving }: StockBackfillProps) {
  const boxRef = useModalFocus<HTMLDivElement>()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  const [drafts, setDrafts] = useState<Record<string, string>>({})  // code par SKU
  const [selected, setSelected] = useState<Set<string>>(new Set())  // SKUs cochés pour génération VRAC
  const [scanningSku, setScanningSku] = useState<string | null>(null)

  const setDraft = (sku: string, v: string) => setDrafts(d => ({ ...d, [sku]: v }))
  const toggle = (sku: string) => setSelected(s => {
    const n = new Set(s); n.has(sku) ? n.delete(sku) : n.add(sku); return n
  })

  // Génération INTERNE réservée au vrac : uniquement les produits cochés, avec
  // confirmation nommant le nombre. N'écrase pas un code déjà saisi/scanné.
  const genSelectedInternal = async () => {
    const targets = products.filter(p => selected.has(p.sku) && !drafts[p.sku]?.trim())
    if (targets.length === 0) return
    const msg = i(
      `Générer un code interne pour ${targets.length} produit(s) sélectionné(s) ?\n\nÀ RÉSERVER aux produits vendus en vrac, sans code fabricant sur l'emballage.`,
      `Generate an internal code for ${targets.length} selected product(s)?\n\nRESERVE this for bulk products without a manufacturer code on the packaging.`,
      `¿Generar un código interno para ${targets.length} producto(s) seleccionado(s)?\n\nRESERVAR para productos a granel sin código del fabricante en el envase.`,
      `Generare un codice interno per ${targets.length} prodotto(i) selezionato(i)?\n\nRISERVARE ai prodotti sfusi senza codice produttore sulla confezione.`,
    )
    if (!(await confirm({ title: i('Générer un code interne', 'Generate an internal code', 'Generar un código interno', 'Genera un codice interno'), message: msg }))) return
    setDrafts(d => {
      const next = { ...d }
      for (const p of targets) next[p.sku] = generateEAN13()
      return next
    })
  }

  const validEntries = products
    .map(p => ({ sku: p.sku, barcode: normalizeBarcode(drafts[p.sku] ?? '') }))
    .filter(e => e.barcode && isValidBarcode(e.barcode))
  const anyInvalid = products.some(p => {
    const raw = drafts[p.sku]
    return !!raw?.trim() && !isValidBarcode(normalizeBarcode(raw))
  })
  const selectableForGen = products.filter(p => selected.has(p.sku) && !drafts[p.sku]?.trim()).length

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={i('Compléter les codes-barres manquants', 'Complete missing barcodes', 'Completar códigos de barras faltantes', 'Completa i codici a barre mancanti')}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={14} /> {i('Codes-barres manquants', 'Missing barcodes', 'Códigos faltantes', 'Codici mancanti')}
            <span style={{ color: 'var(--text3)', fontWeight: 'var(--fw-regular)' }}>({products.length})</span>
          </h3>
          <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={onClose}><X size={14} /></button>
        </div>

        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginBottom: 12, lineHeight: 1.4 }}>
          {i(
            'Scannez le code fabricant sur l\'emballage de chaque produit. Réservez le code interne aux produits vendus en vrac (cochez-les puis « Générer »).',
            'Scan the manufacturer code on each product\'s packaging. Reserve the internal code for bulk products (tick them, then "Generate").',
            'Escanee el código del fabricante en el envase de cada producto. Reserve el código interno para productos a granel (márquelos y «Generar»).',
            'Scansiona il codice produttore sulla confezione di ogni prodotto. Riserva il codice interno ai prodotti sfusi (selezionali, poi «Genera»).',
          )}
        </p>

        {products.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
            <Check size={22} style={{ color: 'var(--acc2)' }} /><br />
            {i('Tous les produits ont un code-barres.', 'All products have a barcode.', 'Todos los productos tienen código.', 'Tutti i prodotti hanno un codice.')}
          </div>
        ) : (
          <>
            {/* Action VRAC : génération interne sur la sélection explicite uniquement. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="mini-btn" onClick={genSelectedInternal}
                disabled={selectableForGen === 0}
                title={i('Réservé aux produits vendus en vrac (sans code fabricant)', 'For bulk products only (no manufacturer code)', 'Solo para productos a granel (sin código del fabricante)', 'Solo per prodotti sfusi (senza codice produttore)')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wand2 size={13} /> {i('Générer un code interne (vrac)', 'Generate internal code (bulk)', 'Generar código interno (granel)', 'Genera codice interno (sfuso)')}
                {selectableForGen > 0 ? ` — ${selectableForGen}` : ''}
              </button>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
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
                    <input type="checkbox" checked={selected.has(p.sku)} onChange={() => toggle(p.sku)}
                      aria-label={`${i('Vrac', 'Bulk', 'Granel', 'Sfuso')} ${p.name}`}
                      style={{ accentColor: 'var(--p)', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--fs-md)' }}>{p.name.match(/^\S+/)?.[0] ?? '📦'}</span>
                    <span style={{ flex: 1, fontSize: 'var(--fs-label)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name.replace(/^\S+\s?/, '')}
                    </span>
                    <input className="input text-sm" style={{ width: 140, borderColor: invalid ? 'var(--danger)' : ok ? 'var(--acc2)' : undefined }}
                      placeholder={i('EAN-13 / EAN-8…', 'EAN-13 / EAN-8…', 'EAN-13 / EAN-8…', 'EAN-13 / EAN-8…')}
                      value={raw} onChange={e => setDraft(p.sku, e.target.value)}
                      aria-label={`${i('Code-barres', 'Barcode', 'Código', 'Codice')} ${p.name}`} />
                    {/* Scan = action PRINCIPALE (bouton accentué). */}
                    <button type="button" title={i('Scanner l\'emballage', 'Scan packaging', 'Escanear envase', 'Scansiona confezione')}
                      aria-label={`${i('Scanner', 'Scan', 'Escanear', 'Scansiona')} ${p.name}`}
                      onClick={() => setScanningSku(p.sku)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', flexShrink: 0,
                        background: 'var(--p2)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                        fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)' }}>
                      <Camera size={14} /> {i('Scanner', 'Scan', 'Escanear', 'Scansiona')}
                    </button>
                    {ok && <Check size={15} style={{ color: 'var(--acc2)', flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>

            {anyInvalid && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-label)', color: 'var(--warn)' }}>
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
