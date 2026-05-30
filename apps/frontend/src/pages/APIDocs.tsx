import { useState, type ReactNode } from 'react'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/lib/api'
import { generateCDC } from '@/utils/export'
import toast from 'react-hot-toast'
import {
  Link2, ClipboardList, Globe, Zap, Code2, FlaskConical,
  FileDown, Copy, BookOpen, Plug, HeartPulse, Lock,
  Play, Loader2, AlertCircle, ArrowRight,
} from 'lucide-react'

const TESTER_ENDPOINTS = [
  'GET /api/dashboard/stats',
  'GET /api/products',
  'GET /api/customers',
  'GET /api/sales',
  'GET /api/orders',
  'GET /api/suppliers',
  'GET /api/employees',
  'GET /api/expenses',
  'GET /health',
  'POST /api/ai/analyze',
  'POST /api/ai/chat',
]

// Coloration syntaxique minimale (thémée) : commentaires, strings, mots-clés.
// Tokeniseur char-par-char qui suit l'état "string" → les `//` dans une URL
// ('https://…') ne sont PAS pris pour des commentaires.
const JS_KEYWORDS = new Set([
  'const', 'let', 'var', 'async', 'await', 'function', 'return', 'new',
  'require', 'for', 'if', 'else', 'catch', 'try', 'of', 'in',
])

function highlightCode(code: string): ReactNode[] {
  const out: ReactNode[] = []
  let key = 0
  const lines = code.split('\n')
  lines.forEach((line, li) => {
    let i = 0
    let plain = ''
    const flushPlain = () => {
      if (!plain) return
      plain.split(/(\b[A-Za-z_]\w*\b)/).forEach(part => {
        if (!part) return
        if (JS_KEYWORDS.has(part)) out.push(<span key={key++} style={{ color: 'var(--p3)' }}>{part}</span>)
        else out.push(<span key={key++}>{part}</span>)
      })
      plain = ''
    }
    while (i < line.length) {
      const c = line[i]
      if (c === '/' && line[i + 1] === '/') {
        flushPlain()
        out.push(<span key={key++} style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{line.slice(i)}</span>)
        i = line.length
        break
      }
      if (c === "'" || c === '"' || c === '`') {
        flushPlain()
        let j = i + 1
        while (j < line.length && line[j] !== c) j++
        out.push(<span key={key++} style={{ color: 'var(--acc2)' }}>{line.slice(i, j + 1)}</span>)
        i = j + 1
        continue
      }
      plain += c
      i++
    }
    flushPlain()
    if (li < lines.length - 1) out.push('\n')
  })
  return out
}

