import { memo, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import { User, Factory, Package, CreditCard, ClipboardList, AlertTriangle, RotateCcw, FileText, Loader2, Tag, History } from 'lucide-react'
import toast from 'react-hot-toast'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { t } from '@/stores/appStore'
import { salesApi } from '@/lib/api'
import { CATS, catLabel, payModeLabel, showStrikePrice, type PosProduct, type CartItem } from '@/components/pos/posShared'
import { isPromotionActive } from '@/lib/pricing'

interface POSProductGridProps {
  posTab: 'pos' | 'history'
  lang: string
  activeCat: string; setActiveCat: (v: string) => void
  clientType: 'retail' | 'wholesale' | 'semi'; setClientType: (v: any) => void
  fmt: (n: number) => string
  // Prix tuile façon maquette : montant (devise d'affichage, sans symbole) + suffixe discret
  amountLabel: (n: number) => string
  curSuffix: string
  filtered: PosProduct[]
  cart: CartItem[]
  addItem: (p: any) => void
  getPrice: (p: any) => number
  posShowStockOnTile: boolean
  loadingHistory: boolean
  salesHistory: any[]
  // Audit des écarts de prix — ADMIN uniquement (filtre + badges + détail masqués aux autres rôles).
  canAuditPrices: boolean
  divergenceOnly: boolean
  onToggleDivergence: (v: boolean) => void
  canRefund: boolean
  onRefundClick: (sale: any) => void
  // Sous-filtre d'audit REMONTÉ au parent : « honored » déclenche une requête serveur
  // (`?pricingHonored=true`) pour couvrir toute la base, pas seulement la page chargée.
  gapFilter?: 'none' | 'look' | 'honored'
  onGapFilterChange?: (f: 'none' | 'look' | 'honored') => void
  canCloseDay?: boolean; onCloseDay?: () => void
  isMobile: boolean; mobileView: string
  totalProducts: number; loadingProducts: boolean
  navigate: (path: string, opts?: any) => void
}

// ── Audit des ÉCARTS de prix (ADMIN) ─────────────────────────────────────────────
// Dérive, depuis les lignes stockées, chaque écart prix soumis/catalogue + son SENS :
//  - « corrigé » (EN LIGNE) : le serveur a facturé SON prix (unitPrice === catalogPrice) ;
//  - « honoré » (HORS-LIGNE) : le montant encaissé a été gardé (unitPrice === submittedPrice).
// … PLUS une QUALIFICATION serveur (`staleCatalogAt`, Chantier B) : le prix soumis était le
// tarif catalogue jusqu'à cette date, assez récemment pour qu'un catalogue POS en cache
// l'explique. Sans elle, un cache périmé produisait la MÊME ligne ambre qu'un prix forgé —
// donc l'écran accusait un caissier honnête.
// Vocabulaire FACTUEL : « écart de prix », « tarif précédent » ; jamais « suspect »/« fraude ».
export type DivRow = { name: string; qty: number; submitted: number; catalog: number; corrected: boolean; deltaXOF: number; staleAt: string | null; honored: boolean }
export function priceDivergenceRows(sale: any): DivRow[] {
  return (sale?.items ?? [])
    .filter((it: any) => it?.submittedPrice != null && it?.catalogPrice != null && it.submittedPrice !== it.catalogPrice)
    .map((it: any) => ({
      name: it.product?.name ?? 'Produit',
      qty: it.qty,
      submitted: it.submittedPrice,
      catalog: it.catalogPrice,
      corrected: it.unitPrice === it.catalogPrice, // en ligne : prix serveur facturé (soumis rejeté)
      deltaXOF: (it.submittedPrice - it.catalogPrice) * it.qty, // signé (base XOF) : <0 = sous le catalogue
      staleAt: it.staleCatalogAt ?? null,          // qualifié « tarif précédent » par le SERVEUR
      honored: it.pricingHonored === true,         // le montant SOUMIS a été facturé → l'argent a bougé
    }))
}

// Traitement visuel d'une vente, dérivé des lignes. UNE seule source pour le badge, le
// cadre de détail et le filtre → les trois ne peuvent pas diverger.
//  - 'look'     : au moins un écart EN LIGNE que le serveur n'a PAS pu expliquer → ambre.
//  - 'previous' : les écarts s'expliquent par un tarif précédent → bleu, factuel, pas une alerte.
//  - 'offline'  : montant encaissé honoré hors-ligne → gris, bénin (comportement historique).
// ⚠️ Prudence assumée : une vente qui MÊLE un écart expliqué et un inexpliqué reste 'look'.
// « jusqu'au JJ/MM à HH:MM » — l'auditeur veut QUAND le tarif a changé, pas l'année.
export function staleUntilLabel(iso: string, lang: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  return `${d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`
}

// Le badge « PROMO » de la tuile ne s'affiche que pour un client DÉTAIL ET une promo
// EFFECTIVE (non expirée). Extrait pour être verrouillé : le bug de #125 était d'utiliser
// le booléen brut `promotion`, laissant une promo périmée afficher le badge.
export function promoBadgeVisible(
  promotion: boolean | null | undefined,
  promotionEnd: string | null | undefined,
  clientType: string,
  now: Date,
): boolean {
  return isPromotionActive(promotion, promotionEnd, now) && clientType === 'retail'
}

// ⚠️ QUATRE traitements depuis le rejeu hors-ligne honoré (option A). L'ordre est un ordre
// de PRUDENCE, du plus exigeant au plus bénin :
//  1. 'look'     — un écart EN LIGNE que le serveur n'a pas su expliquer. Prime sur tout le reste :
//                  une vente qui mêle expliqué et inexpliqué reste à regarder.
//  2. 'honored'  — le montant encaissé a été facturé tel quel au rejeu (`pricingHonored`).
//                  ⚠️ NE PAS le ranger avec 'previous' : là-bas le serveur a re-tarifé, donc
//                  l'argent est juste et le bleu se lit « fait établi ». ICI L'ARGENT A BOUGÉ —
//                  c'est la contrepartie assumée de l'option A, et elle doit être VÉRIFIÉE.
//                  Sans ce niveau, la trace serait stockée sans que personne ne la regarde,
//                  et tout l'argument de A (« borné ET surveillé ») tomberait.
//  3. 'previous' — écart expliqué par un tarif précédent, serveur re-tarifé : fait, pas alerte.
//  4. 'offline'  — montant honoré sans qualification (ventes HISTORIQUES, avant l'option A).
export type PriceGapLevel = 'look' | 'honored' | 'previous' | 'offline'
export function priceGapLevel(rows: DivRow[]): PriceGapLevel {
  if (rows.some(r => r.corrected && !r.staleAt)) return 'look'
  if (rows.some(r => r.honored)) return 'honored'
  if (rows.some(r => r.staleAt)) return 'previous'
  return 'offline'
}

// Tuile produit mémoïsée : props primitives (labels pré-formatés) → seule la tuile dont
// la quantité panier / le prix change re-rend, pas toute la grille à chaque frappe/ajout.
interface ProductTileProps {
  p: PosProduct
  qty: number | undefined
  priceLabel: string        // libellé complet (aria) — ex. « 4 500 FCFA »
  amount: string            // montant seul — ex. « 4 500 »
  suffix: string            // devise discrète — ex. « FCFA »
  baseAmount: string        // montant barré (promo / tarif) — sans devise
  showStrike: boolean
  isPromoRetail: boolean
  posShowStockOnTile: boolean
  ruptureLabel: string
  onAdd: (p: PosProduct) => void
}

const ProductTile = memo(function ProductTile({ p, qty, priceLabel, amount, suffix, baseAmount, showStrike, isPromoRetail, posShowStockOnTile, ruptureLabel, onAdd }: ProductTileProps) {
  const inCart     = qty !== undefined
  const isLowStock = p.stock < 20
  const isOut      = p.stock <= 0
  // Rupture bloquante UNIQUEMENT si le stock est affiché (sinon le commerçant gère à la main).
  const blocked    = posShowStockOnTile && isOut
  // Spec item 11 : stock bas = bordure --warn + point ambre — n'empêche PAS la vente.
  const lowStockRing = isLowStock && !isOut && !inCart
  return (
    <div
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-label={`${p.name} — ${priceLabel}`}
      aria-disabled={blocked}
      onClick={() => { if (!blocked) onAdd(p) }}
      onKeyDown={e => {
        if (!blocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAdd(p) }
      }}
      style={{
        background: inCart
          ? 'color-mix(in srgb, var(--p) 8%, var(--bg2))'
          : 'var(--bg2)',
        // Sélection : anneau via box-shadow (0.5 + 1.5 = 2px visuels) → zéro décalage de layout
        border: `0.5px solid ${inCart ? 'var(--p)' : lowStockRing ? 'var(--warn)' : 'var(--border)'}`,
        boxShadow: inCart ? '0 0 0 1.5px var(--p)' : 'none',
        borderRadius: 12,
        // Maquette : padding 11, contenu aligné à gauche (padding bas élargi si pill stock)
        padding: posShowStockOnTile ? '11px 11px 26px' : 11,
        cursor: blocked ? 'not-allowed' : 'pointer',
        opacity: blocked ? 0.45 : 1,
        textAlign: 'left',
        transition: 'all .15s ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!inCart && !blocked) {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--p2)'
          el.style.transform = 'translateY(-2px)'
          el.style.boxShadow = 'var(--sh-sm)'
        }
      }}
      onMouseLeave={e => {
        if (!inCart && !blocked) {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--border)'
          el.style.transform = 'none'
          el.style.boxShadow = 'none'
        }
      }}
    >
      {/* Badge promo — subtil (spec item 11) : teinte, pas d'aplat criard */}
      {isPromoRetail && (
        <div style={{
          position:'absolute', top:6, left:6,
          background:'var(--c-red-bg)', color:'var(--danger)',
          border:'1px solid var(--c-red-border)',
          borderRadius:'var(--r-full)', padding:'1px 7px',
          fontSize:9.5, fontWeight:'var(--fw-bold)', letterSpacing:'.5px',
        }}>PROMO</div>
      )}
      {/* Point ambre stock bas (spec item 11) — remplacé par le badge quantité une fois au panier */}
      {lowStockRing && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 7, right: 7,
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--warn)', boxShadow: '0 0 6px var(--warn)',
        }} />
      )}
      {/* Badge quantité si dans panier */}
      {inCart && (
        <div style={{
          position: 'absolute',
          top: -8, right: -8,
          background: 'var(--p)',
          color: '#fff',
          borderRadius: '50%',
          width: 22, height: 22,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11, fontWeight: 'var(--fw-bold)',
          border: '2px solid var(--bg)',
        }}>×{qty}</div>
      )}

      {/* Zone visuelle produit (maquette : 38px, centrée) */}
      <div style={{
        height: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }} aria-hidden="true">{p.emoji}</div>

      {/* Nom — gauche, 12px (maquette) */}
      <div style={{
        fontSize: 12,
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text)',
        lineHeight: 1.3,
        marginTop: 6,
      }}>{p.name}</div>

      {/* Prix : montant or (--acc) + suffixe devise discret (maquette) */}
      <div style={{ marginTop: 3 }}>
        {showStrike && (
          <span style={{ fontSize: 10, color: 'var(--text3)', textDecoration: 'line-through', fontFamily: 'var(--mono)', marginRight: 5 }}>
            {baseAmount}
          </span>
        )}
        <span style={{
          fontSize: 13, fontWeight: 'var(--fw-semibold)',
          color: isPromoRetail ? 'var(--danger)' : 'var(--acc)',
          fontFamily: 'var(--mono)',
        }}>{amount}</span>{' '}
        <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--acc) 55%, var(--text3))' }}>{suffix}</span>
      </div>

      {/* Stock — pill sémantique ancrée en bas à droite (vert OK / orange bas / rouge rupture) */}
      {posShowStockOnTile && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 'var(--r-full)',
          fontSize: 11, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', lineHeight: 1.4,
          background: isOut ? 'var(--c-red-bg)' : isLowStock ? 'var(--c-orange-bg)' : 'var(--c-green-bg)',
          border: `1px solid ${isOut ? 'var(--c-red-border)' : isLowStock ? 'var(--c-orange-border)' : 'var(--c-green-border)'}`,
          color: isOut ? 'var(--danger)' : isLowStock ? 'var(--warn)' : 'var(--acc2)',
        }}>
          {isLowStock && !isOut && <AlertTriangle size={9} style={{ flexShrink: 0 }} />}
          {isOut ? ruptureLabel : p.stock}
        </div>
      )}
    </div>
  )
})

