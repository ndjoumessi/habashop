import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { aiApi } from '@/lib/api'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import toast from 'react-hot-toast'
import { Bot, BarChart2, Package, TrendingUp, Users, Trash2, Send, User, Plus, MessageSquare, DollarSign, ShoppingCart } from 'lucide-react'

interface ChatMessage {
  id:       string
  role:     'user' | 'assistant'
  content:  string
  time:     Date
  loading?: boolean
}

const ANALYSIS_BUTTONS: { type: string; Icon: typeof BarChart2; color: string; fr: string; en: string }[] = [
  { type:'full',      Icon: BarChart2,  color:'#6C47FF', fr:'Analyse mensuelle',   en:'Monthly analysis'   },
  { type:'stock',     Icon: Package,    color:'#FF9500', fr:'Analyse stock',        en:'Stock analysis'     },
  { type:'revenue',   Icon: TrendingUp, color:'#00D084', fr:'Analyse financière',   en:'Financial analysis' },
  { type:'customers', Icon: Users,      color:'#00B8FF', fr:'Analyse clients',      en:'Customer analysis'  },
]

interface QuickAction { Icon: typeof BarChart2; label: string; prompt: string; color: string }

const QUICK_ACTIONS_FR: QuickAction[] = [
  { Icon: BarChart2,    label:'Analyse des ventes',      prompt:'Analyse mes ventes du mois et donne-moi les tendances clés.',        color:'#6C47FF' },
  { Icon: Package,      label:'Alertes stock',           prompt:'Quels produits sont en rupture ou en stock critique ?',               color:'#FF9500' },
  { Icon: TrendingUp,   label:'Opportunités croissance', prompt:'Quelles sont les meilleures opportunités de croissance ?',            color:'#00D084' },
  { Icon: Users,        label:'Analyse clients',         prompt:'Analyse mon portefeuille clients et identifie les plus rentables.',   color:'#00B8FF' },
  { Icon: DollarSign,   label:'Santé financière',        prompt:'Donne-moi un bilan de la santé financière de ma boutique ce mois.',  color:'#F472B6' },
  { Icon: ShoppingCart, label:'Top produits',            prompt:'Quels sont mes 10 meilleurs produits en termes de CA ce mois-ci ?',  color:'#34D399' },
]

const QUICK_ACTIONS_EN: QuickAction[] = [
  { Icon: BarChart2,    label:'Sales analysis',       prompt:'Analyze my monthly sales and give me the key trends.',               color:'#6C47FF' },
  { Icon: Package,      label:'Stock alerts',         prompt:'Which products are out of stock or critically low?',                 color:'#FF9500' },
  { Icon: TrendingUp,   label:'Growth opportunities', prompt:'What are the best growth opportunities for my business?',            color:'#00D084' },
  { Icon: Users,        label:'Customer analysis',    prompt:'Analyze my customer portfolio and identify the most profitable.',    color:'#00B8FF' },
  { Icon: DollarSign,   label:'Financial health',     prompt:'Give me a financial health summary of my shop this month.',          color:'#F472B6' },
  { Icon: ShoppingCart, label:'Top products',         prompt:'What are my top 10 products by revenue this month?',                color:'#34D399' },
]

const SHOP_CONTEXT_FR = [
  { label:'Type boutique',   value:'Commerce général' },
  { label:'Articles actifs', value:'142 produits'     },
  { label:'CA ce mois',      value:'2 650 000 F'      },
  { label:'Clients actifs',  value:'89 clients'       },
]

const SHOP_CONTEXT_EN = [
  { label:'Shop type',             value:'General retail' },
  { label:'Active items',          value:'142 products'   },
  { label:'Revenue this month',    value:'2,650,000 F'    },
  { label:'Active customers',      value:'89 customers'   },
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
  fr: `# Bonjour ! Je suis **HabaShop AI** 👋\n\nAssistant commercial intelligent alimenté par **Claude** d'Anthropic.\n\n## Ce que je peux faire :\n- Analyser vos **ventes et tendances**\n- Surveiller votre **stock** et prévenir les ruptures\n- Analyser vos **finances** et rentabilité\n- Segmenter vos **clients** et recommander des actions\n- Répondre à toutes vos **questions business**\n\nChoisissez une action rapide ou posez-moi une question !`,
  en: `# Hello! I'm **HabaShop AI** 👋\n\nIntelligent business assistant powered by **Claude** from Anthropic.\n\n## What I can do:\n- Analyze your **sales and trends**\n- Monitor your **stock** and prevent stockouts\n- Analyze your **finances** and profitability\n- Segment your **customers** and recommend actions\n- Answer all your **business questions**\n\nChoose a quick action or ask me a question!`,
}

