import { describe, it, expect } from 'vitest'

const i = (fr: string, en: string, es: string, it: string, lang: string) =>
  lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it

describe('i18n helper', () => {
  it('Français', () => expect(i('Bonjour', 'Hello', 'Hola', 'Ciao', 'fr')).toBe('Bonjour'))
  it('Anglais', () => expect(i('Bonjour', 'Hello', 'Hola', 'Ciao', 'en')).toBe('Hello'))
  it('Espagnol', () => expect(i('Bonjour', 'Hello', 'Hola', 'Ciao', 'es')).toBe('Hola'))
  it('Italien', () => expect(i('Bonjour', 'Hello', 'Hola', 'Ciao', 'it')).toBe('Ciao'))
  it('Langue inconnue → fallback (dernier = it)', () => expect(i('Bonjour', 'Hello', 'Hola', 'Ciao', 'de')).toBe('Ciao'))
})
