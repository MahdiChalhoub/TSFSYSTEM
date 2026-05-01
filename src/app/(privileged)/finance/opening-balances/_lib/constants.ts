/**
 * Opening Balances — Types & Constants
 * =======================================
 * Shared types and configuration for the Opening Balances module.
 */

/* ── Types ── */
export type OpeningLine = {
  id?: number;
  account?: { id?: number; code?: string; name?: string;[key: string]: unknown };
  debit?: number | string;
  credit?: number | string;
  description?: string;
  [key: string]: unknown;
};
export type OpeningEntry = {
  id: number;
  reference?: string;
  description?: string;
  status?: string;
  scope?: string;
  transactionDate?: string;
  transaction_date?: string;
  fiscalYear?: { id?: number; name?: string;[key: string]: unknown };
  fiscal_year?: { id?: number; name?: string;[key: string]: unknown };
  created_by?: { username?: string; first_name?: string;[key: string]: unknown };
  createdBy?: string;
  created_at?: string;
  lines?: OpeningLine[];
  [key: string]: unknown;
}

/* ── Status Config ── */
export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  POSTED: { label: 'Posted', color: 'var(--app-success, #22c55e)' },
  DRAFT: { label: 'Draft', color: 'var(--app-warning, #f59e0b)' },
  REVERSED: { label: 'Reversed', color: 'var(--app-error, #ef4444)' },
}

/* ── Column Definitions ── */
export const ALL_COLUMNS: { key: string; label: string; defaultVisible: boolean }[] = [
  { key: 'reference', label: 'Reference', defaultVisible: true },
  { key: 'date', label: 'Transaction Date', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'lineCount', label: 'Lines', defaultVisible: true },
  { key: 'totalDebit', label: 'Total Debit', defaultVisible: true },
  { key: 'totalCredit', label: 'Total Credit', defaultVisible: true },
  { key: 'fiscalYear', label: 'Fiscal Year', defaultVisible: true },
  { key: 'createdBy', label: 'Created By', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'scope', label: 'Scope', defaultVisible: false },
]

export const COLUMN_WIDTHS: Record<string, string> = {
  reference: 'w-24', date: 'w-24', status: 'w-20',
  lineCount: 'w-14', totalDebit: 'w-24', totalCredit: 'w-24',
  fiscalYear: 'w-20', createdBy: 'w-20', createdAt: 'w-20', scope: 'w-16',
}

export const RIGHT_COLS = new Set(['totalDebit', 'totalCredit', 'lineCount'])
export const CENTER_COLS = new Set<string>([])
export const GROW_COLS = new Set(['totalDebit', 'totalCredit', 'reference'])

/* ── Defaults ── */
export const DEFAULT_VISIBLE_COLS = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))

/* ── Utility ── */
export function toArr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v && typeof v === 'object' && Array.isArray((v as { results?: unknown[] }).results)) {
    return (v as { results: T[] }).results
  }
  return []
}
