import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Colors, FontSize, Spacing } from '@/constants/theme'
export default function POSScreen() {
  return (
    <View style={s.c}>
      <Text style={s.t}>🛒 Caisse</Text>
      <Text style={s.s}>coming soon</Text>
      <TouchableOpacity style={s.btn} onPress={()=>router.back()}>
        <Text style={s.btnT}>← Retour</Text>
      </TouchableOpacity>
    </View>
  )
}
const s = StyleSheet.create({
  c:{flex:1,backgroundColor:Colors.bg,
    alignItems:'center',justifyContent:'center',gap:Spacing.lg},
  t:{fontSize:FontSize.xxl,color:Colors.text,
    fontFamily:'Outfit_900Black'},
  s:{fontSize:FontSize.sm,color:Colors.text3,
    fontFamily:'Outfit_400Regular'},
  btn:{backgroundColor:Colors.primary,paddingHorizontal:Spacing.xl,
    paddingVertical:Spacing.md,borderRadius:12},
  btnT:{color:'#fff',fontFamily:'Outfit_700Bold',
    fontSize:FontSize.md},
})
