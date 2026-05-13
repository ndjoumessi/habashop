import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding HabaShop...')

  // Tenant démo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Mon Commerce',
      slug: 'demo',
      currency: 'XOF',
      language: 'fr',
      vatRate: 0.18,
      address: 'Dakar, Sénégal',
      phone: '+221 77 000 00 00',
      email: 'contact@moncommerce.sn',
    }
  })

  // Admin
  const passwordHash = await bcrypt.hash('demo1234', 12)
  await prisma.user.upsert({
    where: { id: 'user-admin-demo' },
    update: {},
    create: {
      id: 'user-admin-demo',
      tenantId: tenant.id,
      name: 'Nelson Djoumessi',
      email: 'admin@habashop.com',
      passwordHash,
      role: 'ADMIN',
    }
  })

  // Fournisseurs
  const sonaco = await prisma.supplier.create({
    data: { tenantId: tenant.id, name: 'SONACO', email: 'contact@sonaco.sn', phone: '+221 33 800 00 01', country: 'Sénégal', rating: 4 }
  })

  // Produits
  const products = [
    { sku: 'HU-PAL-5L', name: 'Huile Palme 5L', category: 'Corps gras', priceBuy: 7000, priceSell: 8500, stock: 45, threshold: 10 },
    { sku: 'RI-PAR-25', name: 'Riz Parfumé 25kg', category: 'Céréales', priceBuy: 20000, priceSell: 24500, stock: 120, threshold: 20 },
    { sku: 'SU-BLC-50', name: 'Sucre Blanc 50kg', category: 'Épicerie', priceBuy: 27000, priceSell: 32000, stock: 8, threshold: 15 },
    { sku: 'LA-POU-25', name: 'Lait Poudre 2.5kg', category: 'Laitiers', priceBuy: 15500, priceSell: 18500, stock: 32, threshold: 10 },
    { sku: 'SA-OMO-1K', name: 'Savon OMO 1kg', category: 'Hygiène', priceBuy: 2200, priceSell: 2800, stock: 200, threshold: 30 },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: {},
      create: { ...p, tenantId: tenant.id, supplierId: sonaco.id }
    })
  }

  console.log('✅ Seed terminé !')
  console.log('📧 Email: admin@habashop.com')
  console.log('🔑 Mot de passe: demo1234')
  console.log('🏪 Boutique slug: demo')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
