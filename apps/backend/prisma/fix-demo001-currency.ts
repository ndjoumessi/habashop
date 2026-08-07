/**
 * demo-tenant-001 : `XAF` → `XOF`. Le Sénégal est UEMOA.
 *
 * ⚠️ CE FICHIER EST COMMITÉ EXPRÈS, ET C'EST LA MOITIÉ DU CORRECTIF.
 * La correction du 2026-08-06 (`a5bfb27f`) a été faite par un script jamais commité et un
 * instantané jamais conservé. Son message affirme « diff de l'instantané COMPLET : deux
 * lignes, currency et updatedAt » — invérifiable un jour plus tard, quand la base a rendu
 * `XAF`. *Une assertion dont on a supprimé le moyen de vérification n'est plus une preuve.*
 * Le geste se rejoue ici ; l'instantané part dans un fichier daté, hors du dépôt.
 *
 * ⚠️ CE SCRIPT N'EST PAS LE CORRECTIF DU DÉFAUT — il n'en corrige que la VALEUR.
 * Le correctif est `lib/currencyZone.ts` + les quatre gardes de route : sans eux, on purge
 * un réservoir qui fuit. Ne pas lancer ceci avant que le garde soit en production.
 *
 *   CONFIRM=1 npx tsx prisma/fix-demo001-currency.ts
 *
 * Sans `CONFIRM=1`, il n'écrit RIEN : il imprime l'instantané et le SQL qu'il exécuterait.
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/** ⚠️ Périmètre EN DUR. Un périmètre passé en argument est un périmètre qu'on peut mal taper. */
const CIBLE = 'demo-tenant-001'
const ATTENDU_AVANT = 'XAF'
const APRES = 'XOF'

const prisma = new PrismaClient()

/** Empreinte de TOUS les tenants — c'est elle qui prouve qu'on n'a pas touché les autres. */
async function empreinte(): Promise<string> {
  const t = await prisma.tenant.findMany({
    select: { id: true, country: true, currency: true, vatRate: true, updatedAt: true },
    orderBy: { id: 'asc' },
  })
  return createHash('sha256').update(JSON.stringify(t)).digest('hex').slice(0, 16)
}

/** Les montants ne doivent PAS bouger : tout est stocké en XOF de base. Le PROUVER. */
async function ventes() {
  const a = await prisma.sale.aggregate({ where: { tenantId: CIBLE }, _count: true, _sum: { total: true } })
  return { n: a._count, somme: a._sum.total }
}

async function main() {
  const avant = await prisma.tenant.findUnique({ where: { id: CIBLE } })
  if (!avant) throw new Error(`${CIBLE} introuvable — périmètre invalide, on n'écrit rien.`)

  // ⚠️ Trois refus AVANT toute écriture, dans cet ordre.
  if (avant.isDemo !== true) throw new Error(`${CIBLE} n'est pas isDemo — refus.`)
  if (avant.currency !== ATTENDU_AVANT) {
    throw new Error(`${CIBLE} porte ${avant.currency}, pas ${ATTENDU_AVANT} : quelqu'un a écrit entre-temps. Refus — relancer l'enquête, pas l'écriture.`)
  }
  if (avant.country !== 'SN') throw new Error(`${CIBLE} porte country=${avant.country} : le motif UEMOA ne tient plus. Refus.`)

  const empAvant = await empreinte()
  const vAvant = await ventes()
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const chemin = `/tmp/demo001-currency-${horodatage}.json`
  writeFileSync(chemin, JSON.stringify({ avant, empreinte: empAvant, ventes: vAvant }, null, 2))

  console.log('  instantané COMPLET (objet entier) :', chemin)
  console.log('  empreinte des 4 tenants AVANT     :', empAvant)
  console.log('  ventes AVANT                      :', vAvant.n, 'lignes, somme', vAvant.somme)
  console.log('  SQL équivalent :')
  console.log(`    UPDATE "Tenant" SET "currency" = '${APRES}' WHERE "id" = '${CIBLE}' AND "currency" = '${ATTENDU_AVANT}' AND "isDemo" = true;`)

  if (process.env.CONFIRM !== '1') {
    console.log('\n  CONFIRM=1 absent — RIEN n\'a été écrit.')
    return
  }

  // `updateMany` + les mêmes conditions dans le `where` : la garde est dans la requête,
  // pas seulement dans le contrôle ci-dessus. Une écriture concurrente rendrait count=0.
  const res = await prisma.tenant.updateMany({
    where: { id: CIBLE, currency: ATTENDU_AVANT, isDemo: true },
    data: { currency: APRES },
  })
  if (res.count !== 1) throw new Error(`updateMany a touché ${res.count} ligne(s) — attendu 1.`)

  const apres = await prisma.tenant.findUnique({ where: { id: CIBLE } })
  const empApres = await empreinte()
  const vApres = await ventes()

  // ⚠️ Diff de l'objet ENTIER, pas des colonnes qu'on croit avoir touchées.
  const diff = Object.keys({ ...avant, ...apres }).filter(
    k => JSON.stringify((avant as Record<string, unknown>)[k]) !== JSON.stringify((apres as Record<string, unknown>)[k]),
  )
  console.log('\n  colonnes RÉELLEMENT modifiées :', diff)
  console.log('  empreinte APRÈS               :', empApres, empAvant === empApres ? '(inchangée — anormal)' : '(changée, attendu)')
  console.log('  ventes APRÈS                  :', vApres.n, 'lignes, somme', vApres.somme)

  if (vApres.n !== vAvant.n || vApres.somme !== vAvant.somme) {
    throw new Error('LES MONTANTS ONT BOUGÉ — `tenant.currency` devait être une préférence d\'affichage.')
  }
  const attendu = ['currency', 'updatedAt']
  const inattendu = diff.filter(k => !attendu.includes(k))
  if (inattendu.length) throw new Error(`colonnes inattendues modifiées : ${inattendu.join(', ')}`)
  console.log('\n  ✅ une seule ligne, deux colonnes, aucun montant déplacé.')
}

main()
  .catch(e => { console.error('  ✖', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
