/**
 * CRM Module Types
 * =================
 * TypeScript type definitions for CRM entities (contacts, leads, pricing).
 */

// ============================================================================
// CONTACT TYPES
// ============================================================================

export type ContactType = 'CUSTOMER' | 'SUPPLIER' | 'LEAD' | 'PARTNER' | 'CREDITOR' | 'DEBTOR'

export type SupplierCategory = 'REGULAR' | 'DEPOT_VENTE' | 'MIXED'

export type CustomerTier = 'STANDARD' | 'VIP' | 'WHOLESALE' | 'RETAIL'

export type SupplierVATRegime = 'ASSUJETTI' | 'NON_ASSUJETTI' | 'FOREIGN'

export type ClientType = 'B2B' | 'B2C' | 'UNKNOWN'

export type CommercialCategory =
  | 'RETAIL'
  | 'WHOLESALE'
  | 'NORMAL'
  | 'FOREIGN'
  | 'MICRO'
  | 'B2B_ASSUJETTI'
  | 'B2B_NON_ASSUJETTI'
  | 'B2C'
  | 'INSTITUTIONAL'
  | 'EXPORT'

export interface Contact {
  id: number
  organization_id: number

  // Basic Info
  type: ContactType
  name: string
  company_name?: string
  email?: string
  phone?: string
  address?: string
  website?: string
  vat_id?: string
  notes?: string
  is_active: boolean

  // Financial
  balance: number
  credit_limit: number
  opening_balance: number
  current_balance: number
  linked_account_id?: number
  payment_terms_days: number
  preferred_payment_method?: string

  // Customer-specific
  customer_type?: string
  customer_tier?: CustomerTier
  loyalty_points: number
  wallet_balance: number
  home_zone_id?: number

  // Customer Analytics (auto-computed)
  first_purchase_date?: string
  last_purchase_date?: string
  total_orders: number
  lifetime_value: number
  average_order_value: number

  // Supplier-specific
  supplier_category?: SupplierCategory
  home_site_id?: number
  default_cost_basis?: 'HT' | 'TTC'

  // Supplier Performance
  overall_rating: number
  quality_rating: number
  delivery_rating: number
  pricing_rating: number
  service_rating: number
  total_ratings: number
  supplier_total_orders: number
  on_time_deliveries: number
  late_deliveries: number
  total_purchase_amount: number
  avg_lead_time_days: number

  // Tax & Compliance
  airsi_tax_rate: number
  is_airsi_subject: boolean
  supplier_vat_regime?: SupplierVATRegime
  client_type?: ClientType
  commercial_category?: CommercialCategory
  tax_profile_id?: number
  is_eu_supplier: boolean
  vat_number_eu?: string
  country_code?: string

  // External integrations
  whatsapp_group_id?: string

  // Audit
  created_at: string
  updated_at: string
}

export interface ContactSummary {
  contact: Contact
  orders: {
    stats: {
      total_count: number
      total_amount: number
      completed: number
      draft: number
    }
    recent: Array<{
      id: number
      ref_code: string
      status: string
      total_amount: number
      tax_amount: number
      payment_method?: string
      created_at: string
      invoice_number?: string
    }>
  }
  payments: {
    stats: {
      total_paid: number
      payment_count: number
    }
    recent: Array<{
      id: number
      reference: string
      amount: number
      payment_date: string
      method: string
      status: string
      description?: string
    }>
  }
  balance: {
    current_balance: number
    last_payment_date?: string
  }
  journal_entries: Array<{
    id: number
    date?: string
    reference: string
    description: string
    account?: string
    debit: number
    credit: number
  }>
  analytics: {
    avg_order_value: number
    total_orders: number
    total_revenue: number
    top_products: Array<{
      product_name: string
      total_qty: number
      total_revenue: number
    }>
    monthly_frequency: number
  }
  pricing_rules: ClientPriceRule[]
}

export interface LoyaltyAnalytics {
  contact: Contact
  loyalty_points: number
  lifetime_points: number
  tier: CustomerTier
  next_tier?: CustomerTier
  points_to_next_tier?: number
  rewards_available: Array<{
    id: number
    name: string
    points_required: number
    description: string
  }>
  recent_activity: Array<{
    date: string
    action: 'EARN' | 'BURN'
    points: number
    description: string
  }>
}

export interface SupplierScorecard {
  contact: Contact
  overall_rating: number
  ratings: {
    quality: number
    delivery: number
    pricing: number
    service: number
  }
  delivery_performance: {
    on_time_rate: number
    total_deliveries: number
    on_time_deliveries: number
    late_deliveries: number
    avg_lead_time_days: number
  }
  financial_summary: {
    total_purchase_amount: number
    total_orders: number
    avg_order_value: number
  }
  recent_orders: Array<{
    id: number
    ref_code: string
    date: string
    total_amount: number
    status: string
  }>
}

// ============================================================================
// PRICING TYPES
// ============================================================================

export type PriceRuleType = 'FIXED' | 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT' | 'MARKUP_PERCENT'

export interface PriceGroup {
  id: number
  organization_id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PriceGroupMember {
  id: number
  organization_id: number
  price_group_id: number
  contact_id: number
  price_group?: PriceGroup
  contact?: Contact
  created_at: string
}

export interface ClientPriceRule {
  id: number
  organization_id: number

  // Scope
  contact_id?: number
  price_group_id?: number
  product_id?: number
  category_id?: number

  // Rule
  rule_type: PriceRuleType
  value: number
  min_quantity?: number
  max_quantity?: number

  // Validity
  valid_from?: string
  valid_until?: string
  is_active: boolean
  priority: number

  // Relations
  contact?: Contact
  price_group?: PriceGroup

  created_at: string
  updated_at: string
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface ContactFilters {
  type?: ContactType
  search?: string
  customer_tier?: CustomerTier
  supplier_category?: SupplierCategory
  is_active?: boolean
  limit?: number
  offset?: number
}

export interface ContactCreateInput {
  type: ContactType
  name: string
  company_name?: string
  email?: string
  phone?: string
  address?: string
  website?: string
  vat_id?: string
  credit_limit?: number
  customer_tier?: CustomerTier
  supplier_category?: SupplierCategory
  payment_terms_days?: number
  notes?: string
}

export interface ContactUpdateInput extends Partial<ContactCreateInput> {
  is_active?: boolean
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ContactListResponse {
  results: Contact[]
  count: number
  next?: string
  previous?: string
}

export interface EarnPointsRequest {
  order_total: number
}

export interface EarnPointsResponse {
  contact: Contact
  points_earned: number
  new_total: number
  message: string
}

export interface BurnPointsRequest {
  points: number
}

export interface BurnPointsResponse {
  contact: Contact
  points_redeemed: number
  discount_amount: number
  new_balance: number
  message: string
}

export interface RateSupplierRequest {
  quality: number
  delivery: number
  pricing: number
  service: number
}

export interface RateSupplierResponse {
  contact: Contact
  new_ratings: {
    quality: number
    delivery: number
    pricing: number
    service: number
    overall: number
  }
  message: string
}
