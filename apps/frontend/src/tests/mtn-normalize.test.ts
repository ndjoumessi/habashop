import { describe, it, expect } from 'vitest'
import { normalizeCameroonPhone } from '@/lib/msisdn'

/**
 * ⚠️ Ce fichier contenait une COPIE MANUELLE de `normalizeCameroonPhone`, avec le
 * commentaire « Mettre à jour ici si la fonction dans POS.tsx change ». Les 19 cas
 * validaient donc la copie, jamais le code exécuté à la caisse — sur le numéro qui
 * REÇOIT le paiement MTN. La fonction a été extraite dans `lib/msisdn.ts` et est
 * désormais IMPORTÉE : la copie ne peut plus dériver puisqu'elle n'existe plus.
 */

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
