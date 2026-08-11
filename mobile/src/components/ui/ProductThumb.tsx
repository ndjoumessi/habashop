import { useState } from 'react'
import { View, Text, Image, type StyleProp, type ViewStyle } from 'react-native'

/**
 * LA VIGNETTE PRODUIT — jumeau NATIF de `apps/frontend/src/components/ui/ProductThumb.tsx`.
 *
 * ⚠️ MÊME DÉCISION, IMPLÉMENTATION DIFFÉRENTE. React Native n'a ni `<img>` ni
 * `objectFit` : `<Image resizeMode="cover">` en est l'équivalent. Ce n'est donc PAS
 * un jumeau à l'identique comme `escHtml` ou `barcode.ts` — il n'y a pas de fixture
 * partagée à respecter, seulement une règle : *la photo l'emporte, une photo qui
 * casse revient à l'émoji.*
 *
 * ─── POURQUOI LE REPLI COMPTE ENCORE PLUS ICI ────────────────────────────────
 * `Product.image` porte une URL. Le POS mobile sert des boutiques HORS LIGNE — la
 * file de rejeu existe pour ça, et `PERSISTED_KEYS` garde le catalogue dans
 * AsyncStorage précisément pour vendre sans réseau. Une caisse hors ligne aurait donc
 * toutes ses URL injoignables : sans ce repli, la grille entière serait vide.
 * L'émoji, lui, est DANS la donnée persistée — il survit à la coupure.
 *
 * ⚠️ Ne PAS « améliorer » en stockant la photo dans la donnée persistée : MESURÉ le
 * 2026-08-11, 600 produits en base64 256 px pèsent 16,4 Mo, et c'est AsyncStorage qui
 * les porterait. Le champ reste une URL, et l'absence de réseau est un cas NORMAL, pas
 * une panne.
 */
export default function ProductThumb({
  p,
  size = 40,
  radius = 8,
  fontSize = 30,
  style,
}: {
  p: { image?: string | null; emoji?: string | null }
  size?: number
  radius?: number
  /** Taille de l'émoji de repli — les surfaces vont de 20 à 44. */
  fontSize?: number
  style?: StyleProp<ViewStyle>
}) {
  // ⚠️ L'échec de chargement est un ÉTAT : il faut un re-rendu pour repasser à
  // l'émoji. La `key` sur l'URL le réinitialise quand la ligne change de produit —
  // sans elle, dans une liste recyclée, un produit hériterait de l'échec du précédent.
  const [casse, setCasse] = useState(false)

  if (p.image && !casse) {
    // ⚠️ L'image vit dans une `View`, jamais nue : `ImageStyle` et `ViewStyle` divergent
    // en React Native (`overflow: 'scroll'` n'existe pas côté image), donc une prop de
    // style commune aux deux branches ne compile pas si on la pose sur l'`Image`. Le
    // conteneur rogne, exactement comme le `overflow: hidden` du jumeau web.
    return (
      <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}>
        <Image
          key={p.image}
          source={{ uri: p.image }}
          onError={() => setCasse(true)}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    )
  }

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize }}>{p.emoji || '📦'}</Text>
    </View>
  )
}
