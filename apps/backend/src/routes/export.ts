import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { sanitizeCsv } from '../lib/csv'
import { exportHeaders } from '../lib/exportHeaders'
import { escHtml } from '../lib/html'

/**
 * Plafond de l'export CSV des ventes — 10× l'ancien, et il s'ANNONCE quand il mord.
 *
 * ⚠️ Un plafond subsiste DÉLIBÉRÉMENT : sans lui, une boutique à 500 000 ventes ferait
 * construire une chaîne de plusieurs dizaines de Mo en mémoire dans le conteneur. Le
 * défaut n'était pas le plafond, c'était son SILENCE.
 *
 * ⚠️ Le passage de 1 000 à 10 000 n'est tenable QUE parce que la requête ne charge plus
 * les articles (`_count` au lieu d'`include: { items: true }`) : chaque ligne pèse
 * désormais cinq scalaires.
 */
export const PLAFOND_EXPORT_VENTES = 10_000

/** Au-delà de ce nombre, le rapport mensuel ne détaille plus toutes les ventes — et le DIT. */
export const DETAIL_VENTES_RAPPORT = 30

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
    // ⚠️ Les cinq jeux d'en-têtes étaient `lang === 'fr' ? [FR] : [EN]` — es et it
    // recevaient l'ANGLAIS. Record exhaustif dans `lib/exportHeaders.ts`.
    let headers: string[] = []
    let rows: (string | number)[][] = []

    switch (resource) {
      case 'products': {
        const data = await prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null }, orderBy: { name: 'asc' } })
        filename = `stock-${new Date().toISOString().slice(0,10)}.csv`
        headers = exportHeaders('products', lang)
        rows = data.map(p => [p.name, p.category, p.stockQty, p.stockMin, p.buyPrice, p.sellPrice])
        break
      }
      case 'customers': {
        const data = await prisma.customer.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } })
        filename = `clients-${new Date().toISOString().slice(0,10)}.csv`
        headers = exportHeaders('customers', lang)
        rows = data.map(c => [c.name, c.phone ?? '', c.email ?? '', c.type ?? '', c.totalRevenue, c.loyaltyPoints])
        break
      }
      case 'suppliers': {
        const data = await prisma.supplier.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
        filename = `fournisseurs-${new Date().toISOString().slice(0,10)}.csv`
        // ⚠️ En-tête « Catégorie », PAS « Spécialité » : c'est le champ réel, et c'est déjà le
        // vocabulaire de l'export CSV frontend (`t('col_category')`, `Suppliers.tsx`). Deux
        // exports du même objet annonçaient deux noms différents pour la même donnée.
        headers = exportHeaders('suppliers', lang)
        // `categories` est déjà la chaîne saisie par le commerçant (« Riz, Huile ») : telle quelle.
        // ⚠️ `s.rating` est nullable — un `null` brut sortirait « null » dans le CSV.
        rows = data.map(s => [s.name, s.categories ?? '', s.phone ?? '', s.email ?? '', s.rating ?? '', s.leadTime])
        break
      }
      case 'sales': {
        // ⚠️ CE PLAFOND SE DIT. Il était à 1 000, MUET — un document qui SORT du produit et
        // part chez un comptable, tronqué sans un mot. Plus grave qu'un graphique tronqué :
        // le CSV se recopie, et rien dans le fichier ne dit qu'il est incomplet.
        //
        // ⚠️ CE N'EST PAS la famille « le total est la somme de ce qu'on montre » : aucun
        // total ne dérive de ces lignes (le CSV n'a pas de ligne de total). C'en est une
        // autre — la troncature silencieuse d'un document exporté.
        //
        // ⚠️ ET LA ROUTE NE PREND AUCUNE PÉRIODE : ce ne sont pas « 1 000 ventes de la
        // période », ce sont les N ventes les plus récentes, toutes périodes confondues.
        const [totalVentes, data] = await Promise.all([
          prisma.sale.count({ where: { tenantId } }),
          prisma.sale.findMany({
            where: { tenantId },
            // ⚠️ `include: { items: true }` chargeait TOUS les articles de toutes les ventes
            // pour ne lire que `items.length`. `_count` fait compter Postgres : c'est ce qui
            // rend le plafond ci-dessous tenable sans gonfler la mémoire du conteneur.
            include: { _count: { select: { items: true } } },
            orderBy: { createdAt: 'desc' },
            take: PLAFOND_EXPORT_VENTES,
          }),
        ])
        const jour = new Date().toISOString().slice(0, 10)
        // ⚠️ LA TRONCATURE S'ANNONCE DANS LE NOM DE FICHIER, jamais dans une ligne du CSV :
        // une ligne de plus est une LIGNE DE DONNÉES pour le tableur — elle se trie, se somme
        // et se recopie. Le nom, lui, se lit avant l'ouverture et survit à l'envoi par e-mail.
        filename = totalVentes > data.length
          ? `ventes-${jour}-${data.length}-sur-${totalVentes}.csv`
          : `ventes-${jour}.csv`
        headers = exportHeaders('sales', lang)
        rows = data.map(v => [new Date(v.createdAt).toLocaleDateString('fr-FR'), v.id.slice(-6), v._count.items, v.total, v.paymentMode ?? ''])
        break
      }
      case 'employees': {
        const data = await prisma.employee.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
        filename = `employes-${new Date().toISOString().slice(0,10)}.csv`
        headers = exportHeaders('employees', lang)
        rows = data.map(e => [e.name, e.role, e.dept, e.salary, e.type])
        break
      }
      default:
        return reply.code(400).send({ error: `Resource non supportée: ${resource}` })
    }

    const BOM = '\uFEFF'
    const csv = BOM + headers.join(';') + '\n' + rows.map((row) =>
      row.map((cell) => {
        // ⚠️ `sanitizeCsv` AVANT l'échappement des guillemets, jamais après : entourer la
        // cellule de `"` ne protège PAS (le tableur les retire puis évalue). Cf. lib/csv.ts.
        const s = sanitizeCsv(cell).replace(/"/g,'""')
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
      // ⚠️ `orderBy` AJOUTÉ. Sans lui, Postgres ne garantit AUCUN ordre : le `slice(0,30)`
      // ci-dessous ne prenait pas « les 30 plus récentes » mais 30 ventes arbitraires, sous
      // un titre qui laissait croire au début du mois. Le tri fait de la légende une vérité.
      prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start } },
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const totalCA = sales.reduce((s: number, v) => s + v.total, 0)
    // ⚠️ Le KPI « Ventes » compte `sales.length` — le jeu COMPLET — pendant que la table
    // n'en détaille que 30. C'est le bon motif (cf. `services/email.ts:473`, qui calcule
    // `totalCount` AVANT son `slice`), mais il ne suffit pas : l'écart était seulement
    // INFÉRABLE par un lecteur qui compare deux chiffres. On le DIT.
    const detail = sales.slice(0, DETAIL_VENTES_RAPPORT)
    const mentionTronque = sales.length > detail.length
      ? `<p style="color:#666;font-size:12px;margin:4px 0 12px">Les ${detail.length} ventes les plus récentes, sur ${sales.length} au total ce mois-ci.</p>`
      : ''
    const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    // ⚠️ TOUTE donnée dynamique passe par `escHtml` (règle canonique `lib/html.ts`).
    // Ce document n'échappait RIEN : `tenant.name` est saisi par le commerçant et
    // `paymentMode` vient de la base. Les autres interpolations sont sûres par
    // construction — nombres via `toLocaleString`, `s.id.slice(-6)` (cuid), et
    // `monthName`/la date, produits par `toLocaleDateString`.
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Rapport ${monthName}</title><style>body{font-family:sans-serif;margin:40px;color:#1a1a2e}h1{color:#6C47FF}table{width:100%;border-collapse:collapse}th{background:#6C47FF;color:#fff;padding:10px;text-align:left}td{padding:8px;border-bottom:1px solid #eee}.kpi{display:flex;gap:20px;margin:20px 0}.k{background:#f8f8ff;border-radius:12px;padding:16px;text-align:center;flex:1}.kv{font-size:24px;font-weight:900;color:#6C47FF}.kl{font-size:11px;color:#666;text-transform:uppercase}</style></head><body><h1>🏪 ${escHtml(tenant?.name ?? 'HabaShop')}</h1><p>Rapport — <strong>${monthName}</strong></p><div class="kpi"><div class="k"><div class="kv">${totalCA.toLocaleString('fr-FR')} F</div><div class="kl">CA Total</div></div><div class="k"><div class="kv">${sales.length}</div><div class="kl">Ventes</div></div></div><h2>Détail des ventes</h2>${mentionTronque}<table><thead><tr><th>Date</th><th>Réf</th><th>Articles</th><th>Total</th><th>Paiement</th></tr></thead><tbody>${detail.map(s=>`<tr><td>${new Date(s.createdAt).toLocaleDateString('fr-FR')}</td><td>#${s.id.slice(-6)}</td><td>${s._count.items}</td><td>${s.total.toLocaleString('fr-FR')} F</td><td>${escHtml(s.paymentMode ?? '—')}</td></tr>`).join('')}</tbody></table><p style="margin-top:40px;color:#999;font-size:11px;text-align:center">Généré par HabaShop le ${new Date().toLocaleDateString('fr-FR')}</p></body></html>`
    reply.header('Content-Type', 'text/html; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="rapport-${monthName.replace(' ','-')}.html"`)
    return reply.send(html)
  })
}
