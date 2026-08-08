import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import {
  isoOf, parseIso, monthGrid, presetRange, rangeToMs, orderRange, inRange,
  addMonths, parseMonthKey, monthKeyOf, PERIOD_ORDER,
} from '@/lib/dateRange'
import { DateField, DateRangeField, MonthField, PERIOD_LABELS } from '@/components/ui/DatePicker'

/**
 * VERROUS DES SÉLECTEURS DE DATE.
 *
 * Trois familles, et elles ne se remplacent pas :
 *   ① la LOGIQUE pure (bornes, grille) — invisible à l'écran quand elle est fausse ;
 *   ② le CÂBLAGE (le composant appelle-t-il vraiment cette logique ?) — un invariant pur
 *      ne dit RIEN de ce que l'appelant en fait, leçon du sabotage S3 ;
 *   ③ le PÉRIMÈTRE (aucun champ de date nu n'a survécu) — la leçon du jumeau non traité.
 */

/** Référence fixe. `now` est INJECTÉ partout : aucun test ne dépend de l'heure d'exécution. */
const LE_8_AOUT = new Date(2026, 7, 8)   // samedi 8 août 2026

/* ══════════════════════════════════════════════════════════════════════════════
   ① LOGIQUE PURE
   ══════════════════════════════════════════════════════════════════════════════ */

