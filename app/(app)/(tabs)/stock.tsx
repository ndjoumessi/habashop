import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, FontSize } from '@/constants/theme'
export default function StockScreen() {
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.c,{paddingTop:insets.top}]}>
      <Text style={s.t}>📦 Stock</Text>
      <Text style={s.s}>coming soon</Text>
    </View>
  )
}
const s = StyleSheet.create({
  c:{flex:1,backgroundColor:Colors.bg,
    alignItems:'center',justifyContent:'center'},
  t:{fontSize:FontSize.xxl,color:Colors.text,
    fontFamily:'Outfit_800ExtraBold'},
  s:{fontSize:FontSize.sm,color:Colors.text3,
    fontFamily:'Outfit_400Regular',marginTop:8},
})
