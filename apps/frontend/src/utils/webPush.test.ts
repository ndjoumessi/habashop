import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from './webPush'

// La clé VAPID publique (base64url) doit devenir l'exact tableau d'octets attendu par
// pushManager.subscribe (applicationServerKey). Un décodage faux = abonnement rejeté par
// le navigateur, silencieusement.
describe('urlBase64ToUint8Array', () => {
  it('décode le base64url standard (- et _ → + et /)', () => {
    // "Ma" en base64 = "TWE=" ; en base64url sans padding = "TWE"
    expect(Array.from(urlBase64ToUint8Array('TWE'))).toEqual([0x4d, 0x61])
  })

  it('rétablit le padding manquant', () => {
    // 'A' → un octet 0x00 ('A' = 0 en base64)
    expect(Array.from(urlBase64ToUint8Array('AA'))).toEqual([0])
  })

  it('gère les caractères url-safe - et _', () => {
    // base64 "+/" ↔ base64url "-_" → octets 0xFB 0xFF
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff])
  })

  it('produit un Uint8Array adossé à un ArrayBuffer (accepté comme applicationServerKey)', () => {
    const u = urlBase64ToUint8Array('TWE')
    expect(u.buffer).toBeInstanceOf(ArrayBuffer)
  })
})
