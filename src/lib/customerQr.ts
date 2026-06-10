// Résolution d'un client à partir du contenu d'un QR de carte fidélité.
//
// ⚠️ Le QR de la carte (cf. `LoyaltyCardDigital.tsx`) encode `HABA-<8 premiers
// caractères de l'id, en MAJUSCULES>` — PAS l'id complet. On ne peut donc pas
// faire un `GET /api/customers/:id` direct : on résout par correspondance avec la
// liste déjà chargée (`GET /api/customers`), en comparant ce préfixe. On accepte
// aussi un id CUID complet (égalité insensible à la casse) pour rester robuste à
// un éventuel futur format de QR.

// Préfixes reconnus : HABA- (carte actuelle) et HS- (générique HabaShop).
const PREFIX_RE = /^(HABA|HS)[-:]\s*/i
// Forme d'un id CUID (commence par 'c' + base36) — sert à distinguer un code
// client d'un code-barres produit (EAN/Code128 = chiffres uniquement).
const CUID_RE = /^c[a-z0-9]{20,}$/i

/** Extrait le code client d'un contenu de QR (préfixe retiré, trim). `null` si vide. */
export function customerCodeFromQr(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().replace(PREFIX_RE, '').trim()
  return t.length > 0 ? t : null
}

/**
 * Heuristique : ce contenu ressemble-t-il à un code client (vs un code-barres
 * produit) ? Vrai si préfixe HABA-/HS- ou forme CUID. Utilisé pour router un scan.
 */
export function looksLikeCustomerCode(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim()
  return PREFIX_RE.test(t) || CUID_RE.test(t)
}

/**
 * Résout le client correspondant au contenu d'un QR, par correspondance avec la
 * liste chargée. Compare le préfixe 8 car. en MAJ (`id.slice(0,8).toUpperCase()`)
 * et accepte l'id complet (insensible à la casse). `null` si aucun match.
 */
export function matchCustomerByCode<T extends { id: string }>(
  raw: string | null | undefined,
  customers: readonly T[],
): T | null {
  const code = customerCodeFromQr(raw)
  if (!code) return null
  const up = code.toUpperCase()
  return customers.find(c =>
    c.id === code ||
    c.id.toUpperCase() === up ||
    c.id.slice(0, 8).toUpperCase() === up,
  ) ?? null
}
