/* ═══════════════════════════════════════════════════════════
 *  SHARED TYPES — Inventory Categories Module
 * ═══════════════════════════════════════════════════════════ */

export interface CategoryNode {
    id: number
    name: string
    parent: number | null
    code?: string
    short_name?: string
    children?: CategoryNode[]
    product_count?: number
    brand_count?: number
    parfum_count?: number
    attribute_count?: number
    level?: number
    full_path?: string
    reference_code?: string
    barcode_prefix?: string
    name_fr?: string
    name_ar?: string
    translations?: Record<string, string>
}

export type PanelTab = 'overview' | 'products' | 'brands' | 'attributes' | 'audit'
