import { describe, it, expect, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CONTRACT_TYPES, CONTRACT_LABELS, isOpenEnded } from '@/components/hr/hrShared'

/**
 * VERROU — un domaine de contrat, trois formulaires, aucune réénumération.
 *
 * ─── CE QUI A ÉTÉ MESURÉ (2026-08-06) ────────────────────────────────────────
 * `Employee.type` était typé `'CDI' | 'CDD'` alors que le domaine réel en a CINQ, et que
 * `CONTRACT_LABELS` — dans le MÊME fichier, trente lignes plus bas — en libellait déjà cinq.
 * Le type ne décrivait donc pas la donnée : il décrivait ce que le plus pauvre des trois
 * formulaires savait offrir.
 *
 *   base de production        : CDI 8 · CDD 2 · rien d'autre (le cast n'était pas ENCORE passé)
 *   `schema.prisma`           : `type String @default("CDI")` — aucun enum
 *   zod backend               : `z.string().optional()` — tout passe
 *   EmpModal                  : 2 valeurs offertes
 *   EditEmployeeModal         : 5
 *   NewContractModal          : 5, puis `as 'CDI'|'CDD'` à l'enregistrement
 *
 * ⚠️ Le `as` est ce qui rendait l'écart INVISIBLE : il désactive la seule parade automatique.
 * Un cast qui RÉTRÉCIT un domaine (5 → 2) n'est pas une annotation, c'est une affirmation
 * fausse que le compilateur a été prié d'accepter — et `tsc` s'est tu pendant que trois
 * formulaires divergeaient. C'est la version « compilateur » du § arité des ternaires : le
 * ternaire avale silencieusement dans son `else`, le cast avale silencieusement tout court.
 *
 * ─── LES DEUX DÉGÂTS RÉELS, tous deux SILENCIEUX ─────────────────────────────
 *   • `HRContractsTab` testait `emp.type === 'CDD'` pour l'alerte d'échéance : un Stage ou un
 *     Freelance daté n'était JAMAIS signalé, alors que sa date de fin s'affichait à côté.
 *   • `NewContractModal` n'enregistrait `endAt` que pour un CDD : un Stage saisi AVEC sa date
 *     de fin était écrit sans elle.
 *
 * ─── LA DÉCISION, et elle est écrite ─────────────────────────────────────────
 * Le discriminant n'est PAS le libellé, c'est `endAt`. Une date de fin est un FAIT ; « CDD »
 * n'est qu'une classification, et quatre des cinq types peuvent porter une échéance.
 * `isOpenEnded` ne sert qu'à DÉCIDER SI le champ est offert, jamais si un contrat expire.
 */

const HR = join(__dirname, '..', 'components', 'hr')

/** Rappel inerte pour les props obligatoires. `() => undefined` a un corps : `no-empty-function`
 *  ne le signale pas, et le lecteur voit que l'absence d'effet est VOULUE, pas oubliée. */
const rien = () => undefined

function fichiersHR(): string[] {
  const out: string[] = []
  const marche = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) marche(p)
      else if (/\.tsx?$/.test(p)) out.push(p)
    }
  }
  marche(HR)
  return out
}

/** Commentaires retirés — sinon le scan interdit d'expliquer ce qu'il interdit. */
const codeSeul = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

