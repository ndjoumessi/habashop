import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../lib/phoneE164'

/**
 * Normalisation E.164 — reconstruction à froid après le rollback `1ae8f9c0`.
 *
 * Les assertions portent sur le NUMÉRO PRODUIT, jamais sur du texte source : un test
 * qui grep la source prouve qu'une fonction est appelée, pas qu'elle produit le bon
 * numéro — et c'est un mauvais numéro qui a livré des reçus à des inconnus.
 */

describe('normalizePhone — ANTI-FUITE (le cas qui a coûté cher)', () => {
  /**
   * ⚠️ CE TEST EST LE GARDIEN DE LA SURFACE.
   *
   * `Tenant.country` vaut « SN » par DÉFAUT SILENCIEUX : schéma `@default("SN")`,
   * `country ?? 'SN'` dans les trois chemins d'écriture, et le formulaire
   * d'inscription pré-sélectionne SN. Un commerçant ivoirien qui n'ouvre jamais la
   * liste déroulante est donc stocké « SN », indiscernable d'un choix réel.
   *
   * Ce test exerce précisément ce cas. S'il devient ROUGE, la normalisation
   * transforme un numéro ivoirien en numéro sénégalais VALIDE, donc livré à un tiers :
   * la fuite d'origine, à l'identique. Le correctif est alors STRUCTUREL (rendre le
   * pays explicite en base), pas un ajustement de cette fonction. Ne jamais
   * « réparer » ce test en ajustant l'attendu.
   */
  it('un numéro national IVOIRIEN attribué au Sénégal reste INCHANGÉ', () => {
    const out = normalizePhone('0701234567', 'SN')
    expect(out.value).toBe('0701234567')
    expect(out.normalized).toBe(false)
    // L'assertion qui compte : aucun +221 n'a été fabriqué.
    expect(out.value).not.toContain('+221')
    expect(out.value.startsWith('+')).toBe(false)
  })

  it('le MÊME numéro avec le bon pays est normalisé — le pays gate réellement', () => {
    // Contre-preuve : sans elle, un test toujours-inchangé passerait aussi avec une
    // fonction qui ne fait rien du tout.
    expect(normalizePhone('0701234567', 'CI')).toEqual({ value: '+2250701234567', normalized: true })
  })
})

describe('normalizePhone — pays connu, format national', () => {
  // CI/BJ/CG CONSERVENT le zéro de tête, GA le RETIRE : c'est exactement ce que la
  // table écrite à la main de la tentative annulée avait faux pour CG et GA.
  it.each([
    ['SN', '771234567',  '+221771234567'],
    ['CI', '0701234567', '+2250701234567'], // zéro conservé
    ['BJ', '0141234567', '+2290141234567'], // zéro conservé
    ['CM', '671234567',  '+237671234567'],
    ['CG', '061234567',  '+242061234567'],  // zéro CONSERVÉ
    ['GA', '062345678',  '+24162345678'],   // zéro RETIRÉ
  ])('%s : %s → %s', (country, raw, expected) => {
    expect(normalizePhone(raw, country)).toEqual({ value: expected, normalized: true })
  })

  it('accepte un code pays en minuscules ou espacé', () => {
    expect(normalizePhone('771234567', ' sn ').value).toBe('+221771234567')
  })

  it('tolère les séparateurs de saisie', () => {
    expect(normalizePhone('77 123 45 67', 'SN').value).toBe('+221771234567')
    expect(normalizePhone('07-01-23-45-67', 'CI').value).toBe('+2250701234567')
  })
})

describe('normalizePhone — on ne devine JAMAIS', () => {
  it('format national SANS pays → inchangé', () => {
    expect(normalizePhone('0701234567')).toEqual({ value: '0701234567', normalized: false })
    expect(normalizePhone('771234567', undefined)).toEqual({ value: '771234567', normalized: false })
    expect(normalizePhone('771234567', null)).toEqual({ value: '771234567', normalized: false })
  })

  it('pays NON RECONNU → inchangé (aucun repli sur un pays par défaut)', () => {
    // « France » est une valeur RÉELLE de Tenant.country en prod (Onboarding envoie des
    // noms français). Non reconnue comme ISO-2 ⇒ pas de normalisation.
    for (const c of ['OTHER', 'XX', 'France', 'Sénégal', '', 'SEN', 'sn-SN']) {
      expect(normalizePhone('771234567', c), `country=${c}`)
        .toEqual({ value: '771234567', normalized: false })
    }
  })

  it('numéro mal formé → inchangé (Twilio le rejettera)', () => {
    for (const raw of ['abc', '123', '00', '+', 'null']) {
      expect(normalizePhone(raw, 'SN'), `raw=${raw}`).toEqual({ value: raw, normalized: false })
    }
  })

  it('entrée vide ou non-chaîne → inchangée, sans exception', () => {
    expect(normalizePhone('')).toEqual({ value: '', normalized: false })
    expect(normalizePhone('   ')).toEqual({ value: '   ', normalized: false })
    expect(normalizePhone(null)).toEqual({ value: '', normalized: false })
    expect(normalizePhone(undefined)).toEqual({ value: '', normalized: false })
    expect(normalizePhone(42, 'SN')).toEqual({ value: '42', normalized: false })
  })
})

describe('normalizePhone — déjà international', () => {
  it('un +221 valide passe tel quel', () => {
    expect(normalizePhone('+221771234567')).toEqual({ value: '+221771234567', normalized: true })
  })

  it('le pays du tenant NE PRIME PAS sur un préfixe international explicite', () => {
    // Le cas qui compte : tenant marqué SN (défaut silencieux), client ivoirien joignable.
    // Le +225 doit survivre — sinon le défaut SN détournerait un numéro explicite.
    expect(normalizePhone('+2250701234567', 'SN')).toEqual({ value: '+2250701234567', normalized: true })
    expect(normalizePhone('+33612345678', 'SN').value).toBe('+33612345678')
  })

  it('un +XXX invalide reste inchangé plutôt que d’être « réparé »', () => {
    expect(normalizePhone('+221000')).toEqual({ value: '+221000', normalized: false })
  })

  it('est idempotent', () => {
    const once = normalizePhone('771234567', 'SN')
    expect(normalizePhone(once.value, 'SN')).toEqual(once)
    expect(normalizePhone(once.value)).toEqual(once)
  })
})
