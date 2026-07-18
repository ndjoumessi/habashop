import JsBarcode from 'jsbarcode'
import { barcodeFormat, normalizeBarcode, quietZonePx } from '@/lib/barcode'

// ── Étiquettes THERMIQUES 40×30 mm (Chantier A, PR4) ─────────────────────────
// À l'UNITÉ (à la création/réception), en COEXISTENCE avec la planche A4 Avery
// (rattrapage en masse). Un PDF à la taille de page EXACTE (40×30 mm) s'imprime
// fidèlement via le pilote système, sans le scaling/marges par défaut d'un
// window.print() navigateur qui déforment un code à cette taille — donc aucun
// verrou constructeur (le modèle d'imprimante n'a pas besoin d'être fixé).
// jsPDF est chargé À LA DEMANDE (import dynamique) pour ne pas alourdir le bundle.

export interface ThermalLabelOptions {
  showPrice: boolean
  showSku: boolean
  showBarcode: boolean
  copies: number
  shopName: string
  lang: string
}

type ThermalProduct = { name: string; sku: string; price: number; barcode?: string; emoji?: string }

const li = (lang: string, fr: string, en: string, es: string, it: string) =>
  lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

// Rend un code-barres en PNG (data URL) via un canvas hors-écran. EAN-13/EAN-8
// selon le code canonicalisé (UPC-A hérité → EAN-13). (b) : plus de CODE128-sur-SKU
// → sans code EAN valide, retourne null (l'appelant affiche une mention non
// scannable, pas un code piège). Le SKU reste imprimé en texte via showSku.
function barcodePng(barcode: string | undefined): string | null {
  const canonical = normalizeBarcode(barcode)
  const format = canonical ? barcodeFormat(canonical) : null // EAN13 | EAN8 | null
  if (!format) return null
  try {
    const canvas = document.createElement('canvas')
    // ⚠️ Quiet zones ≥10 modules (marginLeft/Right via quietZonePx) — CRITIQUE en
    // impression (douchette caisse). width 2 → quietZonePx(2)=22 px = 11 modules.
    // Compromis dimension sur 40 mm documenté dans la PR (module ≈ 0,31 mm, > min GS1).
    JsBarcode(canvas, canonical, {
      format, width: 2, height: 60, displayValue: true, fontSize: 16,
      marginTop: 2, marginBottom: 2, marginLeft: quietZonePx(2), marginRight: quietZonePx(2),
      background: '#FFFFFF', lineColor: '#000000',
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/**
 * Génère un PDF d'étiquettes 40×30 mm (une page par étiquette = produits × copies)
 * et l'ouvre avec le dialogue d'impression (taille réelle). Barres noires/blanc.
 */
export async function printThermalLabels(
  products: ThermalProduct[],
  fmt: (amount: number) => string,
  options: ThermalLabelOptions,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  // orientation paysage + [40,30] → page 40 mm (large) × 30 mm (haut).
  const doc = new jsPDF({ unit: 'mm', format: [40, 30], orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth()
  const MARGIN = 2

  const labels = products.flatMap(p => Array(Math.max(1, options.copies)).fill(p) as ThermalProduct[])
  if (labels.length === 0) return

  labels.forEach((product, idx) => {
    if (idx > 0) doc.addPage([40, 30], 'landscape')
    let y = MARGIN + 2.5

    // Nom (tronqué pour tenir sur la largeur), gras.
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    const name = product.name.length > 26 ? product.name.slice(0, 26) + '…' : product.name
    doc.text(name, W / 2, y, { align: 'center', maxWidth: W - MARGIN * 2 })
    y += 3

    // SKU (optionnel), petit gris.
    if (options.showSku && product.sku) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5)
      doc.setTextColor(120)
      doc.text(product.sku, W / 2, y, { align: 'center' })
      doc.setTextColor(0)
      y += 2
    }

    // Code-barres (image EAN), centré. (b) : sans code EAN valide → mention non
    // scannable (pas de CODE128-sur-SKU). Le SKU reste imprimé ci-dessus via showSku.
    if (options.showBarcode) {
      const png = barcodePng(product.barcode)
      if (png) {
        const imgW = W - MARGIN * 2
        const imgH = 11
        doc.addImage(png, 'PNG', MARGIN, y, imgW, imgH)
        y += imgH + 1
      } else {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(5)
        doc.setTextColor(150)
        doc.text(li(options.lang, 'Code-barres manquant', 'Missing barcode', 'Código de barras faltante', 'Codice a barre mancante'), W / 2, y, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0)
        y += 2
      }
    }

    // Prix (optionnel), gras, en bas.
    if (options.showPrice) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(fmt(product.price), W / 2, 30 - MARGIN - 0.5, { align: 'center' })
    }
  })

  // Ouvre le PDF dans un onglet + dialogue d'impression à taille réelle.
  doc.autoPrint()
  const url = doc.output('bloburl')
  const win = window.open(url, '_blank')
  if (!win) {
    // Popup bloqué → repli : téléchargement du PDF.
    doc.save(`etiquettes-40x30-${labels.length}.pdf`)
  }
}
