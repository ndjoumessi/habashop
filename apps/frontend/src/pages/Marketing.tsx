import { useState, useEffect } from 'react'
import { useAppStore, t } from '@/stores/appStore'
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

const TEMPLATES: { label: string; icon: string; msg: (fr: boolean) => string }[] = [
  {
    label: 'Promotion du jour',
    icon: '🏷️',
    msg: (fr) => fr
      ? '🎉 *Promotion spéciale !*\n\nProfitez de nos offres exceptionnelles aujourd\'hui !\n\n👉 Venez nous rendre visite ou contactez-nous pour en savoir plus.\n\n_Votre équipe HabaShop_ 🛒'
      : '🎉 *Special Offer!*\n\nTake advantage of our exceptional deals today!\n\n👉 Come visit us or contact us for more info.\n\n_Your HabaShop team_ 🛒',
  },
  {
    label: 'Nouveau stock',
    icon: '📦',
    msg: (fr) => fr
      ? '📦 *Nouvelle arrivée en stock !*\n\nDe nouveaux produits viennent d\'arriver !\nQuantités limitées — premier arrivé, premier servi.\n\n🏪 Retrouvez-nous en boutique.\n\n_Votre équipe HabaShop_ 🛒'
      : '📦 *New Stock Arrival!*\n\nFresh products just arrived!\nLimited quantities — first come, first served.\n\n🏪 Find us in store.\n\n_Your HabaShop team_ 🛒',
  },
  {
    label: 'Programme fidélité',
    icon: '🎁',
    msg: (fr) => fr
      ? '🎁 *Programme Fidélité HabaShop*\n\nVos achats vous rapportent des points !\n\n🥉 Bronze → 🥈 Silver → 🥇 Gold\n\nCumulez des points à chaque achat et profitez de remises exclusives.\n\n_Votre équipe HabaShop_ 🛒'
      : '🎁 *HabaShop Loyalty Program*\n\nYour purchases earn you points!\n\n🥉 Bronze → 🥈 Silver → 🥇 Gold\n\nEarn points with every purchase and enjoy exclusive discounts.\n\n_Your HabaShop team_ 🛒',
  },
  {
    label: 'Rappel client inactif',
    icon: '💬',
    msg: (fr) => fr
      ? '💬 *Vous nous manquez !*\n\nCela fait un moment que nous ne vous avons pas vu.\n\nVenez découvrir nos nouveautés et bénéficier d\'une remise de bienvenue de *5 %* sur votre prochain achat.\n\n_Votre équipe HabaShop_ 🛒'
      : '💬 *We miss you!*\n\nIt\'s been a while since your last visit.\n\nCome discover our new products and enjoy a *5% welcome discount* on your next purchase.\n\n_Your HabaShop team_ 🛒',
  },
]

export default function Marketing() {
  const { lang } = useAppStore()
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
    if (!message.trim()) { toast.error('Écrivez un message avant d\'envoyer'); return }
    if (!selected.size)  { toast.error('Sélectionnez au moins un destinataire'); return }
    if (selected.size > 20) { toast.error('Maximum 20 destinataires par envoi'); return }

    const phones = customers.filter(c => selected.has(c.id)).map(c => c.phone)
    setSending(true)
    setResult(null)
    try {
      const res = await marketingApi.broadcast({ phones, message, lang }) as { sent: number; failed: number; errors?: string[] }
      setResult(res)
      toast.success(`✅ ${res.sent} message${res.sent > 1 ? 's' : ''} envoyé${res.sent > 1 ? 's' : ''} !`)
      setSelected(new Set())
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  const charCount = message.length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
          📣 {t('nav_marketing')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          {lang === 'fr'
            ? 'Envoyez des messages WhatsApp personnalisés à vos clients'
            : 'Send personalized WhatsApp messages to your customers'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* ── Colonne gauche : clients ── */}
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
              {lang === 'fr' ? 'Tout sélectionner' : 'Select all'}
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input className="input" style={{ paddingLeft: 30, fontSize: 12 }}
                placeholder={lang === 'fr' ? 'Rechercher un client...' : 'Search customer...'}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              <Users size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              {selected.size} / {filtered.length}
            </div>
          </div>

          {/* Customer list */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>⏳ Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Aucun client avec numéro WhatsApp</div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
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

        {/* ── Colonne droite : message ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Templates */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
              {lang === 'fr' ? 'Modèles rapides' : 'Quick templates'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TEMPLATES.map(tpl => (
                <button key={tpl.label} onClick={() => setMessage(tpl.msg(lang === 'fr'))} style={{
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

          {/* Message composer */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
              {lang === 'fr' ? 'Message WhatsApp' : 'WhatsApp message'}
            </div>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 160, resize: 'vertical', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit' }}
              placeholder={lang === 'fr' ? 'Rédigez votre message...\n\n*gras* _italique_' : 'Write your message...\n\n*bold* _italic_'}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: charCount > 1000 ? 'var(--danger)' : 'var(--text3)' }}>
                {charCount} / 1024 caractères
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                *gras* _italique_ ~barré~
              </span>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div style={{
              background: result.failed === 0 ? 'rgba(14,196,126,.1)' : 'rgba(240,165,0,.1)',
              border: `1px solid ${result.failed === 0 ? 'rgba(14,196,126,.3)' : 'rgba(240,165,0,.3)'}`,
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: result.failed === 0 ? 'var(--acc2)' : 'var(--acc)', marginBottom: 4 }}>
                {result.failed === 0 ? '✅ Envoi réussi !' : '⚠️ Envoi partiel'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {result.sent} envoyé{result.sent > 1 ? 's' : ''}
                {result.failed > 0 && ` · ${result.failed} échoué${result.failed > 1 ? 's' : ''}`}
              </div>
            </div>
          )}

          {/* Send button */}
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
              ? `⏳ ${lang === 'fr' ? 'Envoi en cours...' : 'Sending...'}`
              : <><Send size={16} />{selected.size ? `📱 Envoyer à ${selected.size} client${selected.size > 1 ? 's' : ''}` : lang === 'fr' ? 'Sélectionnez des destinataires' : 'Select recipients'}</>}
          </button>

          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
            {lang === 'fr'
              ? '⚠️ Maximum 20 destinataires par envoi · 500 ms entre chaque message'
              : '⚠️ Max 20 recipients per send · 500ms between each message'}
          </div>
        </div>
      </div>
    </div>
  )
}
