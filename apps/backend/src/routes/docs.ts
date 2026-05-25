import type { FastifyInstance } from 'fastify'

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/docs', async () => {
    return {
      name: 'HabaShop API',
      version: '2.0.0',
      description: 'API REST pour HabaShop — Logiciel de gestion commerciale',
      baseUrl: 'https://habashop-production.up.railway.app',
      authentication: {
        type: 'Bearer JWT',
        endpoint: 'POST /api/auth/login',
        example: {
          request: { email: 'your@email.com', password: 'yourpassword' },
          response: { token: 'eyJ...', user: { id: '...', name: '...', role: '...' } }
        }
      },
      endpoints: [
        { method: 'GET',  path: '/health',                   description: 'Health check',             auth: false },
        { method: 'POST', path: '/api/auth/login',           description: 'Authentification',         auth: false },
        { method: 'GET',  path: '/api/products',             description: 'Liste des produits',       auth: true  },
        { method: 'POST', path: '/api/products',             description: 'Créer un produit',         auth: true  },
        { method: 'PUT',  path: '/api/products/:id',         description: 'Modifier un produit',      auth: true  },
        { method: 'DELETE', path: '/api/products/:id',       description: 'Supprimer un produit',     auth: true  },
        { method: 'GET',  path: '/api/sales',                description: 'Liste des ventes',         auth: true  },
        { method: 'POST', path: '/api/sales',                description: 'Créer une vente',          auth: true  },
        { method: 'GET',  path: '/api/customers',            description: 'Liste des clients',        auth: true  },
        { method: 'POST', path: '/api/customers',            description: 'Créer un client',          auth: true  },
        { method: 'GET',  path: '/api/suppliers',            description: 'Liste des fournisseurs',   auth: true  },
        { method: 'GET',  path: '/api/orders',               description: 'Liste des commandes',      auth: true  },
        { method: 'GET',  path: '/api/employees',            description: 'Liste des employés',       auth: true  },
        { method: 'GET',  path: '/api/expenses',             description: 'Liste des dépenses',       auth: true  },
        { method: 'GET',  path: '/api/dashboard/stats',      description: 'Statistiques dashboard',   auth: true  },
        { method: 'GET',  path: '/api/reports/sales',        description: 'Rapport ventes',           auth: true  },
        { method: 'GET',  path: '/api/products/low-stock',   description: 'Produits en rupture',      auth: true  },
        { method: 'POST', path: '/api/ai/analyze',           description: 'Analyse IA Claude',        auth: true  },
        { method: 'POST', path: '/api/ai/chat',              description: 'Chat IA Claude',           auth: true  },
        { method: 'POST', path: '/api/whatsapp/send-ticket', description: 'Envoyer ticket WhatsApp',  auth: true  },
        { method: 'POST', path: '/api/whatsapp/broadcast',   description: 'WhatsApp marketing (max 20)', auth: true },
      ],
      rateLimits: { requests: '100/minute par token', whatsapp: '20 messages/envoi', ai: '10 analyses/heure' },
    }
  })

  app.get('/api/docs/html', async (_request, reply) => {
    const endpoints = [
      { method: 'GET',  path: '/api/products',         desc: 'Liste des produits',   auth: true  },
      { method: 'POST', path: '/api/sales',            desc: 'Créer une vente',      auth: true  },
      { method: 'GET',  path: '/api/customers',        desc: 'Liste des clients',    auth: true  },
      { method: 'GET',  path: '/api/dashboard/stats',  desc: 'Stats dashboard',      auth: true  },
      { method: 'POST', path: '/api/ai/analyze',       desc: 'Analyse IA Claude',    auth: true  },
      { method: 'POST', path: '/api/ai/chat',          desc: 'Chat IA Claude',       auth: true  },
      { method: 'POST', path: '/api/whatsapp/send-ticket', desc: 'Ticket WhatsApp', auth: true  },
      { method: 'GET',  path: '/health',               desc: 'Health check',         auth: false },
    ]
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>HabaShop API Documentation</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#0C0B14;color:#e2e8f0}
    .header{background:linear-gradient(135deg,#5B4EE8,#7C6FF0);padding:32px}
    .header h1{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px}
    .header p{color:rgba(255,255,255,.75);font-size:14px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-left:8px}
    .badge-get{background:#10B981;color:#fff}
    .badge-post{background:#5B4EE8;color:#fff}
    .container{max-width:900px;margin:0 auto;padding:24px}
    .card{background:#181628;border:1px solid rgba(255,255,255,.1);border-radius:12px;margin-bottom:12px;overflow:hidden}
    .card-header{padding:14px 18px;display:flex;align-items:center;gap:12px}
    .card-body{padding:0 18px 14px}
    .endpoint-path{font-family:monospace;font-size:14px;color:#a78bfa}
    .endpoint-desc{font-size:13px;color:#94a3b8}
    pre{background:#0C0B14;border-radius:8px;padding:14px;font-size:12px;overflow-x:auto;color:#7C6FF0;margin-top:8px;border:1px solid rgba(91,78,232,.2)}
    .auth-badge{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:2px 8px;font-size:10px}
    .public-badge{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.2);border-radius:6px;padding:2px 8px;font-size:10px}
    .section-title{font-size:16px;font-weight:800;color:#e2e8f0;margin:20px 0 10px}
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 HabaShop API v2.0</h1>
    <p>API REST complète pour intégrer HabaShop dans vos applications</p>
    <p style="margin-top:8px;font-family:monospace;font-size:13px;">Base URL: https://habashop-production.up.railway.app</p>
  </div>
  <div class="container">
    <div class="section-title">🔐 Authentification</div>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-post">POST</span>
        <span class="endpoint-path">/api/auth/login</span>
        <span class="public-badge">Public</span>
      </div>
      <div class="card-body">
        <pre>{"email":"admin@habashop.com","password":"demo1234"}</pre>
      </div>
    </div>
    <div class="section-title">📦 Endpoints</div>
    ${endpoints.map(e => `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-${e.method.toLowerCase()}">${e.method}</span>
        <span class="endpoint-path">${e.path}</span>
        <span class="${e.auth ? 'auth-badge' : 'public-badge'}">${e.auth ? '🔒 Auth requis' : '🌍 Public'}</span>
        <span class="endpoint-desc" style="margin-left:auto">${e.desc}</span>
      </div>
    </div>`).join('')}
    <div class="section-title">💻 Exemple SDK JavaScript</div>
    <div class="card">
      <div class="card-body" style="padding-top:14px">
        <pre>const axios = require('axios')
const BASE = 'https://habashop-production.up.railway.app'

const { data: { token } } = await axios.post(BASE + '/api/auth/login', {
  email: 'admin@habashop.com', password: 'demo1234'
})
const headers = { Authorization: 'Bearer ' + token }
const { data: products } = await axios.get(BASE + '/api/products', { headers })
console.log(products.length + ' produits')</pre>
      </div>
    </div>
  </div>
</body>
</html>`
    return reply.type('text/html').send(html)
  })
}
