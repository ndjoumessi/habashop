/**
 * Caviardage des numéros de téléphone AVANT journalisation.
 *
 * ⚠️ CLAUDE.md § PII : « numéros de téléphone jamais dans les logs Railway ». Les
 * messages d'erreur Twilio embarquent le numéro destinataire (« The 'To' number
 * whatsapp:+221771234567 is not a valid phone number »), donc les journaliser tels
 * quels publie les numéros des CLIENTS du commerçant dans un flux consultable par
 * quiconque a accès au projet.
 *
 * Périmètre volontairement ÉTROIT : cette fonction ne sert QU'À la journalisation.
 * Elle ne normalise rien, ne valide rien et ne touche à aucun numéro envoyé à Twilio
 * — la normalisation E.164 est un chantier séparé, à traiter à froid.
 *
 * Conserve les 4 derniers chiffres : assez pour rapprocher un incident d'un ticket
 * support, trop peu pour recontacter la personne.
 */

// 8 chiffres minimum : en-dessous on est sur un code d'erreur (21211), un SID, un
// montant — les caviarder rendrait les logs inexploitables.
const PHONE_LIKE = /\+?\d[\d\s\-().]{6,}\d/g
// ⚠️ Un horodatage ISO (2026-07-22T21:00:00Z) a la même silhouette qu'un numéro à
// séparateurs : sans cette exclusion, redactPhone rendait les dates illisibles dans
// les logs — c'est un test qui l'a montré, pas une relecture.
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/
// E.164 plafonne à 15 chiffres : au-delà c'est un identifiant, pas un numéro.
const E164_MAX = 15

/** `+221771234567` → `+221****4567`. Idempotent, sûr sur une chaîne sans numéro. */
export function redactPhone(value: unknown): string {
  const s = typeof value === 'string' ? value : String(value ?? '')
  return s.replace(PHONE_LIKE, m => {
    if (ISO_LIKE.test(m)) return m            // horodatage → intact
    const digits = m.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > E164_MAX) return m
    return `+${digits.slice(0, 3)}****${digits.slice(-4)}`
  })
}

/** Extrait le message d'une erreur inconnue, déjà caviardé. */
export function redactError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return redactPhone(raw)
}
