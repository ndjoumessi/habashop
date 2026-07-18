import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════════════════════
//  Provisioning d'un ADMIN PLATEFORME (super-admin SaaS) — item P0 / Étape 2.
//
//  Pose (ou retire) le flag `User.isPlatformAdmin`, SEUL critère d'accès à
//  /api/admin/* (console plateforme). Volontairement :
//   • PAS d'API d'auto-promotion (un flag posé côté serveur, hors requête HTTP).
//   • AUCUN mot de passe en dur, AUCUN secret dans le script : on promeut un
//     utilisateur DÉJÀ existant (créé via l'inscription normale). Le script ne
//     crée pas de compte → rien à committer.
//   • Opt-in explicite requis (`CONFIRM=1`) — évite une exécution accidentelle
//     sur la base PROD (DATABASE_URL = prod).
//
//  ⚠️  Recommandé : dédier un utilisateur qui n'est PAS le propriétaire d'une
//      boutique cliente. Le durcissement « tenant plateforme exclu des quotas /
//      des listings » (champ Tenant.isPlatform) est une migration additive à part,
//      présentée pour validation avant application.
//
//  Option PLATFORM_TENANT=1 : marque AUSSI le tenant de l'utilisateur comme
//  `isPlatform` → sa boutique est exclue des listings/quotas/agrégats de la console
//  (recommandé pour un compte créé via l'inscription normale, qui crée une boutique).
//
//  Usage :
//    Promouvoir (+ tenant plateforme) :
//      CONFIRM=1 PLATFORM_TENANT=1 PLATFORM_ADMIN_EMAIL=ops@habashop.com npx tsx scripts/set-platform-admin.ts
//    Révoquer   : CONFIRM=1 REVOKE=1 PLATFORM_ADMIN_EMAIL=ops@habashop.com npx tsx scripts/set-platform-admin.ts
//    Lister     : LIST=1 npx tsx scripts/set-platform-admin.ts   (lecture seule, aucun opt-in requis)
// ═══════════════════════════════════════════════════════════════════════════════

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL ?? process.argv[2] ?? '').trim().toLowerCase()
  const revoke = process.env.REVOKE === '1'
  const list = process.env.LIST === '1'

  // Lecture seule : lister les admins plateforme actuels.
  if (list) {
    const admins = await prisma.user.findMany({ where: { isPlatformAdmin: true }, select: { email: true, tenantId: true } })
    console.log(`Admins plateforme (${admins.length}) :`)
    admins.forEach(a => console.log(`  • ${a.email}  (tenant ${a.tenantId})`))
    return
  }

  if (!email) {
    console.error('❌ PLATFORM_ADMIN_EMAIL requis (ou 1er argument). Ex: PLATFORM_ADMIN_EMAIL=ops@habashop.com')
    process.exit(1)
  }
  if (process.env.CONFIRM !== '1') {
    console.error('❌ Opt-in requis : relancez avec CONFIRM=1 (écriture en base PROD).')
    process.exit(1)
  }

  const platformTenant = process.env.PLATFORM_TENANT === '1'
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, tenantId: true, isPlatformAdmin: true } })
  if (!user) {
    console.error(`❌ Aucun utilisateur avec l'email "${email}". Créez-le d'abord via l'inscription normale.`)
    process.exit(1)
  }

  const target = !revoke
  const already = user.isPlatformAdmin === target
  if (already && !platformTenant) {
    console.log(`ℹ️  ${email} est déjà ${target ? 'admin plateforme' : 'non-admin plateforme'} — aucun changement.`)
    return
  }

  if (!already) {
    await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: target } })
    console.log(`✅ ${email} : isPlatformAdmin = ${target}. L'utilisateur doit se RECONNECTER pour rafraîchir son JWT.`)
  }

  // Exclut la boutique de l'utilisateur des métriques SaaS (compte staff, pas client).
  if (platformTenant && target) {
    await prisma.tenant.update({ where: { id: user.tenantId }, data: { isPlatform: true } })
    console.log(`✅ tenant ${user.tenantId} marqué isPlatform=true (exclu des listings/quotas de la console).`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
