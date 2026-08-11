import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { EmpAvatar } from '@/components/hr/hrShared'

/**
 * LA PHOTO S'AFFICHE PARTOUT OÙ ON RECONNAÎT QUELQU'UN — pas seulement dans sa fiche.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * MESURÉ le 2026-08-11 sur capture : une photo enregistrée et relue s'affichait dans
 * la fiche employé, et NULLE PART ailleurs — la liste montrait toujours les initiales.
 * Cause : `EmpAvatar` existait déjà, et DEUX écrans seulement s'en servaient. Quatre
 * autres redessinaient le même carré dégradé en ligne, aucun au courant de `photoUrl`.
 * Cinq copies d'un même dessin, une seule à jour : le jumeau non traité, à cinq
 * exemplaires.
 *
 * ⚠️ LES SURFACES DE PAIE SONT EXCLUES, délibérément : un bulletin est un instantané
 * GELÉ qui porte son propre `avatar`, et y injecter la photo du jour réécrirait un
 * document passé. C'est la même raison qui interdit de joindre `Employee.salary` à
 * l'affichage d'un bulletin.
 */

const RACINE = join(__dirname, '..')
const EMP = { name: 'Aminata Touré', avatar: 'AT', color: '#10B981' }

describe('EmpAvatar', () => {
  it('⚠️ la PHOTO gagne sur les initiales', () => {
    const { container } = render(<EmpAvatar emp={{ ...EMP, photoUrl: 'data:image/jpeg;base64,ZZZ' }} />)
    const img = container.querySelector('img')
    expect(img, 'aucune image rendue — c’est le défaut signalé').not.toBeNull()
    expect(img!.getAttribute('src')).toBe('data:image/jpeg;base64,ZZZ')
    expect(container.textContent, 'les initiales ne doivent pas doubler la photo').toBe('')
  })

  it('sans photo : les initiales, et jamais un carré vide', () => {
    // Contrôle positif. Sans lui, le cas ci-dessus serait vert d'un composant qui ne
    // rendrait jamais rien d'autre qu'une image.
    const { container } = render(<EmpAvatar emp={EMP} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('AT')
  })

  it('avatar absent : les initiales se DÉRIVENT du nom', () => {
    const { container } = render(<EmpAvatar emp={{ ...EMP, avatar: '' }} />)
    expect(container.textContent).toBe('AT')
  })

  it('⚠️ la photo est ROGNÉE, pas déformée', () => {
    // `objectFit: cover` : sans lui un portrait s'étire dans un carré, et le visage
    // devient méconnaissable — l'inverse de ce que l'avatar sert à faire.
    const { container } = render(<EmpAvatar emp={{ ...EMP, photoUrl: 'x' }} />)
    expect(container.querySelector('img')!.style.objectFit).toBe('cover')
    expect((container.firstChild as HTMLElement).style.overflow).toBe('hidden')
  })

  it('⚠️ aucune couleur INVALIDE ne sort, même sur une valeur tokenisée', () => {
    /**
     * La couleur reçoit des alphas concaténées (`${c}99`, `${c}44`). `var(--p)99` est
     * une couleur INVALIDE : la propriété retombe à sa valeur initiale, invisible pour
     * `tsc` comme pour les tests (#211/#212). `avatarHex` garantit un `#hex`.
     */
    const { container } = render(<EmpAvatar emp={{ ...EMP, color: 'var(--p)' }} />)
    const style = (container.firstChild as HTMLElement).getAttribute('style') ?? ''
    expect(style, 'un `var(--…)` concaténé à une alpha ne rend RIEN').not.toMatch(/var\(--[^)]*\)\d/)
    expect(style).toMatch(/#[0-9a-f]{6}/i)
  })
})

describe('plus aucune copie du rendu en ligne', () => {
  /** Périmètre DÉRIVÉ de l'arborescence, jamais listé à la main. */
  function fichiers(base: string): string[] {
    const out: string[] = []
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        if (e === 'tests' || e === 'node_modules') continue
        const p = join(d, e)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx$/.test(e) && !e.includes('.test.')) out.push(p)
      }
    }
    walk(join(RACINE, base))
    return out
  }

  /**
   * ⚠️ EXEMPTIONS NOMMÉES — les surfaces de PAIE. Un bulletin est un instantané gelé :
   * il porte son propre `avatar`, figé au moment de la génération, et y injecter la
   * photo du jour réécrirait un document passé.
   */
  const EXEMPTS = [
    'components/payroll/BulletinModal.tsx',
    'components/payroll/payrollShared.tsx',
    'components/hr/tabs/PayrollBonuses.tsx',
    'components/hr/tabs/PayrollPayslips.tsx',
    'components/hr/tabs/PayrollHistory.tsx',
    'components/hr/hrShared.tsx',                    // le rendu unique lui-même
    'components/hr/modals/ContractDetailModal.tsx',  // affiche déjà la photo, sa propre mise en page
    'components/hr/modals/NewContractModal.tsx',     // pastille de combobox, 20px, pas un avatar
  ]

  it('⚠️ COUVERTURE — le balayage lit réellement des fichiers', () => {
    const tous = [...fichiers('components/hr'), ...fichiers('components/planning')]
    expect(tous.length).toBeGreaterThan(15)
    expect(tous.some(f => f.endsWith('HREmployeeGrid.tsx')), 'témoin positif').toBe(true)
  })

  it('aucun écran ne redessine l’avatar au lieu d’utiliser EmpAvatar', () => {
    const coupables = [...fichiers('components/hr'), ...fichiers('components/planning')]
      .filter(f => /\{emp\.avatar\}/.test(readFileSync(f, 'utf8')))
      .map(f => f.slice(RACINE.length + 1))
      .filter(rel => !EXEMPTS.includes(rel))

    expect(
      coupables,
      'ces écrans dessinent les initiales à la main : ils IGNORERONT la photo, comme les\n'
      + 'cinq copies mesurées le 2026-08-11. Utiliser `EmpAvatar`, ou l’exempter ICI avec sa raison.',
    ).toEqual([])
  })
})
