/* ⚠️ jest, PAS vitest : `expect(x, 'message')` lève « Expect takes at most one argument ».
   Le contexte va dans le NOM du cas, pas dans l'assertion. */
import {
  PAYMENT_MODES, paymentModeLabel, paymentModeLabelWithEmoji, isPaymentMode,
} from '@/lib/paymentLabel'
import {
  TENANT_STATUSES, statusLabel, statusTone, statusColor, isTenantStatus,
} from '@/lib/tenantStatus'
import { DarkColors } from '@/constants/theme'

/**
 * Deux domaines sortis d'un ternaire binaire vers un Record exhaustif.
 *
 * ⚠️ CE N'EST PAS UN SCANNER D'ARITÉ, et c'est délibéré : sur 1 268 chaînes de ternaires
 * mesurées dans le dépôt, 1 211 sont correctes. Un scanner passerait son temps à crier au
 * loup, et la seule liaison qu'il puisse faire à bas coût — par nom de variable — s'est
 * révélée FAUSSE à la mesure (`e.status`, statut de dépense, pris pour un statut de
 * tenant ; `alert.level` pris pour `priceGapLevel`).
 *
 * Ce qui protège ici, c'est le `Record<Domaine, …>` : `tsc` échoue si une valeur est
 * ajoutée au domaine sans être décrite. Ces tests couvrent ce que le compilateur ne voit
 * pas — les deux entrées viennent d'une colonne `String`, donc une valeur INCONNUE est
 * possible, et c'est elle qui décidait autrefois du mensonge.
 */

const LANGS = ['fr', 'en', 'es', 'it'] as const

describe('modes de paiement — le Record couvre les cinq modes SERVEUR', () => {
  it('le domaine contient bien les cinq modes du serveur, plus le mixte', () => {
    expect([...PAYMENT_MODES]).toEqual(['cash', 'wave', 'orange', 'mtn', 'card', 'mixed'])
  })

  it.each([...PAYMENT_MODES])('%s rend un libellé non vide dans les 4 langues', (mode) => {
    for (const lang of LANGS) {
      expect(paymentModeLabel(mode, lang)).toBeTruthy()
    }
  })

  /**
   * ⚠️ LE DÉFAUT D'ORIGINE, en un test. Le ternaire à trois branches faisait tomber `mtn`
   * dans « Carte » — sur le reçu remis à l'acheteur. Chemin mesuré : une vente encaissée
   * en MTN depuis la caisse WEB, réimprimée depuis l'historique mobile.
   */
  it('MTN MoMo n’est JAMAIS étiqueté « Carte » (le défaut d’origine)', () => {
    for (const lang of LANGS) {
      const mtn = paymentModeLabel('mtn', lang)
      expect(mtn).toBe('MTN MoMo')
      expect(mtn).not.toBe(paymentModeLabel('card', lang))
    }
  })

  it('les marques ne sont PAS traduites, les autres le sont', () => {
    for (const brand of ['wave', 'orange', 'mtn']) {
      const rendus = new Set(LANGS.map(l => paymentModeLabel(brand, l)))
      expect(rendus.size).toBe(1)
    }
    for (const traduit of ['cash', 'card', 'mixed']) {
      const rendus = new Set(LANGS.map(l => paymentModeLabel(traduit, l)))
      expect(rendus.size).toBeGreaterThan(1)
    }
  })

  it('chaque mode a un libellé DISTINCT (aucun ne se confond avec un autre)', () => {
    for (const lang of LANGS) {
      const labels = PAYMENT_MODES.map(m => paymentModeLabel(m, lang))
      expect(new Set(labels).size).toBe(PAYMENT_MODES.length)
    }
  })

  it('un mode INCONNU est rendu tel quel, jamais assimilé à un mode connu', () => {
    expect(isPaymentMode('paypal')).toBe(false)
    expect(paymentModeLabel('paypal', 'fr')).toBe('Paypal')
    expect(paymentModeLabel('paypal', 'fr')).not.toBe(paymentModeLabel('card', 'fr'))
    expect(paymentModeLabel('', 'fr')).toBe('—')
  })

  it('le reçu WhatsApp porte le pictogramme, le reçu IMPRIMÉ non', () => {
    expect(paymentModeLabelWithEmoji('mtn', 'fr')).toBe('📱 MTN MoMo')
    expect(paymentModeLabel('mtn', 'fr')).toBe('MTN MoMo')
    // Espèces et Mixte n'ont pas de pictogramme : les deux reçus coïncident.
    expect(paymentModeLabelWithEmoji('cash', 'fr')).toBe(paymentModeLabel('cash', 'fr'))
  })
})

describe('statut de boutique — le Record couvre les cinq statuts', () => {
  it('le domaine est celui du backend', () => {
    expect([...TENANT_STATUSES]).toEqual(['trial', 'active', 'pending_payment', 'suspended', 'cancelled'])
  })

  /**
   * ⚠️ LE DÉFAUT D'ORIGINE. `pending_payment` est l'état de TOUT futur client payant : la
   * voie d'abonnement est manuelle, elle crée une `PlanRequest` et laisse le tenant là
   * jusqu'à l'activation. Il voyait un badge VERT « PENDING_PAYMENT ».
   */
  it('SEUL « active » est au vert', () => {
    expect(statusTone('active')).toBe('ok')
    for (const s of TENANT_STATUSES.filter(x => x !== 'active')) {
      expect(statusTone(s)).not.toBe('ok')
    }
  })

  it('pending_payment est signalé, pas rassurant, et TRADUIT', () => {
    expect(statusTone('pending_payment')).toBe('warn')
    for (const lang of LANGS) {
      const l = statusLabel('pending_payment', lang)
      expect(l).not.toMatch(/PENDING_PAYMENT/)   // plus le champ brut de la base
      expect(l).not.toBe(statusLabel('active', lang))
    }
  })

  it.each([...TENANT_STATUSES])('%s est traduit dans les 4 langues, sans doublon', (s) => {
    for (const lang of LANGS) expect(statusLabel(s, lang)).toBeTruthy()
  })

  it('les libellés sont distincts deux à deux, dans chaque langue', () => {
    for (const lang of LANGS) {
      const labels = TENANT_STATUSES.map(s => statusLabel(s, lang))
      expect(new Set(labels).size).toBe(TENANT_STATUSES.length)
    }
  })

  it('un statut INCONNU est neutre et visible — jamais vert', () => {
    expect(isTenantStatus('foo')).toBe(false)
    expect(statusTone('foo')).toBe('neutral')
    expect(statusLabel('foo', 'fr')).toBe('FOO')
    expect(statusColor('foo', DarkColors)).not.toBe(DarkColors.accent2)
  })

  it('chaque ton se résout sur une couleur du thème, sans hex en dur', () => {
    expect(statusColor('active', DarkColors)).toBe(DarkColors.accent2)
    expect(statusColor('trial', DarkColors)).toBe(DarkColors.warn)
    expect(statusColor('pending_payment', DarkColors)).toBe(DarkColors.warn)
    expect(statusColor('suspended', DarkColors)).toBe(DarkColors.danger)
    expect(statusColor('cancelled', DarkColors)).toBe(DarkColors.danger)
  })
})
