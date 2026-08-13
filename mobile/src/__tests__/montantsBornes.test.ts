import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * VERROU — aucun montant ne s'enroule ni ne se tronque.
 *
 * ─── LE DÉFAUT, ET POURQUOI IL EST NATIF ─────────────────────────────────────
 * Côté web, la parade est `white-space: nowrap` : le texte refuse de passer à la
 * ligne, point. React Native n'a pas d'équivalent — un `<Text>` s'enroule par défaut
 * dès que son conteneur le contraint, et « 1 200 000 FCFA » se coupe au milieu.
 * MESURÉ le 2026-08-13 : sur 41 montants rendus dans un `<Text>`, **36 n'étaient pas
 * bornés**. Le jumeau web venait d'être corrigé sur trois écrans (Commandes, Paie,
 * Dépenses) ; le natif n'avait jamais été regardé.
 *
 * ─── ⚠️ POURQUOI LE TRIO, ET PAS `numberOfLines` SEUL ────────────────────────
 * `numberOfLines={1}` empêche l'enroulement mais TRONQUE avec des points de
 * suspension : « 1 200 000 FCFA » devient « 1 200… ». Sur un montant, c'est PIRE que
 * l'enroulement — un nombre tronqué se lit comme un autre nombre, alors qu'un nombre
 * enroulé reste juste et seulement laid. C'est la famille « un chiffre faux se
 * retient » appliquée à la mise en page.
 * `adjustsFontSizeToFit` + `minimumFontScale={0.6}` rétrécissent la police au lieu de
 * couper : ni enroulement, NI troncature, jusqu'à 60 % de la taille. Ce n'est pas une
 * invention — c'est le motif déjà en place sur les KPI de l'écran Rapports, repris
 * plutôt que réinventé.
 *
 * ─── CE QUE CE VERROU NE PROUVE PAS ──────────────────────────────────────────
 * ⚠️ Il juge la FORME, pas le rendu : jest n'exécute pas Yoga. Il garantit que chaque
 * montant DEMANDE à ne pas s'enrouler, pas qu'aucun ne s'enroule à l'écran. Sous 60 %
 * de police, un montant très long dans une boîte très étroite finira quand même par
 * être coupé — cas non mesurable ici, et écrit plutôt que passé sous silence.
 */

const RACINES = ['src', 'app'].map(d => join(__dirname, '..', '..', d))

