import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════════════════════
//  Marque une boutique comme DÉMONSTRATION (`Tenant.isDemo`).
//
//  Les comptes démo sont partagés et leur mot de passe est PUBLIC (dépôt public,
//  bundle JS, README) → n'importe qui obtient un JWT MANAGER/ADMIN valide par un
//  simple `curl`. Ce flag ferme côté SERVEUR (403 DEMO_TENANT_FORBIDDEN) :
//   • le coût externe   : OCR facture (Anthropic), WhatsApp/campagnes (Twilio),
//                         invitations e-mail (Resend) ;
//   • le destructif     : suppression de compte/boutique ;
//   • l'évasion         : création d'une boutique neuve (qui serait non-démo).
//
//  Volontairement : opt-in explicite (`CONFIRM=1`) — DATABASE_URL pointe la PROD.
//
//  Usage :
//    Lister  : LIST=1 npx tsx scripts/set-demo-tenant.ts            (lecture seule)
//    Marquer : CONFIRM=1 DEMO_TENANT_IDS=demo-tenant-001,demo-tenant-002 npx tsx scripts/set-demo-tenant.ts
//    Retirer : CONFIRM=1 REVOKE=1 DEMO_TENANT_IDS=demo-tenant-001 npx tsx scripts/set-demo-tenant.ts
// ═══════════════════════════════════════════════════════════════════════════════

const prisma = new PrismaClient()

// Le garde de dépense cache isDemo/statut 60 s côté serveur (Redis). Ce script tourne
// hors du process API : on invalide directement la clé pour que la bascule prenne effet
// tout de suite plutôt qu'à l'expiration du cache.
async function invalidateSpendCache(tenantId: string): Promise<void> {
  const url = process.env.REDIS_URL
  if (!url) return
  try {
    const { default: Redis } = await import('ioredis')
    const r = new Redis(url)
    await r.del(`tenant:spend:${tenantId}`)
    await r.quit()
    console.log(`   ↳ cache du garde invalidé (tenant:spend:${tenantId})`)
  } catch (e: any) {
    console.warn(`   ⚠️ cache non invalidé (${e?.message ?? e}) — effet dans ≤ 60 s`)
  }
}

async function main() {
  const list = process.env.LIST === '1'
  const revoke = process.env.REVOKE === '1'
  const target = !revoke

  if (list) {
    const all = await prisma.tenant.findMany({
      select: { id: true, name: true, isDemo: true, isPlatform: true },
      orderBy: { createdAt: 'asc' },
    })
    for (const t of all) {
      const flags = [t.isDemo ? 'DÉMO' : null, t.isPlatform ? 'PLATEFORME' : null].filter(Boolean).join(' + ') || 'cliente'
      console.log(`${t.id.padEnd(26)} ${flags.padEnd(18)} ${t.name}`)
    }
    return
  }

  const ids = (process.env.DEMO_TENANT_IDS ?? process.argv[2] ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  if (ids.length === 0) {
    console.error('❌ DEMO_TENANT_IDS requis (ex. DEMO_TENANT_IDS=demo-tenant-001,demo-tenant-002).')
    process.exit(1)
  }
  if (process.env.CONFIRM !== '1') {
    console.error('❌ Opt-in requis : relancer avec CONFIRM=1 (DATABASE_URL = base de PRODUCTION).')
    process.exit(1)
  }

  for (const id of ids) {
    const t = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, isDemo: true } })
    if (!t) { console.error(`⚠️  ${id} : introuvable, ignoré.`); continue }
    if (t.isDemo === target) { console.log(`= ${id} : déjà isDemo=${target} (« ${t.name} »)`); continue }
    await prisma.tenant.update({ where: { id }, data: { isDemo: target } })
    await invalidateSpendCache(id)
    console.log(`✅ ${id} : isDemo = ${target} (« ${t.name} »)`)
  }

  // Le garde cache le statut ~60 s dans Redis (cf. middleware/demoTenant.ts).
  console.log('\nℹ️  Propagation : immédiate si REDIS_URL est joignable, sinon ≤ 60 s.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
