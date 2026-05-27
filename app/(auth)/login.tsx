import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/stores/appStore'
import { authApi } from '@/services/api'
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'
import AccessibleButton from '@/components/ui/AccessibleButton'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()
  const { i } = useI18n()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPwd, setShowPwd]   = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        i('Champs requis','Required','Requerido','Obbligatorio'),
        i('Remplissez tous les champs.',
          'Fill in all fields.',
          'Complete todos los campos.',
          'Compila tutti i campi.')
      ); return
    }
    setLoading(true)
    try {
      const data = await authApi.login(email.trim().toLowerCase(), password)
      await setAuth(data.token, data.user, data.tenant)
    } catch (err: any) {
      Alert.alert(
        i('Connexion échouée','Login failed','Error de acceso','Accesso fallito'),
        err?.response?.data?.error ??
          i('Email ou mot de passe incorrect.',
            'Invalid email or password.',
            'Email o contraseña incorrectos.',
            'Email o password errati.')
      )
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.flex}
      behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoIcon}>
            <Text style={{fontSize:40}}>🛍️</Text>
          </View>
          <Text style={s.logoText}>HabaShop</Text>
          <Text style={s.logoSub}>
            {i('Gestion commerciale pour l\'Afrique',
               'Business management for Africa',
               'Gestión comercial para África',
               'Gestione commerciale per l\'Africa')}
          </Text>
        </View>

        {/* Carte */}
        <View style={s.card}>
          <Text style={s.title}>
            {i('Se connecter','Sign in','Iniciar sesión','Accedi')}
          </Text>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput style={s.input}
              placeholder="admin@habashop.com"
              placeholderTextColor={Colors.text4}
              value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address"
              autoComplete="email" returnKeyType="next"
              accessibilityLabel="Email"
              accessibilityHint={i('Entrez votre adresse email','Enter your email address','Ingrese su email','Inserisci la tua email')}/>
          </View>

          <View style={s.field}>
            <Text style={s.label}>
              {i('Mot de passe','Password','Contraseña','Password')}
            </Text>
            <View style={{position:'relative'}}>
              <TextInput style={[s.input,{paddingRight:48}]}
                placeholder="••••••••"
                placeholderTextColor={Colors.text4}
                value={password} onChangeText={setPassword}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel={i('Mot de passe','Password','Contraseña','Password')}
                accessibilityHint={i('Entrez votre mot de passe','Enter your password','Ingrese su contraseña','Inserisci la password')}/>
              <TouchableOpacity
                style={s.eyeBtn}
                onPress={()=>setShowPwd(v=>!v)}
                accessibilityRole="button"
                accessibilityLabel={showPwd
                  ? i('Masquer le mot de passe','Hide password','Ocultar contraseña','Nascondi password')
                  : i('Afficher le mot de passe','Show password','Mostrar contraseña','Mostra password')}>
                <Text style={{fontSize:16}}>
                  {showPwd?'🙈':'👁️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <AccessibleButton
            label={i('Se connecter','Sign in','Iniciar sesión','Accedi')}
            onPress={handleLogin}
            loading={loading}
          />

          <View style={s.demoWrap}>
            <Text style={s.demoLabel}>
              {i('Compte démo :','Demo:','Demo:','Demo:')}
            </Text>
            <TouchableOpacity onPress={()=>{
              setEmail('admin@habashop.com')
              setPassword('demo1234')
            }}
              accessibilityRole="button"
              accessibilityLabel={i('Utiliser le compte démo','Use demo account','Usar cuenta demo','Usa account demo')}>
              <Text style={s.demoLink}>admin@habashop.com</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.flags}>🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇬🇳 🇨🇲</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:{flex:1,backgroundColor:Colors.bg},
  container:{flexGrow:1,padding:Spacing.xl,
    justifyContent:'center',gap:Spacing.xl},
  logoWrap:{alignItems:'center',gap:Spacing.sm},
  logoIcon:{
    width:80,height:80,borderRadius:24,
    backgroundColor:Colors.primary,
    alignItems:'center',justifyContent:'center',
    ...Shadow.colored(Colors.primary),
  },
  logoText:{
    fontSize:FontSize.xxxl,fontFamily:'Outfit_900Black',
    color:Colors.text,
  },
  logoSub:{
    fontSize:FontSize.sm,fontFamily:'Outfit_400Regular',
    color:Colors.text3,textAlign:'center',
  },
  card:{
    backgroundColor:Colors.card,borderRadius:BorderRadius.xl,
    borderWidth:1,borderColor:Colors.border,
    padding:Spacing.xl,gap:Spacing.lg,...Shadow.md,
  },
  title:{
    fontSize:FontSize.xl,fontFamily:'Outfit_800ExtraBold',
    color:Colors.text,
  },
  field:{gap:Spacing.xs},
  label:{
    fontSize:FontSize.xs,fontFamily:'Outfit_700Bold',
    color:Colors.text3,textTransform:'uppercase',
    letterSpacing:0.5,
  },
  input:{
    backgroundColor:Colors.bg3,borderWidth:1,
    borderColor:Colors.border,borderRadius:BorderRadius.md,
    paddingHorizontal:Spacing.md,height:48,
    fontSize:FontSize.md,fontFamily:'Outfit_400Regular',
    color:Colors.text,
  },
  eyeBtn:{
    position:'absolute',right:Spacing.md,
    top:0,bottom:0,justifyContent:'center',
  },
  btn:{
    backgroundColor:Colors.primary,borderRadius:BorderRadius.md,
    height:52,alignItems:'center',justifyContent:'center',
    marginTop:Spacing.xs,...Shadow.colored(Colors.primary),
  },
  btnText:{
    fontSize:FontSize.md,fontFamily:'Outfit_800ExtraBold',
    color:Colors.white,letterSpacing:0.3,
  },
  demoWrap:{alignItems:'center',gap:Spacing.xs},
  demoLabel:{
    fontSize:FontSize.xs,fontFamily:'Outfit_400Regular',
    color:Colors.text3,
  },
  demoLink:{
    fontSize:FontSize.sm,fontFamily:'Outfit_700Bold',
    color:Colors.primary3,
  },
  flags:{textAlign:'center',fontSize:20,letterSpacing:6},
})
