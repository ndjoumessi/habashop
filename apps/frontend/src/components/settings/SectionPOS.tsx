import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useConfig, useFormatAmount, useConvertToXOF, useConvertFromXOF, useCurrencyInfo, useAppStore } from '@/stores/appStore'
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
    enableAutoWhatsApp: cfg.enableAutoWhatsApp,
    enableLoyalty: cfg.enableLoyalty, requireCashier: cfg.requireCashier, enableScanner: cfg.enableScanner,
    priceMode: cfg.priceMode, posTaxRate: cfg.posTaxRate,
  })
  const [draft, setDraft] = useState(snapshot())
  const [fundInput, setFundInput] = useState(fromXOF(cfg.posDefaultFund).toFixed(decimals))
  // Config fidélité v1 (seuils) + v2 (remises par palier ; défauts 0 = désactivées).
  const LOYALTY_DEFAULTS = { pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000, bronzeDiscount: 0, silverDiscount: 0, goldDiscount: 0 }
  const [loyalty, setLoyalty] = useState(LOYALTY_DEFAULTS)
  const [loyaltyDraft, setLoyaltyDraft] = useState(LOYALTY_DEFAULTS)

  // Charge les paramètres POS depuis le tenant (source de vérité backend).
  // posTaxRate côté front = vatRate côté backend (single source of truth — pas de doublon de TVA).
  useEffect(() => {
    tenantApi.get().then((t: any) => {
      if (!t) return
      cfg.updateConfig({
        posVatIncluded: t.posVatIncluded ?? true,
        posAutoprint:   t.posAutoprint   ?? false,
        autoWhatsApp:   t.autoWhatsApp   ?? false,
        enableAutoWhatsApp: t.enableAutoWhatsApp ?? false,
        enableLoyalty:  t.enableLoyalty  ?? false,
        requireCashier: t.requireCashier ?? false,
        enableScanner:  t.enableScanner  ?? false,
        priceMode:      (t.priceMode === 'HT' ? 'HT' : 'TTC') as 'TTC' | 'HT',
        posTaxRate:     t.vatRate        ?? 18,
        posDefaultFund: t.posDefaultFund ?? 0,
      } as any)
      const lc = {
        pointsPerAmount: t.pointsPerAmount ?? 1000,
        bronzeThreshold: t.bronzeThreshold ?? 2000,
        silverThreshold: t.silverThreshold ?? 5000,
        bronzeDiscount:  t.bronzeDiscount  ?? 0,
        silverDiscount:  t.silverDiscount  ?? 0,
        goldDiscount:    t.goldDiscount    ?? 0,
      }
      setLoyalty(lc); setLoyaltyDraft(lc)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const v = editMode ? draft : snapshot()
  const loyaltyV = editMode ? loyaltyDraft : loyalty
  // Validation inline : pointsPerAmount ≥ 1 ET seuil Bronze < seuil Silver.
  const loyaltyErr = loyaltyDraft.pointsPerAmount < 1 || loyaltyDraft.bronzeThreshold >= loyaltyDraft.silverThreshold
  const startEdit = () => { setDraft(snapshot()); setFundInput(fromXOF(cfg.posDefaultFund).toFixed(decimals)); setLoyaltyDraft(loyalty); setEditMode(true) }
  const toggle = (key: keyof ReturnType<typeof snapshot>) => { if (!editMode) return; setDraft(p => ({ ...p, [key]: !(p as any)[key] })) }

  // Le mode TTC/HT est l'unique contrôle TVA (cf. sélecteur PRICE_MODES) ;
  // posVatIncluded est dérivé de priceMode à la sauvegarde (TTC → true, HT → false).
  const TOGGLES: { key: any; icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string> }[] = [
    { key: 'posAutoprint', icon: '🖨️', color: 'var(--p2)', label: { fr: 'Impression auto', en: 'Auto print', es: 'Impresión auto', it: 'Stampa auto' }, desc: { fr: 'Imprime le ticket après vente', en: 'Print receipt after sale', es: 'Imprimir ticket tras venta', it: 'Stampa ricevuta dopo vendita' } },
    { key: 'autoWhatsApp', icon: '💬', color: '#25D366', label: { fr: 'Ticket WhatsApp', en: 'WhatsApp receipt', es: 'Ticket WhatsApp', it: 'Ricevuta WhatsApp' }, desc: { fr: 'Envoie le ticket par WhatsApp', en: 'Send receipt via WhatsApp', es: 'Enviar ticket por WhatsApp', it: 'Invia ricevuta via WhatsApp' } },
    { key: 'enableAutoWhatsApp', icon: '🤖', color: '#25D366', label: { fr: 'Envoi auto WhatsApp', en: 'Auto WhatsApp send', es: 'Envío auto WhatsApp', it: 'Invio auto WhatsApp' }, desc: { fr: "Envoie auto le reçu après chaque vente. Nécessite un numéro client et une config Twilio par l'administrateur.", en: 'Auto-send the receipt after each sale. Requires a customer phone and Twilio config by the admin.', es: 'Envía auto el recibo tras cada venta. Requiere un teléfono del cliente y config Twilio del administrador.', it: 'Invia auto la ricevuta dopo ogni vendita. Richiede un telefono cliente e config Twilio dell\'amministratore.' } },
    { key: 'enableLoyalty', icon: '⭐', color: 'var(--warn)', label: { fr: 'Programme fidélité', en: 'Loyalty program', es: 'Programa fidelidad', it: 'Programma fedeltà' }, desc: { fr: 'Active les points de fidélité', en: 'Enable loyalty points', es: 'Activar puntos de fidelidad', it: 'Abilita punti fedeltà' } },
    { key: 'requireCashier', icon: '🔐', color: 'var(--acc3,#00B8FF)', label: { fr: 'Ouverture de caisse', en: 'Cashier open required', es: 'Apertura de caja', it: 'Apertura cassa' }, desc: { fr: 'Exiger l\'ouverture avant les ventes', en: 'Require opening before sales', es: 'Exigir apertura antes de ventas', it: 'Richiedi apertura prima delle vendite' } },
    { key: 'enableScanner', icon: '📷', color: 'var(--p3)', label: { fr: 'Scanner codes-barres', en: 'Barcode scanner', es: 'Escáner de códigos', it: 'Scanner codici' }, desc: { fr: 'Active le scanner intégré', en: 'Enable built-in scanner', es: 'Activar escáner integrado', it: 'Abilita scanner integrato' } },
  ]

  const PRICE_MODES: { id: 'TTC' | 'HT'; title: string; sub: string }[] = [
    { id: 'TTC', title: 'TTC', sub: i('Taxes incluses', 'Tax included', 'Impuestos incluidos', 'Tasse incluse') },
    { id: 'HT', title: 'HT', sub: i('Hors taxes', 'Excl. tax', 'Sin impuestos', 'Tasse escluse') },
  ]

  const save = async () => {
    // Garde validation fidélité (uniquement si le programme est activé).
    if (draft.enableLoyalty && loyaltyErr) {
      toast.error(i('Seuil Bronze doit être inférieur au Silver (et taux ≥ 1)', 'Bronze threshold must be below Silver (and rate ≥ 1)', 'El umbral Bronze debe ser menor que Silver (y tasa ≥ 1)', 'La soglia Bronze deve essere inferiore a Silver (e tasso ≥ 1)'))
      return
    }
    const fundXOF = toXOF(Number(fundInput) || 0)
    try {
      await tenantApi.update({
        posVatIncluded: draft.priceMode !== 'HT',   // dérivé du mode TTC/HT (contrôle unique)
        posAutoprint:   draft.posAutoprint,
        autoWhatsApp:   draft.autoWhatsApp,
        enableAutoWhatsApp: draft.enableAutoWhatsApp,
        enableLoyalty:  draft.enableLoyalty,
        requireCashier: draft.requireCashier,
        enableScanner:  draft.enableScanner,
        priceMode:      draft.priceMode,
        vatRate:        draft.posTaxRate,    // mapping → tenant.vatRate (single source of truth)
        posDefaultFund: fundXOF,
        // Config fidélité (n'envoyée que si le programme est actif).
        ...(draft.enableLoyalty ? {
          pointsPerAmount: loyaltyDraft.pointsPerAmount,
          bronzeThreshold: loyaltyDraft.bronzeThreshold,
          silverThreshold: loyaltyDraft.silverThreshold,
          bronzeDiscount:  loyaltyDraft.bronzeDiscount,
          silverDiscount:  loyaltyDraft.silverDiscount,
          goldDiscount:    loyaltyDraft.goldDiscount,
        } : {}),
      })
      cfg.updateConfig({ ...draft, posVatIncluded: draft.priceMode !== 'HT', posDefaultFund: fundXOF, shopVatRate: draft.posTaxRate } as any)
      if (draft.enableLoyalty) {
        setLoyalty(loyaltyDraft)
        // Reflète immédiatement dans le store (LoyaltyBar lit tenant.bronze/silver).
        const cur = useAppStore.getState().tenant
        if (cur) useAppStore.getState().setTenant({ ...cur, ...loyaltyDraft })
      }
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

          {/* Règles de fidélité — visibles uniquement si le programme est activé */}
          {v.enableLoyalty && (
            <div style={{ padding: '14px 16px', background: 'var(--bg3)', border: `1px solid ${editMode && loyaltyErr ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{i('Règles de fidélité', 'Loyalty rules', 'Reglas de fidelidad', 'Regole fedeltà')}</span>
              </div>

              {/* 1 point pour chaque X CURRENCY */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{i('1 point pour chaque', '1 point per', '1 punto por cada', '1 punto ogni')}</span>
                {editMode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={1} step={1} className="input" style={{ width: 110, textAlign: 'right' }} value={loyaltyDraft.pointsPerAmount}
                      onChange={e => setLoyaltyDraft(p => ({ ...p, pointsPerAmount: Math.max(1, Math.floor(+e.target.value || 0)) }))} />
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 'var(--fw-semibold)', minWidth: 40 }}>{symbol}</span>
                  </div>
                ) : <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{loyaltyV.pointsPerAmount} {symbol}</span>}
              </div>

              {/* Seuil Bronze */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>🥉 {i('Seuil Bronze', 'Bronze threshold', 'Umbral Bronze', 'Soglia Bronze')}</span>
                {editMode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={1} step={1} className="input" style={{ width: 110, textAlign: 'right' }} value={loyaltyDraft.bronzeThreshold}
                      onChange={e => setLoyaltyDraft(p => ({ ...p, bronzeThreshold: Math.max(1, Math.floor(+e.target.value || 0)) }))} />
                    <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 40 }}>pts</span>
                  </div>
                ) : <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{loyaltyV.bronzeThreshold} pts</span>}
              </div>

              {/* Seuil Silver */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>🥈 {i('Seuil Silver', 'Silver threshold', 'Umbral Silver', 'Soglia Silver')}</span>
                {editMode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={1} step={1} className="input" style={{ width: 110, textAlign: 'right' }} value={loyaltyDraft.silverThreshold}
                      onChange={e => setLoyaltyDraft(p => ({ ...p, silverThreshold: Math.max(1, Math.floor(+e.target.value || 0)) }))} />
                    <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 40 }}>pts</span>
                  </div>
                ) : <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{loyaltyV.silverThreshold} pts</span>}
              </div>

              {/* Remises par palier (v2 — 0 = désactivé) */}
              <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', marginTop: 4 }}>
                💳 {i('Remises automatiques par palier (0 = désactivé)', 'Automatic tier discounts (0 = off)', 'Descuentos automáticos por nivel (0 = desact.)', 'Sconti automatici per livello (0 = disatt.)')}
              </div>
              {[
                { key: 'bronzeDiscount' as const, label: '🥉 Bronze' },
                { key: 'silverDiscount' as const, label: '🥈 Silver' },
                { key: 'goldDiscount'   as const, label: '🥇 Gold'   },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
                  {editMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min={0} max={100} step={0.5} className="input" style={{ width: 80, textAlign: 'right' }} value={loyaltyDraft[key]}
                        onChange={e => setLoyaltyDraft(p => ({ ...p, [key]: Math.max(0, Math.min(100, +e.target.value || 0)) }))} />
                      <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 20 }}>%</span>
                    </div>
                  ) : <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', color: loyaltyV[key] > 0 ? 'var(--acc2)' : 'var(--text3)' }}>{loyaltyV[key] > 0 ? `${loyaltyV[key]} %` : i('désactivé', 'off', 'desact.', 'disatt.')}</span>}
                </div>
              ))}

              {/* Validation inline : bronze < silver */}
              {editMode && loyaltyErr && (
                <div style={{ fontSize: 11, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  ⚠️ {i('Le seuil Bronze doit être inférieur au seuil Silver.', 'Bronze threshold must be below Silver.', 'El umbral Bronze debe ser menor que Silver.', 'La soglia Bronze deve essere inferiore a Silver.')}
                </div>
              )}

              {/* Note non-rétroactif */}
              <div style={{ fontSize: 11, color: 'var(--text4)', fontStyle: 'italic' }}>
                {i("S'applique aux prochaines ventes uniquement.", 'Applies to future sales only.', 'Se aplica solo a ventas futuras.', 'Si applica solo alle vendite future.')}
              </div>
            </div>
          )}

          {/* Price mode (TTC / HT) */}
          <div style={{ display: 'flex', gap: 10 }}>
            {PRICE_MODES.map(m => (
              <button key={m.id} type="button" disabled={!editMode} onClick={() => editMode && setDraft(p => ({ ...p, priceMode: m.id }))}
                style={{ flex: 1, padding: 14, borderRadius: 12, cursor: editMode ? 'pointer' : 'default', opacity: editMode ? 1 : .7, textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s', background: v.priceMode === m.id ? 'rgba(108,71,255,.1)' : 'var(--bg3)', border: `2px solid ${v.priceMode === m.id ? 'var(--p)' : 'var(--border)'}` }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: v.priceMode === m.id ? 'var(--p3)' : 'var(--text)' }}>{m.title}{v.priceMode === m.id ? ' ✓' : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {/* VAT rate */}
          <div style={{ padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,149,0,.12)', border: '1px solid rgba(255,149,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{i('Taux de TVA', 'VAT Rate', 'Tasa IVA', 'Aliquota IVA')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Appliqué sur les ventes POS', 'Applied on POS sales', 'Aplicado en ventas TPV', 'Applicato sulle vendite POS')}</div>
              </div>
            </div>
            {editMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={0} max={100} step={0.5} className="input" style={{ width: 80, textAlign: 'right' }} value={draft.posTaxRate} onChange={e => setDraft(p => ({ ...p, posTaxRate: Math.max(0, Math.min(100, +e.target.value)) }))} />
                <span style={{ fontSize: 16, fontWeight: 'var(--fw-bold)', color: 'var(--acc)', width: 20 }}>%</span>
              </div>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{cfg.posTaxRate}%</div>
            )}
          </div>

          {/* Opening fund — currency dynamic */}
          <div style={{ padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💵</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{i('Fond de caisse', 'Opening fund', 'Fondo de caja', 'Fondo cassa')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Montant initial en caisse', 'Initial cash amount', 'Monto inicial en caja', 'Importo iniziale in cassa')}</div>
              </div>
            </div>
            {editMode ? (
              <div style={{ position: 'relative' }}>
                <input type="number" min={0} step={1} className="input" style={{ width: 150, textAlign: 'right', paddingRight: 44 }} value={fundInput} onChange={e => setFundInput(e.target.value)} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 11, pointerEvents: 'none', fontWeight: 'var(--fw-semibold)' }}>{symbol}</span>
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
