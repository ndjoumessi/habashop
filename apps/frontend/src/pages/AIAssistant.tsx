import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { aiApi } from '@/lib/api'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import toast from 'react-hot-toast'

interface ChatMessage {
  id:       string
  role:     'user' | 'assistant'
  content:  string
  time:     Date
  loading?: boolean
}

const ANALYSIS_BUTTONS = [
  { type:'full',      icon:'📊', color:'#6C47FF', fr:'Analyse mensuelle',   en:'Monthly analysis'   },
  { type:'stock',     icon:'📦', color:'#FF9500', fr:'Analyse stock',        en:'Stock analysis'     },
  { type:'revenue',   icon:'💰', color:'#00D084', fr:'Analyse financière',   en:'Financial analysis' },
  { type:'customers', icon:'👥', color:'#00B8FF', fr:'Analyse clients',      en:'Customer analysis'  },
]

const QUICK_QUESTIONS = {
  fr: [
    'Quels sont mes produits les plus vendus ?',
    'Quels produits sont en rupture de stock ?',
    'Comment améliorer mon chiffre d\'affaires ?',
    'Quel est mon taux de marge actuel ?',
    'Quels clients dois-je fidéliser ?',
  ],
  en: [
    'What are my best-selling products?',
    'Which products are out of stock?',
    'How can I improve my revenue?',
    'What is my current margin rate?',
    'Which customers should I prioritize?',
  ],
}

const WELCOME: Record<string, string> = {
  fr: `# Bonjour ! Je suis **HabaShop AI** 👋\n\nAssistant commercial intelligent alimenté par **Claude** d'Anthropic.\n\n## Ce que je peux faire :\n- 📊 Analyser vos **ventes et tendances**\n- 📦 Surveiller votre **stock** et prévenir les ruptures\n- 💰 Analyser vos **finances** et rentabilité\n- 👥 Segmenter vos **clients** et recommander des actions\n- 💡 Répondre à toutes vos **questions business**\n\nLancez une analyse rapide ou posez-moi une question !`,
  en: `# Hello! I'm **HabaShop AI** 👋\n\nIntelligent business assistant powered by **Claude** from Anthropic.\n\n## What I can do:\n- 📊 Analyze your **sales and trends**\n- 📦 Monitor your **stock** and prevent stockouts\n- 💰 Analyze your **finances** and profitability\n- 👥 Segment your **customers** and recommend actions\n- 💡 Answer all your **business questions**\n\nLaunch a quick analysis or ask me a question!`,
}

