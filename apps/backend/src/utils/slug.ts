// Slugs réservés : doivent matcher 1) tous les paths racine (Vite Router)
// 2) tout ce qui pourrait être confondu avec un namespace système.
export const RESERVED_SLUGS = new Set<string>([
  'login', 'signup', 'pricing', 'privacy', 'terms',
  'app', 'api', 'admin', 'about', 'contact', 'help',
  'support', 'blog', 'docs', 'shop', 'public', 'static',
  'assets', 'c', 'catalog', 'catalogue',
  'onboarding', 'settings', 'dashboard',
])

export function slugify(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 50) return false
  if (RESERVED_SLUGS.has(slug)) return false
  return SLUG_REGEX.test(slug)
}

export async function generateUniqueSlug(
  prismaClient: { tenant: { findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown> } },
  name: string,
  tenantId: string,
): Promise<string> {
  let base = slugify(name)
  if (!base || base.length < 3 || RESERVED_SLUGS.has(base)) {
    base = `shop-${tenantId.slice(0, 6)}`
  }
  let candidate = base
  let n = 2
  // Limite raisonnable : 100 itérations puis fallback timestamp pour éviter boucle infinie
  while (await prismaClient.tenant.findFirst({ where: { slug: candidate, NOT: { id: tenantId } } })) {
    candidate = `${base}-${n}`
    n++
    if (n > 100) {
      candidate = `${base}-${Date.now().toString(36)}`
      break
    }
  }
  return candidate
}
