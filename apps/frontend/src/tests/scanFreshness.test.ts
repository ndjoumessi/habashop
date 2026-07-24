import { describe, it, expect, vi } from 'vitest'
import { resolveScannedCode, withDeadline, SCAN_LOOKUP_DEADLINE_MS } from '@/components/pos/scanResolve'
import {
  oldestFreshness, freshnessAge, freshnessLevel, freshnessLabel, freshnessKindLabel,
} from '@/lib/dataFreshness'

/**
 * Chantier B — fraîcheur du cache POS (classe « affichage »).
 *
 * Deux exigences que ces tests verrouillent dans les DEUX sens :
 *  · un scan raté sur cache périmé consulte le serveur AVANT de conclure, et s'il
 *    résout, l'encaissement continue sans le moindre message ;
 *  · quand rien ne résout, le POS ne dit QUE ce qu'il sait — « pas dans MON catalogue »,
 *    jamais « ce produit n'existe pas ».
 * Et dans tous les cas : rien ne bloque, rien ne lève.
 */

type P = { id: string; barcode: string; name: string }
const matches = (p: P, raw: string) => p.barcode === raw
const LOCAL: P[] = [{ id: 'p1', barcode: '4006381333931', name: 'Riz' }]
const NEUF: P = { id: 'p9', barcode: '5901234123457', name: 'Produit créé ce matin' }

