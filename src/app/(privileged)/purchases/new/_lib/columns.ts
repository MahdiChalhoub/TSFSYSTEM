/**
 * PO Intelligence Grid — Column Definitions & Types
 * ===================================================
 * Shared between ColumnVisibility panel and profile persistence.
 * Extracted to break circular dependencies.
 */

export type ColumnKey =
    | 'requested'
    | 'required'
    | 'stock'
    | 'poCount'
    | 'status'
    | 'sales'
    | 'score'
    | 'purchased'
    | 'cost'
    | 'supplier'
    | 'expiry'

export type ColumnDef = { key: ColumnKey; label: string; sublabel?: string; alwaysVisible?: boolean }

export const COLUMN_DEFS: ColumnDef[] = [
    { key: 'requested', label: 'Requested' },
    { key: 'required', label: 'Required', sublabel: 'proposed' },
    { key: 'stock', label: 'Stock', sublabel: 'transit / total' },
    { key: 'poCount', label: 'PO Count' },
    { key: 'status', label: 'Status' },
    { key: 'sales', label: 'Sales', sublabel: 'monthly' },
    { key: 'score', label: 'Score', sublabel: 'adjust' },
    { key: 'purchased', label: 'Purchased', sublabel: 'sold' },
    { key: 'cost', label: 'Cost', sublabel: 'sell price', alwaysVisible: true },
    { key: 'supplier', label: 'Supplier', sublabel: 'price' },
    { key: 'expiry', label: 'Expiry', sublabel: 'safety' },
]

/** Default visible columns — all on */
export const DEFAULT_VISIBLE: Set<ColumnKey> = new Set(COLUMN_DEFS.map(c => c.key))

/** Default column order */
export const DEFAULT_ORDER: ColumnKey[] = COLUMN_DEFS.map(c => c.key)
