/**
 * Client Portal API Client
 * =========================
 * API functions for client-facing portal features.
 */

import { erpFetchJSON } from '@/lib/erp-fetch'
import type {
  ClientWallet,
  WalletTransaction,
  WalletCreditRequest,
  WalletDebitRequest,
  Coupon,
  CouponUsage,
  CouponValidationRequest,
  CouponValidationResponse,
  ClientOrder,
  ClientOrderCreateRequest,
  QuoteRequest,
  QuoteRequestCreateRequest,
  ClientTicket,
  ClientTicketCreateRequest,
  ProductReview,
  WishlistItem,
  CartPromotion,
  ShippingRate,
  ShippingCalculationRequest,
  ShippingCalculationResponse,
  ClientPortalConfig,
  ClientPortalAccess,
  ClientDashboardStats,
} from '@/types/client-portal'

// ============================================================================
// WALLET
// ============================================================================

export const clientPortalAPI = {
  /**
   * Get client wallet
   */
  getWallet: async (contactId: number): Promise<ClientWallet> => {
    return erpFetchJSON<ClientWallet>(`/client-portal/wallets/${contactId}/`)
  },

  /**
   * Get wallet transactions
   */
  getWalletTransactions: async (walletId: number): Promise<WalletTransaction[]> => {
    return erpFetchJSON<WalletTransaction[]>(`/client-portal/wallets/${walletId}/transactions/`)
  },

  /**
   * Credit wallet (add funds)
   */
  creditWallet: async (
    walletId: number,
    request: WalletCreditRequest
  ): Promise<WalletTransaction> => {
    return erpFetchJSON<WalletTransaction>(`/client-portal/wallets/${walletId}/credit/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Debit wallet (use funds)
   */
  debitWallet: async (
    walletId: number,
    request: WalletDebitRequest
  ): Promise<WalletTransaction> => {
    return erpFetchJSON<WalletTransaction>(`/client-portal/wallets/${walletId}/debit/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Redeem loyalty points for wallet credit
   */
  redeemLoyaltyPoints: async (
    walletId: number,
    points: number
  ): Promise<WalletTransaction> => {
    return erpFetchJSON<WalletTransaction>(`/client-portal/wallets/${walletId}/redeem-points/`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    })
  },

  // ============================================================================
  // COUPONS
  // ============================================================================

  /**
   * Get all active coupons
   */
  getCoupons: async (filters?: { is_active?: boolean }): Promise<Coupon[]> => {
    const params = new URLSearchParams()
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<Coupon[]>(`/client-portal/coupons/${query}`)
  },

  /**
   * Validate coupon code and calculate discount
   */
  validateCoupon: async (
    request: CouponValidationRequest
  ): Promise<CouponValidationResponse> => {
    return erpFetchJSON<CouponValidationResponse>('/client-portal/coupons/validate/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Get coupon usage history for a contact
   */
  getCouponUsageHistory: async (contactId: number): Promise<CouponUsage[]> => {
    return erpFetchJSON<CouponUsage[]>(`/client-portal/coupons/usage/?contact_id=${contactId}`)
  },

  // ============================================================================
  // ORDERS
  // ============================================================================

  /**
   * Get client orders
   */
  getOrders: async (filters?: {
    contact_id?: number
    status?: string
    limit?: number
  }): Promise<ClientOrder[]> => {
    const params = new URLSearchParams()
    if (filters?.contact_id) params.append('contact_id', String(filters.contact_id))
    if (filters?.status) params.append('status', filters.status)
    if (filters?.limit) params.append('limit', String(filters.limit))
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<ClientOrder[]>(`/client-portal/orders/${query}`)
  },

  /**
   * Get single order details
   */
  getOrder: async (id: number): Promise<ClientOrder> => {
    return erpFetchJSON<ClientOrder>(`/client-portal/orders/${id}/`)
  },

  /**
   * Create new order
   */
  createOrder: async (request: ClientOrderCreateRequest): Promise<ClientOrder> => {
    return erpFetchJSON<ClientOrder>('/client-portal/orders/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Download order invoice (PDF)
   */
  downloadInvoice: async (orderId: number): Promise<Blob> => {
    return erpFetchJSON<Blob>(`/client-portal/orders/${orderId}/invoice/`, {
      headers: { Accept: 'application/pdf' },
    })
  },

  /**
   * Rate an order (quality, delivery)
   */
  rateOrder: async (
    orderId: number,
    ratings: { quality_rating: number; delivery_rating: number }
  ): Promise<ClientOrder> => {
    return erpFetchJSON<ClientOrder>(`/client-portal/orders/${orderId}/rate/`, {
      method: 'POST',
      body: JSON.stringify(ratings),
    })
  },

  // ============================================================================
  // QUOTES
  // ============================================================================

  /**
   * Get quote requests
   */
  getQuotes: async (contactId: number): Promise<QuoteRequest[]> => {
    return erpFetchJSON<QuoteRequest[]>(`/client-portal/quotes/?contact_id=${contactId}`)
  },

  /**
   * Get single quote
   */
  getQuote: async (id: number): Promise<QuoteRequest> => {
    return erpFetchJSON<QuoteRequest>(`/client-portal/quotes/${id}/`)
  },

  /**
   * Create quote request
   */
  createQuote: async (request: QuoteRequestCreateRequest): Promise<QuoteRequest> => {
    return erpFetchJSON<QuoteRequest>('/client-portal/quotes/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Accept quote
   */
  acceptQuote: async (id: number): Promise<QuoteRequest> => {
    return erpFetchJSON<QuoteRequest>(`/client-portal/quotes/${id}/accept/`, {
      method: 'POST',
    })
  },

  /**
   * Reject quote
   */
  rejectQuote: async (id: number, reason?: string): Promise<QuoteRequest> => {
    return erpFetchJSON<QuoteRequest>(`/client-portal/quotes/${id}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  // ============================================================================
  // TICKETS
  // ============================================================================

  /**
   * Get support tickets
   */
  getTickets: async (contactId: number): Promise<ClientTicket[]> => {
    return erpFetchJSON<ClientTicket[]>(`/client-portal/tickets/?contact_id=${contactId}`)
  },

  /**
   * Get single ticket
   */
  getTicket: async (id: number): Promise<ClientTicket> => {
    return erpFetchJSON<ClientTicket>(`/client-portal/tickets/${id}/`)
  },

  /**
   * Create support ticket
   */
  createTicket: async (request: ClientTicketCreateRequest): Promise<ClientTicket> => {
    return erpFetchJSON<ClientTicket>('/client-portal/tickets/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  // ============================================================================
  // REVIEWS & WISHLIST
  // ============================================================================

  /**
   * Get product reviews
   */
  getProductReviews: async (productId: number): Promise<ProductReview[]> => {
    return erpFetchJSON<ProductReview[]>(`/client-portal/reviews/?product_id=${productId}`)
  },

  /**
   * Create product review
   */
  createReview: async (
    data: Omit<ProductReview, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
  ): Promise<ProductReview> => {
    return erpFetchJSON<ProductReview>('/client-portal/reviews/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Get wishlist
   */
  getWishlist: async (contactId: number): Promise<WishlistItem[]> => {
    return erpFetchJSON<WishlistItem[]>(`/client-portal/wishlist/?contact_id=${contactId}`)
  },

  /**
   * Add item to wishlist
   */
  addToWishlist: async (data: {
    contact_id: number
    product_id: number
    variant_id?: number
  }): Promise<WishlistItem> => {
    return erpFetchJSON<WishlistItem>('/client-portal/wishlist/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Remove from wishlist
   */
  removeFromWishlist: async (id: number): Promise<void> => {
    return erpFetchJSON<void>(`/client-portal/wishlist/${id}/`, {
      method: 'DELETE',
    })
  },

  // ============================================================================
  // PROMOTIONS & SHIPPING
  // ============================================================================

  /**
   * Get active promotions
   */
  getPromotions: async (): Promise<CartPromotion[]> => {
    return erpFetchJSON<CartPromotion[]>('/client-portal/promotions/?is_active=true')
  },

  /**
   * Get shipping rates
   */
  getShippingRates: async (): Promise<ShippingRate[]> => {
    return erpFetchJSON<ShippingRate[]>('/client-portal/shipping-rates/?is_active=true')
  },

  /**
   * Calculate shipping cost
   */
  calculateShipping: async (
    request: ShippingCalculationRequest
  ): Promise<ShippingCalculationResponse> => {
    return erpFetchJSON<ShippingCalculationResponse>('/client-portal/shipping-rates/calculate/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  // ============================================================================
  // PORTAL ACCESS & CONFIG
  // ============================================================================

  /**
   * Get portal config
   */
  getPortalConfig: async (): Promise<ClientPortalConfig> => {
    return erpFetchJSON<ClientPortalConfig>('/client-portal/config/')
  },

  /**
   * Get portal access for current user
   */
  getPortalAccess: async (): Promise<ClientPortalAccess> => {
    return erpFetchJSON<ClientPortalAccess>('/client-portal/access/me/')
  },

  /**
   * Get dashboard stats
   */
  getDashboardStats: async (contactId: number): Promise<ClientDashboardStats> => {
    return erpFetchJSON<ClientDashboardStats>(`/client-portal/dashboard/?contact_id=${contactId}`)
  },
}

export default clientPortalAPI
