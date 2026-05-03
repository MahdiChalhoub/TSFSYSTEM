/* ═══════════════════════════════════════════════════════════
 *  SHARED TYPES — Inventory Brands Module
 * ═══════════════════════════════════════════════════════════ */

export interface Brand {
    id: number
    name: string
    short_name?: string | null
    /** Short ISO-like identifier (e.g. "PNG"). Distinct from short_name
     *  which is a marketing display name (e.g. "P&G"). Used in compact
     *  list chips and pre-filled by the BRAND sequence on create. */
    code?: string | null
    logo?: string | null
    reference_code?: string | null
    translations?: Record<string, { name?: string; short_name?: string }>
    countries?: Array<{ id: number; name: string; code?: string }>
    categories?: Array<{ id: number; name: string; code?: string }>
    /** Root attribute groups linked to this brand (e.g. Parfum,
     *  Concentration, Volume). Leaf values come along automatically
     *  through the products. */
    attributes?: Array<{ id: number; name: string; code?: string; parent?: number | null }>
    /** Distinct product count (FK products → this brand). */
    product_count?: number
    /** Distinct categories the brand's products belong to. Derived
     *  server-side from product.category FK; may differ from the M2M
     *  brand.categories length when products use categories the brand
     *  isn't explicitly linked to. */
    category_count?: number
    /** Distinct countries the brand's products are sourced from /
     *  sold in. Derived from product.country FK. */
    country_count?: number
    /** Distinct attribute values across all of the brand's products.
     *  Derived from the Product.attribute_values M2M through-table. */
    attribute_count?: number
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

export type BrandPanelTab = 'overview' | 'products' | 'categories' | 'countries' | 'attributes' | 'audit'