describe('le domaine des contrats a UNE source', () => {
  const fichiers = fichiersHR()

  it('COUVERTURE — le scan lit bien l’arborescence HR', () => {
    // Angle mort n°1 : un `walk()` cassé rend une liste vide, donc un vert qui ne garde rien.
    expect(fichiers.length).toBeGreaterThan(10)
    expect(fichiers.some(f => f.endsWith('hrShared.tsx'))).toBe(true)
    expect(fichiers.filter(f => f.includes('/modals/')).length).toBeGreaterThanOrEqual(3)
  })

  it('la source unique couvre exactement ce que les libellés savent nommer', () => {
    expect([...CONTRACT_TYPES].sort()).toEqual(Object.keys(CONTRACT_LABELS).sort())
    expect(CONTRACT_TYPES.length).toBe(5)
    // …et chaque type est libellé dans les QUATRE langues.
    for (const t of CONTRACT_TYPES) {
      for (const l of ['fr', 'en', 'es', 'it']) {
        expect(CONTRACT_LABELS[t]?.[l], `« ${t} » n’a pas de libellé ${l}`).toBeTruthy()
      }
    }
  })

  it('AUCUN fichier HR ne réénumère la liste des contrats', () => {
    // La divergence est née de trois listes écrites à la main. Une quatrième la ferait renaître.
    const coupables = fichiers.filter(f => {
      if (f.endsWith('hrShared.tsx')) return false     // la source
      const src = codeSeul(readFileSync(f, 'utf8'))
      return /\[\s*['"]CDI['"]\s*,\s*['"]CDD['"]/.test(src)
    })
    expect(coupables.map(f => f.replace(HR + '/', ''))).toEqual([])
  })

  it('AUCUN cast ne rétrécit le domaine des contrats', () => {
    // ⚠️ La règle vise la FORME `as '…'|'…'` portant un littéral de contrat, pas l'identifiant :
    // un cast écrit sur une autre variable resterait attrapé.
    const coupables: string[] = []
    for (const f of fichiers) {
      const src = codeSeul(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(/\bas\s+((?:'[^']+'|"[^"]+")(?:\s*\|\s*(?:'[^']+'|"[^"]+"))+)/g)) {
        if (/CDI|CDD|Stage|Freelance|Temps partiel/.test(m[1])) {
          coupables.push(`${f.replace(HR + '/', '')} :: as ${m[1]}`)
        }
      }
    }
    expect(coupables, [
      'Un `as` qui rétrécit un domaine désactive la seule parade automatique : `tsc` se tait',
      'pendant que la donnée déborde. Élargir le type, ne pas caster.',
    ].join('\n')).toEqual([])
  })

  it('l’échéance se dérive de `endAt`, JAMAIS d’un libellé de contrat', () => {
    const src = codeSeul(readFileSync(join(HR, 'tabs', 'HRContractsTab.tsx'), 'utf8'))
    const bloc = /const isExpiringSoon[\s\S]{0,320}/.exec(src)?.[0] ?? ''
    expect(bloc, 'le calcul d’échéance est introuvable — le scan ne garde rien').toBeTruthy()
    expect(bloc).toContain('emp.endAt')
    expect(bloc, 'l’alerte ne doit PAS dépendre du libellé : un Stage daté expire aussi').not.toMatch(/'CDD'|'CDI'/)
  })

  it('`isOpenEnded` ne connaît qu’un seul type sans échéance', () => {
    expect(isOpenEnded('CDI')).toBe(true)
    for (const t of CONTRACT_TYPES.filter(t => t !== 'CDI')) expect(isOpenEnded(t)).toBe(false)
    // Une valeur INCONNUE n'est pas assimilée à « indéterminé » : la colonne est un String libre.
    expect(isOpenEnded('Apprentissage')).toBe(false)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   COMPORTEMENT — sur le DOM rendu, pas sur la source
   ══════════════════════════════════════════════════════════════════════════════ */
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const EMP: any = {
  id: 'e1', name: 'Marie Bakayoko', role: 'Caissière', dept: 'Ventes', salary: 350000,
  type: 'CDI', hiredAt: '2024-01-05', avatar: 'MB', color: '#6C3FD6',
  active: true, phone: '', email: '', perf: null,
}

describe('les trois formulaires offrent le même domaine', () => {
  it('EmpModal offre les CINQ types, et des dates natives', async () => {
    const { default: EmpModal } = await import('@/components/hr/modals/EmpModal')
    const { container } = render(<EmpModal emp={null} onClose={rien} onSave={rien} />)
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    const options = [...container.querySelectorAll('option')].map(o => o.getAttribute('value'))
    for (const t of CONTRACT_TYPES) expect(options, `« ${t} » manque à EmpModal`).toContain(t)
    // Le champ date était du TEXTE LIBRE ici, un sélecteur natif dans les deux autres.
    const dates = [...container.querySelectorAll('input')]
      .filter(i => /embauche|hire|contratación|assunzione/i.test(i.getAttribute('aria-label') ?? ''))
    expect(dates.length).toBeGreaterThan(0)
    for (const d of dates) expect(d.getAttribute('type')).toBe('date')
  })

  it('EmpModal ne REPROCHE rien tant que l’utilisateur n’a rien saisi', async () => {
    const { default: EmpModal } = await import('@/components/hr/modals/EmpModal')
    const { container } = render(<EmpModal emp={null} onClose={rien} onSave={rien} />)
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    const requis = /Ce champ est requis|This field is required/
    expect(requis.test(container.textContent ?? ''), 'reproche au montage').toBe(false)

    // ⚠️ LE CAS QUI A MOTIVÉ LE CORRECTIF : la modale autofocuse son premier champ. Le
    // QUITTER sans avoir rien tapé ne doit pas déclencher de reproche — l'utilisateur n'a
    // jamais choisi d'y entrer, c'est l'application qui l'y a mis.
    const actif = document.activeElement as HTMLInputElement
    expect(actif?.tagName).toBe('INPUT')
    expect(actif?.value).toBe('')
    await act(async () => { fireEvent.blur(actif) })
    expect(requis.test(container.textContent ?? ''), 'reproche après un simple passage').toBe(false)

    // …mais dès qu'on saisit puis qu'on efface, l'erreur est légitime.
    await act(async () => {
      fireEvent.change(actif, { target: { value: 'Marie' } })
      fireEvent.change(actif, { target: { value: '' } })
      fireEvent.blur(actif)
    })
    expect(requis.test(container.textContent ?? ''), 'aucun retour après une saisie effacée').toBe(true)
  })

  it('EmpModal n’affiche qu’UN marqueur de champ requis', async () => {
    const { default: EmpModal } = await import('@/components/hr/modals/EmpModal')
    const { container } = render(<EmpModal emp={null} onClose={rien} onSave={rien} />)
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    const doubles = [...container.querySelectorAll('label')]
      .map(l => l.textContent ?? '')
      .filter(t => (t.match(/\*/g) ?? []).length > 1)
    expect(doubles, '`ValidatedInput` rend DÉJÀ son `*` quand `required`').toEqual([])
  })

  it('EditEmployeeModal n’annonce PAS de modification tant que rien n’a changé', async () => {
    const { default: EditEmployeeModal } = await import('@/components/hr/modals/EditEmployeeModal')
    const { container } = render(
      <EditEmployeeModal lang="fr" fmt={n => String(n)} selectedEmp={EMP}
        editEmpForm={{ ...EMP }} setEditEmpForm={rien}
        empEditMode setEmpEditMode={rien}
        salaryInput="350000" setSalaryInput={rien}
        toXOF={n => n} currency="XOF" currencySymbol="FCFA"
        setEmployees={rien} setShowEditEmpModal={rien} openEditModal={rien} />)
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    const t = container.textContent ?? ''
    expect(t, 'le bandeau doit dire « Mode édition », pas affirmer une modification').toMatch(/Mode édition/)
    expect(/non sauvegard/i.test(t), 'affirmation fausse à l’ouverture').toBe(false)
    // Le domaine complet est bien offert ici aussi.
    const options = [...container.querySelectorAll('option')].map(o => o.getAttribute('value'))
    for (const ty of CONTRACT_TYPES) expect(options).toContain(ty)
  })

  it('aucun émoji d’interface dans les boutons des modales RH', () => {
    // Convention du dépôt : Lucide uniquement. Huit sites en portaient (✅ ×5, ➕ ×2, 💾, 📄).
    //
    // ⚠️ CRITÈRE CALIBRÉ, pas choisi par principe. Une première version balayait les blocs
    // Unicode « Dingbats / Misc Symbols » : elle remontait `✕`, `✓`, `★` et `✏`, des glyphes
    // TYPOGRAPHIQUES employés partout dans le dépôt (« ✓ Actif », l'étoile de notation, la
    // croix de fermeture). Elle aurait exigé une réécriture que personne n'a demandée — et un
    // verrou qui crie au loup se fait désarmer.
    // `\p{Emoji_Presentation}` ne retient que les caractères dont la présentation PAR DÉFAUT
    // est un emoji couleur. Vérifié : ✅ ➕ 💾 📄 ✨ interdits · ✕ ✓ ★ ✏ − → tolérés.
    const emoji = /\p{Emoji_Presentation}/u
    const coupables: string[] = []
    for (const f of fichiersHR()) {
      const src = codeSeul(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(/<button[\s\S]{0,900}?<\/button>/g)) {
        if (emoji.test(m[0])) coupables.push(f.replace(HR + '/', ''))
      }
    }
    expect([...new Set(coupables)]).toEqual([])
  })
})
