import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/export/:resource', { preHandler: [authenticate] }, async (request, reply) => {
    const { resource } = request.params as { resource: string }
    const tenantId = request.tenantId
    const lang = (request.query as { lang?: string })?.lang ?? 'fr'

    let data: any[] = []
    let filename = ''
    let headers: string[] = []

    switch (resource) {
      case 'products':
        data = await prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null }, orderBy: { name: 'asc' } })
        filename = `stock-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Catégorie','Stock','Min','Prix achat','Prix vente'] : ['Name','Category','Stock','Min','Buy price','Sell price']
        break
      case 'customers':
        data = await prisma.customer.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } })
        filename = `clients-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Téléphone','Email','Type','CA Total','Points'] : ['Name','Phone','Email','Type','Revenue','Points']
        break
      case 'suppliers':
        data = await prisma.supplier.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
        filename = `fournisseurs-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Spécialité','Téléphone','Email','Rating','Délai'] : ['Name','Specialty','Phone','Email','Rating','Lead time']
        break
      case 'sales':
        data = await prisma.sale.findMany({ where: { tenantId }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 1000 })
        filename = `ventes-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Date','Réf','Articles','Total','Paiement'] : ['Date','Ref','Items','Total','Payment']
        break
      case 'employees':
        data = await prisma.employee.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
        filename = `employes-${new Date().toISOString().slice(0,10)}.csv`
        headers = lang==='fr' ? ['Nom','Rôle','Département','Salaire','Type'] : ['Name','Role','Department','Salary','Type']
        break
      default:
        return reply.code(400).send({ error: `Resource non supportée: ${resource}` })
    }

    const rows = data.map((item) => {
      switch (resource) {
        case 'products':   return [item.name, item.category, item.stockQty, item.stockMin, item.buyPrice??item.buy_price??0, item.sellPrice??item.sell_price??0]
        case 'customers':  return [item.name, item.phone??'', item.email??'', item.type??'', item.totalRevenue??item.totalCA??0, item.loyaltyPoints??0]
        case 'suppliers':  return [item.name, item.specialty??'', item.phone??'', item.email??'', item.rating??0, item.leadTime??'']
        case 'sales':      return [new Date(item.createdAt).toLocaleDateString('fr-FR'), item.id.slice(-6), item.items?.length??0, item.total, item.paymentMode??'']
        case 'employees':  return [item.name, item.role??'', item.dept??'', item.salary??0, item.type??'CDI']
        default: return []
      }
    })

    const BOM = '\uFEFF'
    const csv = BOM + headers.join(';') + '\n' + rows.map((row: any[]) =>
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
