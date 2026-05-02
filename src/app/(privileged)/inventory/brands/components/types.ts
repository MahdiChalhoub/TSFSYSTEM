/* ═══════════════════════════════════════════════════════════
 *  SHARED TYPES — Inventory Brands Module
 * ═══════════════════════════════════════════════════════════ */

export interface Brand {
    id: number
    name: string
    short_name?: string | null
    logo?: string | null
    reference_code?: string | null
    translations?: Record<string, { name?: string; short_name?: string }>
    countries?: Array<{ id: number; name: string; code?: string }>
    categories?: Array<{ id: number; name: string; code?: string }>
    product_count?: number
    created_at?: string
    parent?: null // Brands are flat — always null, needed for TreeMasterPage
}

export type BrandPanelTab = 'overview' | 'products' | 'categories' | 'audit'
