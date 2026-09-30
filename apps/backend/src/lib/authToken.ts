/**
 * FORME DU PAYLOAD JWT — SOURCE UNIQUE.
 *
 * ⚠️ Toute route qui émet un jeton passe par ici. La forme vivait en closure locale dans
 * `authRoutes` ; une seconde route d'émission (la démo en libre-service) aurait dû la
 * recopier, et un payload d'authentification recopié divergerait en silence — c'est
 * `authenticate` qui en paierait le prix, pas l'émetteur.
 *
 * ⚠️ `tenantId` et `activeTenantId` portent la MÊME valeur sur un jeton à boutique active.
 * Ce n'est pas une redondance : `getTenantId()` lit le premier (JWT, hérité) et
 * `getActiveTenantId()` le second (boutique résolue) — deux champs, deux helpers, et les
 * confondre casse les routes platform-scopées (cf. CLAUDE.md § Multi-boutiques).
 */

/** Durée de vie d'un jeton. Identique pour les deux formes — une divergence serait un piège. */
export const TOKEN_TTL = '7d'

/** Le minimum que l'on exige d'une instance Fastify : le décorateur @fastify/jwt. */
export interface JwtSigner {
  jwt: { sign(payload: object, opts: object): string }
}

export interface ActiveTokenClaims {
  userId: string
  role: string
  tenantId: string
  isPlatformAdmin?: boolean
}

export interface NoTenantTokenClaims {
  userId: string
  role: string
  isPlatformAdmin?: boolean
}

/** Jeton AVEC boutique active (mono-boutique, ou après bascule). */
export function signActiveToken(app: JwtSigner, c: ActiveTokenClaims): string {
  return app.jwt.sign(
    {
      userId: c.userId,
      role: c.role,
      tenantId: c.tenantId,
      activeTenantId: c.tenantId,
      isPlatformAdmin: c.isPlatformAdmin ?? false,
    },
    { expiresIn: TOKEN_TTL },
  )
}

/** Jeton SANS boutique active — le front affiche le sélecteur avant d'entrer. */
export function signNoTenantToken(app: JwtSigner, c: NoTenantTokenClaims): string {
  return app.jwt.sign(
    {
      userId: c.userId,
      role: c.role,
      tenantId: null,
      activeTenantId: null,
      isPlatformAdmin: c.isPlatformAdmin ?? false,
    },
    { expiresIn: TOKEN_TTL },
  )
}
