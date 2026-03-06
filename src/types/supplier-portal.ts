/**
 * Supplier Portal Types
 * =====================
 * TypeScript type definitions for supplier-facing portal features.
 */

import type { Contact } from './crm'

// ============================================================================
// SUPPLIER PORTAL ACCESS
// ============================================================================

export interface SupplierPortalAccess {
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

export const SUPPLIER_PERMISSIONS = {
  VIEW_OWN_ORDERS: 'VIEW_OWN_ORDERS',
  VIEW_OWN_STOCK: 'VIEW_OWN_STOCK',
  VIEW_OWN_STATEMENT: 'VIEW_OWN_STATEMENT',
  CREATE_PROFORMA: 'CREATE_PROFORMA',
  REQUEST_PRICE_CHANGE: 'REQUEST_PRICE_CHANGE',
  VIEW_PRODUCT_PERFORMANCE: 'VIEW_PRODUCT_PERFORMANCE',
} as const

export type SupplierPermission = typeof SUPPLIER_PERMISSIONS[keyof typeof SUPPLIER_PERMISSIONS]

// ============================================================================
// PROFORMA TYPES
// ============================================================================

export type ProformaStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEGOTIATING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'CANCELLED'

export interface SupplierProforma {
  id: number
  organization_id: number
  proforma_number: string
  status: ProformaStatus

  // Supplier
  supplier_id: number
  supplier?: Contact
  created_by_supplier_id?: number

  // Delivery
  expected_delivery_date?: string
  delivery_terms?: string

  // Financials
  currency: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number

  // Validity
  valid_until?: string

  // Notes & Communication
  supplier_notes?: string
  internal_notes?: string
  rejection_reason?: string
  negotiation_notes?: string

  // Approval tracking
  submitted_at?: string
  reviewed_by_id?: number
  reviewed_at?: string

  // Linked PO (after conversion)
  purchase_order_id?: number

  // Relations
  lines: ProformaLine[]

  // Audit
  created_at: string
  updated_at: string
}

export interface ProformaLine {
  id: number
  organization_id: number
  proforma_id: number
  product_id: number
  product?: {
    id: number
    name: string
    sku?: string
  }
  description?: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount_percent: number
  line_total: number
  tax_amount: number
  sort_order: number
}

export interface ProformaCreateRequest {
  supplier_id: number
  expected_delivery_date?: string
  delivery_terms?: string
  supplier_notes?: string
  lines: Array<{
    product_id: number
    description?: string
    quantity: number
    unit_price: number
    tax_rate?: number
    discount_percent?: number
  }>
}

export interface ProformaUpdateRequest {
  expected_delivery_date?: string
  delivery_terms?: string
  supplier_notes?: string
  lines?: Array<{
    id?: number
    product_id: number
    description?: string
    quantity: number
    unit_price: number
    tax_rate?: number
    discount_percent?: number
  }>
}

export interface ProformaTransitionRequest {
  new_status: ProformaStatus
  reason?: string
}

export const PROFORMA_STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: '#94a3b8' },
  SUBMITTED: { label: 'Submitted', color: '#6366f1' },
  UNDER_REVIEW: { label: 'Under Review', color: '#f59e0b' },
  NEGOTIATING: { label: 'Negotiating', color: '#8b5cf6' },
  APPROVED: { label: 'Approved', color: '#22c55e' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
  CONVERTED: { label: 'Converted to PO', color: '#10b981' },
  CANCELLED: { label: 'Cancelled', color: '#64748b' },
} as const

// ============================================================================
// PRICE CHANGE REQUEST TYPES
// ============================================================================

export type PriceChangeRequestType = 'SELLING' | 'PURCHASE'
export type PriceChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COUNTER' | 'ACCEPTED'

export interface PriceChangeRequest {
  id: number
  organization_id: number
  supplier_id: number
  supplier?: Contact
  requested_by_id?: number
  product_id: number
  product?: {
    id: number
    name: string
    sku?: string
  }
  request_type: PriceChangeRequestType
  status: PriceChangeStatus
  current_price: number
  proposed_price: number
  counter_price?: number
  reason?: string
  review_notes?: string
  effective_date?: string
  reviewed_by_id?: number
  reviewed_at?: string
  created_at: string
  updated_at: string
}

