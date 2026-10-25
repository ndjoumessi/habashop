import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * ⚠️ PREUVE COMPORTEMENTALE sur le DOM RENDU — `/f/:token`, la facture que le client ouvre
 * en scannant le QR code du pied de page.
 *
 * `@/stores/appStore` n'est **PAS mocké** : la conversion de devise réelle s'applique, donc
 * un montant servi en base XOF et affiché dans la devise de la boutique est vérifié pour ce
 * qu'il vaut. Mocker le formateur rendrait le test vert sans rien prouver.
 */

const { invoice } = vi.hoisted(() => ({ invoice: vi.fn() }))
vi.mock('@/lib/api', () => ({ publicApi: { invoice } }))

import PublicInvoice from '@/pages/PublicInvoice'

/** Réponse de référence. `subtotalHT`/`vatAmount` viennent du SERVEUR. */
const FACTURE = {
  invoiceNumber: 'FAC-2026-00042',
  date: '2026-07-18T10:00:00Z',
  status: 'completed',
  paymentMode: 'cash',
  total: 5900,
  subtotalHT: 5000,
  vatAmount: 900,
  discountAmount: 0,
  cashAmount: 5900, mobileMoneyAmount: null, cardAmount: null,
  items: [{ name: 'Bifaka', qty: 2, unitPrice: 2950, total: 5900 }],
  customerName: 'Awa Diop',
  shop: {
    name: 'Ma Boutique', address: 'Dakar', phone: '+221 33 800 00 00', email: 'contact@boutique.test',
    currency: 'XOF', vatRate: 18, lang: 'fr', ninea: '001234567', rccm: null, vatNumber: null,
  },
}

