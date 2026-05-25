import { useState } from 'react'
import { useConfig } from '@/stores/appStore'
import { makeI, pick, panel } from '@/components/settings/settingsShared'
import SectionShop from '@/components/settings/SectionShop'
import SectionPOS from '@/components/settings/SectionPOS'
import SectionLang from '@/components/settings/SectionLang'
import SectionNotif from '@/components/settings/SectionNotif'
import SectionSecurity from '@/components/settings/SectionSecurity'
import SectionDocs from '@/components/settings/SectionDocs'

const SECTIONS = [
  { id: 'shop',     icon: '🏪', color: 'var(--p2)',    label: { fr: 'Boutique', en: 'Shop', es: 'Tienda', it: 'Negozio' },                          desc: { fr: 'Infos générales', en: 'General info', es: 'Info general', it: 'Info generali' } },
  { id: 'pos',      icon: '🛒', color: 'var(--acc2)',  label: { fr: 'Config POS', en: 'POS Config', es: 'Config TPV', it: 'Config POS' },           desc: { fr: 'Caisse & TVA', en: 'Cashier & VAT', es: 'Caja & IVA', it: 'Cassa & IVA' } },
  { id: 'lang',     icon: '🌍', color: 'var(--acc3,#00B8FF)', label: { fr: 'Langue & Devise', en: 'Language & Currency', es: 'Idioma & Divisa', it: 'Lingua & Valuta' }, desc: { fr: 'Localisation & thème', en: 'Localization & theme', es: 'Localización & tema', it: 'Localizzazione & tema' } },
  { id: 'notif',    icon: '🔔', color: 'var(--warn)',  label: { fr: 'Notifications', en: 'Notifications', es: 'Notificaciones', it: 'Notifiche' },  desc: { fr: 'Alertes & rapports', en: 'Alerts & reports', es: 'Alertas & reportes', it: 'Avvisi & rapporti' } },
  { id: 'security', icon: '🔒', color: 'var(--danger)', label: { fr: 'Sécurité', en: 'Security', es: 'Seguridad', it: 'Sicurezza' },               desc: { fr: 'Accès & sessions', en: 'Access & sessions', es: 'Acceso & sesiones', it: 'Accesso & sessioni' } },
  { id: 'docs',     icon: '📋', color: 'var(--acc)',   label: { fr: 'Documents', en: 'Documents', es: 'Documentos', it: 'Documenti' },              desc: { fr: 'Exports & config', en: 'Exports & config', es: 'Exportar & config', it: 'Esporta & config' } },
]

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const [activeSection, setActiveSection] = useState('shop')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
      {/* ── Navigation ── */}
      <div style={{ ...panel, position: 'sticky', top: 24 }}>
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(135deg,rgba(108,71,255,.08),transparent)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text3)', marginBottom: 3 }}>
            {i('Configuration', 'Configuration', 'Configuración', 'Configurazione')}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-.3px' }}>
            {i('Paramètres', 'Settings', 'Ajustes', 'Impostazioni')}
          </div>
        </div>
        <div style={{ padding: 8 }}>
          {SECTIONS.map(s => {
            const active = activeSection === s.id
            return (
              <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${active ? `${s.color}44` : 'transparent'}`, background: active ? `${s.color}12` : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s', marginBottom: 2 }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? `${s.color}20` : 'rgba(255,255,255,.05)', border: `1px solid ${active ? `${s.color}33` : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, transition: 'all .15s' }}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? s.color : 'var(--text2)', transition: 'color .15s' }}>{pick(lang, s.label)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{pick(lang, s.desc)}</div>
                </div>
                {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 6px ${s.color}` }} />}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🛒</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>HabaShop v2.0</div>
            <div style={{ fontSize: 9, color: 'var(--text4)' }}>Production · Railway + Vercel</div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {activeSection === 'shop'     && <SectionShop />}
        {activeSection === 'pos'      && <SectionPOS />}
        {activeSection === 'lang'     && <SectionLang />}
        {activeSection === 'notif'    && <SectionNotif />}
        {activeSection === 'security' && <SectionSecurity />}
        {activeSection === 'docs'     && <SectionDocs />}
      </div>
    </div>
  )
}