export interface PriceChangeRequestCreateRequest {
  supplier_id: number
  product_id: number
  request_type: PriceChangeRequestType
  current_price: number
  proposed_price: number
  reason?: string
  effective_date?: string
}

export interface PriceChangeRequestReviewRequest {
  status: 'APPROVED' | 'REJECTED' | 'COUNTER'
  review_notes?: string
  counter_price?: number
}

export interface PriceChangeRequestAcceptRequest {
  accept_counter: boolean
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type SupplierNotificationType =
  | 'ORDER_UPDATE'
  | 'PROFORMA_STATUS'
  | 'PRICE_RESPONSE'
  | 'STOCK_ALERT'
  | 'GENERAL'

export interface SupplierNotification {
  id: number
  organization_id: number
  supplier_id: number
  supplier?: Contact
  notification_type: SupplierNotificationType
  title: string
  message: string
  is_read: boolean
  read_at?: string
  related_object_type?: string
  related_object_id?: number
  created_at: string
}

export interface NotificationMarkReadRequest {
  notification_ids: number[]
}

// ============================================================================
// SUPPLIER PORTAL CONFIG
// ============================================================================

export interface SupplierPortalConfig {
  id: number
  organization_id: number

  // Proforma Workflow
  proforma_auto_approve_threshold: number
  require_negotiation_notes: boolean
  default_currency: string

  // Feature Toggles
  enable_price_requests: boolean
  enable_stock_visibility: boolean
  enable_statement_view: boolean

  // Status labels (custom per org)
  proforma_status_config: Record<ProformaStatus, { label: string; color: string }>

  created_at: string
  updated_at: string
}

// ============================================================================
// SUPPLIER BALANCE (Statement of Account)
// ============================================================================

export interface SupplierBalance {
  id: number
  organization_id: number
  contact_id: number
  contact?: Contact
  current_balance: number
  last_payment_date?: string
  last_invoice_date?: string
  updated_at: string
}

export interface SupplierStatement {
  supplier: Contact
  balance: SupplierBalance
  transactions: Array<{
    id: number
    date: string
    reference: string
    description: string
    type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'ADJUSTMENT'
    debit: number
    credit: number
    balance: number
  }>
  summary: {
    opening_balance: number
    total_invoices: number
    total_payments: number
    closing_balance: number
  }
}

// ============================================================================
// PRODUCT PERFORMANCE (for supplier view)
// ============================================================================

export interface SupplierProductPerformance {
  product_id: number
  product_name: string
  sku?: string
  current_purchase_price: number
  total_quantity_ordered: number
  total_orders: number
  total_revenue: number
  last_order_date?: string
  avg_lead_time_days: number
  stock_level?: number
  reorder_point?: number
}

export interface SupplierProductPerformanceList {
  supplier: Contact
  products: SupplierProductPerformance[]
  summary: {
    total_products: number
    total_orders: number
    total_revenue: number
    avg_lead_time: number
  }
}

// ============================================================================
// PURCHASE ORDER (Supplier view - read-only)
// ============================================================================

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'

export interface PurchaseOrderSupplierView {
  id: number
  order_number: string
  status: PurchaseOrderStatus
  supplier_id: number
  supplier?: Contact
  order_date: string
  expected_delivery_date?: string
  delivery_address?: string
  currency: string
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_terms_days: number
  notes?: string
  lines: Array<{
    id: number
    product_id: number
    product_name: string
    quantity: number
    unit_price: number
    line_total: number
    received_quantity: number
  }>
  created_at: string
  updated_at: string
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface SupplierDashboardStats {
  supplier: Contact
  balance: SupplierBalance
  proformas: {
    total_count: number
    draft_count: number
    pending_count: number
    approved_count: number
    recent: SupplierProforma[]
  }
  purchase_orders: {
    total_count: number
    active_count: number
    total_amount: number
    recent: PurchaseOrderSupplierView[]
  }
  notifications: {
    unread_count: number
    recent: SupplierNotification[]
  }
  performance: {
    overall_rating: number
    on_time_delivery_rate: number
    total_deliveries: number
    avg_lead_time_days: number
  }
  price_requests: {
    pending_count: number
    recent: PriceChangeRequest[]
  }
}
