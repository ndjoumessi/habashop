import Anthropic from '@anthropic-ai/sdk'
import { authorizeSpend, releaseQuota } from './spendGuard'

/**
 * SEUL module autorisé à instancier le SDK Anthropic.
 *
 * Verrouillé par `spendGuardAllowlist.test.ts` : tout `import Anthropic` ailleurs dans
 * `src/` fait échouer les tests.
 *
 * Le quota est réservé JUSTE AVANT l'appel réel. Conséquence directe : un refus de rôle,
 * un fichier trop lourd (413), un format non supporté (415) ou une clé absente (503)
 * n'atteignent jamais ce module et ne consomment donc rien — le compteur est exact par
 * construction, au lieu d'être corrigé après coup par un remboursement sur code HTTP.
 */

// Forme UNIQUE (cf. spendGuard) : `strict: false` ne narrow pas sur `ok`.
export type AnthropicResult = {
  ok: boolean
  message?: Anthropic.Message
  code?: string
  error?: string
}

export function isAnthropicConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY ?? '').trim()
}

export const ANTHROPIC_NOT_CONFIGURED = 'ANTHROPIC_NOT_CONFIGURED'

/** Refus de dépense remonté aux appelants qui préfèrent un throw (services). */
export class SpendDeniedError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

/**
 * Appel Claude GARDÉ. `kind` distingue les compteurs : 'ocr' (scan de facture) et
 * 'ai' (analyses et chat), qui n'ont ni le même plafond ni le même modèle.
 */
export async function createMessage(opts: {
  tenantId: string | null | undefined
  kind: 'ai' | 'ocr'
  params: Anthropic.MessageCreateParamsNonStreaming & { betas?: string[] }
}): Promise<AnthropicResult> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  // Vérifié AVANT de réserver : une clé absente ne doit pas consommer de quota.
  if (!apiKey) {
    return { ok: false, code: ANTHROPIC_NOT_CONFIGURED, error: 'Service IA non configuré (ANTHROPIC_API_KEY manquante)' }
  }

  const decision = await authorizeSpend(opts.tenantId, opts.kind, 1)
  if (!decision.ok) {
    return { ok: false, code: decision.code, error: decision.message }
  }

  const reservedKey = decision.quotaKey
  const client = new Anthropic({ apiKey })
  try {
    // Les PDF passent par le canal beta (`betas: ['pdfs-...']`), les images par le canal
    // standard. `beta` n'est pas typé dans le SDK → accès via un type de passage étroit.
    const betas = opts.params.betas
    const message = betas && betas.length > 0
      ? await (client.beta as unknown as { messages: { create: (p: unknown) => Promise<Anthropic.Message> } })
          .messages.create(opts.params)
      : await client.messages.create(opts.params)
    return { ok: true, message }
  } catch (err: unknown) {
    // L'appel a échoué → rien de facturable côté fournisseur pour un refus amont ;
    // on rend l'unité pour ne pas pénaliser un incident réseau.
    await releaseQuota(opts.tenantId!, opts.kind, 1, reservedKey)
    throw err
  }
}

/** Extrait le texte d'une réponse Claude (bloc `text` en premier). */
export function textOf(message: Anthropic.Message, fallback = ''): string {
  const block = message.content[0]
  return block && block.type === 'text' ? block.text : fallback
}
