import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, FontSize, Spacing } from '@/constants/theme'
import { useAuthStore } from '@/stores/authStore'

export default function DashboardScreen() {
  const insets = useSafeAreaInsets()
  const { user, tenant } = useAuthStore()
  return (
    <View style={[s.container, { paddingTop:insets.top }]}>
      <Text style={s.title}>🛍️ HabaShop</Text>
      <Text style={s.shop}>{tenant?.name ?? 'Ma boutique'}</Text>
      <Text style={s.user}>👋 {user?.name}</Text>
      <Text style={s.sub}>Dashboard — coming soon</Text>
    </View>
  )
}
const s = StyleSheet.create({
  container:{flex:1,backgroundColor:Colors.bg,
    alignItems:'center',justifyContent:'center',gap:Spacing.md},
  title:{fontSize:32,color:Colors.text,fontFamily:'Outfit_900Black'},
  shop:{fontSize:FontSize.xl,color:Colors.primary3,
    fontFamily:'Outfit_700Bold'},
  user:{fontSize:FontSize.lg,color:Colors.text2,
    fontFamily:'Outfit_400Regular'},
  sub:{fontSize:FontSize.sm,color:Colors.text3,
    fontFamily:'Outfit_400Regular'},
})
