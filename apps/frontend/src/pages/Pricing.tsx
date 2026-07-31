import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'

type L4 = 'fr' | 'en' | 'es' | 'it'

const PLANS = [
  {
    id: 'starter', icon: '🌱', color: '#22C77A', popular: false,
    price: { monthly: { XOF: 9900, EUR: 15, USD: 15 }, yearly: { XOF: 99000, EUR: 149, USD: 149 } },
    label: { fr: 'Starter', en: 'Starter', es: 'Starter', it: 'Starter' },
    desc: { fr: 'Parfait pour démarrer', en: 'Perfect to get started', es: 'Perfecto para empezar', it: 'Perfetto per iniziare' },
    features: {
      fr: ['✅ 1 utilisateur', '✅ 100 produits max', '✅ POS complet', '✅ Export CSV', "✅ 14 jours d'essai gratuit", '❌ Rapports avancés', '❌ Multi-utilisateurs', '❌ WhatsApp', '❌ Assistant IA'],
      en: ['✅ 1 user', '✅ Up to 100 products', '✅ Full POS', '✅ CSV export', '✅ 14-day free trial', '❌ Advanced reports', '❌ Multi-users', '❌ WhatsApp', '❌ AI assistant'],
      es: ['✅ 1 usuario', '✅ Hasta 100 productos', '✅ POS completo', '✅ Exportar CSV', '✅ Prueba gratis de 14 días', '❌ Informes avanzados', '❌ Multiusuario', '❌ WhatsApp', '❌ Asistente IA'],
      it: ['✅ 1 utente', '✅ Fino a 100 prodotti', '✅ POS completo', '✅ Esportazione CSV', '✅ Prova gratuita di 14 giorni', '❌ Report avanzati', '❌ Multiutente', '❌ WhatsApp', '❌ Assistente IA'],
    },
    cta: { fr: 'Commencer gratuitement', en: 'Start for free', es: 'Empezar gratis', it: 'Inizia gratis' },
  },
  {
    id: 'pro', icon: '⚡', color: '#6C47FF', popular: true,
    price: { monthly: { XOF: 24900, EUR: 38, USD: 38 }, yearly: { XOF: 249000, EUR: 379, USD: 379 } },
    label: { fr: 'Pro', en: 'Pro', es: 'Pro', it: 'Pro' },
    desc: { fr: 'Pour les boutiques en croissance', en: 'For growing businesses', es: 'Para negocios en crecimiento', it: 'Per le attività in crescita' },
    features: {
      fr: ['✅ 5 utilisateurs', '✅ Produits illimités', '✅ POS complet', '✅ Export CSV + PDF', '✅ Rapports avancés', '✅ WhatsApp notifications', '✅ Analytics dashboard', '✅ Multi-devises', '❌ Assistant IA'],
      en: ['✅ 5 users', '✅ Unlimited products', '✅ Full POS', '✅ CSV + PDF export', '✅ Advanced reports', '✅ WhatsApp notifications', '✅ Analytics dashboard', '✅ Multi-currency', '❌ AI assistant'],
      es: ['✅ 5 usuarios', '✅ Productos ilimitados', '✅ POS completo', '✅ Exportar CSV + PDF', '✅ Informes avanzados', '✅ Notificaciones WhatsApp', '✅ Panel de analíticas', '✅ Multidivisa', '❌ Asistente IA'],
      it: ['✅ 5 utenti', '✅ Prodotti illimitati', '✅ POS completo', '✅ Esportazione CSV + PDF', '✅ Report avanzati', '✅ Notifiche WhatsApp', '✅ Dashboard analitica', '✅ Multivaluta', '❌ Assistente IA'],
    },
    cta: { fr: 'Essayer Pro 14 jours', en: 'Try Pro 14 days', es: 'Probar Pro 14 días', it: 'Prova Pro 14 giorni' },
  },
  {
    id: 'enterprise', icon: '🏢', color: '#FFB020', popular: false,
    price: { monthly: { XOF: 49900, EUR: 76, USD: 76 }, yearly: { XOF: 499000, EUR: 759, USD: 759 } },
    label: { fr: 'Enterprise', en: 'Enterprise', es: 'Enterprise', it: 'Enterprise' },
    desc: { fr: 'Pour les grandes enseignes', en: 'For large businesses', es: 'Para grandes empresas', it: 'Per grandi aziende' },
    features: {
      fr: ['✅ Utilisateurs illimités', '✅ Produits illimités', '✅ POS multi-caisse', '✅ Export CSV + PDF', '✅ Rapports avancés', '✅ WhatsApp premium', '✅ Analytics complets', '✅ Assistant IA inclus', '✅ Support prioritaire'],
      en: ['✅ Unlimited users', '✅ Unlimited products', '✅ Multi-register POS', '✅ CSV + PDF export', '✅ Advanced reports', '✅ Premium WhatsApp', '✅ Full analytics', '✅ AI assistant included', '✅ Priority support'],
      es: ['✅ Usuarios ilimitados', '✅ Productos ilimitados', '✅ POS multicaja', '✅ Exportar CSV + PDF', '✅ Informes avanzados', '✅ WhatsApp premium', '✅ Analíticas completas', '✅ Asistente IA incluido', '✅ Soporte prioritario'],
      it: ['✅ Utenti illimitati', '✅ Prodotti illimitati', '✅ POS multicassa', '✅ Esportazione CSV + PDF', '✅ Report avanzati', '✅ WhatsApp premium', '✅ Analitica completa', '✅ Assistente IA incluso', '✅ Supporto prioritario'],
    },
    cta: { fr: 'Contacter les ventes', en: 'Contact sales', es: 'Contactar ventas', it: 'Contatta vendite' },
  },
]

