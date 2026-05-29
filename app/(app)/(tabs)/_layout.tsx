import { useMemo } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeColors, withAlpha } from '@/constants/theme'
import { useI18n, useTheme } from '@/stores/appStore'

function TabIcon({ name, focused, label }:{
  name: keyof typeof Ionicons.glyphMap
  focused:boolean; label:string
}) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <View style={s.item}>
      <View style={focused ? s.iconPillActive : s.iconPill}>
        <Ionicons
          name={focused ? name : `${name}-outline` as any}
          size={22}
          color={focused ? C.primary : C.text3}
        />
      </View>
      <Text
        style={[s.lbl, focused && s.lblActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </View>
  )
}

export default function TabLayout() {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  return (
    <Tabs screenOptions={{
      headerShown:false,
      tabBarStyle:s.bar,
      tabBarShowLabel:false,
    }}>
      <Tabs.Screen name="dashboard" options={{ tabBarIcon:({focused})=>
        <TabIcon name="grid" focused={focused}
          label={i('Accueil','Home','Inicio','Home')}/>
      }}/>
      <Tabs.Screen name="stock" options={{ tabBarIcon:({focused})=>
        <TabIcon name="cube" focused={focused}
          label={i('Stock','Stock','Stock','Stock')}/>
      }}/>
      <Tabs.Screen name="pos-tab" options={{ tabBarIcon:({focused})=>(
        <View style={s.posWrap}>
          <View style={[
            s.posBtn,
            focused ? s.posBtnActive : s.posBtnInactive,
            { transform: [{ scale: focused ? 1.08 : 1 }] },
          ]}>
            <Ionicons name="cart" size={26} color={focused ? '#fff' : C.text2}/>
          </View>
        </View>
      )}}/>
      <Tabs.Screen name="customers" options={{ tabBarIcon:({focused})=>
        <TabIcon name="people" focused={focused}
          label={i('Clients','Clients','Clientes','Clienti')}/>
      }}/>
      <Tabs.Screen name="settings" options={{ tabBarIcon:({focused})=>
        <TabIcon name="settings" focused={focused}
          label={i('Réglages','Settings','Ajustes','Imp.')}/>
      }}/>
    </Tabs>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  bar:{
    backgroundColor:C.bg2, borderTopColor:C.border,
    borderTopWidth:1, height:76, paddingBottom:14, paddingTop:6,
  },
  item:{ alignItems:'center', gap:2, width:56 },
  // Pill autour de l'icône — actif : fond violet 10%, inactif : rien
  iconPill:{
    paddingHorizontal:10, paddingVertical:4, borderRadius:10,
    alignItems:'center',
  },
  iconPillActive:{
    paddingHorizontal:10, paddingVertical:4, borderRadius:10,
    alignItems:'center',
    backgroundColor: withAlpha(C.primary, 0.10),
  },
  lbl:{ fontSize:9, color:C.text3, fontFamily:'Outfit_600SemiBold', textAlign:'center' },
  lblActive:{ color:C.primary3 },
  posWrap:{ alignItems:'center', justifyContent:'center', marginBottom:16 },
  // Base du bouton POS — props communs ; le reste est appliqué par les variantes active/inactive
  posBtn:{
    width:58, height:58, borderRadius:18,
    alignItems:'center', justifyContent:'center',
  },
  posBtnActive:{
    backgroundColor:C.primary,
    borderWidth:0,
    borderColor:'transparent',
    shadowColor:C.primary,
    shadowOffset:{ width:0, height:4 },
    shadowOpacity:0.35,
    shadowRadius:8,
    elevation:6,
  },
  posBtnInactive:{
    backgroundColor:C.bg3,
    borderWidth:1.5,
    borderColor:C.border,
    shadowColor:'#000',
    shadowOffset:{ width:0, height:2 },
    shadowOpacity:0.10,
    shadowRadius:3,
    elevation:2,
  },
})
