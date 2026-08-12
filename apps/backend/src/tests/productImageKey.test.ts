import { describe, it, expect } from 'vitest'
import { sniffImageType, productImageKey, keyBelongsToTenant, publicUrlFor, keyFromPublicUrl } from '../lib/productImageKey'

/**
 * LES TROIS DÉCISIONS DE SÛRETÉ DU STOCKAGE — exercées sans réseau ni SDK.
 *
 * ⚠️ CE FICHIER GARDE DES PROPRIÉTÉS DE SÛRETÉ, PAS DES DÉTAILS DE FORME. Chaque
 * bloc a un témoin POSITIF et un témoin NÉGATIF : une règle qui accepte tout et
 * une règle qui refuse tout passent toutes deux un test à sens unique.
 */

const BASE = 'https://img.habashop.test'

// Fabrique des octets qui commencent par une signature donnée.
const octets = (...tete: number[]) => Buffer.concat([Buffer.from(tete), Buffer.alloc(64, 7)])
const JPEG = octets(0xff, 0xd8, 0xff, 0xe0)
const PNG  = octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64, 7)])

describe('sniffImageType — le type se lit dans les OCTETS', () => {
  it('accepte les trois formats retenus', () => {
    expect(sniffImageType(JPEG)).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
    expect(sniffImageType(PNG)).toEqual({ mime: 'image/png', ext: 'png' })
    expect(sniffImageType(WEBP)).toEqual({ mime: 'image/webp', ext: 'webp' })
  })

  it('⚠️ refuse ce qu’un `Content-Type` menteur ferait passer', () => {
    /**
     * LE CŒUR DU FICHIER. L'objet est servi PUBLIQUEMENT depuis un domaine à nous :
     * un HTML ou un SVG accepté s'exécute dans notre origine, chez le visiteur du
     * catalogue. Aucun de ces contenus n'a de signature d'image — c'est ce qui les
     * arrête, pas leur extension ni leur `mimetype` déclaré.
     */
    const refuses: [string, Buffer][] = [
      ['HTML',            Buffer.from('<!doctype html><script>alert(1)</script>')],
      ['SVG (texte)',     Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')],
      ['SVG + prologue',  Buffer.from('<?xml version="1.0"?><svg onload="alert(1)"/>')],
      ['texte nu',        Buffer.from('bonjour')],
      ['GIF (non retenu)', Buffer.from('GIF89a........')],
      ['PDF',             Buffer.from('%PDF-1.7\n')],
      ['vide',            Buffer.alloc(0)],
    ]
    for (const [nom, buf] of refuses) {
      expect(sniffImageType(buf), `${nom} ne doit pas passer`).toBeNull()
    }
  })

  it('⚠️ « RIFF » seul ne suffit PAS — un WAV n’est pas une image', () => {
    // RIFF sans le marqueur WEBP en position 8 : c'est un WAV ou un AVI.
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64)])
    expect(sniffImageType(wav)).toBeNull()
    // Contrôle : le MÊME buffer avec « WEBP » passe → c'est bien ce marqueur qui décide.
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64)])
    expect(sniffImageType(webp)?.ext).toBe('webp')
  })

  it('⚠️ la signature PNG est vérifiée sur HUIT octets, pas quatre', () => {
    // Les 4 premiers octets de PNG, suivis d'autre chose : refusé.
    expect(sniffImageType(octets(0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00))).toBeNull()
    expect(sniffImageType(PNG)?.ext, 'témoin positif').toBe('png')
  })
})