const FAQ = [
  {
    q: { fr: 'Puis-je changer de plan à tout moment ?', en: 'Can I change my plan at any time?', es: '¿Puedo cambiar de plan en cualquier momento?', it: 'Posso cambiare piano in qualsiasi momento?' },
    a: { fr: 'Oui, vous pouvez upgrader ou downgrader à tout moment.', en: 'Yes, you can upgrade or downgrade at any time.', es: 'Sí, puede actualizar o degradar en cualquier momento.', it: 'Sì, puoi aggiornare o declassare in qualsiasi momento.' },
  },
  {
    q: { fr: 'Y a-t-il un contrat minimum ?', en: 'Is there a minimum contract?', es: '¿Hay un contrato mínimo?', it: "C'è un contratto minimo?" },
    a: { fr: 'Non, sans engagement. Annulez quand vous voulez.', en: 'No commitment. Cancel whenever you want.', es: 'Sin compromiso. Cancela cuando quieras.', it: 'Nessun impegno. Annulla quando vuoi.' },
  },
  {
    q: { fr: 'Mes données sont-elles sécurisées ?', en: 'Is my data secure?', es: '¿Están mis datos seguros?', it: 'I miei dati sono al sicuro?' },
    a: { fr: 'Oui, chaque boutique est isolée. Hébergé avec SSL.', en: 'Yes, each shop is isolated. Hosted with SSL.', es: 'Sí, cada tienda está aislada. Alojado con SSL.', it: 'Sì, ogni negozio è isolato. Ospitato con SSL.' },
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 8, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'var(--font)', textAlign: 'left' }}>
        {q}
        <span style={{ color: 'var(--text3)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && <div style={{ padding: '0 18px 14px', fontSize: 'var(--fs-label)', color: 'var(--text3)', lineHeight: 1.6 }}>{a}</div>}
    </div>
  )
}

