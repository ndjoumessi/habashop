import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ShoppingCart, MessageCircle, Minus, Plus, Search, Share2, AlertCircle } from 'lucide-react'
import { publicApi } from '@/lib/api'
import { convertAmount, formatInCurrency } from '@/stores/appStore'
import { isPromotionActive } from '@/lib/pricing'

type TenantPublic = {
  id: string
  name: string
  description: string | null
  logo: string | null
  whatsappPhone: string | null
  currency: string
  country: string
  lang: string
}
type CatalogProduct = {
  id: string
  name: string
  description: string | null
  sellPrice: number
  promotionPrice: number | null
  hasPromotion: boolean
  promotionEnd: string | null
  emoji: string
  stockQty: number
  unit: string
  category: string
}

// ─── i18n inline (le visiteur n'est pas authentifié → on prend tenant.lang) ──
type Lang = 'fr' | 'en' | 'es' | 'it'
const i = (lang: Lang, fr: string, en: string, es: string, it: string) =>
  lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

// ─── Formatage prix : convertit XOF (DB) → devise du tenant + format localisé ──
// On utilise convertAmount + formatInCurrency d'appStore (fonctions PURES, pas de hook),
// pour rester cohérent avec le reste de l'app (POS, Stock, etc.).
function formatPrice(amountXOF: number, currency: string): string {
  const converted = convertAmount(amountXOF, 'XOF', currency)
  return formatInCurrency(converted, currency)
}

function CatalogSkeleton() {
  return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontFamily:'var(--font)', fontSize:14 }}>
      <span className="loader-dots">●●●</span>
    </div>
  )
}

