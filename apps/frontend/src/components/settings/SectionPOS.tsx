import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useConfig, useFormatAmount, useConvertToXOF, useConvertFromXOF, useCurrencyInfo } from '@/stores/appStore'
import { ShoppingCart } from 'lucide-react'
import { tenantApi } from '@/lib/api'
import { type L4, makeI, pick, panel, Head, ToggleCard } from '@/components/settings/settingsShared'

export default function SectionPOS() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const fmt = useFormatAmount()
  const toXOF = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
  const { symbol, decimals } = useCurrencyInfo()
  const [editMode, setEditMode] = useState(false)
  const snapshot = () => ({
    posVatIncluded: cfg.posVatIncluded, posAutoprint: cfg.posAutoprint, autoWhatsApp: cfg.autoWhatsApp,
    enableLoyalty: cfg.enableLoyalty, requireCashier: cfg.requireCashier, enableScanner: cfg.enableScanner,
    priceMode: cfg.priceMode, posTaxRate: cfg.posTaxRate,
  })
  const [draft, setDraft] = useState(snapshot())
  const [fundInput, setFundInput] = useState(fromXOF(cfg.posDefaultFund).toFixed(decimals))

  // Charge les paramètres POS depuis le tenant (source de vérité backend).
  // posTaxRate côté front = vatRate côté backend (single source of truth — pas de doublon de TVA).
  useEffect(() => {
    tenantApi.get().then((t: any) => {
      if (!t) return
      cfg.updateConfig({
        posVatIncluded: t.posVatIncluded ?? true,
        posAutoprint:   t.posAutoprint   ?? false,
        autoWhatsApp:   t.autoWhatsApp   ?? false,
        enableLoyalty:  t.enableLoyalty  ?? false,
        requireCashier: t.requireCashier ?? false,
        enableScanner:  t.enableScanner  ?? false,
        priceMode:      (t.priceMode === 'HT' ? 'HT' : 'TTC') as 'TTC' | 'HT',
        posTaxRate:     t.vatRate        ?? 18,
        posDefaultFund: t.posDefaultFund ?? 0,
      } as any)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const v = editMode ? draft : snapshot()
  const startEdit = () => { setDraft(snapshot()); setFundInput(fromXOF(cfg.posDefaultFund).toFixed(decimals)); setEditMode(true) }
  const toggle = (key: keyof ReturnType<typeof snapshot>) => { if (!editMode) return; setDraft(p => ({ ...p, [key]: !(p as any)[key] })) }

  const TOGGLES: { key: any; icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string> }[] = [
    { key: 'posVatIncluded', icon: '💰', color: 'var(--acc2)', label: { fr: 'TVA incluse', en: 'VAT included', es: 'IVA incluido', it: 'IVA inclusa' }, desc: { fr: 'Prix affichés TVA comprise', en: 'Prices shown VAT-inclusive', es: 'Precios con IVA', it: 'Prezzi IVA inclusa' } },
    { key: 'posAutoprint', icon: '🖨️', color: 'var(--p2)', label: { fr: 'Impression auto', en: 'Auto print', es: 'Impresión auto', it: 'Stampa auto' }, desc: { fr: 'Imprime le ticket après vente', en: 'Print receipt after sale', es: 'Imprimir ticket tras venta', it: 'Stampa ricevuta dopo vendita' } },
    { key: 'autoWhatsApp', icon: '💬', color: '#25D366', label: { fr: 'Ticket WhatsApp', en: 'WhatsApp receipt', es: 'Ticket WhatsApp', it: 'Ricevuta WhatsApp' }, desc: { fr: 'Envoie le ticket par WhatsApp', en: 'Send receipt via WhatsApp', es: 'Enviar ticket por WhatsApp', it: 'Invia ricevuta via WhatsApp' } },
    { key: 'enableLoyalty', icon: '⭐', color: 'var(--warn)', label: { fr: 'Programme fidélité', en: 'Loyalty program', es: 'Programa fidelidad', it: 'Programma fedeltà' }, desc: { fr: 'Active les points de fidélité', en: 'Enable loyalty points', es: 'Activar puntos de fidelidad', it: 'Abilita punti fedeltà' } },
    { key: 'requireCashier', icon: '🔐', color: 'var(--acc3,#00B8FF)', label: { fr: 'Ouverture de caisse', en: 'Cashier open required', es: 'Apertura de caja', it: 'Apertura cassa' }, desc: { fr: 'Exiger l\'ouverture avant les ventes', en: 'Require opening before sales', es: 'Exigir apertura antes de ventas', it: 'Richiedi apertura prima delle vendite' } },
    { key: 'enableScanner', icon: '📷', color: 'var(--p3)', label: { fr: 'Scanner codes-barres', en: 'Barcode scanner', es: 'Escáner de códigos', it: 'Scanner codici' }, desc: { fr: 'Active le scanner intégré', en: 'Enable built-in scanner', es: 'Activar escáner integrado', it: 'Abilita scanner integrato' } },
  ]

  const PRICE_MODES: { id: 'TTC' | 'HT'; title: string; sub: string }[] = [
    { id: 'TTC', title: 'TTC', sub: i('Taxes incluses', 'Tax included', 'Impuestos incluidos', 'Tasse incluse') },
    { id: 'HT', title: 'HT', sub: i('Hors taxes', 'Excl. tax', 'Sin impuestos', 'Tasse escluse') },
  ]

  const save = async () => {
    const fundXOF = toXOF(Number(fundInput) || 0)
    try {
      await tenantApi.update({
        posVatIncluded: draft.posVatIncluded,
        posAutoprint:   draft.posAutoprint,
        autoWhatsApp:   draft.autoWhatsApp,
        enableLoyalty:  draft.enableLoyalty,
        requireCashier: draft.requireCashier,
        enableScanner:  draft.enableScanner,
        priceMode:      draft.priceMode,
        vatRate:        draft.posTaxRate,    // mapping → tenant.vatRate (single source of truth)
        posDefaultFund: fundXOF,
      })
      cfg.updateConfig({ ...draft, posDefaultFund: fundXOF, shopVatRate: draft.posTaxRate } as any)
      toast.success(i('✅ Config POS sauvegardée', '✅ POS config saved', '✅ Config TPV guardada', '✅ Config POS salvata'))
      setEditMode(false)
    } catch (e: any) {
      toast.error(i('Échec de la sauvegarde', 'Save failed', 'Error al guardar', 'Salvataggio fallito') + (e?.message ? ` : ${e.message}` : ''))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp .3s ease both' }}>
      <div style={panel}>
        <Head icon={<ShoppingCart size={16} />} tint="rgba(0,208,132,.05)"
          title={i('Configuration POS', 'POS Configuration', 'Configuración TPV', 'Configurazione POS')}
          sub={i('Caisse, TVA et paiements', 'Cashier, VAT and payments', 'Caja, IVA y pagos', 'Cassa, IVA e pagamenti')}
          right={editMode
            ? <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12, cursor: 'pointer' }} onClick={save}>✅ {i('Sauvegarder', 'Save', 'Guardar', 'Salva')}</button>
                <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer' }} onClick={() => setEditMode(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
              </div>
            : <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer' }} onClick={startEdit}>✏️ {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>} />

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TOGGLES.map(t => (
            <ToggleCard key={t.key} icon={t.icon} color={t.color} label={pick(lang, t.label)} desc={pick(lang, t.desc)}
              on={!!(v as any)[t.key]} disabled={!editMode} onChange={() => toggle(t.key as any)} />
          ))}

          {/* Price mode (TTC / HT) */}
          <div style={{ display: 'flex', gap: 10 }}>
            {PRICE_MODES.map(m => (
              <button key={m.id} type="button" disabled={!editMode} onClick={() => editMode && setDraft(p => ({ ...p, priceMode: m.id }))}
                style={{ flex: 1, padding: 14, borderRadius: 12, cursor: editMode ? 'pointer' : 'default', opacity: editMode ? 1 : .7, textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s', background: v.priceMode === m.id ? 'rgba(108,71,255,.1)' : 'rgba(255,255,255,.02)', border: `2px solid ${v.priceMode === m.id ? 'var(--p)' : 'rgba(255,255,255,.06)'}` }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: v.priceMode === m.id ? 'var(--p3)' : 'var(--text)' }}>{m.title}{v.priceMode === m.id ? ' ✓' : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {/* VAT rate */}
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,149,0,.12)', border: '1px solid rgba(255,149,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{i('Taux de TVA', 'VAT Rate', 'Tasa IVA', 'Aliquota IVA')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Appliqué sur les ventes POS', 'Applied on POS sales', 'Aplicado en ventas TPV', 'Applicato sulle vendite POS')}</div>
              </div>
            </div>
            {editMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={0} max={100} step={0.5} className="input" style={{ width: 80, textAlign: 'right' }} value={draft.posTaxRate} onChange={e => setDraft(p => ({ ...p, posTaxRate: Math.max(0, Math.min(100, +e.target.value)) }))} />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--acc)', width: 20 }}>%</span>
              </div>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{cfg.posTaxRate}%</div>
            )}
          </div>

          {/* Opening fund — currency dynamic */}
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💵</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{i('Fond de caisse', 'Opening fund', 'Fondo de caja', 'Fondo cassa')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Montant initial en caisse', 'Initial cash amount', 'Monto inicial en caja', 'Importo iniziale in cassa')}</div>
              </div>
            </div>
            {editMode ? (
              <div style={{ position: 'relative' }}>
                <input type="number" min={0} step={1} className="input" style={{ width: 150, textAlign: 'right', paddingRight: 44 }} value={fundInput} onChange={e => setFundInput(e.target.value)} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 11, pointerEvents: 'none', fontWeight: 700 }}>{symbol}</span>
              </div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>{fmt(cfg.posDefaultFund)}</div>
            )}
          </div>

          {editMode && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,184,0,.06)', border: '1px solid rgba(255,184,0,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--warn)' }}>
              <span>⚠️</span>
              <span>{i('Modifications non sauvegardées — cliquez sur Sauvegarder', 'Unsaved changes — click Save to apply', 'Cambios sin guardar — haga clic en Guardar', 'Modifiche non salvate — clicca Salva')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