export default function Pricing() {
  const navigate = useNavigate()
  const lang = useAppStore(s => s.lang) as L4
  const currency = useAppStore(s => s.currency)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const { i } = useI18n()

  const handleCTA = (planId: string) => {
    if (planId === 'enterprise') { window.open('mailto:contact@habashop.com', '_blank'); return }
    const loggedIn = !!localStorage.getItem('habashop_token')
    navigate(loggedIn ? `/app/upgrade?plan=${planId}` : `/signup?plan=${planId}`)
  }

  // Map display currency to one of the priced currencies (+ symbol)
  const priceKey: 'XOF' | 'EUR' | 'USD' = currency === 'EUR' || currency === 'GBP' ? 'EUR' : currency === 'USD' || currency === 'CAD' ? 'USD' : 'XOF'
  const symbol = priceKey === 'EUR' ? '€' : priceKey === 'USD' ? '$' : 'FCFA'

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0A0C14,#0D1019,#11151F)', fontFamily: 'var(--font)', padding: '60px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <button type="button" onClick={() => navigate('/')} style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 14px', color: 'var(--text2)', fontSize: 'var(--fs-label)', cursor: 'pointer', fontFamily: 'var(--font)' }}>← {i('Accueil', 'Home', 'Inicio', 'Home')}</button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 14px', borderRadius: 99, background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.2)' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--p3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{i('TARIFS SIMPLES ET TRANSPARENTS', 'SIMPLE & TRANSPARENT PRICING', 'PRECIOS SIMPLES Y TRANSPARENTES', 'PREZZI SEMPLICI E TRASPARENTI')}</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#EAEEF6', letterSpacing: '-1px', marginBottom: 12, lineHeight: 1.15 }}>{i('Choisissez votre plan', 'Choose your plan', 'Elige tu plan', 'Scegli il tuo piano')}</h1>
        <p style={{ fontSize: 'var(--fs-title)', color: 'var(--text3)', maxWidth: 480, margin: '0 auto 24px' }}>{i('Commencez gratuitement. Évoluez selon vos besoins.', 'Start for free. Scale as you grow.', 'Empieza gratis. Crece según tus necesidades.', 'Inizia gratis. Cresci secondo le tue esigenze.')}</p>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 4, gap: 4 }}>
          {([{ id: 'monthly', label: i('Mensuel', 'Monthly', 'Mensual', 'Mensile') }, { id: 'yearly', label: i('Annuel -20%', 'Yearly -20%', 'Anual -20%', 'Annuale -20%') }] as const).map(p => (
            <button key={p.id} type="button" onClick={() => setBilling(p.id)}
              style={{ padding: '8px 20px', borderRadius: 9, background: billing === p.id ? 'linear-gradient(135deg,#6C47FF,#8B6FFF)' : 'transparent', border: 'none', cursor: 'pointer', color: billing === p.id ? '#fff' : 'var(--text3)', fontSize: 'var(--fs-label)', fontWeight: 700, fontFamily: 'var(--font)', transition: 'all .2s' }}>{p.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, maxWidth: 960, margin: '0 auto 40px' }}>
        {PLANS.map(plan => {
          const displayPrice = (plan.price[billing] as Record<string, number>)[priceKey]
          const features = plan.features[lang === 'en' ? 'en' : lang === 'es' ? 'es' : lang === 'it' ? 'it' : 'fr'] ?? plan.features.en
          return (
            <div key={plan.id} style={{ background: plan.popular ? 'linear-gradient(160deg,#0D1019,#161C2B)' : 'linear-gradient(160deg,#0D1019,#11151F)', border: `${plan.popular ? '2' : '1'}px solid ${plan.popular ? 'rgba(108,71,255,.4)' : 'rgba(255,255,255,.07)'}`, borderRadius: 24, overflow: 'hidden', position: 'relative', boxShadow: plan.popular ? '0 24px 64px rgba(108,71,255,.2)' : 'none' }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', padding: 7, background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)', fontSize: 'var(--fs-caption)', fontWeight: 800, color: '#fff', letterSpacing: '.3px' }}>⚡ {i('PLUS POPULAIRE', 'MOST POPULAR', 'MÁS POPULAR', 'PIÙ POPOLARE')}</div>
              )}
              <div style={{ padding: `${plan.popular ? '48px' : '28px'} 28px 28px` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: `${plan.color}20`, border: `1px solid ${plan.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-2xl)' }}>{plan.icon}</div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#EAEEF6' }}>{plan.label[lang] ?? plan.label.fr}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{plan.desc[lang] ?? plan.desc.fr}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: plan.color, fontFamily: 'var(--mono)' }}>{displayPrice.toLocaleString('fr-FR')}</span>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text3)' }}>{symbol}</span>
                  <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginLeft: 2 }}>/{billing === 'yearly' ? i('an', 'yr', 'año', 'anno') : i('mois', 'mo', 'mes', 'mese')}</span>
                </div>
                {billing === 'yearly' && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--acc2)', marginBottom: 20 }}>🎁 {i('2 mois offerts !', '2 months free!', '¡2 meses gratis!', '2 mesi gratis!')}</div>}
                <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 7, marginTop: billing === 'yearly' ? 0 : 14 }}>
                  {features.map((f, idx) => (
                    <div key={idx} style={{ fontSize: 'var(--fs-label)', color: f.startsWith('✅') ? 'var(--text2)' : 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', gap: 6 }}>{f}</div>
                  ))}
                </div>
                <button onClick={() => handleCTA(plan.id)}
                  style={{ width: '100%', padding: 13, borderRadius: 12, background: plan.popular ? 'linear-gradient(135deg,#6C47FF,#8B6FFF)' : `${plan.color}18`, border: `1px solid ${plan.color}${plan.popular ? '00' : '44'}`, cursor: 'pointer', color: plan.popular ? '#fff' : plan.color, fontSize: 'var(--fs-sm)', fontWeight: 800, fontFamily: 'var(--font)', transition: 'all .2s', boxShadow: plan.popular ? '0 8px 24px rgba(108,71,255,.35)' : 'none' }}>{plan.cta[lang] ?? plan.cta.fr}</button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#EAEEF6', textAlign: 'center', marginBottom: 20 }}>{i('Questions fréquentes', 'FAQ', 'Preguntas frecuentes', 'Domande frequenti')}</h2>
        {FAQ.map((item, idx) => <FaqItem key={idx} q={item.q[lang] ?? item.q.fr} a={item.a[lang] ?? item.a.fr} />)}
      </div>
    </div>
  )
}
