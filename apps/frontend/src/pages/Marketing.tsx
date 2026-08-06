import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { useAppStore } from '@/stores/appStore'
import { customersApi, marketingApi, type Campaign } from '@/lib/api'
import toast from 'react-hot-toast'
import { Search, Send, Users, CheckSquare, Square, Smartphone, Tag, Package, Gift, MessageCircle, Megaphone, Clock, Loader2 } from 'lucide-react'
import { normalizeClientType, CLIENT_TYPES } from '@/lib/clientType'
import { clientTypeToLabel, typeLabel, type ApiCustomer } from '@/components/customers/customersShared'

interface Customer {
  id: string
  name: string
  phone: string
  type: string
  loyaltyPoints?: number
}

// ─── i18n ────────────────────────────────────────────────────────────────────

const MK = {
  fr: {
    title:             'WhatsApp Marketing',
    subtitle:          'Envoyez des messages WhatsApp personnalisés à vos clients',
    warning:           '⚠️ Incluez "Répondez STOP" dans vos messages pour respecter la confidentialité.',
    select_all:        'Tout sélectionner',
    search:            'Rechercher un client...',
    loading:           '⏳ Chargement...',
    no_customers:      'Aucun client avec numéro WhatsApp',
    templates_title:   'Modèles rapides',
    msg_title:         'Message WhatsApp',
    msg_placeholder:   'Rédigez votre message...\n\n*gras* _italique_',
    formatting:        '*gras* _italique_ ~barré~',
    chars:             'caractères',
    result_ok:         '✅ Envoi réussi !',
    result_partial:    '⚠️ Envoi partiel',
    sent_toast:        'envoyé(s)',
    send:              'Envoyer à',
    client:            'client',
    clients:           'clients',
    select_recipients: 'Sélectionnez des destinataires',
    sending:           'Envoi en cours...',
    limit:             '⚠️ Maximum 20 destinataires par envoi · 500 ms entre chaque message',
    err_msg:           'Écrivez un message avant d\'envoyer',
    err_recipient:     'Sélectionnez au moins un destinataire',
    err_max:           'Maximum 20 destinataires par envoi',
    err_send:          'Erreur envoi',
    aria_search:       'Rechercher',
    failed:            'échoué',
    failed_plural:     'échoués',
    word_message:      'message',
    word_messages:     'messages',
    wa_render:         'RENDU WHATSAPP',
    tpl_promo:   { label: 'Promotion du jour',      msg: '🎉 *Promotion spéciale !*\n\nProfitez de nos offres exceptionnelles aujourd\'hui !\n\n👉 Venez nous rendre visite ou contactez-nous pour en savoir plus.\n\n_Votre équipe HabaShop_ 🛒' },
    tpl_stock:   { label: 'Nouveau stock',           msg: '📦 *Nouvelle arrivée en stock !*\n\nDe nouveaux produits viennent d\'arriver !\nQuantités limitées — premier arrivé, premier servi.\n\n🏪 Retrouvez-nous en boutique.\n\n_Votre équipe HabaShop_ 🛒' },
    tpl_loyalty: { label: 'Programme fidélité',      msg: '🎁 *Programme Fidélité HabaShop*\n\nVos achats vous rapportent des points !\n\n🥉 Bronze → 🥈 Silver → 🥇 Gold\n\nCumulez des points à chaque achat et profitez de remises exclusives.\n\n_Votre équipe HabaShop_ 🛒' },
    tpl_recall:  { label: 'Rappel client inactif',   msg: '💬 *Vous nous manquez !*\n\nCela fait un moment que nous ne vous avons pas vu.\n\nVenez découvrir nos nouveautés et bénéficier d\'une remise de bienvenue de *5 %* sur votre prochain achat.\n\n_Votre équipe HabaShop_ 🛒' },
  },
  en: {
    title:             'WhatsApp Marketing',
    subtitle:          'Send personalized WhatsApp messages to your customers',
    warning:           '⚠️ Include "Reply STOP" in your messages to respect privacy.',
    select_all:        'Select all',
    search:            'Search customer...',
    loading:           '⏳ Loading...',
    no_customers:      'No customers with WhatsApp number',
    templates_title:   'Quick templates',
    msg_title:         'WhatsApp message',
    msg_placeholder:   'Write your message...\n\n*bold* _italic_',
    formatting:        '*bold* _italic_ ~strikethrough~',
    chars:             'characters',
    result_ok:         '✅ Sent successfully!',
    result_partial:    '⚠️ Partial send',
    sent_toast:        'sent',
    send:              'Send to',
    client:            'customer',
    clients:           'customers',
    select_recipients: 'Select recipients',
    sending:           'Sending...',
    limit:             '⚠️ Max 20 recipients per send · 500ms between each message',
    err_msg:           'Write a message before sending',
    err_recipient:     'Select at least one recipient',
    err_max:           'Maximum 20 recipients per send',
    err_send:          'Send error',
    aria_search:       'Search',
    failed:            'failed',
    failed_plural:     'failed',
    word_message:      'message',
    word_messages:     'messages',
    wa_render:         'WHATSAPP RENDER',
    tpl_promo:   { label: 'Daily promotion',    msg: '🎉 *Special Offer!*\n\nTake advantage of our exceptional deals today!\n\n👉 Come visit us or contact us for more info.\n\n_Your HabaShop team_ 🛒' },
    tpl_stock:   { label: 'New stock',          msg: '📦 *New Stock Arrival!*\n\nFresh products just arrived!\nLimited quantities — first come, first served.\n\n🏪 Find us in store.\n\n_Your HabaShop team_ 🛒' },
    tpl_loyalty: { label: 'Loyalty program',    msg: '🎁 *HabaShop Loyalty Program*\n\nYour purchases earn you points!\n\n🥉 Bronze → 🥈 Silver → 🥇 Gold\n\nEarn points with every purchase and enjoy exclusive discounts.\n\n_Your HabaShop team_ 🛒' },
    tpl_recall:  { label: 'Inactive customer',  msg: '💬 *We miss you!*\n\nIt\'s been a while since your last visit.\n\nCome discover our new products and enjoy a *5% welcome discount* on your next purchase.\n\n_Your HabaShop team_ 🛒' },
  },
  es: {
    title:             'Marketing WhatsApp',
    subtitle:          'Envía mensajes personalizados de WhatsApp a tus clientes',
    warning:           '⚠️ Incluya "Responda STOP" en sus mensajes.',
    select_all:        'Seleccionar todo',
    search:            'Buscar cliente...',
    loading:           '⏳ Cargando...',
    no_customers:      'Sin clientes con número WhatsApp',
    templates_title:   'Plantillas rápidas',
    msg_title:         'Mensaje WhatsApp',
    msg_placeholder:   'Escribe tu mensaje...\n\n*negrita* _cursiva_',
    formatting:        '*negrita* _cursiva_ ~tachado~',
    chars:             'caracteres',
    result_ok:         '✅ ¡Enviado con éxito!',
    result_partial:    '⚠️ Envío parcial',
    sent_toast:        'enviado(s)',
    send:              'Enviar a',
    client:            'cliente',
    clients:           'clientes',
    select_recipients: 'Selecciona destinatarios',
    sending:           'Enviando...',
    limit:             '⚠️ Máx. 20 destinatarios por envío · 500ms entre mensajes',
    err_msg:           'Escribe un mensaje antes de enviar',
    err_recipient:     'Selecciona al menos un destinatario',
    err_max:           'Máximo 20 destinatarios por envío',
    err_send:          'Error de envío',
    aria_search:       'Buscar',
    failed:            'fallido',
    failed_plural:     'fallidos',
    word_message:      'mensaje',
    word_messages:     'mensajes',
    wa_render:         'VISTA PREVIA',
    tpl_promo:   { label: 'Promoción del día',        msg: '🎉 *¡Oferta especial!*\n\n¡Aprovecha nuestras ofertas excepcionales hoy!\n\n👉 Visítanos o contáctanos para más información.\n\n_Tu equipo HabaShop_ 🛒' },
    tpl_stock:   { label: 'Nuevo stock',              msg: '📦 *¡Nueva llegada de stock!*\n\n¡Productos frescos recién llegados!\nCantidades limitadas — primero en llegar, primero en servirse.\n\n🏪 Encuéntranos en tienda.\n\n_Tu equipo HabaShop_ 🛒' },
    tpl_loyalty: { label: 'Programa de fidelidad',   msg: '🎁 *Programa Fidelidad HabaShop*\n\n¡Tus compras te dan puntos!\n\n🥉 Bronce → 🥈 Plata → 🥇 Oro\n\nAcumula puntos en cada compra y disfruta de descuentos exclusivos.\n\n_Tu equipo HabaShop_ 🛒' },
    tpl_recall:  { label: 'Cliente inactivo',         msg: '💬 *¡Te echamos de menos!*\n\nHace tiempo que no te vemos.\n\nVen a descubrir nuestras novedades y disfruta de un *5% de descuento de bienvenida* en tu próxima compra.\n\n_Tu equipo HabaShop_ 🛒' },
  },
  it: {
    title:             'Marketing WhatsApp',
    subtitle:          'Invia messaggi WhatsApp personalizzati ai tuoi clienti',
    warning:           '⚠️ Includi "Rispondi STOP" nei tuoi messaggi.',
    select_all:        'Seleziona tutto',
    search:            'Cerca cliente...',
    loading:           '⏳ Caricamento...',
    no_customers:      'Nessun cliente con numero WhatsApp',
    templates_title:   'Modelli rapidi',
    msg_title:         'Messaggio WhatsApp',
    msg_placeholder:   'Scrivi il tuo messaggio...\n\n*grassetto* _corsivo_',
    formatting:        '*grassetto* _corsivo_ ~barrato~',
    chars:             'caratteri',
    result_ok:         '✅ Inviato con successo!',
    result_partial:    '⚠️ Invio parziale',
    sent_toast:        'inviato/i',
    send:              'Invia a',
    client:            'cliente',
    clients:           'clienti',
    select_recipients: 'Seleziona destinatari',
    sending:           'Invio in corso...',
    limit:             '⚠️ Max 20 destinatari per invio · 500ms tra ogni messaggio',
    err_msg:           'Scrivi un messaggio prima di inviare',
    err_recipient:     'Seleziona almeno un destinatario',
    err_max:           'Massimo 20 destinatari per invio',
    err_send:          'Errore invio',
    aria_search:       'Cerca',
    failed:            'fallito',
    failed_plural:     'falliti',
    word_message:      'messaggio',
    word_messages:     'messaggi',
    wa_render:         'ANTEPRIMA',
    tpl_promo:   { label: 'Promozione del giorno',  msg: '🎉 *Offerta speciale!*\n\nApprofittate delle nostre offerte eccezionali oggi!\n\n👉 Venite a trovarci o contattateci per maggiori informazioni.\n\n_Il tuo team HabaShop_ 🛒' },
    tpl_stock:   { label: 'Nuovo stock',            msg: '📦 *Nuovo arrivo in magazzino!*\n\nProdotti freschi appena arrivati!\nQuantità limitate — primo arrivato, primo servito.\n\n🏪 Trovaci in negozio.\n\n_Il tuo team HabaShop_ 🛒' },
    tpl_loyalty: { label: 'Programma fedeltà',      msg: '🎁 *Programma Fedeltà HabaShop*\n\nI tuoi acquisti ti danno punti!\n\n🥉 Bronzo → 🥈 Argento → 🥇 Oro\n\nAccumula punti ad ogni acquisto e goditi sconti esclusivi.\n\n_Il tuo team HabaShop_ 🛒' },
    tpl_recall:  { label: 'Cliente inattivo',       msg: '💬 *Ci manchi!*\n\nÈ passato un po\' di tempo dall\'ultima tua visita.\n\nVieni a scoprire le nostre novità e goditi uno *sconto del 5%* sul tuo prossimo acquisto.\n\n_Il tuo team HabaShop_ 🛒' },
  },
}

