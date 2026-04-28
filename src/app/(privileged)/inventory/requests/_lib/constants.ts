import type { ColumnDef } from './types'

export const ALL_COLUMNS: ColumnDef[] = [
    { key: 'type',       label: 'Type',       defaultVisible: true },
    { key: 'product',    label: 'Product',    defaultVisible: true },
    { key: 'quantity',   label: 'Quantity',   defaultVisible: true },
    { key: 'priority',   label: 'Priority',   defaultVisible: true },
    { key: 'status',     label: 'Status',     defaultVisible: true },
    { key: 'supplier',   label: 'Supplier',   defaultVisible: false },
    { key: 'warehouses', label: 'Warehouses', defaultVisible: false },
    { key: 'requester',  label: 'Requester',  defaultVisible: false },
    { key: 'requestedAt',label: 'Requested',  defaultVisible: true },
    { key: 'bumpedAt',   label: 'Bumped',     defaultVisible: true },
    { key: 'reviewer',   label: 'Reviewer',   defaultVisible: false },
    { key: 'reviewedAt', label: 'Reviewed',   defaultVisible: false },
    { key: 'reason',     label: 'Reason',     defaultVisible: false },
    { key: 'po',         label: 'Linked PO',  defaultVisible: false },
]

export const COLUMN_WIDTHS: Record<string, string> = {
    type: 'w-24',
    product: 'w-44',
    quantity: 'w-20',
    priority: 'w-20',
    status: 'w-24',
    supplier: 'w-24',
    warehouses: 'w-32',
    requester: 'w-20',
    requestedAt: 'w-28',
    bumpedAt: 'w-24',
    reviewer: 'w-20',
    reviewedAt: 'w-24',
    reason: 'w-32',
    po: 'w-20',
}

export const RIGHT_ALIGNED_COLS = new Set(['quantity'])
export const GROW_COLS = new Set([
    'type', 'product', 'supplier', 'warehouses', 'reason',
    'priority', 'status', 'requestedAt', 'bumpedAt',
    'quantity', 'requester', 'reviewer', 'reviewedAt', 'po',
])

export const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED'] as const
export const TYPE_OPTIONS = ['PURCHASE', 'TRANSFER'] as const
export const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

export const EMPTY_FILTERS = {
    type: 'ALL' as 'ALL' | typeof TYPE_OPTIONS[number],
    status: 'ALL' as 'ALL' | typeof STATUS_OPTIONS[number],
    priority: 'ALL' as 'ALL' | typeof PRIORITY_OPTIONS[number],
    onlyBumped: false,
    onlyMine: false,
}

export type Filters = typeof EMPTY_FILTERS
