/**
 * ALIGNEMENT DU `vatRate` SUR LE PAYS DÉCLARÉ — mutation de PRODUCTION, sous garde.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * Avant `lib/vatRate.ts`, aucun chemin de création de tenant n'écrivait le taux :
 * tous héritaient du `vatRate Float @default(18)` de Prisma — le taux UEMOA. Les
 * tenants ouest-africains (SN, CI) sont donc justes par coïncidence. Le tenant
 * **FR** ne l'est pas : la France est à 20.
 *
 * ⚠️ LE TAUX EST DÉRIVÉ DE `vatRateFor(country)`, JAMAIS ÉCRIT ICI. Un script qui
 * recopierait « 20 » serait un cinquième endroit où le droit fiscal est écrit, et
 * il divergerait du module au premier changement de loi. Le module fait autorité ;
 * ce script ne fait que l'appliquer.
 *
 * ⚠️ UN PAYS NON DOCUMENTÉ (`vatRateFor` rend `null`) N'EST PAS TOUCHÉ. La table
 * est volontairement incomplète — 12 pays sur 32 — et on n'écrit que les taux
 * sourcés. Deviner reviendrait à écrire du droit fiscal de mémoire.
 *
 * ⚠️ AUCUNE DÉMO N'EST TOUCHÉE, et ce n'est pas un effet de bord : SN et CI sont
 * réellement à 18. Le script les LIT, constate qu'elles concordent, et n'écrit pas.
 *
 * Usage :  CONFIRM=1 npx tsx prisma/align-tenant-vat.ts
 * Sans CONFIRM : mesure seule, aucune écriture.
 */
import { basePrisma as prisma } from '../src/db'
import { vatRateFor } from '../src/lib/vatRate'
import { createHash } from 'node:crypto'

async function empreinte(): Promise<string> {
  const t = await prisma.tenant.findMany({ orderBy: { id: 'asc' } })
  const src = t.map(x => `${x.id}|${x.country}|${x.currency}|${x.vatRate}|${x.updatedAt.toISOString()}`).join('\n')
  return `${t.length} tenants — sha256 ${createHash('sha256').update(src).digest('hex')}`
}

async function main() {
  const confirme = process.env.CONFIRM === '1'
  const tenants = await prisma.tenant.findMany({ orderBy: { id: 'asc' } })

  console.log(`empreinte AVANT : ${await empreinte()}\n`)
  console.log('═══ VERDICT PAR TENANT ═══')

  const aCorriger: { id: string; nom: string; de: number; vers: number; objet: unknown }[] = []
  for (const t of tenants) {
    const attendu = vatRateFor(t.country)
    if (attendu === null) {
      console.log(`  ${t.id.padEnd(26)} ${t.country}  ${t.vatRate}  → pays NON DOCUMENTÉ, intouché`)
    } else if (attendu === t.vatRate) {
      console.log(`  ${t.id.padEnd(26)} ${t.country}  ${t.vatRate}  → concorde, intouché`)
    } else {
      console.log(`  ${t.id.padEnd(26)} ${t.country}  ${t.vatRate}  → ⚠️ ATTENDU ${attendu}`)
      aCorriger.push({ id: t.id, nom: t.name, de: t.vatRate, vers: attendu, objet: t })
    }
  }

  if (aCorriger.length === 0) {
    console.log('\nAucun écart. Rien à faire.')
    return
  }

  console.log(`\n═══ INSTANTANÉ AVANT — objet ENTIER des ${aCorriger.length} tenant(s) à corriger ═══`)
  for (const c of aCorriger) console.log(JSON.stringify(c.objet, null, 2))

  if (!confirme) {
    console.log('\n⚠️ CONFIRM=1 absent — MESURE SEULE, aucune écriture.')
    return
  }

  // ─── MUTATION ──────────────────────────────────────────────────────────────
  for (const c of aCorriger) {
    await prisma.tenant.update({ where: { id: c.id }, data: { vatRate: c.vers } })
    console.log(`\n✅ ${c.id} (${c.nom}) : vatRate ${c.de} → ${c.vers}`)
  }

  console.log('\n═══ DIFF DE L\'OBJET ENTIER, APRÈS ═══')
  console.log('⚠️ On relit TOUT l\'objet, pas le seul champ écrit : c\'est la seule façon de voir')
  console.log('   qu\'aucune autre colonne n\'a bougé (un `update` mal formé en touche d\'autres).')
  for (const c of aCorriger) {
    const apres = await prisma.tenant.findUnique({ where: { id: c.id } })
    const av = c.objet as Record<string, unknown>
    const ap = apres as unknown as Record<string, unknown>
    const bouges = Object.keys(av).filter(k => JSON.stringify(av[k]) !== JSON.stringify(ap?.[k]))
    console.log(`  ${c.id} — champs modifiés : ${bouges.join(', ')}`)
    const attendus = ['vatRate', 'updatedAt']
    const inattendus = bouges.filter(k => !attendus.includes(k))
    if (inattendus.length) throw new Error(`ÉCHEC : champs modifiés INATTENDUS → ${inattendus.join(', ')}`)
    if (ap?.['vatRate'] !== c.vers) throw new Error(`ÉCHEC : vatRate vaut ${String(ap?.['vatRate'])}, attendu ${c.vers}`)
  }

  console.log(`\nempreinte APRÈS : ${await empreinte()}`)
}

main()
  .catch(e => { console.error('\n❌', e instanceof Error ? e.message : e); process.exit(1) })
  .finally(() => prisma.$disconnect())
