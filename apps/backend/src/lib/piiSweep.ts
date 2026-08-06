/**
 * BALAYAGE — données personnelles RÉELLES dans un tenant de démonstration.
 *
 * ─── POURQUOI, MESURÉ le 2026-08-06 ──────────────────────────────────────────
 * `demo-tenant-001` — dont le mot de passe est PUBLIC — contenait un client portant un nom
 * réel, un mobile personnel `+336…`, une adresse postale à Marseille et un e-mail `@yahoo.fr`.
 * Saisi le 17/07, découvert le 06/08 : **trois semaines** en lecture publique. La donnée a été
 * anonymisée ; ce module existe pour que la PROCHAINE fois se voie en jours, pas en semaines.
 *
 * ⚠️ CE N'EST PAS UN GARDE — il n'empêche rien, il RAPPORTE. Empêcher supposerait de refuser
 * des saisies dans une démonstration dont l'intérêt est justement qu'on puisse tout y faire.
 * Le pari assumé : une démo qu'on peut salir mais qu'on regarde vaut mieux qu'une démo
 * verrouillée que personne n'essaie.
 *
 * ─── LA DÉTECTION EST DE FORME, PAS DE LISTE ─────────────────────────────────
 * On ne cherche pas « la France » ni « yahoo » : on cherche **ce qui n'est pas une fixture**.
 * Une liste de pays ou de fournisseurs de messagerie serait fausse au premier cas non prévu —
 * c'est le motif du périmètre écrit à la main, qui a déjà coûté `signup/` puis `\b8000\b`.
 *
 * ⚠️ Le critère « absent des seeds » de l'audit initial n'est PAS repris ici. Il exigeait de
 * lire les fichiers `prisma/seed*.ts` à l'exécution, et il a produit **8 faux positifs sur 12**
 * (apostrophe échappée `N\'Guessan`, domaines `.ci` et `.test` bien présents dans les seeds).
 * Un critère qui se trompe deux fois sur trois se fait désarmer. La forme suffit.
 */

/** Indicatifs des marchés servis par les jeux de démonstration. Tout autre `+` est signalé. */
export const INDICATIFS_FIXTURE = ['+221', '+225', '+237'] as const

/** Domaines employés par les seeds et l'outillage. Tout autre domaine est signalé. */
export const DOMAINES_FIXTURE = [
  'habashop.com', 'habashop.sn', 'demo.sn', 'demo.ci', 'shop.com',
  'vivriers.ci', 'corpsgras.ci', 'kone-alim.ci', 'e2e.test', 'e2e.habashop.com',
] as const

export type Signalement = {
  tenantId: string
  table: 'customer' | 'employee' | 'supplier' | 'tenant' | 'user'
  id: string
  champs: string[]
}

type Ligne = { id: string; phone?: string | null; email?: string | null }

/**
 * ⚠️ Un numéro SANS `+` n'est pas signalé : impossible de trancher son pays, et signaler
 * l'indécidable produirait du bruit qui ferait ignorer le reste. Limite ASSUMÉE — une saisie
 * réelle au format local passerait. La contrepartie est un rapport qu'on lit vraiment.
 */
export function telHorsFixture(tel: unknown): boolean {
  if (typeof tel !== 'string' || !tel.trim()) return false
  const n = tel.replace(/[\s.()\-\u00a0\u202f]/g, '')  // ⚠️ espaces insécables ÉCHAPPÉS : `no-irregular-whitespace` interdit le littéral
  if (!n.startsWith('+')) return false
  return !INDICATIFS_FIXTURE.some(i => n.startsWith(i))
}

export function mailHorsFixture(mail: unknown): boolean {
  if (typeof mail !== 'string' || !mail.includes('@')) return false
  const d = mail.split('@').pop()?.toLowerCase().trim()
  return !!d && !DOMAINES_FIXTURE.includes(d as (typeof DOMAINES_FIXTURE)[number])
}

/** Les champs d'une ligne qui sortent du jeu de fixture. Vide = rien à signaler. */
export function champsHorsFixture(l: Ligne): string[] {
  const out: string[] = []
  if (telHorsFixture(l.phone)) out.push('phone')
  if (mailHorsFixture(l.email)) out.push('email')
  return out
}

/**
 * Balaye les tenants `isDemo` et rend les lignes portant des coordonnées hors fixture.
 *
 * ⚠️ Périmètre : `isDemo` UNIQUEMENT. Un tenant client réel contient légitimement des
 * coordonnées réelles — l'y signaler serait du bruit, et donnerait l'impression que l'outil
 * surveille les clients. Il ne surveille que ce qui est PUBLIC.
 */
export async function balayerDemos(prisma: {
  tenant: { findMany: (a: unknown) => Promise<{ id: string; phone: string | null; email: string | null }[]> }
  customer: { findMany: (a: unknown) => Promise<Ligne[]> }
  employee: { findMany: (a: unknown) => Promise<Ligne[]> }
  supplier: { findMany: (a: unknown) => Promise<Ligne[]> }
  user: { findMany: (a: unknown) => Promise<{ id: string; email: string | null }[]> }
}): Promise<Signalement[]> {
  const demos = await prisma.tenant.findMany({
    where: { isDemo: true },
    select: { id: true, phone: true, email: true },
  })
  const out: Signalement[] = []
  for (const t of demos) {
    const champsTenant = champsHorsFixture(t)
    if (champsTenant.length) out.push({ tenantId: t.id, table: 'tenant', id: t.id, champs: champsTenant })

    const sel = { id: true, phone: true, email: true }
    const where = { tenantId: t.id }
    for (const [table, rows] of [
      ['customer', await prisma.customer.findMany({ where, select: sel })],
      ['employee', await prisma.employee.findMany({ where, select: sel })],
      ['supplier', await prisma.supplier.findMany({ where, select: sel })],
    ] as const) {
      for (const r of rows) {
        const c = champsHorsFixture(r)
        if (c.length) out.push({ tenantId: t.id, table, id: r.id, champs: c })
      }
    }
    for (const u of await prisma.user.findMany({ where, select: { id: true, email: true } })) {
      const c = champsHorsFixture(u)
      if (c.length) out.push({ tenantId: t.id, table: 'user', id: u.id, champs: c })
    }
  }
  return out
}

/** Rapport lisible. ⚠️ AUCUNE valeur n'est reproduite — ni numéro, ni e-mail (§ PII). */
export function rapporter(s: Signalement[]): string {
  if (s.length === 0) return '[pii-sweep] OK — aucune coordonnée hors fixture dans les tenants de démonstration.'
  const l = s.map(x => `  ${x.tenantId} · ${x.table} · ${x.id} · champs: ${x.champs.join('+')}`)
  return [
    `[pii-sweep] ⚠️ ${s.length} ligne(s) portant des coordonnées HORS FIXTURE dans un tenant PUBLIC :`,
    ...l,
    '  → vérifier s\'il s\'agit de données réelles ; anonymiser si oui (cf. § Comptes démo).',
  ].join('\n')
}