export default function POSProductGrid({ posTab, lang, activeCat, setActiveCat, clientType, setClientType, fmt, amountLabel, curSuffix, filtered, cart, addItem, getPrice, posShowStockOnTile, loadingHistory, salesHistory, canAuditPrices, divergenceOnly, onToggleDivergence, gapFilter: gapFilterProp, onGapFilterChange, canRefund, onRefundClick, canCloseDay, onCloseDay, isMobile, mobileView, totalProducts, loadingProducts, navigate }: POSProductGridProps) {
  // Audit écarts (ADMIN) : « à regarder » = filtre CLIENT sur la liste chargée (le filtre
  // serveur `divergenceOnly` renvoie TOUS les écarts ; on affine ici).
  // ⚠️ Ce sous-filtre ne garde QUE les écarts que le serveur n'a pas su expliquer. Il visait
  // déjà « ce qu'il faut regarder » — depuis la qualification `staleCatalogAt`, garder tous
  // les écarts « en ligne » y ferait entrer des caches périmés, c.-à-d. du bruit qui ressemble
  // à une tentative. Même dérivation que le badge (priceGapLevel) → jamais de désaccord.
  // Deux sous-filtres, deux questions DIFFÉRENTES — ne pas les fusionner :
  //  · « à regarder » : le serveur n'explique pas l'écart (tentative possible) ;
  //  · « écarts honorés » : le serveur a facturé le montant encaissé au rejeu — l'argent a
  //    bougé dans le cadre prévu, mais il faut pouvoir CONSULTER ces lignes, sinon la trace
  //    n'est qu'un stockage et l'option A perd sa contrepartie.
  const [gapFilterLocal, setGapFilterLocal] = useState<'none' | 'look' | 'honored'>('none')
  const gapFilter = gapFilterProp ?? gapFilterLocal
  const setGapFilter = onGapFilterChange ?? setGapFilterLocal
  const historyToShow = useMemo(() => {
    if (!canAuditPrices || gapFilter === 'none') return salesHistory
    // 'honored' est DÉJÀ résolu par le SERVEUR (la liste ne contient que des ventes honorées).
    // Ré-appliquer `priceGapLevel` ici masquerait celles qui mêlent honoré et inexpliqué —
    // classées 'look' par prudence, donc absentes de leur propre filtre. On garde tout.
    if (gapFilter === 'honored') return salesHistory
    return salesHistory.filter(s => priceGapLevel(priceDivergenceRows(s)) === gapFilter)
  }, [salesHistory, canAuditPrices, gapFilter])
  // Quantités panier indexées par produit (first-wins = même sémantique que cart.find)
  const qtyById = useMemo(() => {
    const m = new Map<string | number, number>()
    for (const i of cart) if (!m.has(i.id)) m.set(i.id, i.qty)
    return m
  }, [cart])
  // Identité stable pour la tuile mémoïsée — la closure appelée reste la dernière à jour
  const addItemRef = useRef(addItem)
  addItemRef.current = addItem
  const onAdd = useCallback((p: PosProduct) => addItemRef.current(p), [])
  return (
        <div style={{
          flex: 1,
          minWidth: 0,
          display: isMobile && mobileView === 'cart' ? 'none' : 'flex',
          flexDirection: 'column',
          padding: '12px 12px 12px 16px',
          gap: 10,
          overflow: 'hidden',
        }}>

          {/* Filtres catégories SEULS au-dessus du catalogue (sobriété maquette) +
              sélecteur de tarif discret en bout de ligne (progressive disclosure).
              L'accès Historique vit dans la barre POS ; la remise vit dans le panier. */}
          {posTab === 'pos' && (
            <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                flexWrap: 'nowrap',
                paddingBottom: 2,
                paddingRight: 28,
                scrollbarWidth: 'thin',
                WebkitOverflowScrolling: 'touch',
              }}>
                {CATS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    aria-pressed={activeCat === c.id}
                    style={{
                      padding: '6px 13px',
                      minHeight: isMobile ? 44 : 30, // cible tactile ≥ 44px en usage réel (spec)
                      borderRadius: 'var(--r-full)',
                      fontSize: 12,
                      fontWeight: 'var(--fw-semibold)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      transition: 'all .15s',
                      whiteSpace: 'nowrap',
                      // Maquette : active = --p plein / inactive = carte bordée
                      background: activeCat === c.id ? 'var(--p)' : 'var(--card)',
                      border: `1px solid ${activeCat === c.id ? 'var(--p)' : 'var(--border2)'}`,
                      color: activeCat === c.id ? '#fff' : 'var(--text2)',
                    }}
                  >{catLabel(c.id, lang)}</button>
                ))}
              </div>
              {/* Indicateur d'overflow : voile dégradé côté droit (décoratif) */}
              <div aria-hidden="true" style={{
                position: 'absolute', top: 0, right: 0, bottom: 2, width: 28,
                background: 'linear-gradient(90deg, transparent, var(--bg))',
                pointerEvents: 'none',
              }} />
              </div>

              {/* Tarif client — toggle segmenté discret (Détail / Grossiste / Demi-gros) */}
              <div role="group"
                aria-label={lang === 'en' ? 'Price tier' : lang === 'es' ? 'Tarifa' : lang === 'it' ? 'Tariffa' : 'Tarif client'}
                style={{
                  display: 'flex', flexShrink: 0, gap: 2,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-full)', padding: 2,
                }}>
                {([
                  { id:'retail',    icon: <User size={12} />,    label: lang === 'en' ? 'Retail'         : lang === 'es' ? 'Minorista'      : lang === 'it' ? 'Dettaglio'     : 'Détail'    },
                  { id:'wholesale', icon: <Factory size={12} />, label: lang === 'en' ? 'Wholesaler'     : lang === 'es' ? 'Mayorista'      : lang === 'it' ? 'Grossista'     : 'Grossiste' },
                  { id:'semi',      icon: <Package size={12} />, label: lang === 'en' ? 'Semi-wholesale' : lang === 'es' ? 'Semi-mayorista' : lang === 'it' ? 'Semi-ingrosso' : 'Demi-gros' },
                ] as { id:'retail'|'wholesale'|'semi'; icon: ReactNode; label:string }[]).map(ct => (
                  <button key={ct.id} type="button" onClick={() => setClientType(ct.id)}
                    aria-pressed={clientType === ct.id}
                    title={ct.label}
                    style={{
                      padding: isMobile ? '8px 10px' : '5px 10px', borderRadius: 'var(--r-full)',
                      minHeight: isMobile ? 40 : undefined,
                      fontSize: 11, fontWeight: 'var(--fw-semibold)',
                      cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
                      background: clientType === ct.id ? 'var(--p)' : 'transparent',
                      border: 'none',
                      color: clientType === ct.id ? '#fff' : 'var(--text3)',
                      display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                    }}>
                    {ct.icon}
                    {/* Libellé texte : requis a11y/E2E (^Grossiste$) — masqué visuellement nulle part */}
                    <span>{ct.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compteur de résultats — annoncé aux lecteurs d'écran à chaque filtre/recherche */}
          {posTab === 'pos' && (
            <div className="sr-only" role="status" aria-live="polite">
              {filtered.length} {lang === 'en' ? 'products displayed' : lang === 'es' ? 'productos mostrados' : lang === 'it' ? 'prodotti visualizzati' : 'produits affichés'}
            </div>
          )}

          {/* Tarif actif — mention discrète ancrée AU-DESSUS de la grille (le sélecteur est
              loin à droite) : explique pourquoi les prix diffèrent du prix détail. Affichée
              seulement hors Détail (le mode par défaut n'a rien à justifier). */}
          {posTab === 'pos' && clientType !== 'retail' && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              <span style={{ display: 'flex', color: 'var(--p2)' }}>
                {clientType === 'wholesale' ? <Factory size={12} /> : <Package size={12} />}
              </span>
              <span>
                {lang === 'en' ? 'Pricing' : lang === 'es' ? 'Tarifa' : lang === 'it' ? 'Tariffa' : 'Tarif'}{' '}
                <b style={{ color: 'var(--p2)', fontWeight: 'var(--fw-semibold)' }}>
                  {clientType === 'wholesale'
                    ? (lang === 'en' ? 'Wholesaler' : lang === 'es' ? 'Mayorista' : lang === 'it' ? 'Grossista' : 'Grossiste')
                    : (lang === 'en' ? 'Semi-wholesale' : lang === 'es' ? 'Semi-mayorista' : lang === 'it' ? 'Semi-ingrosso' : 'Demi-gros')}
                </b>{' '}
                {lang === 'en' ? 'applied' : lang === 'es' ? 'aplicada' : lang === 'it' ? 'applicata' : 'appliqué'}
              </span>
            </div>
          )}

          {/* Grille produits — SCROLL ICI */}
          {posTab === 'pos' && <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingTop: 8,
          }}>
            {/* Spec item 11 : grille auto-fill minmax(112px, 1fr) */}
            <ResponsiveGrid min={112} gap={10} style={{ paddingBottom: 8 }}>
              {filtered.map(p => {
                // ⚠️ Le badge PROMO doit refléter une promo EFFECTIVE (non expirée), pas le
                // booléen brut : sinon une promo périmée affiche encore « PROMO » alors que le
                // prix (effective) est déjà redevenu normal (incohérence laissée par #125).
                const isPromoRetail = promoBadgeVisible(p.promotion, p.promotionEnd, clientType, new Date())
                const effective = getPrice(p)
                return (
                  <ProductTile
                    key={p.id}
                    p={p}
                    qty={qtyById.get(p.id)}
                    priceLabel={fmt(effective)}
                    amount={amountLabel(effective)}
                    suffix={curSuffix}
                    baseAmount={amountLabel(p.price)}
                    // Barré seulement en cas de vrai écart (prix réf > effectif) — plus de
                    // « 2 800 2 800 » quand le tarif de gros retombe sur le prix détail.
                    showStrike={showStrikePrice(p.price, effective)}
                    isPromoRetail={isPromoRetail}
                    posShowStockOnTile={posShowStockOnTile}
                    ruptureLabel={lang === 'en' ? 'Out of stock' : lang === 'es' ? 'Agotado' : lang === 'it' ? 'Esaurito' : 'Rupture'}
                    onAdd={onAdd}
                  />
                )
              })}

              {filtered.length === 0 && (
                loadingProducts ? (
                  <div role="status" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 10, color: 'var(--text3)' }}>
                    <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--p)', flexShrink: 0 }} />
                    <span style={{ fontSize: 14 }}>{lang === 'en' ? 'Loading products…' : lang === 'es' ? 'Cargando productos…' : lang === 'it' ? 'Caricamento prodotti…' : 'Chargement des produits…'}</span>
                  </div>
                ) : totalProducts === 0 ? (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                    <div style={{ fontSize: 14, fontWeight: 'var(--fw-semibold)', color: 'var(--text2)', marginBottom: 6 }}>
                      {lang === 'fr' ? 'Aucun produit en stock' : lang === 'es' ? 'Sin productos en stock' : lang === 'it' ? 'Nessun prodotto in stock' : 'No products in stock'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, maxWidth: 280 }}>
                      {lang === 'fr' ? 'Ajoutez vos produits dans Stock pour commencer à vendre.' : lang === 'es' ? 'Agregue productos en Stock para comenzar a vender.' : lang === 'it' ? 'Aggiungi prodotti in Stock per iniziare a vendere.' : 'Add products in Stock to start selling.'}
                    </div>
                    <button type="button" onClick={() => navigate('/app/stock')} className="topbar-btn" style={{ fontSize: 13 }}>
                      {lang === 'fr' ? '+ Ajouter des produits' : lang === 'es' ? '+ Agregar productos' : lang === 'it' ? '+ Aggiungi prodotti' : '+ Add products'}
                    </button>
                  </div>
                ) : (
                  <div role="status" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text3)', fontSize: 14 }}>
                    {t('pos_not_found')}
                  </div>
                )
              )}
            </ResponsiveGrid>
          </div>}

          {/* ── Onglet Historique ── */}
          {posTab === 'history' && (
            <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
              {/* Clôture journalière (Ticket Z) — MANAGER/ADMIN */}
              {canCloseDay && (
                <button type="button" onClick={onCloseDay}
                  style={{ width:'100%', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    background:'linear-gradient(135deg, var(--p), var(--p2))', border:'none', color:'#fff',
                    borderRadius:'var(--r-md)', padding:'12px', minHeight:44, fontSize:13, fontWeight:'var(--fw-semibold)',
                    fontFamily:'var(--font)', cursor:'pointer' }}>
                  <ClipboardList size={15} /> {lang === 'en' ? 'Close the day (Z ticket)' : lang === 'es' ? 'Cerrar el día (ticket Z)' : lang === 'it' ? 'Chiudi la giornata (ticket Z)' : 'Clôturer la journée (Ticket Z)'}
                </button>
              )}
              {/* Filtre d'audit des écarts de prix — ADMIN uniquement (invisible aux autres rôles) */}
              {canAuditPrices && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'0 4px 10px' }}>
                  <button type="button" onClick={() => onToggleDivergence(!divergenceOnly)} aria-pressed={divergenceOnly}
                    style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)', cursor:'pointer',
                      borderRadius:'var(--r-full)', padding:'5px 12px', minHeight:32,
                      background: divergenceOnly ? 'var(--c-amber-bg)' : 'var(--card)', color: divergenceOnly ? 'var(--warn)' : 'var(--text2)',
                      border:`1px solid ${divergenceOnly ? 'var(--c-amber-border)' : 'var(--border)'}` }}>
                    <Tag size={13} /> {lang === 'en' ? 'Price gaps' : lang === 'es' ? 'Diferencias de precio' : lang === 'it' ? 'Scarti di prezzo' : 'Écarts de prix'}
                  </button>
                  {divergenceOnly && ([
                    { key: 'look' as const, label: lang === 'en' ? 'Needs a look' : lang === 'es' ? 'Para revisar' : lang === 'it' ? 'Da rivedere' : 'À regarder' },
                    // Écarts HONORÉS : l'argent a bougé dans le cadre du rejeu hors-ligne.
                    // Consultables explicitement — une trace qu'on ne peut pas filtrer ne protège personne.
                    { key: 'honored' as const, label: lang === 'en' ? 'Honored gaps' : lang === 'es' ? 'Importes respetados' : lang === 'it' ? 'Importi onorati' : 'Écarts honorés' },
                  ].map(f => {
                    const on = gapFilter === f.key
                    return (
                      <button key={f.key} type="button" onClick={() => setGapFilter(on ? 'none' : f.key)} aria-pressed={on}
                        style={{ fontSize:12, fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)', cursor:'pointer', borderRadius:'var(--r-full)', padding:'5px 12px', minHeight:32,
                          background: on ? 'var(--c-purple-bg)' : 'var(--card)', color: on ? 'var(--p2)' : 'var(--text2)',
                          border:`1px solid ${on ? 'var(--border3)' : 'var(--border)'}` }}>
                        {f.label}
                      </button>
                    )
                  }))}
                </div>
              )}
              {loadingHistory ? (
                <div role="status" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:40, color:'var(--text3)' }}>
                  <Loader2 size={20} style={{ animation:'spin 1s linear infinite', color:'var(--p)', flexShrink:0 }} />
                  <span style={{ fontSize:14 }}>{lang === 'en' ? 'Loading…' : lang === 'es' ? 'Cargando…' : lang === 'it' ? 'Caricamento…' : 'Chargement…'}</span>
                </div>
              ) : historyToShow.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
                  <ClipboardList size={32} style={{ marginBottom:12, color:'var(--text3)' }} />
                  <div>{divergenceOnly
                    ? (lang === 'en' ? 'No price gaps' : lang === 'es' ? 'Sin diferencias de precio' : lang === 'it' ? 'Nessuno scarto di prezzo' : 'Aucun écart de prix')
                    : (lang === 'fr' ? 'Aucune vente enregistrée' : lang === 'en' ? 'No sales recorded' : lang === 'es' ? 'Sin ventas registradas' : 'Nessuna vendita registrata')}</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'0 4px' }}>
                  {historyToShow.slice(0, 50).map((sale: any, i: number) => {
                    const date = new Date(sale.createdAt)
                    const timeAgo = Math.round((Date.now() - date.getTime()) / 60000)
                    const timeLabel = timeAgo < 60 ? `${timeAgo} min` : `${Math.round(timeAgo / 60)}h`
                    const refunded = sale.status === 'refunded'
                    // Écarts de prix (ADMIN) : lignes + sens (corrigé/honoré) + écart en argent.
                    const divRows = canAuditPrices && sale.priceDivergence ? priceDivergenceRows(sale) : []
                    const gap = priceGapLevel(divRows)
                    // Ambre = « à regarder » et RIEN d'autre. Un écart expliqué par un tarif
                    // précédent est bleu (fait), un montant honoré hors-ligne reste gris (bénin).
                    // 'honored' partage l'ambre de 'look' : dans les deux cas il y a quelque chose
                    // à VÉRIFIER. Le bleu reste réservé à ce que le serveur a corrigé lui-même.
                    const gapAlert = gap === 'look' || gap === 'honored'
                    const gapBg = gapAlert ? 'var(--c-amber-bg)' : gap === 'previous' ? 'var(--c-blue-bg)' : 'var(--bg5)'
                    const gapFg = gapAlert ? 'var(--warn)' : gap === 'previous' ? 'var(--info)' : 'var(--text3)'
                    const gapBd = gapAlert ? 'var(--c-amber-border)' : gap === 'previous' ? 'var(--c-blue-border)' : 'var(--border)'
                    const totalDeltaXOF = divRows.reduce((s, r) => s + r.deltaXOF, 0)
                    return (
                      <div key={sale.id ?? i} style={{
                        background:'var(--bg3)', border:`1px solid ${refunded ? 'var(--c-red-border)' : 'var(--border)'}`, borderRadius:12, padding:'12px 14px',
                        opacity: refunded ? .82 : 1,
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)', marginBottom:2, display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                              <CreditCard size={13} /> {lang === 'fr' ? 'Vente' : lang === 'en' ? 'Sale' : lang === 'es' ? 'Venta' : 'Vendita'} #{String(sale.id).slice(-6).toUpperCase()}
                              {refunded && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', borderRadius:'var(--r-full)', padding:'2px 7px', background:'var(--c-red-bg)', color:'var(--danger)', border:'1px solid var(--c-red-border)' }}>
                                  <RotateCcw size={10} /> {lang === 'en' ? 'Refunded' : lang === 'es' ? 'Reembolsada' : lang === 'it' ? 'Rimborsata' : 'Remboursé'}
                                </span>
                              )}
                              {/* Badge écart — TROIS traitements : à regarder (ambre) · tarif
                                  précédent (bleu, fait établi par le serveur) · honoré hors-ligne (gris). */}
                              {divRows.length > 0 && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', borderRadius:'var(--r-full)', padding:'2px 7px',
                                  background: gapBg, color: gapFg, border:`1px solid ${gapBd}` }}>
                                  {gap === 'previous' ? <History size={10} /> : <Tag size={10} />}
                                  {gap === 'honored'
                                    ? (lang === 'en' ? 'Amount honored' : lang === 'es' ? 'Importe respetado' : lang === 'it' ? 'Importo onorato' : 'Montant honoré')
                                    : gap === 'previous'
                                    ? (lang === 'en' ? 'Previous price' : lang === 'es' ? 'Tarifa anterior' : lang === 'it' ? 'Tariffa precedente' : 'Tarif précédent')
                                    : (lang === 'en' ? 'Price gap' : lang === 'es' ? 'Diferencia de precio' : lang === 'it' ? 'Scarto di prezzo' : 'Écart de prix')}
                                  {gap === 'honored' && ` · ${lang === 'en' ? 'to check' : lang === 'es' ? 'a verificar' : lang === 'it' ? 'da verificare' : 'à vérifier'}`}
                                  {gap === 'offline' && ` · ${lang === 'en' ? 'offline' : lang === 'es' ? 'sin conexión' : lang === 'it' ? 'offline' : 'hors-ligne'}`}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text3)' }}>
                              {date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'it-IT')}
                              {' · '}{date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                              {' · '}{timeLabel}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:15, fontWeight:'var(--fw-semibold)', color: refunded ? 'var(--text4)' : 'var(--p2)', fontFamily:'var(--mono)', textDecoration: refunded ? 'line-through' : 'none' }}>{fmt(sale.total)}</div>
                            {(sale.loyaltyDiscount ?? 0) > 0 && (
                              <div style={{ fontSize:10, color:'var(--acc2)', fontFamily:'var(--mono)' }}>⭐ −{fmt(sale.loyaltyDiscount)}</div>
                            )}
                            <span style={{
                              fontSize:11, fontWeight:'var(--fw-semibold)', borderRadius:20, padding:'2px 8px',
                              background: sale.paymentMode === 'cash' ? 'rgba(14,196,126,.12)' : sale.paymentMode === 'card' ? 'rgba(91,78,232,.12)' : 'rgba(240,165,0,.12)',
                              color: sale.paymentMode === 'cash' ? 'var(--acc2)' : sale.paymentMode === 'card' ? 'var(--p2)' : 'var(--acc)',
                            }}>
                              {payModeLabel(sale.paymentMode, lang)}
                            </span>
                          </div>
                        </div>
                        {sale.items?.slice(0, 3).map((item: any, j: number) => (
                          <div key={j} style={{
                            fontSize:11, color:'var(--text2)',
                            display:'flex', justifyContent:'space-between',
                            padding: j === 0 ? '8px 0 3px' : '3px 0',
                            borderTop: j === 0 ? '1px solid var(--border)' : 'none',
                            marginTop: j === 0 ? 6 : 0,
                          }}>
                            <span>×{item.qty} {item.product?.name ?? 'Produit'}</span>
                            <span style={{ fontFamily:'var(--mono)' }}>{fmt(item.total ?? item.qty * item.unitPrice)}</span>
                          </div>
                        ))}
                        {sale.items?.length > 3 && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                            +{sale.items.length - 3} {lang === 'en' ? 'more items' : lang === 'es' ? 'otros artículos' : lang === 'it' ? 'altri articoli' : 'autres articles'}
                          </div>
                        )}
                        {/* Détail de l'écart de prix — ADMIN uniquement. Montre soumis/catalogue,
                            l'écart EN ARGENT (signé) et le caissier → décide s'il faut une question. */}
                        {divRows.length > 0 && (
                          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:'var(--r-md)',
                            background: gap === 'offline' ? 'var(--bg4)' : gapBg,
                            border:`1px solid ${gapBd}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                              <span style={{ fontSize:10, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', color: gapFg }}>
                                {gap === 'look'
                                  ? (lang === 'en' ? 'Price corrected (online)' : lang === 'es' ? 'Precio corregido (en línea)' : lang === 'it' ? 'Prezzo corretto (online)' : 'Prix corrigé (en ligne)')
                                  : gap === 'honored'
                                  /* L'argent a bougé : le libellé le DIT, et dit le geste attendu. */
                                  ? (lang === 'en' ? 'Collected amount billed as is (offline replay) — check' : lang === 'es' ? 'Importe cobrado facturado tal cual (reenvío sin conexión) — verificar' : lang === 'it' ? 'Importo incassato fatturato tale quale (reinvio offline) — verificare' : 'Montant encaissé facturé tel quel (rejeu hors-ligne) — à vérifier')
                                  : gap === 'previous'
                                  ? (lang === 'en' ? 'Catalog price had just changed' : lang === 'es' ? 'La tarifa acababa de cambiar' : lang === 'it' ? 'La tariffa era appena cambiata' : 'Le tarif venait de changer')
                                  : (lang === 'en' ? 'Amount honored (offline)' : lang === 'es' ? 'Monto respetado (sin conexión)' : lang === 'it' ? 'Importo onorato (offline)' : 'Montant honoré (hors-ligne)')}
                              </span>
                              <span style={{ fontSize:13, fontWeight:'var(--fw-bold)', fontFamily:'var(--mono)', color: totalDeltaXOF < 0 ? 'var(--danger)' : 'var(--acc2)' }}>
                                {totalDeltaXOF < 0 ? '−' : '+'}{fmt(Math.abs(totalDeltaXOF))}
                              </span>
                            </div>
                            {divRows.map((r, k) => (
                              <div key={k} style={{ padding:'2px 0' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:11, color:'var(--text2)', flexWrap:'wrap' }}>
                                  <span>×{r.qty} {r.name}</span>
                                  <span style={{ fontFamily:'var(--mono)' }}>
                                    {lang === 'en' ? 'submitted' : lang === 'es' ? 'enviado' : lang === 'it' ? 'inviato' : 'soumis'} {fmt(r.submitted)}
                                    {' · '}{lang === 'en' ? 'catalog' : lang === 'es' ? 'catálogo' : lang === 'it' ? 'catalogo' : 'catalogue'} {fmt(r.catalog)}
                                  </span>
                                </div>
                                {/* Qualification SERVEUR de cette ligne — un fait daté, pas un verdict.
                                    Son absence ne dit rien de plus qu'« inexpliqué » (cf. profondeur 1). */}
                                {r.staleAt && (
                                  <div style={{ fontSize:10, color:'var(--info)', display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                                    <History size={10} style={{ flexShrink:0 }} />
                                    {lang === 'en' ? 'was the catalog price until' : lang === 'es' ? 'era la tarifa del catálogo hasta el' : lang === 'it' ? 'era la tariffa a catalogo fino al' : 'était le tarif catalogue jusqu’au'} {staleUntilLabel(r.staleAt, lang)}
                                  </div>
                                )}
                              </div>
                            ))}
                            <div style={{ fontSize:10, color:'var(--text3)', marginTop:5 }}>
                              {lang === 'en' ? 'Cashier' : lang === 'es' ? 'Cajero' : lang === 'it' ? 'Cassiere' : 'Caissier'} : {sale.cashier?.name ?? '—'}
                            </div>
                          </div>
                        )}
                        {/* Facture PDF — tous rôles, ouvre le PDF serveur dans un nouvel onglet */}
                        <button type="button"
                          onClick={() => salesApi.openInvoice(sale.id).catch(() => toast.error(lang === 'en' ? 'Invoice error' : lang === 'es' ? 'Error de factura' : lang === 'it' ? 'Errore fattura' : 'Erreur facture'))}
                          style={{ marginTop:10, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                            background:'transparent', border:'1px solid var(--border)', color:'var(--text2)',
                            borderRadius:'var(--r-md)', padding:'7px 12px', fontSize:12, fontWeight:'var(--fw-semibold)',
                            fontFamily:'var(--font)', cursor:'pointer' }}>
                          <FileText size={13} /> {lang === 'en' ? 'PDF Invoice' : lang === 'es' ? 'Factura PDF' : lang === 'it' ? 'Fattura PDF' : 'Facture PDF'}
                        </button>
                        {/* Action remboursement — manager/admin uniquement, ventes non remboursées */}
                        {canRefund && !refunded && (
                          <button type="button" onClick={() => onRefundClick(sale)}
                            style={{ marginTop:8, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                              background:'transparent', border:'1px solid var(--c-red-border)', color:'var(--danger)',
                              borderRadius:'var(--r-md)', padding:'7px 12px', fontSize:12, fontWeight:'var(--fw-semibold)',
                              fontFamily:'var(--font)', cursor:'pointer' }}>
                            <RotateCcw size={13} /> {lang === 'en' ? 'Refund' : lang === 'es' ? 'Reembolsar' : lang === 'it' ? 'Rimborsa' : 'Rembourser'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
  )
}
