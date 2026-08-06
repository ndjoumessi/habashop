import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { vatRateFor, vatRateOrZero, VAT_DOCUMENTED_COUNTRIES } from '../lib/vatRate'

/**
 * VERROU — la TVA se DÉRIVE du pays, et le `@default(18)` du schéma ne peut plus servir.
 *
 * ─── LE DÉFAUT, MESURÉ le 2026-08-06 ─────────────────────────────────────────
 * Aucun mapping pays → TVA n'existait. Le taux venait d'un `@default(18)` Prisma — le taux
 * UEMOA — et **aucun** des trois chemins de création de tenant n'écrivait `vatRate` :
 *
 *   POST /api/auth/register      → 18 %
 *   POST /api/tenant             → 18 %
 *   POST /api/admin/tenants      → 18 %
 *
 * Depuis que le marché par défaut est le Cameroun, toute inscription camerounaise recevait
 * donc 18 % au lieu de **19,25 %**, silencieusement, sur des factures. Deux `?? 18` de plus
 * vivaient dans `reports.ts` (un RAPPORT de TVA) et un dans `SectionPOS`.
 *
 * ─── CE QUE CE VERROU GARDE, ET CE QU'IL NE GARDE PAS ────────────────────────
 * Il garde : l'accord des deux jumeaux avec la fixture, le refus d'inventer un taux, et le
 * fait que les TROIS chemins de création écrivent `vatRate` explicitement.
 * Il ne garde PAS l'exactitude fiscale des taux — ce sont des faits juridiques, sourcés dans
 * `docs/shared-fixtures/vat-rates.json`, pas déductibles du code.
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const FIXTURE = JSON.parse(
  readFileSync(join(RACINE, 'docs', 'shared-fixtures', 'vat-rates.json'), 'utf8'),
) as { rates: Record<string, number>; _cas: { pays: string; attendu: number | null; pourquoi: string }[] }

describe('taux de TVA par pays — cas partagés', () => {
  it('COUVERTURE — la fixture est bien lue et porte des cas', () => {
    // Angle mort n°1 : un JSON tronqué rendrait tous les cas ci-dessous vides, donc verts.
    expect(Object.keys(FIXTURE.rates).length).toBeGreaterThanOrEqual(10)
    expect(FIXTURE._cas.length).toBeGreaterThanOrEqual(8)
    expect(FIXTURE._cas.some(c => c.attendu === null)).toBe(true)   // des ABSENCES sont testées
  })

  it('chaque cas partagé est rendu à l’identique par ce jumeau', () => {
    for (const c of FIXTURE._cas) {
      expect(vatRateFor(c.pays), `${c.pays} — ${c.pourquoi}`).toBe(c.attendu)
    }
  })

  it('la table du module est EXACTEMENT celle de la fixture', () => {
    // Modifier un taux d'un seul côté doit faire rougir : c'est tout l'objet du jumelage.
    expect([...VAT_DOCUMENTED_COUNTRIES].sort()).toEqual(Object.keys(FIXTURE.rates).sort())
    for (const [pays, taux] of Object.entries(FIXTURE.rates)) {
      expect(vatRateFor(pays), `taux de ${pays}`).toBe(taux)
    }
  })

  it('CEMAC n’est PAS homogène — trois taux distincts, et c’est le piège', () => {
    // Traiter « zone franc » comme un bloc était exactement l'erreur du `@default(18)`.
    expect(vatRateFor('CM')).toBe(19.25)
    expect(vatRateFor('GA')).toBe(18)
    expect(vatRateFor('CG')).toBe(18.9)
    expect(new Set(['CM', 'GA', 'CG'].map(vatRateFor)).size).toBe(3)
  })

  it('un pays NON documenté rend `null`, jamais un taux inventé', () => {
    for (const p of ['TD', 'CF', 'GQ', 'CD', 'US', 'CA', 'XX', '', 'sénégal']) {
      expect(vatRateFor(p), `« ${p} » ne doit pas recevoir de taux fabriqué`).toBeNull()
    }
    // ⚠️ `unknown` en entrée : la valeur vient d'un corps de requête et d'une colonne.
    expect(vatRateFor(null)).toBeNull()
    expect(vatRateFor(undefined)).toBeNull()
    expect(vatRateFor(18)).toBeNull()
    expect(vatRateFor({ country: 'CM' })).toBeNull()
  })

  it('la casse et les espaces ne changent pas le taux', () => {
    expect(vatRateFor(' cm ')).toBe(19.25)
    expect(vatRateFor('Fr')).toBe(20)
  })

  it('`vatRateOrZero` écrit 0 sur l’inconnu — bruyant, pas faux', () => {
    // Sous-facturer VISIBLEMENT vaut mieux que facturer faux en silence : 0 se voit au POS,
    // un 18 erroné part sur des factures sans que personne ne le remarque.
    expect(vatRateOrZero('TD')).toBe(0)
    expect(vatRateOrZero(undefined)).toBe(0)
    expect(vatRateOrZero('CM')).toBe(19.25)
    // ⚠️ Le repli ne doit JAMAIS valoir 18 : c'est le défaut qu'on vient de retirer.
    for (const p of ['TD', 'CF', 'GQ', 'XX', '']) expect(vatRateOrZero(p)).not.toBe(18)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   LE `@default(18)` NE DOIT PLUS POUVOIR SE DÉCLENCHER
   ══════════════════════════════════════════════════════════════════════════════ */
