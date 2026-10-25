import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Printer, MapPin, Phone, Mail, AlertCircle } from 'lucide-react'
import { publicApi } from '@/lib/api'
import type { ApiPublicInvoice } from '@/lib/apiTypes'
import { convertAmount, formatInCurrency } from '@/stores/appStore'
import { fmtDate } from '@/lib/formatDate'
import { salePaymentLabel } from '@/lib/salePaymentModes'
import LogoMark from '@/components/ui/LogoMark'

/**
 * `/f/:token` — LA FACTURE DU CLIENT, ouverte en scannant le QR code imprimé au pied du
 * PDF. Page PUBLIQUE : le client d'une boutique n'a pas de compte HabaShop (`Customer`
 * est une fiche tenue par le commerçant), le jeton signé de l'URL est tout l'accès.
 *
 * ⚠️ **Cette page n'AFFICHE que des chiffres qu'elle reçoit.** HT, TVA et TTC viennent du
 * serveur (`lib/invoiceTotals.ts`, la même fonction que le PDF) ; les recalculer ici ferait
 * deux décompositions d'un même TTC, et c'est l'écran du client qui porterait l'écart
 * (§ LE TOTAL CALCULÉ SUR CE QUI EST AFFICHÉ).
 *
 * ⚠️ **Pas de `useFormatAmount` ici** : le visiteur n'a aucune boutique active, donc aucune
 * devise d'affichage. Les montants se lisent dans la devise de la BOUTIQUE, via les
 * fonctions PURES `convertAmount` + `formatInCurrency` — convention des pages publiques.
 */

type Lang = 'fr' | 'en' | 'es' | 'it'
const i = (lang: Lang, fr: string, en: string, es: string, it: string) =>
  lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

type Quad = Readonly<Record<string, string>>

/**
 * ⚠️ `Record` exhaustif sur les statuts connus — `tsc` échoue si un statut entre dans le
 * domaine sans être décrit. Un ternaire `status === 'refunded' ? … : …` aurait peint en
 * VERT « payée » tout statut inconnu : c'est le défaut `pending_payment` de la console.
 */
const STATUTS: Record<'completed' | 'refunded', { label: Quad; bg: string; border: string; text: string }> = {
  completed: {
    label: { fr: 'Payée', en: 'Paid', es: 'Pagada', it: 'Pagata' },
    bg: 'var(--c-green-bg)', border: 'var(--c-green-border)', text: 'var(--acc2)',
  },
  refunded: {
    label: { fr: 'Remboursée', en: 'Refunded', es: 'Reembolsada', it: 'Rimborsata' },
    bg: 'var(--c-red-bg)', border: 'var(--c-red-border)', text: 'var(--danger)',
  },
}

/**
 * Statut rendu. ⚠️ `Sale.status` est une colonne `String` sans enum : une valeur inconnue
 * reste NEUTRE et VISIBLE sous son propre nom — jamais assimilée à l'état favorable.
 */
function statutRendu(status: string, lang: Lang) {
  const connu = status === 'completed' || status === 'refunded' ? STATUTS[status] : null
  if (!connu) {
    return { libelle: status || '—', bg: 'var(--card2)', border: 'var(--border2)', text: 'var(--text3)' }
  }
  return { libelle: connu.label[lang] ?? connu.label.fr, bg: connu.bg, border: connu.border, text: connu.text }
}

