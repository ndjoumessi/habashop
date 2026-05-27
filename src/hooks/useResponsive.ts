import { useWindowDimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type DeviceType = 'phone' | 'tablet' | 'largeTablet'

export interface ResponsiveLayout {
  width:         number
  height:        number
  isTablet:      boolean
  isLargeTablet: boolean
  isLandscape:   boolean
  isIOS:         boolean
  deviceType:    DeviceType
  columns:       number  // colonnes de la grille produits
  sidebarWidth:  number  // largeur panier/sidebar permanent (0 = modal sur phone)
  cardWidth:     number  // largeur d'une carte produit
  fontSize:      { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number }
  spacing:       { sm: number; md: number; lg: number; xl: number }
  insets:        { top: number; bottom: number; left: number; right: number }
}

// Hook responsive — dérive layout/colonnes/typo des dimensions courantes.
// Réagit à la rotation (useWindowDimensions est réactif) et au type d'appareil.
export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const isTablet      = width >= 768
  const isLargeTablet = width >= 1024
  const isLandscape   = width > height

  const deviceType: DeviceType =
    isLargeTablet ? 'largeTablet' :
    isTablet      ? 'tablet'      : 'phone'

  // Colonnes grille produits selon device + orientation
  const columns =
    isLargeTablet && isLandscape ? 6 :
    isLargeTablet                ? 5 :
    isTablet && isLandscape      ? 5 :
    isTablet                     ? 4 : 3

  // Largeur du panier/sidebar permanent (0 sur phone → panier en modal)
  const sidebarWidth =
    isLargeTablet ? 360 :
    isTablet      ? 300 : 0

  // Largeur d'une carte produit (gap de 12 entre colonnes + bords)
  const cardWidth = (width - (columns + 1) * 12) / columns

  const fontSize = isTablet
    ? { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 }
    : { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 }

  const spacing = isTablet
    ? { sm: 12, md: 16, lg: 24, xl: 32 }
    : { sm: 8, md: 12, lg: 16, xl: 24 }

  return {
    width, height,
    isTablet, isLargeTablet, isLandscape,
    isIOS: Platform.OS === 'ios',
    deviceType, columns, sidebarWidth, cardWidth,
    fontSize, spacing,
    insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
  }
}
