// Clé d'idempotence pour les ventes (UUID v4). Pas besoin de cryptographie : on veut
// seulement une valeur UNIQUE par tentative de vente, que le backend utilise pour dédup
// (mêmes garanties qu'un UUID ; Math.random suffit ici, comme les ids de la file offline).
export function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