describe('productImageKey — cloisonnée par tenant, empreinte du contenu', () => {
  const A = Buffer.from('photo-a-'.repeat(8))
  const B = Buffer.from('photo-b-'.repeat(8))

  it('la clé porte le tenant ET le produit', () => {
    const k = productImageKey('tenant1', 'prod9', A, 'jpg')
    expect(k.startsWith('tenants/tenant1/products/prod9/')).toBe(true)
    expect(k.endsWith('.jpg')).toBe(true)
  })

  it('⚠️ mêmes octets ⇒ MÊME clé · octets différents ⇒ clé DIFFÉRENTE', () => {
    /**
     * Les deux moitiés comptent. L'idempotence évite d'écrire deux fois ; la
     * DIVERGENCE est ce qui invalide le cache — une URL fixe par produit servirait
     * l'ancienne photo depuis le service worker et l'AsyncStorage mobile, sans
     * aucun moyen de la chasser.
     */
    expect(productImageKey('t', 'p', A, 'jpg')).toBe(productImageKey('t', 'p', A, 'jpg'))
    expect(productImageKey('t', 'p', A, 'jpg')).not.toBe(productImageKey('t', 'p', B, 'jpg'))
  })

  it('keyBelongsToTenant : discriminant dans les deux sens', () => {
    const k = productImageKey('tenantA', 'p1', A, 'jpg')
    expect(keyBelongsToTenant(k, 'tenantA'), 'sa propre clé').toBe(true)
    expect(keyBelongsToTenant(k, 'tenantB'), 'la clé d’un autre').toBe(false)
    // Un préfixe qui RESSEMBLE sans être le bon ne doit pas passer.
    expect(keyBelongsToTenant('tenants/tenantAA/products/p1/' + 'a'.repeat(32) + '.jpg', 'tenantA')).toBe(false)
    // Une clé hors forme n'appartient à personne.
    expect(keyBelongsToTenant('tenants/tenantA/products/p1/pasunhash.jpg', 'tenantA')).toBe(false)
    expect(keyBelongsToTenant('n-importe-quoi', 'tenantA')).toBe(false)
  })
})

describe('⚠️ keyFromPublicUrl — le chemin retour, là où une erreur SUPPRIME', () => {
  const CLE = productImageKey('t1', 'p1', Buffer.from('x'.repeat(40)), 'jpg')
  const NOTRE_URL = publicUrlFor(CLE, BASE)

  it('témoin POSITIF — notre propre URL rend bien sa clé', () => {
    expect(keyFromPublicUrl(NOTRE_URL, BASE)).toBe(CLE)
    // Et la barre finale de la base ne change rien.
    expect(keyFromPublicUrl(NOTRE_URL, BASE + '/')).toBe(CLE)
  })

  it('⚠️ témoins NÉGATIFS — tout ce qui n’est pas manifestement à nous rend null', () => {
    /**
     * `Product.image` est une colonne texte libre : une valeur arbitraire peut s'y
     * trouver (héritée, importée, forgée). Rendre naïvement « ce qui suit le
     * domaine » ferait supprimer un objet qu'on n'a jamais écrit.
     */
    const cas: [string, string | null][] = [
      ['autre domaine',            `https://ailleurs.test/${CLE}`],
      ['même chemin, autre hôte',  `https://img.habashop.test.evil.test/${CLE}`],
      ['http au lieu de https',    NOTRE_URL.replace('https://', 'http://')],
      ['bonne base, clé forgée',   `${BASE}/tenants/t1/products/p1/../../../autre.jpg`],
      ['bonne base, hors forme',   `${BASE}/quelque/chose.jpg`],
      ['préfixe collé sans /',     `${BASE}xtenants/t1/products/p1/${'a'.repeat(32)}.jpg`],
      ['traversée encodée',        `${BASE}/tenants/t1/products/p1/%2e%2e%2f%2e%2e%2fsecret.jpg`],
      ['pas une URL du tout',      'photo.jpg'],
      ['chaîne vide',              ''],
      ['null',                     null],
    ]
    for (const [nom, url] of cas) {
      expect(keyFromPublicUrl(url, BASE), `${nom} ne doit rendre aucune clé`).toBeNull()
    }
  })

  it('⚠️ une base ABSENTE ne rend jamais de clé — pas de suppression à l’aveugle', () => {
    // Si `R2_PUBLIC_BASE_URL` manque, l'appelant passe ''. Le module ne doit pas
    // s'en accommoder en devinant.
    expect(keyFromPublicUrl(NOTRE_URL, '')).toBeNull()
    expect(keyFromPublicUrl(NOTRE_URL, 'pas-une-url')).toBeNull()
    expect(keyFromPublicUrl(NOTRE_URL, BASE), 'témoin positif').toBe(CLE)
  })
})
