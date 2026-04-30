import {
    Hash, Shield, Globe, FileText,
    ShoppingBag, Receipt, Truck, CreditCard,
    PenLine, FolderTree, Award, Flower2, Ruler,
    Package, Sparkles, Layers, Tag,
    Warehouse as WarehouseIcon, RotateCcw,
} from 'lucide-react'
import type { DocumentType, TierDef, MasterDataType } from './types'

// ── Module Groups ────────────────────────────────────────────
// Group document types and master-data by business module for
// easier navigation. Each group renders as a visual section.

export type ModuleGroup<T> = {
    module: string
    color: string
    items: T[]
}

// ── 3-Tier Document Types — grouped by module ────────────────
export const DOCUMENT_GROUPS: ModuleGroup<DocumentType>[] = [
    {
        module: 'Purchasing',
        color: 'var(--app-info)',
        items: [
            { id: 'PURCHASE_ORDER', label: 'Purchase Order', icon: ShoppingBag, color: 'var(--app-info)' },
            { id: 'RECEIPT',        label: 'Receipt',         icon: Truck,       color: 'var(--app-info)' },
        ],
    },
    {
        module: 'Sales',
        color: 'var(--app-success)',
        items: [
            { id: 'QUOTATION',      label: 'Quotation',      icon: FileText,    color: 'var(--app-success)' },
            { id: 'SALES_ORDER',    label: 'Sales Order',     icon: ShoppingBag, color: 'var(--app-success)' },
            { id: 'DELIVERY_NOTE',  label: 'Delivery Note',   icon: Truck,       color: 'var(--app-success)' },
        ],
    },
    {
        module: 'Finance',
        color: 'var(--app-warning)',
        items: [
            { id: 'INVOICE',       label: 'Invoice',         icon: Receipt,     color: 'var(--app-warning)' },
            { id: 'CREDIT_NOTE',   label: 'Credit Note',     icon: RotateCcw,   color: 'var(--app-error)' },
            { id: 'PAYMENT',       label: 'Payment',         icon: CreditCard,  color: 'var(--app-warning)' },
        ],
    },
]

// Flat list for counting (used in tab badge)
export const DOCUMENT_TYPES: DocumentType[] = DOCUMENT_GROUPS.flatMap(g => g.items)

export const TIERS: TierDef[] = [
    { key: 'DRAFT',    label: 'Draft',    desc: 'Temporary — gaps allowed',    icon: PenLine, color: 'var(--app-muted-foreground)' },
    { key: 'INTERNAL', label: 'Internal', desc: 'Non-fiscal management scope', icon: Shield,  color: 'var(--app-warning)' },
    { key: 'OFFICIAL', label: 'Official', desc: 'Fiscal — strict sequential',  icon: Globe,   color: 'var(--app-success)' },
]

// ── Master-Data Codes — grouped by module ────────────────────
export const MASTER_DATA_GROUPS: ModuleGroup<MasterDataType>[] = [
    {
        module: 'Inventory — Products',
        color: 'var(--app-primary)',
        items: [
            { id: 'CATEGORY',          label: 'Categories',     icon: FolderTree, color: 'var(--app-primary)',  defaultPrefix: 'CAT-' },
            { id: 'BRAND',             label: 'Brands',         icon: Award,      color: 'var(--app-warning)',  defaultPrefix: 'BRA-' },
            { id: 'PARFUM',            label: 'Parfums',        icon: Flower2,    color: 'var(--app-primary)',  defaultPrefix: 'PAR-' },
            { id: 'PRODUCT_ATTRIBUTE', label: 'Attributes',     icon: Tag,        color: 'var(--app-info)',     defaultPrefix: 'ATT-' },
            { id: 'PRODUCT_GROUP',     label: 'Product Groups', icon: Layers,     color: 'var(--app-info)',     defaultPrefix: 'GRP-' },
        ],
    },
    {
        module: 'Inventory — Units & Packaging',
        color: 'var(--app-success)',
        items: [
            { id: 'UNIT',                      label: 'Units of Measure', icon: Ruler,    color: 'var(--app-success)',  defaultPrefix: 'UOM-' },
            { id: 'UNIT_PACKAGE',              label: 'Packages',          icon: Package,  color: 'var(--app-success)',  defaultPrefix: 'PKG-' },
            { id: 'PACKAGING_SUGGESTION_RULE', label: 'Packaging Rules',   icon: Sparkles, color: 'var(--app-success)',  defaultPrefix: 'PKR-' },
        ],
    },
    {
        module: 'Inventory — Warehousing',
        color: 'var(--app-warning)',
        items: [
            { id: 'WAREHOUSE', label: 'Warehouses', icon: WarehouseIcon, color: 'var(--app-warning)', defaultPrefix: 'WH-' },
        ],
    },
]

export const MASTER_DATA_TYPES: readonly MasterDataType[] = MASTER_DATA_GROUPS.flatMap(g => g.items)

// Default prefixes (match TransactionSequence.DOCUMENT_PREFIXES)
export const DEFAULT_PREFIXES: Record<string, Record<string, string>> = {
    PURCHASE_ORDER: { DRAFT: 'DFT-', INTERNAL: 'IPO-', OFFICIAL: 'PO-' },
    QUOTATION:      { DRAFT: 'DQT-', INTERNAL: 'IQT-', OFFICIAL: 'QT-' },
    SALES_ORDER:    { DRAFT: 'DSO-', INTERNAL: 'ISO-', OFFICIAL: 'SO-' },
    INVOICE:        { DRAFT: 'DINV-', INTERNAL: 'IINV-', OFFICIAL: 'INV-' },
    RECEIPT:        { DRAFT: 'DREC-', INTERNAL: 'IREC-', OFFICIAL: 'REC-' },
    CREDIT_NOTE:    { DRAFT: 'DCN-', INTERNAL: 'ICN-', OFFICIAL: 'CN-' },
    DELIVERY_NOTE:  { DRAFT: 'DDN-', INTERNAL: 'IDN-', OFFICIAL: 'DN-' },
    PAYMENT:        { DRAFT: 'DPAY-', INTERNAL: 'IPAY-', OFFICIAL: 'PAY-' },
}

export function resolveSeqKey(docType: string, tier: string) {
    return tier === 'OFFICIAL' ? docType : `${docType}_${tier}`
}
