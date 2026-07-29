import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/export/:resource', { preHandler: [authenticate] }, async (request, reply) => {
    const { resource } = request.params as { resource: string }
    const tenantId = request.tenantId
    const lang = (request.query as { lang?: string })?.lang ?? 'fr'

    // ⚠️ `let data: any[]` a été SUPPRIMÉ ici. C'est lui qui laissait passer quatre lectures
    // de champs INEXISTANTS — mesuré contre `prisma/schema.prisma` le 2026-07-29 :
    //   · `Supplier.specialty`              → la colonne « Spécialité » du CSV fournisseurs
    //     était TOUJOURS VIDE (le modèle porte `categories`) — c'est le bug de #170 ;
    //   · `Product.buy_price` / `sell_price` → replis snake_case morts derrière `buyPrice` /
    //     `sellPrice`, qui existent : sans effet, mais ils affirment un modèle faux ;
    //   · `Customer.totalCA`                 → idem derrière `totalRevenue`.
    // Chaque `case` construit désormais ses lignes là où Prisma a typé sa requête : lire un
    // champ absent devient une erreur de compilation (TS2339), pas une colonne vide en prod.
    let filename = ''
    let headers: string[] = []
    let rows: (string | number)[][] = []

    switch (resource) {
      case 'products': {
        const data = await prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null }, orderBy: { name: 'asc' } })
        filename = `stock-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Catégorie','Stock','Min','Prix achat','Prix vente'] : ['Name','Category','Stock','Min','Buy price','Sell price']
        rows = data.map(p => [p.name, p.category, p.stockQty, p.stockMin, p.buyPrice, p.sellPrice])
        break
      }
      case 'customers': {
        const data = await prisma.customer.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } })
        filename = `clients-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Téléphone','Email','Type','CA Total','Points'] : ['Name','Phone','Email','Type','Revenue','Points']
        rows = data.map(c => [c.name, c.phone ?? '', c.email ?? '', c.type ?? '', c.totalRevenue, c.loyaltyPoints])
        break
      }
      case 'suppliers': {
        const data = await prisma.supplier.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
        filename = `fournisseurs-${new Date().toISOString().slice(0,10)}.csv`
        // ⚠️ En-tête « Catégorie », PAS « Spécialité » : c'est le champ réel, et c'est déjà le
        // vocabulaire de l'export CSV frontend (`t('col_category')`, `Suppliers.tsx`). Deux
        // exports du même objet annonçaient deux noms différents pour la même donnée.
        headers = lang==='fr' ? ['Nom','Catégorie','Téléphone','Email','Rating','Délai'] : ['Name','Category','Phone','Email','Rating','Lead time']
        // `categories` est déjà la chaîne saisie par le commerçant (« Riz, Huile ») : telle quelle.
        rows = data.map(s => [s.name, s.categories ?? '', s.phone ?? '', s.email ?? '', s.rating, s.leadTime])
        break
      }
      case 'sales': {
        const data = await prisma.sale.findMany({ where: { tenantId }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 1000 })
        filename = `ventes-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Date','Réf','Articles','Total','Paiement'] : ['Date','Ref','Items','Total','Payment']
        rows = data.map(v => [new Date(v.createdAt).toLocaleDateString('fr-FR'), v.id.slice(-6), v.items.length, v.total, v.paymentMode ?? ''])
        break
      }
      case 'employees': {
        const data = await prisma.employee.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
        filename = `employes-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Rôle','Département','Salaire','Type'] : ['Name','Role','Department','Salary','Type']
        rows = data.map(e => [e.name, e.role, e.dept, e.salary, e.type])
        break
      }
      default:
        return reply.code(400).send({ error: `Resource non supportée: ${resource}` })
    }

    const BOM = '\uFEFF'
    const csv = BOM + headers.join(';') + '\n' + rows.map((row) =>
      row.map((cell) => {
        const s = String(cell??'').replace(/"/g,'""')
        return s.includes(';')||s.includes('"') ? `"${s}"` : s
      }).join(';')
    ).join('\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send(csv)
  })

  // Export PDF rapport mensuel
  app.get('/api/export/pdf/monthly', { preHandler: [authenticate] }, async (request, reply) => {
    const tenantId = request.tenantId
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const [tenant, sales] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.sale.findMany({ where: { tenantId, createdAt: { gte: start } }, include: { items: true } }),
    ])
    const totalCA = sales.reduce((s: number, v) => s + v.total, 0)
    const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Rapport ${monthName}</title><style>body{font-family:sans-serif;margin:40px;color:#1a1a2e}h1{color:#6C47FF}table{width:100%;border-collapse:collapse}th{background:#6C47FF;color:#fff;padding:10px;text-align:left}td{padding:8px;border-bottom:1px solid #eee}.kpi{display:flex;gap:20px;margin:20px 0}.k{background:#f8f8ff;border-radius:12px;padding:16px;text-align:center;flex:1}.kv{font-size:24px;font-weight:900;color:#6C47FF}.kl{font-size:11px;color:#666;text-transform:uppercase}</style></head><body><h1>🏪 ${tenant?.name??'HabaShop'}</h1><p>Rapport — <strong>${monthName}</strong></p><div class="kpi"><div class="k"><div class="kv">${totalCA.toLocaleString('fr-FR')} F</div><div class="kl">CA Total</div></div><div class="k"><div class="kv">${sales.length}</div><div class="kl">Ventes</div></div></div><h2>Détail des ventes</h2><table><thead><tr><th>Date</th><th>Réf</th><th>Articles</th><th>Total</th><th>Paiement</th></tr></thead><tbody>${sales.slice(0,30).map((s:any)=>`<tr><td>${new Date(s.createdAt).toLocaleDateString('fr-FR')}</td><td>#${s.id.slice(-6)}</td><td>${s.items?.length??0}</td><td>${s.total.toLocaleString('fr-FR')} F</td><td>${s.paymentMode??'—'}</td></tr>`).join('')}</tbody></table><p style="margin-top:40px;color:#999;font-size:11px;text-align:center">Généré par HabaShop le ${new Date().toLocaleDateString('fr-FR')}</p></body></html>`
    reply.header('Content-Type', 'text/html; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="rapport-${monthName.replace(' ','-')}.html"`)
    return reply.send(html)
  })
}
