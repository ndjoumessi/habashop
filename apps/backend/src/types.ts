export interface JWTPayload {
  userId:   string
  tenantId: string
  role:     string
}

export interface LoginBody {
  email:    string
  password: string
}

export interface RegisterBody {
  shopName:   string
  ownerName?: string
  name?:      string
  email:      string
  password:   string
  currency?:  string
  country?:   string
  language?:  string
  phone?:     string
}

export interface BillingBody {
  plan:          string
  period:        string
  paymentMethod: string
  paymentRef?:   string
  notes?:        string
}

// Typage du JWT : request.user = payload signé
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}
// request.tenantId injecté par le middleware authenticate
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string
  }
}