function monter(token = 'vente~AbCdEfGhIjKlMnOp') {
  return render(
    <MemoryRouter initialEntries={[`/f/${token}`]}>
      <Routes><Route path="/f/:token" element={<PublicInvoice />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { vi.clearAllMocks(); invoice.mockResolvedValue(FACTURE) })

describe('PublicInvoice — la facture s’affiche', () => {
  it('numéro, date, destinataire, ligne et total', async () => {
    monter()
    expect(await screen.findByText('N° FAC-2026-00042')).toBeTruthy()
    expect(screen.getByText(/18\/07\/2026/)).toBeTruthy()
    expect(screen.getByText('Awa Diop')).toBeTruthy()
    expect(screen.getByText('Bifaka')).toBeTruthy()
    expect(screen.getByText('Payée')).toBeTruthy()
  })

  it('le jeton de l’URL est celui qui part à l’API', async () => {
    monter('jeton-precis.ZZZZ')
    await waitFor(() => expect(invoice).toHaveBeenCalledWith('jeton-precis.ZZZZ'))
  })

  it('⚠️ la page AFFICHE le HT/TVA du serveur — elle ne les recalcule pas', async () => {
    // Décomposition volontairement INCOHÉRENTE avec `total / (1 + 18/100)` : si la page
    // refaisait le calcul, elle afficherait 5 000 / 900 et ce test rougirait. C'est le
    // seul moyen de distinguer « affiche » de « recalcule » — à valeurs cohérentes, les
    // deux comportements rendent le même écran.
    invoice.mockResolvedValue({ ...FACTURE, subtotalHT: 4321, vatAmount: 1579 })
    monter()
    expect(await screen.findByText(/4\s*321/)).toBeTruthy()
    expect(screen.getByText(/1\s*579/)).toBeTruthy()
  })

  it('devise de la BOUTIQUE : un total en base XOF s’affiche en euros si la boutique est en EUR', async () => {
    invoice.mockResolvedValue({ ...FACTURE, shop: { ...FACTURE.shop, currency: 'EUR' } })
    monter()
    // 5 900 XOF ÷ 655,957 ≈ 8,99 € — la conversion réelle d'appStore, non mockée.
    // `findAll` : le montant paraît DEUX fois (total de ligne et Total TTC), et c'est
    // normal — une seule occurrence attendue ferait rougir le test pour la mauvaise raison.
    const euros = await screen.findAllByText(/8,99\s*€/)
    expect(euros.length).toBeGreaterThan(0)
    // Et le montant brut en FCFA n'apparaît nulle part : pas de double affichage.
    expect(screen.queryByText(/5\s*900\s*FCFA/)).toBeNull()
  })

  it('TVA nulle → aucune ligne HT ni TVA (deux lignes égales au total mentiraient)', async () => {
    invoice.mockResolvedValue({ ...FACTURE, subtotalHT: 5900, vatAmount: 0, shop: { ...FACTURE.shop, vatRate: 0 } })
    monter()
    expect(await screen.findByText('N° FAC-2026-00042')).toBeTruthy()
    expect(screen.queryByText(/Sous-total HT/)).toBeNull()
    expect(screen.queryByText(/^TVA/)).toBeNull()
  })

  it('paiement mixte → une ligne par mode réellement utilisé, et aucune à zéro', async () => {
    invoice.mockResolvedValue({ ...FACTURE, paymentMode: 'mixed', cashAmount: 3900, mobileMoneyAmount: 2000, cardAmount: 0 })
    monter()
    expect(await screen.findByText(/Espèces/)).toBeTruthy()
    expect(screen.getByText(/Mobile Money/)).toBeTruthy()
    expect(screen.queryByText(/Carte/)).toBeNull()
  })
})

describe('PublicInvoice — « Reçu » ou « Facture », dérivé du numéro', () => {
  /**
   * ⚠️ Le mot vient du CHAMP, pas d'un second champ qui dirait la même chose autrement.
   * Une vente encaissée au comptoir n'a pas de numéro tant que personne n'a généré le PDF :
   * l'appeler « Facture » promettrait une pièce qui n'a pas été émise.
   */
  it('⚠️ sans numéro → « REÇU », et AUCUNE ligne « N° »', async () => {
    invoice.mockResolvedValue({ ...FACTURE, invoiceNumber: null })
    monter()
    expect(await screen.findByText('REÇU')).toBeTruthy()
    expect(screen.queryByText('FACTURE')).toBeNull()
    expect(screen.queryByText(/^N°/)).toBeNull()
  })

  it('avec numéro → « FACTURE » et la ligne « N° »', async () => {
    monter()
    expect(await screen.findByText('FACTURE')).toBeTruthy()
    expect(screen.getByText('N° FAC-2026-00042')).toBeTruthy()
    expect(screen.queryByText('REÇU')).toBeNull()
  })

  it('le destinataire se dit « Client » sur un reçu, « Facturé à » sur une facture', async () => {
    invoice.mockResolvedValue({ ...FACTURE, invoiceNumber: null })
    const vue = monter()
    expect(await screen.findByText('Client')).toBeTruthy()
    expect(screen.queryByText(/Facturé à/)).toBeNull()
    vue.unmount()
    invoice.mockResolvedValue(FACTURE)
    monter()
    expect(await screen.findByText(/Facturé à/)).toBeTruthy()
  })

  it.each([
    ['en', 'RECEIPT'],
    ['es', 'RECIBO'],
    ['it', 'RICEVUTA'],
  ])('sans numéro, lang=%s → « %s »', async (lang, attendu) => {
    invoice.mockResolvedValue({ ...FACTURE, invoiceNumber: null, shop: { ...FACTURE.shop, lang } })
    monter()
    expect(await screen.findByText(attendu)).toBeTruthy()
  })
})

describe('PublicInvoice — statuts', () => {
  it('remboursée → « Remboursée », JAMAIS « Payée »', async () => {
    invoice.mockResolvedValue({ ...FACTURE, status: 'refunded' })
    monter()
    expect(await screen.findByText('Remboursée')).toBeTruthy()
    expect(screen.queryByText('Payée')).toBeNull()
  })

  it('⚠️ statut INCONNU → rendu tel quel et neutre, jamais assimilé à « Payée »', async () => {
    invoice.mockResolvedValue({ ...FACTURE, status: 'pending_payment' })
    monter()
    expect(await screen.findByText('pending_payment')).toBeTruthy()
    expect(screen.queryByText('Payée')).toBeNull()
    expect(screen.queryByText('Remboursée')).toBeNull()
  })
})

describe('PublicInvoice — trois états, jamais deux', () => {
  it('404 → « Document introuvable » (mot NEUTRE : on ignore ce que le lien visait), et AUCUN contenu', async () => {
    invoice.mockResolvedValue(null)
    monter()
    expect(await screen.findByText('Document introuvable')).toBeTruthy()
    expect(screen.queryByText('Bifaka')).toBeNull()
    expect(screen.queryByText(/FAC-2026/)).toBeNull()
  })

  it('⚠️ panne réseau → la page DIT une panne, elle n’affirme pas que la facture n’existe pas', async () => {
    invoice.mockRejectedValue(new Error('Failed to fetch'))
    monter()
    expect(await screen.findByText(/Impossible de charger le document/)).toBeTruthy()
    expect(screen.queryByText('Document introuvable')).toBeNull()
  })

  it('vente de passage → aucun bloc « Facturé à » (jamais un tiret nu sur une pièce comptable)', async () => {
    invoice.mockResolvedValue({ ...FACTURE, customerName: null })
    monter()
    expect(await screen.findByText('N° FAC-2026-00042')).toBeTruthy()
    expect(screen.queryByText(/Facturé à/)).toBeNull()
  })

  it('produit supprimé depuis la vente → la ligne reste et le DIT', async () => {
    invoice.mockResolvedValue({ ...FACTURE, items: [{ name: null, qty: 1, unitPrice: 5900, total: 5900 }] })
    monter()
    expect(await screen.findByText('Article retiré du catalogue')).toBeTruthy()
  })
})

describe('PublicInvoice — traduction', () => {
  it.each([
    ['en', 'INVOICE', 'Paid'],
    ['es', 'FACTURA', 'Pagada'],
    ['it', 'FATTURA', 'Pagata'],
  ])('lang=%s de la boutique → « %s » / « %s »', async (lang, titre, statut) => {
    invoice.mockResolvedValue({ ...FACTURE, shop: { ...FACTURE.shop, lang } })
    monter()
    expect(await screen.findByText(titre)).toBeTruthy()
    expect(screen.getByText(statut)).toBeTruthy()
  })
})
