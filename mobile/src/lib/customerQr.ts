// Résolution d'un client à partir du contenu d'un QR de carte fidélité.
//
// Formats reconnus :
// - NOUVEAU : HABA-CUST:<id> → id complet ; résolution directe via GET /api/customers/:id
// - ANCIEN  : HABA-<8 chars MAJ> → préfixe ; matching contre la liste chargée
// - Générique : HS-<code> / CUID complet

const HABA_CUST_RE = /^HABA-CUST:/i
const PREFIX_RE = /^(HABA|HS)[-:]\s*/i
// CUID : commence par 'c' + base36 — distingue un code client d'un EAN (chiffres seuls).
const CUID_RE = /^c[a-z0-9]{20,}$/i

/**
 * Nouveau format HABA-CUST:<id> : extrait l'id complet.
 * Null si autre format (utiliser matchCustomerByCode pour le fallback).
 */
export function extractDirectCustomerId(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  if (!HABA_CUST_RE.test(t)) return null
  const id = t.replace(HABA_CUST_RE, '').trim()
  return id.length > 0 ? id : null
}

/** Extrait le code client d'un contenu de QR (préfixe retiré, trim). `null` si vide. */
export function customerCodeFromQr(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().replace(PREFIX_RE, '').trim()
  return t.length > 0 ? t : null
}

/**
 * Heuristique : ce contenu ressemble-t-il à un code client (vs code-barres produit) ?
 * Vrai pour HABA-CUST:, HABA-/HS-, ou CUID complet.
 */
export function looksLikeCustomerCode(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim()
  return HABA_CUST_RE.test(t) || PREFIX_RE.test(t) || CUID_RE.test(t)
}

/**
 * Résout le client correspondant au QR contre la liste chargée.
 * - Format HABA-CUST:<id> : match exact par id complet (insensible à la casse).
 * - Ancien format : compare le préfixe 8 car. MAJ ou l'id complet.
 * Pour le format HABA-CUST:, le POS utilise aussi GET /api/customers/:id en priorité.
 */
export function matchCustomerByCode<T extends { id: string }>(
  raw: string | null | undefined,
  customers: readonly T[],
): T | null {
  const directId = extractDirectCustomerId(raw)
  if (directId) {
    return customers.find(c => c.id === directId || c.id.toLowerCase() === directId.toLowerCase()) ?? null
  }
  const code = customerCodeFromQr(raw)
  if (!code) return null
  const up = code.toUpperCase()
  return customers.find(c =>
    c.id === code ||
    c.id.toUpperCase() === up ||
    c.id.slice(0, 8).toUpperCase() === up,
  ) ?? null
}
