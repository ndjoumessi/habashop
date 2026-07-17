import { useMemo } from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { ThemeColors } from '@/constants/theme'
import { useTheme } from '@/stores/appStore'

interface AvatarProps {
  name:      string
  photoUri?: string | null
  size?:     number
  onPress?:  () => void
  loading?:  boolean
  showEdit?: boolean
}

export default function Avatar({
  name, photoUri, size = 60, onPress, loading = false, showEdit = false,
}: AvatarProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const initials = name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
  const fontSize = size * 0.35

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={name}
      style={[s.wrap, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {loading ? (
        <ActivityIndicator color={C.white} />
      ) : photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[s.initials, { fontSize }]}>{initials}</Text>
      )}

      {showEdit && !loading && (
        <View style={s.editBadge}>
          <Text style={s.editIcon}>✏️</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: 'Outfit_800ExtraBold', color: C.white },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  editIcon: { fontSize: 11 },
})
