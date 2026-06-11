import { describe, it, expect } from 'vitest'

// Copie de normalizeCameroonPhone (pure function, indépendante du composant React).
// Mettre à jour ici si la fonction dans POS.tsx change.
function normalizeCameroonPhone(raw: string): string | null {
  const s = raw.replace(/[\s\-\(\)]/g, '')          // garde + pour détecter +237
  if (/^\+237[0-9]{9}$/.test(s)) return s.slice(1) // +237XXXXXXXXX → 237XXXXXXXXX
  if (/^237[0-9]{9}$/.test(s))   return s           // déjà normalisé 12 chiffres
  if (/^6[0-9]{8}$/.test(s))     return `237${s}`  // 9 chiffres locaux → préfixer 237
  const d = s.replace(/^\+/, '')                    // retire + éventuel
  if (/^[0-9]{8,15}$/.test(d))   return d           // tout pays : 8–15 chiffres
  return null
}

describe('normalizeCameroonPhone', () => {
  // ── Numéros Cameroun — normalisation ────────────────────────────────────────
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

  // ── Numéros autres pays (catch-all 8–15 chiffres) ───────────────────────────
  it('accepte numéro 9 chiffres commençant par autre chose que 6 (catch-all)', () => {
    expect(normalizeCameroonPhone('577000000')).toBe('577000000')
  })

  it('accepte 8 chiffres minimum', () => {
    expect(normalizeCameroonPhone('67700000')).toBe('67700000')
  })

  it('accepte 13 chiffres (dans la plage 8–15)', () => {
    expect(normalizeCameroonPhone('2376770000001')).toBe('2376770000001')
  })

  it('accepte 15 chiffres (maximum international)', () => {
    expect(normalizeCameroonPhone('123456789012345')).toBe('123456789012345')
  })

  it('accepte numéro international avec + (France)', () => {
    expect(normalizeCameroonPhone('+33612345678')).toBe('33612345678')
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

  it('rejette 7 chiffres (trop court)', () => {
    expect(normalizeCameroonPhone('1234567')).toBeNull()
  })

  it('rejette 16 chiffres (trop long)', () => {
    expect(normalizeCameroonPhone('1234567890123456')).toBeNull()
  })

  it('rejette du texte', () => {
    expect(normalizeCameroonPhone('abc123')).toBeNull()
  })

  it('rejette un numéro avec lettres mélangées', () => {
    expect(normalizeCameroonPhone('677abc000')).toBeNull()
  })
})
