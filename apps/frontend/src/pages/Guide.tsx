import { useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { GUIDE_SECTIONS } from '@/content/guide'
import type { GuideLang } from '@/content/guide/types'
import { copyrightLine } from '@/lib/publicYear'

/**
 * MANUEL D'UTILISATION — page publique.
 *
 * ⚠️ Les ancres (`section.id`) ne sont pas traduites : un lien partagé doit rester valide
 * quelle que soit la langue du lecteur.
 *
 * ⚠️ Sommaire ET sections dérivent de `GUIDE_SECTIONS` — deux listes divergeraient, et c'est
 * le sommaire qui mentirait.
 *
 * ⚠️ Le contenu ne décrit QUE des capacités ✅ du CDC v4 (cf. `content/guide/types.ts`).
 */
export default function Guide() {
  const { lang } = useI18n()
  const l = lang as GuideLang

  const titrePage = { fr: 'Manuel d’utilisation', en: 'User guide', es: 'Manual de uso', it: 'Manuale d’uso' }[l]
  const sommaire = { fr: 'Sommaire', en: 'Contents', es: 'Índice', it: 'Indice' }[l]
  const retour = { fr: '← Retour à HabaShop', en: '← Back to HabaShop', es: '← Volver a HabaShop', it: '← Torna a HabaShop' }[l]
  const chapeau = {
    fr: 'Comment se servir d’HabaShop au quotidien, écran par écran.',
    en: 'How to use HabaShop day to day, screen by screen.',
    es: 'Cómo usar HabaShop en el día a día, pantalla por pantalla.',
    it: 'Come usare HabaShop ogni giorno, schermata per schermata.',
  }[l]

  useEffect(() => { document.title = `${titrePage} — HabaShop` }, [titrePage])

  return (
    <div className="legal-doc" style={{ maxWidth: 820, margin: '0 auto', padding: '40px 16px', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ textDecoration: 'none', fontSize: 'var(--fs-body)' }}>{retour}</a>
      </div>

      <h1 style={{ marginBottom: 8 }}>{titrePage}</h1>
      <p className="legal-muted" style={{ marginBottom: 36 }}>{chapeau}</p>

      <nav aria-label={sommaire} style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 'var(--fs-body)', marginBottom: 10 }}>{sommaire}</h2>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {GUIDE_SECTIONS.map(s => (
            <li key={s.id} style={{ marginBottom: 4 }}>
              <a href={`#${s.id}`}>{s.titre[l]}</a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map(s => (
        <section key={s.id} style={{ marginBottom: 44 }}>
          {/* ⚠️ L'id est porté par le h2 : l'ancre atterrit sur le titre, pas au-dessus. */}
          <h2 id={s.id} style={{ scrollMarginTop: 24 }}>{s.titre[l]}</h2>
          <p>{s.intro[l]}</p>
          {s.etapes.map((e, k) => (
            <div key={k} style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: 'var(--fs-body)', marginBottom: 4 }}>{e.titre[l]}</h3>
              <p style={{ margin: 0 }}>{e.corps[l]}</p>
            </div>
          ))}
        </section>
      ))}

      <p className="legal-muted" style={{ marginTop: 48, fontSize: 'var(--fs-sm)' }}>{copyrightLine()}</p>
    </div>
  )
}
