import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import ProductThumb from '../components/ui/ProductThumb'

/**
 * LA GÉOMÉTRIE DE LA VIGNETTE NATIVE — ce que jest PEUT en dire, et pas un mot de plus.
 *
 * ─── POURQUOI CE FICHIER, ET CE QU'IL NE REMPLACE PAS ────────────────────────
 * Le jumeau WEB est mesuré dans un vrai moteur (`e2e/dev/table-density.spec.ts`) :
 * boîte carrée, image qui remplit sa boîte, `object-fit` appliqué, et les onze appels
 * mesurés là où ils vivent. Rien de tout cela n'est transposable ici : jest ne fait
 * AUCUNE mise en page, et il n'existe pas de moteur Yoga joignable depuis la CI.
 *
 * ⚠️ MAIS L'ÉCART EST PLUS PETIT QU'IL N'Y PARAÎT, POUR UNE RAISON DE PLATEFORME.
 * En React Native il n'y a NI feuille de style NI cascade : les props de style SONT
 * les entrées de la mise en page. Sur le web, une règle CSS distante peut défaire ce
 * que le composant écrit — d'où la nécessité de mesurer le rendu. Ici, ce que le
 * composant passe à Yoga est exactement ce qu'on lit ci-dessous. Et une taille
 * explicite l'emporte sur l'étirement du parent.
 *
 * ─── CE QUI RESTE HORS DE PORTÉE, dit plutôt que masqué ──────────────────────
 * Yoga n'est pas exécuté : on ne voit ni enroulement de texte, ni débordement, ni
 * ce que fait un parent trop étroit. Le mesurer demanderait un émulateur piloté
 * (Detox ou Maestro) et un runner Android — un chantier, pas un test. Aucune des
 * assertions ci-dessous ne doit être lue comme « la vignette est carrée à l'écran » :
 * elles disent « le composant demande une boîte carrée », ce qui n'est pas pareil.
 */

const PHOTO = { image: 'https://exemple.test/riz.jpg', emoji: '🌾' }

/**
 * ⚠️ `render` EST ASYNCHRONE dans cette version de RNTL — il rend une `Promise`.
 * MESURÉ en le commettant : des cas synchrones font lever `screen` avec « render
 * function has not been called », ce qui accuse le singleton alors que c'est le
 * rendu qui n'a simplement pas encore eu lieu. Un message d'erreur peut désigner le
 * mauvais coupable ; le compilateur, lui, a nommé la vraie cause (`Promise<…>`).
 * ⚠️ L'absence LÈVE explicitement : un nœud introuvable rendrait un style vide, et un
 * style vide passerait toutes les assertions de forme sans rien prouver.
 */
type Rendu = Awaited<ReturnType<typeof render>>
function noeud(r: Rendu, id: string) {
  const trouves = r.queryAllByTestId(id)
  if (trouves.length === 0) throw new Error(`aucun élément « ${id} » rendu — la poignée a disparu`)
  return trouves[0]
}
const styleDe = (r: Rendu, id: string) => StyleSheet.flatten(noeud(r, id).props.style) as Record<string, unknown>

describe('vignette native — la boîte DEMANDÉE est carrée', () => {
  it.each([14, 26, 32, 40, 56])('à size=%i, largeur et hauteur suivent la taille (branche photo)', async size => {
    const r = await render(<ProductThumb p={PHOTO} size={size} />)
    const s = styleDe(r, 'product-thumb-photo')
    expect(s.width).toBe(size)
    // ⚠️ C'est CE point qui a produit le bandeau côté web : la largeur suivait le
    // conteneur pendant que la hauteur restait figée.
    expect(s.height).toBe(size)
    // Équivalent natif du `overflow:hidden` : c'est le conteneur qui rogne.
    expect(s.overflow).toBe('hidden')
  })

  it('la branche de REPLI est carrée elle aussi — c’est elle qui masquait le défaut web', async () => {
    // Un émoji est du TEXTE CENTRÉ : il se moque de la largeur de sa boîte. Une
    // vignette peut donc être cassée et paraître saine tant qu'aucun produit n'a de
    // photo. Le web l'a payé pendant dix surfaces.
    const r = await render(<ProductThumb p={{ emoji: '🌾' }} size={36} />)
    const s = styleDe(r, 'product-thumb-secours')
    expect(s.width).toBe(36)
    expect(s.height).toBe(36)
  })

  it('l’image COUVRE sa boîte et ne se déforme pas', async () => {
    const r = await render(<ProductThumb p={PHOTO} size={40} />)
    const img = noeud(r, 'product-thumb-image')
    const s = StyleSheet.flatten(img.props.style) as Record<string, unknown>
    // Équivalent natif du `position:absolute; inset:0` du jumeau web.
    // L'image doit être posée sur TOUTE la boîte.
    expect([s.position, s.top, s.left, s.right, s.bottom]).toEqual(['absolute', 0, 0, 0, 0])
    // ⚠️ `resizeMode="cover"` est l'équivalent d'`object-fit:cover`. Sans lui, une
    // photo 3:1 dans une boîte carrée est ÉCRASÉE — et AUCUNE mesure de rectangle ne
    // peut le voir : côté web, le sabotage correspondant rendait des rectangles
    // strictement identiques au cas sain.
    expect(img.props.resizeMode).toBe('cover')
  })

  it('⚠️ un style d’appelant LÉGITIME ne casse pas la boîte — la règle ne crie pas au loup', async () => {
    // Marges, décalages : la chrome reste à l'appelant, comme sur le web.
    const r = await render(<ProductThumb p={PHOTO} size={42} style={{ marginBottom: 4 }} />)
    const s = styleDe(r, 'product-thumb-photo')
    expect([s.width, s.height, s.marginBottom]).toEqual([42, 42, 4])
  })
})
