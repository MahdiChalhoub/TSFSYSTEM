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
    is_archived?: boolean
    archived_at?: string | null
}

export type PanelTab = 'overview' | 'products' | 'brands' | 'attributes'
