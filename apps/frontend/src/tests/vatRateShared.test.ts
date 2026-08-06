import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vatRateFor, vatRateOrZero, VAT_DOCUMENTED_COUNTRIES } from '@/lib/vatRate'

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
 * Il garde : l'accord de CE jumeau avec la fixture et le refus d'inventer un taux.
 * ⚠️ La garantie « les trois chemins de création écrivent `vatRate` » est BACKEND — elle vit
 * dans `apps/backend/src/tests/vatRateShared.test.ts`, là où sont les routes. Ce fichier ne
 * la duplique pas : un verrou recopié se périme du côté où personne ne le relit.
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


/* ⚠️ Pas de jumeau MOBILE : `mobile/` ne crée aucun tenant et ne porte aucun repli `?? 18`
   (vérifié — `POSConfirmModal` reçoit `vatRate` en prop, sans valeur par défaut). Un
   troisième jumeau serait du code mort, et le § « code mort » a déjà coûté un verrou qui
   criait au loup. */
