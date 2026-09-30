import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Guide from '@/pages/Guide'
import { GUIDE_SECTIONS } from '@/content/guide'
import { useAppStore } from '@/stores/appStore'

const LANGUES = ['fr', 'en', 'es', 'it'] as const

function monter() {
  return render(<MemoryRouter><Guide /></MemoryRouter>)
}

beforeEach(() => { useAppStore.setState({ lang: 'fr' } as never) })

describe('page /guide', () => {
  it('un SEUL h1 — hiérarchie correcte pour un lecteur d’écran', () => {
    monter()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('chaque section est un h2 portant son ancre STABLE', () => {
    monter()
    for (const s of GUIDE_SECTIONS) {
      const el = document.getElementById(s.id)
      expect(el, `ancre #${s.id} absente du DOM`).toBeTruthy()
      expect(el?.tagName.toLowerCase()).toBe('h2')
    }
  })

  it('le sommaire est une vraie liste de liens, un par section', () => {
    monter()
    const nav = screen.getByRole('navigation', { name: /sommaire/i })
    const liens = nav.querySelectorAll('a')
    expect(liens).toHaveLength(GUIDE_SECTIONS.length)
    expect([...liens].map(a => a.getAttribute('href'))).toEqual(GUIDE_SECTIONS.map(s => `#${s.id}`))
  })

  it('⚠️ les ancres ne changent PAS avec la langue — un lien partagé reste valide', () => {
    const attendues = GUIDE_SECTIONS.map(s => s.id)
    for (const l of LANGUES) {
      useAppStore.setState({ lang: l } as never)
      const { unmount } = monter()
      for (const id of attendues) {
        expect(document.getElementById(id), `#${id} absente en ${l}`).toBeTruthy()
      }
      unmount()
    }
  })

  it('⚠️ le contenu suit la langue — le titre de section change', () => {
    useAppStore.setState({ lang: 'fr' } as never)
    const fr = monter()
    const titreFr = document.getElementById(GUIDE_SECTIONS[0].id)?.textContent
    fr.unmount()
    useAppStore.setState({ lang: 'en' } as never)
    monter()
    expect(document.getElementById(GUIDE_SECTIONS[0].id)?.textContent).not.toBe(titreFr)
  })

  it('⚠️ COMPLÉTUDE : chaque chaîne porte ses QUATRE langues, aucune vide', () => {
    expect(GUIDE_SECTIONS.length).toBeGreaterThan(0) // un index vide ne garderait rien
    for (const s of GUIDE_SECTIONS) {
      for (const l of LANGUES) {
        expect(String(s.titre[l] ?? '').trim(), `titre ${s.id}/${l}`).not.toBe('')
        expect(String(s.intro[l] ?? '').trim(), `intro ${s.id}/${l}`).not.toBe('')
      }
      expect(s.etapes.length, `section ${s.id} sans étape`).toBeGreaterThan(0)
      for (const [k, e] of s.etapes.entries()) {
        for (const l of LANGUES) {
          expect(String(e.titre[l] ?? '').trim(), `étape ${s.id}#${k} titre ${l}`).not.toBe('')
          expect(String(e.corps[l] ?? '').trim(), `étape ${s.id}#${k} corps ${l}`).not.toBe('')
        }
      }
    }
  })

  it('⚠️ aucune traduction n’est un copier-coller du français', () => {
    for (const s of GUIDE_SECTIONS) {
      for (const l of ['en', 'es', 'it'] as const) {
        expect(s.titre[l], `titre ${s.id} non traduit en ${l}`).not.toBe(s.titre.fr)
        expect(s.intro[l], `intro ${s.id} non traduite en ${l}`).not.toBe(s.intro.fr)
      }
    }
  })

  it('les identifiants de section sont uniques', () => {
    const ids = GUIDE_SECTIONS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('les ancres sont des slugs sûrs pour une URL', () => {
    for (const s of GUIDE_SECTIONS) expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})
