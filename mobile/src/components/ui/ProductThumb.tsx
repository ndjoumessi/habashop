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
 *
 * ⚠️ TROIS ÉTATS, PAS DEUX — et le troisième pèse PLUS LOURD ici que sur le web.
 * Entre la pose de l'URI et la peinture, `<Image>` ne rend rien et React Native n'a
 * aucun placeholder natif : la grille de caisse était VIDE pendant tout le
 * chargement. Sur le réseau d'une boutique cette fenêtre dure des secondes, et elle
 * ne déclenche AUCUN `onError` — le repli d'erreur ne pouvait donc pas la couvrir.
 * L'émoji tient la place sous l'image jusqu'à `onLoad`.
 *
 * ⚠️ L'état est CLÉ PAR L'URI, jamais un booléen : `FlatList` recycle ses lignes et
 * React réutilise l'instance, donc un booléen ferait hériter le produit suivant de
 * l'échec du précédent. C'est le mode de recyclage NORMAL d'une liste native, pas un
 * cas limite.
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
  // On mémorise l'URI CONCERNÉE, pas un booléen : voir l'en-tête.
  const [echouee, setEchouee] = useState<string | null>(null)
  const [peinte, setPeinte] = useState<string | null>(null)
  const casse = !!p.image && echouee === p.image
  const chargee = !!p.image && peinte === p.image

  const secours = <Text style={{ fontSize }}>{p.emoji || '📦'}</Text>

  if (p.image && !casse) {
    // ⚠️ L'image vit dans une `View`, jamais nue : `ImageStyle` et `ViewStyle` divergent
    // en React Native (`overflow: 'scroll'` n'existe pas côté image), donc une prop de
    // style commune aux deux branches ne compile pas si on la pose sur l'`Image`. Le
    // conteneur rogne, exactement comme le `overflow: hidden` du jumeau web — et c'est
    // lui qui porte l'émoji pendant le chargement.
    return (
      <View
        // Poignée de GÉOMÉTRIE — jumelle du `data-thumb` web, mêmes deux valeurs.
        // Elle porte la BRANCHE rendue, qu'aucune lecture de style ne retrouverait.
        testID="product-thumb-photo"
        style={[
          { width: size, height: size, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
      >
        {!chargee && secours}
        <Image
          key={p.image}
          // Poignée de test : contrairement au web, il n'existe ici aucun sélecteur
          // de structure (`render`/`screen` n'exposent que `rerender` et `root`).
          testID="product-thumb-image"
          source={{ uri: p.image }}
          onLoad={() => setPeinte(p.image!)}
          onError={() => setEchouee(p.image!)}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
    )
  }

  return (
    <View testID="product-thumb-secours" style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {secours}
    </View>
  )
}
