import { View, Text, StyleSheet } from 'react-native'
import { Colors, FontSize } from '@/constants/theme'
export default function CustomersScreen() {
  return (
    <View style={s.c}>
      <Text style={s.t}>👥 Clients</Text>
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
