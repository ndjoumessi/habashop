import { mixedSplitParts, buildWhatsAppTicket, type TicketOptions } from '@/services/whatsappTicket'

// Le reçu (WhatsApp + PDF partagent ce helper) détaille la ventilation d'un paiement mixte.

describe('mixedSplitParts', () => {
  it('liste uniquement les seaux NON nuls, avec leur libellé FR', () => {
    expect(mixedSplitParts({ cashAmount: 3000, mobileMoneyAmount: 2000, cardAmount: 0 }, 'fr'))
      .toEqual([{ label: 'Espèces', amount: 3000 }, { label: 'Mobile Money', amount: 2000 }])
  })
  it('inclut la carte et respecte la langue (en)', () => {
    expect(mixedSplitParts({ cashAmount: 0, mobileMoneyAmount: 1000, cardAmount: 4000 }, 'en'))
      .toEqual([{ label: 'Mobile Money', amount: 1000 }, { label: 'Card', amount: 4000 }])
  })
})

describe('buildWhatsAppTicket — paiement mixte', () => {
  const base: TicketOptions = {
    items: [{ productId: 'p1', name: 'Article', price: 5000, quantity: 1, emoji: '📦', stockQty: 0 }],
    total: 5000, paymentMode: 'mixed', saleId: 'sale-123456', shopName: 'Boutique',
    currency: 'XOF', lang: 'fr', fmt: (n) => `${n} F`,
    split: { cashAmount: 3000, mobileMoneyAmount: 2000, cardAmount: 0 },
  }
  it('affiche « Mixte » + le détail par méthode (texte encodé)', () => {
    const url = decodeURIComponent(buildWhatsAppTicket(base))
    expect(url).toContain('Mixte')
    expect(url).toContain('Espèces: 3000 F')
    expect(url).toContain('Mobile Money: 2000 F')
    expect(url).not.toContain('Carte: ') // seau carte nul → absent
  })
  it('paiement simple : pas de détail mixte', () => {
    const url = decodeURIComponent(buildWhatsAppTicket({ ...base, paymentMode: 'cash', split: undefined }))
    expect(url).toContain('Espèces')
    expect(url).not.toContain('Mixte')
  })
})
