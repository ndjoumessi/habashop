import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ProductThumb from '@/components/ui/ProductThumb'

/**
 * LA VIGNETTE PRODUIT — le rendu, et la règle qui empêche les copies de revenir.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * MESURÉ le 2026-08-11, avant `Product.image` : NEUF surfaces rendaient l'émoji
 * produit en ligne, sans rien partager. C'est l'état exact de l'avatar employé
 * quelques heures plus tôt, où cinq copies avaient produit une divergence. Ajouter
 * la photo sur neuf sites indépendants aurait garanti qu'un d'entre eux l'oublie.
 *
 * ⚠️ CE QUE CE FICHIER GARDE VRAIMENT, ce n'est pas « la photo s'affiche » — c'est
 * (a) qu'une URL CASSÉE revient à l'émoji, (b) qu'une vignette n'est JAMAIS vide
 * pendant le chargement, et (c) qu'aucune surface ne recrée un rendu en ligne.
 *
 * ⚠️ CE FICHIER A FIGÉ UN DÉFAUT — c'est sa propre leçon. Deux assertions
 * affirmaient « avant l'échec, l'émoji est absent » : elles décrivaient ce que le
 * code FAISAIT (une boîte vide pendant tout le chargement) au lieu d'affirmer ce
 * qu'il DOIT faire. Le jour où le comportement est devenu faux, elles l'ont
 * protégé. Corrigées le 2026-08-12, avec l'invariant qui les remplace : *il
 * n'existe aucun instant où la vignette ne montre rien.*
 */

