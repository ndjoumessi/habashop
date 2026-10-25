import QRCode from 'qrcode'

/**
 * QR code en SVG inline — **jumeau front de `drawQr()`** (`apps/backend/src/lib/invoicePdf.ts`,
 * qui trace le même code en opérations vectorielles pdfkit). Les deux lisent la MÊME matrice
 * (`QRCode.create`) et appliquent les deux mêmes règles : zone de silence de 4 modules, et
 * fusion des modules noirs consécutifs.
 *
 * ⚠️ **SYNCHRONE, et c'est la raison d'être de ce module.** `QRCode.toDataURL` est
 * asynchrone ; l'attendre avant `window.open` ferait bloquer la fenêtre d'impression par le
 * navigateur — un `window.open` n'est autorisé que dans la foulée du geste de l'utilisateur.
 * `QRCode.create`, lui, rend la matrice immédiatement, donc le ticket se fabrique d'un trait.
 *
 * ⚠️ **Noir sur blanc OPAQUE, en littéral.** C'est l'exception nommée à la règle « couleurs
 * en `var(--)` » du guide : un lecteur de QR mesure un contraste, il ne résout pas de jetons
 * CSS — et un fond transparent sur papier thermique donne un code illisible.
 */

/** Zone de silence, en modules. La norme en exige 4 : sans elle, les motifs de repérage ne
 *  sont pas trouvés et le code est illisible, alors même qu'il est imprimé correctement. */
const QR_QUIET_MODULES = 4

/**
 * `size` est une longueur CSS (`'22mm'`, `'80px'`) appliquée à la boîte TOTALE — modules ET
 * zone de silence comprises, pour que l'appelant raisonne sur la place qu'il donne.
 */
export function qrSvg(text: string, size: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = modules.size
  const total = n + 2 * QR_QUIET_MODULES

  let d = ''
  for (let row = 0; row < n; row++) {
    // Fusion des modules noirs CONSÉCUTIFS en un seul segment de chemin : moins d'opérations,
    // et surtout aucune jointure entre deux carrés voisins — peints séparément, ils laissent
    // des liserés clairs d'anti-aliasing, et un scanner lit des contrastes.
    let start = -1
    for (let col = 0; col <= n; col++) {
      const on = col < n && Boolean(modules.get(row, col))
      if (on && start < 0) start = col
      if (!on && start >= 0) {
        const x = start + QR_QUIET_MODULES
        const y = row + QR_QUIET_MODULES
        const w = col - start
        d += `M${x} ${y}h${w}v1h-${w}z`
        start = -1
      }
    }
  }

  // `shape-rendering="crispEdges"` : pas de lissage sur les arêtes des modules — à
  // l'impression thermique, un module flou est un module perdu.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" `
    + `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-hidden="true">`
    + `<rect width="${total}" height="${total}" fill="#ffffff"/>`
    + `<path d="${d}" fill="#000000"/></svg>`
}
