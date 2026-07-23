import { vi } from 'vitest'

/**
 * FILET DE SÉCURITÉ GLOBAL — aucun test unitaire ne parle à un SDK payant.
 *
 * Chargé par `setupFiles` de `vitest.config.ts` (unitaires seulement ; la config
 * d'intégration ne l'inclut PAS — elle parle vraiment au réseau, par conception).
 *
 * Pourquoi un filet EN PLUS des mocks par fichier : `spendGuard.test.ts` posait une
 * `ANTHROPIC_API_KEY` bidon et atteignait api.anthropic.com pour de vrai (mesuré :
 * 2 requêtes, `request_id` renvoyé) parce qu'il avait oublié le mock. La clé était
 * fausse (401, zéro dépense) mais le test devenait dépendant du réseau — timeout en CI.
 * Si un jour un secret de prod était câblé dans le job de test, un tel oubli
 * DÉPENSERAIT. Ce filet ferme la classe entière : un nouveau test qui exerce une route
 * à coût sans se soucier du SDK ne peut plus fuir.
 *
 * ⚠️ NON destructif pour les mocks locaux : un `vi.mock()` dans un fichier de test
 * PRÉCÉDENCE sur ces mocks globaux (hoisting par fichier). Les tests qui vérifient une
 * réponse SDK précise (invoiceOcr, sendResultTruth…) gardent donc leur propre double.
 * Ici on ne fournit qu'un stub INERTE : de quoi ne jamais toucher le réseau, rien de
 * plus. Un test qui a besoin d'une réponse structurée DOIT définir son mock.
 */

// Anthropic — client par défaut + `beta.messages.create` (chemin Vision OCR).
vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn(async () => ({ content: [{ type: 'text', text: '' }] }))
  return {
    default: class MockAnthropic {
      messages = { create }
      beta = { messages: { create } }
      constructor(_opts: unknown) {}
    },
  }
})

// Twilio — `messages.create` renvoie un SID factice.
vi.mock('twilio', () => ({
  default: () => ({ messages: { create: vi.fn(async () => ({ sid: 'SM_MOCK' })) } }),
}))

// Resend — `emails.send` inerte.
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: vi.fn(async () => ({ data: { id: 'email_mock' }, error: null })) }
    constructor(_key?: string) {}
  },
}))
