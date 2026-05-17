import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { aiApi } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  loading?: boolean
}

const SUGGESTED_QUESTIONS = {
  fr: [
    '📊 Quels sont mes produits les plus vendus ?',
    '⚠️ Quels produits sont en risque de rupture ?',
    '💰 Comment améliorer ma marge brute ?',
    '👥 Mon équipe est-elle bien dimensionnée ?',
    '📈 Quelles sont mes prévisions pour le mois prochain ?',
    '🛒 Comment augmenter mon panier moyen ?',
    '📦 Quels produits devrais-je commander en priorité ?',
    '💡 Donne-moi 3 idées pour augmenter mes ventes',
  ],
  en: [
    '📊 What are my best-selling products?',
    '⚠️ Which products are at risk of stockout?',
    '💰 How can I improve my gross margin?',
    '👥 Is my team well-sized?',
    '📈 What are my forecasts for next month?',
    '🛒 How can I increase my average basket?',
    '📦 Which products should I order first?',
    '💡 Give me 3 ideas to increase my sales',
  ],
  es: [
    '📊 ¿Cuáles son mis productos más vendidos?',
    '⚠️ ¿Qué productos están en riesgo de ruptura?',
    '💰 ¿Cómo mejorar mi margen bruto?',
    '👥 ¿Está bien dimensionado mi equipo?',
    '📈 ¿Cuáles son mis previsiones para el próximo mes?',
    '🛒 ¿Cómo aumentar mi ticket promedio?',
    '📦 ¿Qué productos debo pedir primero?',
    '💡 Dame 3 ideas para aumentar mis ventas',
  ],
  it: [
    '📊 Quali sono i miei prodotti più venduti?',
    '⚠️ Quali prodotti rischiano la rottura di stock?',
    '💰 Come migliorare il mio margine lordo?',
    '👥 Il mio team è ben dimensionato?',
    '📈 Quali sono le previsioni per il mese prossimo?',
    '🛒 Come aumentare il mio scontrino medio?',
    '📦 Quali prodotti dovrei ordinare prima?',
    '💡 Dammi 3 idee per aumentare le vendite',
  ],
}

export default function AIAssistant() {
  const navigate = useNavigate()
  const { lang } = useAppStore()
  void useFormatAmount()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: lang === 'fr'
        ? '👋 Bonjour ! Je suis votre assistant IA HabaShop, propulsé par Claude.\n\nJe peux analyser vos données de vente, stock, finances et RH pour vous aider à prendre de meilleures décisions.\n\nQue puis-je faire pour vous aujourd\'hui ?'
        : lang === 'en'
          ? '👋 Hello! I\'m your HabaShop AI assistant, powered by Claude.\n\nI can analyze your sales, stock, finance and HR data to help you make better decisions.\n\nHow can I help you today?'
          : lang === 'es'
            ? '👋 ¡Hola! Soy su asistente IA de HabaShop, impulsado por Claude.\n\n¿En qué puedo ayudarle hoy?'
            : '👋 Ciao! Sono il vostro assistente IA HabaShop, alimentato da Claude.\n\nCome posso aiutarla oggi?',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const questions = SUGGESTED_QUESTIONS[lang as keyof typeof SUGGESTED_QUESTIONS] ?? SUGGESTED_QUESTIONS.fr

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    const loadingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const result = await aiApi.chat(history, lang)

      setMessages(prev => prev.map(m =>
        m.loading ? { ...m, content: result.response, loading: false } : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading ? {
          ...m,
          content: lang === 'fr'
            ? '❌ Désolé, je rencontre une difficulté. Vérifiez votre connexion et réessayez.'
            : '❌ Sorry, I\'m having trouble. Please check your connection and try again.',
          loading: false,
        } : m
      ))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 54px)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px', flexShrink: 0,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg,var(--p),var(--p2))',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20,
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              {lang === 'fr' ? 'Assistant IA HabaShop'
                : lang === 'en' ? 'HabaShop AI Assistant'
                : lang === 'es' ? 'Asistente IA HabaShop'
                : 'Assistente IA HabaShop'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--acc2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc2)' }} />
              {lang === 'fr' ? 'En ligne — Powered by Claude' : 'Online — Powered by Claude'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mini-btn"
            onClick={() => setMessages(prev => [prev[0]])}>
            🗑 {lang === 'fr' ? 'Effacer' : 'Clear'}
          </button>
          <button className="mini-btn" onClick={() => navigate(-1)}>
            ← {lang === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        padding: '16px', display: 'flex',
        flexDirection: 'column', gap: 12,
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            gap: 10,
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg,var(--p),var(--p2))',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16,
                alignSelf: 'flex-end',
              }}>🤖</div>
            )}

            <div style={{
              maxWidth: '70%',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg,var(--p),var(--p2))'
                : 'var(--card)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              borderRadius: msg.role === 'user'
                ? '18px 18px 4px 18px'
                : '18px 18px 18px 4px',
              padding: '12px 16px',
              border: msg.role === 'assistant'
                ? '1px solid var(--border)' : 'none',
              boxShadow: msg.role === 'user'
                ? '0 4px 12px rgba(91,78,232,.3)' : 'none',
            }}>
              {msg.loading ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--p2)',
                      animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                    }} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              )}
              <div style={{
                fontSize: 10, marginTop: 6,
                color: msg.role === 'user' ? 'rgba(255,255,255,.6)' : 'var(--text3)',
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}>
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {msg.role === 'user' && (
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16,
                alignSelf: 'flex-end',
              }}>👤</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Questions suggérées */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.5px',
            marginBottom: 8,
          }}>
            {lang === 'fr' ? '💡 Questions suggérées'
              : lang === 'en' ? '💡 Suggested questions'
              : lang === 'es' ? '💡 Preguntas sugeridas'
              : '💡 Domande suggerite'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {questions.slice(0, 4).map((q, i) => (
              <button key={i}
                onClick={() => sendMessage(q)}
                style={{
                  padding: '7px 12px', borderRadius: 20,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text2)',
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  transition: 'all .15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(91,78,232,.1)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--p2)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--p2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
                }}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--card)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder={
              lang === 'fr' ? 'Posez votre question... (Entrée pour envoyer)'
              : lang === 'en' ? 'Ask your question... (Enter to send)'
              : lang === 'es' ? 'Haga su pregunta... (Enter para enviar)'
              : 'Fai la tua domanda... (Invio per inviare)'
            }
            style={{
              flex: 1, padding: '11px 14px',
              background: 'var(--bg3)',
              border: '1.5px solid var(--border)',
              borderRadius: 14, fontSize: 14,
              color: 'var(--text)', fontFamily: 'var(--font)',
              outline: 'none', resize: 'none',
              minHeight: 44, maxHeight: 120,
              lineHeight: 1.5,
              transition: 'border-color .15s',
            }}
            rows={1}
            disabled={loading}
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--p2)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: !input.trim() || loading
                ? 'var(--bg4)'
                : 'linear-gradient(135deg,var(--p),var(--p2))',
              border: 'none', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, transition: 'all .2s',
              boxShadow: !input.trim() || loading ? 'none' : '0 4px 12px rgba(91,78,232,.3)',
            }}>
            {loading ? '⏳' : '➤'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
          {lang === 'fr' ? 'Shift+Entrée pour nouvelle ligne · Vos données restent privées'
            : 'Shift+Enter for new line · Your data remains private'}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
