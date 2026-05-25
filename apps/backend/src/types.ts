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
