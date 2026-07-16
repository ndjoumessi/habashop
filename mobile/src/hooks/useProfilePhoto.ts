import { useState, useEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from '@/lib/logger'

const PHOTO_KEY = 'habashop_profile_photo'

// Redimensionne en 200x200 JPEG (manipulateAsync : déprécié en SDK 54 mais fonctionnel).
async function resize(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200, height: 200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  )
  return out.uri
}

export function useProfilePhoto() {
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(PHOTO_KEY).then(uri => { if (uri) setPhotoUri(uri) }).catch(() => {})
  }, [])

  const save = async (uri: string) => {
    setLoading(true)
    try {
      const small = await resize(uri)
      await AsyncStorage.setItem(PHOTO_KEY, small)
      setPhotoUri(small)
    } catch (e) { logger.warn('Sauvegarde photo de profil échouée:', e) } finally { setLoading(false) }
  }

  const pickPhoto = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled) return
    await save(result.assets[0].uri)
  }

  const takePhoto = async (): Promise<void> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled) return
    await save(result.assets[0].uri)
  }

  const removePhoto = async (): Promise<void> => {
    await AsyncStorage.removeItem(PHOTO_KEY)
    setPhotoUri(null)
  }

  return { photoUri, loading, pickPhoto, takePhoto, removePhoto }
}