function Etat({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
      fontFamily: 'var(--font)', color: 'var(--text3)', fontSize: 'var(--fs-body)',
    }}>{children}</div>
  )
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>()
  // TROIS états, jamais deux : « pas encore lu » n'est pas « lu et introuvable », et une
  // erreur réseau n'est pas une facture inexistante — chacun se DIT différemment.
  const [data, setData] = useState<ApiPublicInvoice | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    if (!token) { setIntrouvable(true); setChargement(false); return }
    setChargement(true)
    publicApi.invoice(token)
      .then(res => { if (res) { setData(res); setIntrouvable(false) } else setIntrouvable(true) })
      .catch((err: unknown) => setErreur(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setChargement(false))
  }, [token])

  const lang = (data?.shop.lang as Lang) ?? 'fr'
  const devise = data?.shop.currency ?? 'XOF'
  // Montants en base XOF → devise de la boutique. Jamais de formatage manuel.
  const m = (xof: number) => formatInCurrency(convertAmount(xof, 'XOF', devise), devise)

  useEffect(() => {
    if (!data) return
    document.title = `${data.shop.name} — ${i(lang, 'Facture', 'Invoice', 'Factura', 'Fattura')} ${data.invoiceNumber}`
  }, [data, lang])

  // ⚠️ Avant la réponse, la langue de la boutique est INCONNUE : ces trois états se
  // rendent donc en français, la langue du marché principal, et pas dans une langue
  // qu'on aurait devinée. Ils n'affirment rien sur la facture — ni qu'elle existe, ni
  // qu'elle n'existe pas.
  if (chargement) {
    return <Etat>Chargement de votre facture…</Etat>
  }

  if (erreur) {
    return (
      <Etat>
        <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
        <div style={{ color: 'var(--text)', fontWeight: 'var(--fw-semibold)' }}>
          Impossible de charger la facture
        </div>
        {/* Un défaut réseau DIT qu'il est un défaut réseau : il n'affirme pas que la
            facture n'existe pas, et il n'invite pas à un réessai qui ne peut pas aboutir
            sans connexion. */}
        <div>Vérifiez votre connexion, puis rechargez la page.</div>
      </Etat>
    )
  }

  if (introuvable || !data) {
    return (
      <Etat>
        <FileText size={28} style={{ color: 'var(--text3)' }} />
        <div style={{ color: 'var(--text)', fontWeight: 'var(--fw-semibold)' }}>Facture introuvable</div>
        {/* L'état vide DIT pourquoi il est vide — les trois causes réelles, sans en
            privilégier une qu'on ne peut pas distinguer (le serveur ne le dit pas, et
            c'est volontaire : un code par cause renseignerait un attaquant). */}
        <div style={{ maxWidth: 420, lineHeight: 1.55 }}>
          Ce lien est incomplet, a été modifié, ou la boutique ne publie plus cette facture.
          Votre exemplaire papier reste votre justificatif — demandez un nouveau lien à la boutique.
        </div>
      </Etat>
    )
  }

  const st = statutRendu(data.status, lang)
  const legal = [
    data.shop.ninea ? `NINEA ${data.shop.ninea}` : null,
    data.shop.rccm ? `RC ${data.shop.rccm}` : null,
    data.shop.vatNumber ? `${i(lang, 'N° TVA', 'VAT no.', 'N.º IVA', 'P. IVA')} ${data.shop.vatNumber}` : null,
  ].filter(Boolean) as string[]

  // Ventilation du paiement mixte : une ligne par mode RÉELLEMENT utilisé. Les ventes
  // antérieures au split portent `null` → aucune ligne, et le mode seul suffit.
  const ventilation = data.paymentMode === 'mixed'
    ? ([
      [i(lang, 'Espèces', 'Cash', 'Efectivo', 'Contanti'), data.cashAmount],
      ['Mobile Money', data.mobileMoneyAmount],
      [i(lang, 'Carte', 'Card', 'Tarjeta', 'Carta'), data.cardAmount],
    ] as const).filter(([, v]) => (v ?? 0) > 0)
    : []

  const ligneTotal = (label: string, valeur: string, fort = false) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0',
      fontSize: fort ? 'var(--fs-md)' : 'var(--fs-sm)',
      fontWeight: fort ? 'var(--fw-bold)' : 'var(--fw-regular)',
      color: fort ? 'var(--text)' : 'var(--text2)',
      borderTop: fort ? '2px solid var(--p)' : undefined,
      marginTop: fort ? 6 : undefined,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', color: fort ? 'var(--p)' : 'var(--text)' }}>{valeur}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font)', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* ── En-tête boutique ── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <LogoMark size={42} />
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
              {data.shop.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', marginTop: 4, fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
              {data.shop.address && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} /> {data.shop.address}
                </span>
              )}
              {data.shop.phone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={12} /> {data.shop.phone}
                </span>
              )}
              {data.shop.email && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Mail size={12} /> {data.shop.email}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--p)', letterSpacing: 1 }}>
              {i(lang, 'FACTURE', 'INVOICE', 'FACTURA', 'FATTURA')}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginTop: 2 }}>
              N° {data.invoiceNumber}
            </div>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginTop: 2 }}>
              {i(lang, 'Date', 'Date', 'Fecha', 'Data')} : {fmtDate(data.date)}
            </div>
          </div>
        </div>

        {/* ── Destinataire + statut ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap', marginBottom: 16,
        }}>
          {/* Vente de passage : aucun bloc destinataire — jamais un « — » nu sur une pièce
              comptable (même règle que le PDF, qui masque le bloc entier). */}
          {data.customerName ? (
            <div>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', letterSpacing: .8, textTransform: 'uppercase', color: 'var(--text3)' }}>
                {i(lang, 'Facturé à', 'Billed to', 'Facturado a', 'Fatturato a')}
              </div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginTop: 3 }}>
                {data.customerName}
              </div>
            </div>
          ) : <div />}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: st.bg, border: `1px solid ${st.border}`, color: st.text,
            borderRadius: 'var(--r-full)', padding: '5px 13px',
            fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 'var(--r-full)', background: 'currentColor' }} />
            {st.libelle}
          </div>
        </div>

        {/* ── Lignes ── */}
        <div style={{ background: 'var(--grad-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '4px 16px 14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
            <thead>
              <tr>
                {[
                  i(lang, 'Article', 'Item', 'Artículo', 'Articolo'),
                  i(lang, 'Qté', 'Qty', 'Cant.', 'Qtà'),
                  i(lang, 'PU', 'Unit price', 'Precio unit.', 'Prezzo unit.'),
                  i(lang, 'Total', 'Total', 'Total', 'Totale'),
                ].map((h, idx) => (
                  <th key={h} style={{
                    textAlign: idx === 0 ? 'left' : idx === 1 ? 'center' : 'right',
                    padding: '11px 8px', borderBottom: '2px solid var(--p)',
                    color: 'var(--p)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
                    textTransform: 'uppercase', letterSpacing: .6, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: 'var(--fs-sm)' }}>
                    {/* Produit supprimé depuis la vente → la ligne reste, et le dit. */}
                    {it.name ?? i(lang, 'Article retiré du catalogue', 'Item removed from catalog', 'Artículo retirado del catálogo', 'Articolo rimosso dal catalogo')}
                  </td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center', color: 'var(--text2)', fontSize: 'var(--fs-sm)' }}>{it.qty}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)' }}>{m(it.unitPrice)}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>{m(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totaux ── */}
        <div style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 18 }}>
          {data.discountAmount > 0 && ligneTotal(i(lang, 'Remise', 'Discount', 'Descuento', 'Sconto'), `- ${m(data.discountAmount)}`)}
          {/* HT et TVA ne s'affichent que si la boutique applique un taux : sinon ce serait
              deux lignes égales au total, qui donnent l'air d'une taxe à zéro. */}
          {data.vatAmount > 0 && (
            <>
              {ligneTotal(i(lang, 'Sous-total HT', 'Subtotal', 'Subtotal', 'Imponibile'), m(data.subtotalHT))}
              {ligneTotal(`${i(lang, 'TVA', 'VAT', 'IVA', 'IVA')} (${data.shop.vatRate}%)`, m(data.vatAmount))}
            </>
          )}
          {ligneTotal(i(lang, 'Total TTC', 'Total', 'Total', 'Totale'), m(data.total), true)}
        </div>

        {/* ── Paiement ── */}
        <div style={{ marginTop: 20, fontSize: 'var(--fs-sm)', color: 'var(--text2)' }}>
          <div>
            {i(lang, 'Mode de paiement', 'Payment method', 'Método de pago', 'Metodo di pagamento')} :{' '}
            <strong style={{ color: 'var(--text)' }}>{salePaymentLabel(data.paymentMode, lang)}</strong>
          </div>
          {ventilation.map(([label, valeur]) => (
            <div key={label} style={{ marginTop: 4, paddingLeft: 12, color: 'var(--text3)' }}>
              • {label} : <span style={{ fontFamily: 'var(--mono)' }}>{m(valeur as number)}</span>
            </div>
          ))}
        </div>

        {/* ── Pied ── */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', lineHeight: 1.6 }}>
            {legal.length > 0 && <div>{data.shop.name} · {legal.join(' · ')}</div>}
            <div>{i(lang, 'Merci de votre confiance', 'Thank you for your business', 'Gracias por su confianza', 'Grazie per la fiducia')}</div>
          </div>
          {/* CTA JAMAIS désactivé par une validation : il n'y a rien à remplir ici, et un
              bouton éteint ne dirait pas ce qui manque (§ landingClaims). */}
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
              background: 'var(--card2)', color: 'var(--text)',
              border: '1px solid var(--border2)', borderRadius: 'var(--r-md)',
              padding: '9px 16px', minHeight: 'var(--touch-min)',
              fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)',
              transition: 'background .15s ease, border-color .15s ease',
            }}
          >
            <Printer size={15} /> {i(lang, 'Imprimer', 'Print', 'Imprimir', 'Stampa')}
          </button>
        </div>
      </div>
    </div>
  )
}
