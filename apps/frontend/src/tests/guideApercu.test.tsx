import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { existsSync, statSync } from 'fs'
import { resolve } from 'path'
import Guide from '@/pages/Guide'
import { useAppStore } from '@/stores/appStore'

/**
 * L'APERÇU VIDÉO DU MANUEL.
 *
 * ⚠️ LE FICHIER EST UN ACTIF STATIQUE, DONC INVISIBLE POUR `tsc` ET POUR LE RENDU. Un
 * `src="/guide/apercu-es.webm"` qui ne correspond à aucun fichier compile, se rend, et
 * n'échoue qu'à l'exécution dans le navigateur d'un commerçant — par une vidéo qui ne part
 * jamais, sans message. Même famille que les classes tailwind jamais émises et que l'ordre des
 * règles du service worker : *la source est valide, l'artefact est nul*. Ce test va donc
 * chercher les OCTETS sur le disque.
 *
 * ⚠️ PÉRIMÈTRE DÉRIVÉ de la liste des langues, jamais écrit à la main : ajouter une cinquième
 * langue au manuel doit faire rougir ici, pas livrer un aperçu manquant en silence.
 *
 * ⚠️ PAS D'`autoplay`. Le manuel se lit ; une vidéo qui démarre seule parle par-dessus le
 * lecteur, consomme des données sur un forfait ouest-africain, et ignore
 * `prefers-reduced-motion`. C'est le lecteur qui décide.
 *
 * ⚠️ LA VIDÉO N'EST PAS LE PORTEUR DE L'INFORMATION. Elle n'a ni son ni sous-titres : si le
 * manuel s'y reposait, il serait illisible pour qui ne peut pas la regarder. Le texte des
 * sections dit déjà tout — l'aperçu l'illustre, il ne le remplace pas. Le test exige donc que
 * la page garde ses sections ET une description écrite à côté du lecteur.
 */

const LANGUES = ['fr', 'en', 'es', 'it'] as const
const PUBLIC = resolve(__dirname, '..', '..', 'public', 'guide')

function monter(lang: (typeof LANGUES)[number]) {
  useAppStore.setState({ lang } as never)
  return render(<MemoryRouter><Guide /></MemoryRouter>)
}

beforeEach(() => { useAppStore.setState({ lang: 'fr' } as never) })

describe('aperçu vidéo du manuel', () => {
  it('⚠️ chaque langue a SES octets sur le disque — vidéo et affiche', () => {
    for (const l of LANGUES) {
      for (const [quoi, f] of [['vidéo', `apercu-${l}.webm`], ['affiche', `apercu-${l}.jpg`]] as const) {
        const chemin = resolve(PUBLIC, f)
        expect(existsSync(chemin), `${quoi} manquante : public/guide/${f}`).toBe(true)
        // Un fichier VIDE existe aussi : on exige des octets, et assez pour être une vidéo.
        expect(statSync(chemin).size, `${quoi} vide : public/guide/${f}`).toBeGreaterThan(10_000)
      }
    }
  })

  it('⚠️ la page pointe la vidéo de LA langue lue, et son affiche', () => {
    for (const l of LANGUES) {
      const { container, unmount } = monter(l)
      const v = container.querySelector('video')
      expect(v, `aucun lecteur rendu en « ${l} »`).toBeTruthy()
      expect(v?.getAttribute('src'), `source en « ${l} »`).toBe(`/guide/apercu-${l}.webm`)
      expect(v?.getAttribute('poster'), `affiche en « ${l} »`).toBe(`/guide/apercu-${l}.jpg`)
      unmount()
    }
  })

  it('⚠️ aucun démarrage automatique, et des contrôles', () => {
    const { container } = monter('fr')
    const v = container.querySelector('video')
    expect(v?.hasAttribute('autoplay'), 'le lecteur ne démarre pas seul').toBe(false)
    expect(v?.hasAttribute('loop'), 'et ne tourne pas en boucle').toBe(false)
    expect(v?.hasAttribute('controls'), 'le lecteur est pilotable').toBe(true)
    // ⚠️ `preload="metadata"` : on ne télécharge pas 415 Ko à quelqu'un qui vient lire du texte.
    expect(v?.getAttribute('preload')).toBe('metadata')
  })

  it('⚠️ la vidéo est ILLUSTRATIVE : le manuel garde son texte à côté', () => {
    const { container } = monter('fr')
    // Une description écrite accompagne le lecteur — la vidéo n'a ni son ni sous-titres.
    const fig = container.querySelector('figure')
    expect(fig, 'le lecteur vit dans une figure').toBeTruthy()
    const legende = fig?.querySelector('figcaption')?.textContent ?? ''
    expect(legende.length, 'la légende doit DIRE ce qu’on regarde').toBeGreaterThan(40)
    // Et les sections du manuel restent : l'aperçu ne les remplace pas.
    expect(container.querySelectorAll('h2').length, 'les sections du manuel restent').toBeGreaterThan(3)
  })
})