describe('isoOf / parseIso — composantes LOCALES, jamais UTC', () => {
  it('isoOf rend la date locale, pas la date UTC', () => {
    expect(isoOf(new Date(2026, 7, 8))).toBe('2026-08-08')
    expect(isoOf(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(isoOf(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('⚠️ isoOf ≠ toISOString().slice(0,10) dès que le fuseau est positif', () => {
    // Le 1er août à 00:00 LOCAL. En UTC+N, `toISOString()` recule au 31 juillet.
    const minuit = new Date(2026, 7, 1, 0, 0, 0)
    expect(isoOf(minuit)).toBe('2026-08-01')
    if (minuit.getTimezoneOffset() < 0) {
      expect(minuit.toISOString().slice(0, 10)).toBe('2026-07-31')  // la forme fautive
    }
  })

  it('parseIso fait l’aller-retour et refuse tout le reste', () => {
    expect(isoOf(parseIso('2026-08-08')!)).toBe('2026-08-08')
    for (const mauvais of ['', null, undefined, 'demain', '2026-8-8', '08/08/2026', '2026-13-01', '2026-02-31']) {
      expect(parseIso(mauvais as string), `« ${mauvais} » aurait dû être refusé`).toBeNull()
    }
  })

  it('⚠️ parseIso rend null, JAMAIS une date par défaut', () => {
    // Un repli silencieux ferait porter le filtre sur une période que personne n'a demandée.
    expect(parseIso('n’importe quoi')).toBeNull()
  })
})

describe('monthGrid', () => {
  it('rend TOUJOURS 42 cases, même pour un mois qui tient en 5 semaines', () => {
    for (let m = 0; m < 12; m++) expect(monthGrid(2026, m)).toHaveLength(42)
    expect(monthGrid(2021, 1)).toHaveLength(42)   // février 2021 : 28 j débutant un lundi
  })

  it('commence un LUNDI et contient tous les jours du mois', () => {
    const g = monthGrid(2026, 7)
    expect(g[0].getDay()).toBe(1)
    const duMois = g.filter(d => d.getMonth() === 7).map(d => d.getDate())
    expect(duMois).toHaveLength(31)
    expect(duMois[0]).toBe(1)
    expect(duMois[30]).toBe(31)
  })
})

describe('addMonths — pas de débordement de mois', () => {
  it('31 janvier − 1 mois ne saute pas en mars', () => {
    expect(isoOf(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(isoOf(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29')  // bissextile
  })
})

describe('presetRange — bornes ABSOLUES', () => {
  it('couvre les 8 raccourcis, sans trou', () => {
    for (const p of PERIOD_ORDER) {
      const r = presetRange(p, LE_8_AOUT)
      expect(parseIso(r.from), `${p} : from invalide`).not.toBeNull()
      expect(parseIso(r.to), `${p} : to invalide`).not.toBeNull()
      expect(parseIso(r.from)!.getTime()).toBeLessThanOrEqual(parseIso(r.to)!.getTime())
    }
    expect(PERIOD_ORDER).toHaveLength(8)
  })

  it('« 7 derniers jours » fait SEPT jours et INCLUT aujourd’hui', () => {
    const r = presetRange('7days', LE_8_AOUT)
    expect(r).toEqual({ from: '2026-08-02', to: '2026-08-08' })
    const jours = (parseIso(r.to)!.getTime() - parseIso(r.from)!.getTime()) / 86400000 + 1
    expect(jours, 'sept jours inclusifs, pas huit').toBe(7)
  })

  it('« 30 derniers jours » fait TRENTE jours', () => {
    const r = presetRange('30days', LE_8_AOUT)
    const jours = (parseIso(r.to)!.getTime() - parseIso(r.from)!.getTime()) / 86400000 + 1
    expect(jours).toBe(30)
  })

  it('hier, ce mois-ci, mois dernier, cette année', () => {
    expect(presetRange('today', LE_8_AOUT)).toEqual({ from: '2026-08-08', to: '2026-08-08' })
    expect(presetRange('yesterday', LE_8_AOUT)).toEqual({ from: '2026-08-07', to: '2026-08-07' })
    expect(presetRange('thisMonth', LE_8_AOUT)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    expect(presetRange('lastMonth', LE_8_AOUT)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(presetRange('year', LE_8_AOUT)).toEqual({ from: '2026-01-01', to: '2026-08-08' })
  })

  it('⚠️ le résultat ne dépend PAS de l’heure — c’était le défaut d’origine', () => {
    // `now − 30 jours` démarrait à l'heure d'ouverture du rapport : deux chiffres pour
    // le même écran selon qu'on l'ouvrait le matin ou l'après-midi.
    const matin = presetRange('30days', new Date(2026, 7, 8, 6, 12))
    const soir  = presetRange('30days', new Date(2026, 7, 8, 23, 47))
    expect(matin).toEqual(soir)
  })
})

describe('rangeToMs — la borne haute est la FIN du dernier jour', () => {
  it('inclut toute la journée de fin', () => {
    const ms = rangeToMs({ from: '2026-08-01', to: '2026-08-08' })!
    const fin = new Date(ms.to)
    expect(fin.getDate()).toBe(8)
    expect(fin.getHours()).toBe(23)
    expect(fin.getMinutes()).toBe(59)
    // Une vente à 18 h le dernier jour DOIT tomber dedans — c'est le défaut qu'on ferme.
    expect(new Date(2026, 7, 8, 18, 0).getTime()).toBeLessThanOrEqual(ms.to)
  })

  it('rend null sur une plage inversée ou incomplète', () => {
    expect(rangeToMs({ from: '2026-08-08', to: '2026-08-01' })).toBeNull()
    expect(rangeToMs({ from: '', to: '2026-08-01' })).toBeNull()
    expect(rangeToMs({ from: '2026-08-01', to: '' })).toBeNull()
  })
})

describe('orderRange / inRange', () => {
  it('orderRange remet les bornes dans l’ordre', () => {
    expect(orderRange('2026-08-20', '2026-08-05')).toEqual({ from: '2026-08-05', to: '2026-08-20' })
    expect(orderRange('2026-08-05', '2026-08-20')).toEqual({ from: '2026-08-05', to: '2026-08-20' })
  })

  it('inRange inclut LES DEUX bornes', () => {
    const r = { from: '2026-08-05', to: '2026-08-20' }
    expect(inRange(new Date(2026, 7, 5), r)).toBe(true)
    expect(inRange(new Date(2026, 7, 20), r)).toBe(true)
    expect(inRange(new Date(2026, 7, 12), r)).toBe(true)
    expect(inRange(new Date(2026, 7, 4), r)).toBe(false)
    expect(inRange(new Date(2026, 7, 21), r)).toBe(false)
  })
})

describe('clés de mois', () => {
  it('aller-retour, et refus du reste', () => {
    expect(monthKeyOf(new Date(2026, 7, 15))).toBe('2026-08')
    expect(monthKeyOf(parseMonthKey('2026-01')!)).toBe('2026-01')
    for (const mauvais of ['', 'Août 2026', '2026-13', '2026-8']) {
      expect(parseMonthKey(mauvais)).toBeNull()
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ② CÂBLAGE — sur le DOM rendu
   ══════════════════════════════════════════════════════════════════════════════ */

describe('DateField — le champ natif est CONSERVÉ', () => {
  it('⚠️ porte un vrai <input type="date"> avec son étiquette accessible', () => {
    // C'est la propriété que verrouille `hrContractDomain.test.tsx` : la saisie ne doit
    // pas être du texte libre. On remplace le CALENDRIER, jamais le champ.
    render(<DateField ariaLabel="Date d'embauche" value="2026-08-08" onChange={vi.fn()} now={LE_8_AOUT} />)
    const champ = screen.getByLabelText("Date d'embauche") as HTMLInputElement
    expect(champ.tagName).toBe('INPUT')
    expect(champ.getAttribute('type')).toBe('date')
    expect(champ.value).toBe('2026-08-08')
  })

  it('la saisie clavier remonte telle quelle', () => {
    let vu = ''
    render(<DateField ariaLabel="Date" value="" onChange={v => { vu = v }} now={LE_8_AOUT} />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-14' } })
    expect(vu).toBe('2026-03-14')
  })

  it('cliquer un jour du calendrier rend l’ISO de CE jour', () => {
    let vu = ''
    render(<DateField ariaLabel="Date" value="2026-08-08" onChange={v => { vu = v }} now={LE_8_AOUT} />)
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le calendrier/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: /lundi 17 août 2026/i }))
    expect(vu).toBe('2026-08-17')
  })

  it('⚠️ le panneau est en PORTAIL, hors du conteneur qui le rognerait', () => {
    // `.modal-box` porte `overflow:hidden` : un panneau absolu y serait coupé.
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <DateField ariaLabel="Date" value="" onChange={vi.fn()} now={LE_8_AOUT} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le calendrier/ }))
    const panneau = screen.getByRole('dialog', { name: 'Date' })
    expect(container.contains(panneau), 'le panneau est resté DANS le conteneur rognant').toBe(false)
    expect(document.body.contains(panneau)).toBe(true)
  })

  it('Échap referme le panneau', () => {
    render(<DateField ariaLabel="Date" value="" onChange={vi.fn()} now={LE_8_AOUT} />)
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le calendrier/ }))
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('respecte min/max : un jour hors bornes ne se choisit pas', () => {
    let vu = 'intact'
    render(<DateField ariaLabel="Date" value="" min="2026-08-10" onChange={v => { vu = v }} now={LE_8_AOUT} />)
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le calendrier/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: /mercredi 5 août 2026/i }))
    expect(vu).toBe('intact')
  })
})

describe('MonthField', () => {
  it('porte un <input type="month"> et rend la clé ISO du mois cliqué', () => {
    let vu = ''
    render(<MonthField ariaLabel="Période de paie" value="2026-08" onChange={v => { vu = v }} now={LE_8_AOUT} />)
    const champ = screen.getByLabelText('Période de paie') as HTMLInputElement
    expect(champ.getAttribute('type')).toBe('month')
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le calendrier/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mars' }))
    expect(vu).toBe('2026-03')
  })
})

describe('DateRangeField', () => {
  const monter = (surChangement: (n: { preset: unknown; from: string; to: string }) => void = vi.fn()) =>
    render(
      <DateRangeField
        from="2026-07-10" to="2026-08-08" preset={null}
        presetParDefaut="30days" onChange={surChangement}
        ariaLabel="Période du rapport" now={LE_8_AOUT}
      />,
    )

  it('la pastille affiche la plage au format jj/mm/aaaa', () => {
    monter()
    expect(screen.getByRole('button', { name: /Période du rapport/ }).textContent)
      .toContain('10/07/2026 — 08/08/2026')
  })

  it('⚠️ « Appliquer » n’est JAMAIS désactivé — il NOMME ce qui manque', () => {
    // Règle méta `landingClaims` : un bouton éteint gronde avant l'erreur et n'explique
    // rien au toucher. Ici, sélection incomplète → on dit quel jour choisir.
    let applique = false
    monter(() => { applique = true })
    fireEvent.click(screen.getByRole('button', { name: /Période du rapport/ }))
    const panneau = screen.getByRole('dialog')
    // Le panneau s'ouvre sur le mois de `from` (juillet) → on avance jusqu'à août.
    fireEvent.click(within(panneau).getByRole('button', { name: /Mois suivant/ }))

    // Un seul clic dans la grille : la fin manque.
    fireEvent.click(within(panneau).getByRole('gridcell', { name: /mercredi 12 août 2026/i }))
    const appliquer = within(panneau).getByRole('button', { name: /Appliquer/ })
    expect(appliquer).not.toBeDisabled()

    fireEvent.click(appliquer)
    expect(applique, 'une plage incomplète ne doit pas être appliquée').toBe(false)
    expect(within(panneau).getByRole('status').textContent).toMatch(/jour de FIN/i)
  })

  it('deux clics forment la plage, dans l’ordre où on les fait ou non', () => {
    let recu: { from: string; to: string } | null = null
    monter(n => { recu = n as { from: string; to: string } })
    fireEvent.click(screen.getByRole('button', { name: /Période du rapport/ }))
    const p = screen.getByRole('dialog')
    fireEvent.click(within(p).getByRole('button', { name: /Mois suivant/ }))
    fireEvent.click(within(p).getByRole('gridcell', { name: /lundi 24 août 2026/i }))
    fireEvent.click(within(p).getByRole('gridcell', { name: /mercredi 12 août 2026/i }))
    fireEvent.click(within(p).getByRole('button', { name: /Appliquer/ }))
    expect(recu).toEqual({ preset: null, from: '2026-08-12', to: '2026-08-24' })
  })

  it('un raccourci remplit les DEUX bornes et se retient', () => {
    let recu: { preset: string; from: string; to: string } | null = null
    monter(n => { recu = n as { preset: string; from: string; to: string } })
    fireEvent.click(screen.getByRole('button', { name: /Période du rapport/ }))
    const p = screen.getByRole('dialog')
    fireEvent.click(within(p).getByRole('button', { name: PERIOD_LABELS.fr.yesterday }))
    fireEvent.click(within(p).getByRole('button', { name: /Appliquer/ }))
    expect(recu).toEqual({ preset: 'yesterday', from: '2026-08-07', to: '2026-08-07' })
  })

  it('« Effacer » revient au raccourci par défaut, jamais à une période vide', () => {
    let recu: { preset: string; from: string; to: string } | null = null
    monter(n => { recu = n as { preset: string; from: string; to: string } })
    fireEvent.click(screen.getByRole('button', { name: /Période du rapport/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Effacer/ }))
    expect(recu).toEqual({ preset: '30days', ...presetRange('30days', LE_8_AOUT) })
  })

  it('rien n’est appliqué tant qu’« Appliquer » n’est pas cliqué', () => {
    let appels = 0
    monter(() => { appels++ })
    fireEvent.click(screen.getByRole('button', { name: /Période du rapport/ }))
    const p = screen.getByRole('dialog')
    fireEvent.click(within(p).getByRole('button', { name: PERIOD_LABELS.fr.today }))
    fireEvent.click(within(p).getByRole('gridcell', { name: /mercredi 5 août 2026/i }))
    expect(appels, 'le filtre se recalculait à chaque clic').toBe(0)
  })

  it('les 8 raccourcis sont proposés, dans les 4 langues', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Période du rapport/ }))
    const p = screen.getByRole('dialog')
    for (const cle of PERIOD_ORDER) {
      expect(within(p).getByRole('button', { name: PERIOD_LABELS.fr[cle] })).toBeInTheDocument()
    }
    for (const l of ['fr', 'en', 'es', 'it'] as const) {
      expect(Object.keys(PERIOD_LABELS[l]), `langue ${l} incomplète`).toHaveLength(8)
      for (const cle of PERIOD_ORDER) expect(PERIOD_LABELS[l][cle]?.length ?? 0).toBeGreaterThan(0)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ③ PÉRIMÈTRE — aucun champ de date NU n'a survécu
   ══════════════════════════════════════════════════════════════════════════════ */

describe('méta — plus aucun sélecteur de date nu dans src/', () => {
  const RACINE = path.resolve(__dirname, '..')
  /** Le composant lui-même EST l'implémentation : il porte légitimement les champs natifs. */
  const EXEMPTS = new Set([path.join(RACINE, 'components', 'ui', 'DatePicker.tsx')])

  const parcourir = (dir: string, acc: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'tests') parcourir(p, acc) }
      else if (/\.tsx$/.test(e.name)) acc.push(p)
    }
    return acc
  }

  let fichiers: string[] = []
  beforeEach(() => { fichiers = parcourir(RACINE) })

  it('⚠️ le scan LIT des fichiers — sinon il ne garde rien', () => {
    // Un `parcourir()` cassé rend une liste vide, donc un vert qui ne prouve rien.
    expect(fichiers.length).toBeGreaterThan(120)
    expect(fichiers.some(f => f.endsWith('DatePicker.tsx'))).toBe(true)
  })

  it('aucun type="date" / "month" hors du composant', () => {
    const fautifs: string[] = []
    for (const f of fichiers) {
      if (EXEMPTS.has(f)) continue
      const src = fs.readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')     // un commentaire qui CITE le motif n'est pas un défaut
        .replace(/\/\/[^\n]*/g, '')
      if (/type=["'](date|month)["']/.test(src)) fautifs.push(path.relative(RACINE, f))
    }
    expect(fautifs, `champs de date nus : ${fautifs.join(', ')}`).toEqual([])
  })

  it('⚠️ CONTRE-PREUVE : le scan détecte bien le motif quand il est là', () => {
    // Sans ce cas, un scan qui ne trouve jamais rien passerait pour un verrou.
    const faux = 'const x = <input type="date" value={v} />'
    expect(/type=["'](date|month)["']/.test(faux)).toBe(true)
    const commente = '// <input type="date" />'
    expect(/type=["'](date|month)["']/.test(commente.replace(/\/\/[^\n]*/g, ''))).toBe(false)
  })
})
