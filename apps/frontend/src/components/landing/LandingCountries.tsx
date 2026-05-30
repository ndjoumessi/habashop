import { D } from './landingShared'

interface Props {
  i: (fr: string, en: string, es: string, it: string) => string
}

export default function LandingCountries({ i }: Props) {

  return (
    <>
      <section aria-label={i('Pays disponibles', 'Available countries', 'Países disponibles', 'Paesi disponibili')} style={{ padding: '72px clamp(16px,4vw,80px)', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', marginBottom: 14, lineHeight: 1.2 }}>
            {i("Disponible dans toute l'Afrique francophone", 'Available across French-speaking Africa', 'Disponible en toda el África francófona', "Disponibile in tutta l'Africa francofona")}
          </h2>
          <p style={{ fontSize: 15, color: D.text2, maxWidth: 720, margin: '0 auto 36px', lineHeight: 1.7 }}>
            {i("HabaShop fonctionne au Sénégal, en Côte d'Ivoire, au Mali, au Burkina Faso, en Guinée, au Cameroun, au Congo, au Gabon, au Togo, au Bénin et dans plus de 150 pays.", "HabaShop works in Senegal, Côte d'Ivoire, Mali, Burkina Faso, Guinea, Cameroon, Congo, Gabon, Togo, Benin and 150+ countries.", 'HabaShop funciona en Senegal, Costa de Marfil, Malí, Burkina Faso, Guinea, Camerún, Congo, Gabón, Togo, Benín y más de 150 países.', "HabaShop funziona in Senegal, Costa d'Avorio, Mali, Burkina Faso, Guinea, Camerun, Congo, Gabon, Togo, Benin e oltre 150 paesi.")}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {([
              ['🇸🇳', i('Sénégal', 'Senegal', 'Senegal', 'Senegal')], ['🇨🇮', i("Côte d'Ivoire", "Côte d'Ivoire", 'Costa de Marfil', "Costa d'Avorio")], ['🇲🇱', i('Mali', 'Mali', 'Malí', 'Mali')], ['🇧🇫', i('Burkina Faso', 'Burkina Faso', 'Burkina Faso', 'Burkina Faso')], ['🇬🇳', i('Guinée', 'Guinea', 'Guinea', 'Guinea')],
              ['🇨🇲', i('Cameroun', 'Cameroon', 'Camerún', 'Camerun')], ['🇨🇬', i('Congo', 'Congo', 'Congo', 'Congo')], ['🇬🇦', i('Gabon', 'Gabon', 'Gabón', 'Gabon')], ['🇹🇬', i('Togo', 'Togo', 'Togo', 'Togo')], ['🇧🇯', i('Bénin', 'Benin', 'Benín', 'Benin')],
            ] as [string, string][]).map(([flag, name]) => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 99, fontSize: 14, fontWeight: 600, color: D.text2 }}>
                <span style={{ fontSize: 18 }}>{flag}</span>{name}
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 16px', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', borderRadius: 99, fontSize: 14, fontWeight: 700, color: D.p3 }}>
              + 140 {i('autres pays', 'more countries', 'otros países', 'altri paesi')}
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
