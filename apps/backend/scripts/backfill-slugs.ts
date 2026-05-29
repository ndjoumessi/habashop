// Migration one-shot : génère un slug pour tous les tenants existants sans slug.
// À exécuter UNE FOIS après le déploiement du schéma.
//   cd apps/backend && npx tsx scripts/backfill-slugs.ts

import { prisma } from '../src/db'
import { generateUniqueSlug } from '../src/utils/slug'

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: null, deletedAt: null },
    select: { id: true, name: true },
  })
  console.log(`→ ${tenants.length} tenant(s) à migrer`)
  if (tenants.length === 0) {
    console.log('Rien à faire. ✓')
    return
  }
  let ok = 0
  let fail = 0
  for (const t of tenants) {
    try {
      const slug = await generateUniqueSlug(prisma, t.name, t.id)
      await prisma.tenant.update({ where: { id: t.id }, data: { slug } })
      console.log(`✓ "${t.name}" (${t.id.slice(0, 8)}…) → ${slug}`)
      ok++
    } catch (err: any) {
      console.error(`✗ "${t.name}" → ${err?.message ?? err}`)
      fail++
    }
  }
  console.log(`\nTerminé : ${ok} ok · ${fail} échec(s)`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur fatale :', err)
    process.exit(1)
  })