// ── (1) la DÉCISION rendue ───────────────────────────────────────────────────
describe('ProductThumb — photo, émoji, et la photo qui casse', () => {
  it('une photo CHARGÉE remplace l’émoji', async () => {
    await render(<ProductThumb p={{ image: 'https://exemple.test/riz.jpg', emoji: '🌾' }} />)
    const img = document.querySelector('img')
    expect(img, 'un <img> doit être rendu').not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://exemple.test/riz.jpg')

    // ⚠️ C'est APRÈS la peinture que l'émoji cède, pas avant : sans ce
    // déclenchement, l'assertion « l'émoji est absent » figerait la boîte vide.
    fireEvent.load(img!)
    expect(screen.queryByText('🌾'), 'photo peinte : l’émoji ne doit plus doubler').toBeNull()
  })

  it('⚠️ PENDANT le chargement, la vignette n’est JAMAIS vide', async () => {
    /**
     * LE CAS NORMAL, PAS LE CAS DÉGRADÉ. Entre la pose de l'URL et la peinture,
     * un `<img>` seul ne rend rien — et sur le réseau d'une boutique
     * ouest-africaine cette fenêtre dure des secondes. Aucun `onError` ne part :
     * rien n'a échoué. Le repli d'erreur ne pouvait donc pas couvrir ce cas, et
     * la grille de caisse était vide, ce qui est PIRE que les émojis d'avant.
     */
    await render(<ProductThumb p={{ image: 'https://exemple.test/lent.jpg', emoji: '🌾' }} />)
    expect(document.querySelector('img'), 'l’image est bien demandée').not.toBeNull()
    expect(screen.getByText('🌾'), 'l’émoji doit tenir la place tant que rien n’est peint').toBeTruthy()
  })

  it('⚠️ un échec ne se TRANSMET PAS au produit suivant dans une ligne recyclée', async () => {
    /**
     * L'état vit dans le COMPOSANT ; une liste recyclée réutilise l'instance et
     * seule la `key` de l'`<img>` remonte l'élément. Un booléen `casse` ferait donc
     * hériter le produit suivant de l'échec du précédent — il n'afficherait plus
     * jamais sa photo. Ce fichier a AFFIRMÉ le contraire en commentaire pendant
     * une journée : d'où cet exercice, et non une relecture.
     */
    const { rerender } = await render(<ProductThumb p={{ image: 'https://exemple.test/a.jpg', emoji: '🅰️' }} />)
    fireEvent.error(document.querySelector('img')!)
    expect(document.querySelector('img'), 'A a échoué : plus d’image').toBeNull()

    await rerender(<ProductThumb p={{ image: 'https://exemple.test/b.jpg', emoji: '🅱️' }} />)
    const suivante = document.querySelector('img')
    expect(suivante, 'B doit AVOIR SA CHANCE malgré l’échec de A').not.toBeNull()
    expect(suivante?.getAttribute('src')).toBe('https://exemple.test/b.jpg')
    expect(screen.getByText('🅱️'), 'et son émoji tient la place en attendant').toBeTruthy()
  })

  it('sans photo, l’émoji est rendu', async () => {
    await render(<ProductThumb p={{ emoji: '🌾' }} />)
    expect(document.querySelector('img'), 'aucun <img> attendu').toBeNull()
    expect(screen.getByText('🌾')).toBeTruthy()
  })

  it('⚠️ une photo qui NE CHARGE PAS revient à l’émoji, pas au glyphe d’image brisée', async () => {
    /**
     * LE CŒUR DU FICHIER. `Product.image` porte une URL vers un stockage objet :
     * l'objet peut être supprimé, et surtout la boutique peut être HORS LIGNE —
     * le cas NORMAL en Afrique de l'Ouest. Sans ce repli, une caisse hors ligne
     * afficherait une grille de glyphes cassés : strictement PIRE que l'émoji
     * qu'on avait avant d'ajouter les photos.
     *
     * jsdom ne charge aucune ressource : on déclenche l'`error` nous-mêmes, ce qui
     * est exactement l'événement que le navigateur émettrait sur un 404 ou un
     * DNS injoignable.
     */
    await render(<ProductThumb p={{ image: 'https://exemple.test/absent.jpg', emoji: '🌾' }} />)
    const img = document.querySelector('img')!
    // ⚠️ L'émoji est DÉJÀ là avant l'échec (il tient la place pendant le
    // chargement). Cette ligne affirmait l'inverse et figeait la boîte vide.
    expect(screen.getByText('🌾'), 'avant l’échec, l’émoji tient déjà la place').toBeTruthy()

    fireEvent.error(img)

    expect(document.querySelector('img'), 'l’<img> cassé doit DISPARAÎTRE').toBeNull()
    expect(screen.getByText('🌾'), 'l’émoji doit reprendre la place').toBeTruthy()
  })

  it('ni photo ni émoji : le repli fourni, sinon 📦 — jamais une vignette vide', async () => {
    const { unmount } = await render(<ProductThumb p={{}} fallback={<span>ICONE</span>} />)
    expect(screen.getByText('ICONE')).toBeTruthy()
    unmount()
    await render(<ProductThumb p={{}} />)
    expect(screen.getByText('📦')).toBeTruthy()
  })

  it('la vignette est MUETTE pour un lecteur d’écran', async () => {
    // Les surfaces nomment déjà le produit en texte à côté : une vignette qui
    // s'annonce ferait lire le nom deux fois.
    await render(<ProductThumb p={{ image: 'https://exemple.test/x.jpg', emoji: '🌾' }} />)
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('')
  })
})

