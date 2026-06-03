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
          name={focused ? name : `${name}-outline` as keyof typeof Ionicons.glyphMap}
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
      <Tabs.Screen name="pos-tab" options={{ tabBarIcon:({focused})=>
        <TabIcon name="cart" focused={focused}
          label={i('Caisse','Register','Caja','Cassa')}/>
      }}/>
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
  lbl:{ fontSize:11, color:C.text3, fontFamily:'Outfit_600SemiBold', textAlign:'center' },
  lblActive:{ color:C.primary3 },
})
