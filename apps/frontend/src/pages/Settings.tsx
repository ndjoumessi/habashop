import { useState } from 'react'
import { useConfig } from '@/stores/appStore'
import { makeI, pick } from '@/components/settings/settingsShared'
import { Store, ShoppingCart, Globe, Bell, Lock, FileText, Share2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SectionShop from '@/components/settings/SectionShop'
import SectionPOS from '@/components/settings/SectionPOS'
import SectionLang from '@/components/settings/SectionLang'
import SectionNotif from '@/components/settings/SectionNotif'
import SectionSecurity from '@/components/settings/SectionSecurity'
import SectionDocs from '@/components/settings/SectionDocs'
import SectionCatalog from '@/components/settings/SectionCatalog'

type SectionId = 'shop' | 'pos' | 'catalog' | 'lang' | 'notif' | 'security' | 'docs'

interface SectionDef {
  id:    SectionId
  Icon:  LucideIcon
  color: string
  label: { fr: string; en: string; es: string; it: string }
  desc:  { fr: string; en: string; es: string; it: string }
}

const SECTIONS: SectionDef[] = [
  { id: 'shop',     Icon: Store,        color: 'var(--p2)',           label: { fr: 'Boutique',         en: 'Shop',                es: 'Tienda',             it: 'Negozio'             }, desc: { fr: 'Infos générales',     en: 'General info',     es: 'Info general',     it: 'Info generali'      } },
  { id: 'pos',      Icon: ShoppingCart, color: 'var(--acc2)',         label: { fr: 'Config POS',       en: 'POS Config',          es: 'Config TPV',         it: 'Config POS'          }, desc: { fr: 'Caisse & TVA',        en: 'Cashier & VAT',    es: 'Caja & IVA',       it: 'Cassa & IVA'        } },
  { id: 'catalog',  Icon: Share2,       color: '#25D366',             label: { fr: 'Catalogue WhatsApp', en: 'WhatsApp Catalog',  es: 'Catálogo WhatsApp',  it: 'Catalogo WhatsApp'   }, desc: { fr: 'Lien public partageable', en: 'Public shareable link', es: 'Enlace público compartible', it: 'Link pubblico condivisibile' } },
  { id: 'lang',     Icon: Globe,        color: 'var(--acc3,#00B8FF)', label: { fr: 'Langue & Devise',  en: 'Language & Currency', es: 'Idioma & Divisa',    it: 'Lingua & Valuta'     }, desc: { fr: 'Localisation & thème',en: 'Localization & theme', es: 'Localización & tema', it: 'Localizzazione & tema' } },
  { id: 'notif',    Icon: Bell,         color: 'var(--warn)',         label: { fr: 'Notifications',    en: 'Notifications',       es: 'Notificaciones',     it: 'Notifiche'           }, desc: { fr: 'Alertes & rapports',  en: 'Alerts & reports', es: 'Alertas & reportes',it: 'Avvisi & rapporti'  } },
  { id: 'security', Icon: Lock,         color: 'var(--danger)',       label: { fr: 'Sécurité',         en: 'Security',            es: 'Seguridad',          it: 'Sicurezza'           }, desc: { fr: 'Accès & sessions',    en: 'Access & sessions', es: 'Acceso & sesiones',it: 'Accesso & sessioni' } },
  { id: 'docs',     Icon: FileText,     color: 'var(--acc)',          label: { fr: 'Documents',        en: 'Documents',           es: 'Documentos',         it: 'Documenti'           }, desc: { fr: 'Exports & config',    en: 'Exports & config', es: 'Exportar & config',it: 'Esporta & config'   } },
]

export default function Settings() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const [activeSection, setActiveSection] = useState<SectionId>('shop')
  const active = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0]
  const ActiveIcon = active.Icon

  return (
    <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── Sidebar navigation ── */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'sticky',
        top: 24,
      }}>
        {/* Header compact */}
        <div style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 'var(--fw-semibold)', letterSpacing: 1,
            color: 'var(--text3)', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {i('Paramètres', 'Settings', 'Configuración', 'Impostazioni')}
          </div>
        </div>

        {/* Items navigation */}
        <div style={{ padding: 8 }}>
          {SECTIONS.map(s => {
            const isActive = s.id === activeSection
            const SectionIcon = s.Icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 14px', borderRadius: 10,
                  border: 'none',
                  background: isActive ? `${s.color}18` : 'transparent',
                  color: isActive ? s.color : 'var(--text)',
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  textAlign: 'left',
                  marginBottom: 2,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <SectionIcon size={16} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)' }}>{pick(lang, s.label)}</div>
                  <div style={{
                    fontSize: 11,
                    color: isActive ? s.color : 'var(--text3)',
                    opacity: isActive ? 0.75 : 1,
                    marginTop: 1,
                  }}>{pick(lang, s.desc)}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer version discret */}
        <div style={{
          padding: '12px 16px',
          fontSize: 11, color: 'var(--text3)',
          borderTop: '1px solid var(--border)',
        }}>
          v2.0 · Railway + Vercel
        </div>
      </div>

      {/* ── Zone contenu ── */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Header de section */}
        <div style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${active.color}15`,
              border: `1px solid ${active.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ActiveIcon size={20} color={active.color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                fontSize: 20, fontWeight: 'var(--fw-bold)',
                color: 'var(--text)', margin: 0, lineHeight: 1.2,
              }}>{pick(lang, active.label)}</h2>
              <p style={{
                fontSize: 13, color: 'var(--text2)',
                margin: 0, marginTop: 2,
              }}>{pick(lang, active.desc)}</p>
            </div>
          </div>
        </div>

        {/* Contenu de la section active */}
        <div style={{
          padding: '24px 32px 32px',
          maxWidth: 880,
        }}>
          {activeSection === 'shop'     && <SectionShop />}
          {activeSection === 'pos'      && <SectionPOS />}
          {activeSection === 'catalog'  && <SectionCatalog />}
          {activeSection === 'lang'     && <SectionLang />}
          {activeSection === 'notif'    && <SectionNotif />}
          {activeSection === 'security' && <SectionSecurity />}
          {activeSection === 'docs'     && <SectionDocs />}
        </div>
      </div>
    </div>
  )
}
