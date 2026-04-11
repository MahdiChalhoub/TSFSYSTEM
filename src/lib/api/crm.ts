/**
 * CRM API Client
 * ==============
 * API functions for CRM module (contacts, loyalty, pricing).
 */

import { erpFetchJSON } from '@/lib/erp-fetch'
import type {
  Contact,
  ContactListResponse,
  ContactFilters,
  ContactCreateInput,
  ContactUpdateInput,
  ContactSummary,
  LoyaltyAnalytics,
  SupplierScorecard,
  EarnPointsRequest,
  EarnPointsResponse,
  BurnPointsRequest,
  BurnPointsResponse,
  RateSupplierRequest,
  RateSupplierResponse,
  PriceGroup,
  PriceGroupMember,
  ClientPriceRule,
} from '@/types/crm'

// ============================================================================
// CONTACTS
// ============================================================================

export const crmAPI = {
  /**
   * Get list of contacts with optional filters
   */
  getContacts: async (filters?: ContactFilters): Promise<ContactListResponse> => {
    const params = new URLSearchParams()
    if (filters?.type) params.append('type', filters.type)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.customer_tier) params.append('customer_tier', filters.customer_tier)
    if (filters?.supplier_category) params.append('supplier_category', filters.supplier_category)
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.offset) params.append('offset', String(filters.offset))

    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<ContactListResponse>(`/crm/contacts/${query}`)
  },

  /**
   * Get single contact by ID
   */
  getContact: async (id: number): Promise<Contact> => {
    return erpFetchJSON<Contact>(`/crm/contacts/${id}/`)
  },

  /**
   * Create new contact
   */
  createContact: async (data: ContactCreateInput): Promise<Contact> => {
    return erpFetchJSON<Contact>('/crm/contacts/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Update existing contact
   */
  updateContact: async (id: number, data: ContactUpdateInput): Promise<Contact> => {
    return erpFetchJSON<Contact>(`/crm/contacts/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /**
   * Delete contact
   */
  deleteContact: async (id: number): Promise<void> => {
    return erpFetchJSON<void>(`/crm/contacts/${id}/`, {
      method: 'DELETE',
    })
  },

  // ============================================================================
  // CONTACT ANALYTICS
  // ============================================================================

  /**
   * Get full contact summary with orders, payments, balance, journal entries
   */
  getContactSummary: async (id: number): Promise<ContactSummary> => {
    return erpFetchJSON<ContactSummary>(`/crm/contacts/${id}/summary/`)
  },

  // ============================================================================
  // LOYALTY PROGRAM
  // ============================================================================

  /**
   * Get customer loyalty analytics
   */
  getLoyaltyAnalytics: async (id: number): Promise<LoyaltyAnalytics> => {
    return erpFetchJSON<LoyaltyAnalytics>(`/crm/contacts/${id}/loyalty/`)
  },

  /**
   * Award loyalty points based on order total
   */
  earnLoyaltyPoints: async (
    id: number,
    request: EarnPointsRequest
  ): Promise<EarnPointsResponse> => {
    return erpFetchJSON<EarnPointsResponse>(`/crm/contacts/${id}/earn-points/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Redeem loyalty points for discount
   */
  burnLoyaltyPoints: async (
    id: number,
    request: BurnPointsRequest
  ): Promise<BurnPointsResponse> => {
    return erpFetchJSON<BurnPointsResponse>(`/crm/contacts/${id}/burn-points/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  // ============================================================================
  // SUPPLIER SCORECARD
  // ============================================================================

  /**
   * Get supplier performance scorecard
   */
  getSupplierScorecard: async (id: number): Promise<SupplierScorecard> => {
    return erpFetchJSON<SupplierScorecard>(`/crm/contacts/${id}/scorecard/`)
  },

  /**
   * Rate a supplier (quality, delivery, pricing, service)
   */
  rateSupplier: async (
    id: number,
    ratings: RateSupplierRequest
  ): Promise<RateSupplierResponse> => {
    return erpFetchJSON<RateSupplierResponse>(`/crm/contacts/${id}/rate/`, {
      method: 'POST',
      body: JSON.stringify(ratings),
    })
  },

  /**
   * Record delivery for supplier performance tracking
   */
  recordDelivery: async (
    id: number,
    data: { on_time: boolean; lead_time_days?: number }
  ): Promise<{ message: string }> => {
    return erpFetchJSON<{ message: string }>(`/crm/contacts/${id}/record-delivery/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // ============================================================================
  // PRICING RULES
  // ============================================================================

  /**
   * Get all price groups
   */
  getPriceGroups: async (): Promise<PriceGroup[]> => {
    return erpFetchJSON<PriceGroup[]>('/crm/price-groups/')
  },

  /**
   * Get single price group
   */
  getPriceGroup: async (id: number): Promise<PriceGroup> => {
    return erpFetchJSON<PriceGroup>(`/crm/price-groups/${id}/`)
  },

  /**
   * Create price group
   */
  createPriceGroup: async (
    data: Omit<PriceGroup, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
  ): Promise<PriceGroup> => {
    return erpFetchJSON<PriceGroup>('/crm/price-groups/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Get price group members
   */
  getPriceGroupMembers: async (priceGroupId: number): Promise<PriceGroupMember[]> => {
    return erpFetchJSON<PriceGroupMember[]>(`/crm/price-groups/${priceGroupId}/members/`)
  },

  /**
   * Add contact to price group
   */
  addPriceGroupMember: async (
    priceGroupId: number,
    contactId: number
  ): Promise<PriceGroupMember> => {
    return erpFetchJSON<PriceGroupMember>(`/crm/price-groups/${priceGroupId}/members/`, {
      method: 'POST',
      body: JSON.stringify({ contact_id: contactId }),
    })
  },

  /**
   * Get all client price rules
   */
  getClientPriceRules: async (filters?: {
    contact_id?: number
    price_group_id?: number
    product_id?: number
    is_active?: boolean
  }): Promise<ClientPriceRule[]> => {
    const params = new URLSearchParams()
    if (filters?.contact_id) params.append('contact_id', String(filters.contact_id))
    if (filters?.price_group_id) params.append('price_group_id', String(filters.price_group_id))
    if (filters?.product_id) params.append('product_id', String(filters.product_id))
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))

    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<ClientPriceRule[]>(`/crm/price-rules/${query}`)
  },

  /**
   * Create client price rule
   */
  createClientPriceRule: async (
    data: Omit<ClientPriceRule, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
  ): Promise<ClientPriceRule> => {
    return erpFetchJSON<ClientPriceRule>('/crm/price-rules/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Update client price rule
   */
  updateClientPriceRule: async (
    id: number,
    data: Partial<Omit<ClientPriceRule, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>
  ): Promise<ClientPriceRule> => {
    return erpFetchJSON<ClientPriceRule>(`/crm/price-rules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /**
   * Delete client price rule
   */
  deleteClientPriceRule: async (id: number): Promise<void> => {
    return erpFetchJSON<void>(`/crm/price-rules/${id}/`, {
      method: 'DELETE',
    })
  },
}

export default crmAPI