describe('tous les chemins de création écrivent `vatRate`', () => {
  /** Fichiers de routes — périmètre DÉRIVÉ de l'arborescence, jamais une liste écrite. */
  function routes(): string[] {
    const d = join(__dirname, '..', 'routes')
    return readdirSync(d).map(f => join(d, f)).filter(f => statSync(f).isFile() && f.endsWith('.ts'))
  }
  const codeSeul = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

  it('COUVERTURE — le scan lit bien le dossier des routes', () => {
    expect(routes().length).toBeGreaterThan(15)
  })

  it('AUCUN `tenant.create` sans `vatRate` explicite', () => {
    // ⚠️ La garantie ne peut pas venir du schéma : `@default(18)` reste écrit là-bas, et le
    // changer imposerait une migration DDL sur la PROD. On rend donc le défaut INATTEIGNABLE
    // en exigeant que chaque site de création pose la valeur — c'est vérifiable ici, et sans
    // toucher à la base. Un `@default` qui ne se déclenche jamais ne peut plus mentir.
    const nus: string[] = []
    let trouves = 0
    for (const f of routes()) {
      const src = codeSeul(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(/\btenant\.create\s*\(\s*\{[\s\S]{0,900}?\n\s*\}\s*\)/g)) {
        trouves++
        if (!/\bvatRate\s*:/.test(m[0])) nus.push(f.split('/routes/')[1])
      }
    }
    expect(trouves, 'aucun `tenant.create` trouvé — le scan ne garde rien').toBeGreaterThanOrEqual(3)
    expect(nus, [
      'Un tenant créé sans `vatRate` hérite du `@default(18)` du schéma — le taux UEMOA —',
      'quel que soit son pays. Poser `vatRate: vatRateOrZero(<pays>)`.',
    ].join('\n')).toEqual([])
  })

  it('plus aucun repli codé en dur sur 18 dans les routes', () => {
    // `?? 18` vivait deux fois dans `reports.ts` — dans un RAPPORT DE TVA.
    const coupables: string[] = []
    for (const f of routes()) {
      const src = codeSeul(readFileSync(f, 'utf8'))
      if (/vatRate\s*(\?\?|\|\|)\s*1[0-9]/.test(src)) coupables.push(f.split('/routes/')[1])
    }
    expect(coupables).toEqual([])
  })
})
