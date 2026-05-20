import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { customersApi, marketingApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Search, Send, Users, CheckSquare, Square } from 'lucide-react'

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
    yourMessage:       '✏️ Votre message',
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
    tpl_promo:   { label: 'Promotion du jour',      msg: '🎉 *Promotion spéciale !*\n\nProfitez de nos offres exceptionnelles aujourd\'hui !\n\n👉 Venez nous rendre visite ou contactez-nous pour en savoir plus.\n\n_Votre équipe HabaShop_ 🛒' },
    tpl_stock:   { label: 'Nouveau stock',           msg: '📦 *Nouvelle arrivée en stock !*\n\nDe nouveaux produits viennent d\'arriver !\nQuantités limitées — premier arrivé, premier servi.\n\n🏪 Retrouvez-nous en boutique.\n\n_Votre équipe HabaShop_ 🛒' },
    tpl_loyalty: { label: 'Programme fidélité',      msg: '🎁 *Programme Fidélité HabaShop*\n\nVos achats vous rapportent des points !\n\n🥉 Bronze → 🥈 Silver → 🥇 Gold\n\nCumulez des points à chaque achat et profitez de remises exclusives.\n\n_Votre équipe HabaShop_ 🛒' },
    tpl_recall:  { label: 'Rappel client inactif',   msg: '💬 *Vous nous manquez !*\n\nCela fait un moment que nous ne vous avons pas vu.\n\nVenez découvrir nos nouveautés et bénéficier d\'une remise de bienvenue de *5 %* sur votre prochain achat.\n\n_Votre équipe HabaShop_ 🛒' },
  },
  en: {
    title:             'WhatsApp Marketing',
    subtitle:          'Send personalized WhatsApp messages to your customers',
    yourMessage:       '✏️ Your message',
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
    tpl_promo:   { label: 'Daily promotion',    msg: '🎉 *Special Offer!*\n\nTake advantage of our exceptional deals today!\n\n👉 Come visit us or contact us for more info.\n\n_Your HabaShop team_ 🛒' },
    tpl_stock:   { label: 'New stock',          msg: '📦 *New Stock Arrival!*\n\nFresh products just arrived!\nLimited quantities — first come, first served.\n\n🏪 Find us in store.\n\n_Your HabaShop team_ 🛒' },
    tpl_loyalty: { label: 'Loyalty program',    msg: '🎁 *HabaShop Loyalty Program*\n\nYour purchases earn you points!\n\n🥉 Bronze → 🥈 Silver → 🥇 Gold\n\nEarn points with every purchase and enjoy exclusive discounts.\n\n_Your HabaShop team_ 🛒' },
    tpl_recall:  { label: 'Inactive customer',  msg: '💬 *We miss you!*\n\nIt\'s been a while since your last visit.\n\nCome discover our new products and enjoy a *5% welcome discount* on your next purchase.\n\n_Your HabaShop team_ 🛒' },
  },
  es: {
    title:             'Marketing WhatsApp',
    subtitle:          'Envía mensajes personalizados de WhatsApp a tus clientes',
    yourMessage:       '✏️ Su mensaje',
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
    tpl_promo:   { label: 'Promoción del día',        msg: '🎉 *¡Oferta especial!*\n\n¡Aprovecha nuestras ofertas excepcionales hoy!\n\n👉 Visítanos o contáctanos para más información.\n\n_Tu equipo HabaShop_ 🛒' },
    tpl_stock:   { label: 'Nuevo stock',              msg: '📦 *¡Nueva llegada de stock!*\n\n¡Productos frescos recién llegados!\nCantidades limitadas — primero en llegar, primero en servirse.\n\n🏪 Encuéntranos en tienda.\n\n_Tu equipo HabaShop_ 🛒' },
    tpl_loyalty: { label: 'Programa de fidelidad',   msg: '🎁 *Programa Fidelidad HabaShop*\n\n¡Tus compras te dan puntos!\n\n🥉 Bronce → 🥈 Plata → 🥇 Oro\n\nAcumula puntos en cada compra y disfruta de descuentos exclusivos.\n\n_Tu equipo HabaShop_ 🛒' },
    tpl_recall:  { label: 'Cliente inactivo',         msg: '💬 *¡Te echamos de menos!*\n\nHace tiempo que no te vemos.\n\nVen a descubrir nuestras novedades y disfruta de un *5% de descuento de bienvenida* en tu próxima compra.\n\n_Tu equipo HabaShop_ 🛒' },
  },
  it: {
    title:             'Marketing WhatsApp',
    subtitle:          'Invia messaggi WhatsApp personalizzati ai tuoi clienti',
    yourMessage:       '✏️ Il tuo messaggio',
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
    tpl_promo:   { label: 'Promozione del giorno',  msg: '🎉 *Offerta speciale!*\n\nApprofittate delle nostre offerte eccezionali oggi!\n\n👉 Venite a trovarci o contattateci per maggiori informazioni.\n\n_Il tuo team HabaShop_ 🛒' },
    tpl_stock:   { label: 'Nuovo stock',            msg: '📦 *Nuovo arrivo in magazzino!*\n\nProdotti freschi appena arrivati!\nQuantità limitate — primo arrivato, primo servito.\n\n🏪 Trovaci in negozio.\n\n_Il tuo team HabaShop_ 🛒' },
    tpl_loyalty: { label: 'Programma fedeltà',      msg: '🎁 *Programma Fedeltà HabaShop*\n\nI tuoi acquisti ti danno punti!\n\n🥉 Bronzo → 🥈 Argento → 🥇 Oro\n\nAccumula punti ad ogni acquisto e goditi sconti esclusivi.\n\n_Il tuo team HabaShop_ 🛒' },
    tpl_recall:  { label: 'Cliente inattivo',       msg: '💬 *Ci manchi!*\n\nÈ passato un po\' di tempo dall\'ultima tua visita.\n\nVieni a scoprire le nostre novità e goditi uno *sconto del 5%* sul tuo prossimo acquisto.\n\n_Il tuo team HabaShop_ 🛒' },
  },
}

