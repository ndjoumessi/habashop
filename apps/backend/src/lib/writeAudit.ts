import * as Sentry from '@sentry/node'

/**
 * Enveloppe une écriture d'audit : **fail-open, mais TRACÉ**.
 *
 * Même asymétrie assumée que le garde de dépense (`lib/spend/spendGuard.ts`) :
 * l'action de l'utilisateur a déjà réussi, un 500 parce que la LIGNE D'AUDIT n'a
 * pas pu s'écrire serait mensonger. Mais un audit qui rate en silence est pire
 * que pas d'audit : le trou est invisible, et on croit la trace complète.
 *
 * Remplace donc le `.catch(() => {})` qui était la convention : l'échec ne casse
 * rien, mais il part en console ET dans Sentry.
 *
 * ⚠️ PII : on ne journalise que le libellé de l'événement et le message d'erreur —
 * jamais le contenu audité (`description` peut porter des données métier), jamais
 * de numéro de téléphone ni d'e-mail (cf. `lib/redactPhone.ts`).
 *
 * @param label  identifiant COURT et non sensible de l'événement (ex. `USER_PASSWORD_CHANGE`)
 * @param write  la promesse d'écriture (Prisma) à surveiller
 */
export async function writeAudit(label: string, write: Promise<unknown>): Promise<void> {
  try {
    await write
  } catch (err) {
    const msg = `[audit] ÉCHEC D'ÉCRITURE — événement non journalisé : ${label}`
    console.error(msg, err instanceof Error ? err.message : String(err))
    Sentry.captureException(err instanceof Error ? err : new Error(msg), {
      level: 'error',
      extra: { label },
    })
  }
}
