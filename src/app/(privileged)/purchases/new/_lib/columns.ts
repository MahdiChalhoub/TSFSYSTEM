/**
 * PO Intelligence Grid — Column Definitions & Types
 * ===================================================
 * Shared between ColumnVisibility panel and profile persistence.
 * Extracted to break circular dependencies.
 */

export type ColumnKey =
    | 'qty'
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
    | 'supPlus'

export type ColumnDef = { 
    key: ColumnKey; 
    label: string; 
    sublabel?: string; 
    alwaysVisible?: boolean;
    defaultVisible: boolean;
}

export const COLUMN_DEFS: ColumnDef[] = [
    { key: 'qty', label: 'Qty', alwaysVisible: true, defaultVisible: true },
    { key: 'requested', label: 'Requested', alwaysVisible: true, defaultVisible: true },
    { key: 'required', label: 'Required', sublabel: 'proposed', defaultVisible: true },
    { key: 'stock', label: 'Stock', sublabel: 'transit / total', defaultVisible: true },
    { key: 'poCount', label: 'PO Count', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true },
    { key: 'sales', label: 'Sales', sublabel: 'monthly', defaultVisible: true },
    { key: 'score', label: 'Score', sublabel: 'adjust', defaultVisible: true },
    { key: 'purchased', label: 'Purchased', sublabel: 'sold', defaultVisible: true },
    { key: 'cost', label: 'Cost', sublabel: 'sell price', alwaysVisible: true, defaultVisible: true },
    { key: 'supplier', label: 'Supplier', sublabel: 'price', defaultVisible: true },
    { key: 'expiry', label: 'Expiry', sublabel: 'safety', defaultVisible: true },
    { key: 'supPlus', label: 'SUP+', defaultVisible: false },
]

export const COLUMN_WIDTHS: Record<ColumnKey, string> = {
    qty: 'w-12',
    requested: 'w-14',
    required: 'w-14',
    stock: 'w-24',
    poCount: 'w-12',
    status: 'w-16',
    sales: 'w-14',
    score: 'w-12',
    purchased: 'w-14',
    cost: 'w-20',
    supplier: 'w-16',
    expiry: 'w-16',
    supPlus: 'w-12',
}

export const RIGHT_ALIGNED_COLS = new Set<ColumnKey>([
    'qty', 'requested', 'required', 'sales', 'purchased', 'cost', 'supplier',
])

export const CENTER_ALIGNED_COLS = new Set<ColumnKey>([
    'poCount', 'status', 'score', 'expiry', 'supPlus',
])

export const GROW_COLS = new Set<ColumnKey>([
    'qty', 'stock', 'status', 'cost', 'supplier',
])

/** Default visible columns map */
export const DEFAULT_VISIBLE_MAP = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, c.defaultVisible]))

/** Default visible columns Set (legacy) */
export const DEFAULT_VISIBLE: Set<ColumnKey> = new Set(COLUMN_DEFS.filter(c => c.defaultVisible).map(c => c.key))

/** Default column order */
export const DEFAULT_ORDER: ColumnKey[] = COLUMN_DEFS.map(c => c.key)