export default function AIAssistant() {
  const { lang } = useAppStore()
  const [messages, setMessages]             = useState<ChatMessage[]>([])
  const [input, setInput]                   = useState('')
  const [analyzing, setAnalyzing]           = useState(false)
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setMessages([{ id:'welcome', role:'assistant', time: new Date(), content: WELCOME[lang] ?? WELCOME.fr }])
  }, [lang])

  const addLoadingMsg = (): string => {
    const id = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id, role:'assistant', content:'', time: new Date(), loading:true }])
    return id
  }

  const resolveMsg = (id: string, content: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content, loading:false } : m))

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || analyzing) return
    setInput('')
    setMessages(prev => [...prev, { id: Date.now().toString(), role:'user', content, time: new Date() }])
    const loadingId = addLoadingMsg()
    setAnalyzing(true)
    try {
      const data = await aiApi.chat(content, lang)
      resolveMsg(loadingId, data.response ?? '')
    } catch (err: any) {
      const msg = err.message ?? ''
      const friendly = msg.includes('authentication_error') || msg.includes('invalid x-api-key')
        ? (lang === 'fr' ? '❌ Clé API Anthropic invalide. Vérifiez la configuration du serveur.' : '❌ Invalid Anthropic API key. Check server configuration.')
        : msg.includes('503') || msg.includes('non configurée')
          ? (lang === 'fr' ? '❌ Service IA temporairement indisponible.' : '❌ AI service temporarily unavailable.')
          : (lang === 'fr' ? '❌ Erreur de connexion. Réessayez dans quelques instants.' : '❌ Connection error. Please try again.')
      resolveMsg(loadingId, friendly)
      toast.error(lang === 'fr' ? 'Erreur assistant IA' : 'AI assistant error')
    } finally {
      setAnalyzing(false)
    }
  }

  const runAnalysis = async (type: string) => {
    if (analyzing) return
    setActiveAnalysis(type)
    const btn   = ANALYSIS_BUTTONS.find(b => b.type === type)
    const label = btn ? (lang === 'fr' ? btn.fr : btn.en) : type
    setMessages(prev => [...prev, {
      id: Date.now().toString(), role:'user', time: new Date(),
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

  const quickActions = lang === 'fr' ? QUICK_ACTIONS_FR : QUICK_ACTIONS_EN
  const shopContext  = lang === 'fr' ? SHOP_CONTEXT_FR  : SHOP_CONTEXT_EN

  return (
    <div className="animate-in" style={{ display:'flex', gap:16, alignItems:'flex-start' }}>

      {/* ── Sidebar 280px sticky ─────────────────────────────────── */}
      <div style={{ width:280, flexShrink:0, position:'sticky', top:24, display:'flex', flexDirection:'column', gap:12 }}>

        {/* Status + New chat */}
        <div style={{
          background:'linear-gradient(135deg,rgba(108,71,255,.12),rgba(108,71,255,.04))',
          border:'1px solid rgba(108,71,255,.2)', borderRadius:16, padding:16,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{
              width:44, height:44, borderRadius:12, flexShrink:0,
              background:'linear-gradient(135deg,#6C47FF,#A991FF)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 14px rgba(108,71,255,.4)',
            }}><Bot size={22} style={{ color:'#fff' }}/></div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:'var(--text)', letterSpacing:'-.2px' }}>
                HabaShop
                <span style={{
                  background:'linear-gradient(135deg,#6C47FF,#A991FF)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text', marginLeft:4,
                }}>AI</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--acc2)', boxShadow:'0 0 6px var(--acc2)' }} />
                <span style={{ fontSize:10, color:'var(--acc2)', fontWeight:600 }}>
                  {lang === 'fr' ? 'En ligne · Claude' : 'Online · Claude'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => { clearChat(); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
              width:'100%', padding:'9px 14px', borderRadius:10,
              background:'rgba(108,71,255,.15)', border:'1px solid rgba(108,71,255,.3)',
              color:'var(--p3)', fontSize:12, fontWeight:700, cursor:'pointer',
              fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              transition:'all .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.25)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.15)' }}
          ><Plus size={13}/> {lang === 'fr' ? 'Nouvelle conversation' : 'New conversation'}</button>
        </div>

        {/* Quick actions */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:14 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text3)', marginBottom:10 }}>
            {lang === 'fr' ? 'Actions rapides' : 'Quick actions'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {quickActions.map((action, i) => (
              <button key={i} onClick={() => sendMessage(action.prompt)} disabled={analyzing}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 11px',
                  borderRadius:10, border:`1px solid ${action.color}1A`,
                  background:`${action.color}0D`,
                  cursor: analyzing ? 'not-allowed' : 'pointer', fontFamily:'var(--font)',
                  transition:'all .12s', opacity: analyzing ? .5 : 1, textAlign:'left',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = `${action.color}1A`
                  el.style.borderColor = `${action.color}35`
                  el.style.transform = 'translateX(2px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = `${action.color}0D`
                  el.style.borderColor = `${action.color}1A`
                  el.style.transform = 'none'
                }}
              >
                <div style={{
                  width:28, height:28, borderRadius:8,
                  background:`${action.color}18`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: action.color, flexShrink:0,
                }}><action.Icon size={14}/></div>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)', lineHeight:1.3 }}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Shop context */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:14 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text3)', marginBottom:10 }}>
            {lang === 'fr' ? 'Contexte boutique' : 'Shop context'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {shopContext.map((item, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom: i < shopContext.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize:11, color:'var(--text3)' }}>{item.label}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text2)', fontFamily:'var(--mono)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis buttons */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:14 }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text3)', marginBottom:10 }}>
            {lang === 'fr' ? 'Analyses IA' : 'AI analyses'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {ANALYSIS_BUTTONS.map(btn => (
              <button key={btn.type} type="button"
                onClick={() => runAnalysis(btn.type)}
                disabled={analyzing}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'8px 11px', borderRadius:9,
                  border:`1px solid ${btn.color}25`,
                  background: activeAnalysis === btn.type ? `${btn.color}18` : `${btn.color}0A`,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  fontFamily:'var(--font)', fontSize:12, fontWeight:600, color:btn.color,
                  transition:'all .12s', textAlign:'left',
                  opacity: analyzing && activeAnalysis !== btn.type ? .5 : 1,
                }}>
                {activeAnalysis === btn.type
                  ? <span style={{ width:12, height:12, borderRadius:'50%', border:`2px solid ${btn.color}`, borderTopColor:'transparent', display:'inline-block', animation:'spin .6s linear infinite', flexShrink:0 }} />
                  : <btn.Icon size={13}/>}
                {lang === 'fr' ? btn.fr : btn.en}
              </button>
            ))}
          </div>
        </div>

        {/* Clear chat */}
        {messages.length > 1 && (
          <button className="mini-btn" onClick={clearChat}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, cursor:'pointer', color:'var(--danger)', borderColor:'rgba(232,64,74,.2)', width:'100%', padding:8 }}>
            <Trash2 size={12}/> {lang === 'fr' ? 'Effacer la conversation' : 'Clear conversation'}
          </button>
        )}
      </div>

      {/* ── Chat zone flex:1 ──────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'80vh', gap:0 }}>

        {/* Chat header */}
        <div style={{
          padding:'14px 18px', flexShrink:0, marginBottom:12,
          background:'linear-gradient(135deg,rgba(108,71,255,.08),rgba(108,71,255,.03))',
          border:'1px solid rgba(108,71,255,.15)', borderRadius:16,
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:100, height:100, borderRadius:'50%', background:'radial-gradient(circle,rgba(108,71,255,.1),transparent 70%)', pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <MessageSquare size={15} style={{ color:'var(--p3)', flexShrink:0 }} />
            <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>
              {lang === 'fr' ? 'Conversation' : 'Chat'}
            </span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)' }}>
              {messages.length} {lang === 'fr' ? 'messages' : 'messages'}
            </span>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', margin:'5px 0 0', lineHeight:1.4 }}>
            {lang === 'fr'
              ? 'Posez vos questions ou utilisez les actions rapides du panneau gauche.'
              : 'Ask questions or use the quick actions in the left panel.'}
          </p>
        </div>

        {/* Messages */}
        <div style={{
          flex:1, overflowY:'auto', minHeight:0,
          display:'flex', flexDirection:'column',
          gap:12, padding:'4px 2px',
        }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              display:'flex', gap:10, alignItems:'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width:34, height:34, borderRadius:10, flexShrink:0,
                background: msg.role === 'assistant'
                  ? 'linear-gradient(135deg,#6C47FF,#A991FF)'
                  : 'linear-gradient(135deg,var(--acc2),var(--p2))',
                display:'flex', alignItems:'center', justifyContent:'center',
                marginTop:2,
                boxShadow: msg.role === 'assistant' ? '0 3px 10px rgba(108,71,255,.3)' : 'none',
              }}>
                {msg.role === 'assistant'
                  ? <Bot  size={16} style={{ color:'#fff' }}/>
                  : <User size={16} style={{ color:'#fff' }}/>}
              </div>

              <div style={{
                maxWidth:'80%', display:'flex', flexDirection:'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap:4,
              }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}>
                  <span style={{ fontSize:11, fontWeight:700, color: msg.role === 'assistant' ? 'var(--p3)' : 'var(--text3)' }}>
                    {msg.role === 'assistant' ? 'HabaShop AI' : (lang === 'fr' ? 'Vous' : 'You')}
                  </span>
                  <span style={{ fontSize:9, color:'var(--text4)' }}>
                    {msg.time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>

                <div style={{
                  padding:'12px 16px',
                  background: msg.role === 'assistant'
                    ? 'linear-gradient(135deg,rgba(108,71,255,.08),rgba(108,71,255,.03))'
                    : 'rgba(0,208,132,.08)',
                  border:`1px solid ${msg.role === 'assistant' ? 'rgba(108,71,255,.15)' : 'rgba(0,208,132,.15)'}`,
                  borderRadius: msg.role === 'assistant' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                }}>
                  {msg.loading ? (
                    <div style={{ display:'flex', gap:4, alignItems:'center', padding:'4px 0' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width:7, height:7, borderRadius:'50%', background:'var(--p2)',
                          animation:`bounce .8s ${i * 0.15}s infinite`,
                        }} />
                      ))}
                      <span style={{ fontSize:11, color:'var(--text3)', marginLeft:6 }}>
                        {lang === 'fr' ? 'HabaShop AI réfléchit...' : 'HabaShop AI is thinking...'}
                      </span>
                    </div>
                  ) : msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <p style={{ fontSize:13, color:'var(--text)', margin:0, lineHeight:1.5 }}>{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions */}
        {messages.length <= 2 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'8px 0', flexShrink:0 }}>
            {(QUICK_QUESTIONS[lang === 'fr' ? 'fr' : 'en'] ?? QUICK_QUESTIONS.fr).map((q, i) => (
              <button key={i} type="button"
                onClick={() => sendMessage(q)}
                disabled={analyzing}
                style={{
                  padding:'6px 12px', borderRadius:99,
                  background:'var(--bg4)', border:'1px solid var(--border)',
                  cursor:'pointer', fontFamily:'var(--font)',
                  fontSize:11, color:'var(--text2)', transition:'all .12s',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--p)'; el.style.color = 'var(--p3)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text2)' }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          flexShrink:0, paddingTop:8,
          borderTop:'1px solid var(--border)',
          display:'flex', gap:8, alignItems:'flex-end',
        }}>
          <div style={{
            flex:1, background:'var(--bg4)',
            border:'1.5px solid var(--border)', borderRadius:14,
            overflow:'hidden', transition:'border-color .15s',
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
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              disabled={analyzing}
              style={{
                width:'100%', background:'transparent',
                border:'none', outline:'none',
                color:'var(--text)', fontSize:13,
                padding:'12px 14px', resize:'none',
                fontFamily:'var(--font)', lineHeight:1.5,
                opacity: analyzing ? .6 : 1,
                boxSizing:'border-box',
              }}
            />
            <div style={{ padding:'2px 10px 8px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:9, color:'var(--text4)' }}>Shift+Enter = nouvelle ligne</span>
              <span style={{ fontSize:10, fontFamily:'var(--mono)', color: input.length > 1800 ? 'var(--warn)' : 'var(--text4)' }}>
                {input.length}/2000
              </span>
            </div>
          </div>

          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || analyzing}
            style={{
              width:50, height:50, borderRadius:14, flexShrink:0,
              background: input.trim() && !analyzing ? 'linear-gradient(135deg,#6C47FF,#A991FF)' : 'var(--bg4)',
              border:`1px solid ${input.trim() && !analyzing ? 'transparent' : 'var(--border)'}`,
              cursor: input.trim() && !analyzing ? 'pointer' : 'default',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: input.trim() && !analyzing ? '0 4px 14px rgba(108,71,255,.4)' : 'none',
              transition:'all .15s',
            }}>
            {analyzing
              ? <span style={{ width:20, height:20, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', display:'inline-block', animation:'spin .6s linear infinite' }} />
              : <Send size={20} style={{ color: input.trim() ? '#fff' : 'var(--text3)' }} />}
          </button>
        </div>
      </div>
    </div>
  )
}
