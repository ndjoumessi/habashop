import { useAppStore } from '@/stores/appStore'
import toast from 'react-hot-toast'

export default function APIDocs() {
  const { lang } = useAppStore()

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
          🔗 {lang === 'fr' ? 'API & Intégrations'
            : lang === 'en' ? 'API & Integrations'
            : lang === 'es' ? 'API & Integraciones'
            : 'API & Integrazioni'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>
          {lang === 'fr' ? 'Intégrez HabaShop dans vos applications via notre API REST'
            : 'Integrate HabaShop into your applications via our REST API'}
        </p>
      </div>

      {/* Base URL */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t">🌐 Base URL</span>
        </div>
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          fontFamily: 'var(--mono)',
          fontSize: 14,
          color: 'var(--p2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>https://habashop-production.up.railway.app</span>
          <button className="mini-btn"
            onClick={() => {
              navigator.clipboard.writeText('https://habashop-production.up.railway.app')
              toast.success('📋 URL copiée !')
            }}>
            📋 Copier
          </button>
        </div>
      </div>

      {/* Liens */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          {
            icon: '📖',
            title: lang === 'fr' ? 'Documentation complète' : 'Full documentation',
            desc: lang === 'fr' ? 'Tous les endpoints avec exemples' : 'All endpoints with examples',
            url: 'https://habashop-production.up.railway.app/api/docs/html',
            btn: lang === 'fr' ? 'Ouvrir la doc' : 'Open docs',
            color: 'var(--p2)',
          },
          {
            icon: '🔌',
            title: 'JSON Schema',
            desc: lang === 'fr' ? "Format JSON de l'API" : 'API JSON format',
            url: 'https://habashop-production.up.railway.app/api/docs',
            btn: lang === 'fr' ? 'Voir le JSON' : 'View JSON',
            color: 'var(--acc2)',
          },
          {
            icon: '💚',
            title: 'Health Check',
            desc: lang === 'fr' ? 'Statut du serveur en temps réel' : 'Real-time server status',
            url: 'https://habashop-production.up.railway.app/health',
            btn: lang === 'fr' ? 'Vérifier' : 'Check',
            color: 'var(--acc)',
          },
        ].map(link => (
          <div key={link.title} style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: '20px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 32 }}>{link.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{link.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>{link.desc}</div>
            <a href={link.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center',
                padding: '8px', borderRadius: 9,
                background: `${link.color}22`,
                border: `1px solid ${link.color}44`,
                color: link.color, fontSize: 12, fontWeight: 700,
                textDecoration: 'none', transition: 'all .15s',
              }}>
              {link.btn} →
            </a>
          </div>
        ))}
      </div>

      {/* Endpoints rapides */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t">⚡ {lang === 'fr' ? 'Endpoints principaux' : 'Main endpoints'}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Méthode</th>
                <th>Endpoint</th>
                <th>Description</th>
                <th style={{ width: 100 }}>Auth</th>
              </tr>
            </thead>
            <tbody>
              {[
                { method: 'POST', path: '/api/auth/login',           desc: lang === 'fr' ? 'Authentification'     : 'Authentication',      auth: false },
                { method: 'GET',  path: '/api/products',             desc: lang === 'fr' ? 'Liste produits'       : 'Product list',         auth: true  },
                { method: 'POST', path: '/api/sales',                desc: lang === 'fr' ? 'Créer une vente'      : 'Create sale',          auth: true  },
                { method: 'GET',  path: '/api/customers',            desc: lang === 'fr' ? 'Liste clients'        : 'Customer list',        auth: true  },
                { method: 'GET',  path: '/api/dashboard/stats',      desc: lang === 'fr' ? 'Stats en temps réel'  : 'Real-time stats',      auth: true  },
                { method: 'POST', path: '/api/ai/analyze',           desc: lang === 'fr' ? 'Analyse IA Claude'    : 'Claude AI analysis',   auth: true  },
                { method: 'POST', path: '/api/ai/chat',              desc: lang === 'fr' ? 'Chat IA Claude'       : 'Claude AI chat',       auth: true  },
                { method: 'POST', path: '/api/whatsapp/send-ticket', desc: 'Ticket WhatsApp',                                               auth: true  },
                { method: 'GET',  path: '/health',                   desc: lang === 'fr' ? 'Statut API'           : 'API status',           auth: false },
              ].map((e, i) => (
                <tr key={i}>
                  <td>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                      background: e.method === 'GET' ? 'rgba(14,196,126,.15)' : 'rgba(91,78,232,.15)',
                      color: e.method === 'GET' ? 'var(--acc2)' : 'var(--p2)',
                    }}>{e.method}</span>
                  </td>
                  <td>
                    <code style={{
                      fontFamily: 'var(--mono)', fontSize: 12,
                      color: 'var(--p2)', background: 'rgba(91,78,232,.08)',
                      padding: '2px 6px', borderRadius: 4,
                    }}>{e.path}</code>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{e.desc}</td>
                  <td>
                    {e.auth ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: 'var(--danger)',
                        background: 'rgba(232,64,74,.1)',
                        borderRadius: 6, padding: '2px 8px',
                      }}>🔒 JWT</span>
                    ) : (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: 'var(--acc2)',
                        background: 'rgba(14,196,126,.1)',
                        borderRadius: 6, padding: '2px 8px',
                      }}>🌍 Public</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exemple code */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t">💻 {lang === 'fr' ? "Exemple d'intégration" : 'Integration example'}</span>
          <button className="mini-btn"
            onClick={() => {
              const code = document.getElementById('api-example-code')?.textContent ?? ''
              navigator.clipboard.writeText(code)
              toast.success('📋 Code copié !')
            }}>
            📋 Copier
          </button>
        </div>
        <pre id="api-example-code" style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: '16px',
          fontSize: 12, color: 'var(--p2)',
          fontFamily: 'var(--mono)',
          overflow: 'auto',
          lineHeight: 1.8,
        }}>
{`// JavaScript / Node.js
const axios = require('axios')
const BASE = 'https://habashop-production.up.railway.app'

async function main() {
  // 1. Authentification
  const { data: { token } } = await axios.post(BASE + '/api/auth/login', {
    email: 'admin@habashop.com',
    password: 'demo1234'
  })
  const headers = { Authorization: 'Bearer ' + token }

  // 2. Récupérer les produits
  const { data: products } = await axios.get(BASE + '/api/products', { headers })
  console.log(products.length + ' produits trouvés')

  // 3. Créer une vente
  const { data: sale } = await axios.post(BASE + '/api/sales', {
    items: [{ productId: products[0].id, qty: 1, price: products[0].sellPrice }],
    paymentMode: 'cash',
    total: products[0].sellPrice,
  }, { headers })
  console.log('Vente créée:', sale.id)

  // 4. Chat IA
  const { data: chat } = await axios.post(BASE + '/api/ai/chat', {
    messages: [{ role: 'user', content: 'Quels sont mes produits en rupture ?' }],
    lang: 'fr'
  }, { headers })
  console.log(chat.response)
}

main().catch(console.error)`}
        </pre>
      </div>
    </div>
  )
}
