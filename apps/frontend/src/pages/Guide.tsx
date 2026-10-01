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
  /**
   * ⚠️ LA LÉGENDE DIT CE QU'ON REGARDE, ET CE QU'ON N'ENTENDRA PAS. L'aperçu n'a ni son ni
   * sous-titres : s'il portait de l'information que le texte ne porte pas, le manuel serait
   * illisible pour qui ne peut pas le regarder. Il ILLUSTRE les sections ci-dessous, il ne
   * les remplace pas — et la légende le dit, plutôt que de le laisser deviner.
   */
  const legende = {
    fr: 'Le tour du produit en 25 secondes : caisse, stock, rapports, équipe. Sans son — tout ce qu’on y voit est décrit dans les sections ci-dessous.',
    en: 'A 25-second tour: register, stock, reports, team. No sound — everything shown is described in the sections below.',
    es: 'Un recorrido de 25 segundos: caja, stock, informes, equipo. Sin sonido: todo lo que se ve se describe en las secciones de abajo.',
    it: 'Un giro di 25 secondi: cassa, magazzino, report, squadra. Senza audio: tutto ciò che si vede è descritto nelle sezioni qui sotto.',
  }[l]
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

      {/*
        ⚠️ `preload="metadata"` et PAS d'`autoplay`. Le manuel se LIT : démarrer seul parlerait
        par-dessus le lecteur, ignorerait `prefers-reduced-motion`, et ferait payer 415 Ko à
        quelqu'un venu chercher une phrase — sur un forfait ouest-africain ce n'est pas neutre.
        C'est le lecteur qui décide, et il ne télécharge la vidéo que s'il la lance.

        ⚠️ L'aperçu suit la LANGUE LUE : quatre fichiers, un par langue, et `guideApercu.test.tsx`
        va vérifier leurs OCTETS sur le disque. Un `src` sans fichier compile et se rend — il
        n'échoue que chez le commerçant, par une vidéo qui ne part jamais et sans message.
      */}
      <figure style={{ margin: '0 0 44px' }}>
        <video
          src={`/guide/apercu-${l}.webm`}
          poster={`/guide/apercu-${l}.jpg`}
          controls
          preload="metadata"
          playsInline
          style={{
            width: '100%', display: 'block', borderRadius: 12,
            border: '1px solid var(--border2)', background: 'var(--bg2)',
          }}
        />
        <figcaption className="legal-muted" style={{ marginTop: 10, fontSize: 'var(--fs-label)' }}>
          {legende}
        </figcaption>
      </figure>

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
