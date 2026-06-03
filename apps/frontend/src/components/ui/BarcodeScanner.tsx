import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualVal, setManualVal] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()

    const start = async () => {
      try {
        setScanning(true)
        setError(null)

        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (devices.length === 0) { setError('Aucune caméra détectée'); return }

        const backCamera = devices.find(d =>
          /back|rear|environment/i.test(d.label)
        ) ?? devices[0]

        const controls = await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current!,
          (result) => {
            if (result) {
              onScan(result.getText())
              setScanning(false)
              controls?.stop()
            }
          }
        )
        controlsRef.current = controls
      } catch (err: any) {
        setError(err.message ?? 'Erreur caméra — vérifiez les permissions')
        setScanning(false)
      }
    }

    start()
    return () => { controlsRef.current?.stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submitManual = () => {
    if (manualVal.trim()) { onScan(manualVal.trim()); onClose() }
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'rgba(0,0,0,.85)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:16,
    }}>
      <div style={{
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:20, padding:24, width:'100%', maxWidth:480,
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontSize:16, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>📷 Scanner un code-barres</h3>
          <button onClick={onClose} style={{
            background:'var(--bg3)', border:'none', borderRadius:8,
            width:32, height:32, cursor:'pointer', fontSize:16, color:'var(--text)',
          }}>✕</button>
        </div>

        {error ? (
          /* ── Mode erreur / saisie manuelle ── */
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📷</div>
            <div style={{ fontWeight:'var(--fw-semibold)', fontSize:14, color:'var(--danger)', marginBottom:6 }}>
              Impossible d'accéder à la caméra
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>{error}</div>
            <div style={{ textAlign:'left' }}>
              <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>
                Saisir manuellement
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  className="input" style={{ flex:1 }} placeholder="EAN-13, QR code..."
                  value={manualVal} onChange={e => setManualVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitManual()}
                  autoFocus
                />
                <button className="topbar-btn" onClick={submitManual}>✓</button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Mode caméra ── */
          <>
            <div style={{ position:'relative', borderRadius:12, overflow:'hidden', marginBottom:16, background:'#000', minHeight:200 }}>
              <video ref={videoRef} style={{ width:'100%', maxHeight:280, objectFit:'cover', display:'block' }} muted playsInline />
              {/* Viseur */}
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <div style={{
                  width:220, height:130,
                  border:'2.5px solid var(--p2)', borderRadius:10,
                  boxShadow:'0 0 0 9999px rgba(0,0,0,.45)',
                  position:'relative', overflow:'hidden',
                }}>
                  <div style={{
                    position:'absolute', left:0, right:0, height:2,
                    background:'var(--p2)', boxShadow:'0 0 10px var(--p2)',
                    animation:'barcodeScan 2s linear infinite',
                  }} />
                </div>
              </div>
            </div>

            <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', marginBottom:16 }}>
              {scanning ? '🔍 Pointez la caméra vers le code-barres…' : '✅ Code détecté !'}
            </div>

            {/* Saisie manuelle alternative */}
            <div style={{ padding:'10px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>
                Ou saisir manuellement
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  className="input" style={{ flex:1, fontSize:13 }} placeholder="EAN-13..."
                  value={manualVal} onChange={e => setManualVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitManual()}
                />
                <button className="mini-btn" onClick={submitManual}>✓</button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes barcodeScan {
          0%   { top: 0; }
          50%  { top: calc(100% - 2px); }
          100% { top: 0; }
        }
      `}</style>
    </div>
  )
}
