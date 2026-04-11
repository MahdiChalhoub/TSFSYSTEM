/**
 * Ledger Types
 * ==============
 * Shared types for the Finance Ledger module.
 */

export type JournalEntry = Record<string, any>

export type Lookup = { id: number; name: string }
export type Lookups = { fiscalYears: Lookup[]; users: Lookup[] }

export interface LedgerFilters {
  status: string
  entryType: string
  journalType: string
  fiscalYear: string
  scope: string
  user: string
  autoSource: string
  isLocked: string
  isVerified: string
  sourceModule: string
  dateFrom: string
  dateTo: string
}

export type ViewProfile = {
  id: string
  name: string
  columns: Record<string, boolean>
  filters: Record<string, boolean>
}
