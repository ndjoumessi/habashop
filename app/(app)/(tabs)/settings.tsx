import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Colors, FontSize, Spacing } from '@/constants/theme'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
export default function SettingsScreen() {
  const { user, logout } = useAuthStore()
  const { i } = useAppStore()
  return (
    <View style={s.c}>
      <Text style={s.t}>⚙️ {i('Réglages','Settings','Ajustes','Imp.')}</Text>
      <Text style={s.u}>{user?.email}</Text>
      <TouchableOpacity style={s.btn} onPress={()=>
        Alert.alert(
          i('Déconnexion','Logout','Cerrar sesión','Disconnetti'),
          '',
          [{text:i('Annuler','Cancel','Cancelar','Annulla'),style:'cancel'},
           {text:i('Déconnexion','Logout','Cerrar sesión','Disconnetti'),
            style:'destructive',onPress:logout}]
        )}>
        <Text style={s.btnT}>
          {i('Se déconnecter','Logout','Cerrar sesión','Disconnetti')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
const s = StyleSheet.create({
  c:{flex:1,backgroundColor:Colors.bg,
    alignItems:'center',justifyContent:'center',gap:Spacing.lg},
  t:{fontSize:FontSize.xl,color:Colors.text,
    fontFamily:'Outfit_800ExtraBold'},
  u:{fontSize:FontSize.sm,color:Colors.text3,
    fontFamily:'Outfit_400Regular'},
  btn:{
    backgroundColor:'rgba(255,59,92,0.1)',
    paddingHorizontal:Spacing.xl,paddingVertical:Spacing.md,
    borderRadius:12,borderWidth:1,
    borderColor:'rgba(255,59,92,0.2)',
  },
  btnT:{fontSize:FontSize.md,fontFamily:'Outfit_700Bold',
    color:'#FF3B5C'},
})