const TPL_ICONS = ['🏷️', '📦', '🎁', '💬']

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

  useEffect(() => {
    customersApi.list()
      .then(data => setCustomers(
        (data ?? []).filter((c: any) => c.phone?.trim())
      ))
      .catch(() => setCustomers([
        { id: '1', name: 'Fatou Diallo',     phone: '+221771234567', type: 'retail',    loyaltyPoints: 1200 },
        { id: '2', name: 'Mamadou Sow',      phone: '+221785678901', type: 'wholesale', loyaltyPoints: 3400 },
        { id: '3', name: 'Aïssatou Ndiaye',  phone: '+221779876543', type: 'retail',    loyaltyPoints: 6100 },
        { id: '4', name: 'Ibrahim Traoré',   phone: '+221781234567', type: 'semi',      loyaltyPoints: 450  },
        { id: '5', name: 'Mariama Bah',      phone: '+221770123456', type: 'retail',    loyaltyPoints: 890  },
      ]))
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
      toast.success(`✅ ${res.sent} message${res.sent > 1 ? 's' : ''} ${mk.sent_toast} !`)
      setSelected(new Set())
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur envoi')
    } finally {
      setSending(false)
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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
          📣 {mk.title}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>{mk.subtitle}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Templates ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
            {mk.templates_title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {templates.map(tpl => (
              <button key={tpl.label} onClick={() => setMessage(tpl.msg)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--font)',
                textAlign: 'left', transition: 'all .12s',
              }}>
                <span style={{ fontSize: 16 }}>{tpl.icon}</span>
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Message composer ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
            {mk.msg_title}
          </div>
          <textarea
            className="input"
            rows={8}
            style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit' }}
            placeholder={mk.msg_placeholder}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: charCount > 1000 ? 'var(--danger)' : 'var(--text3)' }}>
              {charCount} / 1024 {mk.chars}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {mk.formatting}
            </span>
          </div>
        </div>

        {/* ── Customers ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={toggleAll} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--font)',
            }}>
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare size={14} style={{ color: 'var(--p2)' }} />
                : <Square size={14} />}
              {mk.select_all}
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input className="input" style={{ paddingLeft: 30, fontSize: 12 }}
                placeholder={mk.search}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
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
                  <div key={c.id} onClick={() => toggleSelect(c.id)} style={{
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
                      {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {c.phone}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: c.type === 'wholesale' ? 'rgba(91,78,232,.12)' : c.type === 'semi' ? 'rgba(240,165,0,.12)' : 'rgba(14,196,126,.12)',
                        color: c.type === 'wholesale' ? 'var(--p2)' : c.type === 'semi' ? 'var(--acc)' : 'var(--acc2)',
                      }}>{c.type}</span>
                      {(c.loyaltyPoints ?? 0) >= 5000
                        ? <span title="Gold">🥇</span>
                        : (c.loyaltyPoints ?? 0) >= 2000
                          ? <span title="Silver">🥈</span>
                          : <span title="Bronze">🥉</span>}
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
            borderRadius: 10, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: result.failed === 0 ? 'var(--acc2)' : 'var(--acc)', marginBottom: 4 }}>
              {result.failed === 0 ? mk.result_ok : mk.result_partial}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {result.sent} {mk.sent_toast}
              {result.failed > 0 && ` · ${result.failed} échoué${result.failed > 1 ? 's' : ''}`}
            </div>
          </div>
        )}

        {/* ── Send button ── */}
        <button
          onClick={handleSend}
          disabled={sending || !selected.size || !message.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '13px',
            background: sending || !selected.size || !message.trim()
              ? 'var(--bg4)'
              : 'linear-gradient(135deg, #25D366, #128C7E)',
            border: 'none', borderRadius: 11,
            fontSize: 14, fontWeight: 700,
            color: sending || !selected.size || !message.trim() ? 'var(--text3)' : '#fff',
            cursor: sending || !selected.size || !message.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: !sending && selected.size && message.trim() ? '0 6px 20px rgba(37,211,102,.35)' : 'none',
            transition: 'all .2s',
          }}
        >
          {sending
            ? `⏳ ${mk.sending}`
            : selected.size
              ? <><Send size={16} />{mk.send} {selected.size} {selected.size > 1 ? mk.clients : mk.client}</>
              : mk.select_recipients}
        </button>

        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
          {mk.limit}
        </div>
        <div style={{ fontSize: 11, color: 'var(--acc)', textAlign: 'center', lineHeight: 1.5 }}>
          {mk.warning}
        </div>
      </div>
    </div>
  )
}
