/**
 * PO Types
 * =========
 * Shared types for the Purchase Orders module.
 */

import type { NumericRange } from '@/components/ui/NumericRangeFilter'

export type PO = Record<string, any>

export interface Filters {
  status: string
  priority: string
  purchaseSubType: string
  supplier: string
  warehouse: string
  currency: string
  invoicePolicy: string
  amountRange: NumericRange
}
