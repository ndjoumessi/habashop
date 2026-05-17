import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import toast from 'react-hot-toast'

export default function PWAInstallButton() {
  const { lang } = useAppStore()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled,    setIsInstalled]    = useState(false)
  const [showBanner,     setShowBanner]     = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      setShowBanner(false)
      toast.success(
        lang === 'fr' ? '✅ HabaShop installé !'
        : lang === 'en' ? '✅ HabaShop installed!'
        : lang === 'es' ? '✅ HabaShop instalado!'
        : '✅ HabaShop installato!'
      )
    }
    setDeferredPrompt(null)
  }

  if (isInstalled || !showBanner) return null

  const TEXTS = {
    fr: { title:"Installer HabaShop", desc:"Accès rapide depuis votre écran d'accueil", btn:'Installer', dismiss:'Plus tard' },
    en: { title:'Install HabaShop',   desc:'Quick access from your home screen',        btn:'Install',   dismiss:'Later'     },
    es: { title:'Instalar HabaShop',  desc:'Acceso rápido desde su pantalla de inicio', btn:'Instalar',  dismiss:'Más tarde' },
    it: { title:'Installa HabaShop',  desc:'Accesso rapido dalla schermata iniziale',   btn:'Installa',  dismiss:'Più tardi' },
  }
  const tx = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.fr

  return (
    <div style={{
      position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
      zIndex:1000,
      background:'var(--card)', border:'1px solid var(--border2)',
      borderRadius:16, padding:'16px 20px',
      boxShadow:'0 20px 60px rgba(0,0,0,.4)',
      display:'flex', alignItems:'center', gap:16,
      maxWidth:400, width:'calc(100% - 32px)',
      animation:'slideUp .3s ease',
    }}>
      <div style={{
        width:48, height:48, borderRadius:12, flexShrink:0,
        background:'linear-gradient(135deg,var(--p),var(--p2))',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, fontWeight:900, color:'#fff',
      }}>H</div>

      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:2 }}>{tx.title}</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>{tx.desc}</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <button onClick={handleInstall} style={{
          background:'linear-gradient(135deg,var(--p),var(--p2))',
          border:'none', borderRadius:9, padding:'7px 16px',
          fontSize:12, fontWeight:700, color:'#fff',
          cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap',
        }}>{tx.btn}</button>
        <button onClick={() => setShowBanner(false)} style={{
          background:'none', border:'none', fontSize:11,
          color:'var(--text3)', cursor:'pointer', fontFamily:'var(--font)',
        }}>{tx.dismiss}</button>
      </div>
    </div>
  )
}
