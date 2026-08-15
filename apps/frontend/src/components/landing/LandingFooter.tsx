import { Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import LogoMark from '@/components/ui/LogoMark'
import { copyrightLine } from '@/lib/publicYear'
import { D } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
}

export default function LandingFooter({ lp }: Props) {

  return (
    <>
      <footer style={{
        padding: '40px clamp(16px,4vw,80px) 28px',
        borderTop: '1px solid transparent',
        borderImage: `linear-gradient(90deg,${D.p},transparent 50%,${D.p}) 1`,
        background: D.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              overflow: 'hidden', display: 'flex',
            }}>
              <LogoMark />
            </div>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: D.text }}>HabaShop</span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {/**
              * ⚠️ Ces trois liens étaient des `href="#"` — ils ne menaient NULLE PART, et un
              * clic remontait simplement en haut de page. Un pied de page qui annonce des
              * documents institutionnels sans les servir est une promesse fausse.
              *
              * ⚠️ « CGU » avait été RETIRÉE le 2026-08-15 parce qu'aucun document n'existait
              * — la pointer vers `/privacy` aurait présenté une politique de confidentialité
              * comme des conditions de service. Elle est REVENUE le même jour, `/terms` ayant
              * été rédigée. C'est l'ordre qui compte : on écrit le document, PUIS le lien.
              *
              * ⚠️ La cible n'est plus POSITIONNELLE : les libellés sont traduits, et une
              * langue qui réordonnait ses entrées aurait fait pointer « Contact » vers
              * `/privacy` sans que rien ne rougisse. Clé stable → cible.
              */}
            {([
              { cle: 'privacy' as const, to: '/privacy',  externe: false },
              { cle: 'terms'   as const, to: '/terms',    externe: false },
              { cle: 'contact' as const, to: 'mailto:romel.djoumessi@gmail.com', externe: true },
            ]).map(({ cle, to, externe }) => {
              const style = {
                fontSize: 'var(--fs-label)', color: D.text2, textDecoration: 'none',
                transition: 'color .15s', cursor: 'pointer',
                padding: '12px 8px', margin: '-12px -8px',
              } as const
              const survol = {
                onMouseEnter: (e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.color = '#fff',
                onMouseLeave: (e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.color = D.text2,
              }
              return externe
                ? <a key={cle} href={to} style={style} {...survol}>{lp.footer_links[cle]}</a>
                : <Link key={cle} to={to} style={style} {...survol}>{lp.footer_links[cle]}</Link>
            })}
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 'var(--fs-caption)', color: D.text4, paddingTop: 18, borderTop: `1px solid ${D.border}`, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}>
          {copyrightLine()} · {lp.footer_tagline}<Shield size={11}/>
        </div>
      </footer>

      <style>{`
        @keyframes lp-float {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-20px) }
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50%      { opacity: .5; transform: scale(.8) }
        }
        @media (max-width: 900px) {
          .lp-nav-desktop { display: none !important }
        }
        @media (max-width: 640px) {
          /* ⚠️ C'etait .lp-selectors display:none — langue ET devise disparaissaient.
             La LANGUE reste : le produit est livré en 4 langues, un visiteur dont le
             téléphone est en anglais doit pouvoir changer depuis la vitrine. La DEVISE
             part : préférence d'affichage secondaire, modifiable une fois connecté, et
             les prix sont annoncés en F CFA de toute façon. Décision du 2026-08-06. */
          .lp-selectors > select:last-child { display: none !important }
        }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important }
        }
      `}</style>
    </>
  )
}