describe('resolveScannedCode — le cache local ne fait pas autorité', () => {
  it('trouvé localement → aucun appel réseau', async () => {
    const lookup = vi.fn()
    const r = await resolveScannedCode('4006381333931', LOCAL, matches, lookup)
    expect(r).toEqual({ kind: 'local', product: LOCAL[0] })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('absent du cache MAIS connu du serveur → résolu, marqué « remote » (donc aucun message)', async () => {
    const lookup = vi.fn().mockResolvedValue(NEUF)
    const r = await resolveScannedCode('5901234123457', LOCAL, matches, lookup)
    expect(r).toEqual({ kind: 'remote', product: NEUF })
    expect(lookup).toHaveBeenCalledWith('5901234123457')
  })

  it('absent des deux → unresolved (le message honnête est alors du ressort de l’UI)', async () => {
    const r = await resolveScannedCode('0000000000000', LOCAL, matches, vi.fn().mockResolvedValue(null))
    expect(r).toEqual({ kind: 'unresolved' })
  })

  it('code vide → unresolved sans appel', async () => {
    const lookup = vi.fn()
    expect(await resolveScannedCode('   ', LOCAL, matches, lookup)).toEqual({ kind: 'unresolved' })
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('FAIL-OPEN — aucune panne réseau ne bloque la caisse', () => {
  it('serveur en erreur → unresolved, jamais de rejet propagé', async () => {
    const r = await resolveScannedCode('5901234123457', LOCAL, matches, () => Promise.reject(new Error('offline')))
    expect(r).toEqual({ kind: 'unresolved' })
  })

  it('serveur trop lent → l’échéance rend la main (pas d’attente indéfinie)', async () => {
    vi.useFakeTimers()
    const slow = new Promise<P>(res => setTimeout(() => res(NEUF), 60_000))
    const p = resolveScannedCode('5901234123457', LOCAL, matches, () => slow, { deadlineMs: 1200 })
    await vi.advanceTimersByTimeAsync(1300)
    expect(await p).toEqual({ kind: 'unresolved' })
    vi.useRealTimers()
  })

  it('une réponse ARRIVÉE avant l’échéance est bien utilisée', async () => {
    vi.useFakeTimers()
    const quick = new Promise<P>(res => setTimeout(() => res(NEUF), 300))
    const p = resolveScannedCode('5901234123457', LOCAL, matches, () => quick, { deadlineMs: 1200 })
    await vi.advanceTimersByTimeAsync(400)
    expect(await p).toEqual({ kind: 'remote', product: NEUF })
    vi.useRealTimers()
  })

  it('withDeadline ne rejette jamais, quelle que soit la panne', async () => {
    await expect(withDeadline(Promise.reject(new Error('boom')), 50)).resolves.toBeNull()
    await expect(withDeadline(Promise.resolve(undefined as unknown as P), 50)).resolves.toBeNull()
  })

  it('l’échéance par défaut reste sous la seconde et demie (perception caisse)', () => {
    expect(SCAN_LOOKUP_DEADLINE_MS).toBeLessThanOrEqual(1500)
  })
})

describe('oldestFreshness — le PLUS ANCIEN, pas une moyenne rassurante', () => {
  const NOW = 1_760_000_000_000

  it('renvoie la classe la moins fraîche', () => {
    const r = oldestFreshness({ catalog: NOW - 3 * 3600_000 })
    expect(r).toEqual({ kind: 'catalog', at: NOW - 3 * 3600_000, neverSynced: false })
  })

  it('une classe JAMAIS synchronisée l’emporte sur toute date', () => {
    expect(oldestFreshness({})).toEqual({ kind: 'catalog', at: null, neverSynced: true })
  })

  it('aucune classe surveillée → rien à afficher', () => {
    expect(oldestFreshness({ catalog: NOW }, [])).toBeNull()
  })

  /**
   * ⚠️ Une seule classe existe aujourd'hui ('catalog'), donc « le plus ancien » et
   * « le plus récent » y sont indistinguables — la règle serait latente et un futur
   * ajout de classe pourrait la casser sans rien faire rougir. On l'exerce donc sur
   * DEUX classes synthétiques : c'est là que le mensonge se produirait (vert parce
   * qu'une classe secondaire vient de se rafraîchir, alors que les prix ont 3 h).
   */
  it('avec DEUX classes, renvoie bien la plus VIEILLE (pas la plus récente)', () => {
    const kinds = ['catalog', 'images'] as unknown as readonly 'catalog'[]
    const map = { catalog: NOW - 3 * 3600_000, images: NOW - 60_000 } as unknown as { catalog: number }
    expect(oldestFreshness(map, kinds)).toEqual({ kind: 'catalog', at: NOW - 3 * 3600_000, neverSynced: false })
  })

  it('avec DEUX classes, « jamais synchronisé » prime encore', () => {
    const kinds = ['catalog', 'images'] as unknown as readonly 'catalog'[]
    const map = { catalog: NOW } as unknown as { catalog: number }
    expect(oldestFreshness(map, kinds)?.neverSynced).toBe(true)
  })
})

describe('âge, palier, libellé — informer sans jamais restreindre', () => {
  const NOW = 1_760_000_000_000

  it('une horloge qui recule ne produit pas d’âge négatif', () => {
    expect(freshnessAge(NOW + 5000, NOW)).toBe(0)
  })

  it('paliers indicatifs', () => {
    expect(freshnessLevel(60_000)).toBe('fresh')
    expect(freshnessLevel(3600_000)).toBe('aging')
    expect(freshnessLevel(48 * 3600_000)).toBe('stale')
    expect(freshnessLevel(null)).toBe('stale')
  })

  it('libellés dans les 4 langues', () => {
    expect(freshnessLabel(3 * 60_000, 'fr')).toBe('il y a 3 min')
    expect(freshnessLabel(3 * 60_000, 'en')).toBe('3 min ago')
    expect(freshnessLabel(2 * 3600_000, 'es')).toBe('hace 2 h')
    expect(freshnessLabel(2 * 86_400_000, 'it')).toBe('2 g fa')
  })

  it('« jamais synchronisé » est dit tel quel — on n’invente pas une date', () => {
    expect(freshnessLabel(null, 'fr')).toBe('jamais synchronisé')
    expect(freshnessLabel(null, 'en')).toBe('never synced')
  })

  it('moins d’une minute → « à l’instant »', () => {
    expect(freshnessLabel(5_000, 'fr')).toBe("à l'instant")
  })

  it('la classe se nomme dans les 4 langues (détail au survol/tap)', () => {
    expect(freshnessKindLabel('catalog', 'fr')).toBe('Catalogue et prix')
    expect(freshnessKindLabel('catalog', 'it')).toBe('Catalogo e prezzi')
  })
})
