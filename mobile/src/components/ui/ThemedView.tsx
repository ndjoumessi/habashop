import { View, ViewProps } from 'react-native'
import { useTheme } from '@/stores/appStore'

interface ThemedViewProps extends ViewProps {
  level?: 'bg' | 'bg2' | 'bg3' | 'card'
}

// Wrapper qui applique le fond du thème courant — évite de répéter
// `backgroundColor: C.bg` partout. <ThemedView level="card">…</ThemedView>
export default function ThemedView({ level = 'bg', style, ...props }: ThemedViewProps) {
  const { C } = useTheme()
  return <View style={[{ backgroundColor: C[level] }, style]} {...props} />
}