export default function APIDocs() {
  const { lang } = useAppStore()
  const [testerEndpoint, setTesterEndpoint] = useState('GET /api/dashboard/stats')
  const [testerBody, setTesterBody]         = useState('')
  const [testerLoading, setTesterLoading]   = useState(false)
  const [testerResult, setTesterResult]     = useState<string | null>(null)

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Link2 size={20} strokeWidth={2.2} color="var(--acc2)" />
          {lang === 'fr' ? 'API & Intégrations'
            : lang === 'en' ? 'API & Integrations'
            : lang === 'es' ? 'API & Integraciones'
            : 'API & Integrazioni'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>
          {lang === 'en' ? 'Integrate HabaShop into your applications via our REST API' : lang === 'es' ? 'Integre HabaShop en sus aplicaciones a través de nuestra API REST' : lang === 'it' ? 'Integra HabaShop nelle tue applicazioni tramite la nostra API REST' : 'Intégrez HabaShop dans vos applications via notre API REST'}
        </p>
      </div>

      {/* CDC PDF */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <ClipboardList size={15} /> {lang === 'en' ? 'Specification document' : lang === 'es' ? 'Pliego de condiciones' : lang === 'it' ? 'Capitolato' : 'Cahier des charges'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>
            {lang === 'en' ? 'Full HabaShop v2.0 document — 16 modules, tech stack, architecture, security.' : lang === 'es' ? 'Documento completo HabaShop v2.0 — 16 módulos, stack técnico, arquitectura, seguridad.' : lang === 'it' ? 'Documento completo HabaShop v2.0 — 16 moduli, stack tecnico, architettura, sicurezza.' : 'Document complet HabaShop v2.0 — 16 modules, stack technique, architecture, sécurité.'}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => generateCDC()}
            style={{ whiteSpace: 'nowrap', flexShrink: 0, display:'inline-flex', alignItems:'center', gap:6 }}
          >
            <FileDown size={13} /> {lang === 'en' ? 'Generate PDF' : lang === 'es' ? 'Generar el PDF' : lang === 'it' ? 'Genera il PDF' : 'Générer le PDF'}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <Globe size={15} /> Base URL
          </span>
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
              toast.success('URL copiée')
            }}
            style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <Copy size={12} /> Copier
          </button>
        </div>
      </div>

      {/* Liens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {[
          {
            Icon: BookOpen,
            title: lang === 'en' ? 'Full documentation' : lang === 'es' ? 'Documentación completa' : lang === 'it' ? 'Documentazione completa' : 'Documentation complète',
            desc: lang === 'en' ? 'All endpoints with examples' : lang === 'es' ? 'Todos los endpoints con ejemplos' : lang === 'it' ? 'Tutti gli endpoint con esempi' : 'Tous les endpoints avec exemples',
            url: 'https://habashop-production.up.railway.app/api/docs/html',
            btn: lang === 'en' ? 'Open docs' : lang === 'es' ? 'Abrir la doc' : lang === 'it' ? 'Apri la doc' : 'Ouvrir la doc',
            color: 'var(--p2)',
          },
          {
            Icon: Plug,
            title: 'JSON Schema',
            desc: lang === 'en' ? 'API JSON format' : lang === 'es' ? 'Formato JSON de la API' : lang === 'it' ? 'Formato JSON dell\'API' : "Format JSON de l'API",
            url: 'https://habashop-production.up.railway.app/api/docs',
            btn: lang === 'en' ? 'View JSON' : lang === 'es' ? 'Ver el JSON' : lang === 'it' ? 'Vedi il JSON' : 'Voir le JSON',
            color: 'var(--acc2)',
          },
          {
            Icon: HeartPulse,
            title: 'Health Check',
            desc: lang === 'en' ? 'Real-time server status' : lang === 'es' ? 'Estado del servidor en tiempo real' : lang === 'it' ? 'Stato del server in tempo reale' : 'Statut du serveur en temps réel',
            url: 'https://habashop-production.up.railway.app/health',
            btn: lang === 'en' ? 'Check' : lang === 'es' ? 'Verificar' : lang === 'it' ? 'Verifica' : 'Vérifier',
            color: 'var(--acc)',
          },
        ].map(link => (
          <div key={link.title} style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: '20px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${link.color}1F`, border: `1px solid ${link.color}3F`,
              color: link.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <link.Icon size={22} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{link.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>{link.desc}</div>
            <a href={link.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px', borderRadius: 9,
                background: `${link.color}22`,
                border: `1px solid ${link.color}44`,
                color: link.color, fontSize: 12, fontWeight: 700,
                textDecoration: 'none', transition: 'all .15s',
              }}>
              {link.btn} <ArrowRight size={12} />
            </a>
          </div>
        ))}
      </div>

      {/* Endpoints rapides */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <Zap size={15} /> {lang === 'en' ? 'Main endpoints' : lang === 'es' ? 'Endpoints principales' : lang === 'it' ? 'Endpoint principali' : 'Endpoints principaux'}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>{lang === 'en' ? 'Method' : lang === 'es' ? 'Método' : lang === 'it' ? 'Metodo' : 'Méthode'}</th>
                <th>Endpoint</th>
                <th>Description</th>
                <th style={{ width: 100 }}>Auth</th>
              </tr>
            </thead>
            <tbody>
              {[
                { method: 'POST', path: '/api/auth/login',           desc: lang === 'en' ? 'Authentication' : lang === 'es' ? 'Autenticación' : lang === 'it' ? 'Autenticazione' : 'Authentification',      auth: false },
                { method: 'GET',  path: '/api/products',             desc: lang === 'en' ? 'Product list' : lang === 'es' ? 'Lista de productos' : lang === 'it' ? 'Lista prodotti' : 'Liste produits',         auth: true  },
                { method: 'POST', path: '/api/sales',                desc: lang === 'en' ? 'Create sale' : lang === 'es' ? 'Crear una venta' : lang === 'it' ? 'Crea una vendita' : 'Créer une vente',          auth: true  },
                { method: 'GET',  path: '/api/customers',            desc: lang === 'en' ? 'Customer list' : lang === 'es' ? 'Lista de clientes' : lang === 'it' ? 'Lista clienti' : 'Liste clients',        auth: true  },
                { method: 'GET',  path: '/api/dashboard/stats',      desc: lang === 'en' ? 'Real-time stats' : lang === 'es' ? 'Estadísticas en tiempo real' : lang === 'it' ? 'Statistiche in tempo reale' : 'Stats en temps réel',      auth: true  },
                { method: 'POST', path: '/api/ai/analyze',           desc: lang === 'en' ? 'Claude AI analysis' : lang === 'es' ? 'Análisis IA Claude' : lang === 'it' ? 'Analisi IA Claude' : 'Analyse IA Claude',   auth: true  },
                { method: 'POST', path: '/api/ai/chat',              desc: lang === 'en' ? 'Claude AI chat' : lang === 'es' ? 'Chat IA Claude' : lang === 'it' ? 'Chat IA Claude' : 'Chat IA Claude',       auth: true  },
                { method: 'POST', path: '/api/whatsapp/send-ticket', desc: 'Ticket WhatsApp',                                               auth: true  },
                { method: 'GET',  path: '/health',                   desc: lang === 'en' ? 'API status' : lang === 'es' ? 'Estado API' : lang === 'it' ? 'Stato API' : 'Statut API',           auth: false },
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
                        color: 'var(--p)',
                        background: 'color-mix(in srgb, var(--p) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--p) 35%, transparent)',
                        borderRadius: 6, padding: '2px 8px',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}><Lock size={10} strokeWidth={2.6}/> JWT</span>
                    ) : (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: 'var(--acc)',
                        background: 'color-mix(in srgb, var(--acc) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--acc) 35%, transparent)',
                        borderRadius: 6, padding: '2px 8px',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}><Globe size={10} strokeWidth={2.6}/> Public</span>
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
          <span className="panel-t" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <Code2 size={15} /> {lang === 'en' ? 'Integration example' : lang === 'es' ? 'Ejemplo de integración' : lang === 'it' ? 'Esempio di integrazione' : "Exemple d'intégration"}
          </span>
          <button className="mini-btn"
            onClick={() => {
              const code = document.getElementById('api-example-code')?.textContent ?? ''
              navigator.clipboard.writeText(code)
              toast.success('Code copié')
            }}
            style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <Copy size={12} /> Copier
          </button>
        </div>
        <pre id="api-example-code" style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px',
          fontSize: 12, color: 'var(--text2)',
          fontFamily: 'var(--mono)',
          overflow: 'auto',
          lineHeight: 1.8,
        }}>
{highlightCode(`// JavaScript / Node.js
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

main().catch(console.error)`)}
        </pre>
      </div>
      {/* Testeur interactif */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t" style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <FlaskConical size={15} /> {lang === 'en' ? 'Interactive tester' : lang === 'es' ? 'Probador interactivo' : lang === 'it' ? 'Tester interattivo' : 'Testeur interactif'}
          </span>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:12 }}>
          <select className="input text-sm" style={{ flex:1 }} value={testerEndpoint}
            onChange={e => { setTesterEndpoint(e.target.value); setTesterResult(null) }}>
            {TESTER_ENDPOINTS.map(ep => <option key={ep}>{ep}</option>)}
          </select>
          <button
            className="btn btn-primary btn-sm"
            disabled={testerLoading}
            style={{ minWidth:90 }}
            onClick={async () => {
              setTesterLoading(true)
              setTesterResult(null)
              try {
                const spaceIdx = testerEndpoint.indexOf(' ')
                const method = testerEndpoint.slice(0, spaceIdx)
                const path   = testerEndpoint.slice(spaceIdx + 1)
                let data: unknown
                if (method === 'GET') {
                  data = await api.get(path)
                } else {
                  const body = testerBody.trim() ? JSON.parse(testerBody) : {}
                  data = await api.post(path, body)
                }
                setTesterResult(JSON.stringify(data, null, 2))
              } catch (err: any) {
                setTesterResult(`__ERR__${err.message}`)
              } finally {
                setTesterLoading(false)
              }
            }}
          >
            {testerLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Play size={12} strokeWidth={2.6}/> Tester</span>}
          </button>
        </div>

        {testerEndpoint.startsWith('POST') && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
              {lang === 'en' ? 'JSON body' : lang === 'es' ? 'Cuerpo JSON' : lang === 'it' ? 'Corpo JSON' : 'Corps JSON'}
            </div>
            <textarea
              className="input"
              style={{ width:'100%', fontFamily:'var(--mono)', fontSize:12, minHeight:80, resize:'vertical', boxSizing:'border-box' }}
              placeholder={testerEndpoint.includes('ai/analyze') ? '{"type": "full", "lang": "fr"}' : '{"messages": [{"role":"user","content":"?"}], "lang":"fr"}'}
              value={testerBody}
              onChange={e => setTesterBody(e.target.value)}
            />
          </div>
        )}

        {testerResult && (() => {
          const isError = testerResult.startsWith('__ERR__')
          const display = isError ? testerResult.slice(7) : testerResult
          return (
            <div style={{
              background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10,
              padding:14, fontSize:12, lineHeight:1.7, overflow:'auto', maxHeight:340,
              color: isError ? 'var(--danger)' : 'var(--acc2)',
              fontFamily:'var(--mono)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              {isError && <AlertCircle size={14} style={{ flexShrink:0, marginTop:2 }} />}
              <pre style={{ margin:0, fontFamily:'inherit', whiteSpace:'pre-wrap', flex:1 }}>{display}</pre>
            </div>
          )
        })()}

        {!testerResult && !testerLoading && (
          <div style={{ padding:'20px 0', textAlign:'center', fontSize:12, color:'var(--text3)' }}>
            {lang === 'en' ? 'Select an endpoint and click Test' : lang === 'es' ? 'Seleccione un endpoint y haga clic en Probar' : lang === 'it' ? 'Seleziona un endpoint e clicca Testa' : 'Sélectionnez un endpoint et cliquez Tester'}
          </div>
        )}
      </div>
    </div>
  )
}
