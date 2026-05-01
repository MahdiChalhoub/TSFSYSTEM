/**
 * Ledger Constants
 * ==================
 * Status configs, column/filter definitions, and formatters.
 */

/* ── Status / Type Configs ── */
export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  POSTED: { label: 'Posted', color: 'var(--app-success, #22c55e)' },
  DRAFT: { label: 'Draft', color: 'var(--app-warning, #f59e0b)' },
  REVERSED: { label: 'Reversed', color: 'var(--app-error, #ef4444)' },
}

export const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  MANUAL: { label: 'Manual', color: 'var(--app-primary)' },
  AUTO: { label: 'Auto', color: 'var(--app-accent)' },
}

export const AUTO_SOURCE_CONFIG: Record<string, string> = {
  INVOICE: 'Invoicing Engine',
  PAYMENT: 'Payment Gateway',
  RETURN: 'Return Handler',
  PAYROLL: 'HR Core',
}

/* ── Column Definitions ── */
export const ALL_COLUMNS: { key: string; label: string; defaultVisible: boolean }[] = [
  { key: 'reference', label: 'Reference', defaultVisible: true },
  { key: 'journalType', label: 'Journal Type', defaultVisible: false },
  { key: 'scope', label: 'Scope', defaultVisible: false },
  { key: 'sourceModule', label: 'Source Module', defaultVisible: false },
  { key: 'sourceModel', label: 'Source Document', defaultVisible: false },
  { key: 'sourceId', label: 'Source ID', defaultVisible: false },
  { key: 'totalDebit', label: 'Total Debit', defaultVisible: true },
  { key: 'totalCredit', label: 'Total Credit', defaultVisible: true },
  { key: 'lineCount', label: 'Lines', defaultVisible: true },
  { key: 'currency', label: 'Currency', defaultVisible: false },
  { key: 'exchangeRate', label: 'Exchange Rate', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'isLocked', label: 'Locked', defaultVisible: false },
  { key: 'isVerified', label: 'Verified', defaultVisible: false },
  { key: 'date', label: 'Posting Date', defaultVisible: true },
  { key: 'fiscalYear', label: 'Fiscal Year', defaultVisible: false },
  { key: 'fiscalPeriod', label: 'Fiscal Period', defaultVisible: false },
  { key: 'postedAt', label: 'Posted At', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false },
  { key: 'createdBy', label: 'Created By', defaultVisible: false },
  { key: 'postedBy', label: 'Posted By', defaultVisible: false },
  { key: 'entryHash', label: 'Entry Hash', defaultVisible: false },
  { key: 'site', label: 'Site / Warehouse', defaultVisible: false },
]

export const COLUMN_WIDTHS: Record<string, string> = {
  reference: 'w-24', journalType: 'w-20', scope: 'w-16',
  sourceModule: 'w-20', sourceModel: 'w-20', sourceId: 'w-14',
  totalDebit: 'w-24', totalCredit: 'w-24', lineCount: 'w-14',
  currency: 'w-14', exchangeRate: 'w-16',
  status: 'w-16', isLocked: 'w-14', isVerified: 'w-14',
  date: 'w-20', fiscalYear: 'w-20', fiscalPeriod: 'w-20',
  postedAt: 'w-20', createdAt: 'w-20', updatedAt: 'w-20',
  createdBy: 'w-20', postedBy: 'w-20', entryHash: 'w-24', site: 'w-20',
}
export const RIGHT_COLS = new Set(['totalDebit', 'totalCredit', 'lineCount', 'exchangeRate', 'sourceId'])
export const CENTER_COLS = new Set(['isLocked', 'isVerified'])

/* ── Filter Definitions ── */
export const ALL_FILTERS: { key: string; label: string; defaultVisible: boolean }[] = [
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'entryType', label: 'Entry Type', defaultVisible: true },
  { key: 'journalType', label: 'Journal Type', defaultVisible: true },
  { key: 'fiscalYear', label: 'Fiscal Year', defaultVisible: true },
  { key: 'scope', label: 'Scope', defaultVisible: true },
  { key: 'user', label: 'Initiator', defaultVisible: true },
  { key: 'autoSource', label: 'Auto Source', defaultVisible: true },
  { key: 'isLocked', label: 'Locked', defaultVisible: false },
  { key: 'isVerified', label: 'Verified', defaultVisible: false },
  { key: 'sourceModule', label: 'Source Module', defaultVisible: false },
  { key: 'currency', label: 'Currency', defaultVisible: false },
  { key: 'dateFrom', label: 'Date From', defaultVisible: true },
  { key: 'dateTo', label: 'Date To', defaultVisible: true },
]

/* ── Defaults ── */
export const DEFAULT_VISIBLE_COLS = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))
export const DEFAULT_VISIBLE_FILTERS = Object.fromEntries(ALL_FILTERS.map(f => [f.key, f.defaultVisible]))

import type { LedgerFilters } from './types'
export const EMPTY_FILTERS: LedgerFilters = {
  status: '', entryType: '', journalType: '', fiscalYear: '',
  scope: '', user: '', autoSource: '', isLocked: '', isVerified: '',
  sourceModule: '', dateFrom: '', dateTo: '',
}

/* ── Utility ── */
/** Defensive array coercion — prevents .filter() crashes from unexpected API shapes */
export function toArr(v: any): any[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object' && Array.isArray(v.results)) return v.results
  return []
}