const TPL_ICONS: JSX.Element[] = [
  <Tag size={15}/>,
  <Package size={15}/>,
  <Gift size={15}/>,
  <MessageCircle size={15}/>,
]

// ─── WhatsApp Inline Renderer ────────────────────────────────────────────────

function WhatsAppInlineRenderer({ text }: { text: string }) {
  const renderLine = (line: string, key: number) => {
    const parts: React.ReactNode[] = []
    const regex = /(\*\*(.+?)\*\*|\*([^*]+?)\*|_([^_]+?)_|~([^~]+?)~|```([\s\S]+?)```|`([^`]+?)`)/g
    let last = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index))
      if (match[2] || match[3]) {
        parts.push(<strong key={match.index} style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{match[2] ?? match[3]}</strong>)
      } else if (match[4]) {
        parts.push(<em key={match.index} style={{ fontStyle: 'italic', color: 'var(--text2)' }}>{match[4]}</em>)
      } else if (match[5]) {
        parts.push(<span key={match.index} style={{ textDecoration: 'line-through', color: 'var(--text3)' }}>{match[5]}</span>)
      } else if (match[6] ?? match[7]) {
        parts.push(<code key={match.index} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 'var(--fs-label)', fontFamily: 'var(--mono)', color: 'var(--acc)' }}>{match[6] ?? match[7]}</code>)
      }
      last = match.index + match[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return (
      <div key={key} style={{ minHeight: line.trim() ? 'auto' : 8 }}>
        {parts.length > 0 ? parts : (line || ' ')}
      </div>
    )
  }
  return <>{text.split('\n').map((line, i) => renderLine(line, i))}</>
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Marketing() {
  const { lang } = useAppStore()
  const mk = MK[lang as keyof typeof MK] ?? MK.fr

  const [customers,     setCustomers]     = useState<Customer[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [selected,      setSelected]      = useState<Set<string>>(new Set())
  const [message,       setMessage]       = useState('')
  const [sending,       setSending]       = useState(false)
  const [result,        setResult]        = useState<{ sent: number; failed: number; errors?: string[] } | null>(null)

  // Campagnes
  const [campaigns,     setCampaigns]     = useState<Campaign[]>([])
  const [segment,       setSegment]       = useState('all')
  const [campaignMsg,   setCampaignMsg]   = useState('')
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignResult,  setCampaignResult]  = useState<{ sent: number; failed: number; recipientCount: number } | null>(null)

  const loadCampaigns = useCallback(() => {
    marketingApi.campaigns().then(setCampaigns).catch(() => {})
  }, [])
  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  useEffect(() => {
    customersApi.list()
      // Prédicat de TYPE, pas un simple filtre : l'écran exige un `phone` non nul, et le
      // compilateur ne peut pas le déduire d'un `filter` ordinaire. Sans lui, on retombe sur
      // un `any` qui laisserait passer un client sans numéro dans une liste de diffusion.
      .then(data => setCustomers(
        (data ?? []).filter((c): c is ApiCustomer & { phone: string } => !!c.phone?.trim())
      ))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.id)))
    }
  }

  const handleSend = async () => {
    if (!message.trim()) { toast.error(mk.err_msg); return }
    if (!selected.size)  { toast.error(mk.err_recipient); return }
    if (selected.size > 20) { toast.error(mk.err_max); return }

    const phones = customers.filter(c => selected.has(c.id)).map(c => c.phone)
    setSending(true)
    setResult(null)
    try {
      const res = await marketingApi.broadcast({ phones, message, lang }) as { sent: number; failed: number; errors?: string[] }
      setResult(res)
      toast.success(`${res.sent} ${res.sent > 1 ? mk.word_messages : mk.word_message} ${mk.sent_toast} !`)
      setSelected(new Set())
    } catch (err: any) {
      toast.error(err.message ?? mk.err_send)
    } finally {
      setSending(false)
    }
  }

  const handleCampaign = async () => {
    if (!campaignMsg.trim()) { toast.error(mk.err_msg); return }
    setCampaignSending(true); setCampaignResult(null)
    try {
      const res = await marketingApi.campaign({ message: campaignMsg, segment })
      setCampaignResult(res)
      toast.success(`${res.sent} ${res.sent > 1 ? mk.word_messages : mk.word_message} ${mk.sent_toast} !`)
      loadCampaigns()
    } catch (err: any) {
      if (err?.message?.includes('429') || err?.message?.toLowerCase().includes('heure')) {
        toast.error(lang === 'en' ? 'Max 1 campaign per hour' : lang === 'es' ? 'Máx. 1 campaña por hora' : lang === 'it' ? 'Max 1 campagna per ora' : 'Max 1 campagne par heure')
      } else {
        toast.error(err.message ?? mk.err_send)
      }
    } finally {
      setCampaignSending(false)
    }
  }

  const templates = [
    { icon: TPL_ICONS[0], ...mk.tpl_promo },
    { icon: TPL_ICONS[1], ...mk.tpl_stock },
    { icon: TPL_ICONS[2], ...mk.tpl_loyalty },
    { icon: TPL_ICONS[3], ...mk.tpl_recall },
  ]

  const charCount = message.length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg,#25D366,#128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37,211,102,.3)',
          }}><Smartphone size={24} style={{ color:'#fff' }}/></div>
          <div>
            <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>
              {mk.title}
            </h1>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', margin: '3px 0 0' }}>{mk.subtitle}</p>
          </div>
        </div>
      </div>

      {/* ── KPIs WhatsApp ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10, marginBottom: 18,
      }}>
        {[
          { label: lang === 'en' ? 'Sent this month' : lang === 'es' ? 'Enviados este mes' : lang === 'it' ? 'Inviati questo mese' : 'Envoyés ce mois', value: result?.sent ?? 0,     color:'#25D366' },
          { label: lang === 'en' ? 'Read rate' : lang === 'es' ? 'Tasa de lectura' : lang === 'it' ? 'Tasso di lettura' : 'Taux de lecture',       value: '—',                   color:'var(--acc2)'  },
          { label: lang === 'en' ? 'Replies' : lang === 'es' ? 'Respuestas recibidas' : lang === 'it' ? 'Risposte ricevute' : 'Réponses reçues',         value: '—',                   color:'var(--p2)'    },
          { label: lang === 'en' ? 'Active contacts' : lang === 'es' ? 'Contactos activos' : lang === 'it' ? 'Contatti attivi' : 'Contacts actifs', value: customers.length,      color:'var(--acc)'   },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '14px 16px',
            borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 'var(--fw-regular)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', color: k.color, fontFamily: 'var(--mono)' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Templates ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
            {mk.templates_title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {templates.map(tpl => (
              <button key={tpl.label} onClick={() => setMessage(tpl.msg)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-regular)', color: 'var(--text2)', fontFamily: 'var(--font)',
                textAlign: 'left', transition: 'all .12s',
              }}>
                <span style={{ display:'flex', color:'var(--text3)' }}>{tpl.icon}</span>
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Message composer ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
            {mk.msg_title}
          </div>
          <textarea
            className="input"
            style={{
              width: '100%', resize: 'none', height: 200,
              overflowY: 'auto', fontSize: 'var(--fs-sm)', lineHeight: 1.6,
              fontFamily: 'var(--font)',
            }}
            placeholder={mk.msg_placeholder}
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, 1000))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 'var(--fs-caption)', color: charCount > 900 ? 'var(--danger)' : 'var(--text3)' }}>
              {charCount} / 1000 {mk.chars}
            </span>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
              {mk.formatting}
            </span>
          </div>

          {/* Preview WhatsApp dark bubble */}
          {message && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 9, fontWeight: 'var(--fw-regular)', textTransform: 'uppercase',
                letterSpacing: '.6px', color: 'rgba(37,211,102,.6)',
                marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Smartphone size={11}/> {mk.wa_render}
              </div>
              <div style={{
                background: '#1F2C34', borderRadius: 14, padding: '12px 16px',
                maxWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,.4)',
              }}>
                {/* WA header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                  paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.06)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#25D366,#128C7E)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--fs-lg)',
                  }}>🛒</div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: '#E9EAE0' }}>HabaShop</div>
                    <div style={{ fontSize: 10, color: '#8696A0' }}>
                      {lang === 'en' ? 'Online' : lang === 'es' ? 'En línea' : lang === 'it' ? 'Online' : 'En ligne'}
                    </div>
                  </div>
                </div>
                {/* Message bubble */}
                <div style={{
                  background: '#005C4B',
                  borderRadius: '2px 12px 12px 12px',
                  padding: '10px 12px', maxWidth: 260,
                }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: '#E9EAE0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    <WhatsAppInlineRenderer text={message} />
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', textAlign: 'right', marginTop: 4 }}>
                    {new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { hour:'2-digit', minute:'2-digit' })} ✓✓
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Customers ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={toggleAll} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-regular)', color: 'var(--text2)', fontFamily: 'var(--font)',
            }}>
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare size={14} style={{ color: 'var(--p2)' }} />
                : <Square size={14} />}
              {mk.select_all}
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input className="input" style={{ paddingLeft: 30, fontSize: 'var(--fs-label)' }}
                aria-label={mk.aria_search} placeholder={mk.search}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              <Users size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              {selected.size} / {filtered.length}
            </div>
          </div>

          {/* Customer list */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{mk.loading}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{mk.no_customers}</div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filtered.map(c => {
                const isSelected = selected.has(c.id)
                return (
                  <div key={c.id} role="checkbox" aria-checked={isSelected} tabIndex={0}
                    onClick={() => toggleSelect(c.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(c.id) } }}
                    style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(91,78,232,.06)' : 'transparent',
                    transition: 'background .12s',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      background: isSelected ? 'var(--p2)' : 'var(--bg3)',
                      border: `2px solid ${isSelected ? 'var(--p2)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .12s',
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)' }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)', color: 'var(--text)', marginBottom: 1 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {c.phone}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* ⚠️ Type client : NORMALISÉ puis LIBELLÉ (#215). Deux défauts ici avant :
                          (1) la comparaison portait sur `'semi'`, qui n'est pas une valeur
                          canonique (`semi-wholesale`) — le semi-gros prenait donc la couleur
                          du détail ; (2) `{c.type}` était rendu BRUT, affichant « wholesale »
                          à un commerçant francophone. On passe par le juge unique et la table
                          de libellés, jamais par une comparaison écrite au point d'appel. */}
                      {(() => {
                        const canon = normalizeClientType(c.type)
                        // ⚠️ Rien plutôt qu'un palier inventé : `clientTypeToLabel(null)` rend
                        // « Détail », donc afficher sans ce garde donnerait un palier à un client
                        // dont le type est vide ou inconnu — le repli menteur qu'on élimine.
                        if (!canon) return null
                        return (
                          <span style={{
                            fontSize: 10, fontWeight: 'var(--fw-regular)', padding: '2px 7px', borderRadius: 20,
                            background: canon === 'wholesale' ? 'rgba(91,78,232,.12)' : canon === 'semi-wholesale' ? 'rgba(240,165,0,.12)' : 'rgba(14,196,126,.12)',
                            color: canon === 'wholesale' ? 'var(--p2)' : canon === 'semi-wholesale' ? 'var(--acc)' : 'var(--acc2)',
                          }}>{typeLabel(clientTypeToLabel(canon), lang)}</span>
                        )
                      })()}
                      {(c.loyaltyPoints ?? 0) >= 5000
                        ? <span title="Gold"   style={{ fontSize:9, fontWeight:'var(--fw-regular)', color:'#F0A500', background:'rgba(240,165,0,.15)',   borderRadius:4, padding:'1px 5px' }}>G</span>
                        : (c.loyaltyPoints ?? 0) >= 2000
                          ? <span title="Silver" style={{ fontSize:9, fontWeight:'var(--fw-regular)', color:'#94A3B8', background:'rgba(148,163,184,.15)', borderRadius:4, padding:'1px 5px' }}>S</span>
                          : <span title="Bronze" style={{ fontSize:9, fontWeight:'var(--fw-regular)', color:'#CD7F32', background:'rgba(205,127,50,.15)',  borderRadius:4, padding:'1px 5px' }}>B</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Result ── */}
        {result && (
          <div style={{
            background: result.failed === 0 ? 'rgba(14,196,126,.1)' : 'rgba(240,165,0,.1)',
            border: `1px solid ${result.failed === 0 ? 'rgba(14,196,126,.3)' : 'rgba(240,165,0,.3)'}`,
            borderRadius: 12, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)', color: result.failed === 0 ? 'var(--acc2)' : 'var(--acc)', marginBottom: 4 }}>
              {result.failed === 0 ? mk.result_ok : mk.result_partial}
            </div>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)' }}>
              {result.sent} {mk.sent_toast}
              {result.failed > 0 && ` · ${result.failed} ${result.failed > 1 ? mk.failed_plural : mk.failed}`}
            </div>
          </div>
        )}

        {/* ── Send button ── */}
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '13px',
            background: sending || !selected.size || !message.trim()
              ? 'var(--bg4)'
              : 'linear-gradient(135deg, #25D366, #128C7E)',
            border: 'none', borderRadius: 12,
            fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)',
            color: sending || !selected.size || !message.trim() ? 'var(--text3)' : '#fff',
            cursor: sending || !selected.size || !message.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: !sending && selected.size && message.trim() ? '0 6px 20px rgba(37,211,102,.35)' : 'none',
            transition: 'all .2s',
          }}
        >
          {sending
            ? <><span style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', display:'inline-block', animation:'spin .6s linear infinite' }}/> {mk.sending}</>
            : selected.size
              ? <><Send size={16}/> {mk.send} {selected.size} {selected.size > 1 ? mk.clients : mk.client}</>
              : mk.select_recipients}
        </button>

        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
          {mk.limit}
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--acc)', textAlign: 'center', lineHeight: 1.5 }}>
          {mk.warning}
        </div>

        {/* ── Campagnes automatiques ────────────────────────────────────── */}
        <div style={{ marginTop: 24 }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(91,78,232,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={16} style={{ color: 'var(--p2)' }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
                {lang === 'en' ? 'Segment campaigns' : lang === 'es' ? 'Campañas por segmento' : lang === 'it' ? 'Campagne per segmento' : 'Campagnes par segment'}
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
                {lang === 'en' ? 'Target a customer group automatically · max 1/hour' : lang === 'es' ? 'Dirige un grupo de clientes automáticamente · máx. 1/hora' : lang === 'it' ? 'Target automatico per gruppo · max 1/ora' : 'Ciblage automatique par groupe · max 1/heure'}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Segment selector */}
            <div>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                {lang === 'en' ? 'Segment' : lang === 'es' ? 'Segmento' : lang === 'it' ? 'Segmento' : 'Segment'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { val: 'all',       label: lang === 'en' ? 'All' : lang === 'es' ? 'Todos' : lang === 'it' ? 'Tutti' : 'Tous' },
                  { val: 'bronze',    label: lang === 'en' ? 'Bronze' : 'Bronze' },
                  { val: 'silver',    label: lang === 'en' ? 'Silver' : lang === 'es' ? 'Plata' : lang === 'it' ? 'Argento' : 'Silver' },
                  { val: 'gold',      label: lang === 'en' ? 'Gold' : lang === 'es' ? 'Oro' : lang === 'it' ? 'Oro' : 'Gold' },
                  // ⚠️ Types clients DÉRIVÉS de `CLIENT_TYPES` (#215) — c'était une QUATRIÈME
                  // liste tenue à la main, et il lui manquait `loyal` ET `semi-wholesale` :
                  // deux paliers valides côté serveur qu'aucun commerçant ne pouvait cibler.
                  // Ajouter la ligne manquante aurait laissé le prochain palier dériver ;
                  // la dériver rend l'oubli impossible. Libellés par la table partagée, donc
                  // identiques à la pastille affichée juste en dessous.
                  ...CLIENT_TYPES.map(v => ({ val: v, label: typeLabel(clientTypeToLabel(v), lang) })),
                ].map(s => (
                  <button key={s.val} onClick={() => setSegment(s.val)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 'var(--fs-label)', cursor: 'pointer',
                    border: `1.5px solid ${segment === s.val ? 'var(--p2)' : 'var(--border)'}`,
                    background: segment === s.val ? 'rgba(91,78,232,.1)' : 'var(--bg3)',
                    color: segment === s.val ? 'var(--p2)' : 'var(--text2)',
                    fontFamily: 'var(--font)', fontWeight: segment === s.val ? 'var(--fw-semibold)' : 'var(--fw-regular)',
                    transition: 'all .12s',
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }}>
                {mk.msg_title}
              </div>
              <textarea className="input" style={{ width: '100%', resize: 'none', height: 120, fontSize: 'var(--fs-sm)', lineHeight: 1.6, fontFamily: 'var(--font)' }}
                placeholder={mk.msg_placeholder}
                value={campaignMsg}
                onChange={e => setCampaignMsg(e.target.value.slice(0, 1000))}
              />
              <span style={{ fontSize: 'var(--fs-caption)', color: campaignMsg.length > 900 ? 'var(--danger)' : 'var(--text3)' }}>{campaignMsg.length} / 1000 {mk.chars}</span>
            </div>

            {/* Result */}
            {campaignResult && (
              <div style={{ background: campaignResult.failed === 0 ? 'rgba(14,196,126,.1)' : 'rgba(240,165,0,.1)', border: `1px solid ${campaignResult.failed === 0 ? 'rgba(14,196,126,.3)' : 'rgba(240,165,0,.3)'}`, borderRadius: 10, padding: '10px 14px', fontSize: 'var(--fs-label)', color: 'var(--text2)' }}>
                {campaignResult.sent} / {campaignResult.recipientCount} {mk.sent_toast}
                {campaignResult.failed > 0 && ` · ${campaignResult.failed} ${mk.failed}`}
              </div>
            )}

            {/* Send */}
            <button onClick={handleCampaign} disabled={campaignSending} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px', borderRadius: 10, border: 'none', cursor: campaignSending || !campaignMsg.trim() ? 'not-allowed' : 'pointer',
              background: campaignSending || !campaignMsg.trim() ? 'var(--bg4)' : 'linear-gradient(135deg, var(--p), var(--p2))',
              color: campaignSending || !campaignMsg.trim() ? 'var(--text3)' : '#fff',
              fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', fontFamily: 'inherit', transition: 'all .2s',
            }}>
              {campaignSending ? <><Loader2 size={15} style={{ animation: 'spin .7s linear infinite' }} /> {mk.sending}</> : <><Send size={15} /> {lang === 'en' ? 'Send campaign' : lang === 'es' ? 'Enviar campaña' : lang === 'it' ? 'Invia campagna' : 'Envoyer la campagne'}</>}
            </button>
          </div>

          {/* Campaign history */}
          {campaigns.length > 0 && (
            <div style={{ marginTop: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} style={{ color: 'var(--text3)' }} />
                <span style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>
                  {lang === 'en' ? 'Campaign history' : lang === 'es' ? 'Historial de campañas' : lang === 'it' ? 'Storico campagne' : 'Historique des campagnes'}
                </span>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {campaigns.map(c => (
                  <div key={c.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {new Date(c.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(91,78,232,.1)', color: 'var(--p2)', fontWeight: 'var(--fw-semibold)' }}>{c.segment}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: c.failedCount === 0 ? 'rgba(14,196,126,.1)' : 'rgba(240,165,0,.1)', color: c.failedCount === 0 ? 'var(--acc2)' : 'var(--acc)', fontWeight: 'var(--fw-semibold)' }}>
                          {c.sentCount}/{c.recipientCount}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.message.slice(0, 80)}{c.message.length > 80 ? '…' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{c.user.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
