import { useEffect } from 'react'
import { router } from 'expo-router'
export default function POSTab() {
  useEffect(()=>{ router.replace('/(app)/pos') },[])
  return null
}