export default function PublicCatalog() {
  const { slug } = useParams<{ slug: string }>()
  // Query param ?v=timestamp = cache-buster déclenché par "Voir" depuis Settings ;
  // force un refetch quand le commerçant vient de modifier sa devise / ses produits.
  const [searchParams] = useSearchParams()
  const version = searchParams.get('v') ?? ''
  const [data, setData] = useState<{ tenant: TenantPublic; products: CatalogProduct[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({}) // productId → qty
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    setLoading(true)
    publicApi.catalog(slug)
      .then(res => {
        if (!res) setNotFound(true)
        else { setData(res); setNotFound(false) }
      })
      .catch((err: any) => setError(err?.message ?? 'Erreur'))
      .finally(() => setLoading(false))
  }, [slug, version])

  // Inject meta tags (V1 client-side — bot-scrapers basiques peuvent rater)
  useEffect(() => {
    if (!data) return
    const t = data.tenant
    document.title = `${t.name} — Catalogue`
    const set = (name: string, content: string, useProperty = false) => {
      const attr = useProperty ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.content = content
    }
    set('description', t.description ?? `Catalogue de ${t.name}`)
    set('og:title', `${t.name} — Catalogue`, true)
    set('og:description', t.description ?? `Découvrez les produits de ${t.name}`, true)
    set('og:url', window.location.href, true)
    set('og:type', 'website', true)
    if (t.logo) set('og:image', t.logo, true)
    set('twitter:card', 'summary_large_image')
  }, [data])

  const lang = (data?.tenant.lang as Lang) ?? 'fr'

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.products
    return data.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
    )
  }, [data, search])

  const cartItems = useMemo(() => {
    if (!data) return []
    return data.products
      .filter(p => (cart[p.id] ?? 0) > 0)
      .map(p => ({
        ...p,
        qty: cart[p.id],
        // Promo respectée SEULEMENT si non expirée — sinon le client paierait un prix promo
        // que le POS ne pratique plus (le backend est autoritaire sur le prix).
        price: isPromotionActive(p.hasPromotion, p.promotionEnd, new Date()) && p.promotionPrice != null ? p.promotionPrice : p.sellPrice,
      }))
  }, [data, cart])
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0)
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  const addQty = (id: string, delta: number) => {
    setCart(prev => {
      const next = { ...prev }
      const cur = (next[id] ?? 0) + delta
      if (cur <= 0) delete next[id]
      else next[id] = cur
      return next
    })
  }

  const composeWhatsAppMessage = () => {
    if (!data) return ''
    const t = data.tenant
    const items = cartItems.map(it => `• ${it.qty}× ${it.name} (${formatPrice(it.qty * it.price, t.currency)})`).join('\n')
    const greeting = i(lang, `Bonjour ${t.name}`, `Hello ${t.name}`, `Hola ${t.name}`, `Salve ${t.name}`)
    const want = i(lang, 'Je voudrais commander :', 'I would like to order:', 'Quisiera pedir:', 'Vorrei ordinare:')
    const totalLabel = i(lang, '*Total estimé*', '*Estimated total*', '*Total estimado*', '*Totale stimato*')
    const thanks = i(lang, 'Merci.', 'Thanks.', 'Gracias.', 'Grazie.')
    return `${greeting},\n\n${want}\n${items}\n\n${totalLabel} : ${formatPrice(cartTotal, t.currency)}\n\n${thanks}`
  }

  const orderViaWhatsApp = () => {
    if (!data || !data.tenant.whatsappPhone) {
      window.alert(i(lang, 'Ce commerçant n\'a pas configuré WhatsApp.', 'This merchant has not configured WhatsApp.', 'Este comerciante no ha configurado WhatsApp.', 'Questo commerciante non ha configurato WhatsApp.'))
      return
    }
    const cleanPhone = data.tenant.whatsappPhone.replace(/\D/g, '')
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(composeWhatsAppMessage())}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <CatalogSkeleton />
  if (notFound) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, padding:20, fontFamily:'var(--font)', background:'var(--bg)' }}>
        <AlertCircle size={48} style={{ color:'var(--text3)' }} />
        <h1 style={{ fontSize:20, color:'var(--text)', margin:0 }}>Catalogue introuvable</h1>
        <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', maxWidth:340 }}>
          Le lien que vous avez suivi est invalide ou ce commerçant a désactivé son catalogue.
        </p>
        <a href="/" style={{ marginTop:8, fontSize:13, color:'var(--p)', textDecoration:'underline' }}>← Retour à l'accueil</a>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, padding:20, fontFamily:'var(--font)', background:'var(--bg)' }}>
        <AlertCircle size={32} style={{ color:'var(--danger)' }} />
        <p style={{ fontSize:13, color:'var(--text)' }}>{error}</p>
      </div>
    )
  }
  if (!data) return null

  const t = data.tenant

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font)', color:'var(--text)', paddingBottom: cartCount > 0 ? 100 : 32 }}>
      {/* ── Header sticky ── */}
      <header style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--card)', borderBottom:'1px solid var(--border)',
        padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
      }}>
        {t.logo ? (
          <img src={t.logo} alt="" style={{ width:44, height:44, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
        ) : (
          <div style={{ width:44, height:44, borderRadius:10, background:'linear-gradient(135deg, var(--p), var(--p2))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18, fontWeight:900, flexShrink:0 }}>
            {t.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:16, fontWeight:800, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</h1>
          {t.description && (
            <p style={{ fontSize:11, color:'var(--text3)', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</p>
          )}
        </div>
        <button
          aria-label={i(lang, 'Partager', 'Share', 'Compartir', 'Condividi')}
          onClick={async () => {
            const shareData = { title: t.name, text: t.description ?? '', url: window.location.href }
            if (navigator.share) { try { await navigator.share(shareData) } catch {} }
            else { try { await navigator.clipboard.writeText(window.location.href) } catch {} }
          }}
          style={{ width:36, height:36, borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          <Share2 size={16} />
        </button>
      </header>

      {/* ── Recherche ── */}
      <div style={{ padding:'12px 16px 4px' }}>
        <div style={{ position:'relative' }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }} />
          <input
            placeholder={i(lang, 'Rechercher un produit…', 'Search a product…', 'Buscar un producto…', 'Cerca un prodotto…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width:'100%', padding:'10px 12px 10px 36px', fontSize:14,
              background:'var(--card)', border:'1px solid var(--border)', borderRadius:10,
              color:'var(--text)', fontFamily:'inherit',
            }}
          />
        </div>
      </div>

      {/* ── Grille produits ── */}
      <div className="catalog-grid" style={{
        display:'grid',
        gridTemplateColumns:'repeat(2, minmax(0, 1fr))',
        gap:10, padding:'12px 16px',
      }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:40, color:'var(--text3)', fontSize:13 }}>
            {i(lang, 'Aucun produit trouvé', 'No product found', 'Sin productos', 'Nessun prodotto trovato')}
          </div>
        ) : filtered.map(p => {
          const inStock = p.stockQty > 0
          const onPromo = isPromotionActive(p.hasPromotion, p.promotionEnd, new Date()) && p.promotionPrice != null && p.promotionPrice < p.sellPrice
          const finalPrice = onPromo && p.promotionPrice != null ? p.promotionPrice : p.sellPrice
          const qty = cart[p.id] ?? 0
          return (
            <div key={p.id} style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:8,
              opacity: inStock ? 1 : 0.6, position:'relative',
              transition:'transform .15s, box-shadow .15s',
            }}>
              {onPromo && (
                <span style={{ position:'absolute', top:8, right:8, padding:'2px 7px', borderRadius:6, background:'var(--danger)', color:'#fff', fontSize:9, fontWeight:800, letterSpacing:'.4px' }}>
                  PROMO
                </span>
              )}
              {!inStock && (
                <span style={{ position:'absolute', top:8, right:8, padding:'2px 7px', borderRadius:6, background:'var(--bg4)', color:'var(--text3)', fontSize:9, fontWeight:700 }}>
                  {i(lang, 'Rupture', 'Sold out', 'Agotado', 'Esaurito')}
                </span>
              )}
              <div style={{ fontSize:42, lineHeight:1, textAlign:'center', padding:'8px 0' }}>{p.emoji ?? '📦'}</div>
              <div style={{ minHeight:32 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', lineHeight:1.25, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const, overflow:'hidden' }}>
                  {p.name}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:16, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)' }}>
                  {formatPrice(finalPrice, t.currency)}
                </span>
                {onPromo && (
                  <span style={{ fontSize:11, color:'var(--text3)', textDecoration:'line-through' }}>
                    {formatPrice(p.sellPrice, t.currency)}
                  </span>
                )}
              </div>
              {inStock && (
                qty === 0 ? (
                  <button
                    onClick={() => addQty(p.id, 1)}
                    style={{ marginTop:'auto', padding:'8px', borderRadius:8, background:'var(--p)', color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <Plus size={14} /> {i(lang, 'Ajouter', 'Add', 'Añadir', 'Aggiungi')}
                  </button>
                ) : (
                  <div style={{ marginTop:'auto', display:'flex', alignItems:'center', gap:4, background:'var(--bg3)', border:'1px solid var(--p)', borderRadius:8, padding:3 }}>
                    <button onClick={() => addQty(p.id, -1)} aria-label={i(lang, 'Diminuer', 'Decrease', 'Disminuir', 'Diminuisci')}
                      style={{ width:32, height:32, borderRadius:6, background:'transparent', border:'none', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Minus size={14} />
                    </button>
                    <span style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:800, fontFamily:'var(--mono)' }}>{qty}</span>
                    <button onClick={() => addQty(p.id, 1)} aria-label={i(lang, 'Augmenter', 'Increase', 'Aumentar', 'Aumenta')}
                      style={{ width:32, height:32, borderRadius:6, background:'transparent', border:'none', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>

      {/* ── Footer "Propulsé par HabaShop" ── */}
      <footer style={{
        padding:'24px 16px', textAlign:'center', fontSize:11,
        color:'var(--text3)', borderTop:'1px solid var(--border)', marginTop:32,
      }}>
        {i(lang, 'Boutique propulsée par', 'Powered by', 'Tienda impulsada por', 'Negozio gestito da')}{' '}
        <a href="https://habashop.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color:'var(--p)', fontWeight:700 }}>HabaShop</a>
        {' · '}
        <a href="https://habashop.vercel.app/signup" target="_blank" rel="noopener noreferrer" style={{ color:'var(--text3)' }}>
          {i(lang, 'Créez la vôtre gratuitement', 'Create yours for free', 'Crea la tuya gratis', 'Crea la tua gratis')}
        </a>
      </footer>

      {/* ── Panier sticky bottom ── */}
      {cartCount > 0 && (
        <div role="region" aria-label={i(lang, 'Panier', 'Cart', 'Carrito', 'Carrello')} style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:20,
          background:'var(--card)', borderTop:'1.5px solid var(--p)',
          padding:'12px 16px', boxShadow:'0 -8px 24px rgba(0,0,0,.3)',
          display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:700 }}>
              <ShoppingCart size={11} style={{ verticalAlign:'middle', marginRight:4 }} />
              {cartCount} {i(lang, cartCount > 1 ? 'articles' : 'article', cartCount > 1 ? 'items' : 'item', cartCount > 1 ? 'artículos' : 'artículo', cartCount > 1 ? 'articoli' : 'articolo')}
            </div>
            <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', fontFamily:'var(--mono)' }}>
              {formatPrice(cartTotal, t.currency)}
            </div>
          </div>
          <button
            onClick={orderViaWhatsApp}
            disabled={!t.whatsappPhone}
            style={{
              padding:'12px 20px', borderRadius:10,
              background: t.whatsappPhone ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'var(--bg4)',
              border:'none', color: t.whatsappPhone ? '#fff' : 'var(--text3)',
              fontSize:14, fontWeight:800, cursor: t.whatsappPhone ? 'pointer' : 'not-allowed',
              fontFamily:'inherit', display:'flex', alignItems:'center', gap:8,
              boxShadow: t.whatsappPhone ? '0 4px 14px rgba(37,211,102,.4)' : 'none',
            }}>
            <MessageCircle size={16} /> {i(lang, 'Commander', 'Order', 'Pedir', 'Ordina')}
          </button>
        </div>
      )}

      {/* ── Styles responsifs ── */}
      <style>{`
        @media (min-width: 640px) { .catalog-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        @media (min-width: 900px) { .catalog-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
        @media (min-width: 1200px) { .catalog-grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; max-width: 1200px; margin-left: auto; margin-right: auto; } }
        @keyframes loader-blink { 0%, 80%, 100% { opacity: 0.2 } 40% { opacity: 1 } }
        .loader-dots { letter-spacing: 4px; animation: loader-blink 1.4s infinite both; }
      `}</style>
    </div>
  )
}
