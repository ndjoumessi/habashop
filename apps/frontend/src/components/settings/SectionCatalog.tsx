import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Copy, ExternalLink, Share2, AlertTriangle, MessageCircle, Eye, EyeOff, Check, Link2, Pencil } from 'lucide-react'
import { useConfig } from '@/stores/appStore'
import { tenantApi } from '@/lib/api'
import { makeI, panel, Head } from '@/components/settings/settingsShared'

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/
const RESERVED = new Set(['login','signup','pricing','privacy','terms','app','api','admin','about','contact','help','support','blog','docs','shop','public','static','assets','c','catalog','catalogue','onboarding','settings','dashboard'])

export default function SectionCatalog() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenant, setTenant] = useState<{ id: string; name: string; slug: string | null; description: string | null; whatsappPhone: string | null; phone: string | null; catalogVisible: boolean } | null>(null)
  const [form, setForm] = useState({ slug: '', description: '', whatsappPhone: '', catalogVisible: true })
  const [copied, setCopied] = useState(false)
  const [slugErr, setSlugErr] = useState<string | null>(null)

  useEffect(() => {
    tenantApi.get()
      .then((d: any) => {
        if (!d) return
        setTenant(d)
        setForm({
          slug: d.slug ?? '',
          description: d.description ?? '',
          whatsappPhone: d.whatsappPhone ?? '',
          catalogVisible: d.catalogVisible !== false,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://habashop.vercel.app'
  const fullUrl = form.slug ? `${baseUrl}/c/${form.slug}` : null

  const validateSlugClient = (s: string): string | null => {
    if (!s) return i('Slug requis', 'Slug required', 'Slug requerido', 'Slug richiesto')
    if (RESERVED.has(s)) return i('Ce nom est réservé', 'This name is reserved', 'Este nombre está reservado', 'Questo nome è riservato')
    if (!SLUG_REGEX.test(s) || s.length < 3 || s.length > 50) {
      return i('3-50 caractères : minuscules, chiffres, tirets (pas en début/fin)', '3-50 chars: lowercase, digits, hyphens (not at start/end)', '3-50 caracteres: minúsculas, dígitos, guiones (no al inicio/fin)', '3-50 caratteri: minuscole, cifre, trattini (non a inizio/fine)')
    }
    return null
  }

  const saveSlug = async () => {
    const err = validateSlugClient(form.slug)
    if (err) { setSlugErr(err); toast.error(err); return }
    setSaving(true)
    try {
      const updated = await tenantApi.setSlug(form.slug)
      setTenant(t => t ? { ...t, slug: updated.slug } : t)
      setSlugErr(null)
      toast.success(i('Lien mis à jour', 'Link updated', 'Enlace actualizado', 'Link aggiornato'))
    } catch (e: any) {
      const msg = String(e?.message ?? '')
      if (/déjà pris|already/i.test(msg)) toast.error(i('Ce lien est déjà pris', 'This link is already taken', 'Este enlace ya está en uso', 'Questo link è già preso'))
      else toast.error(msg || i('Erreur', 'Error', 'Error', 'Errore'))
    } finally { setSaving(false) }
  }

  const saveOther = async (patch: Partial<typeof form>) => {
    setSaving(true)
    try {
      await tenantApi.update(patch)
      setTenant(t => t ? { ...t, ...patch } : t)
      toast.success(i('Sauvegardé', 'Saved', 'Guardado', 'Salvato'))
    } catch (e: any) { toast.error(e?.message ?? 'Erreur') }
    finally { setSaving(false) }
  }

  const copyLink = async () => {
    if (!fullUrl) return
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast.success(i('Lien copié', 'Link copied', 'Enlace copiado', 'Link copiato'))
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error(i('Copie impossible', 'Cannot copy', 'No se pudo copiar', 'Impossibile copiare')) }
  }

  const shareLink = async () => {
    if (!fullUrl || !tenant) return
    const text = i(
      `Découvrez le catalogue de ${tenant.name} : ${fullUrl}`,
      `Discover ${tenant.name}'s catalog: ${fullUrl}`,
      `Descubre el catálogo de ${tenant.name}: ${fullUrl}`,
      `Scopri il catalogo di ${tenant.name}: ${fullUrl}`,
    )
    if (navigator.share) {
      try { await navigator.share({ title: tenant.name, text, url: fullUrl }) } catch {}
    } else {
      // Fallback : wa.me text-only (sans destinataire — l'utilisateur choisit dans WhatsApp)
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    }
  }

  if (loading) return <div style={panel}><p style={{ color:'var(--text3)', padding:20 }}>{i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</p></div>
  if (!tenant) return <div style={panel}><p style={{ color:'var(--danger)', padding:20 }}>{i('Boutique introuvable', 'Shop not found', 'Tienda no encontrada', 'Negozio non trovato')}</p></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* ── État du catalogue ── */}
      <div style={panel}>
        <Head icon={form.catalogVisible ? <Eye size={16} /> : <EyeOff size={16} />} title={i('État du catalogue', 'Catalog status', 'Estado del catálogo', 'Stato del catalogo')} sub={i('Activez pour rendre votre catalogue visible publiquement', 'Enable to make your catalog publicly visible', 'Active para hacer su catálogo visible públicamente', 'Attiva per rendere il tuo catalogo pubblicamente visibile')} tint="#25D366" />
        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderTop:'1px solid var(--border)', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {form.catalogVisible ? <Eye size={16} style={{ color:'var(--acc2)' }} /> : <EyeOff size={16} style={{ color:'var(--text3)' }} />}
            <span style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-regular)', color:'var(--text)' }}>
              {form.catalogVisible ? i('Catalogue public actif', 'Public catalog active', 'Catálogo público activo', 'Catalogo pubblico attivo') : i('Catalogue désactivé', 'Catalog disabled', 'Catálogo desactivado', 'Catalogo disattivato')}
            </span>
          </div>
          <input type="checkbox" checked={form.catalogVisible}
            aria-label={i('Activer le catalogue public', 'Enable public catalog', 'Activar el catálogo público', 'Attiva il catalogo pubblico')}
            onChange={e => { const v = e.target.checked; setForm(f => ({ ...f, catalogVisible: v })); saveOther({ catalogVisible: v }) }}
            disabled={saving}
            style={{ width:18, height:18, accentColor:'var(--p)', cursor:'pointer' }} />
        </label>
      </div>

      {/* ── Lien du catalogue ── */}
      <div style={panel}>
        <Head icon={<Link2 size={16} />} title={i('Lien du catalogue', 'Catalog link', 'Enlace del catálogo', 'Link del catalogo')} sub={i('URL publique à partager avec vos clients', 'Public URL to share with your customers', 'URL pública para compartir con sus clientes', 'URL pubblico da condividere con i clienti')} tint="var(--p2)" />
        <div style={{ padding:'14px 16px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:12 }}>
          {/* Slug edit */}
          <div>
            <label style={{ display:'block', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>
              {i('Personnaliser le lien', 'Customize link', 'Personalizar enlace', 'Personalizza link')}
            </label>
            <div style={{ display:'flex', alignItems:'stretch', gap:0, background:'var(--bg3)', border:`1.5px solid ${slugErr ? 'var(--danger)' : 'var(--border)'}`, borderRadius:8, overflow:'hidden' }}>
              <span style={{ display:'flex', alignItems:'center', padding:'8px 10px', fontSize:'var(--fs-label)', color:'var(--text3)', fontFamily:'var(--mono)', background:'var(--bg4)', whiteSpace:'nowrap' }}>
                {baseUrl.replace(/^https?:\/\//, '')}/c/
              </span>
              <input type="text" value={form.slug}
                aria-label={i("Identifiant de la boutique (slug du catalogue)", 'Shop identifier (catalog slug)', 'Identificador de la tienda (slug del catálogo)', 'Identificatore del negozio (slug del catalogo)')}
                onChange={e => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); setForm(f => ({ ...f, slug: v })); setSlugErr(validateSlugClient(v)) }}
                placeholder="ma-boutique"
                style={{ flex:1, padding:'8px 10px', fontSize:'var(--fs-sm)', background:'transparent', border:'none', color:'var(--text)', fontFamily:'var(--mono)', outline:'none' }} />
              <button onClick={saveSlug} disabled={saving || !!slugErr || form.slug === tenant.slug} style={{ padding:'8px 14px', background: (saving || !!slugErr || form.slug === tenant.slug) ? 'var(--bg4)' : 'var(--p)', color:'#fff', border:'none', cursor: (saving || !!slugErr || form.slug === tenant.slug) ? 'not-allowed' : 'pointer', fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', fontFamily:'inherit' }}>
                {i('Enregistrer', 'Save', 'Guardar', 'Salva')}
              </button>
            </div>
            {slugErr && <div style={{ marginTop:6, fontSize:'var(--fs-caption)', color:'var(--danger)' }}>⚠️ {slugErr}</div>}
            {!slugErr && tenant.slug && tenant.slug !== form.slug && (
              <div style={{ marginTop:6, padding:'6px 10px', borderRadius:6, background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.25)', fontSize:'var(--fs-caption)', color:'var(--warn)', display:'flex', alignItems:'flex-start', gap:6 }}>
                <AlertTriangle size={11} style={{ marginTop:1, flexShrink:0 }} />
                <span>{i('Modifier le lien invalidera vos anciens liens partagés', 'Changing the link will invalidate previously shared links', 'Cambiar el enlace invalidará los enlaces compartidos anteriormente', 'Cambiare il link invaliderà i link condivisi in precedenza')}</span>
              </div>
            )}
          </div>

          {/* URL + actions */}
          {fullUrl && (
            <>
              <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                <span style={{ flex:1, fontSize:'var(--fs-label)', fontFamily:'var(--mono)', color:'var(--p2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fullUrl}</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={copyLink} className="topbar-btn" style={{ flex:1, minWidth:140, justifyContent:'center' }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? i('Copié !', 'Copied!', '¡Copiado!', 'Copiato!') : i('Copier', 'Copy', 'Copiar', 'Copia')}
                </button>
                <button
                  onClick={() => window.open(`${fullUrl}?v=${Date.now()}`, '_blank', 'noopener,noreferrer')}
                  className="topbar-btn"
                  style={{ flex:1, minWidth:140, justifyContent:'center' }}
                  title={i('Ouvre le catalogue avec les données fraîches', 'Opens catalog with fresh data', 'Abre el catálogo con datos frescos', 'Apre il catalogo con dati freschi')}
                >
                  <ExternalLink size={13} /> {i('Voir', 'View', 'Ver', 'Vedi')}
                </button>
                <button onClick={shareLink} className="topbar-btn" style={{ flex:1, minWidth:140, justifyContent:'center', background:'rgba(37,211,102,.12)', color:'#25D366', borderColor:'rgba(37,211,102,.3)' }}>
                  <Share2 size={13} /> {i('Partager', 'Share', 'Compartir', 'Condividi')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Description boutique ── */}
      <div style={panel}>
        <Head icon={<Pencil size={16} />} title={i('Description', 'Description', 'Descripción', 'Descrizione')} sub={i('Tagline affichée en haut du catalogue', 'Tagline displayed at the top of the catalog', 'Eslogan mostrado en la parte superior del catálogo', 'Slogan mostrato in cima al catalogo')} tint="var(--acc)" />
        <div style={{ padding:'14px 16px', borderTop:'1px solid var(--border)' }}>
          <textarea value={form.description}
            aria-label={i('Description du catalogue', 'Catalog description', 'Descripción del catálogo', 'Descrizione del catalogo')}
            onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 200) }))}
            onBlur={() => { if (form.description !== (tenant.description ?? '')) saveOther({ description: form.description }) }}
            placeholder={i('Ex : Supérette Yoff — fruits & légumes frais du marché', 'E.g.: Yoff Supermarket — fresh fruits & vegetables from the market', 'Ej: Supermercado Yoff — frutas y verduras frescas del mercado', 'Es: Supermercato Yoff — frutta e verdura fresca del mercato')}
            maxLength={200}
            rows={2}
            style={{ width:'100%', padding:'10px 12px', fontSize:'var(--fs-sm)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontFamily:'inherit', resize:'vertical', minHeight:60 }} />
          <div style={{ marginTop:4, textAlign:'right', fontSize:'var(--fs-caption)', color:'var(--text3)', fontFamily:'var(--mono)' }}>{form.description.length} / 200</div>
        </div>
      </div>

      {/* ── WhatsApp commercial ── */}
      <div style={panel}>
        <Head icon={<MessageCircle size={16} />} title={i('WhatsApp commercial', 'Sales WhatsApp', 'WhatsApp comercial', 'WhatsApp commerciale')} sub={i('Numéro qui recevra les commandes via le catalogue', 'Number that will receive orders via the catalog', 'Número que recibirá pedidos a través del catálogo', 'Numero che riceverà gli ordini tramite il catalogo')} tint="#25D366" />
        <div style={{ padding:'14px 16px', borderTop:'1px solid var(--border)' }}>
          <input type="tel" value={form.whatsappPhone}
            aria-label={i('Numéro WhatsApp commercial', 'Sales WhatsApp number', 'Número de WhatsApp comercial', 'Numero WhatsApp commerciale')}
            onChange={e => setForm(f => ({ ...f, whatsappPhone: e.target.value }))}
            onBlur={() => { if (form.whatsappPhone !== (tenant.whatsappPhone ?? '')) saveOther({ whatsappPhone: form.whatsappPhone }) }}
            placeholder="+221 77 123 45 67"
            style={{ width:'100%', padding:'10px 12px', fontSize:'var(--fs-body)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontFamily:'var(--mono)' }} />
          <div style={{ marginTop:6, fontSize:'var(--fs-caption)', color:'var(--text3)' }}>
            <MessageCircle size={11} style={{ verticalAlign:'middle', marginRight:4 }} />
            {!form.whatsappPhone && tenant.phone
              ? i(`Vide → fallback sur votre téléphone principal : ${tenant.phone}`, `Empty → fallback to your main phone: ${tenant.phone}`, `Vacío → respaldo a su teléfono principal: ${tenant.phone}`, `Vuoto → fallback al telefono principale: ${tenant.phone}`)
              : i('Format international recommandé (+221 77...)', 'International format recommended (+221 77...)', 'Formato internacional recomendado (+221 77...)', 'Formato internazionale consigliato (+221 77...)')}
          </div>
        </div>
      </div>
    </div>
  )
}
