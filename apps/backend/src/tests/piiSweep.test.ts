import { describe, it, expect } from 'vitest'
import { telHorsFixture, mailHorsFixture, champsHorsFixture, balayerDemos, rapporter } from '../lib/piiSweep'

/**
 * VERROU — le balayage voit ce qui a réellement fui, et ne crie pas sur le reste.
 *
 * ─── LE CAS RÉEL, REJOUÉ ─────────────────────────────────────────────────────
 * `demo-tenant-001` — mot de passe PUBLIC — a porté du 17/07 au 06/08 un client avec un nom
 * réel, un mobile `+33…`, une adresse à Marseille et un e-mail `@yahoo.fr`. Trois semaines.
 * Les valeurs ci-dessous sont des FORMES équivalentes, jamais les vraies (§ PII).
 *
 * ─── ET LES HUIT FAUX POSITIFS DE LA PREMIÈRE MESURE ─────────────────────────
 * L'audit initial signalait 12 lignes ; 8 étaient des artefacts de la mesure elle-même :
 * apostrophe échappée dans le seed (`N\\'Guessan`), domaines `.ci` et `.test` pourtant écrits
 * par les seeds. **Un critère qui se trompe deux fois sur trois se fait désarmer** — d'où
 * l'abandon du critère « absent des seeds » et les cas ci-dessous, qui figent le silence.
 */

describe('détection de forme', () => {
  it('signale un indicatif hors des marchés de démonstration', () => {
    for (const t of ['+33661751923', '+32 470 00 00 00', '+1 415 555 0000', '+44 7700 900000'])
      expect(telHorsFixture(t), t).toBe(true)
  })

  it('ne signale AUCUN indicatif de fixture, quelle que soit la ponctuation', () => {
    for (const t of ['+221771234567', '+225 07 00 00 10', '+237 6 99 00 00 01', '+221 77 000 09 01'])
      expect(telHorsFixture(t), t).toBe(false)
  })

  it('⚠️ un numéro SANS `+` n’est pas signalé — limite ASSUMÉE', () => {
    // On ne peut pas trancher son pays. Signaler l'indécidable produirait du bruit, et un
    // rapport bruyant finit ignoré : c'est ce qui rendrait la vraie fuite invisible.
    for (const t of ['0661751923', '77 123 45 67', '', null, undefined, 12345])
      expect(telHorsFixture(t as never), String(t)).toBe(false)
  })

  it('signale un domaine de messagerie personnel', () => {
    for (const m of ['x@yahoo.fr', 'x@gmail.com', 'x@outlook.com', 'x@hotmail.fr', 'x@proton.me'])
      expect(mailHorsFixture(m), m).toBe(true)
  })

  it('ne signale AUCUN domaine écrit par les seeds — les 8 faux positifs figés', () => {
    // Ces domaines ONT été signalés à tort par la première mesure. Ils ne doivent plus l'être.
    for (const m of ['a@habashop.com', 'a@demo.sn', 'a@shop.com', 'a@habashop.sn',
      'contact@vivriers.ci', 'info@corpsgras.ci', 'a@kone-alim.ci', 'teranga@e2e.test'])
      expect(mailHorsFixture(m), m).toBe(false)
  })

  it('champsHorsFixture nomme les CHAMPS, jamais les valeurs', () => {
    const c = champsHorsFixture({ id: 'x', phone: '+33661751923', email: 'x@yahoo.fr' })
    expect(c).toEqual(['phone', 'email'])
    expect(champsHorsFixture({ id: 'x', phone: '+221771234567', email: 'a@demo.sn' })).toEqual([])
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   PÉRIMÈTRE ET RAPPORT
   ══════════════════════════════════════════════════════════════════════════════ */
function faussePrisma(opts: { demos: string[]; clients?: Record<string, unknown[]> }) {
  const vus: unknown[] = []
  const rien = async () => []
  return {
    _vus: vus,
    tenant: { findMany: async (a: { where?: { isDemo?: boolean } }) => {
      // ⚠️ Le mock APPLIQUE son filtre : sans ça, il rendrait la même liste même si le code
      // cessait d'envoyer `isDemo`, et le test décrirait un monde qui n'existe pas.
      vus.push(a)
      if (a?.where?.isDemo !== true) return []
      return opts.demos.map(id => ({ id, phone: null, email: null }))
    } },
    customer: { findMany: async (a: { where?: { tenantId?: string } }) =>
      (opts.clients?.[a?.where?.tenantId ?? ''] ?? []) as never },
    employee: { findMany: rien }, supplier: { findMany: rien }, user: { findMany: rien },
  }
}

describe('périmètre du balayage', () => {
  it('ne balaye QUE les tenants `isDemo`', async () => {
    const p = faussePrisma({ demos: ['demo-1'] })
    await balayerDemos(p as never)
    const filtre = (p._vus[0] as { where?: { isDemo?: boolean } })?.where
    expect(filtre, 'le balayage doit filtrer sur isDemo — un tenant client contient légitimement des données réelles').toEqual({ isDemo: true })
  })

  it('retrouve le cas RÉEL du 2026-08-06', async () => {
    const p = faussePrisma({
      demos: ['demo-1'],
      clients: { 'demo-1': [{ id: 'c1', phone: '+33661751923', email: 'x@yahoo.fr' }] },
    })
    const s = await balayerDemos(p as never)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ tenantId: 'demo-1', table: 'customer', id: 'c1', champs: ['phone', 'email'] })
  })

  it('reste SILENCIEUX sur un jeu de démonstration propre', async () => {
    const p = faussePrisma({
      demos: ['demo-1'],
      clients: { 'demo-1': [
        { id: 'c1', phone: '+221 77 000 09 01', email: 'client01@demo.sn' },
        { id: 'c2', phone: '+225 07 00 00 10', email: 'teranga@demo.sn' },
      ] },
    })
    expect(await balayerDemos(p as never)).toEqual([])
  })

  it('le rapport ne reproduit AUCUNE valeur — ni numéro, ni e-mail', async () => {
    // ⚠️ Un rapport qui recopierait le numéro pour le signaler l'écrirait dans les logs
    // Railway : il DÉPLACERAIT la fuite au lieu de la fermer (§ PII, `redactPhone`).
    const p = faussePrisma({
      demos: ['demo-1'],
      clients: { 'demo-1': [{ id: 'c1', phone: '+33661751923', email: 'dromel@yahoo.fr' }] },
    })
    const texte = rapporter(await balayerDemos(p as never))
    expect(texte).toContain('c1')
    expect(texte).toContain('phone+email')
    expect(texte).not.toContain('33661751923')
    expect(texte).not.toContain('yahoo')
    expect(texte).not.toContain('dromel')
  })

  it('rapport vide = message explicite, jamais une chaîne muette', () => {
    expect(rapporter([])).toMatch(/aucune coordonnée hors fixture/i)
  })
})
