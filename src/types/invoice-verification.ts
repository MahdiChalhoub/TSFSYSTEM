/**
 * INVOICE VERIFICATION TYPES
 * ===========================
 * TypeScript types for 3-way matching and invoice verification workflow
 */

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'DISPUTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'POSTED'
  | 'PAID'

export type MatchStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'PARTIAL'
  | 'MISSING_PO'
  | 'MISSING_GRN'

export interface InvoiceListItem {
  id: number
  invoice_number: string | null
  type: string
  status: InvoiceStatus
  supplier_id: number
  supplier_name: string
  issue_date: string | null
  due_date: string | null
  subtotal: number
  tax_amount: number
  total_amount: number
  currency: string
  payment_blocked: boolean
  dispute_reason: string | null
  disputed_lines_count: number
  disputed_amount_delta: number

  // PO data
  po_number: string | null
  po_total: number | null
  po_status: string | null

  // GRN data
  grn_number: string | null
  grn_date: string | null
  grn_status: string | null

  // Document
  document_url: string | null
  has_document: boolean

  // Metadata
  line_count: number
}

export interface InvoiceDetail {
  invoice: {
    id: number
    invoice_number: string | null
    status: InvoiceStatus
    supplier_name: string
    supplier_id: number
    issue_date: string | null
    due_date: string | null
    subtotal: number
    tax_amount: number
    total_amount: number
    currency: string
    payment_blocked: boolean
    dispute_reason: string | null
    document_url: string | null
  }
  purchase_order: {
    po_number: string
    status: string
    order_date: string | null
    expected_date: string | null
    subtotal: number
    tax_amount: number
    total_amount: number
  } | null
  goods_receipt: {
    grn_number: string
    receipt_date: string | null
    status: string
    received_by: string | null
  } | null
  comparison: ComparisonLine[]
  can_verify: boolean
  can_reject: boolean
}

export interface ComparisonLine {
  product_id: number
  product_name: string
  invoice: {
    quantity: number
    unit_price: number
    subtotal: number
    tax: number
    total: number
  }
  po: {
    quantity: number
    unit_price: number
    subtotal: number
  } | null
  grn: {
    quantity: number
    date: string | null
  } | null
  match_status: MatchStatus
}

export interface VerifyResponse {
  success: boolean
  message: string
  violations?: Array<{
    line_id: number
    product: string
    invoice_qty: number
    allowed_qty: number
    excess: number
    excess_amount: number
  }>
  invoice_status: InvoiceStatus
  payment_blocked?: boolean
  verified_at?: string
}

export interface RejectRequest {
  reason: string
}

export interface RejectResponse {
  success: boolean
  message: string
  invoice_status: InvoiceStatus
  rejected_at: string
}

export interface HoldRequest {
  reason?: string
}

export interface HoldResponse {
  success: boolean
  message: string
  invoice_status: InvoiceStatus
}

export interface UploadDocumentResponse {
  success: boolean
  message: string
  document_url: string
}
