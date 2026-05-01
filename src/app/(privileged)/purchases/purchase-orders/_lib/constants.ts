/**
 * PO Constants
 * =============
 * Configuration constants, formatters, and lookup options for Purchase Orders.
 */

import { EMPTY_RANGE } from '@/components/ui/NumericRangeFilter'
import type { Filters } from './types'

/* ── Status Config ── */
export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'var(--app-muted-foreground)' },
  SUBMITTED: { label: 'Pending', color: 'var(--app-warning)' },
  APPROVED: { label: 'Approved', color: 'var(--app-info)' },
  REJECTED: { label: 'Rejected', color: 'var(--app-error)' },
  ORDERED: { label: 'Ordered', color: 'var(--app-accent)' },
  SENT: { label: 'Sent', color: 'var(--app-accent-cyan)' },
  CONFIRMED: { label: 'Confirmed', color: '#14b8a6' },
  IN_TRANSIT: { label: 'In Transit', color: 'var(--app-warning)' },
  PARTIALLY_RECEIVED: { label: 'Partial', color: 'var(--app-warning)' },
  RECEIVED: { label: 'Received', color: 'var(--app-success, #22c55e)' },
  INVOICED: { label: 'Invoiced', color: 'var(--app-accent)' },
  COMPLETED: { label: 'Complete', color: 'var(--app-success, #22c55e)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--app-error, #ef4444)' },
}

/* ── Formatter ── */
export const fmt = (n: number | string | null | undefined) => {
  if (n == null || n === '') return '—'
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
}

/* ── Column Definitions ── */
export const ALL_COLUMNS: { key: string; label: string; defaultVisible: boolean }[] = [
  // Supplier is already shown in the row title — NOT repeated as a column
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'date', label: 'Order Date', defaultVisible: true },
  { key: 'expected', label: 'Expected', defaultVisible: true },
  { key: 'amount', label: 'Total TTC', defaultVisible: true },
  { key: 'lines', label: 'Lines', defaultVisible: true },
  { key: 'receiving', label: 'Receiving', defaultVisible: true },
  { key: 'warehouse', label: 'Warehouse', defaultVisible: true },
  { key: 'priority', label: 'Priority', defaultVisible: false },
  { key: 'subtype', label: 'Type', defaultVisible: false },
  { key: 'scope', label: 'Scope', defaultVisible: false },
  { key: 'currency', label: 'Currency', defaultVisible: false },
  { key: 'supplierRef', label: 'Supplier Ref', defaultVisible: false },
  { key: 'subtotal', label: 'Subtotal HT', defaultVisible: false },
  { key: 'tax', label: 'Tax', defaultVisible: false },
  { key: 'shipping', label: 'Shipping', defaultVisible: false },
  { key: 'discount', label: 'Discount', defaultVisible: false },
  { key: 'invoicePolicy', label: 'Invoice Policy', defaultVisible: false },
  { key: 'received', label: 'Received Date', defaultVisible: false },
  { key: 'created', label: 'Created', defaultVisible: false },
  { key: 'createdBy', label: 'Created By', defaultVisible: false },
]

export const COLUMN_WIDTHS: Record<string, string> = {
  status: 'w-24', date: 'w-20', expected: 'w-20', amount: 'w-24',
  lines: 'w-12', receiving: 'w-24', warehouse: 'w-24',
  priority: 'w-16', subtype: 'w-20', scope: 'w-16', currency: 'w-14', supplierRef: 'w-20',
  subtotal: 'w-20', tax: 'w-16', shipping: 'w-16', discount: 'w-16',
  invoicePolicy: 'w-20', received: 'w-20', created: 'w-20', createdBy: 'w-20',
}

export const RIGHT_ALIGNED_COLS = new Set(['amount', 'subtotal', 'tax', 'shipping', 'discount', 'lines'])
export const DEFAULT_VISIBLE_COLS = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))

/* ── Filter Definitions ── */
export const ALL_FILTERS: { key: string; label: string; defaultVisible: boolean }[] = [
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'priority', label: 'Priority', defaultVisible: true },
  { key: 'purchaseSubType', label: 'Purchase Type', defaultVisible: true },
  { key: 'supplier', label: 'Supplier', defaultVisible: true },
  { key: 'warehouse', label: 'Warehouse', defaultVisible: false },
  { key: 'currency', label: 'Currency', defaultVisible: false },
  { key: 'amountRange', label: 'Total Amount', defaultVisible: true },
  { key: 'invoicePolicy', label: 'Invoice Policy', defaultVisible: false },
]
export const DEFAULT_VISIBLE_FILTERS = Object.fromEntries(ALL_FILTERS.map(f => [f.key, f.defaultVisible]))

/* ── Empty Filters ── */
export const EMPTY_FILTERS: Filters = {
  status: '', priority: '', purchaseSubType: '', supplier: '',
  warehouse: '', currency: '', invoicePolicy: '',
  amountRange: { ...EMPTY_RANGE },
}

/* ── Lookup Options ── */
export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]
export const SUBTYPE_OPTIONS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'CONSIGNEE', label: 'Consignee' },
]
export const INVOICE_POLICY_OPTIONS = [
  { value: 'RECEIVED_QTY', label: 'Received Qty' },
  { value: 'ORDERED_QTY', label: 'Ordered Qty' },
]
