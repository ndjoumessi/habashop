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
    // Dimension 40 mm : EAN-13 (95 mod.) + 22 quiet = 117 ; image 38 mm (marge page
    // 1 mm) → module ≈ 0,325 mm, proche du nominal GS1 0,33 (cf. MARGIN ci-dessous).
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
  // Marge de page 1 mm (et non 2) → imgW = 38 mm → module EAN-13 ≈ 0,325 mm (proche
  // du nominal GS1 0,33). Absorbe l'étalement d'encre thermique (barres élargies à
  // l'impression) qui dégrade le rapport barre/espace → lecture douchette fiable
  // du premier coup. Gabarit 40 mm conservé.
  const MARGIN = 1

  const labels = products.flatMap(p => Array(Math.max(1, options.copies)).fill(p) as ThermalProduct[])
  if (labels.length === 0) return

  labels.forEach((product, idx) => {
    if (idx > 0) doc.addPage([40, 30], 'landscape')
    let y = MARGIN + 2.5
    // Code EAN calculé une seule fois : détermine la mise en page (avec/sans).
    const png = options.showBarcode ? barcodePng(product.barcode) : null

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

    // Code-barres (image EAN), centré. (b) : sans code EAN valide, on n'imprime RIEN
    // (ni CODE128-sur-SKU, ni mention — l'étiquette est face client) → la zone est
    // repliée et le contenu remonte (cf. prix ci-dessous).
    if (png) {
      const imgW = W - MARGIN * 2
      const imgH = 11
      doc.addImage(png, 'PNG', MARGIN, y, imgW, imgH)
      y += imgH + 1
    }

    // Prix (optionnel), gras. AVEC code : ancré en bas (inchangé). SANS code : remonte
    // juste sous le contenu (étiquette de prix propre, pas de vide central), un peu plus grand.
    if (options.showPrice) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0) // NOIR explicite : thermique = monochrome de toute façon, mais
                          // on verrouille le prix en noir (jamais une teinte écran).
      doc.setFontSize(png ? 10 : 12)
      const priceY = png ? (30 - MARGIN - 0.5) : (y + 3)
      doc.text(fmt(product.price), W / 2, priceY, { align: 'center' })
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
