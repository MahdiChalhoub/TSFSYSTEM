/**
 * Client Portal Types
 * ===================
 * TypeScript type definitions for client-facing portal features.
 */

import type { Contact } from './crm'

// ============================================================================
// WALLET TYPES
// ============================================================================

export interface ClientWallet {
  id: number
  organization_id: number
  contact_id: number
  contact?: Contact
  balance: number
  loyalty_points: number
  lifetime_points: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type WalletTransactionType = 'CREDIT' | 'DEBIT'

export interface WalletTransaction {
  id: number
  organization_id: number
  wallet_id: number
  wallet?: ClientWallet
  transaction_type: WalletTransactionType
  amount: number
  balance_after: number
  reason: string
  reference_type: string
  reference_id?: number
  created_at: string
}

export interface WalletCreditRequest {
  amount: number
  reason?: string
  reference_type?: string
  reference_id?: number
}

export interface WalletDebitRequest {
  amount: number
  reason?: string
  reference_type?: string
  reference_id?: number
}

// ============================================================================
// COUPON TYPES
// ============================================================================

export type CouponDiscountType = 'PERCENT' | 'FIXED'

export interface Coupon {
  id: number
  organization_id: number
  code: string
  description: string
  discount_type: CouponDiscountType
  value: number
  min_order_amount: number
  max_discount_amount?: number
  max_uses?: number
  used_count: number
  one_per_customer: boolean
  valid_from?: string
  valid_until?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CouponUsage {
  id: number
  organization_id: number
  coupon_id: number
  coupon?: Coupon
  contact_id?: number
  contact?: Contact
  order_id: number
  discount_applied: number
  used_at: string
}

export interface CouponValidationRequest {
  code: string
  order_subtotal: number
}

export interface CouponValidationResponse {
  valid: boolean
  coupon?: Coupon
  discount_amount?: number
  error_message?: string
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export type ClientOrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export interface ClientOrder {
  id: number
  organization_id: number
  order_number: string
  contact_id: number
  contact?: Contact
  status: ClientOrderStatus

  // Amounts
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_cost: number
  total_amount: number
  currency: string

  // Delivery
  shipping_address?: string
  delivery_date?: string
  tracking_number?: string

  // Ratings
  quality_rating?: number
  delivery_rating?: number

  // Payment
  payment_status?: string
  payment_method?: string

  // Relations
  invoice_id?: number
  lines: ClientOrderLine[]

  // Metadata
  notes?: string
  created_at: string
  updated_at: string
}

export interface ClientOrderLine {
  id: number
  organization_id: number
  order_id: number
  product_id: number
  product_name: string
  variant_id?: number
  quantity: number
  unit_price: number
  tax_rate: number
  discount_percent: number
  line_total: number
  tax_amount: number
  sort_order: number
}

export interface ClientOrderCreateRequest {
  contact_id: number
  lines: Array<{
    product_id: number
    variant_id?: number
    quantity: number
    unit_price?: number
  }>
  shipping_address?: string
  coupon_code?: string
  notes?: string
}

// ============================================================================
// QUOTE TYPES
// ============================================================================

export type QuoteStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'

export interface QuoteRequest {
  id: number
  organization_id: number
  contact_id: number
  contact?: Contact
  status: QuoteStatus
  description: string
  quantity_needed?: number
  budget_estimate?: number
  admin_notes?: string
  quoted_amount?: number
  quoted_at?: string
  valid_until?: string
  items: QuoteItem[]
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: number
  organization_id: number
  quote_request_id: number
  product_id?: number
  variant_id?: number
  product_name: string
  description?: string
  quantity: number
  unit_price?: number
  line_total?: number
  sort_order: number
}

export interface QuoteRequestCreateRequest {
  contact_id: number
  description: string
  quantity_needed?: number
  budget_estimate?: number
  items: Array<{
    product_id?: number
    variant_id?: number
    product_name: string
    description?: string
    quantity: number
  }>
}

// ============================================================================
// TICKET TYPES
// ============================================================================

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface ClientTicket {
  id: number
  organization_id: number
  ticket_number: string
  contact_id: number
  contact?: Contact
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assigned_to_id?: number
  resolved_at?: string
  resolution_notes?: string
  created_at: string
  updated_at: string
}

export interface ClientTicketCreateRequest {
  contact_id: number
  subject: string
  description: string
  priority?: TicketPriority
}

// ============================================================================
// SOCIAL / REVIEW TYPES
// ============================================================================

export interface ProductReview {
  id: number
  organization_id: number
  product_id: number
  contact_id: number
  contact?: Contact
  rating: number
  title?: string
  comment?: string
  is_verified_purchase: boolean
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface WishlistItem {
  id: number
  organization_id: number
  contact_id: number
  contact?: Contact
  product_id: number
  variant_id?: number
  added_at: string
}

// ============================================================================
// PROMOTION TYPES
// ============================================================================

export type PromotionConditionType = 'MIN_AMOUNT' | 'MIN_QUANTITY' | 'PRODUCT_IN_CART' | 'CATEGORY_IN_CART'
export type PromotionActionType = 'PERCENT_OFF' | 'FIXED_OFF' | 'FREE_SHIPPING' | 'BUY_X_GET_Y'

export interface CartPromotion {
  id: number
  organization_id: number
  name: string
  description?: string
  code?: string
  conditions: Array<{
    type: PromotionConditionType
    value: string | number
  }>
  actions: Array<{
    type: PromotionActionType
    value: string | number
  }>
  valid_from?: string
  valid_until?: string
  max_uses?: number
  used_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CartPromotionUsage {
  id: number
  organization_id: number
  promotion_id: number
  promotion?: CartPromotion
  order_id: number
  contact_id?: number
  discount_applied: number
  used_at: string
}

// ============================================================================
// SHIPPING TYPES
// ============================================================================

export interface ShippingRate {
  id: number
  organization_id: number
  name: string
  description?: string
  carrier?: string
  min_weight?: number
  max_weight?: number
  min_order_amount?: number
  base_rate: number
  per_kg_rate?: number
  delivery_days_min?: number
  delivery_days_max?: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ShippingCalculationRequest {
  weight: number
  order_amount: number
  destination_zone?: string
}

export interface ShippingCalculationResponse {
  available_rates: Array<{
    shipping_rate: ShippingRate
    calculated_cost: number
    estimated_delivery: string
  }>
}

// ============================================================================
// PORTAL CONFIG TYPES
// ============================================================================

export type PortalLayout = 'GRID' | 'LIST' | 'COMPACT'

export interface ClientPortalConfig {
  id: number
  organization_id: number

  // Branding
  logo_url?: string
  primary_color?: string
  secondary_color?: string

  // Features
  enable_wallet: boolean
  enable_loyalty: boolean
  enable_reviews: boolean
  enable_wishlist: boolean
  enable_quotes: boolean
  enable_tickets: boolean

  // Settings
  loyalty_points_per_currency_unit: number
  currency_per_loyalty_point: number
  default_layout: PortalLayout

  created_at: string
  updated_at: string
}

export interface ClientPortalAccess {
  id: number
  organization_id: number
  contact_id: number
  contact?: Contact
  user_id: number
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'PENDING'
  permissions: string[]
  granted_by_id?: number
  granted_at: string
  last_login?: string
  notes?: string
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface ClientDashboardStats {
  contact: Contact
  wallet: ClientWallet
  balance: {
    current_balance: number
    credit_limit: number
    available_credit: number
  }
  orders: {
    total_count: number
    pending_count: number
    total_amount: number
    recent: ClientOrder[]
  }
  tickets: {
    open_count: number
    recent: ClientTicket[]
  }
  available_coupons: Coupon[]
  loyalty: {
    current_points: number
    lifetime_points: number
    tier: string
    progress_to_next_tier: number
  }
}
