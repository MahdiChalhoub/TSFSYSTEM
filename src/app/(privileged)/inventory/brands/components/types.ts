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

export interface ProductRow {
    id: number
    name: string
    sku?: string
    country?: number | null | undefined
    country_name?: string | null | undefined
    country_code?: string | null | undefined
    category?: number | null | undefined
    category_name?: string | null | undefined
    attribute_value_names?: string[] | undefined
    selling_price_ttc?: number | undefined
    image?: string | null | undefined
}

export type BrandPanelTab = 'overview' | 'products' | 'categories' | 'attributes' | 'audit'