// ── (2) la RÈGLE — aucune surface ne recrée un rendu en ligne ────────────────
describe('⚠️ aucun rendu d’émoji produit HORS de ProductThumb', () => {
  /**
   * Périmètre DÉRIVÉ de l'arborescence, jamais listé : une liste écrite à la main
   * est fausse dès qu'on ajoute un fichier, et l'assertion de couverture ne le
   * dirait pas — elle prouve qu'on a lu N fichiers, jamais que N était le bon N.
   */
  const RACINE = join(__dirname, '..')

  /**
   * Exemptions NOMMÉES, une par une — jamais un fichier entier écarté « parce que
   * c'est compliqué ».
   */
  /**
   * ⚠️ TROIS exemptions ont été RETIRÉES au profit de la distinction de forme
   * (`${p.emoji}` dans un gabarit de chaîne n'est pas un rendu) : `Stock.tsx`,
   * `Orders.tsx`, `utils/export.ts`. Une exemption au FICHIER laisserait passer un
   * vrai défaut ajouté dedans — c'est la limite assumée des listes de pays, et on
   * n'a pas à la payer ici.
   */
  const EXEMPTS = new Map<string, string>([
    ['components/ui/ProductThumb.tsx', 'le rendu unique lui-même'],
    ['components/pos/posShared.tsx', 'données de démonstration : PRODUCTS porte des émojis en littéral, il n’en rend aucun'],
    ['stores/appStore.ts', 'émojis de THÈME, pas de produit'],
    ['pages/AdminDashboard.tsx', 'émojis de thème dans le sélecteur d’apparence'],
  ])

  function fichiers(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) {
        if (e !== 'tests' && e !== 'node_modules') fichiers(p, acc)
      } else if (/\.tsx?$/.test(e)) acc.push(p)
    }
    return acc
  }

  /**
   * LA FORME VISÉE : une expression terminée par `.emoji` EN TÊTE d'accolade — donc une
   * interpolation JSX, et non un littéral d'objet (`{ id: p.id, …, emoji: p.emoji }`),
   * qui construit une ligne de panier et n'a rien à rendre.
   *
   * ⚠️ Elle juge la FORME, jamais l'identifiant : lister les noms de variables
   * (`product`, `it.product`, `selected`…) serait faux au premier nom nouveau.
   */
  const RENDU_EN_LIGNE = /(?<!\$)\{\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\??\.emoji\b/

  it('⚠️ le détecteur est DISCRIMINANT — vérifié sur les vraies formes d’avant', () => {
    /**
     * Sabotages COPIÉS, jamais retapés : extraits par `git show HEAD:<fichier>` avant
     * le câblage. Un sabotage écrit de mémoire hérite des hypothèses du détecteur, et
     * les deux tombent ensemble — c'est ce qui avait laissé le verrou tarifaire vert.
     */
    const brut = readFileSync(join(__dirname, 'fixtures/product-emoji-inline-avant.txt'), 'utf8')
    const avant = brut.split('\n').filter(l => l.trim() && !l.startsWith('#'))
    expect(avant.length, 'la fixture doit porter les formes réelles').toBe(10)

    // (a) TÉMOIN POSITIF — chacune des 10 doit être vue.
    const ratees = avant.filter(l => !RENDU_EN_LIGNE.test(l))
    expect(ratees, 'ces formes réelles échappent au détecteur').toEqual([])

    // (b) TÉMOIN NÉGATIF — les littéraux d'objet ne doivent PAS être vus. Sans ce
    // second sens, la règle crierait au loup et se ferait désarmer : c'est exactement
    // ce qu'a fait sa première version.
    const legitimes = [
      "{ id: product.id, name: product.name, price: product.price, emoji: product.emoji }",
      "{ id: p.id, name: p.name, price, qty: 1, emoji: p.emoji, tierLabel }",
      "name: `${p.emoji || '📦'} ${p.name}`,",
    ]
    const criees = legitimes.filter(l => RENDU_EN_LIGNE.test(l))
    expect(criees, 'ces formes ne sont pas des rendus — la règle ne doit pas les viser').toEqual([])
  })

  it('la règle tient sur tout `src/`', () => {
    const tous = fichiers(RACINE)
    // ⚠️ COUVERTURE : un `fichiers()` cassé rendrait une liste vide, donc un vert
    // qui ne garde rien. Le dépôt en compte plusieurs centaines.
    expect(tous.length, 'le balayage doit lire des fichiers').toBeGreaterThan(200)

    const fautifs: string[] = []
    let temoinsExempts = 0
    for (const f of tous) {
      const rel = f.slice(RACINE.length + 1)
      if (EXEMPTS.has(rel)) { temoinsExempts++; continue }
      // ⚠️ Retirer les commentaires AVANT de conclure : sinon la règle interdirait
      // d'expliquer ce qu'elle interdit.
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      // La FORME visée : un émoji de produit interpolé dans du JSX.
      const m = src.match(RENDU_EN_LIGNE)
      if (m) fautifs.push(`${rel} :: ${m[0].trim().slice(0, 60)}`)
    }
    // ⚠️ CONTRÔLE DISCRIMINANT : les exemptions doivent avoir été RENCONTRÉES. Une
    // exemption qui ne correspond à aucun fichier (renommage) rendrait la règle
    // silencieusement plus laxiste qu'annoncé.
    expect(temoinsExempts, 'toutes les exemptions doivent désigner un fichier existant').toBe(EXEMPTS.size)
    expect(fautifs, 'ces surfaces doivent passer par ProductThumb').toEqual([])
  })
})