export default function AIAssistant() {
  const { lang } = useAppStore()
  const [messages, setMessages]           = useState<ChatMessage[]>([])
  const [input, setInput]                 = useState('')
  const [analyzing, setAnalyzing]         = useState(false)
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setMessages([{
      id: 'welcome', role: 'assistant', time: new Date(),
      content: WELCOME[lang] ?? WELCOME.fr,
    }])
  }, [lang])

  const addLoadingMsg = (): string => {
    const id = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id, role: 'assistant', content: '', time: new Date(), loading: true }])
    return id
  }

  const resolveMsg = (id: string, content: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content, loading: false } : m))

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || analyzing) return
    setInput('')

    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user', content, time: new Date(),
    }])
    const loadingId = addLoadingMsg()
    setAnalyzing(true)

    try {
      const data = await aiApi.chat(content, lang)
      resolveMsg(loadingId, data.response ?? '')
    } catch (err: any) {
      resolveMsg(loadingId,
        lang === 'fr'
          ? `❌ **Erreur :** ${err.message}\n\nVérifiez que le backend est connecté.`
          : `❌ **Error:** ${err.message}\n\nCheck that the backend is connected.`
      )
      toast.error(lang === 'fr' ? 'Erreur assistant IA' : 'AI assistant error')
    } finally {
      setAnalyzing(false)
    }
  }

  const runAnalysis = async (type: string) => {
    if (analyzing) return
    setActiveAnalysis(type)

    const btn = ANALYSIS_BUTTONS.find(b => b.type === type)
    const label = btn ? (lang === 'fr' ? btn.fr : btn.en) : type

    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user', time: new Date(),
      content: lang === 'fr' ? `Lance une ${label.toLowerCase()}` : `Run a ${label.toLowerCase()}`,
    }])
    const loadingId = addLoadingMsg()
    setAnalyzing(true)

    try {
      const data = await aiApi.analyze(type, lang)
      resolveMsg(loadingId, data.analysis ?? data.response ?? '')
    } catch (err: any) {
      resolveMsg(loadingId, `❌ ${err.message}`)
    } finally {
      setAnalyzing(false)
      setActiveAnalysis(null)
    }
  }

  const clearChat = () => {
    setMessages(prev => prev.slice(0, 1))
    toast.success(lang === 'fr' ? 'Conversation effacée' : 'Chat cleared')
  }

  return (
    <div className="animate-in" style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 54px)', gap: 0,
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px', flexShrink: 0, marginBottom: 12,
        background: 'linear-gradient(135deg,rgba(108,71,255,.1),rgba(108,71,255,.03))',
        border: '1px solid rgba(108,71,255,.2)', borderRadius: 20,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -30, top: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(108,71,255,.12),transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, flexShrink: 0,
            background: 'linear-gradient(135deg,#6C47FF,#A991FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            boxShadow: '0 6px 20px rgba(108,71,255,.4)',
          }}>🤖</div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-.3px' }}>
                HabaShop
                <span style={{
                  background: 'linear-gradient(135deg,#6C47FF,#A991FF)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text', marginLeft: 5,
                }}>AI</span>
              </span>
              <span style={{
                fontSize: 9, fontWeight: 800,
                background: 'rgba(108,71,255,.2)', color: 'var(--p3)',
                border: '1px solid rgba(108,71,255,.3)',
                borderRadius: 99, padding: '2px 7px',
                textTransform: 'uppercase', letterSpacing: '.5px',
              }}>Claude</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--acc2)', boxShadow: '0 0 8px var(--acc2)',
                }} />
                <span style={{ fontSize: 10, color: 'var(--acc2)', fontWeight: 600 }}>
                  {lang === 'fr' ? 'En ligne' : 'Online'}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: '3px 0 0', lineHeight: 1.4 }}>
              {lang === 'fr'
                ? 'Assistant commercial intelligent — Analyses, prévisions & recommandations personnalisées'
                : 'Intelligent business assistant — Analytics, forecasts & personalized recommendations'}
            </p>
          </div>

          {messages.length > 1 && (
            <button className="mini-btn" onClick={clearChat}>
              🗑 {lang === 'fr' ? 'Effacer' : 'Clear'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {ANALYSIS_BUTTONS.map(btn => (
            <button key={btn.type} type="button"
              onClick={() => runAnalysis(btn.type)}
              disabled={analyzing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                border: `1px solid ${btn.color}30`,
                background: activeAnalysis === btn.type ? `${btn.color}20` : `${btn.color}0D`,
                cursor: analyzing ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, color: btn.color,
                transition: 'all .12s',
                opacity: analyzing && activeAnalysis !== btn.type ? .5 : 1,
              }}>
              {activeAnalysis === btn.type
                ? <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `2px solid ${btn.color}`, borderTopColor: 'transparent',
                    display: 'inline-block', animation: 'spin .6s linear infinite',
                  }} />
                : btn.icon}
              {lang === 'fr' ? btn.fr : btn.en}
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        display: 'flex', flexDirection: 'column',
        gap: 12, padding: '4px 2px',
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: msg.role === 'assistant'
                ? 'linear-gradient(135deg,#6C47FF,#A991FF)'
                : 'linear-gradient(135deg,var(--acc2),var(--p2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, marginTop: 2,
              boxShadow: msg.role === 'assistant' ? '0 3px 10px rgba(108,71,255,.3)' : 'none',
            }}>
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </div>

            <div style={{
              maxWidth: '80%', display: 'flex', flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 4,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: msg.role === 'assistant' ? 'var(--p3)' : 'var(--text3)',
                }}>
                  {msg.role === 'assistant' ? 'HabaShop AI' : (lang === 'fr' ? 'Vous' : 'You')}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text4)' }}>
                  {msg.time.toLocaleTimeString(
                    lang === 'fr' ? 'fr-FR' : 'en-US',
                    { hour: '2-digit', minute: '2-digit' }
                  )}
                </span>
              </div>

              <div style={{
                padding: '12px 16px',
                background: msg.role === 'assistant'
                  ? 'linear-gradient(135deg,rgba(108,71,255,.08),rgba(108,71,255,.03))'
                  : 'rgba(0,208,132,.08)',
                border: `1px solid ${msg.role === 'assistant'
                  ? 'rgba(108,71,255,.15)' : 'rgba(0,208,132,.15)'}`,
                borderRadius: msg.role === 'assistant'
                  ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              }}>
                {msg.loading ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: '50%', background: 'var(--p2)',
                        animation: `bounce .8s ${i * 0.15}s infinite`,
                      }} />
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>
                      {lang === 'fr' ? 'HabaShop AI réfléchit...' : 'HabaShop AI is thinking...'}
                    </span>
                  </div>
                ) : msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                    {msg.content}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Questions rapides ── */}
      {messages.length <= 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0', flexShrink: 0 }}>
          {(QUICK_QUESTIONS[lang === 'fr' ? 'fr' : 'en'] ?? QUICK_QUESTIONS.fr).map((q, i) => (
            <button key={i} type="button"
              onClick={() => sendMessage(q)}
              disabled={analyzing}
              style={{
                padding: '6px 12px', borderRadius: 99,
                background: 'var(--bg4)', border: '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 11, color: 'var(--text2)', transition: 'all .12s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--p)'
                el.style.color = 'var(--p3)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.color = 'var(--text2)'
              }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div style={{
        flexShrink: 0, paddingTop: 8,
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <div style={{
          flex: 1, background: 'var(--bg4)',
          border: '1.5px solid var(--border)', borderRadius: 14,
          overflow: 'hidden', transition: 'border-color .15s',
        }}
          onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--p)'}
          onBlurCapture={e  => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
        >
          <textarea
            ref={inputRef}
            rows={2}
            placeholder={lang === 'fr'
              ? 'Posez une question à HabaShop AI... (Enter pour envoyer)'
              : 'Ask HabaShop AI a question... (Enter to send)'}
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 2000))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={analyzing}
            style={{
              width: '100%', background: 'transparent',
              border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 13,
              padding: '12px 14px', resize: 'none',
              fontFamily: 'var(--font)', lineHeight: 1.5,
              opacity: analyzing ? .6 : 1,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ padding: '2px 10px 8px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: 'var(--text4)' }}>Shift+Enter = nouvelle ligne</span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--mono)',
              color: input.length > 1800 ? 'var(--warn)' : 'var(--text4)',
            }}>
              {input.length}/2000
            </span>
          </div>
        </div>

        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || analyzing}
          style={{
            width: 50, height: 50, borderRadius: 14, flexShrink: 0,
            background: input.trim() && !analyzing
              ? 'linear-gradient(135deg,#6C47FF,#A991FF)' : 'var(--bg4)',
            border: `1px solid ${input.trim() && !analyzing ? 'transparent' : 'var(--border)'}`,
            cursor: input.trim() && !analyzing ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            boxShadow: input.trim() && !analyzing ? '0 4px 14px rgba(108,71,255,.4)' : 'none',
            transition: 'all .15s',
          }}>
          {analyzing ? '⏳' : '🚀'}
        </button>
      </div>
    </div>
  )
}
