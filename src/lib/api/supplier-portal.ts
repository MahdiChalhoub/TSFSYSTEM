/**
 * Supplier Portal API Client
 * ===========================
 * API functions for supplier-facing portal features.
 */

import { erpFetchJSON } from '@/lib/erp-fetch'
import type {
  SupplierPortalAccess,
  SupplierProforma,
  ProformaCreateRequest,
  ProformaUpdateRequest,
  ProformaTransitionRequest,
  PriceChangeRequest,
  PriceChangeRequestCreateRequest,
  PriceChangeRequestReviewRequest,
  PriceChangeRequestAcceptRequest,
  SupplierNotification,
  NotificationMarkReadRequest,
  SupplierPortalConfig,
  SupplierBalance,
  SupplierStatement,
  SupplierProductPerformance,
  SupplierProductPerformanceList,
  PurchaseOrderSupplierView,
  SupplierDashboardStats,
} from '@/types/supplier-portal'

// ============================================================================
// SUPPLIER PORTAL ACCESS
// ============================================================================

export const supplierPortalAPI = {
  /**
   * Get portal access for current supplier user
   */
  getPortalAccess: async (): Promise<SupplierPortalAccess> => {
    return erpFetchJSON<SupplierPortalAccess>('/supplier-portal/access/me/')
  },

  /**
   * Check if user has specific permission
   */
  hasPermission: async (permission: string): Promise<{ has_permission: boolean }> => {
    return erpFetchJSON<{ has_permission: boolean }>(
      `/supplier-portal/access/check-permission/?permission=${permission}`
    )
  },

  // ============================================================================
  // PROFORMA INVOICES
  // ============================================================================

  /**
   * Get all proformas for current supplier
   */
  getProformas: async (filters?: {
    status?: string
    limit?: number
  }): Promise<SupplierProforma[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.limit) params.append('limit', String(filters.limit))
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<SupplierProforma[]>(`/supplier-portal/proformas/${query}`)
  },

  /**
   * Get single proforma
   */
  getProforma: async (id: number): Promise<SupplierProforma> => {
    return erpFetchJSON<SupplierProforma>(`/supplier-portal/proformas/${id}/`)
  },

  /**
   * Create new proforma
   */
  createProforma: async (request: ProformaCreateRequest): Promise<SupplierProforma> => {
    return erpFetchJSON<SupplierProforma>('/supplier-portal/proformas/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Update proforma (only in DRAFT status)
   */
  updateProforma: async (
    id: number,
    request: ProformaUpdateRequest
  ): Promise<SupplierProforma> => {
    return erpFetchJSON<SupplierProforma>(`/supplier-portal/proformas/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
  },

  /**
   * Delete proforma (only in DRAFT status)
   */
  deleteProforma: async (id: number): Promise<void> => {
    return erpFetchJSON<void>(`/supplier-portal/proformas/${id}/`, {
      method: 'DELETE',
    })
  },

  /**
   * Submit proforma for review
   */
  submitProforma: async (id: number): Promise<SupplierProforma> => {
    return erpFetchJSON<SupplierProforma>(`/supplier-portal/proformas/${id}/submit/`, {
      method: 'POST',
    })
  },

  /**
   * Transition proforma status
   */
  transitionProforma: async (
    id: number,
    request: ProformaTransitionRequest
  ): Promise<SupplierProforma> => {
    return erpFetchJSON<SupplierProforma>(`/supplier-portal/proformas/${id}/transition/`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Cancel proforma
   */
  cancelProforma: async (id: number, reason?: string): Promise<SupplierProforma> => {
    return erpFetchJSON<SupplierProforma>(`/supplier-portal/proformas/${id}/cancel/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  // ============================================================================
  // PRICE CHANGE REQUESTS
  // ============================================================================

  /**
   * Get all price change requests
   */
  getPriceChangeRequests: async (filters?: {
    status?: string
    product_id?: number
  }): Promise<PriceChangeRequest[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.product_id) params.append('product_id', String(filters.product_id))
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<PriceChangeRequest[]>(`/supplier-portal/price-requests/${query}`)
  },

  /**
   * Get single price change request
   */
  getPriceChangeRequest: async (id: number): Promise<PriceChangeRequest> => {
    return erpFetchJSON<PriceChangeRequest>(`/supplier-portal/price-requests/${id}/`)
  },

  /**
   * Create price change request
   */
  createPriceChangeRequest: async (
    request: PriceChangeRequestCreateRequest
  ): Promise<PriceChangeRequest> => {
    return erpFetchJSON<PriceChangeRequest>('/supplier-portal/price-requests/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Accept counter-proposal
   */
  acceptCounterProposal: async (id: number): Promise<PriceChangeRequest> => {
    return erpFetchJSON<PriceChangeRequest>(`/supplier-portal/price-requests/${id}/accept-counter/`, {
      method: 'POST',
    })
  },

  /**
   * Decline counter-proposal
   */
  declineCounterProposal: async (id: number, reason?: string): Promise<PriceChangeRequest> => {
    return erpFetchJSON<PriceChangeRequest>(`/supplier-portal/price-requests/${id}/decline-counter/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Get all notifications
   */
  getNotifications: async (filters?: {
    is_read?: boolean
    limit?: number
  }): Promise<SupplierNotification[]> => {
    const params = new URLSearchParams()
    if (filters?.is_read !== undefined) params.append('is_read', String(filters.is_read))
    if (filters?.limit) params.append('limit', String(filters.limit))
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<SupplierNotification[]>(`/supplier-portal/notifications/${query}`)
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<{ count: number }> => {
    return erpFetchJSON<{ count: number }>('/supplier-portal/notifications/unread-count/')
  },

  /**
   * Mark notifications as read
   */
  markNotificationsRead: async (request: NotificationMarkReadRequest): Promise<void> => {
    return erpFetchJSON<void>('/supplier-portal/notifications/mark-read/', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Mark single notification as read
   */
  markNotificationRead: async (id: number): Promise<SupplierNotification> => {
    return erpFetchJSON<SupplierNotification>(`/supplier-portal/notifications/${id}/mark-read/`, {
      method: 'POST',
    })
  },

  // ============================================================================
  // STATEMENT OF ACCOUNT
  // ============================================================================

  /**
   * Get supplier balance
   */
  getBalance: async (supplierId: number): Promise<SupplierBalance> => {
    return erpFetchJSON<SupplierBalance>(`/supplier-portal/balance/?supplier_id=${supplierId}`)
  },

  /**
   * Get full statement of account with transaction history
   */
  getStatement: async (
    supplierId: number,
    filters?: { from_date?: string; to_date?: string }
  ): Promise<SupplierStatement> => {
    const params = new URLSearchParams()
    params.append('supplier_id', String(supplierId))
    if (filters?.from_date) params.append('from_date', filters.from_date)
    if (filters?.to_date) params.append('to_date', filters.to_date)
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<SupplierStatement>(`/supplier-portal/statement/${query}`)
  },

  /**
   * Download statement as PDF
   */
  downloadStatement: async (
    supplierId: number,
    filters?: { from_date?: string; to_date?: string }
  ): Promise<Blob> => {
    const params = new URLSearchParams()
    params.append('supplier_id', String(supplierId))
    if (filters?.from_date) params.append('from_date', filters.from_date)
    if (filters?.to_date) params.append('to_date', filters.to_date)
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<Blob>(`/supplier-portal/statement/pdf/${query}`, {
      headers: { Accept: 'application/pdf' },
    })
  },

  // ============================================================================
  // PRODUCTS & PERFORMANCE
  // ============================================================================

  /**
   * Get supplier's product catalog with performance metrics
   */
  getProductPerformance: async (supplierId: number): Promise<SupplierProductPerformanceList> => {
    return erpFetchJSON<SupplierProductPerformanceList>(
      `/supplier-portal/products/performance/?supplier_id=${supplierId}`
    )
  },

  /**
   * Get single product performance
   */
  getSingleProductPerformance: async (
    supplierId: number,
    productId: number
  ): Promise<SupplierProductPerformance> => {
    return erpFetchJSON<SupplierProductPerformance>(
      `/supplier-portal/products/performance/${productId}/?supplier_id=${supplierId}`
    )
  },

  // ============================================================================
  // PURCHASE ORDERS (Read-only supplier view)
  // ============================================================================

  /**
   * Get purchase orders for this supplier
   */
  getPurchaseOrders: async (filters?: {
    status?: string
    limit?: number
  }): Promise<PurchaseOrderSupplierView[]> => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.limit) params.append('limit', String(filters.limit))
    const query = params.toString() ? `?${params.toString()}` : ''
    return erpFetchJSON<PurchaseOrderSupplierView[]>(`/supplier-portal/purchase-orders/${query}`)
  },

  /**
   * Get single purchase order details
   */
  getPurchaseOrder: async (id: number): Promise<PurchaseOrderSupplierView> => {
    return erpFetchJSON<PurchaseOrderSupplierView>(`/supplier-portal/purchase-orders/${id}/`)
  },

  /**
   * Mark PO as shipped
   */
  markOrderShipped: async (
    id: number,
    data: { tracking_number?: string; notes?: string }
  ): Promise<PurchaseOrderSupplierView> => {
    return erpFetchJSON<PurchaseOrderSupplierView>(`/supplier-portal/purchase-orders/${id}/ship/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Upload document to PO (invoice, packing slip, etc.)
   */
  uploadPODocument: async (
    id: number,
    file: File,
    documentType: string
  ): Promise<{ message: string; document_url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)

    return erpFetchJSON<{ message: string; document_url: string }>(
      `/supplier-portal/purchase-orders/${id}/upload-document/`,
      {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for FormData
        headers: {},
      }
    )
  },

  // ============================================================================
  // PORTAL CONFIG
  // ============================================================================

  /**
   * Get supplier portal configuration
   */
  getPortalConfig: async (): Promise<SupplierPortalConfig> => {
    return erpFetchJSON<SupplierPortalConfig>('/supplier-portal/config/')
  },

  /**
   * Get dashboard stats
   */
  getDashboardStats: async (supplierId: number): Promise<SupplierDashboardStats> => {
    return erpFetchJSON<SupplierDashboardStats>(
      `/supplier-portal/dashboard/?supplier_id=${supplierId}`
    )
  },
}

export default supplierPortalAPI
