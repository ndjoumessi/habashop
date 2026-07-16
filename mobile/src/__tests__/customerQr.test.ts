import { customerCodeFromQr, looksLikeCustomerCode, matchCustomerByCode, extractDirectCustomerId } from '@/lib/customerQr'

describe('extractDirectCustomerId', () => {
  it('extrait l\'id complet du format HABA-CUST:<id>', () => {
    expect(extractDirectCustomerId('HABA-CUST:demo-dkr-cust-3')).toBe('demo-dkr-cust-3')
    expect(extractDirectCustomerId('haba-cust:clx1a2b3c4d5e6f7g8h9')).toBe('clx1a2b3c4d5e6f7g8h9')
  })
  it('null pour les autres formats', () => {
    expect(extractDirectCustomerId('HABA-A1B2C3D4')).toBeNull()
    expect(extractDirectCustomerId('HS-clx123')).toBeNull()
    expect(extractDirectCustomerId('clx1a2b3c4d5e6f7g8h9')).toBeNull()
    expect(extractDirectCustomerId('')).toBeNull()
    expect(extractDirectCustomerId(null)).toBeNull()
  })
})

describe('customerCodeFromQr', () => {
  it('retire le préfixe HABA- et trim', () => {
    expect(customerCodeFromQr('HABA-A1B2C3D4')).toBe('A1B2C3D4')
    expect(customerCodeFromQr('  HABA-A1B2C3D4  ')).toBe('A1B2C3D4')
  })
  it('retire le préfixe HS- (générique) et le séparateur deux-points', () => {
    expect(customerCodeFromQr('HS-clx123')).toBe('clx123')
    expect(customerCodeFromQr('HABA:A1B2C3D4')).toBe('A1B2C3D4')
  })
  it('insensible à la casse du préfixe', () => {
    expect(customerCodeFromQr('haba-a1b2c3d4')).toBe('a1b2c3d4')
  })
  it('renvoie le contenu brut sans préfixe', () => {
    expect(customerCodeFromQr('clx1234567890abcdef')).toBe('clx1234567890abcdef')
  })
  it('null sur vide / null', () => {
    expect(customerCodeFromQr('')).toBeNull()
    expect(customerCodeFromQr('   ')).toBeNull()
    expect(customerCodeFromQr(null)).toBeNull()
    expect(customerCodeFromQr(undefined)).toBeNull()
  })
})

describe('looksLikeCustomerCode', () => {
  it('vrai pour HABA-CUST: (nouveau format)', () => {
    expect(looksLikeCustomerCode('HABA-CUST:demo-dkr-cust-3')).toBe(true)
  })
  it('vrai pour un préfixe HABA-/HS-', () => {
    expect(looksLikeCustomerCode('HABA-A1B2C3D4')).toBe(true)
    expect(looksLikeCustomerCode('HS-clx123')).toBe(true)
  })
  it('vrai pour un id CUID complet', () => {
    expect(looksLikeCustomerCode('clx1a2b3c4d5e6f7g8h9i0j')).toBe(true)
  })
  it('faux pour un code-barres produit (EAN)', () => {
    expect(looksLikeCustomerCode('6111245050034')).toBe(false)
    expect(looksLikeCustomerCode('3014260115425')).toBe(false)
  })
  it('faux pour vide', () => {
    expect(looksLikeCustomerCode('')).toBe(false)
    expect(looksLikeCustomerCode(null)).toBe(false)
  })
})

describe('matchCustomerByCode', () => {
  const customers = [
    { id: 'clx1a2b3c4d5e6f7g8h9' },        // préfixe 8 = "CLX1A2B3"
    { id: 'cmk9z8y7x6w5v4u3t2s1' },        // préfixe 8 = "CMK9Z8Y7"
    { id: 'demo-dkr-cust-3' },              // id lisible (nouveau format)
  ]

  it('matche par id complet depuis HABA-CUST: (nouveau format)', () => {
    expect(matchCustomerByCode('HABA-CUST:demo-dkr-cust-3', customers)?.id).toBe('demo-dkr-cust-3')
    expect(matchCustomerByCode('HABA-CUST:clx1a2b3c4d5e6f7g8h9', customers)?.id).toBe('clx1a2b3c4d5e6f7g8h9')
  })

  it('matche par préfixe 8 caractères en MAJUSCULES (ancien format)', () => {
    expect(matchCustomerByCode('HABA-CLX1A2B3', customers)?.id).toBe('clx1a2b3c4d5e6f7g8h9')
    expect(matchCustomerByCode('HABA-CMK9Z8Y7', customers)?.id).toBe('cmk9z8y7x6w5v4u3t2s1')
  })

  it('matche par id complet (insensible à la casse)', () => {
    expect(matchCustomerByCode('clx1a2b3c4d5e6f7g8h9', customers)?.id).toBe('clx1a2b3c4d5e6f7g8h9')
    expect(matchCustomerByCode('HS-CLX1A2B3C4D5E6F7G8H9', customers)?.id).toBe('clx1a2b3c4d5e6f7g8h9')
  })

  it('null si aucun client ne correspond', () => {
    expect(matchCustomerByCode('HABA-ZZZZZZZZ', customers)).toBeNull()
    expect(matchCustomerByCode('HABA-CUST:unknown-id', customers)).toBeNull()
    expect(matchCustomerByCode('6111245050034', customers)).toBeNull()
    expect(matchCustomerByCode('', customers)).toBeNull()
  })
})