function fichiers(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') out.push(...fichiers(p)) }
    else if (e.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** Un SITE = une balise `<Text>` dont le contenu rend un montant. */
function sites(src: string) {
  const out: { attrs: string; contenu: string }[] = []
  for (const m of src.matchAll(/<Text\b([^>]*?)\/?>(.{0,220}?)<\/Text>/gs)) {
    if (/\bfmt\(|\bformatAmount/.test(m[2])) out.push({ attrs: m[1], contenu: m[2] })
  }
  return out
}

describe('montants natifs — ni enroulés, ni tronqués', () => {
  const tous = RACINES.flatMap(fichiers)

  it('COUVERTURE — le balayage lit `src/` ET `app/`, et trouve des montants', () => {
    // ⚠️ Angle mort n°1 : un balayage cassé rendrait zéro site, donc un vert qui ne
    // garde rien. Angle mort n°2 : `versionSource.test.ts` s'était arrêté à `src/`
    // alors qu'un site vivait dans `app/` — les deux racines sont lues, et prouvées.
    expect(tous.length).toBeGreaterThan(30)   // mesuré : 42 fichiers `.tsx`
    expect(tous.some(f => f.includes('/app/'))).toBe(true)
    const n = tous.reduce((a, f) => a + sites(readFileSync(f, 'utf8')).length, 0)
    expect(n).toBeGreaterThanOrEqual(30)
  })

  it('CHAQUE montant rendu dans un `<Text>` est borné', () => {
    const nus: string[] = []
    for (const f of tous) {
      for (const s of sites(readFileSync(f, 'utf8'))) {
        if (!/numberOfLines/.test(s.attrs)) {
          nus.push(`${f.split('/mobile/')[1]} :: ${s.contenu.replace(/\s+/g, ' ').slice(0, 60)}`)
        }
      }
    }
    // Ces montants peuvent s'enrouler au milieu d'un nombre : poser
    // `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}`.
    expect(nus).toEqual([])
  })

  it('⚠️ borné SANS être tronquable : `numberOfLines` seul ne suffit pas', () => {
    // La troncature est le piège de cette correction. On exige donc le TRIO partout
    // où l'enroulement est interdit — sinon on aurait échangé un défaut laid contre
    // un défaut FAUX.
    const tronquables: string[] = []
    for (const f of tous) {
      for (const s of sites(readFileSync(f, 'utf8'))) {
        if (/numberOfLines/.test(s.attrs) && !/adjustsFontSizeToFit/.test(s.attrs)) {
          tronquables.push(`${f.split('/mobile/')[1]} :: ${s.contenu.replace(/\s+/g, ' ').slice(0, 50)}`)
        }
      }
    }
    expect(tronquables).toEqual([])
  })

  /**
   * ⚠️ LE TRIO NE SUFFIT PAS DANS UNE RANGÉE NON BORNÉE — mesuré le 2026-08-13.
   * Le total du kiosque portait `numberOfLines` + `adjustsFontSizeToFit` et sortait
   * quand même « Total17 000  FCF » : libellé COLLÉ, montant COUPÉ. Deux causes :
   *  · sans `gap`, `space-between` ne sépare plus rien dès que le montant occupe tout
   *    l'espace restant ;
   *  · sans `flexShrink`, le montant n'a AUCUNE borne — il déborde et se fait rogner,
   *    et `adjustsFontSizeToFit` ne rétrécit que dans une boîte BORNÉE.
   *
   * ⚠️ Liste NOMMÉE, écrite à la main, et dite comme telle : « une rangée qui porte un
   * libellé et un montant » n'est pas détectable par la forme. Chaque paire est ici
   * avec sa raison, et la règle échoue si le style disparaît — donc si on la renomme
   * sans y penser.
   */
  const PAIRES: { fichier: string; rangee: string; valeur: string }[] = [
    { fichier: 'app/(app)/kiosk/index.tsx', rangee: 'totalRow',    valeur: 'totalAmount' },
    { fichier: 'app/(app)/kiosk/index.tsx', rangee: 'confirmLine', valeur: 'confirmLineVal' },
  ]

  it('une rangée libellé/montant a un `gap`, et le montant peut RÉTRÉCIR', () => {
    for (const { fichier, rangee, valeur } of PAIRES) {
      const src = readFileSync(join(__dirname, '..', '..', fichier), 'utf8')
      const styleDe = (nom: string) => {
        const m = new RegExp(`\\b${nom}: \\{([^}]*)\\}`).exec(src)
        if (!m) throw new Error(`style « ${nom} » introuvable dans ${fichier} — la règle ne garde plus rien`)
        return m[1]
      }
      expect(/\bgap:/.test(styleDe(rangee))).toBe(true)
      expect(/flexShrink:\s*1/.test(styleDe(valeur))).toBe(true)
    }
  })

  it('⚠️ le détecteur voit le site nu et IGNORE le site borné', () => {
    // Contrôle DISCRIMINANT : une règle qui ne trouve jamais rien est indistinguable
    // d'une règle satisfaite. Les deux sens sont exercés sur les formes réelles.
    const nu = `<Text style={s.recapVal}>{fmt(subtotal)}</Text>`
    const borne = `<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.recapVal}>{fmt(subtotal)}</Text>`
    const sansMontant = `<Text style={s.label}>{i('Total','Total','Total','Totale')}</Text>`
    expect(sites(nu).length).toBe(1)
    expect(/numberOfLines/.test(sites(nu)[0].attrs)).toBe(false)      // vu
    expect(/numberOfLines/.test(sites(borne)[0].attrs)).toBe(true)    // ignoré
    expect(sites(sansMontant).length).toBe(0)                          // pas un montant
  })
})
