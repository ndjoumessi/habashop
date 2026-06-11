import { describe, it, expect } from 'vitest'

// Copie de normalizeCameroonPhone (pure function, indépendante du composant React).
// Mettre à jour ici si la fonction dans POS.tsx change.
function normalizeCameroonPhone(raw: string): string | null {
  const s = raw.replace(/[\s\-\(\)]/g, '')          // garde + pour détecter +237
  if (/^\+237[0-9]{9}$/.test(s)) return s.slice(1) // +237XXXXXXXXX → 237XXXXXXXXX
  if (/^237[0-9]{9}$/.test(s))   return s           // déjà normalisé 12 chiffres
  if (/^6[0-9]{8}$/.test(s))     return `237${s}`  // 9 chiffres locaux → préfixer 237
  if (/^[0-9]{10,12}$/.test(s))  return s           // sandbox / catch-all
  return null
}

describe('normalizeCameroonPhone', () => {
  // ── Numéros Cameroun réels ───────────────────────────────────────────────────
  it('accepte 9 chiffres locaux (6XXXXXXXX) et préfixe 237', () => {
    expect(normalizeCameroonPhone('677000000')).toBe('237677000000')
  })

  it('accepte 12 chiffres avec indicatif pays (237XXXXXXXXX)', () => {
    expect(normalizeCameroonPhone('237677000000')).toBe('237677000000')
  })

  it('accepte +237XXXXXXXXX et retire le +', () => {
    expect(normalizeCameroonPhone('+237677000000')).toBe('237677000000')
  })

  it('accepte 6XXXXXXXX avec espaces', () => {
    expect(normalizeCameroonPhone('677 000 000')).toBe('237677000000')
  })

  it('accepte +237 XXXXXXXXX avec espaces', () => {
    expect(normalizeCameroonPhone('+237 677 000 000')).toBe('237677000000')
  })

  it('accepte 237XXXXXXXXX avec tirets', () => {
    expect(normalizeCameroonPhone('237-677-000-000')).toBe('237677000000')
  })

  // ── Sandbox MTN ─────────────────────────────────────────────────────────────
  it('accepte le numéro sandbox MTN 11 chiffres (46733123453)', () => {
    expect(normalizeCameroonPhone('46733123453')).toBe('46733123453')
  })

  it('accepte un numéro sandbox 10 chiffres', () => {
    expect(normalizeCameroonPhone('4673312345')).toBe('4673312345')
  })

  it('accepte un numéro sandbox 12 chiffres sans préfixe 237', () => {
    expect(normalizeCameroonPhone('467331234567')).toBe('467331234567')
  })

  // ── Invalides ────────────────────────────────────────────────────────────────
  it('rejette un numéro vide', () => {
    expect(normalizeCameroonPhone('')).toBeNull()
  })

  it('rejette 8 chiffres (trop court pour local)', () => {
    expect(normalizeCameroonPhone('67700000')).toBeNull()
  })

  it('rejette un numéro commençant par autre chose que 6 (local court)', () => {
    expect(normalizeCameroonPhone('577000000')).toBeNull()
  })

  it('rejette du texte', () => {
    expect(normalizeCameroonPhone('abc123')).toBeNull()
  })

  it('rejette 13 chiffres (trop long)', () => {
    expect(normalizeCameroonPhone('2376770000001')).toBeNull()
  })
})
